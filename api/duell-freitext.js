import { baueErstversuchPrompt } from "./freitext-bewerten.js";
import { antworteMitSicheremFehler, geminiAufrufen, geminiModellFuer,
  minimaleGeminiThinkingConfig, sichereApiAntwort, stelleGeminiErfolgSicher,
  supabaseRpc } from "../server/api-helpers.js";

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
      contents:[{parts:[{text:baueErstversuchPrompt(kontext,text,false)}]}],
      generationConfig:{thinkingConfig:minimaleGeminiThinkingConfig(modell)},
    }, modell);
    await stelleGeminiErfolgSicher(antwort);
    const daten=await antwort.json();
    const ausgabe=JSON.parse((daten.candidates?.[0]?.content?.parts?.[0]?.text||"").replace(/```json|```/g,"").trim());
    const korrekt=ausgabe.status==="richtig";
    const gespeichert=await supabaseRpc("duell_freitext_speichern",{
      p_zugang:zugang,p_frage_id:frageId,p_text:text,p_korrekt:korrekt,p_feedback:String(ausgabe.feedback||"").slice(0,300),
    });
    return res.status(200).json(Array.isArray(gespeichert)?gespeichert[0]:gespeichert);
  } catch (error) {
    return antworteMitSicheremFehler(res,502,"Die Antwort konnte gerade nicht bewertet werden. Bitte versuche es erneut.",error);
  }
}
