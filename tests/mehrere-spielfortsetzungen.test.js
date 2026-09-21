import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260922120000_mehrere_gueltige_spielfortsetzungen.sql", import.meta.url),
  "utf8"
);
const wochenApi = fs.readFileSync(new URL("../api/entscheidung-bewerten.js", import.meta.url), "utf8");
const duellApi = fs.readFileSync(new URL("../api/duell-entscheidung.js", import.meta.url), "utf8");
const anzeige = fs.readFileSync(new URL("../src/features/decision-answers.js", import.meta.url), "utf8");

test("Icon-Loesung speichert mehrere gueltige Fortsetzungen rueckwaertskompatibel", () => {
  assert.match(migration, /add column if not exists spielfortsetzungen_gueltig text\[\]/);
  assert.match(migration, /spielfortsetzung = spielfortsetzungen_gueltig\[1\]/);
  assert.match(migration, /array\[v_haupt_fortsetzung\]/);
  assert.match(migration, /frage_entscheidung_fortsetzungen_sync/);
});

test("Wochenquiz und Duell bewerten die einzelne Auswahl gegen die Liste", () => {
  assert.match(migration, /entscheidung_antwort_speichern_v2/);
  assert.match(migration, /duell_entscheidung_speichern_v2/);
  assert.match(migration, /v_antwort->>'spielfortsetzung' = any\(v_fortsetzungen\)/);
  assert.match(wochenApi, /supabaseRpc\("entscheidung_antwort_speichern_v2"/);
  assert.match(duellApi, /supabaseRpc\("duell_entscheidung_speichern_v2"/);
});

test("Aufloesung nennt alle als richtig akzeptierten Fortsetzungen", () => {
  assert.match(anzeige, /spielfortsetzungen_gueltig/);
  assert.match(anzeige, /\.join\(" oder "\)/);
});
