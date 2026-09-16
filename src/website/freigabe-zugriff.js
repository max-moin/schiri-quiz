// ============================================================
//  Zugriff für die Vorstandsfreigabe
// ------------------------------------------------------------
//  Bewusst schlank und ohne Anmeldung: die Berechtigung steckt
//  allein im Token aus der Adresszeile. Der Server prüft ihn bei
//  JEDEM Aufruf neu - abgelaufen oder widerrufen heißt sofort
//  Schluss, auch mitten in der Sitzung.
// ============================================================
export function erstelleFreigabeZugriff({ adresse, oeffentlicherSchluessel }) {
  async function rufe(name, parameter) {
    const antwort = await fetch(`${adresse}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: oeffentlicherSchluessel,
        Authorization: `Bearer ${oeffentlicherSchluessel}`,
      },
      body: JSON.stringify(parameter || {}),
    });
    const text = await antwort.text();
    if (!antwort.ok) {
      let meldung = "Der Server ist gerade nicht erreichbar.";
      try { meldung = JSON.parse(text).message || meldung; } catch { /* Standardmeldung */ }
      throw new Error(meldung);
    }
    return text ? JSON.parse(text) : null;
  }

  return Object.freeze({
    uebersicht: (token) => rufe("freigabe_uebersicht", { p_token: token }),
    entscheiden: (token, id, entscheidung, name, notiz) => rufe("freigabe_entscheiden", {
      p_token: token, p_id: id, p_entscheidung: entscheidung,
      p_name: name, p_notiz: notiz || null,
    }),
  });
}

export function euro(cent) {
  if (cent === null || cent === undefined) return null;
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Summe der Beträge, die überhaupt einen Preis haben. */
export function summe(zeilen) {
  return zeilen.reduce((s, z) => s + (Number.isFinite(z.preis_cent) ? z.preis_cent : 0), 0);
}

/** Wie viele Zeilen gar keinen Preis tragen - das gehört an die Summe dazu. */
export function ohnePreis(zeilen) {
  return zeilen.filter((z) => !Number.isFinite(z.preis_cent)).length;
}

export const QUELLE_TEXT = Object.freeze({
  obmann: "vom Obmann eingetragen",
  schiri: "vom Schiedsrichter angegeben",
  richtwert: "Richtwert des Vereins",
  unbekannt: "kein Preis hinterlegt",
});

/** Beschreibt ein Stück in einer Zeile: "Trikot · rot · Größe M · lang". */
export function stueckText(zeile) {
  return [zeile.bezeichnung, zeile.farbe, zeile.groesse && `Größe ${zeile.groesse}`,
    zeile.aermellaenge && `${zeile.aermellaenge}er Arm`]
    .filter(Boolean).join(" · ");
}
