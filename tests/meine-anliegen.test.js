import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const html = lies("meine-anliegen.html");
const js = lies("src/website/meine-anliegen-seite.js");
const css = lies("stil/meine-anliegen.css");
const datenHtml = lies("meine-daten.html");
const statistikHtml = lies("meine-statistik.html");
const statistikJs = lies("src/website/meine-statistik-seite.js");
const migration = lies("supabase/migrations/20260909120000_v129_persoenlicher_bereich.sql");
const konto = lies("src/ui/konto-bereich.js").replace(/\/\*[\s\S]*?\*\//g, "");

test("der Kontobereich bleibt persoenlich und dupliziert den Quizknopf nicht", () => {
  assert.doesNotMatch(konto, /href="modus\.html"/);
  assert.match(lies("seite.js"), /text: "Mein Ausrüstungsbestand"/);
  assert.match(lies("seite.js"), /text: "Meine Anliegen"/);
  assert.match(lies("seite.js"), /text: "Meine Daten"/);
  assert.match(lies("seite.js"), /text: "Meine Quizstatistik"/);
  assert.match(lies("seite.js"), /meine-anliegen\.html/);
});

test("Daten, Statistik und Anliegen sind drei getrennte persoenliche Seiten", () => {
  assert.doesNotMatch(html, /id="meine-daten-titel"/);
  assert.doesNotMatch(html, /Mein Quiz diese Woche/);
  assert.match(datenHtml, /id="meine-daten-titel"/);
  assert.match(statistikHtml, /id="statistik-verlauf"/);
  assert.match(statistikJs, /"meine_quiz_statistik"/);
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
  ]) assert.match(js, new RegExp(`\\"${rpc}\\"`), rpc + " fehlt");
  assert.doesNotMatch(js, /rpc\.rpc\("obmann_/,
    "Die persoenliche Seite darf keine Verwaltungsfunktion abfragen.");
  for (const intern of ["notiz_obmann", "bemerkungen", "geburtsdatum", "liga_einstufung", "pin"]) {
    if (intern === "pin") continue; // PIN wird nur als RPC-Nachweis gesendet, nie gerendert.
    assert.doesNotMatch(js, new RegExp(intern), `Internes Feld wird verwendet: ${intern}`);
  }
});

test("Quiz-Feedback zeigt Frage und sichtbare Obmann-Antwort und bleibt editierbar", () => {
  assert.match(js, /m\.frage_text/);
  assert.match(js, /Antwort des Obmanns/);
  assert.match(js, /"meine_frage_meldung_bearbeiten"/);
  assert.match(migration, /rueckmeldung_obmann/);
  assert.match(migration, /create function public\.meine_frage_meldungen/);
  assert.match(migration, /create or replace function public\.meine_quiz_statistik/);
  assert.match(migration, /perform public\.schiri_pin_pruefen/);
});

test("Vorgaenge bleiben kompakt und zeigen Details erst nach dem Oeffnen", () => {
  assert.match(js, /document\.createElement\("details"\)/);
  assert.match(js, /document\.createElement\("summary"\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(html, /Anonym gesendetes Website-Feedback erscheint hier nicht/);
});

test("Ausruestungsanfragen stehen mit unter den eigenen Vorgaengen", () => {
  // Testperson A, 10.09.2026: Anfrage abgeschickt, hier gesucht, nicht
  // gefunden. Die Zeilen kamen immer schon mit derselben RPC mit.
  assert.match(js, /artName: "Ausrüstungsanfrage"/);
  assert.match(js, /\["ausruestung", "Ausrüstung"\]/);
  assert.match(js, /ausAusruestung\(aufrufe\[0\]\.value\)/);
});

test("die Seite sagt selbst, was auf ihr steht, und zeigt Fall und Verlauf", () => {
  // Testperson B hielt die Liste fuer die Antwort des Obmanns.
  assert.match(html, /eine Nachricht des Obmanns an dich ist das nicht/);
  assert.match(js, /Das hast du geschildert/);
  assert.match(js, /textContent = "Verlauf"/);
  assert.match(js, /function standSchritt/);
  assert.match(css, /\.meine-schritt \{/);
});

test("die Statistik benennt die Schwaeche in Worten statt in einer weiteren Zahl", () => {
  assert.match(statistikHtml, /id="statistik-deutung"/);
  assert.match(statistikJs, /Am häufigsten danebengelegen hast du/);
  // Ohne Themendaten darf die Seite keine Themenschwaeche behaupten.
  assert.match(statistikJs, /Nach Themengebieten kann diese Übersicht nicht auswerten/);
  assert.doesNotMatch(statistikJs, /kategorie|regel_nummer/);
});

test("ein Fragenvorschlag kann aus dem persoenlichen Verlauf geoeffnet werden", () => {
  assert.match(js, /frage-vorschlagen\.html\?vorschlag=/);
  assert.match(lies("src/website/frage-vorschlagen.js"), /URLSearchParams\(location\.search\)\.get\("vorschlag"\)/);
});
