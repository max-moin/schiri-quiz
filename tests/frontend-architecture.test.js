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
