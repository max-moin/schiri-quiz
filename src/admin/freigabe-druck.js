// ============================================================
//  Die Freigabeliste zum Ausdrucken
// ------------------------------------------------------------
//  Die Rückfallebene, wenn der Link nicht in Frage kommt: eine
//  Seite, die man ausdruckt oder über "Als PDF sichern" weitergibt.
//
//  Bewusst window.print() statt einer PDF-Bibliothek. Das Projekt
//  hat keine Laufzeit-Abhängigkeiten, und jedes Betriebssystem
//  bietet im Druckdialog ohnehin "Als PDF sichern" an. Eine
//  Bibliothek wäre 300 KB für etwas, das der Browser kann.
//
//  Auf Papier gibt es keine Knöpfe. Deshalb zwei Kästchen zum
//  Ankreuzen und eine Linie für die Begründung - und unten eine
//  Unterschriftszeile, damit das Blatt als Beleg taugt.
// ============================================================

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

const euro = (cent) => (cent === null || cent === undefined)
  ? null : (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const stueck = (a) => [a.bezeichnung, a.farbe, a.groesse && `Größe ${a.groesse}`,
  a.aermellaenge && `${a.aermellaenge}er Arm`].filter(Boolean).join(" · ");

/**
 * Baut das Blatt. Getrennt vom Drucken selbst, damit der Aufbau
 * ohne Browser prüfbar ist.
 *
 * @param {object[]} anfragen  Zeilen aus obmann_freigabe_anfragen
 * @param {string}   verein    Vereinsname für die Kopfzeile
 * @param {Date}     heute     Ausstellungsdatum
 */
export function baueDruckliste(anfragen, verein, heute = new Date()) {
  const zeilen = (anfragen || []).filter((a) => a.freigabe_status !== "abgelehnt"
    && a.freigabe_status !== "freigegeben");
  const summe = zeilen.reduce((s, a) => s + (Number.isFinite(a.preis_cent) ? a.preis_cent : 0), 0);
  const ohnePreis = zeilen.filter((a) => !Number.isFinite(a.preis_cent)).length;

  const kopf = `
    <header class="dr-kopf">
      <div>
        <h1>Ausrüstung – Bitte um Freigabe</h1>
        <p>${sicher(verein)} · Schiedsrichter-Abteilung</p>
      </div>
      <p class="dr-datum">Stand ${heute.toLocaleDateString("de-DE")}</p>
    </header>
    <p class="dr-einstieg">Folgende Ausrüstung haben unsere Schiedsrichter angefragt.
      Bitte je Zeile ankreuzen und bei einer Ablehnung kurz begründen – die Begründung
      geben wir an den Schiedsrichter weiter.</p>`;

  if (!zeilen.length) {
    return `${kopf}<p class="dr-leer">Zurzeit liegt keine Anfrage vor.</p>`;
  }

  const tabelle = `
    <table class="dr-tabelle">
      <thead><tr>
        <th>Schiedsrichter</th><th>Stück</th><th class="dr-rechts">Preis</th>
        <th class="dr-mitte">Ja</th><th class="dr-mitte">Nein</th><th>Begründung</th>
      </tr></thead>
      <tbody>
        ${zeilen.map((a) => `
          <tr>
            <td>${sicher(a.person)}</td>
            <td>${sicher(stueck(a))}${a.anmerkung
              ? `<br /><small>„${sicher(a.anmerkung)}"</small>` : ""}</td>
            <td class="dr-rechts">${euro(a.preis_cent) || "–"}</td>
            <td class="dr-mitte"><span class="dr-kasten"></span></td>
            <td class="dr-mitte"><span class="dr-kasten"></span></td>
            <td class="dr-linie"></td>
          </tr>`).join("")}
      </tbody>
      <tfoot><tr>
        <td colspan="2">Summe${ohnePreis
          ? ` <small>(ohne ${ohnePreis} ${ohnePreis === 1 ? "Zeile" : "Zeilen"} ohne Preis)</small>` : ""}</td>
        <td class="dr-rechts">${euro(summe)}</td>
        <td colspan="3"></td>
      </tr></tfoot>
    </table>`;

  const fuss = `
    <div class="dr-unterschrift">
      <div><span class="dr-feld"></span><small>Name in Druckbuchstaben</small></div>
      <div><span class="dr-feld"></span><small>Datum</small></div>
      <div><span class="dr-feld"></span><small>Unterschrift</small></div>
    </div>
    <p class="dr-fuss">Bitte zurück an den Schiedsrichter-Obmann. Die Preise sind
      Richtwerte des Vereins, soweit nicht anders vermerkt.</p>`;

  return kopf + tabelle + fuss;
}

/** Legt das Blatt in den Druckbereich und öffnet den Druckdialog. */
export function druckeListe(ziel, anfragen, verein) {
  ziel.innerHTML = baueDruckliste(anfragen, verein);
  // Ohne die kurze Pause druckt Safari gelegentlich den alten Inhalt:
  // print() blockiert, bevor der neue Aufbau gezeichnet wurde.
  window.setTimeout(() => window.print(), 60);
}
