export const STANDARD_FREIGABEN = Object.freeze({ spesen: false, regeln: false });

export function normalisiereFunktionsfreigaben(roh) {
  return Object.freeze({
    spesen: roh?.spesen_aktiv === true,
    regeln: roh?.regeln_aktiv === true,
  });
}

export async function ladeFunktionsfreigaben({
  datenbank,
  seitenschluessel,
  fetchImpl = globalThis.fetch,
}) {
  if (!datenbank?.adresse || !datenbank?.oeffentlicherSchluessel || !seitenschluessel) {
    return STANDARD_FREIGABEN;
  }
  try {
    const filter = encodeURIComponent(`eq.${seitenschluessel}`);
    const url = `${datenbank.adresse}/rest/v1/website_funktionsfreigaben`
      + `?seitenschluessel=${filter}&select=spesen_aktiv,regeln_aktiv&limit=1`;
    const antwort = await fetchImpl(url, {
      headers: {
        apikey: datenbank.oeffentlicherSchluessel,
        Authorization: `Bearer ${datenbank.oeffentlicherSchluessel}`,
      },
    });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const zeilen = await antwort.json();
    return normalisiereFunktionsfreigaben(Array.isArray(zeilen) ? zeilen[0] : null);
  } catch (fehler) {
    console.warn("Funktionsfreigaben nicht erreichbar; Regeln und Spesen bleiben gesperrt.", fehler);
    return STANDARD_FREIGABEN;
  }
}
