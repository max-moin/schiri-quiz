import { sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { pdfName, pdfSignieren } from "../server/protokoll-pdf.js";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt." });
  }
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
