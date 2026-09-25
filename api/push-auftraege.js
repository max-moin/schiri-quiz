import { istSupabaseServerSchluesselKonfiguriert, sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { sendeSchluesselStimmt } from "./push-senden.js";
import { istPushDienst, nachrichtFuer, schickePush, vapidKonfiguration } from "../server/schiri-push.js";

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt" });
  }
  const geheimnis = process.env.PUSH_SENDE_SCHLUESSEL;
  if (!sendeSchluesselStimmt(req.headers?.["x-push-schluessel"], geheimnis)) {
    return res.status(401).json({ fehler: "Nicht berechtigt." });
  }
  const config = vapidKonfiguration();
  if (process.env.PUSH_DISPATCH_AKTIV !== "true" || !config
      || !istSupabaseServerSchluesselKonfiguriert()) {
    return res.status(503).json({ fehler: "Push-Versand ist nicht eingerichtet." });
  }

  let auftraege;
  try {
    auftraege = await supabaseRpc("schiri_push_auftraege_beanspruchen", { p_limit: 10 });
  } catch (fehler) {
    console.error("[API] Push-Claim fehlgeschlagen", fehler);
    return res.status(503).json({ fehler: "Versandaufträge konnten nicht geladen werden." });
  }
  let versendet = 0;
  let fehlgeschlagen = 0;
  for (const auftrag of Array.isArray(auftraege) ? auftraege : []) {
    try {
      const nutzlast = nachrichtFuer(auftrag.typ, auftrag.meldung_id, auftrag.gruppe);
      if (!nutzlast) {
        await supabaseRpc("benachrichtigung_auftrag_fehlgeschlagen", {
          p_auftrag_id: auftrag.auftrag_id, p_fehlercode: "push_typ_ungueltig", p_endgueltig: true,
        });
        fehlgeschlagen += 1;
        continue;
      }
      const abos = await supabaseRpc("schiri_push_zustellliste", { p_auftrag_id: auftrag.auftrag_id });
      if (!Array.isArray(abos) || abos.length === 0) {
        await supabaseRpc("benachrichtigung_auftrag_fehlgeschlagen", {
          p_auftrag_id: auftrag.auftrag_id, p_fehlercode: "kein_aktives_geraet", p_endgueltig: true,
        });
        fehlgeschlagen += 1;
        continue;
      }
      let voruebergehend = false;
      let angenommen = 0;
      for (const abo of abos) {
        if (!istPushDienst(abo.endpunkt)) {
          await supabaseRpc("push_abo_entfernen", { p_id: abo.id });
          continue;
        }
        let ergebnis;
        try { ergebnis = await schickePush(abo, nutzlast, config); }
        catch (fehler) {
          console.error("[API] Push-Transport fehlgeschlagen", fehler);
          voruebergehend = true;
          continue;
        }
        if (ergebnis.tot) await supabaseRpc("push_abo_entfernen", { p_id: abo.id });
        else if (!ergebnis.ok) voruebergehend = true;
        else angenommen += 1;
      }
      if (voruebergehend) {
        await supabaseRpc("benachrichtigung_auftrag_fehlgeschlagen", {
          p_auftrag_id: auftrag.auftrag_id, p_fehlercode: "push_transport",
        });
        fehlgeschlagen += 1;
      } else if (angenommen === 0) {
        await supabaseRpc("benachrichtigung_auftrag_fehlgeschlagen", {
          p_auftrag_id: auftrag.auftrag_id, p_fehlercode: "alle_geraete_ungueltig", p_endgueltig: true,
        });
        fehlgeschlagen += 1;
      } else {
        await supabaseRpc("benachrichtigung_auftrag_versendet", {
          p_auftrag_id: auftrag.auftrag_id, p_provider_id: "web_push_angenommen",
        });
        versendet += 1;
      }
    } catch (fehler) {
      console.error("[API] Push-Auftrag fehlgeschlagen", auftrag.auftrag_id, fehler);
      try {
        await supabaseRpc("benachrichtigung_auftrag_fehlgeschlagen", {
          p_auftrag_id: auftrag.auftrag_id, p_fehlercode: "push_dispatch_fehler",
        });
      } catch { /* Lease laeuft aus; der naechste Cron nimmt den Auftrag */ }
      fehlgeschlagen += 1;
    }
  }
  return res.status(200).json({ beansprucht: (auftraege || []).length, versendet, fehlgeschlagen });
}
