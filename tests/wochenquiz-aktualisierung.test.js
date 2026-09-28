import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/features/weekly-quiz.js", import.meta.url), "utf8");
const frage = (id, antworttyp = "multiple_choice") => ({ id, antworttyp, typ: antworttyp, frage_text: id });

class Element {
  constructor() {
    this.hidden = false;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.events = {};
    this.parentElement = { setAttribute() {} };
  }
  addEventListener(name, callback) { this.events[name] = callback; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll() { return []; }
  setAttribute() {}
  scrollIntoView() { this.gescrollt = true; }
}

function aufbau() {
  const elemente = new Map();
  const docEvents = {};
  const windowEvents = {};
  const meldungen = [];
  const aufrufe = [];
  const stand = { fragen: [frage("f1"), frage("f2")], antworten: [], zugang: { schiedsrichterId: "s1", pin: "1234" } };
  const document = {
    visibilityState: "visible",
    getElementById(id) {
      if (!elemente.has(id)) elemente.set(id, new Element());
      return elemente.get(id);
    },
    addEventListener(name, callback) { docEvents[name] = callback; },
    createElement() { return new Element(); },
  };
  const context = {
    document, console, clearInterval() {}, setInterval: () => 1,
    addEventListener(name, callback) { windowEvents[name] = callback; },
  };
  vm.runInNewContext(source, context);
  const baue = (q) => Object.assign(new Element(), { dataset: { frageId: q.id } });
  const quiz = context.SchiriQuizWeeklyQuiz.erstelleWochenQuiz({
    sb: {
      rpc(name, args) {
        const aufruf = { name, args, select: null };
        aufrufe.push(aufruf);
        const resultat = name === "wochen_fragen_v2"
          ? { data: stand.fragen.map((q) => ({ ...q })), error: stand.fehler || null }
          : { data: name === "meine_antworten_v2" ? stand.antworten : [], error: null };
        const promise = stand.rpcOverride?.(name, args) || Promise.resolve(resultat);
        promise.select = (columns) => { aufruf.select = columns; return promise; };
        return promise;
      },
    },
    getZugang: () => ({ ...stand.zugang }),
    zeigeFehler: (text) => meldungen.push(text),
    versteckeFehler() {}, frageAnsicht: {},
    freitext: { baueFreitextFrageElement: baue, baueBeantworteteFreitextElement: baue },
    entscheidung: { bereiteVor: async () => {}, baueFrageElement: baue, baueBeantworteteFrageElement: baue },
    flexibel: { baueFrageElement: baue, baueBeantworteteFrageElement: baue },
    baueVideoEinbettungModal() {}, baueVorlesenButton() {}, baueWarumButton() {}, beiQuizFertig() {},
  });
  return { quiz, stand, document, docEvents, windowEvents, meldungen, aufrufe,
    el: (id) => document.getElementById(id),
    ids: () => elemente.get("fragen-liste").children.map((e) => e.dataset.frageId),
  };
}

const abgearbeitet = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };

test("Neuladen ersetzt Wochenfragen statt sie doppelt anzuhaengen", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  await f.quiz.ladeFragenUndAntworten();
  assert.deepEqual(f.ids(), ["f1", "f2"]);
});

test("eine alte MC-/Icon-Karte wird vor dem Absenden abgefangen und die aktuelle Woche geladen", async () => {
  for (const typ of ["multiple_choice", "entscheidung", "mehrfachauswahl", "zahl", "freitext"]) {
    const f = aufbau();
    f.stand.fragen = [frage("alt", typ)];
    await f.quiz.ladeFragenUndAntworten();
    f.stand.fragen = [frage("neu", typ)];
    await assert.rejects(f.quiz.pruefeFrageAktuell("alt"), /aktuellen Fragen wurden neu geladen/);
    assert.deepEqual(f.ids(), ["neu"]);
    assert.match(f.meldungen.at(-1), /aktualisiert/);
    await f.quiz.pruefeFrageAktuell("neu");
    assert.ok(f.aufrufe.some((a) => a.select === "id,typ,antworttyp"), "nur kleine Statusfelder nachladen");
  }
});

test("unveraenderte Fragen behalten eingegebene Antworten beim Zurueckkehren", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  const karte = f.el("fragen-liste").children[0];
  karte.entwurf = "Noch nicht abgeschickt";
  f.docEvents.visibilitychange();
  await abgearbeitet();
  assert.equal(f.el("fragen-liste").children[0], karte);
  assert.equal(karte.entwurf, "Noch nicht abgeschickt");
  assert.equal(f.meldungen.length, 0);
});

test("Safari-BFCACHE und Wiederaufnahme aktualisieren eine geaenderte Woche", async () => {
  for (const ereignis of ["visibilitychange", "pageshow"]) {
    const f = aufbau();
    await f.quiz.ladeFragenUndAntworten();
    f.stand.fragen = [frage("neue-woche")];
    if (ereignis === "pageshow") f.windowEvents.pageshow({ persisted: true });
    else f.docEvents.visibilitychange();
    await abgearbeitet();
    assert.deepEqual(f.ids(), ["neue-woche"]);
  }
});

test("kein Quizstand-Refresh im Gast-/Ueben-Modus oder im verborgenen Browser", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  const vorher = f.aufrufe.length;
  f.document.visibilityState = "hidden";
  f.docEvents.visibilitychange();
  f.document.visibilityState = "visible";
  f.el("fragen-schritt").hidden = true;
  f.docEvents.visibilitychange();
  await abgearbeitet();
  assert.equal(f.aufrufe.length, vorher);
});

test("ohne aktive Woche verschwinden alte Fragen und alte Fertig-/Ueben-Anzeigen", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  f.el("fertig-hinweis").hidden = false;
  f.el("historie-start-button").hidden = false;
  f.stand.fragen = [];
  await assert.rejects(f.quiz.pruefeFrageAktuell("f1"));
  assert.deepEqual(f.ids(), []);
  assert.equal(f.el("keine-fragen-hinweis").hidden, false);
  assert.equal(f.el("fertig-hinweis").hidden, true);
  assert.equal(f.el("historie-start-button").hidden, true);
});

test("Antworttypenwechsel bei gleicher Frage-ID wird ebenfalls abgefangen", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  f.stand.fragen = [frage("f1", "entscheidung"), frage("f2")];
  await assert.rejects(f.quiz.pruefeFrageAktuell("f1"));
  await f.quiz.pruefeFrageAktuell("f1");
});

test("Netzfehler loeschen keine Eingaben und erlauben einen neuen Versuch", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  const karte = f.el("fragen-liste").children[0];
  f.stand.fehler = { message: "Failed to fetch" };
  await assert.rejects(f.quiz.pruefeFrageAktuell("f1"), /Verbindung/);
  assert.equal(f.el("fragen-liste").children[0], karte);
  f.stand.fehler = null;
  await f.quiz.pruefeFrageAktuell("f1");
});

test("spaet gelieferte Fragen eines vorherigen Kontos ersetzen nicht das neue Konto", async () => {
  const f = aufbau();
  let fertig;
  f.stand.rpcOverride = (name) => name === "wochen_fragen_v2"
    ? new Promise((resolve) => { fertig = resolve; }) : null;
  const altLaden = f.quiz.ladeFragenUndAntworten();
  f.stand.rpcOverride = null;
  f.stand.zugang = { schiedsrichterId: "s2", pin: "5678" };
  f.stand.fragen = [frage("neuer-verein")];
  await f.quiz.ladeFragenUndAntworten();
  fertig({ data: [frage("alter-verein")], error: null });
  await altLaden;
  assert.deepEqual(f.ids(), ["neuer-verein"]);
});

test("doppelte Antwortbestaetigungen zaehlen den Fortschritt nicht doppelt", async () => {
  const f = aufbau();
  await f.quiz.ladeFragenUndAntworten();
  f.quiz.registriereBeantwortung("f1");
  f.quiz.registriereBeantwortung("f1");
  f.quiz.registriereBeantwortung("nicht-in-dieser-woche");
  assert.equal(f.el("fortschritt-text").textContent, "1 von 2 beantwortet");
});

test("ohne geladenes Quiz wird keine Antwort mit fehlenden Zugangsdaten geschickt", async () => {
  const f = aufbau();
  await assert.rejects(f.quiz.pruefeFrageAktuell("f1"), /noch nicht geladen/);
  assert.deepEqual(f.aufrufe, []);
});
