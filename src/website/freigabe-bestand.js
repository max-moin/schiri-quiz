// ============================================================
// Bestandsansicht im persoenlichen Vorstandszugang
// ------------------------------------------------------------
// Reine Aufbereitung: keine Datenbank und keine Prozessaktionen.
// Dadurch kann die Bestandsdarstellung spaeter auch in der App oder
// beim Schiedsrichter dieselben Kategorien benutzen, ohne die
// Freigabelogik zu duplizieren.
// ============================================================

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

export const BESTANDSGRUPPEN = Object.freeze([
  { id: "trikot", titel: "Trikots", kategorien: ["trikot"], symbol: "trikot" },
  { id: "hose-stutzen", titel: "Hosen & Stutzen", kategorien: ["hose", "stutzen"], symbol: "hose" },
  { id: "schuhe", titel: "Schuhe", kategorien: ["schuhe"], symbol: "schuhe" },
  { id: "equipment", titel: "Equipment", kategorien: ["spielnotizkarten", "spesenquittungen",
    "schiedsrichtermappe", "gelbe_karte", "rote_karte", "pfeife", "sporttasche"], symbol: "equipment" },
  { id: "technik", titel: "Technik", kategorien: ["headset", "funkfahnen", "schiedsrichterfahnen"], symbol: "technik" },
  { id: "sonstiges", titel: "Sonstiges", kategorien: ["sonstiges"], symbol: "sonstiges" },
]);

const KATEGORIENAMEN = Object.freeze({
  trikot: "Trikot", hose: "Hose", stutzen: "Stutzen", schuhe: "Schuhe",
  spielnotizkarten: "Spielnotizkarten", spesenquittungen: "Spesenformulare",
  schiedsrichtermappe: "Schiedsrichtermappe", gelbe_karte: "Gelbe Karte",
  rote_karte: "Rote Karte", pfeife: "Pfeife", headset: "Headset",
  funkfahnen: "Funkfahnen", schiedsrichterfahnen: "Schiedsrichterfahnen",
  sporttasche: "Sporttasche", sonstiges: "Sonstiges",
});

const ZUSTAENDE = Object.freeze({
  einsatzbereit: "einsatzbereit", ersatz: "Reserve",
  verschlissen: "verschlissen", fehlt: "fehlt",
});

const FINANZIERUNG = Object.freeze({
  selbst: "selbst gekauft",
  verein: "vom Verein bezahlt",
  unbekannt: "Finanzierung unbekannt",
});

const FARBEN = Object.freeze({
  schwarz: "#171717", weiß: "#fff", weiss: "#fff", grau: "#8b9098",
  gelb: "#ffd43b", orange: "#f28c28", rot: "#dc3545", grün: "#258a4b",
  gruen: "#258a4b", blau: "#2474d2", violett: "#7b4cc9", pink: "#d94f9d",
});

export function bestandsgruppe(kategorie) {
  return BESTANDSGRUPPEN.find((gruppe) => gruppe.kategorien.includes(kategorie))
    || BESTANDSGRUPPEN.at(-1);
}

function symbol(art) {
  const pfade = {
    trikot: '<path d="M8 5 11 3h6l3 2 4 2-2 5-3-1v10H9V11l-3 1-2-5 4-2Z"/>',
    hose: '<path d="M8 4h8l2 17-5-1-1-8-1 8-5 1L8 4Z"/>',
    schuhe: '<path d="M4 15c4 1 6-5 8-5 1 4 3 5 8 6v4H4v-5Z"/>',
    equipment: '<path d="M5 8h14v12H5V8Zm4 0V5h6v3M8 13h8M8 17h5"/>',
    technik: '<path d="M6 13v-2a6 6 0 0 1 12 0v2M6 12H4v6h4v-6H6Zm12 0h2v6h-4v-6h2Z"/>',
    sonstiges: '<path d="M5 7h14v13H5V7Zm3 0V4h8v3M8 12h8M8 16h8"/>',
  };
  return `<svg class="fg-bestand-symbol" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${pfade[art] || pfade.sonstiges}</g></svg>`;
}

function eintraegeDerPerson(person, gruppe) {
  return (person.bestand || []).filter((eintrag) => gruppe.kategorien.includes(eintrag.kategorie)
    || (gruppe.id === "sonstiges" && !BESTANDSGRUPPEN.some((g) => g.id !== "sonstiges"
      && g.kategorien.includes(eintrag.kategorie))));
}

function anzahl(eintraege) {
  return eintraege.reduce((summe, eintrag) => summe + (Number(eintrag.anzahl) || 1), 0);
}

function eintragHtml(eintrag, gruppe) {
  const name = eintrag.bezeichnung || KATEGORIENAMEN[eintrag.kategorie] || "Ausrüstung";
  const farbwert = FARBEN[String(eintrag.farbe || "").toLocaleLowerCase("de")];
  const merkmale = [
    eintrag.farbe && `<span>${farbwert ? `<i class="fg-farbpunkt" style="--farbe:${farbwert}"></i>` : ""}${sicher(eintrag.farbe)}</span>`,
    eintrag.groesse && `<span>Größe ${sicher(eintrag.groesse)}</span>`,
    eintrag.aermellaenge && `<span>${sicher(eintrag.aermellaenge)}er Arm</span>`,
    `<span data-zustand="${sicher(eintrag.zustand)}">${sicher(ZUSTAENDE[eintrag.zustand] || eintrag.zustand)}</span>`,
    `<span data-finanzierung="${sicher(eintrag.finanzierung || "unbekannt")}">${sicher(FINANZIERUNG[eintrag.finanzierung || "unbekannt"])}</span>`,
  ].filter(Boolean).join("");
  return `<li class="fg-bestand-eintrag">
    <span class="fg-bestand-icon">${symbol(gruppe.symbol)}</span>
    <span class="fg-bestand-text"><b>${sicher(name)}</b><small>${merkmale}</small>
      ${eintrag.anmerkung ? `<em>${sicher(eintrag.anmerkung)}</em>` : ""}</span>
    ${Number(eintrag.anzahl) > 1 ? `<strong class="fg-bestand-menge">× ${Number(eintrag.anzahl)}</strong>` : ""}
  </li>`;
}

export function bestandsInhalt(bestandsstand, filter = "trikot") {
  const personen = bestandsstand?.personen || [];
  const gruppe = BESTANDSGRUPPEN.find((g) => g.id === filter) || BESTANDSGRUPPEN[0];
  const zaehler = BESTANDSGRUPPEN.map((g) => ({
    ...g,
    anzahl: personen.reduce((summe, person) => summe + anzahl(eintraegeDerPerson(person, g)), 0),
  }));
  return `<div class="fg-bestand-tabs" role="tablist" aria-label="Ausrüstungskategorie">
      ${zaehler.map((g) => `<button type="button" role="tab" data-bestand-filter="${g.id}"
        aria-selected="${g.id === gruppe.id}">${symbol(g.symbol)}<span>${sicher(g.titel)}</span>
        <b>${g.anzahl}</b></button>`).join("")}
    </div>
    <div class="fg-bestand-personen">
      ${personen.map((person) => {
        const eintraege = eintraegeDerPerson(person, gruppe);
        return `<details class="fg-bestand-person" data-bestand-person="${sicher(person.name)}">
          <summary><span><b>${sicher(person.name)}</b><small>${anzahl(eintraege)} in ${sicher(gruppe.titel)}</small></span>
            <span class="fg-bestand-badge">${anzahl(eintraege)}</span></summary>
          ${eintraege.length ? `<ul>${eintraege.map((x) => eintragHtml(x, gruppe)).join("")}</ul>`
            : `<p class="fg-bestand-leer">Kein Eintrag in dieser Kategorie.</p>`}
        </details>`;
      }).join("") || `<p class="fg-leer">Noch keine Schiedsrichter im Bestand.</p>`}
    </div>`;
}
