import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { betreffFuer } from "./betreff.js";
import { vorstandMail, vorstandZahlungMail } from "./vorstand-mail.js";

type Auftrag = {
  auftrag_id: string;
  ereignis_id: string;
  typ: string;
  metadaten: Record<string, unknown> | null;
  versuch: number;
  idempotenzschluessel: string;
  empfaenger_schluessel: string;
  ziel_email: string | null;
};

const LEERER_INHALT = "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>SR-Obmann</title></head><body><p>&nbsp;</p></body></html>";

function umgebung(name: string): string {
  return (Deno.env.get(name) || "").trim();
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = umgebung("SUPABASE_URL");
  const serviceKey = umgebung("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("supabase_config_missing");
  const antwort = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!antwort.ok) throw new Error(`rpc_${name}_${antwort.status}`);
  if (antwort.status === 204) return undefined as T;
  const text = await antwort.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function alsFehlerMarkieren(auftrag: Auftrag, code: string, endgueltig = false) {
  await rpc<void>("benachrichtigung_auftrag_fehlgeschlagen", {
    p_auftrag_id: auftrag.auftrag_id,
    p_fehlercode: code,
    p_endgueltig: endgueltig,
  });
}

Deno.serve(async (anfrage: Request) => {
  if (anfrage.method !== "POST") {
    return Response.json({ fehler: "methode_nicht_erlaubt" }, { status: 405 });
  }

  let auftraege: Auftrag[];
  try {
    auftraege = await rpc<Auftrag[]>("benachrichtigung_auftraege_v2_beanspruchen", { p_limit: 10 });
  } catch (fehler) {
    console.error("Benachrichtigungs-Claim fehlgeschlagen", fehler instanceof Error ? fehler.message : "unbekannt");
    return Response.json({ fehler: "claim_fehlgeschlagen" }, { status: 503 });
  }

  if (!Array.isArray(auftraege) || auftraege.length === 0) {
    return Response.json({ beansprucht: 0, versendet: 0, fehlgeschlagen: 0 });
  }

  const resendKey = umgebung("RESEND_API_KEY");
  const obmannEmpfaenger = umgebung("OBMANN_NOTIFICATION_TO");
  const absender = umgebung("OBMANN_NOTIFICATION_FROM");
  if (!resendKey || !absender) {
    await Promise.all(auftraege.map((a) => alsFehlerMarkieren(a, "versand_config_missing")));
    return Response.json({ fehler: "versand_nicht_konfiguriert" }, { status: 503 });
  }

  let versendet = 0;
  let fehlgeschlagen = 0;

  for (const auftrag of auftraege) {
    try {
      const istObmann = auftrag.empfaenger_schluessel === "max";
      const empfaenger = istObmann ? obmannEmpfaenger : auftrag.ziel_email;
      if (!empfaenger) {
        await alsFehlerMarkieren(auftrag, "empfaenger_fehlt", true);
        fehlgeschlagen += 1;
        continue;
      }
      const vorstand = istObmann ? null
        : auftrag.typ === "ausruestung.zahlung_beauftragt"
          ? vorstandZahlungMail(auftrag.metadaten || {})
          : vorstandMail(auftrag.metadaten || {});
      const antwort = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": auftrag.idempotenzschluessel,
        },
        body: JSON.stringify({
          from: absender,
          to: [empfaenger],
          subject: istObmann
            ? betreffFuer(auftrag.typ, auftrag.metadaten || {})
            : vorstand?.betreff,
          ...(istObmann
            ? { html: LEERER_INHALT, text: "" }
            : { text: vorstand?.text }),
        }),
      });

      let ergebnis: Record<string, unknown> = {};
      try { ergebnis = await antwort.json(); } catch { /* Resend ohne JSON */ }

      if (!antwort.ok) {
        const endgueltig = antwort.status >= 400 && antwort.status < 500 && antwort.status !== 429;
        await alsFehlerMarkieren(auftrag, `resend_${antwort.status}`, endgueltig);
        fehlgeschlagen += 1;
        continue;
      }

      await rpc<void>("benachrichtigung_auftrag_versendet", {
        p_auftrag_id: auftrag.auftrag_id,
        p_provider_id: typeof ergebnis.id === "string" ? ergebnis.id : "resend_ok",
      });
      versendet += 1;
    } catch (fehler) {
      console.error("Ein Versandauftrag ist fehlgeschlagen", auftrag.auftrag_id,
        fehler instanceof Error ? fehler.message : "unbekannt");
      try { await alsFehlerMarkieren(auftrag, "transport_fehler"); } catch { /* Lease laeuft aus */ }
      fehlgeschlagen += 1;
    }
  }

  return Response.json({ beansprucht: auftraege.length, versendet, fehlgeschlagen });
});
