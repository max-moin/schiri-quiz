// ============================================================
//  Termine der Vereinsseite
// ============================================================
//  Max am 29.08.2026: die Schiedsrichter sollen Termine ansehen und zu-
//  oder absagen koennen, bei einer Absage mit Grund. Angelegt, geaendert
//  und freigegeben werden Termine weiterhin ALLEIN in der Swift-App -
//  die Aufgabenteilung vom 25.08.2026 bleibt unangetastet.
//
//  Zwei Sichten in einer Datei, weil sie sich dieselben Daten und
//  dieselbe Darstellung teilen:
//
//    termine.html            -> Liste, nach Monat gruppiert
//    termine.html?termin=ID  -> ein Termin mit Zu-/Absage
//
//  Bewusst kein Kalenderraster. Max: "Kalender finde ich sehr unnützig
//  dafür. Wir haben zu wenig Termine, die da drinstehen." Bei vier bis
//  acht Terminen im Jahr waeren elf von zwoelf Monatszellen leer.
//
//  Wer NICHT angemeldet ist, sieht nur freigegebene Termine und keine
//  Namen. Das ist die Datenschutz-Auflage aus dem Backlog: auf der
//  oeffentlichen Seite stehen keine vereinsinternen Termine.
// ============================================================

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Wortmarken statt Symbole - Hausregel seit dem 21.08.2026.
const ARTEN = {
  lehrabend: "Lehrabend",
  lehrgang: "Lehrgang",
  treff: "Treff",
  event: "Event",
  sonstiges: "Termin",
};

export const GRUENDE = [
  ["arbeit", "Arbeit"],
  ["eigenes_spiel", "Eigenes Spiel"],
  ["urlaub", "Urlaub"],
  ["krank", "Krank"],
  ["familie", "Familie"],
  ["sonstiges", "Sonstiges"],
];
const GRUND_TEXT = Object.fromEntries(GRUENDE);

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g, (z) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// "2026-09-15" ohne Zeitzonenrechnung zerlegen. new Date("2026-09-15")
// liest UTC-Mitternacht; in Deutschland stuende dann je nach Sommerzeit
// der Vortag da - genau der Fehler, den die Datenbankfunktion mit
// "at time zone 'Europe/Berlin'" schon einmal vermeidet.
function alsDatum(iso) {
  const [jahr, monat, tag] = String(iso).split("-").map(Number);
  return new Date(jahr, monat - 1, tag);
}

const zweistellig = (zahl) => String(zahl).padStart(2, "0");

export function datumLang(iso) {
  const d = alsDatum(iso);
  return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

export function datumKurz(iso) {
  const d = alsDatum(iso);
  return `${WOCHENTAGE_KURZ[d.getDay()]} · ${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}.`;
}

export function monatsTitel(iso) {
  const d = alsDatum(iso);
  return `${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

// "19:00:00" -> "19:00". Postgres liefert Sekunden mit, die hier niemand
// braucht.
export function uhrzeit(wert) {
  if (!wert) return "";
  return String(wert).slice(0, 5);
}

export function zeitspanne(termin) {
  const beginn = uhrzeit(termin.beginn_zeit);
  if (!beginn) return "";
  const ende = uhrzeit(termin.ende_zeit);
  return ende ? `${beginn}–${ende} Uhr` : `${beginn} Uhr`;
}

// ---------- Serverzugriff ----------

// Berechtigungen kommen aus dem jeweiligen RPC, niemals nur aus „angemeldet“.
export function verbindeTerminSichten(oeffentlich, eigene) {
  const termine = new Map(oeffentlich.map(t => [t.id, { ...t, mitgliedSicht: false }]));
  for (const termin of eigene) termine.set(termin.id, { ...termin, mitgliedSicht: true });
  return [...termine.values()].sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

export function erstelleTerminZugriff({ adresse, oeffentlicherSchluessel }) {
  async function rufe(name, parameter) {
    const antwort = await fetch(`${adresse}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: oeffentlicherSchluessel,
        Authorization: `Bearer ${oeffentlicherSchluessel}`,
      },
      body: JSON.stringify(parameter),
    });
    if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`);
    const daten = await antwort.json();
    return Array.isArray(daten) ? daten : [];
  }

  return Object.freeze({
    // Ohne Anmeldung: nur freigegebene Termine, keine Namen.
    alleOeffentlich: (seitenschluessel) =>
      rufe("oeffentliche_termine_alle", { p_seitenschluessel: seitenschluessel }),

    // Mit Anmeldung: auch interne Termine des eigenen Vereins, dazu der
    // eigene Stand und die Zaehlstaende.
    alleFuerMitglied: (person) =>
      rufe("termine_fuer_schiri", { p_schiedsrichter_id: person.id, p_pin: person.pin }),

    zusagen: (person, terminId) =>
      rufe("termin_zusagen", {
        p_schiedsrichter_id: person.id, p_pin: person.pin, p_termin_id: terminId,
      }),

    melden: (person, terminId, status, grund, kommentar) =>
      rufe("termin_rueckmeldung_setzen", {
        p_schiedsrichter_id: person.id, p_pin: person.pin, p_termin_id: terminId,
        p_status: status, p_grund: grund || null, p_kommentar: kommentar || null,
      }),

    // Terminsuche unter mehreren Vorschlaegen (v91). Immer intern -
    // es gibt bewusst keine Fassung ohne Anmeldung.
    terminfindungen: (person) =>
      rufe("terminfindungen_fuer_schiri", {
        p_schiedsrichter_id: person.id, p_pin: person.pin,
      }),

    stimmen: (person, vorschlagId, antwort) =>
      rufe("terminfindung_stimme_setzen", {
        p_schiedsrichter_id: person.id, p_pin: person.pin,
        p_vorschlag_id: vorschlagId, p_antwort: antwort,
      }),
  });
}

// ---------- Darstellung ----------

export function terminKarte(termin, { alsLink = true } = {}) {
  const streifen = termin.mein_status === "zu" ? " zugesagt"
    : termin.mein_status === "ab" ? " abgesagt" : "";
  const vergangen = termin.vergangen ? " vergangen" : "";

  const zeit = zeitspanne(termin);
  const angaben = [
    zeit ? `<span><b>${sicher(zeit)}</b></span>` : "",
    termin.ort ? `<span>${sicher(termin.ort)}</span>` : "",
  ].filter(Boolean).join('<span class="tk-punkt" aria-hidden="true">·</span>');

  const marken = [];
  if (termin.pflicht) marken.push('<span class="wortmarke gelb">Pflicht</span>');
  marken.push(`<span class="wortmarke">${sicher(ARTEN[termin.art] || ARTEN.sonstiges)}</span>`);

  // Der eigene Stand steht nur da, wenn es einen gibt - "noch keine
  // Rueckmeldung" bei einem vergangenen Termin waere ein Vorwurf ohne
  // Handlungsmoeglichkeit.
  let stand = "";
  if (termin.mein_status === "zu") stand = '<span class="wortmarke gruen">Du bist dabei</span>';
  else if (termin.mein_status === "ab") stand = '<span class="wortmarke rot">Abgesagt</span>';
  else if (termin.mein_status === null && !termin.vergangen) {
    stand = '<span class="wortmarke offen">Noch keine Rückmeldung</span>';
  }

  const innen = `
    <span class="tk-oben">
      <span class="tk-wann">${sicher(datumKurz(termin.datum))}</span>
      <span class="tk-marken">${marken.join("")}</span>
    </span>
    <span class="tk-titel">${sicher(termin.titel)}</span>
    ${angaben ? `<span class="tk-angaben">${angaben}</span>` : ""}
    ${stand ? `<span class="tk-stand">${stand}</span>` : ""}`;

  if (!alsLink) return `<div class="terminkarte${streifen}${vergangen}">${innen}</div>`;
  return `<a class="terminkarte${streifen}${vergangen}" href="termine.html?termin=${encodeURIComponent(termin.id)}">${innen}</a>`;
}

export const STIMMEN = [
  ["ja", "Ja"],
  ["vielleicht", "Vielleicht"],
  ["nein", "Nein"],
];

// Eine Terminsuche als Karte. Anders als beim festen Termin gibt es hier
// drei Antworten statt zwei: "vielleicht" trennt "geht knapp" von "geht
// gar nicht" und ist bei der Terminsuche die eigentlich wichtige Angabe.
export function findungKarte(findung) {
  const vorschlaege = Array.isArray(findung.vorschlaege) ? findung.vorschlaege : [];
  const entschieden = findung.status === "entschieden";

  const zeilen = vorschlaege.map((v) => {
    const gewaehlt = entschieden && v.id === findung.gewaehlter_vorschlag;
    const angaben = [
      uhrzeit(v.beginn_zeit) ? `${sicher(uhrzeit(v.beginn_zeit))} Uhr` : "",
      v.ort ? sicher(v.ort) : "",
    ].filter(Boolean).join(" · ");

    // Nach der Entscheidung sind die Knoepfe sinnlos - dann zaehlt nur
    // noch, welcher Vorschlag es geworden ist.
    const knoepfe = entschieden ? "" : `
      <div class="tf-stimmen">
        ${STIMMEN.map(([wert, text]) => `
          <button type="button" class="tf-stimme ${wert}${v.meine_antwort === wert ? " an" : ""}"
                  data-vorschlag="${sicher(v.id)}" data-antwort="${wert}">${text}</button>`).join("")}
      </div>`;

    const stand = [
      Number(v.ja) ? `${v.ja} ja` : "",
      Number(v.vielleicht) ? `${v.vielleicht} vielleicht` : "",
      Number(v.nein) ? `${v.nein} nein` : "",
    ].filter(Boolean).join(" · ");

    return `<div class="tf-vorschlag${gewaehlt ? " gewaehlt" : ""}">
        <div class="tf-kopfzeile">
          <span class="tf-datum">${sicher(datumKurz(v.datum))}</span>
          ${angaben ? `<span class="tf-angaben">${angaben}</span>` : ""}
          ${gewaehlt ? '<span class="wortmarke gruen">Es wird dieser</span>' : ""}
        </div>
        ${knoepfe}
        ${stand ? `<p class="tf-stand">${sicher(stand)}</p>` : ""}
      </div>`;
  }).join("");

  const frist = findung.antwort_bis && !entschieden
    ? `<p class="tf-frist">Antwort bis ${sicher(datumLang(findung.antwort_bis))}</p>` : "";

  return `<article class="terminfindung${entschieden ? " entschieden" : ""}" data-findung="${sicher(findung.id)}">
      <div class="tf-kopf">
        <span class="wortmarke${entschieden ? "" : " blau"}">${entschieden ? "Entschieden" : "Terminsuche"}</span>
        <h3>${sicher(findung.titel)}</h3>
        ${findung.beschreibung ? `<p class="tf-text">${sicher(findung.beschreibung)}</p>` : ""}
        ${frist}
      </div>
      <div class="tf-liste">${zeilen}</div>
      <p class="tf-meldung" data-tf-meldung hidden role="status"></p>
    </article>`;
}

// Nach Monat gruppieren. Die Liste kommt absteigend vom Server; kuenftige
// Termine sollen aber aufsteigend stehen (das Naechste zuerst), und
// vergangene absteigend (das zuletzt Gewesene zuerst).
export function nachMonatenGruppiert(termine) {
  const gruppen = [];
  termine.forEach((termin) => {
    const titel = monatsTitel(termin.datum);
    let gruppe = gruppen.find((g) => g.titel === titel);
    if (!gruppe) {
      gruppe = { titel, termine: [] };
      gruppen.push(gruppe);
    }
    gruppe.termine.push(termin);
  });
  return gruppen;
}

export function teileVergangenheitAb(termine) {
  const kuenftig = termine.filter((t) => !t.vergangen)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const vergangen = termine.filter((t) => t.vergangen)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return { kuenftig, vergangen };
}

export { sicher, GRUND_TEXT, ARTEN };
