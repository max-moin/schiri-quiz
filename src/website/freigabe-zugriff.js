// ============================================================
//  Zugriff und Aufbereitung für die Vorstandsfreigabe
// ------------------------------------------------------------
//  Bewusst ohne Anmeldung: die Berechtigung steckt allein im
//  Token aus der Adresszeile. Der Server prüft ihn bei JEDEM
//  Aufruf neu - abgelaufen oder widerrufen heißt sofort Schluss,
//  auch mitten in der Sitzung.
//
//  Die Rechenteile stehen hier und nicht in der Seite, damit sie
//  prüfbar sind, ohne einen Browser zu bauen.
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
    dashboard: (token) => rufe("freigabe_dashboard", { p_token: token }),
    entscheiden: (token, id, entscheidung, name, notiz) => rufe("freigabe_entscheiden", {
      p_token: token, p_id: id, p_entscheidung: entscheidung,
      p_name: name, p_notiz: notiz || null,
    }),
  });
}

/* ---------- Zahlen und Text ---------- */

export function euro(cent) {
  if (cent === null || cent === undefined) return null;
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Beträge in einer Kachel: "–" ist ehrlicher als "0,00 €" bei nichts. */
export function betrag(cent, { nullIstNichts = false } = {}) {
  if (cent === null || cent === undefined) return "–";
  if (nullIstNichts && cent === 0) return "–";
  return euro(cent);
}

export function datum(wert) {
  return wert ? new Date(wert).toLocaleDateString("de-DE",
    { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

/** Beschreibt ein Stück in einer Zeile: "Trikot · rot · Größe M · langer Arm". */
export function stueckText(zeile) {
  return [zeile.bezeichnung, zeile.farbe, zeile.groesse && `Größe ${zeile.groesse}`,
    zeile.aermellaenge && `${zeile.aermellaenge}er Arm`]
    .filter(Boolean).join(" · ");
}

export const QUELLE_TEXT = Object.freeze({
  obmann: "vom Obmann eingetragen",
  schiri: "vom Schiedsrichter angegeben",
  richtwert: "Richtwert des Vereins",
  unbekannt: "kein Preis hinterlegt",
});

export const STAND_TEXT = Object.freeze({
  nicht_vorgelegt: "noch nicht vorgelegt",
  vorgelegt: "wartet auf dich",
  freigegeben: "übernimmt der Verein",
  abgelehnt: "abgelehnt",
});

/**
 * Summe der Beträge, die überhaupt einen Preis haben, und wie viele
 * keinen haben. Beides gehört zusammen: eine Summe ohne den Hinweis
 * "drei Zeilen fehlen darin" ist eine falsche Zahl.
 */
export function summeMitLuecken(zeilen) {
  const liste = Array.isArray(zeilen) ? zeilen : [];
  return {
    cent: liste.reduce((s, z) => s + (Number.isFinite(z.preis_cent) ? z.preis_cent : 0), 0),
    ohnePreis: liste.filter((z) => !Number.isFinite(z.preis_cent)).length,
    anzahl: liste.length,
  };
}

/**
 * Eine Zeile für die Personenübersicht: "2 angefragt · 1 freigegeben
 * (35,00 €) · 1 abgelehnt". Leere Teile fallen weg, damit bei einem
 * neuen Schiedsrichter nicht dreimal "0" steht.
 */
export function personZusammenfassung(person) {
  const teile = [];
  if (person.offen) teile.push(`${person.offen} wartet auf dich`);
  if (person.freigegeben) {
    const betragText = person.freigegeben_cent ? ` (${euro(person.freigegeben_cent)})` : "";
    teile.push(`${person.freigegeben} freigegeben${betragText}`);
  }
  if (person.abgelehnt) teile.push(`${person.abgelehnt} abgelehnt`);
  if (!teile.length) teile.push("noch nichts angefragt");
  return teile.join(" · ");
}

/** Wie viele Stücke jemand schon besitzt, nach Art zusammengefasst. */
export function bestandText(bestand) {
  const liste = Array.isArray(bestand) ? bestand : [];
  if (!liste.length) return "nichts eingetragen";
  return liste
    .map((s) => `${(s.anzahl ?? 1) > 1 ? `${s.anzahl}× ` : ""}${s.bezeichnung || s.kategorie}`)
    .join(", ");
}
