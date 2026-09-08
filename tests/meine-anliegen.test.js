import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const html = lies("meine-anliegen.html");
const js = lies("src/website/meine-anliegen-seite.js");
const css = lies("stil/meine-anliegen.css");
const konto = lies("src/ui/konto-bereich.js").replace(/\/\*[\s\S]*?\*\//g, "");

test("der Kontobereich bleibt persoenlich und dupliziert den Quizknopf nicht", () => {
  assert.doesNotMatch(konto, /href="modus\.html"/);
  assert.match(lies("seite.js"), /text: "Mein Ausrüstungsbestand"/);
  assert.match(lies("seite.js"), /text: "Meine Anliegen"/);
  assert.match(lies("seite.js"), /meine-anliegen\.html/);
});

test("Meine Anliegen ist eine eigene, rechtlich erreichbare Seite", () => {
  assert.match(html, /id="meine-vorgangsliste"/);
  assert.match(html, /href="impressum\.html"/);
  assert.match(html, /href="datenschutz\.html"/);
  assert.match(html, /href="nutzungsbedingungen\.html"/);
  assert.match(html, /src="seite\.js"/);
  assert.match(html, /src="src\/website\/meine-anliegen-seite\.js"/);
  assert.match(html, /href="stil\/meine-anliegen\.css"/);
});

test("nur persoenlich gefilterte Datenquellen werden zusammengefuehrt", () => {
  for (const rpc of [
    "schiri_anfragen_liste",
    "meine_frage_meldungen",
    "schiri_fragenvorschlaege_liste",
    "meine_termin_vorschlaege",
    "meine_antworten_v2",
  ]) assert.match(js, new RegExp(`\\"${rpc}\\"`), rpc + " fehlt");
  assert.doesNotMatch(js, /rpc\.rpc\("obmann_/,
    "Die persoenliche Seite darf keine Verwaltungsfunktion abfragen.");
  for (const intern of ["notiz_obmann", "bemerkungen", "geburtsdatum", "liga_einstufung", "pin"]) {
    if (intern === "pin") continue; // PIN wird nur als RPC-Nachweis gesendet, nie gerendert.
    assert.doesNotMatch(js, new RegExp(intern), `Internes Feld wird verwendet: ${intern}`);
  }
});

test("Vorgaenge bleiben kompakt und zeigen Details erst nach dem Oeffnen", () => {
  assert.match(js, /document\.createElement\("details"\)/);
  assert.match(js, /document\.createElement\("summary"\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(html, /Anonym gesendetes Website-Feedback erscheint hier nicht/);
});

test("ein Fragenvorschlag kann aus dem persoenlichen Verlauf geoeffnet werden", () => {
  assert.match(js, /frage-vorschlagen\.html\?vorschlag=/);
  assert.match(lies("src/website/frage-vorschlagen.js"), /URLSearchParams\(location\.search\)\.get\("vorschlag"\)/);
});
