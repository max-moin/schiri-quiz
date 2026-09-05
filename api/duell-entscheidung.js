// Strukturierte Icon-Antwort im Quiz-Duell bewerten. Die fachliche
// Loesung bleibt im service_role-geschuetzten Serverpfad; der Browser
// erhaelt sie erst zusammen mit der eigenen Auswertung.

import {
  antworteMitSicheremFehler,
  geminiModellFuer,
  istGeminiKontingentErschoepft,
  istServerkonfigurationFehlt,
  istZeitueberschreitung,
  sichereApiAntwort,
  supabaseRpc,
} from "../server/api-helpers.js";
import {
  pruefeForm,
  pruefeVollstaendig,
  vergleicheOrtLokal,
  vergleicheOrtMitGemini,
} from "./entscheidung-bewerten.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") return res.status(405).json({ fehler: "Nur POST erlaubt" });
  const { zugang, frageId, antwort } = req.body || {};
  if (!UUID.test(String(zugang || "")) || !UUID.test(String(frageId || ""))) {
    return res.status(400).json({ fehler: "Ungültiger Duell-Zugang." });
  }
  const formfehler = pruefeForm(antwort);
  if (formfehler) return res.status(400).json({ fehler: formfehler });

  let kontext;
  try {
    kontext = await supabaseRpc("duell_entscheidung_kontext", {
      p_zugang: zugang,
      p_frage_id: frageId,
    });
  } catch (fehler) {
    antworteMitSicheremFehler(res, istServerkonfigurationFehlt(fehler) ? 503 : 400,
      istServerkonfigurationFehlt(fehler) ? "Die Serverfunktion ist vorübergehend nicht verfügbar." : "Frage nicht verfügbar.", fehler);
    return;
  }

  const fehlendes = pruefeVollstaendig(antwort, kontext);
  if (fehlendes) return res.status(400).json({ fehler: fehlendes });

  let ortPruefung = { gleichwertig: true, feedback: null };
  if (kontext.fordert_fortsetzung_ort !== false && antwort.spielfortsetzung !== "weiterspielen") {
    const lokal = vergleicheOrtLokal(antwort.fortsetzung_ort, kontext.fortsetzung_ort);
    if (lokal !== null) {
      ortPruefung = { gleichwertig: lokal, feedback: lokal ? null : "Die Ortsangabe bezeichnet einen anderen regeltechnischen Anknüpfungspunkt." };
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ fehler: "Die freie Ortsangabe kann gerade nicht geprüft werden." });
      try {
        ortPruefung = await vergleicheOrtMitGemini(apiKey, geminiModellFuer("GEMINI_ENTSCHEIDUNGS_MODELL"),
          kontext.frage_text, antwort.fortsetzung_ort, kontext.fortsetzung_ort);
      } catch (fehler) {
        antworteMitSicheremFehler(res,
          istGeminiKontingentErschoepft(fehler) ? 429 : istZeitueberschreitung(fehler) ? 504 : 502,
          istGeminiKontingentErschoepft(fehler) ? "Das KI-Kontingent ist gerade ausgeschöpft. Bitte versuche es später erneut."
            : istZeitueberschreitung(fehler) ? "Die Ortsprüfung dauert gerade zu lange." : "Die freie Ortsangabe konnte nicht geprüft werden.", fehler);
        return;
      }
    }
  }

  try {
    const ergebnis = await supabaseRpc("duell_entscheidung_speichern", {
      p_zugang: zugang,
      p_frage_id: frageId,
      p_antwort: antwort,
      p_ort_richtig: ortPruefung.gleichwertig,
      p_ort_feedback: ortPruefung.feedback,
    });
    res.status(200).json(ergebnis);
  } catch (fehler) {
    antworteMitSicheremFehler(res, istServerkonfigurationFehlt(fehler) ? 503 : 400,
      istServerkonfigurationFehlt(fehler) ? "Die Serverfunktion ist vorübergehend nicht verfügbar." : "Antwort konnte nicht gespeichert werden.", fehler);
  }
}
