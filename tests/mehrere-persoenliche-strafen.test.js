import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pruefeForm, pruefeVollstaendig } from "../api/entscheidung-bewerten.js";

/* ============================================================
   Mehrere persoenliche Strafen (v104, 31.08.2026)
   ============================================================
   Max' Fall: "Der Einwechselspieler mit der Nummer 19 ... kriegt erst
   eine Verwarnung fuer das Betreten des Feldes und dann eine gelb-rote
   Karte fuer das Unterbinden eines verheissungsvollen Angriffs."

   Diese Tests klicken das Formular wirklich durch, statt im Quelltext
   nach Zeichenketten zu suchen. Der Grund: die gefaehrlichen Fehler
   dieser Runde sind Verhalten, kein Text - eine zweite Karte, die im
   abgeschickten JSON fehlt, sieht im Quelltext genau richtig aus.
   ============================================================ */

// ============================================================
//  Ein sehr kleines DOM, gerade so gross wie das Modul es braucht
// ============================================================
const TEXT = "#text";

class TestKnoten {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attribute = {};
    this.hoerer = {};
    this.dataset = {};
    this.style = { setProperty() {} };
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.eigenerText = "";
  }
  get classList() {
    const knoten = this;
    return { add(name) { knoten.className = `${knoten.className} ${name}`.trim(); } };
  }
  setAttribute(name, wert) { this.attribute[name] = String(wert); }
  addEventListener(art, fn) { (this.hoerer[art] ||= []).push(fn); }
  ausloesen(art) { for (const fn of this.hoerer[art] || []) fn(); }
  appendChild(kind) {
    assert.ok(kind, "appendChild(null) - das Modul haengt etwas Leeres ein");
    kind.parentNode = this;
    this.children.push(kind);
    return kind;
  }
  append(...teile) {
    for (const teil of teile) {
      this.appendChild(typeof teil === "string" ? textKnoten(teil) : teil);
    }
  }
  prepend(kind) { kind.parentNode = this; this.children.unshift(kind); }
  replaceWith(neu) {
    const eltern = this.parentNode;
    if (!eltern) return;
    eltern.children[eltern.children.indexOf(this)] = neu;
    neu.parentNode = eltern;
  }
  focus() {}
  get childElementCount() { return this.children.filter((k) => k.tagName !== TEXT).length; }
  set textContent(wert) { this.eigenerText = String(wert); this.children = []; }
  get textContent() {
    return this.eigenerText + this.children.map((k) => k.textContent).join("");
  }
  set innerHTML(wert) { this.eigenesHtml = String(wert); }
  querySelector(auswahl) { return alle(this, auswahl)[0] || null; }
}

function textKnoten(text) {
  const knoten = new TestKnoten(TEXT);
  knoten.eigenerText = String(text);
  return knoten;
}

function passt(knoten, auswahl) {
  if (auswahl.startsWith(".")) return String(knoten.className).split(/\s+/).includes(auswahl.slice(1));
  return knoten.tagName === auswahl.toUpperCase();
}

function alle(wurzel, auswahl) {
  const treffer = [];
  for (const kind of wurzel.children) {
    if (passt(kind, auswahl)) treffer.push(kind);
    treffer.push(...alle(kind, auswahl));
  }
  return treffer;
}

globalThis.document = {
  createElement: (tag) => new TestKnoten(tag),
  createTextNode: (text) => textKnoten(text),
};

// ============================================================
//  Das Modul unter Testbedingungen
// ============================================================
let gesendet = null;

async function baueModul() {
  await import("../src/features/decision-answers.js");
  const modul = globalThis.SchiriQuizDecisionAnswers.erstelleEntscheidungsAntworten({
    getZugang: () => ({ schiedsrichterId: "11111111-1111-4111-8111-111111111111", pin: "1234" }),
    zeigeFehler() {},
    versteckeFehler() {},
    frageAnsicht: { baueBadges: () => null },
    baueVideoEinbettungModal: () => null,
    baueVorlesenButton: () => null,
    baueWarumButton: () => new TestKnoten("button"),
    beiWochenfrageBeantwortet() {},
  });
  await modul.bereiteVor();
  return modul;
}

globalThis.fetch = async (adresse, einstellungen) => {
  gesendet = { adresse, koerper: JSON.parse(einstellungen.body) };
  return {
    ok: true,
    json: async () => ({
      korrekt: true,
      antwort: gesendet.koerper.antwort,
      loesung: { strafen: [] },
      ergebnis: {},
    }),
  };
};

// Eine reine Strafenfrage: Spielfortsetzung ist abgeschaltet, alles zur
// Person ist gefragt. Genau Max' Szene.
const FRAGE = {
  id: "22222222-2222-4222-8222-222222222222",
  frage_text: "Einwechselspieler Nummer 19 betritt das Feld und foult.",
  fordert_fortsetzung: false,
  fordert_strafe: true,
  fordert_strafe_mannschaft: true,
  fordert_strafe_rolle: true,
  fordert_strafe_nummer: true,
};

const knoepfe = (wurzel) => alle(wurzel, ".entscheidung-knopf");
const bloecke = (wurzel) => alle(wurzel, ".entscheidung-strafblock");
const senden = (wurzel) => wurzel.querySelector(".entscheidung-absenden");

function klickeWert(wurzel, wert) {
  const knopf = knoepfe(wurzel).find((k) => k.dataset.wert === wert);
  assert.ok(knopf, `Knopf "${wert}" fehlt`);
  knopf.ausloesen("click");
  return knopf;
}

/** Mannschaft, Rolle und Rueckennummer im Block an Stelle `stelle`. */
function fuellePerson(karte, stelle, seite, rolle, nummer) {
  const block = bloecke(karte)[stelle];
  assert.ok(block, `Block ${stelle + 1} fehlt`);
  const team = knoepfe(block).find((k) => k.dataset.wert === seite);
  assert.ok(team, "Mannschaftsknopf fehlt im Block");
  team.ausloesen("click");

  const frisch = bloecke(karte)[stelle];
  const auswahl = alle(frisch, "select")[0];
  assert.ok(auswahl, "Rollenauswahl fehlt im Block");
  auswahl.value = rolle;
  auswahl.ausloesen("change");

  const feld = alle(frisch, "input")[0];
  assert.ok(feld, "Rueckennummer fehlt im Block");
  feld.value = String(nummer);
  feld.ausloesen("input");
}

// ============================================================
//  1. Max' Fall von vorne bis zum abgeschickten JSON
// ============================================================

test("zwei Karten fuer denselben Spieler landen als Liste im Antwort-JSON", async () => {
  const modul = await baueModul();
  const karte = modul.baueFrageElement(FRAGE);

  klickeWert(karte, "gelb");
  assert.equal(bloecke(karte).length, 1, "die erste Karte legt keinen Block an");
  fuellePerson(karte, 0, "gast", "auswechselspieler", 19);

  const mehr = karte.querySelector(".entscheidung-strafe-mehr");
  assert.ok(mehr, "der Knopf \"Weitere persönliche Strafe hinzufügen\" fehlt");
  assert.match(mehr.textContent, /Weitere persönliche Strafe hinzufügen/);
  mehr.ausloesen("click");

  assert.equal(bloecke(karte).length, 2, "der zweite Block ist nicht aufgegangen");
  assert.equal(senden(karte).disabled, true,
    "ein Block ohne Karte darf nicht abschickbar sein");

  // Max: "dann kommt nochmal das Fenster auf, und dann klickst du auf
  // 'Gelbe Karte'" - die Karte waehlt man IM neuen Block.
  const zweiter = bloecke(karte)[1];
  const gelbrot = knoepfe(zweiter).find((k) => k.dataset.wert === "gelb_rot");
  assert.ok(gelbrot, "der zweite Block hat keine eigene Kartenwahl");
  // "Keine" gehoert nicht in einen Block - keine Strafe ist die leere Liste.
  assert.equal(knoepfe(zweiter).some((k) => k.dataset.wert === "keine"), false);
  gelbrot.ausloesen("click");
  fuellePerson(karte, 1, "gast", "auswechselspieler", 19);

  const knopf = senden(karte);
  assert.equal(knopf.disabled, false, "vollstaendige Antwort bleibt gesperrt");
  knopf.ausloesen("click");
  await new Promise((weiter) => setTimeout(weiter, 0));

  assert.equal(gesendet.adresse, "/api/entscheidung-bewerten");
  assert.deepEqual(gesendet.koerper.antwort.strafen, [
    { strafe: "gelb", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: "19" },
    { strafe: "gelb_rot", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: "19" },
  ]);
  // Die erste Strafe steht zusaetzlich in den alten Einzelfeldern: die
  // Klartextzeile der Datenbank liest weiterhin diese.
  assert.equal(gesendet.koerper.antwort.persoenliche_strafe, "gelb");
});

// ============================================================
//  2. "Keine" bleibt eine eigene, einfache Wahl
// ============================================================

test("\"Keine\" zeigt keinen Block und schickt eine leere Liste", async () => {
  const modul = await baueModul();
  const karte = modul.baueFrageElement(FRAGE);

  assert.equal(senden(karte).disabled, true, "ohne jede Wahl darf nichts abgehen");
  klickeWert(karte, "keine");
  assert.equal(bloecke(karte).length, 0, "\"Keine\" zeigt trotzdem einen Strafblock");
  assert.equal(karte.querySelector(".entscheidung-strafe-mehr"), null,
    "\"Keine\" bietet trotzdem eine weitere Strafe an");

  const knopf = senden(karte);
  assert.equal(knopf.disabled, false, "\"Keine\" gilt nicht als Antwort");
  knopf.ausloesen("click");
  await new Promise((weiter) => setTimeout(weiter, 0));
  assert.deepEqual(gesendet.koerper.antwort.strafen, []);
  assert.equal(gesendet.koerper.antwort.persoenliche_strafe, "keine");
});

test("der letzte entfernte Block ist nicht dasselbe wie \"Keine\"", async () => {
  const modul = await baueModul();
  const karte = modul.baueFrageElement(FRAGE);
  klickeWert(karte, "gelb");
  fuellePerson(karte, 0, "heim", "feldspieler", 7);
  assert.equal(senden(karte).disabled, false);

  alle(karte, ".entscheidung-strafe-entfernen")[0].ausloesen("click");
  assert.equal(bloecke(karte).length, 0);
  // Sonst gaebe ein Fehlgriff stillschweigend "keine Strafe" ab.
  assert.equal(senden(karte).disabled, true,
    "eine geleerte Liste zaehlt als ausdrueckliches \"Keine\"");
});

// ============================================================
//  3. Hoechstens vier - die Datenbank laesst position 1..4
// ============================================================

test("nach der vierten Strafe gibt es keinen Knopf mehr", async () => {
  const modul = await baueModul();
  const karte = modul.baueFrageElement(FRAGE);
  klickeWert(karte, "gelb");
  fuellePerson(karte, 0, "heim", "feldspieler", 7);

  for (let i = 1; i < 4; i += 1) {
    const mehr = karte.querySelector(".entscheidung-strafe-mehr");
    assert.ok(mehr, `bei ${i} Strafen fehlt der Knopf`);
    mehr.ausloesen("click");
    const block = bloecke(karte)[i];
    knoepfe(block).find((k) => k.dataset.wert === "gelb").ausloesen("click");
    fuellePerson(karte, i, "heim", "feldspieler", 7 + i);
  }
  assert.equal(bloecke(karte).length, 4);
  assert.equal(karte.querySelector(".entscheidung-strafe-mehr"), null,
    "eine fuenfte Strafe laesst sich anlegen - die Datenbank kennt nur 1..4");
  assert.match(karte.querySelector(".entscheidung-strafe-grenze").textContent, /4/);
});

// ============================================================
//  4. Nicht gefragt heisst: steht auch nicht im JSON
// ============================================================

test("Rolle, Mannschaft und Nummer gehen nur mit, wenn die Frage sie verlangt", async () => {
  const modul = await baueModul();
  const nurKarte = {
    ...FRAGE,
    fordert_strafe_mannschaft: false,
    fordert_strafe_rolle: false,
    fordert_strafe_nummer: false,
  };
  const karte = modul.baueFrageElement(nurKarte);
  klickeWert(karte, "rot");
  assert.equal(alle(karte, "select").length, 0, "Rolle wird gefragt, obwohl abgeschaltet");
  assert.equal(alle(karte, "input").length, 0, "Rueckennummer wird gefragt, obwohl abgeschaltet");

  senden(karte).ausloesen("click");
  await new Promise((weiter) => setTimeout(weiter, 0));
  assert.deepEqual(gesendet.koerper.antwort.strafen, [{ strafe: "rot" }]);
});

// ============================================================
//  5. Die Aufloesung zeigt mehrere Strafen
// ============================================================

test("die Ergebnisanzeige listet jede Strafe einzeln auf", async () => {
  const modul = await baueModul();
  const element = modul.baueBeantworteteFrageElement(FRAGE, {
    korrekt: false,
    entscheidung: {
      antwort: { strafen: [{ strafe: "gelb", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: "19" }] },
      loesung: {
        strafen: [
          { strafe: "gelb", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: 19 },
          { strafe: "gelb_rot", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: 19 },
        ],
      },
      ergebnis: { strafe_richtig: false, strafziel_richtig: true, rolle_richtig: true, rueckennummer_richtig: true },
    },
  });
  const listen = alle(element, ".entscheidung-strafen-anzeige");
  assert.equal(listen.length, 2, "eigene Antwort und Loesung stehen nicht beide da");
  assert.equal(listen[1].children.length, 2, "die zweite Karte der Loesung fehlt");
  assert.match(listen[1].textContent, /Gelbe Karte für Gast \(Auswechselspieler, Nr. 19\)/);
  assert.match(listen[1].textContent, /Gelb-Rot für Gast \(Auswechselspieler, Nr. 19\)/);
});

test("eine Antwort von vor v104 bleibt lesbar", async () => {
  // Aeltere Antworten haben nur die vier Einzelfelder. Ohne die
  // Ruecklesung stuende bei jeder alten Antwort "Keine persoenliche
  // Strafe" - ein Kreuz bei etwas, das damals richtig war.
  const modul = await baueModul();
  const element = modul.baueBeantworteteFrageElement(FRAGE, {
    korrekt: true,
    entscheidung: {
      antwort: { persoenliche_strafe: "rot", strafe_fuer_mannschaft: "heim", strafe_fuer_rolle: "torwart" },
      loesung: { persoenliche_strafe: "rot", strafe_fuer_mannschaft: "heim", strafe_fuer_rolle: "torwart" },
      ergebnis: { strafe_richtig: true, strafziel_richtig: true, rolle_richtig: true, rueckennummer_richtig: null },
    },
  });
  const liste = alle(element, ".entscheidung-strafen-anzeige")[0];
  assert.match(liste.textContent, /Rote Karte für Heim \(Torwart\)/);
});

test("ein nicht gefragter Bestandteil bekommt kein rotes Kreuz", async () => {
  // null heisst "war nicht gefragt" (v101). Boolean(null) waere false -
  // und die Aufloesung zeigte ein Kreuz bei einer Frage, die danach nie
  // gefragt hat.
  const modul = await baueModul();
  const element = modul.baueBeantworteteFrageElement(FRAGE, {
    korrekt: true,
    entscheidung: {
      antwort: { strafen: [{ strafe: "gelb" }] },
      loesung: { strafen: [{ strafe: "gelb" }] },
      ergebnis: { strafe_richtig: true, strafziel_richtig: null, rolle_richtig: null, rueckennummer_richtig: null },
    },
  });
  const zeilen = alle(element, ".entscheidung-ergebnis-zeile");
  const strafzeile = zeilen[zeilen.length - 1];
  assert.match(strafzeile.className, /gut/,
    "die Strafzeile ist rot, obwohl nur nicht gefragte Teile leer sind");
});

// ============================================================
//  6. Die Serverroute kennt die Liste
// ============================================================

test("pruefeForm prueft die Liste auf Form, nicht auf Pflicht", () => {
  assert.equal(pruefeForm({}), null, "pruefeForm verlangt etwas, ohne die Frage zu kennen");
  assert.equal(pruefeForm({ strafen: [] }), null);
  assert.equal(pruefeForm({ strafen: [{ strafe: "gelb" }] }), null,
    "pruefeForm verlangt Felder, nach denen die Frage vielleicht nie fragt");
  assert.equal(pruefeForm({
    strafen: [{ strafe: "gelb_rot", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: "19" }],
  }), null);

  // "keine" ist kein Listeneintrag - sonst zaehlte die Datenbank eine
  // Strafe zu viel und die Antwort waere falsch, ohne sichtbaren Grund.
  assert.match(pruefeForm({ strafen: [{ strafe: "keine" }] }), /ungültig/);
  assert.match(pruefeForm({ strafen: [{ strafe: "zeitstrafe" }] }), /ungültig/);
  assert.match(pruefeForm({ strafen: "gelb" }), /ungültig/);
  assert.match(pruefeForm({ strafen: [{ strafe: "gelb", fuer_mannschaft: "schiri" }] }), /Mannschaft/);
  assert.match(pruefeForm({ strafen: [{ strafe: "gelb", strafe_fuer_rolle: "zuschauer" }] }), /Rolle/);
  assert.match(pruefeForm({ strafen: [{ strafe: "gelb", rueckennummer: "0" }] }), /Rückennummer/);
  assert.match(pruefeForm({ strafen: Array(5).fill({ strafe: "gelb" }) }), /Höchstens 4/);
});

test("pruefeVollstaendig verlangt je Strafe, was die Frage verlangt", () => {
  const kontext = {
    fordert_fortsetzung: false,
    fordert_strafe: true,
    fordert_strafe_mannschaft: true,
    fordert_strafe_rolle: true,
    fordert_strafe_nummer: true,
  };
  const gut = { strafe: "gelb", fuer_mannschaft: "gast", strafe_fuer_rolle: "auswechselspieler", rueckennummer: "19" };

  assert.equal(pruefeVollstaendig({ strafen: [gut, { ...gut, strafe: "gelb_rot" }] }, kontext), null);
  // Die leere Liste ist eine vollstaendige Antwort: "keine Strafe".
  assert.equal(pruefeVollstaendig({ strafen: [] }, kontext), null);
  // Auch die ZWEITE Strafe muss vollstaendig sein.
  assert.match(pruefeVollstaendig({ strafen: [gut, { strafe: "gelb_rot" }] }, kontext), /Mannschaft/);
  assert.match(pruefeVollstaendig({ strafen: [{ ...gut, strafe_fuer_rolle: null }] }, kontext), /Rolle/);
  assert.match(pruefeVollstaendig({ strafen: [{ ...gut, rueckennummer: "" }] }, kontext), /Rückennummer/);
  // Ohne Liste gilt die alte Fassung - eine nicht nachgezogene Seite
  // darf nicht ploetzlich abgewiesen werden.
  assert.match(pruefeVollstaendig({}, kontext), /Persönliche Strafe fehlt/);
  assert.equal(pruefeVollstaendig({ persoenliche_strafe: "keine" }, kontext), null);
  // Fragt die Frage nicht nach der Strafe, wird auch nichts verlangt.
  assert.equal(pruefeVollstaendig({}, { ...kontext, fordert_strafe: false }), null);
});

// ============================================================
//  7. Bedienbarkeit auf dem Handy
// ============================================================

test("kein Eingabefeld ist kleiner als 16px", () => {
  // Unter 16px zoomt iOS Safari beim Antippen in die Seite hinein und
  // zoomt nicht von allein zurueck. "font: inherit" allein genuegt
  // nicht: die Felder stehen in einem Label mit .9rem.
  const css = readFileSync(new URL("../stil/wochen-entscheidung.css", import.meta.url), "utf8");
  const regel = css.slice(css.indexOf(".entscheidung-anderer-ort input,"));
  assert.match(regel.slice(0, regel.indexOf("}")), /font-size: 16px/,
    "die Felder im Strafblock erben .9rem - iOS zoomt dann hinein");
});

test("der Knopf fuer die weitere Strafe ist gross genug zum Treffen", () => {
  const css = readFileSync(new URL("../stil/wochen-entscheidung.css", import.meta.url), "utf8");
  const regel = css.slice(css.indexOf(".entscheidung-strafe-mehr {"));
  const rumpf = regel.slice(0, regel.indexOf("}"));
  assert.match(rumpf, /width: 100%/);
  assert.match(rumpf, /min-height: (4[4-9]|[5-9][0-9])px/);
});
