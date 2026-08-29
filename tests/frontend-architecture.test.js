import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const appZeilen = app.trimEnd().split("\n").length;

const fachmodule = [
  "src/features/access.js",
  "src/features/profile-requests.js",
  "src/features/freetext-answers.js",
  "src/features/history-mode.js",
  "src/features/weekly-quiz.js",
  "src/ui/question-elements.js",
];

test("app.js bleibt ein kleiner Composition Root", () => {
  assert.ok(appZeilen <= 180, `app.js hat wieder ${appZeilen} Zeilen statt höchstens 180`);
  assert.match(app, /Composition Root/);
  assert.doesNotMatch(app, /\.rpc\(/);
  assert.doesNotMatch(app, /addEventListener\(/);
  assert.doesNotMatch(app, /function pruefeVereinskennung/);
  assert.doesNotMatch(app, /function freitextAntwortAbschicken/);
  assert.doesNotMatch(app, /function historieAntwortAbschicken/);
});

test("jede große Fachverantwortung besitzt ein eigenes Modul", () => {
  for (const pfad of fachmodule) {
    assert.equal(existsSync(new URL("../" + pfad, import.meta.url)), true, pfad + " fehlt");
  }
});

test("Supabase-RPCs liegen in Fachmodulen und nicht im Einstieg", () => {
  const access = readFileSync(new URL("../src/features/access.js", import.meta.url), "utf8");
  const anfragen = readFileSync(new URL("../src/features/profile-requests.js", import.meta.url), "utf8");
  const wochenQuiz = readFileSync(new URL("../src/features/weekly-quiz.js", import.meta.url), "utf8");
  const historie = readFileSync(new URL("../src/features/history-mode.js", import.meta.url), "utf8");

  assert.match(access, /verein_zugang/);
  assert.match(access, /schiri_anmelden/);
  assert.match(anfragen, /schiri_anfrage_erstellen/);
  assert.match(wochenQuiz, /wochen_fragen/);
  assert.match(historie, /historie_naechste_frage/);
});

/* ============================================================
   Gestaltung nach Funktion getrennt (29.08.2026)
   ============================================================
   Max: "dass nicht alles in App.js reinkommt und in CSS, sondern dass
   das nach Funktion getrennt wird." Beim JavaScript wachte oben schon
   ein Test darueber - beim CSS gab es keinen, und seite.css war
   unbemerkt auf 1.940 Zeilen gewachsen, weil jede neue Funktion hinten
   drangehaengt wurde. Diese Tests sollen genau das verhindern. */

import { readdirSync } from "node:fs";

const STIL_ORDNER = new URL("../stil/", import.meta.url);
const stildateien = readdirSync(STIL_ORDNER).filter((n) => n.endsWith(".css"));

const OEFFENTLICHE_SEITEN = [
  "index.html", "termine.html", "regeluebersicht.html", "informationen.html",
  "spesenrechner.html", "vorlagen.html", "schiri-werden.html",
  "modus.html", "entscheiden.html",
];

// Die verbindliche Einbindereihenfolge. An ihr haengt die Kaskade: wird
// sie vertauscht, gewinnen ploetzlich andere Regeln, und das faellt oft
// erst auf einer einzelnen Seite auf. Genau so wurde sie am 29.08.2026
// gegen die alte seite.css pixelweise geprueft - 20 Ansichten in zwei
// Breiten, kein sichtbarer Unterschied.
//
// Die beiden seitenspezifischen Teile stehen bewusst ganz hinten:
// obmann.css laedt nur obmann.html, spesen.css nur spesenrechner.html
// und obmann.html. spesen.css MUSS zuletzt kommen, weil seine Regeln
// vorher als <style>-Block am Ende des Kopfes standen.
//
// modus.css und entscheiden.css sind seitenspezifisch wie obmann.css und
// stehen deshalb ebenfalls hinten - sie duerfen die gemeinsamen Regeln
// ueberschreiben, aber nichts von ihnen darf auf eine andere Seite
// durchschlagen.
const REIHENFOLGE = [
  "basis", "kopf-fuss", "startseite", "termine", "regeln",
  "bausteine", "hinweise", "vorlagen", "anmeldung", "obmann", "spesen",
  "modus", "entscheiden",
];

test("es gibt keine gesammelte seite.css mehr", () => {
  assert.equal(existsSync(new URL("../seite.css", import.meta.url)), false,
    "seite.css ist zurueck - neue Regeln gehoeren in stil/<funktion>.css");
});

test("keine Stildatei waechst zur neuen Sammeldatei", () => {
  // 500 Zeilen ist grosszuegig; seite.css hatte 1.940. Reisst eine Datei
  // die Grenze, ist das das Zeichen, sie nach Funktion weiter zu teilen -
  // nicht, die Grenze hochzusetzen.
  for (const datei of stildateien) {
    const zeilen = readFileSync(new URL(datei, STIL_ORDNER), "utf8").trimEnd().split("\n").length;
    assert.ok(zeilen <= 500, `stil/${datei} hat ${zeilen} Zeilen - bitte nach Funktion aufteilen`);
  }
});

test("jede Vereinsseite bindet die Stilteile in der festgelegten Reihenfolge ein", () => {
  for (const seite of [...OEFFENTLICHE_SEITEN, "obmann.html"]) {
    const html = readFileSync(new URL("../" + seite, import.meta.url), "utf8");
    const benutzt = [...html.matchAll(/href="stil\/([a-z-]+)\.css"/g)].map((t) => t[1]);

    assert.ok(benutzt.length > 0, seite + " bindet keine Stildatei ein");
    assert.deepEqual(benutzt, [...new Set(benutzt)], seite + " bindet eine Stildatei doppelt ein");
    assert.ok(benutzt.includes("basis"), seite + " laedt basis.css nicht");

    // Jede Seite darf Teile weglassen, aber nicht umsortieren.
    const erwartet = REIHENFOLGE.filter((n) => benutzt.includes(n));
    assert.deepEqual(benutzt, erwartet,
      `${seite}: Reihenfolge weicht ab.\n  ist:      ${benutzt.join(", ")}\n  erwartet: ${erwartet.join(", ")}`);

    for (const name of benutzt) {
      assert.ok(stildateien.includes(name + ".css"), `${seite} verweist auf fehlendes stil/${name}.css`);
    }
  }
});

test("Stildateien mit ungeschuetzten Elementselektoren bleiben auf ihrer Seite", () => {
  // spesen.css enthaelt einfache Selektoren wie "label { ... }". Solange
  // die Regeln inline in spesenrechner.html standen, galten sie nur dort.
  // Wandert die Datei auf andere Seiten, faerbt sie deren Formulare mit
  // ein - das ist beim Aufteilen am 29.08.2026 fast passiert.
  for (const seite of OEFFENTLICHE_SEITEN.filter((s) => s !== "spesenrechner.html")) {
    const html = readFileSync(new URL("../" + seite, import.meta.url), "utf8");
    assert.doesNotMatch(html, /href="stil\/spesen\.css"/,
      seite + " laedt spesen.css - dort stehen ungeschuetzte Elementselektoren");
  }
});

test("kein Stil bleibt inline in einer Seite stehen", () => {
  // Der Grund fuer die ganze Runde: verstreute Regeln findet niemand
  // wieder. spesenrechner.html hatte 62 Zeilen im <style>-Block.
  for (const seite of [...OEFFENTLICHE_SEITEN, "obmann.html"]) {
    const html = readFileSync(new URL("../" + seite, import.meta.url), "utf8");
    assert.doesNotMatch(html, /<style[\s>]/, seite + " hat wieder einen <style>-Block");
  }
});
