// ============================================================
//  Pflichtangaben am Feld (25.09.2026)
// ============================================================
//  Leere Antworten werden am Feld gemeldet (roter Rahmen, Satz darunter,
//  aria-invalid), nicht mehr nur oben auf der Seite. Geprueft wird der
//  Baustein selbst an einem winzigen Test-DOM und dass alle Absende-Wege
//  ihn benutzen - mit dem alten Fehlerweg als Rueckfall.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

function testDom() {
  const alle = new Map();
  class El {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.attrs = {}; this.kinder = []; this.id = "";
      this.klassen = new Set(); this.hoerer = {}; this.textContent = ""; this.naechstes = null;
      this.classList = { add: (k) => this.klassen.add(k), remove: (k) => this.klassen.delete(k), contains: (k) => this.klassen.has(k) };
    }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    querySelectorAll() { return this.kinder; }
    insertAdjacentElement(_, el) { this.naechstes = el; alle.set(el.id, el); }
    addEventListener(t, f) { (this.hoerer[t] ||= []).push(f); }
    removeEventListener(t, f) { this.hoerer[t] = (this.hoerer[t] || []).filter((x) => x !== f); }
    feuere(t) { [...(this.hoerer[t] || [])].forEach((f) => f()); }
    remove() { alle.delete(this.id); }
    focus() { this.fokussiert = true; }
    scrollIntoView() {}
  }
  const document = { createElement: (t) => new El(t), getElementById: (id) => alle.get(id) || null };
  return { El, document, alle };
}

function ladeBaustein() {
  const dom = testDom();
  const kontext = { document: dom.document, matchMedia: () => ({ matches: true }), Date };
  kontext.globalThis = kontext;
  vm.runInNewContext(lies("src/ui/pflichtfeld.js"), kontext);
  return { ...dom, P: kontext.SchiriPflichtfeld };
}

test("ein leeres Feld bekommt Rahmen, Satz, aria-invalid und den Fokus", () => {
  const { El, P, alle } = ladeBaustein();
  const feld = new El("textarea");
  assert.equal(P.melde(feld, "Das Feld ist noch leer."), true);
  assert.ok(feld.klassen.has("pflicht-fehler"));
  assert.equal(feld.getAttribute("aria-invalid"), "true");
  const meldung = alle.get(feld.id + "-meldung");
  assert.ok(meldung, "Meldung steht direkt am Feld");
  assert.equal(meldung.getAttribute("role"), "alert");
  assert.equal(meldung.textContent, "Das Feld ist noch leer.");
  assert.match(feld.getAttribute("aria-describedby"), new RegExp(meldung.id));
  assert.equal(feld.fokussiert, true);
});

test("sobald man tippt, verschwindet die Markierung wieder", () => {
  const { El, P, alle } = ladeBaustein();
  const feld = new El("input");
  P.melde(feld, "Bitte eine Zahl eingeben.");
  feld.feuere("input");
  assert.equal(feld.klassen.has("pflicht-fehler"), false);
  assert.equal(feld.getAttribute("aria-invalid"), null);
  assert.equal(feld.getAttribute("aria-describedby"), null);
  assert.equal(alle.size, 0);
});

test("eine Gruppe markiert ihre Eingaben und fokussiert die erste", () => {
  const { El, P } = ladeBaustein();
  const gruppe = new El("div");
  const a = new El("input"); const b = new El("input");
  gruppe.kinder = [a, b];
  P.melde(gruppe, "Bitte eine Antwort auswählen.");
  assert.equal(a.getAttribute("aria-invalid"), "true");
  assert.equal(b.getAttribute("aria-invalid"), "true");
  assert.equal(a.fokussiert, true);
});

test("alle Absende-Wege melden am Feld und behalten den alten Rueckfall", () => {
  const freitext = lies("src/features/freetext-answers.js");
  assert.equal((freitext.match(/SchiriPflichtfeld\?\.melde\(textarea/g) || []).length, 2);
  const flexibel = lies("src/features/flexible-answers.js");
  assert.match(flexibel, /SchiriPflichtfeld\?\.melde\(liste/);
  assert.match(flexibel, /SchiriPflichtfeld\?\.melde\(zeile/);
  assert.match(flexibel, /Bitte nur eine Zahl eingeben/);
  const duell = lies("src/website/duell-seite.js");
  assert.equal((duell.match(/pflichtfeld\(/g) || []).length >= 6, true);
  for (const seite of ["quiz.html", "duell.html"]) {
    assert.match(lies(seite), /src="src\/ui\/pflichtfeld\.js"/, seite);
  }
  assert.match(lies("style.css"), /\.pflicht-meldung \{/);
});

test("Icon-Antworten sagen, was noch fehlt, statt nur grau zu bleiben", () => {
  const js = lies("src/features/decision-answers.js");
  assert.match(js, /function fehlendeTeile\(wahl, frage\)/);
  assert.match(js, /return fehlendeTeile\(wahl, frage\)\.length === 0/);
  assert.match(js, /"Noch offen: " \+ fehlt\.join\(", "\)/);
  assert.match(js, /senden\.setAttribute\("aria-describedby", offen\.id\)/);
});
