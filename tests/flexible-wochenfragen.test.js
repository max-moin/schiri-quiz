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
