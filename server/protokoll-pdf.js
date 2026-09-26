import { fetchMitZeitlimit, ServerkonfigurationFehlt } from "./api-helpers.js";

export const PROTOKOLL_PDF_GRENZE = 3_000_000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ivwmixaicpmtvcjtnbjv.supabase.co";
const BUCKET = "sr-protokolle";

export function pdfAusBase64(base64) {
  if (typeof base64 !== "string" || base64.length > 4_000_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const daten = Buffer.from(base64, "base64");
  if (daten.length < 8 || daten.length > PROTOKOLL_PDF_GRENZE
      || daten.subarray(0, 5).toString("ascii") !== "%PDF-") return null;
  return daten;
}

export function pdfName(name) {
  const basis = String(name || "Protokoll.pdf")
    .replace(/[\\/\r\n\x00-\x1f]/g, "")
    .slice(0, 116).trim();
  return (basis || "Protokoll.pdf").replace(/\.pdf$/i, "") + ".pdf";
}

function speicherSchluessel() {
  const schluessel = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!schluessel) throw new ServerkonfigurationFehlt("SUPABASE_SECRET_KEY");
  return schluessel;
}

export function storageAdresse(pfad) {
  // Aufrufer uebergeben bereits den Storage-API-Pfad `object/...`.
  // Das alte zusaetzliche `/object` erzeugte `/object/object/...` (404).
  return `${SUPABASE_URL}/storage/v1/${pfad.split("/").map(encodeURIComponent).join("/")}`;
}

async function storageAnfrage(pfad, { method, body, contentType } = {}) {
  const schluessel = speicherSchluessel();
  const antwort = await fetchMitZeitlimit(storageAdresse(pfad), {
    method,
    headers: {
      apikey: schluessel,
      // sb_secret_* ist kein JWT. Wie bei den anderen Server-RPCs bleibt
      // Authorization fuer neue API-Schluessel bewusst aus.
      ...(!schluessel.startsWith("sb_") ? { Authorization: `Bearer ${schluessel}` } : {}),
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    ...(body !== undefined ? { body } : {}),
  }, 15_000, "Supabase Storage");
  if (!antwort.ok) throw new Error(`Storage HTTP ${antwort.status}`);
  return antwort;
}

export async function pdfHochladen(pfad, daten) {
  await storageAnfrage(`object/${BUCKET}/${pfad}`, {
    method: "POST", body: daten, contentType: "application/pdf",
  });
}

export async function pdfEntfernen(pfad) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(pfad || "")) return;
  await storageAnfrage(`object/${BUCKET}`, {
    method: "DELETE", body: JSON.stringify({ prefixes: [pfad] }),
    contentType: "application/json",
  });
}

export async function pdfSignieren(pfad) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(pfad || "")) {
    throw new Error("Ungueltiger PDF-Pfad");
  }
  const antwort = await storageAnfrage(`object/sign/${BUCKET}/${pfad}`, {
    method: "POST", body: JSON.stringify({ expiresIn: 300 }),
    contentType: "application/json",
  });
  const daten = await antwort.json();
  if (typeof daten.signedURL !== "string" || !daten.signedURL.startsWith("/object/sign/")) {
    throw new Error("Signierter PDF-Link fehlt");
  }
  return `${SUPABASE_URL}/storage/v1${daten.signedURL}`;
}
