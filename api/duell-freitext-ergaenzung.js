// ============================================================
//  Zweiter Freitext-Versuch im Duell-Modus (Teil C, neu 05.09.2026)
// ============================================================
//  Struktur bewusst identisch zu api/duell-freitext.js - derselbe
//  Ablauf (Kontext laden, Gemini fragen, Ergebnis speichern), nur mit
//  dem Nachbesserungs-Prompt statt des Erstversuch-Prompts und den
//  beiden RPCs aus Migration v120 ("duell_freitext_ergaenzung_kontext"/
//  "...ergaenzung_speichern" statt "duell_freitext_kontext"/
//  "duell_freitext_speichern").
// ============================================================
import { baueNachbesserungsPrompt } from "./freitext-bewerten.js";
import { antworteMitSicheremFehler, geminiAufrufen, geminiModellFuer,
  minimaleGeminiThinkingConfig, sichereApiAntwort, stelleGeminiErfolgSicher,
  supabaseRpc } from "../server/api-helpers.js";

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") return res.status(405).json({ fehler:"Nur POST erlaubt" });
  if (!process.env.GEMINI_API_KEY)
    return res.status(503).json({ fehler:"Die Freitextbewertung ist vorübergehend nicht verfügbar." });
  const { zugang, frageId, ergaenzung } = req.body || {};
  const text = typeof ergaenzung === "string" ? ergaenzung.trim().slice(0,400) : "";
  if (!/^[0-9a-f-]{36}$/i.test(zugang||"") || !/^[0-9a-f-]{36}$/i.test(frageId||"") || !text)
    return res.status(400).json({ fehler:"Fehlende oder ungültige Angaben." });
  try {
    const roh = await supabaseRpc("duell_freitext_ergaenzung_kontext", { p_zugang:zugang, p_frage_id:frageId });
    const kontext = Array.isArray(roh) ? roh[0] : roh;
    if (!kontext) throw new Error("Für diese Frage ist keine Ergänzung offen.");
    const modell = geminiModellFuer("GEMINI_BEWERTUNGS_MODELL");
    const antwort = await geminiAufrufen(process.env.GEMINI_API_KEY, {
      contents:[{parts:[{text:baueNachbesserungsPrompt(kontext,text)}]}],
      generationConfig:{thinkingConfig:minimaleGeminiThinkingConfig(modell)},
    }, modell);
    await stelleGeminiErfolgSicher(antwort);
    const daten=await antwort.json();
    const ausgabe=JSON.parse((daten.candidates?.[0]?.content?.parts?.[0]?.text||"").replace(/```json|```/g,"").trim());
    // Nach dem zweiten Versuch gibt es nur noch richtig/falsch (siehe
    // Prompt) - ein unerwarteter Wert zaehlt sicherheitshalber als falsch.
    const korrekt = ausgabe.status === "richtig";
    const feedback = String(ausgabe.feedback||"").slice(0,300);

    const gespeichert=await supabaseRpc("duell_freitext_ergaenzung_speichern",{
      p_zugang:zugang,p_frage_id:frageId,p_zweiter_text:text,p_korrekt:korrekt,p_feedback:feedback,
    });
    return res.status(200).json(Array.isArray(gespeichert)?gespeichert[0]:gespeichert);
  } catch (error) {
    return antworteMitSicheremFehler(res,502,"Deine Ergänzung konnte gerade nicht bewertet werden. Bitte versuche es erneut.",error);
  }
}
