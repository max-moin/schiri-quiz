import { randomUUID } from "node:crypto";
import { sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { pdfAusBase64, pdfEntfernen, pdfHochladen, pdfName, pdfSignieren } from "../server/protokoll-pdf.js";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt." });
  }
  if (req.body?.aktion === "link" || req.body?.schiedsrichterId) {
    return protokollLink(req, res);
  }
  const { terminId, passwort, datei, name } = req.body || {};
  const pdf = pdfAusBase64(datei);
  if (!UUID.test(terminId || "") || typeof passwort !== "string"
      || !passwort || passwort.length > 256 || !pdf) {
    return res.status(400).json({ fehler: "Bitte eine PDF-Datei bis 3 MB auswählen." });
  }

  try {
    const zeilen = await supabaseRpc("obmann_termin_protokoll", {
      p_passwort: passwort, p_termin_id: terminId,
    });
    if (!Array.isArray(zeilen) || zeilen.length !== 1) {
      return res.status(403).json({ fehler: "Kein Zugriff auf diesen Termin." });
    }
  } catch {
    return res.status(403).json({ fehler: "Kein Zugriff auf diesen Termin." });
  }

  const pfad = `${terminId.toLowerCase()}/${randomUUID()}.pdf`;
  try {
    await pdfHochladen(pfad, pdf);
  } catch (fehler) {
    console.error("[API] Protokoll-Upload fehlgeschlagen", fehler);
    return res.status(503).json({ fehler: "PDF konnte nicht hochgeladen werden." });
  }
  try {
    const alterPfad = await supabaseRpc("obmann_termin_protokoll_pdf_setzen", {
      p_passwort: passwort, p_termin_id: terminId,
      p_pfad: pfad, p_name: pdfName(name),
    });
    if (alterPfad) {
      try { await pdfEntfernen(alterPfad); }
      catch (fehler) { console.error("[API] Altes Protokoll-PDF blieb im Speicher", fehler); }
    }
    return res.status(200).json({ hochgeladen: true, name: pdfName(name), freigegeben: false });
  } catch (fehler) {
    try { await pdfEntfernen(pfad); } catch { /* Aufraeumen spaeter in Storage */ }
    console.error("[API] Protokoll-Zuordnung fehlgeschlagen", fehler);
    return res.status(503).json({ fehler: "PDF konnte dem Termin nicht zugeordnet werden." });
  }
}

// Ein zweiter API-Dateipfad wuerde die Hobby-Grenze von 12 Vercel Functions
// ueberschreiten. Der Linkweg nutzt deshalb dieselbe geschuetzte Function.
async function protokollLink(req, res) {
  const { terminId, schiedsrichterId, pin } = req.body || {};
  if (!UUID.test(terminId || "") || !UUID.test(schiedsrichterId || "")
      || typeof pin !== "string" || !pin || pin.length > 100) {
    return res.status(400).json({ fehler: "Anmeldung ungültig." });
  }
  let eintrag;
  try {
    const zeilen = await supabaseRpc("termin_protokoll_pdf_fuer_schiri", {
      p_schiedsrichter_id: schiedsrichterId,
      p_pin: pin, p_termin_id: terminId,
    });
    eintrag = Array.isArray(zeilen) ? zeilen[0] : null;
  } catch {
    return res.status(403).json({ fehler: "Kein Zugriff auf dieses Protokoll." });
  }
  if (!eintrag?.pfad) return res.status(404).json({ fehler: "Noch kein PDF-Protokoll freigegeben." });
  try {
    const vorschau = await pdfSignieren(eintrag.pfad);
    const download = new URL(vorschau);
    download.searchParams.set("download", pdfName(eintrag.name));
    return res.status(200).json({ vorschau, download: download.toString(),
      name: pdfName(eintrag.name), gueltigSekunden: 300 });
  } catch (fehler) {
    console.error("[API] Protokoll-Link fehlgeschlagen", fehler);
    return res.status(503).json({ fehler: "PDF ist gerade nicht erreichbar." });
  }
}
