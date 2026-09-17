// ============================================================
//  Zugriff und Aufbereitung für die Vorstandsfreigabe
// ------------------------------------------------------------
//  Bewusst ohne Anmeldung: die Berechtigung steckt allein im
//  Token aus der Adresszeile. Der Server prüft ihn bei JEDEM
//  Aufruf neu - abgelaufen oder widerrufen heißt sofort Schluss,
//  auch mitten in der Sitzung.
//
//  Seit v151 sieht ein Link außerdem nur noch seinen eigenen
//  Stapel: genau die Anfragen, die unter diesem Link vorgelegt
//  wurden. Vorher hätte ein laufender Link ohne Zutun immer
//  neue Vorgänge angezeigt.
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
    // "Freigegeben" heißt freigegebenes Budget, nicht ausgegebenes Geld.
    // Die Überweisung ist ein eigener Schritt - und wer ihn gemacht hat,
    // weiß nur der Vereinsverantwortliche selbst.
    zahlungAngewiesen: (token, id, name) => rufe("freigabe_zahlung_angewiesen", {
      p_token: token, p_id: id, p_name: name,
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
  vorgelegt: "so vorgelegt",
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
 * Der einzige Personenkontext, den diese Seite noch zeigt: was für
 * diese Person in der laufenden Saison bereits freigegeben wurde.
 *
 * Bewusst nur diese eine Zahl. Bis v150 standen hier der komplette
 * Ausrüstungsbestand und die vollständige Anfragehistorie jeder Person.
 * Für eine Entscheidung über ein Trikot braucht es das nicht - und bei
 * minderjährigen Schiedsrichtern ist es deutlich mehr, als ein
 * Vereinsverantwortlicher sehen muss.
 */
export function saisonKontext(zeile) {
  const anzahl = Number(zeile && zeile.saison_freigegeben_anzahl) || 0;
  if (!anzahl) return "In dieser Saison noch nichts freigegeben.";
  const summe = euro(zeile && zeile.saison_freigegeben_cent);
  const stueck = anzahl === 1 ? "ein Stück" : `${anzahl} Stücke`;
  return summe
    ? `In dieser Saison schon freigegeben: ${stueck} (${summe}).`
    : `In dieser Saison schon freigegeben: ${stueck}.`;
}
