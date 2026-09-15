import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const fenster = lies("src/ui/profil-fenster.js");
const anfragen = lies("src/features/profile-requests.js");
const bestand = lies("src/website/ausruestung-seite.js");
const ablauf = lies("ausruestung.html");
const migration = lies("supabase/migrations/20260915224750_v141_beschaffungswunsch_bei_anfrage.sql");
const selbstkaufMigration = lies("supabase/migrations/20260915225013_v142_selbstkauf_bestaetigen.sql");

test("der Schiri waehlt den Beschaffungsweg direkt in der Anfrage", () => {
  assert.match(fenster, /name="anfrage-beschaffungsweg"/);
  assert.match(fenster, /value="weg2_schiri_besorgt" checked/);
  assert.match(fenster, /value="weg1_obmann_besorgt"/);
  assert.match(anfragen, /p_beschaffungsweg:/);
  assert.match(anfragen, /weg2_schiri_besorgt/);
});

test("der Wunsch bleibt nach dem Absenden fuer den Schiri sichtbar", () => {
  assert.match(bestand, /"Wunsch: "/);
  assert.match(bestand, /"Beschaffung: "/);
  assert.match(ablauf, /Selbst kaufen ist vorausgewählt/);
  assert.match(fenster, /gewünschter Beschaffungsweg wurde mitgeschickt/);
});

test("die Datenbank validiert den Wunsch und bleibt fuer alte Clients kompatibel", () => {
  assert.match(migration, /p_beschaffungsweg text default 'weg2_schiri_besorgt'/);
  assert.match(migration, /beschaffungsweg\n\s*\) values/);
  assert.match(migration, /not in \('weg1_obmann_besorgt', 'weg2_schiri_besorgt'\)/);
  assert.match(migration, /'anliegen'.*null/s);
});

test("ein freigegebener Selbstkauf kann vor dem spaeteren Rechnungsupload bestaetigt werden", () => {
  assert.match(selbstkaufMigration, /selbstkauf_bestaetigt boolean not null default false/);
  assert.match(selbstkaufMigration, /schiri_anfrage_selbstkauf_bestaetigen/);
  assert.match(selbstkaufMigration, /status = 'angenommen'/);
  assert.match(selbstkaufMigration, /beschaffungsweg = 'weg2_schiri_besorgt'/);
  assert.match(bestand, /data-selbstkauf/);
  assert.match(bestand, /Gekauft · Rechnung folgt/);
  assert.match(bestand, /Rechnung kannst du hier später hochladen/);
});

test("ein direkter Rechnungsupload bestaetigt den Kauf ebenfalls", () => {
  assert.match(selbstkaufMigration, /rechnung_hochgeladen_am = now\(\).*selbstkauf_bestaetigt = true/s);
  assert.match(bestand, /Gekauft \+ Rechnung hochladen/);
});
