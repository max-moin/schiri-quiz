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

const root = document.getElementById("duellBereich");
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
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

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function speichernSitzung(wert) {
  sitzung = wert;
  try { sessionStorage.setItem(SPEICHER_SITZUNG, JSON.stringify(wert)); } catch { /* privater Modus */ }
}
function lesenSitzung() {
  try { return JSON.parse(sessionStorage.getItem(SPEICHER_SITZUNG)); } catch { return null; }
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

function relativeZeit(zeitstempel) {
  const minuten = Math.round((Date.now() - zeitstempel) / 60000);
  if (minuten < 60) return "gerade eben";
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  return `vor ${Math.round(stunden / 24)} Tagen`;
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
      <span class="duell-liste-info">${d.ich_richtig}/${d.ich_beantwortet} richtig · ${d.status === "offen" ? "läuft" : "beendet"}</span></button>`).join("");
    return `<div class="duell-letzte-duelle"><h2>Deine letzten Duelle</h2><div class="duell-liste">${zeilen}</div></div>`;
  }
  const lokal = leseLetzteDuelle();
  if (!lokal.length) return "";
  const zeilen = lokal.map((d) => `<button type="button" class="duell-liste-eintrag" data-code="${esc(d.code)}" data-zugang="${esc(d.zugang)}">
    <span class="duell-liste-code">${esc(d.code)}</span>
    <span class="duell-liste-info">${esc(relativeZeit(d.zuletztGesehenAm))}</span></button>`).join("");
  return `<div class="duell-letzte-duelle"><h2>Zuletzt gespielt</h2><div class="duell-liste">${zeilen}</div></div>`;
}

async function startAnsicht() {
  const person = anmeldung?.lesen();
  const code = new URLSearchParams(location.search).get("code")?.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 6) || "";
  root.innerHTML = `<a class="duell-zurueck" href="modus.html">← Modi</a><h1>Quiz-Duell</h1>
    <p class="duell-einstieg">Fünf frühere Wochenfragen – ohne Einfluss auf euren normalen Quizstand.</p>
    <div class="duell-start">
      <section class="duell-karte"><span class="duell-symbol">⚔️</span><h2>Neues Duell</h2><p>Du erhältst einen Code zum Teilen. Maximal drei offene Duelle.</p>
        ${person ? '<button class="duell-haupt" data-erstellen>Code erstellen</button>' : '<button class="duell-haupt" data-login>Als Vereinsmitglied anmelden</button>'}</section>
      <section class="duell-karte"><span class="duell-symbol">🔑</span><h2>Beitreten</h2><form data-beitreten>
        <label>Session-Code<input name="code" value="${esc(code)}" maxlength="6" autocomplete="off" required></label>
        ${person ? `<p>Du spielst als <strong>${esc(person.name)}</strong>.</p>` : '<label>Dein Anzeigename<input name="name" minlength="2" maxlength="30" autocomplete="nickname" required></label>'}
        <button class="duell-haupt" type="submit">Duell öffnen</button></form></section>
    </div>
    <div data-letzte-duelle></div>`;

  root.querySelector("[data-login]")?.addEventListener("click", async () => {
    const e = await loginDialog?.oeffne({ grund: "Nur angemeldete Vereinsmitglieder können einen Code erstellen.", gastErlaubt: false });
    if (e?.status === "angemeldet") startAnsicht();
  });
  root.querySelector("[data-erstellen]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try {
      const d = await api.erstellen(person);
      speichernSitzung({ code: d.code, zugang: d.zugang });
      merkeLetztesDuell(d.code, d.zugang);
      codeAnsicht(true);
    } catch (e) { event.currentTarget.disabled = false; fehler(e); }
  });
  root.querySelector("[data-beitreten]").addEventListener("submit", async (event) => {
    event.preventDefault();
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

function codeAnsicht(neu = false) {
  const url = `${location.origin}${location.pathname}?code=${sitzung.code}`;
  root.innerHTML = `<section class="duell-code duell-karte"><span class="duell-symbol">${neu ? "🎯" : "⚔️"}</span><p>Session-Code</p><strong>${esc(sitzung.code)}</strong>
    <p>Teile den Code oder den Link. Jede Person braucht nur einen Anzeigenamen.</p>
    <div class="duell-aktionen"><button data-kopieren>Link kopieren</button><button class="duell-haupt" data-start>Jetzt spielen</button></div></section>`;
  root.querySelector("[data-kopieren]").addEventListener("click", async (e) => { await navigator.clipboard?.writeText(url); e.currentTarget.textContent = "Kopiert ✓"; });
  root.querySelector("[data-start]").addEventListener("click", laden);
}

// ---------- Fortschritt + Frage-Karte ----------

function baueFortschrittHtml(f) {
  const prozent = Math.round(((f.position - 1) / f.gesamt) * 100);
  return `<div class="duell-fortschritt"><div class="duell-fortschritt-zeile"><span>Frage ${f.position} von ${f.gesamt}</span><span>Duell ${esc(sitzung.code)}</span></div>
    <div class="duell-fortschritt-track" role="progressbar" aria-label="Fortschritt im Duell" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prozent}">
      <div class="duell-fortschritt-fill" style="width:${prozent}%"></div></div></div>`;
}

function mediumHtml(f) {
  if (f.medium === "bild" && f.bild_base64) return `<img class="duell-medium" src="data:${esc(f.bild_mime || "image/jpeg")};base64,${f.bild_base64}" alt="${esc(f.bild_alt || "Spielsituation")}">`;
  if (f.medium === "video" && f.video_url) return `<a class="duell-video" href="${esc(f.video_url)}" target="_blank" rel="noopener noreferrer">▶ Videoausschnitt öffnen</a>`;
  return "";
}

// "ausgewaehlt": eigene Auswahl (zum Wiedererkennen nach dem Absenden).
// "aufgeloest": {richtig:[...]} - macht die Karte "gesperrt" und
// markiert ist-richtig/ist-falsch wie im Wochenquiz.
function baueOptionenHtml(f, ausgewaehlt, aufgeloest) {
  const mehrfach = f.antworttyp === "mehrfachauswahl";
  return (f.antwortoptionen || []).filter((o) => o?.text).map((o) => {
    const gewaehlt = Boolean(ausgewaehlt?.includes(o.schluessel));
    let klasse = "duell-option";
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

function frageAnsicht(f) {
  frage = f;
  const inhalt = f.antworttyp === "freitext"
    ? `<label class="duell-freitext-label">Deine Antwort<textarea name="freitext" rows="3" placeholder="Deine Antwort ..."></textarea></label><p class="duell-zaehler" data-zaehler hidden></p>`
    : `<div class="duell-optionen">${baueOptionenHtml(f)}</div>`;
  root.innerHTML = `${baueFortschrittHtml(f)}
    <section class="duell-karte duell-frage-karte" id="duellKarte">${mediumHtml(f)}<h1 class="duell-frage-text">${esc(f.frage_text)}</h1>
      <form data-antwort>${inhalt}<button class="duell-haupt" type="submit">Antwort abgeben</button></form></section>`;
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
    } else {
      const auswahl = [...form.querySelectorAll('[name="auswahl"]:checked')].map((x) => x.value);
      if (!auswahl.length) throw new Error("Bitte wähle erst eine Antwort aus.");
      const ergebnis = await api.antworten(sitzung.zugang, frage.id, auswahl);
      zeigeAuswahlErgebnis(frage, auswahl, ergebnis);
    }
  } catch (e) { knopf.disabled = false; fehler(e); }
}

function zeigeAuswahlErgebnis(f, auswahl, ergebnis) {
  const richtig = ergebnis.korrekt === true;
  const optionenHtml = baueOptionenHtml(f, auswahl, { richtig: ergebnis.richtige_auswahl || [] });
  root.innerHTML = `${baueFortschrittHtml(f)}
    <section class="duell-karte duell-frage-karte beantwortet ${richtig ? "richtig-karte" : "falsch-karte"}" id="duellKarte">
      ${mediumHtml(f)}<h1 class="duell-frage-text">${esc(f.frage_text)}</h1>
      <div class="duell-optionen">${optionenHtml}</div>
      <div class="duell-feedback ${richtig ? "richtig" : "falsch"}"><span class="duell-feedback-symbol">${richtig ? "✓" : "✕"}</span>${richtig ? "Richtig!" : "Leider nicht richtig."}</div>
      <div data-anschluss></div></section>`;
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
    <section class="duell-karte duell-frage-karte beantwortet ${klasse}" id="duellKarte">
      ${mediumHtml(f)}<h1 class="duell-frage-text">${esc(f.frage_text)}</h1>
      <p class="duell-eigene-antwort">Deine Antwort: ${esc(ersterText)}</p>
      ${zweiterText ? `<p class="duell-eigene-antwort">Deine Ergänzung: ${esc(zweiterText)}</p>` : ""}
      <div class="duell-feedback ${feedbackKlasse}"><span class="duell-feedback-symbol">${feedbackSymbol}</span>${feedbackText}</div>
      ${!wartet && ergebnis.musterantwort ? `<div class="duell-loesung"><b>Richtige Antwort</b><p>${esc(ergebnis.musterantwort)}</p></div>` : ""}
      ${wartet ? baueErgaenzungHtml(ergebnis.nachfrage) : ""}
      <div data-anschluss></div></section>`;
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
    weiter.className = "duell-haupt";
    weiter.textContent = "Weiter";
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
  root.innerHTML = `<p class="duell-lade-hinweis">Auswertung wird geladen …</p>`;
  try {
    const verlauf = await api.verlauf(sitzung.zugang);
    root.innerHTML = "";
    root.appendChild(baueUebersicht(verlauf, { weiterspielenErlaubt, aufWeiterspielen: laden }));
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
    if (f && !f.fertig && f.position === 1) frageAnsicht(f);
    else await uebersichtAnsicht(!f?.fertig);
  } catch (e) { speichernSitzung(null); startAnsicht(); fehler(e); }
}

async function laden() {
  root.innerHTML = `<p class="duell-lade-hinweis">Duell wird geladen …</p>`;
  try {
    const f = await api.frage(sitzung.zugang);
    if (f?.fertig) await uebersichtAnsicht(false);
    else frageAnsicht(f);
  } catch (e) { speichernSitzung(null); startAnsicht(); fehler(e); }
}

sitzung = lesenSitzung();
if (sitzung?.zugang) { merkeLetztesDuell(sitzung.code, sitzung.zugang); einstiegInLaufendesDuell(); }
else startAnsicht();
