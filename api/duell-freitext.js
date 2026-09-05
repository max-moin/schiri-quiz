import { baueErstversuchPrompt } from "./freitext-bewerten.js";
import { antworteMitSicheremFehler, geminiAufrufen, geminiModellFuer,
  minimaleGeminiThinkingConfig, sichereApiAntwort, stelleGeminiErfolgSicher,
  supabaseRpc } from "../server/api-helpers.js";

// Bei "nachbessern" steht das Feedback fest, genau wie beim
// Wochenquiz-Gegenstueck (api/freitext-bewerten.js, NACHBESSERN_FEEDBACK):
// die freie Begruendung des Modells wuerde sonst genau den Punkt
// verraten, nach dem die Rueckfrage gleich fragt.
const NACHBESSERN_FEEDBACK = "Der Kern stimmt – ein Punkt fehlt noch.";
const ERLAUBTE_STATUS = ["richtig", "nachbessern", "falsch"];

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") return res.status(405).json({ fehler:"Nur POST erlaubt" });
  if (!process.env.GEMINI_API_KEY)
    return res.status(503).json({ fehler:"Die Freitextbewertung ist vorübergehend nicht verfügbar." });
  const { zugang, frageId, freitext } = req.body || {};
  const text = typeof freitext === "string" ? freitext.trim().slice(0,400) : "";
  if (!/^[0-9a-f-]{36}$/i.test(zugang||"") || !/^[0-9a-f-]{36}$/i.test(frageId||"") || !text)
    return res.status(400).json({ fehler:"Fehlende oder ungültige Angaben." });
  try {
    const roh = await supabaseRpc("duell_freitext_kontext", { p_zugang:zugang, p_frage_id:frageId });
    const kontext = Array.isArray(roh) ? roh[0] : roh;
    if (!kontext) throw new Error("Frage nicht verfügbar");
    const modell = geminiModellFuer("GEMINI_BEWERTUNGS_MODELL");
    const antwort = await geminiAufrufen(process.env.GEMINI_API_KEY, {
      // Drittes Argument jetzt "true": schaltet den Status "nachbessern"
      // fuer die KI-Bewertung frei (v120, Max' Feedback zur ersten
      // Fassung - vorher stand hier "false" und ein Duell-Teilnehmer
      // bekam nie die Chance auf den zweiten Versuch, die im normalen
      // Wochenquiz laengst existiert).
      contents:[{parts:[{text:baueErstversuchPrompt(kontext,text,true)}]}],
      generationConfig:{thinkingConfig:minimaleGeminiThinkingConfig(modell)},
    }, modell);
    await stelleGeminiErfolgSicher(antwort);
    const daten=await antwort.json();
    const ausgabe=JSON.parse((daten.candidates?.[0]?.content?.parts?.[0]?.text||"").replace(/```json|```/g,"").trim());

    // Serverseitig gegen die erlaubten Werte pruefen, genau wie im
    // Wochenquiz-Gegenstueck - ein unbekannter Status darf niemals
    // Richtung Datenbank durchgereicht werden.
    let status = typeof ausgabe.status === "string" ? ausgabe.status.trim().toLowerCase() : "";
    if (!ERLAUBTE_STATUS.includes(status)) {
      status = typeof ausgabe.korrekt === "boolean" ? (ausgabe.korrekt ? "richtig" : "falsch") : "falsch";
    }
    const nachfrage = status === "nachbessern"
      ? (typeof ausgabe.nachfrage === "string" && ausgabe.nachfrage.trim() ? ausgabe.nachfrage.trim().slice(0,300) : null)
      : null;
    const feedback = status === "nachbessern" ? NACHBESSERN_FEEDBACK : String(ausgabe.feedback||"").slice(0,300);

    const gespeichert=await supabaseRpc("duell_freitext_speichern",{
      p_zugang:zugang,p_frage_id:frageId,p_text:text,p_korrekt:status==="richtig",p_feedback:feedback,
      p_status:status,p_nachfrage:nachfrage,
    });
    return res.status(200).json(Array.isArray(gespeichert)?gespeichert[0]:gespeichert);
  } catch (error) {
    return antworteMitSicheremFehler(res,502,"Die Antwort konnte gerade nicht bewertet werden. Bitte versuche es erneut.",error);
  }
}
