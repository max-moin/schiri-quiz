import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const lies = (datei) => readFileSync(join(root, datei), "utf8");
const migration = lies("supabase/migrations/20260901091903_v108_flexible_fragen.sql");
const weekly = lies("src/features/weekly-quiz.js");
const flexibel = lies("src/features/flexible-answers.js");
const quiz = lies("quiz.html");

test("Mehrfachauswahl und Zahl besitzen eigene serverseitige Antwortwege", () => {
  assert.match(migration, /function public\.antwort_auswahl_abgeben/);
  assert.match(migration, /function public\.antwort_zahl_abgeben/);
  assert.match(flexibel, /rpc\("antwort_auswahl_abgeben"/);
  assert.match(flexibel, /rpc\("antwort_zahl_abgeben"/);
});

test("richtige flexible Lösungen stehen nicht im öffentlichen Fragen-Feed", () => {
  const feed = migration.match(/function public\.wochen_fragen_v2[\s\S]*?create or replace function public\.antwort_auswahl_abgeben/)?.[0] || "";
  assert.ok(feed.length > 0);
  assert.doesNotMatch(feed, /ist_richtig/);
  assert.doesNotMatch(feed, /frage_zahl_loesungen[\s\S]*?wert/);
});

test("Lösungstabellen sind mit RLS und ohne Tabellenrechte geschützt", () => {
  for (const tabelle of ["frage_antwortoptionen", "frage_zahl_loesungen"]) {
    assert.match(migration, new RegExp(`alter table public\\.${tabelle} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${tabelle} from public, anon, authenticated`));
  }
});

test("das Wochenquiz lädt v2-Daten und delegiert flexible Antworten", () => {
  assert.match(weekly, /rpc\("wochen_fragen_v2"/);
  assert.match(weekly, /rpc\("meine_antworten_v2"/);
  assert.match(weekly, /flexibel\.baueFrageElement/);
  assert.match(weekly, /flexibel\.baueBeantworteteFrageElement/);
});

test("Bild, Mehrfachauswahl und Zahl werden als eigene Module geladen", () => {
  assert.match(quiz, /stil\/flexible-answers\.css/);
  assert.match(quiz, /src\/features\/flexible-answers\.js/);
  assert.match(flexibel, /frageAnsicht\.baueFrageBild/);
  assert.match(flexibel, /input\.inputMode = "decimal"/);
  assert.match(flexibel, /input\.type = mehrfach \? "checkbox" : "radio"/);
});

test("alle neuen Browser-RPCs werden einzeln und nur für anon freigegeben", () => {
  for (const funktion of [
    "wochen_fragen_v2", "meine_antworten_v2", "antwort_auswahl_abgeben", "antwort_zahl_abgeben",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${funktion}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${funktion}[^;]+ to anon`));
  }
});

/* ============================================================
   Die Zahlantwort: EIN Zahlenfeld, EINE Einheit - und sonst nichts
   ============================================================
   Max, zum zweiten Mal am 04.09.2026: "Bei dieser Antwort mit Zahl
   gefaellt mir noch nicht, dass man da die Einheit irgendwie separat
   eingeben kann und auch die Zahl, und da gibt es irgendwie noch eine
   dritte Zahl hinten dran."

   Diese Pruefungen laufen gegen einen winzigen Test-DOM und nicht gegen
   den Dateitext: an Zeichenketten liesse sich nicht ablesen, ob in der
   Eingabezeile wirklich nur zwei Dinge stehen. Und weil das Format der
   abgeschickten Antwort (p_wert numeric, p_einheit text) alle bisherigen
   Antworten traegt, wird auch das hier festgehalten.
   ============================================================ */

let alleElemente = [];

class TestElement {
  constructor(tag) {
    this.tag = tag;
    this.klassen = new Set();
    this.attribute = {};
    this.dataset = {};
    this.kinder = [];
    this.parentNode = null;
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.zuhoerer = {};
    this.classList = {
      add: (...namen) => namen.forEach((n) => this.klassen.add(n)),
      remove: (...namen) => namen.forEach((n) => this.klassen.delete(n)),
      contains: (name) => this.klassen.has(name),
      toggle: (name, an) => {
        const soll = an === undefined ? !this.klassen.has(name) : Boolean(an);
        if (soll) this.klassen.add(name);
        else this.klassen.delete(name);
        return soll;
      },
    };
  }

  set className(wert) { this.klassen = new Set(String(wert).split(" ").filter(Boolean)); }
  get className() { return [...this.klassen].join(" "); }

  setAttribute(name, wert) { this.attribute[name] = String(wert); }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attribute, name) ? this.attribute[name] : null;
  }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attribute, name); }
  removeAttribute(name) { delete this.attribute[name]; }

  addEventListener(name, rueckruf) {
    (this.zuhoerer[name] = this.zuhoerer[name] || []).push(rueckruf);
  }
  ausloesen(name, ereignis) { (this.zuhoerer[name] || []).forEach((r) => r(ereignis || {})); }

  appendChild(kind) {
    if (kind.parentNode) kind.parentNode.kinder = kind.parentNode.kinder.filter((k) => k !== kind);
    kind.parentNode = this;
    this.kinder.push(kind);
    return kind;
  }
  append(...kinder) { kinder.forEach((k) => this.appendChild(k)); }
  remove() {
    if (this.parentNode) this.parentNode.kinder = this.parentNode.kinder.filter((k) => k !== this);
    this.parentNode = null;
  }
  focus() {}

  nachfahren() { return this.kinder.flatMap((k) => [k, ...k.nachfahren()]); }

  /* Unbekannte Waehler werfen absichtlich: aendert jemand den Waehler im
     Code, wird der Test rot statt still gruen zu bleiben. */
  querySelectorAll(waehler) {
    const text = String(waehler).trim();
    const klasse = text.match(/^\.([\w-]+)$/);
    if (klasse) return this.nachfahren().filter((el) => el.klassen.has(klasse[1]));
    if (text === "input, select") {
      return this.nachfahren().filter((el) => el.tag === "input" || el.tag === "select");
    }
    if (text === "input:checked") {
      return this.nachfahren().filter((el) => el.tag === "input" && el.checked === true);
    }
    throw new Error("Der Test-DOM kennt diesen Waehler nicht: " + waehler);
  }
  querySelector(waehler) { return this.querySelectorAll(waehler)[0] || null; }

  text() { return (this.textContent || "") + this.kinder.map((k) => k.text()).join(""); }
}

function neuerDom() {
  alleElemente = [];
  globalThis.document = {
    body: new TestElement("body"),
    activeElement: null,
    createElement: (tag) => {
      const el = new TestElement(tag);
      alleElemente.push(el);
      return el;
    },
    createTextNode: (inhalt) => {
      const el = new TestElement("#text");
      el.textContent = inhalt;
      return el;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
}

/** Baut die Zahlantwort mit den angegebenen Einheiten und merkt sich die RPCs. */
function zahlKarte(einheiten) {
  neuerDom();
  // eslint-disable-next-line no-new-func
  new Function(lies("src/features/flexible-answers.js"))();

  const gerufen = [];
  const antworten = globalThis.SchiriQuizFlexibleAnswers.erstelleFlexibleAntworten({
    sb: {
      rpc: async (name, parameter) => {
        gerufen.push([name, parameter]);
        return { data: [{ korrekt: true, richtige_antworten: [], bereits_beantwortet: false }], error: null };
      },
    },
    getZugang: () => ({ schiedsrichterId: "s1", pin: "1234" }),
    zeigeFehler: (nachricht) => gerufen.push(["fehler", nachricht]),
    versteckeFehler: () => {},
    frageAnsicht: { baueBadges: () => null, baueFrageBild: () => null },
    baueVideoEinbettungModal: () => null,
    baueVorlesenButton: () => null,
    baueWarumButton: () => document.createElement("button"),
    beiWochenfrageBeantwortet: () => {},
  });

  const karte = antworten.baueFrageElement({
    id: "f1",
    antworttyp: "zahl",
    frage_text: "Wie weit ist der Elfmeterpunkt vom Tor entfernt?",
    zahl_einheiten: einheiten.map((einheit) => ({ einheit })),
  });
  const zeile = karte.querySelector(".zahl-eingabe-zeile");
  return { karte, zeile, gerufen, absenden: karte.querySelector(".absenden-button") };
}

const naechsteRunde = () => new Promise((fertig) => setTimeout(fertig, 0));

test("in der Zahl-Eingabezeile stehen genau zwei Dinge: Zahl und Einheit", () => {
  const fall = zahlKarte(["m", "cm"]);
  assert.ok(fall.zeile, "die Eingabezeile fehlt");
  assert.equal(fall.zeile.kinder.length, 2,
    "neben Zahl und Einheit steht noch etwas Drittes in der Zeile: "
    + fall.zeile.kinder.map((k) => k.tag + " " + k.className).join(", "));

  const [zahl, einheit] = fall.zeile.kinder;
  assert.equal(zahl.tag, "input");
  assert.equal(zahl.inputMode, "decimal", "das Zahlenfeld oeffnet auf dem Handy die falsche Tastatur");
  assert.equal(einheit.tag, "select", "bei mehreren Einheiten fehlt die Auswahl");
  assert.deepEqual(einheit.kinder.map((o) => o.value), ["m", "cm"]);

  // Kein zweites Zahlenfeld, kein Zaehler, keine Position - egal wie tief.
  const eingaben = fall.zeile.nachfahren().filter((el) => el.tag === "input" || el.tag === "textarea");
  assert.equal(eingaben.length, 1,
    "es gibt mehr als ein Eingabefeld fuer eine Zahl - genau die 'dritte Zahl hinten dran'");
});

test("bei genau einer Einheit steht sie als Wort da, ohne Auswahl", () => {
  const fall = zahlKarte(["m"]);
  assert.equal(fall.zeile.kinder.length, 2, "neben Zahl und Einheit steht noch etwas Drittes");

  const [zahl, einheit] = fall.zeile.kinder;
  assert.equal(zahl.tag, "input");
  assert.notEqual(einheit.tag, "select",
    "eine einzige Einheit wird als Ausklappmenue angeboten - eine Wahl ohne Wahl");
  assert.equal(einheit.text().trim(), "m", "die Einheit steht gar nicht neben dem Feld");
  assert.equal(fall.zeile.nachfahren().filter((el) => el.tag === "select").length, 0);
});

test("die Zahlantwort wird unveraendert als Zahl plus Einheitentext abgeschickt", async () => {
  // antwort_zahl_abgeben(p_wert numeric, p_einheit text) - wer dieses
  // Format aendert, entwertet alle bisher gegebenen Antworten.
  for (const einheiten of [["m", "cm"], ["m"]]) {
    const fall = zahlKarte(einheiten);
    fall.zeile.kinder[0].value = "9,15";
    if (einheiten.length > 1) fall.zeile.kinder[1].value = "m";
    fall.absenden.ausloesen("click");
    await naechsteRunde();

    const [name, parameter] = fall.gerufen[0];
    assert.equal(name, "antwort_zahl_abgeben", "die Antwort geht an eine andere Serverfunktion");
    assert.equal(parameter.p_wert, 9.15, "der Wert kommt nicht als Zahl an");
    assert.equal(parameter.p_einheit, "m", "die Einheit kommt nicht als Text an");
    assert.deepEqual(Object.keys(parameter).sort(),
      ["p_einheit", "p_frage_id", "p_pin", "p_schiedsrichter_id", "p_wert"],
      "es wird ein weiterer Wert mitgeschickt");
  }
});

test("ein leeres Zahlenfeld wird nicht als Null abgeschickt", () => {
  const fall = zahlKarte(["m"]);
  fall.absenden.ausloesen("click");
  assert.deepEqual(fall.gerufen[0][0], "fehler",
    "ein leeres Feld geht als 0 an den Server");
});
