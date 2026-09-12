/**
 * Versand von Web-Push-Benachrichtigungen an die Schiedsrichter.
 *
 * NICHT ÖFFENTLICH. Ein offener Push-Endpunkt wäre ein Lautsprecher für
 * jeden, der die URL kennt - deshalb muss jeder Aufruf den Header
 * "x-push-schluessel" mit dem Wert aus PUSH_SENDE_SCHLUESSEL mitbringen.
 *
 * Erwartete Datenbankfunktionen (werden an anderer Stelle gebaut):
 *   push_abos_holen(p_alle boolean, p_schiedsrichter uuid[])
 *     -> Liste aus { id, endpunkt, p256dh, auth }
 *   push_abo_entfernen(p_id uuid)
 *
 * Körper: { titel, text, ziel } - "ziel" ist "alle" oder eine Liste
 * von Schiedsrichter-Kennungen.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import {
  antworteMitSicheremFehler,
  istSupabaseServerSchluesselKonfiguriert,
  sichereApiAntwort,
  supabaseRpc,
} from "../server/api-helpers.js";
import { MAX_KLARTEXT_BYTES, b64uDekodieren, pushZustellen } from "../server/webpush.js";

const MAX_TITEL = 80;
const MAX_TEXT = 300;
const MAX_EMPFAENGER = 500;

// Wie viele Zustellungen gleichzeitig laufen. Serienweise wäre bei 200
// Abos zu langsam für das Zeitlimit einer Vercel Function, alles auf
// einmal würde hunderte Verbindungen gleichzeitig aufmachen.
const GLEICHZEITIG = 10;

const KENNUNG = /^[0-9a-f-]{36}$/i;

export function pushEingabe(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const titel = typeof body.titel === "string" ? body.titel.trim().replace(/\s+/g, " ") : "";
  const text = typeof body.text === "string" ? body.text.trim().replace(/[\r\n]+/g, "\n") : "";
  if (!titel || titel.length > MAX_TITEL || !text || text.length > MAX_TEXT) return null;

  const ziel = body.ziel;
  if (ziel === "alle") return { titel, text, alle: true, kennungen: null };

  if (!Array.isArray(ziel) || ziel.length === 0 || ziel.length > MAX_EMPFAENGER) return null;
  const kennungen = [];
  for (const eintrag of ziel) {
    if (typeof eintrag !== "string" || !KENNUNG.test(eintrag)) return null;
    kennungen.push(eintrag);
  }
  return { titel, text, alle: false, kennungen };
}

/**
 * Zeitkonstanter Vergleich. Beide Seiten werden erst gehasht, weil
 * timingSafeEqual bei ungleicher Länge wirft - über diesen Wurf ließe
 * sich sonst die Länge des Geheimnisses ertasten.
 */
export function sendeSchluesselStimmt(uebergeben, erwartet) {
  if (typeof uebergeben !== "string" || !uebergeben || !erwartet) return false;
  const a = createHash("sha256").update(uebergeben, "utf8").digest();
  const b = createHash("sha256").update(erwartet, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function istBrauchbaresAbo(abo) {
  return Boolean(
    abo &&
      typeof abo.endpunkt === "string" &&
      abo.endpunkt.startsWith("https://") &&
      typeof abo.p256dh === "string" &&
      typeof abo.auth === "string"
  );
}

export default async function handler(req, res) {
  sichereApiAntwort(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt" });
  }

  const sendeSchluessel = process.env.PUSH_SENDE_SCHLUESSEL;
  const vapidPrivat = process.env.VAPID_PRIVATER_SCHLUESSEL;
  const vapidSub = process.env.VAPID_SUB;

  // Fehlt irgendein Teil der Konfiguration, wird der Dienst verweigert -
  // genau wie die KI-Endpunkte ohne Supabase-Schlüssel. Wichtig ist vor
  // allem: ohne PUSH_SENDE_SCHLUESSEL gibt es keinen Betrieb "ohne
  // Prüfung", sondern gar keinen.
  if (
    !sendeSchluessel ||
    !vapidPrivat ||
    !vapidSub ||
    !istSupabaseServerSchluesselKonfiguriert()
  ) {
    return res.status(503).json({ fehler: "Der Benachrichtigungsversand ist nicht eingerichtet." });
  }

  if (!sendeSchluesselStimmt(req.headers?.["x-push-schluessel"], sendeSchluessel)) {
    return res.status(401).json({ fehler: "Nicht berechtigt." });
  }

  if (!String(req.headers?.["content-type"] || "").startsWith("application/json")) {
    return res.status(415).json({ fehler: "Ungültiges Datenformat." });
  }

  const eingabe = pushEingabe(req.body);
  if (!eingabe) {
    return res.status(400).json({
      fehler: `Bitte einen Titel (max. ${MAX_TITEL} Zeichen), einen Text (max. ${MAX_TEXT} Zeichen) und ein gültiges Ziel angeben.`,
    });
  }

  // Der Service Worker liest genau diese drei Felder.
  const nutzlast = JSON.stringify({
    titel: eingabe.titel,
    text: eingabe.text,
    zeit: new Date().toISOString(),
  });
  if (Buffer.byteLength(nutzlast, "utf8") > MAX_KLARTEXT_BYTES) {
    return res.status(400).json({ fehler: "Die Benachrichtigung ist zu lang." });
  }

  let vapidPrivatRoh;
  try {
    vapidPrivatRoh = b64uDekodieren(vapidPrivat);
    if (vapidPrivatRoh.length !== 32) throw new Error("VAPID-Schlüssel hat nicht 32 Byte.");
  } catch (fehler) {
    return antworteMitSicheremFehler(
      res,
      503,
      "Der Benachrichtigungsversand ist nicht eingerichtet.",
      fehler
    );
  }

  let abos;
  try {
    const roh = await supabaseRpc("push_abos_holen", {
      p_alle: eingabe.alle,
      p_schiedsrichter: eingabe.alle ? null : eingabe.kennungen,
    });
    abos = (Array.isArray(roh) ? roh : []).filter(istBrauchbaresAbo);
  } catch (fehler) {
    return antworteMitSicheremFehler(
      res,
      503,
      "Die Empfängerliste konnte gerade nicht geladen werden.",
      fehler
    );
  }

  if (abos.length === 0) {
    return res.status(200).json({ ok: true, gesamt: 0, zugestellt: 0, aufgeraeumt: 0, fehlgeschlagen: 0 });
  }

  let zugestellt = 0;
  let aufgeraeumt = 0;
  let fehlgeschlagen = 0;

  const einesZustellen = async (abo) => {
    let ergebnis;
    try {
      ergebnis = await pushZustellen({
        abo,
        nutzlast,
        vapidPrivatRoh,
        sub: vapidSub,
        // 24 h: Wer sein Handy einen Tag nicht anschaltet, braucht die
        // Erinnerung danach nicht mehr.
        ttlSekunden: 24 * 60 * 60,
        dringlichkeit: "normal",
      });
    } catch (fehler) {
      // Netzfehler oder Zeitüberschreitung. Das Abo ist deswegen nicht
      // tot - beim nächsten Versand wird es erneut versucht.
      console.error("[API] Push-Zustellung fehlgeschlagen", fehler);
      fehlgeschlagen += 1;
      return;
    }

    if (ergebnis.ok) {
      zugestellt += 1;
      return;
    }

    if (ergebnis.tot) {
      // 404/410 heißt endgültig: App gelöscht oder Erlaubnis entzogen.
      // Solche Einträge müssen raus, sonst füllt sich die Tabelle mit
      // Leichen und jeder Versand wird langsamer.
      try {
        await supabaseRpc("push_abo_entfernen", { p_id: abo.id });
        aufgeraeumt += 1;
      } catch (fehler) {
        console.error("[API] Totes Push-Abo konnte nicht entfernt werden", fehler);
        fehlgeschlagen += 1;
      }
      return;
    }

    console.error(`[API] Push-Dienst antwortete mit HTTP ${ergebnis.status}`);
    fehlgeschlagen += 1;
  };

  for (let i = 0; i < abos.length; i += GLEICHZEITIG) {
    await Promise.all(abos.slice(i, i + GLEICHZEITIG).map(einesZustellen));
  }

  // Nach außen nur Zahlen. Endpunkt-URLs und Fehlertexte der
  // Push-Dienste bleiben in den geschützten Vercel-Logs.
  return res.status(200).json({
    ok: true,
    gesamt: abos.length,
    zugestellt,
    aufgeraeumt,
    fehlgeschlagen,
  });
}
