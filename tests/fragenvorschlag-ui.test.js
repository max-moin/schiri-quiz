import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const html = lies("frage-vorschlagen.html");
const js = lies("src/website/frage-vorschlagen.js");
const css = lies("stil/frage-vorschlagen.css");

test("zusaetzliche Antwortoptionen lassen sich wieder entfernen", () => {
  assert.match(js, /class=\"antwort-entfernen\"/);
  assert.match(js, /function entferneAntwort\(buchstabe\)/);
  assert.match(js, /data-entfernen/);
  assert.match(css, /\.antwort-entfernen/);
});

test("Mindestlaengen stehen platzsparend im Feld und Fehler direkt am Feld", () => {
  assert.match(html, /placeholder="Wortlaut im Quiz · mindestens 10 Zeichen"/);
  assert.match(html, /mindestens 40 Zeichen/);
  assert.match(html, /mindestens 20 Zeichen/);
  assert.match(js, /className="feld-zaehler"/);
  assert.match(js, /aria-invalid/);
  assert.match(css, /\.ist-fehlerhaft/);
});

test("ein gespeicherter Entwurf wird unuebersehbar bestaetigt", () => {
  assert.match(html, /<dialog id="entwurf-bestaetigung"/);
  assert.match(html, /id="entwurf-ok"/);
  assert.match(js, /showModal/);
});
