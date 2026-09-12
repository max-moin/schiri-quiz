// ============================================================
//  duell.html - der Duell-Modus
// ============================================================
//  Kompletter Neubau (05.09.2026). Die erste Fassung (von Codex gebaut)
//  fand Max "sieht richtig scheiße aus" - diese Version soll sich wie
//  der Rest der Vereinsseite anfuehlen: dieselbe Karten-/Farbsprache wie
//  quiz.html (siehe stil/duell.css), nicht wie ein rohes Formular.
//
//  Die grossen Fachverantwortungen sind ausgelagert (Vorbild:
//  melden-seite.js/melden-arten.js/zeichen-zaehler.js):
//   - duell-zugriff.js:        alle Serveraufrufe (RPC + die beiden
//                              KI-Endpunkte fuer Freitext).
//   - duell-verlauf-ansicht.js: Vergleichs-/Auswertungsdarstellung
//                              (Teile B/D).
//   - duell-reaktionen.js:     das Emoji-Gimmick (Teil F, niedrigste
//                              Prioritaet).
//  Diese Datei bleibt der Ablauf: welcher Bildschirm gerade steht und
//  was beim Antworten passiert.
// ============================================================

import { DATENBANK } from "../../verein.config.js";
import { erstelleDuellZugriff } from "./duell-zugriff.js";
import { baueVergleichsBlock, findeTeilnehmerZeile, baueUebersicht } from "./duell-verlauf-ansicht.js";
import { baueReaktionsleiste, bauePille, zeigeKurzeEinblendung, findeLetzteFremdeReaktion } from "./duell-reaktionen.js";
import { mediumHtml, verdrahteMedium, zahlEingabeHtml, formatZahl, erstelleDuellEntscheidungsController } from "./duell-fragen-ansicht.js";

const root = document.getElementById("duellBereich");
const kopfTitel = document.getElementById("duell-kopf-titel");
const kopfUntertitel = document.getElementById("duell-kopf-untertitel");
const kopfFortschritt = document.getElementById("duell-kopf-fortschritt");
const kopfFortschrittText = document.getElementById("duell-kopf-fortschritt-text");
const kopfCode = document.getElementById("duell-kopf-code");
const kopfFill = document.getElementById("duell-kopf-fortschritt-fill");

// seite.js montiert die gemeinsame Anmeldung normalerweise zusammen mit
// der Vereinsnavigation. duell.html hat absichtlich den kompakten
// Wochenquiz-Kopf und damit keinen `.seiten-kopf .kopf-innen`. Deshalb
// initialisiert diese Seite den vorhandenen Anmeldebaustein selbst.
function holeSeitenAnmeldung() {
  if (globalThis.SchiriSeitenAnmeldung) return globalThis.SchiriSeitenAnmeldung;
  if (!globalThis.SchiriAnmeldung || !globalThis.SchiriLoginDialog || !globalThis.SchiriQuizMaskedInputs) {
    return { anmeldung: null, loginDialog: null };
  }
  const anmeldung = globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
  const loginDialog = globalThis.SchiriLoginDialog.erstelleLoginDialog({
    anmeldung,
    maskierung: globalThis.SchiriQuizMaskedInputs,
  });
  const bereit = Object.freeze({ anmeldung, loginDialog });
  globalThis.SchiriSeitenAnmeldung = bereit;
  return bereit;
}

const { anmeldung, loginDialog } = holeSeitenAnmeldung();
const zaehlwerkModul = globalThis.SchiriZeichenZaehler || null;
const api = erstelleDuellZugriff(DATENBANK);

const FREITEXT_ZEICHENLIMIT = 400;
const SPEICHER_SITZUNG = "schiriDuellSession";
// NUR eine Merkliste der zuletzt gesehenen Codes (Teil E) - der aktuell
// aktive Zugang bleibt wie bisher in sessionStorage. Ohne den Zugang
// waere ein gemerkter Code fuer ein Gast-Duell allerdings nutzlos: erneut
// beitreten scheitert am selben Namen ("Dieser Name ... ist bereits im
// Duell"), und "duell_verlauf" braucht den Zugang, nicht den Code. Der
// Zugang steht deshalb mit in der Merkliste, auch wenn das eine Zeile
// mehr ist als die knappe Beispielform {code, zuletztGesehenAm}.
const SPEICHER_LETZTE_DUELLE = "schiriDuellVerlauf";
const LETZTE_DUELLE_MAX = 8;

let sitzung = null;
let frage = null;
let entscheidung = null;

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function speichernSitzung(wert) {
  sitzung = wert;
  try { sessionStorage.setItem(SPEICHER_SITZUNG, JSON.stringify(wert)); } catch { /* privater Modus */ }
}
function lesenSitzung() {
  try { return JSON.parse(sessionStorage.getItem(SPEICHER_SITZUNG)); } catch { return null; }
}

function setzeKopf({ titel = "Quiz-Duell", untertitel = "Fünf frühere Wochenfragen – direkt gegeneinander.", position = null, gesamt = 5 } = {}) {
  kopfTitel.textContent = titel;
  kopfUntertitel.textContent = untertitel;
  const imSpiel = Number.isInteger(position);
  kopfFortschritt.hidden = !imSpiel;
  if (!imSpiel) return;
  const prozent = Math.round(((position - 1) / gesamt) * 100);
  kopfFortschrittText.textContent = `Frage ${position} von ${gesamt}`;
  kopfCode.textContent = `Duell ${sitzung?.code || ""}`;
  kopfFill.style.width = `${prozent}%`;
  kopfFill.parentElement?.setAttribute("aria-valuenow", String(prozent));
}

function neuesDuellStarten() {
  speichernSitzung(null);
  history.replaceState({}, "", location.pathname);
  startAnsicht();
}

function leseLetzteDuelle() {
  try { const liste = JSON.parse(localStorage.getItem(SPEICHER_LETZTE_DUELLE)); return Array.isArray(liste) ? liste : []; }
  catch { return []; }
}
function merkeLetztesDuell(code, zugang) {
  try {
    const liste = leseLetzteDuelle().filter((e) => e.code !== code);
    liste.unshift({ code, zugang, zuletztGesehenAm: Date.now() });
    localStorage.setItem(SPEICHER_LETZTE_DUELLE, JSON.stringify(liste.slice(0, LETZTE_DUELLE_MAX)));
  } catch { /* kein Verlauf, aber das Duell selbst funktioniert trotzdem */ }
}

function fehler(error) {
  root.querySelector("[data-fehler]")?.remove();
  root.insertAdjacentHTML("afterbegin", `<p class="duell-fehler" data-fehler>${esc(error.message)}</p>`);
}
function versteckeFehler() { root.querySelector("[data-fehler]")?.remove(); }


// ---------- Einstiegsbildschirm ----------
//
// Umbau am 11.09.2026 nach drei moderierten Tests. "Ein Duell starten"
// ist in ALLEN DREI Sitzungen gescheitert, jedes Mal an derselben
// Stelle. Beobachtet wurde:
//   - Die zwei Karten "Neues Duell" und "Beitreten" sahen gleich
//     wichtig aus. Welche der beiden der eigene Weg ist, war nicht
//     erkennbar; zwei Personen haben ueber "Beitreten" versucht, sich
//     SELBST einen Code zu erzeugen.
//   - Die alte Knopfbeschriftung klang nach einer Pflichtuebung vor
//     dem Spiel, nicht nach "ich eroeffne hier eine Runde".
//   - Wer ueber einen geteilten Link kam, sah trotzdem beide Karten und
//     baute sich daneben einen zweiten, leeren Raum.
//   - Danach war nie sichtbar, ob ueberhaupt jemand beigetreten ist.
//     Der Wunsch nach einem Warteraum stand schon im ersten Test woertlich.
// Deshalb: der Einladungsfall bekommt einen eigenen Bildschirm, die
// beiden Wege sind unterschiedlich gewichtet, die Wortwahl sagt was
// passiert, und aus dem Code-Bildschirm wird ein echter Warteraum.

function relativeZeit(zeitstempel) {
  const minuten = Math.round((Date.now() - zeitstempel) / 60000);
  if (minuten < 60) return "gerade eben";
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  return `vor ${Math.round(stunden / 24)} Tagen`;
}

function leseCodeAusAdresse() {
  return new URLSearchParams(location.search).get("code")?.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 6) || "";
}

async function baueLetzteDuelleHtml(person) {
  // Angemeldete Vereinsmitglieder bekommen die zuverlaessigere,
  // geraeteuebergreifende Liste vom Server; Gaeste ohne Konto bleiben auf
  // die lokal gemerkten Codes angewiesen (fuer sie gibt es keine
  // serverseitige Identitaet, an der man das festmachen koennte).
  if (person) {
    const liste = await api.meineListe(person).catch(() => []);
    if (!liste?.length) return "";
    const zeilen = liste.slice(0, LETZTE_DUELLE_MAX).map((d) => `<button type="button" class="duell-liste-eintrag" data-code="${esc(d.code)}" data-zugang="${esc(d.zugang)}">
      <span class="duell-liste-code">${esc(d.code)}</span>
      <span class="duell-liste-info">${d.ich_richtig}/${d.ich_beantwortet} richtig · ${d.status === "offen" ? "läuft noch" : "beendet"}</span></button>`).join("");
    return `<section class="card duell-letzte-duelle"><h2>Deine Duelle</h2>
      <p class="duell-kleingedruckt">Tipp auf ein Duell, um dort weiterzumachen oder die Auswertung zu sehen.</p>
      <div class="duell-liste">${zeilen}</div></section>`;
  }
  const lokal = leseLetzteDuelle();
  if (!lokal.length) return "";
  const zeilen = lokal.map((d) => `<button type="button" class="duell-liste-eintrag" data-code="${esc(d.code)}" data-zugang="${esc(d.zugang)}">
    <span class="duell-liste-code">${esc(d.code)}</span>
    <span class="duell-liste-info">${esc(relativeZeit(d.zuletztGesehenAm))}</span></button>`).join("");
  return `<section class="card duell-letzte-duelle"><h2>Zuletzt gespielt</h2>
    <p class="duell-kleingedruckt">Tipp auf ein Duell, um dort weiterzumachen.</p>
    <div class="duell-liste">${zeilen}</div></section>`;
}

function beitretenFormularHtml(person, code) {
  return `<form data-beitreten>
      <label>Code des Duells<input name="code" value="${esc(code)}" maxlength="6" autocomplete="off" required></label>
      ${person
        ? `<p class="duell-als">Du spielst als <strong>${esc(person.name)}</strong>.</p>`
        : '<label>Dein Anzeigename<input name="name" minlength="2" maxlength="30" autocomplete="nickname" required></label>'}
      <button class="duell-haupt" type="submit">Duell beitreten</button></form>`;
}

function verdrahteBeitreten(person) {
  root.querySelector("[data-beitreten]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    versteckeFehler();
    const form = new FormData(event.currentTarget);
    const knopf = event.currentTarget.querySelector("button");
    knopf.disabled = true;
    try {
      const d = await api.beitreten(form.get("code"), person?.name || form.get("name"), person);
      speichernSitzung({ code: d.code, zugang: d.zugang });
      merkeLetztesDuell(d.code, d.zugang);
      await einstiegInLaufendesDuell();
    } catch (e) { knopf.disabled = false; fehler(e); }
  });
}

// Wer ueber einen geteilten Link kommt, will genau eines: beitreten.
// "Neues Duell" daneben hat in Runde 3 dazu gefuehrt, dass die
// Testperson sich selbst einen zweiten Raum gebaut hat, waehrend der
// Gegner im ersten wartete. Also hier nur der eine Weg - und ein
// ausgeschriebener Nebenweg fuer alle, die es doch anders wollen.
function einladungsAnsicht(code) {
  stoppeWarteUhr();
  const person = anmeldung?.lesen();
  setzeKopf({ untertitel: "Du wurdest zu einem Duell eingeladen." });
  root.innerHTML = `<div class="historie-kopf"><a class="sekundaer-button duell-zurueck" href="modus.html">← Modi</a></div>
    <section class="card duell-karte duell-karte-haupt">
      <span class="duell-symbol">✉️</span>
      <h2>Du bist eingeladen</h2>
      <p>Jemand hat ein Duell eröffnet und dir den Link geschickt. Trag deinen Namen ein – dann spielt ihr dieselben fünf Fragen.</p>
      ${beitretenFormularHtml(person, code)}
    </section>
    <p class="duell-anderer-weg">
      <button type="button" class="duell-textknopf" data-selbst>Ich möchte stattdessen selbst ein Duell eröffnen</button>
    </p>`;
  verdrahteBeitreten(person);
  root.querySelector("[data-selbst]").addEventListener("click", () => {
    history.replaceState({}, "", location.pathname);
    startAnsicht();
  });
}

async function startAnsicht() {
  stoppeWarteUhr();
  const eingeladen = leseCodeAusAdresse();
  if (eingeladen) return einladungsAnsicht(eingeladen);

  setzeKopf();
  const person = anmeldung?.lesen();
  root.innerHTML = `<div class="historie-kopf"><a class="sekundaer-button duell-zurueck" href="modus.html">← Modi</a></div>
    <div data-letzte-duelle></div>
    <section class="card duell-karte duell-karte-haupt">
      <span class="duell-symbol">⚔️</span>
      <h2>Neues Duell eröffnen</h2>
      <p>So läuft es ab:</p>
      <ol class="duell-ablauf">
        <li>Du eröffnest ein Duell und bist zunächst allein darin.</li>
        <li>Du schickst den Link weiter – zum Beispiel per WhatsApp.</li>
        <li>Sobald jemand beigetreten ist, startest du die Runde.</li>
      </ol>
      ${person
        ? '<button class="duell-haupt" data-erstellen>Duell eröffnen</button><p class="duell-kleingedruckt">Höchstens drei offene Duelle gleichzeitig.</p>'
        : '<button class="duell-haupt" data-login>Als Vereinsmitglied anmelden</button><p class="duell-kleingedruckt">Eröffnen können nur angemeldete Vereinsmitglieder. Beitreten geht auch ohne Anmeldung.</p>'}
    </section>
    <section class="card duell-karte duell-karte-zweit">
      <span class="duell-symbol">🔑</span>
      <h2>Einem Duell beitreten</h2>
      <p>Hat dir jemand einen Code oder einen Link geschickt? Dann kommst du hier hinein.</p>
      ${beitretenFormularHtml(person, "")}
    </section>`;

  root.querySelector("[data-login]")?.addEventListener("click", async () => {
    const e = await loginDialog?.oeffne({ grund: "Ein Duell eröffnen können nur angemeldete Vereinsmitglieder.", gastErlaubt: false });
    if (e?.status === "angemeldet") startAnsicht();
  });
  root.querySelector("[data-erstellen]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    versteckeFehler();
    try {
      const d = await api.erstellen(person);
      speichernSitzung({ code: d.code, zugang: d.zugang });
      merkeLetztesDuell(d.code, d.zugang);
      warteraumAnsicht(true);
    } catch (e) { event.currentTarget.disabled = false; fehler(e); }
  });
  verdrahteBeitreten(person);

  // Die eigenen Duelle standen bisher ganz unten und wurden in Runde 3
  // schlicht nie gesehen - auch nicht von jemandem, der selbst gerade
  // eines eroeffnet hatte. Sie stehen jetzt oben.
  const letzteHtml = await baueLetzteDuelleHtml(person).catch(() => "");
  const halter = root.querySelector("[data-letzte-duelle]");
  if (halter && letzteHtml) {
    halter.outerHTML = letzteHtml;
    root.querySelectorAll("[data-code]").forEach((knopf) => knopf.addEventListener("click", () => {
      speichernSitzung({ code: knopf.dataset.code, zugang: knopf.dataset.zugang });
      einstiegInLaufendesDuell();
    }));
  }
}

// ---------- Warteraum ----------
//
// Vorher hiess dieser Bildschirm nur "Session-Code" und zeigte Code,
// "Link kopieren" und "Jetzt spielen" - ohne jede Auskunft darueber, ob
// jemand da ist. Jetzt: ausgeschriebener Ablauf, eine Teilnehmerliste,
// die sich selbst nachlaedt, und ein Start, der nachfragt, solange man
// allein im Raum ist.
let warteUhr = null;
function stoppeWarteUhr() {
  if (warteUhr) { clearInterval(warteUhr); warteUhr = null; }
}

function warteraumAnsicht(neu = false) {
  stoppeWarteUhr();
  setzeKopf({ untertitel: "Warteraum – erst teilen, dann starten." });
  const url = `${location.origin}${location.pathname}?code=${sitzung.code}`;
  root.innerHTML = `<div class="historie-kopf">
      <button type="button" class="sekundaer-button duell-zurueck" data-zurueck>← Meine Duelle</button>
    </div>
    <section class="card duell-karte duell-warteraum">
      <span class="duell-symbol">${neu ? "🎯" : "⚔️"}</span>
      <h2>${neu ? "Dein Duell ist eröffnet" : "Warteraum"}</h2>
      <p class="duell-code-label">Code des Duells</p>
      <strong class="duell-code-wert">${esc(sitzung.code)}</strong>
      <ol class="duell-ablauf">
        <li>Schick den Link an die Person, gegen die du spielen willst.</li>
        <li>Warte, bis sie unten in der Liste auftaucht.</li>
        <li>Dann startest du die Runde.</li>
      </ol>
      <div class="duell-aktionen">
        <button type="button" data-teilen>Link teilen</button>
      </div>
      <div class="duell-warteliste">
        <h3>Bisher dabei</h3>
        <ul class="duell-namen" data-namen><li>Du</li></ul>
        <p class="duell-kleingedruckt" data-warte-hinweis aria-live="polite">Noch ist niemand beigetreten. Die Liste aktualisiert sich von selbst.</p>
      </div>
      <button class="duell-haupt" type="button" data-start>Duell starten</button>
    </section>`;

  const startKnopf = root.querySelector("[data-start]");
  let alleine = true;
  let startScharf = false;

  root.querySelector("[data-zurueck]").addEventListener("click", () => { stoppeWarteUhr(); startAnsicht(); });

  // Auf dem Handy ist das systemeigene Teilen der kuerzeste Weg nach
  // WhatsApp - genau der Weg, den die Testperson gesucht hat. Ohne
  // Unterstuetzung faellt es auf die Zwischenablage zurueck.
  root.querySelector("[data-teilen]").addEventListener("click", async (event) => {
    const knopf = event.currentTarget;
    const text = `Ich fordere dich zu einem Quiz-Duell heraus. Code ${sitzung.code}.`;
    try {
      if (navigator.share) { await navigator.share({ title: "Quiz-Duell", text, url }); return; }
      await navigator.clipboard?.writeText(url);
      knopf.textContent = "Link kopiert ✓";
    } catch { /* Abbrechen ist kein Fehler */ }
  });

  startKnopf.addEventListener("click", () => {
    if (alleine && !startScharf) {
      startScharf = true;
      startKnopf.textContent = "Noch ist niemand da – trotzdem starten?";
      return;
    }
    stoppeWarteUhr();
    laden();
  });

  async function aktualisiereWarteliste() {
    const liste = root.querySelector("[data-namen]");
    if (!liste) return stoppeWarteUhr();
    const stand = await api.stand(sitzung.zugang).catch(() => null);
    const teilnehmer = stand?.teilnehmer || [];
    if (!teilnehmer.length) return;
    liste.innerHTML = teilnehmer
      .map((t) => `<li>${esc(t.name)}${t.name === stand.ich ? " (du)" : ""}</li>`).join("");
    const andere = teilnehmer.filter((t) => t.name !== stand.ich).length;
    alleine = andere === 0;
    const hinweis = root.querySelector("[data-warte-hinweis]");
    if (hinweis) {
      hinweis.textContent = andere
        ? `${andere === 1 ? "Eine Person ist" : `${andere} Personen sind`} beigetreten. Du kannst starten.`
        : "Noch ist niemand beigetreten. Die Liste aktualisiert sich von selbst.";
    }
    if (!alleine && !startScharf) startKnopf.textContent = "Duell starten";
  }

  aktualisiereWarteliste();
  warteUhr = setInterval(aktualisiereWarteliste, 4000);
}

// ---------- Fortschritt + Frage-Karte ----------

function baueFortschrittHtml(f) {
  setzeKopf({ untertitel: "Wie im Wochenquiz – diesmal im direkten Vergleich.", position: f.position, gesamt: f.gesamt });
  return `<div class="historie-kopf duell-spiel-kopf"><button class="sekundaer-button" type="button" data-duell-uebersicht>Zwischenstand</button><button class="historie-neu-laden-button" type="button" data-duell-verlassen>Duell verlassen</button></div>`;
}

// Das alte "Neues Duell" warf mitten im Spiel ohne Rueckfrage alles weg -
// das war der beobachtete "springt ganz zurueck"-Fehler. Jetzt fragt der
// Knopf selbst nach; ein Browserdialog kommt hier nicht in Frage.
function verdrahteSpielKopf() {
  root.querySelector("[data-duell-uebersicht]")?.addEventListener("click", () => uebersichtAnsicht(true));
  const verlassen = root.querySelector("[data-duell-verlassen]");
  let scharf = false;
  verlassen?.addEventListener("click", () => {
    if (!scharf) { scharf = true; verlassen.textContent = "Wirklich verlassen? Nochmal tippen."; return; }
    neuesDuellStarten();
  });
}

function scoreboardHtml(stand) {
  const teilnehmer = stand?.teilnehmer || [];
  if (!teilnehmer.length) return "";
  return `<div class="historie-scoreboard duell-scoreboard"><div class="historie-scoreboard-kopf">
    <span class="historie-scoreboard-label">Zwischenstand</span><span class="historie-scoreboard-gesamt-hinweis">${esc(stand.code || sitzung.code)}</span></div>
    <div class="duell-scoreboard-spieler">${teilnehmer.map((t) => `<div class="duell-scoreboard-spielerfeld">
      <strong>${esc(t.name)}${t.name === stand.ich ? " (du)" : ""}</strong><span><b>${t.richtig}</b> richtig · ${t.beantwortet}/5 gespielt</span></div>`).join("")}</div></div>`;
}

// "ausgewaehlt": eigene Auswahl (zum Wiedererkennen nach dem Absenden).
// "aufgeloest": {richtig:[...]} - macht die Karte "gesperrt" und
// markiert ist-richtig/ist-falsch wie im Wochenquiz.
function baueOptionenHtml(f, ausgewaehlt, aufgeloest) {
  const mehrfach = f.antworttyp === "mehrfachauswahl";
  return (f.antwortoptionen || []).filter((o) => o?.text).map((o) => {
    const gewaehlt = Boolean(ausgewaehlt?.includes(o.schluessel));
    let klasse = "option duell-option";
    let marke = "";
    if (aufgeloest) {
      klasse += " gesperrt";
      if (aufgeloest.richtig?.includes(o.schluessel)) { klasse += " ist-richtig"; marke = '<span class="duell-marke">✓</span>'; }
      else if (gewaehlt) { klasse += " ist-falsch"; marke = '<span class="duell-marke">✕</span>'; }
    } else if (gewaehlt) klasse += " ausgewaehlt";
    return `<label class="${klasse}"><input type="${mehrfach ? "checkbox" : "radio"}" name="auswahl" value="${esc(o.schluessel)}" ${gewaehlt ? "checked" : ""} ${aufgeloest ? "disabled" : ""}><span>${esc(o.text)}</span>${marke}</label>`;
  }).join("");
}

function verdrahteZeichenZaehler(feldWaehler, zaehlerWaehler) {
  if (!zaehlwerkModul) return;
  const feld = root.querySelector(feldWaehler);
  const anzeige = root.querySelector(zaehlerWaehler);
  if (feld && anzeige) zaehlwerkModul.haengeZeichenZaehlerAn(feld, anzeige, { grenze: FREITEXT_ZEICHENLIMIT });
}

async function stelleEntscheidungsControllerBereit() {
  if (entscheidung) return entscheidung;
  entscheidung = await erstelleDuellEntscheidungsController({
    getSitzung: () => sitzung, api, fehler, versteckeFehler,
    nachEntscheidung: (f, _daten, karte) => {
      karte.classList.add("frage-karte-historie");
      const anschluss = document.createElement("div");
      anschluss.dataset.anschluss = "";
      karte.appendChild(anschluss);
      naechsteSchritte(f);
    },
  });
  return entscheidung;
}

async function frageAnsicht(f, stand = null) {
  frage = f;
  const kopfHtml = baueFortschrittHtml(f) + scoreboardHtml(stand);
  if (f.antworttyp === "entscheidung") {
    const controller = await stelleEntscheidungsControllerBereit();
    root.innerHTML = kopfHtml;
    const karte = controller.baueFrageElement(f);
    karte.classList.add("frage-karte-historie");
    root.appendChild(karte);
    verdrahteSpielKopf();
    return;
  }
  const inhalt = f.antworttyp === "freitext"
    ? `<label class="duell-freitext-label">Deine Antwort<textarea name="freitext" rows="3" placeholder="Deine Antwort ..."></textarea></label><p class="duell-zaehler" data-zaehler hidden></p>`
    : f.antworttyp === "zahl" ? zahlEingabeHtml(f)
    : `<div class="duell-optionen">${baueOptionenHtml(f)}</div>`;
  root.innerHTML = `${kopfHtml}
    <section class="frage-karte frage-karte-historie duell-frage-karte" id="duellKarte">${mediumHtml(f)}<div class="frage-text">${esc(f.frage_text)}</div>
      <form data-antwort>${inhalt}<button class="absenden-button" type="submit">Antwort abgeben</button></form></section>`;
  verdrahteSpielKopf();
  verdrahteMedium(root, f);
  if (f.antworttyp === "freitext") verdrahteZeichenZaehler('[name="freitext"]', "[data-zaehler]");
  root.querySelector("[data-antwort]").addEventListener("submit", antwortenAbgeben);
}

async function antwortenAbgeben(event) {
  event.preventDefault();
  versteckeFehler();
  const form = event.currentTarget;
  const knopf = form.querySelector("button");
  knopf.disabled = true;
  try {
    if (frage.antworttyp === "freitext") {
      const text = form.querySelector('[name="freitext"]').value.trim();
      if (!text) throw new Error("Bitte erst eine Antwort eingeben.");
      if (text.length > FREITEXT_ZEICHENLIMIT) throw new Error(`Deine Antwort ist ${text.length - FREITEXT_ZEICHENLIMIT} Zeichen zu lang. Bitte kürze sie.`);
      const ergebnis = await api.freitext(sitzung.zugang, frage.id, text);
      zeigeFreitextErgebnis(frage, text, ergebnis);
    } else if (frage.antworttyp === "zahl") {
      const rohwert = form.querySelector('[name="zahl"]').value.trim();
      const wert = Number(rohwert.replace(",", "."));
      const feste = frage.zahl_einheiten?.length === 1 ? frage.zahl_einheiten[0].einheit : null;
      const einheit = feste || form.querySelector('[name="einheit"]')?.value || "";
      if (!rohwert || !Number.isFinite(wert) || !einheit) throw new Error("Bitte gib eine gültige Zahl und Einheit ein.");
      const ergebnis = await api.zahl(sitzung.zugang, frage.id, wert, einheit);
      zeigeZahlErgebnis(frage, wert, einheit, ergebnis);
    } else {
      const auswahl = [...form.querySelectorAll('[name="auswahl"]:checked')].map((x) => x.value);
      if (!auswahl.length) throw new Error("Bitte wähle erst eine Antwort aus.");
      const ergebnis = await api.antworten(sitzung.zugang, frage.id, auswahl);
      zeigeAuswahlErgebnis(frage, auswahl, ergebnis);
    }
  } catch (e) { knopf.disabled = false; fehler(e); }
}

function zeigeZahlErgebnis(f, wert, einheit, ergebnis) {
  const richtig = ergebnis.korrekt === true;
  const loesung = (ergebnis.richtige_antworten || []).map((x) => `${formatZahl(x.wert)} ${x.einheit}`).join(" oder ");
  root.innerHTML = `${baueFortschrittHtml(f)}<section class="frage-karte frage-karte-historie beantwortet ${richtig ? "richtig-karte" : "falsch-karte"}" id="duellKarte">
    ${mediumHtml(f)}<div class="frage-text">${esc(f.frage_text)}</div><div class="zahl-aufloesung"><p>Deine Antwort: ${esc(formatZahl(wert))} ${esc(einheit)}</p>
    <p>Richtig: ${esc(loesung)}</p></div><div class="feedback ${richtig ? "richtig" : "falsch"}">${richtig ? "Richtig!" : "Leider nicht richtig."}</div><div data-anschluss></div></section>`;
  verdrahteSpielKopf();
  verdrahteMedium(root, f);
  naechsteSchritte(f);
}

function zeigeAuswahlErgebnis(f, auswahl, ergebnis) {
  const richtig = ergebnis.korrekt === true;
  const optionenHtml = baueOptionenHtml(f, auswahl, { richtig: ergebnis.richtige_auswahl || [] });
  root.innerHTML = `${baueFortschrittHtml(f)}
    <section class="frage-karte frage-karte-historie duell-frage-karte beantwortet ${richtig ? "richtig-karte" : "falsch-karte"}" id="duellKarte">
      ${mediumHtml(f)}<div class="frage-text">${esc(f.frage_text)}</div>
      <div class="duell-optionen">${optionenHtml}</div>
      <div class="feedback ${richtig ? "richtig" : "falsch"}"><span class="duell-feedback-symbol">${richtig ? "✓" : "✕"}</span>${richtig ? "Richtig!" : "Leider nicht richtig."}</div>
      <div data-anschluss></div></section>`;
  verdrahteSpielKopf();
  verdrahteMedium(root, f);
  naechsteSchritte(f);
}

function baueErgaenzungHtml(nachfrage) {
  return `<div class="duell-ergaenzung" data-ergaenzung>
    <p class="duell-nachfrage">${esc(nachfrage || "Begründe bitte noch kurz, warum du so entscheidest.")}</p>
    <p class="duell-ergaenzung-hinweis">Du hast genau eine Ergänzung. Schickst du sie nicht ab, bleibt die Frage als falsch stehen.</p>
    <form data-ergaenzen><label class="duell-freitext-label">Deine Ergänzung<textarea name="ergaenzung" rows="3" placeholder="Deine Ergänzung ..."></textarea></label>
      <p class="duell-zaehler" data-zaehler hidden></p><button class="duell-haupt" type="submit">Antwort ergänzen</button></form></div>`;
}

function zeigeFreitextErgebnis(f, ersterText, ergebnis, zweiterText = null) {
  const status = ergebnis.status || (ergebnis.korrekt ? "richtig" : "falsch");
  const wartet = status === "nachbessern";
  const klasse = wartet ? "teilweise-karte" : status === "richtig" ? "richtig-karte" : "falsch-karte";
  const feedbackKlasse = wartet ? "teilweise" : status === "richtig" ? "richtig" : "falsch";
  const feedbackSymbol = wartet ? "🟠" : status === "richtig" ? "✓" : "✕";
  const feedbackText = wartet ? "Fast! Da fehlt noch ein Punkt." : status === "richtig" ? "Richtig!" : "Leider nicht richtig.";
  root.innerHTML = `${baueFortschrittHtml(f)}
    <section class="frage-karte frage-karte-historie duell-frage-karte beantwortet ${klasse}" id="duellKarte">
      ${mediumHtml(f)}<div class="frage-text">${esc(f.frage_text)}</div>
      <p class="duell-eigene-antwort">Deine Antwort: ${esc(ersterText)}</p>
      ${zweiterText ? `<p class="duell-eigene-antwort">Deine Ergänzung: ${esc(zweiterText)}</p>` : ""}
      <div class="feedback duell-feedback ${feedbackKlasse}"><span class="duell-feedback-symbol">${feedbackSymbol}</span>${feedbackText}</div>
      ${!wartet && ergebnis.musterantwort ? `<div class="duell-loesung"><b>Richtige Antwort</b><p>${esc(ergebnis.musterantwort)}</p></div>` : ""}
      ${wartet ? baueErgaenzungHtml(ergebnis.nachfrage) : ""}
      <div data-anschluss></div></section>`;
  verdrahteSpielKopf();
  verdrahteMedium(root, f);
  if (wartet) {
    verdrahteZeichenZaehler('[name="ergaenzung"]', "[data-zaehler]");
    root.querySelector("[data-ergaenzen]").addEventListener("submit", (event) => ergaenzungAbschicken(event, f, ersterText));
  } else {
    naechsteSchritte(f);
  }
}

async function ergaenzungAbschicken(event, f, ersterText) {
  event.preventDefault();
  versteckeFehler();
  const form = event.currentTarget;
  const knopf = form.querySelector("button");
  knopf.disabled = true;
  const zweiterText = form.querySelector('[name="ergaenzung"]').value.trim();
  if (!zweiterText) { knopf.disabled = false; fehler(new Error("Bitte erst eine Ergänzung eingeben.")); return; }
  if (zweiterText.length > FREITEXT_ZEICHENLIMIT) { knopf.disabled = false; fehler(new Error(`Deine Ergänzung ist ${zweiterText.length - FREITEXT_ZEICHENLIMIT} Zeichen zu lang.`)); return; }
  try {
    const ergebnis = await api.freitextErgaenzung(sitzung.zugang, f.id, zweiterText);
    zeigeFreitextErgebnis(f, ersterText, ergebnis, zweiterText);
  } catch (e) { knopf.disabled = false; fehler(e); }
}

// ---------- Anschluss: Vergleich + Reaktionen + Weiter (Teile B/F) ----------

async function naechsteSchritte(f) {
  const anschluss = root.querySelector("[data-anschluss]");
  const karte = root.querySelector("#duellKarte");
  if (!anschluss) return;
  anschluss.innerHTML = `<p class="duell-lade-hinweis">Vergleich wird geladen …</p>`;

  const weiterKnopf = () => {
    const weiter = document.createElement("button");
    weiter.type = "button";
    weiter.className = "historie-weiter-button";
    weiter.textContent = "Nächste Frage";
    weiter.addEventListener("click", laden);
    return weiter;
  };

  let verlauf = null, reaktionen = [];
  try {
    [verlauf, reaktionen] = await Promise.all([api.verlauf(sitzung.zugang), api.reaktionen(sitzung.zugang, f.id).catch(() => [])]);
  } catch { /* Vergleich ist ein Zusatz - ohne ihn geht es trotzdem weiter */ }

  anschluss.innerHTML = "";
  const eintrag = verlauf?.fragen?.find((x) => x.position === f.position) || null;
  let vergleichsBlock = null;
  if (eintrag) {
    vergleichsBlock = baueVergleichsBlock(eintrag);
    anschluss.appendChild(vergleichsBlock);
  }

  // Reaktionen (Teil F, Gimmick): eigene Knoepfe zum Reagieren + eine
  // dauerhafte Pille neben jedem Namen, sobald diese Person reagiert hat.
  anschluss.appendChild(baueReaktionsleiste(async (emoji) => {
    try {
      const neu = await api.reagieren(sitzung.zugang, f.id, emoji);
      setzePillen(vergleichsBlock, neu);
    } catch (e) { fehler(e); }
  }));
  setzePillen(vergleichsBlock, reaktionen);
  anschluss.appendChild(weiterKnopf());

  // Kurze Einblendung, falls die ANDERE Person zu dieser Frage schon
  // reagiert hat, bevor man selbst geantwortet hat.
  const fremdeReaktion = findeLetzteFremdeReaktion(reaktionen);
  if (fremdeReaktion && karte) zeigeKurzeEinblendung(karte, fremdeReaktion);
}

function setzePillen(vergleichsBlock, reaktionenListe) {
  if (!vergleichsBlock || !Array.isArray(reaktionenListe)) return;
  for (const reaktion of reaktionenListe) {
    const zeile = findeTeilnehmerZeile(vergleichsBlock, reaktion.name);
    if (!zeile || zeile.querySelector(".duell-reaktion-pille")) continue;
    (zeile.querySelector(".duell-vergleich-kopf") || zeile).appendChild(bauePille(reaktion));
  }
}

// ---------- Auswertungsscreen (Teil D) + Ablauf ----------

async function uebersichtAnsicht(weiterspielenErlaubt) {
  setzeKopf({ untertitel: "Runde für Runde: eure Antworten im direkten Vergleich." });
  root.innerHTML = `<p class="duell-lade-hinweis">Auswertung wird geladen …</p>`;
  try {
    const verlauf = await api.verlauf(sitzung.zugang);
    root.innerHTML = "";
    root.appendChild(baueUebersicht(verlauf, {
      weiterspielenErlaubt,
      aufWeiterspielen: laden,
      aufNeuesDuell: neuesDuellStarten,
      aufDuellListe: startAnsicht,
    }));
    // Wurde eine Frage mit einer offenen Ergaenzung "ueberholt" (der
    // Spielfortschritt ist schon weiter, aber der zweite Freitext-Versuch
    // steht noch aus), gibt es hier - und nur hier - noch einen Weg
    // dorthin zurueck. Ohne diesen Umweg waere die Ergaenzung sonst nie
    // mehr erreichbar, sobald "duell_frage" zur naechsten Frage
    // weitergezogen ist.
    for (const f of verlauf.fragen || []) {
      const eigene = f.teilnehmer.find((t) => t.ist_ich);
      if (eigene?.status !== "nachbessern") continue;
      const block = root.querySelector(`[data-frage-id="${f.frage_id}"]`);
      if (!block) continue;
      block.insertAdjacentHTML("beforeend", baueErgaenzungHtml(null));
      const formular = block.querySelector("[data-ergaenzen]");
      const zaehler = formular.querySelector("[data-zaehler]");
      const feld = formular.querySelector('[name="ergaenzung"]');
      if (zaehlwerkModul && feld && zaehler) zaehlwerkModul.haengeZeichenZaehlerAn(feld, zaehler, { grenze: FREITEXT_ZEICHENLIMIT });
      formular.addEventListener("submit", async (event) => {
        event.preventDefault();
        versteckeFehler();
        const knopf = formular.querySelector("button");
        knopf.disabled = true;
        const zweiterText = feld.value.trim();
        if (!zweiterText) { knopf.disabled = false; fehler(new Error("Bitte erst eine Ergänzung eingeben.")); return; }
        try {
          await api.freitextErgaenzung(sitzung.zugang, f.frage_id, zweiterText);
          await uebersichtAnsicht(weiterspielenErlaubt);
        } catch (e) { knopf.disabled = false; fehler(e); }
      });
    }
  } catch (e) { speichernSitzung(null); startAnsicht(); fehler(e); }
}

async function einstiegInLaufendesDuell() {
  root.innerHTML = `<p class="duell-lade-hinweis">Duell wird geladen …</p>`;
  try {
    const f = await api.frage(sitzung.zugang);
    // Erste Frage noch offen: direkt reinspielen, es gibt ja noch nichts
    // zu vergleichen. Sonst (mind. eine Frage beantwortet, oder ganz
    // fertig) automatisch die Auswertung (Teil D) - "Weiterspielen" steht
    // dort als eigener Knopf, wenn noch nicht fertig.
    if (f && !f.fertig && f.position === 1) {
      const stand = await api.stand(sitzung.zugang).catch(() => null);
      await frageAnsicht(f, stand);
    }
    else await uebersichtAnsicht(!f?.fertig);
  } catch (e) { speichernSitzung(null); startAnsicht(); fehler(e); }
}

async function laden() {
  root.innerHTML = `<p class="duell-lade-hinweis">Duell wird geladen …</p>`;
  try {
    const [f, stand] = await Promise.all([api.frage(sitzung.zugang), api.stand(sitzung.zugang).catch(() => null)]);
    if (f?.fertig) await uebersichtAnsicht(false);
    else await frageAnsicht(f, stand);
  } catch (e) { speichernSitzung(null); startAnsicht(); fehler(e); }
}

// Ein gespeicherter Zugang ist nur ein Komfort fuer die Liste. Er darf
// beim Seitenaufruf nie ungefragt ein altes Duell oeffnen - sonst landet
// man nach einer Auswertung in einer Navigationsschleife und kann kein
// neues Duell beginnen.
sitzung = lesenSitzung();
if (sitzung?.zugang) merkeLetztesDuell(sitzung.code, sitzung.zugang);
startAnsicht();
