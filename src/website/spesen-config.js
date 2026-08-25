/**
 * Laedt die vom Obmann veroeffentlichte Spesenkonfiguration.
 *
 * Der statische Stand aus verein.config.js bleibt immer der Fallback. Damit
 * funktioniert der Rechner auch bei einer Supabase-Stoerung oder bevor der
 * Pilot zum ersten Mal gespeichert wurde.
 */

const kopie = (wert) => JSON.parse(JSON.stringify(wert));

function positiveZahl(wert, fallback, { nullErlaubt = false, minimum = 0, maximum = Infinity } = {}) {
  if (nullErlaubt && wert === null) return null;
  const zahl = Number(wert);
  return Number.isFinite(zahl) && zahl >= minimum && zahl <= maximum ? zahl : fallback;
}

function normalisiereLiga(liga, fallback) {
  if (!liga || typeof liga !== "object") return kopie(fallback);
  return {
    stufe: positiveZahl(liga.stufe, fallback.stufe),
    kurz: String(liga.kurz || fallback.kurz).trim(),
    voll: String(liga.voll || fallback.voll).trim(),
    verband: liga.verband === "sfv" ? "sfv" : "svfd",
    sr: positiveZahl(liga.sr, fallback.sr),
    sra: positiveZahl(liga.sra, fallback.sra, { nullErlaubt: true }),
  };
}

export function standardSpesenKonfiguration({
  altersklassen,
  turnier,
  fahrtkosten,
  vereine,
  ausfallAnteil,
}) {
  return kopie({
    schemaVersion: 1,
    altersklassen,
    turnier,
    fahrtkosten,
    vereine,
    ausfallAnteil,
  });
}

export function normalisiereSpesenKonfiguration(roh, fallback) {
  if (!roh || typeof roh !== "object") return kopie(fallback);

  const gruppen = Array.isArray(roh.altersklassen) && roh.altersklassen.length
    ? roh.altersklassen
    : fallback.altersklassen;

  const altersklassen = gruppen
    .filter((gruppe) => gruppe && typeof gruppe === "object")
    .map((gruppe, gruppenIndex) => {
      const fallbackGruppe = fallback.altersklassen[gruppenIndex]
        || { name: "Weitere", ligen: [] };
      const fallbackLigen = fallbackGruppe.ligen || [];
      const ligen = (Array.isArray(gruppe.ligen) ? gruppe.ligen : fallbackLigen)
        .map((liga, ligaIndex) => normalisiereLiga(
          liga,
          fallbackLigen[ligaIndex] || {
            stufe: 1,
            kurz: "Neue Liga",
            voll: "Neue Liga",
            verband: "svfd",
            sr: 0,
            sra: null,
          },
        ))
        .filter((liga) => liga.kurz && liga.voll);
      return { name: String(gruppe.name || fallbackGruppe.name).trim(), ligen };
    })
    .filter((gruppe) => gruppe.name && gruppe.ligen.length);

  const turnierRoh = roh.turnier || {};
  const fahrtRoh = roh.fahrtkosten || {};
  const stadtRoh = fahrtRoh.svfd || {};
  const landRoh = fahrtRoh.sfv || {};

  return {
    schemaVersion: 1,
    altersklassen,
    turnier: {
      grundpauschale: positiveZahl(turnierRoh.grundpauschale, fallback.turnier.grundpauschale),
      grundstunden: positiveZahl(turnierRoh.grundstunden, fallback.turnier.grundstunden, { minimum: 1 }),
      jeWeitereStunde: positiveZahl(turnierRoh.jeWeitereStunde, fallback.turnier.jeWeitereStunde),
    },
    fahrtkosten: {
      svfd: {
        preisJeKarte: positiveZahl(stadtRoh.preisJeKarte, fallback.fahrtkosten.svfd.preisJeKarte),
        kartenJeZone: positiveZahl(stadtRoh.kartenJeZone, fallback.fahrtkosten.svfd.kartenJeZone),
      },
      sfv: {
        monatskartePauschale: positiveZahl(landRoh.monatskartePauschale, fallback.fahrtkosten.sfv.monatskartePauschale),
        kmAuto: positiveZahl(landRoh.kmAuto, fallback.fahrtkosten.sfv.kmAuto),
        kmZuschlagMitnahme: positiveZahl(landRoh.kmZuschlagMitnahme, fallback.fahrtkosten.sfv.kmZuschlagMitnahme),
        kmFahrrad: positiveZahl(landRoh.kmFahrrad, fallback.fahrtkosten.sfv.kmFahrrad),
      },
    },
    vereine: Array.isArray(roh.vereine) && roh.vereine.length
      ? kopie(roh.vereine)
      : kopie(fallback.vereine),
    ausfallAnteil: positiveZahl(roh.ausfallAnteil, fallback.ausfallAnteil, { maximum: 1 }),
  };
}

export async function ladeSpesenKonfiguration({
  datenbank,
  seitenschluessel,
  fallback,
  fetchImpl = globalThis.fetch,
}) {
  if (!datenbank?.adresse || !datenbank?.oeffentlicherSchluessel || !seitenschluessel) {
    return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
  }

  try {
    const filter = encodeURIComponent(`eq.${seitenschluessel}`);
    const url = `${datenbank.adresse}/rest/v1/website_spesen_konfiguration`
      + `?seitenschluessel=${filter}&select=konfiguration,updated_at&limit=1`;
    const antwort = await fetchImpl(url, {
      headers: {
        apikey: datenbank.oeffentlicherSchluessel,
        Authorization: `Bearer ${datenbank.oeffentlicherSchluessel}`,
      },
    });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const zeilen = await antwort.json();
    if (!Array.isArray(zeilen) || !zeilen[0]?.konfiguration) {
      return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
    }
    return {
      konfiguration: normalisiereSpesenKonfiguration(zeilen[0].konfiguration, fallback),
      quelle: "datenbank",
      aktualisiertAm: zeilen[0].updated_at || null,
    };
  } catch (fehler) {
    console.warn("Spesenkonfiguration nicht erreichbar; statischer Stand wird verwendet.", fehler);
    return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
  }
}
