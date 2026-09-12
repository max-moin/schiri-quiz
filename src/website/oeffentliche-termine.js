// ============================================================
//  Die oeffentlichen Termine - einmal geholt, zweimal benutzt
// ============================================================
//  Seit dem 12.09.2026 braucht die Startseite dieselbe Liste an zwei
//  Stellen: oben im Band "Das steht an" und unten im Abschnitt
//  "Naechste Termine". Zweimal dieselbe Abfrage zu schicken waere nicht
//  nur Verschwendung, sondern koennte auch zwei verschiedene Staende
//  zeigen, wenn dazwischen jemand etwas freigibt.
//
//  Gelesen wird ausschliesslich ueber "oeffentliche_termine": die
//  Funktion gibt nur freigegebene, kuenftige Termine dieses Vereins
//  heraus, die Tabelle selbst ist von aussen nicht lesbar.
//
//  Schlaegt etwas fehl, kommt eine leere Liste zurueck - nie ein
//  Fehler. Die Startseite darf nicht davon abhaengen, dass ein fremder
//  Dienst antwortet.
// ============================================================

import { VEREIN, DATENBANK } from "../../verein.config.js";

let laufende = null;

export function holeOeffentlicheTermine() {
  if (laufende) return laufende;
  laufende = (async () => {
    if (!VEREIN.seitenschluessel) return [];
    try {
      const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/oeffentliche_termine`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: DATENBANK.oeffentlicherSchluessel,
          Authorization: `Bearer ${DATENBANK.oeffentlicherSchluessel}`,
        },
        body: JSON.stringify({ p_seitenschluessel: VEREIN.seitenschluessel }),
      });
      if (!antwort.ok) return [];
      const termine = await antwort.json();
      return Array.isArray(termine) ? termine : [];
    } catch {
      return [];
    }
  })();
  return laufende;
}
