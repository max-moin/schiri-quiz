import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const startseite = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const quiz = readFileSync(new URL("../quiz.html", import.meta.url), "utf8");

test("die Vereinsstartseite bleibt vom Quiz-Einstieg getrennt", () => {
  // Seit dem 29.08.2026 zeigt der Hauptweg auf modus.html, die Auswahl
  // zwischen Wochenfragen und Entscheidungs-Modus. Der Gastweg fuehrt
  // weiterhin unmittelbar ins Quiz.
  assert.match(startseite, /href="modus\.html"/);
  assert.match(startseite, /href="quiz\.html#gast"/);
  assert.match(startseite, /src="seite\.js"/);
  assert.doesNotMatch(startseite, /src="app\.js"/);
});

test("das Vereinsquiz behält Hausknopf und Gast-Direkteinstieg", () => {
  assert.match(quiz, /class="heim-knopf"/);
  // 12.09.2026: Der Hausknopf fuehrt eine Ebene hoch nach modus.html,
  // nicht mehr zwei Ebenen bis zur Startseite. Das Wochenquiz haengt im
  // Baum unter "Quiz" (src/ui/wegweiser.js) - wer zurueck will, soll
  // dort landen und nicht ganz aussen. Und er traegt jetzt ein Wort:
  // ohne Browserleiste ist er der einzige Weg heraus.
  assert.match(quiz, /class="heim-knopf" aria-label="Zurück zu Quiz"/);
  assert.match(quiz, /href="modus\.html" class="heim-knopf"/);
  assert.match(quiz, /heim-knopf-wort/);
  assert.match(quiz, /window\.location\.hash === "#gast"/);
  assert.match(quiz, /gast-wechsel-button/);
});

test("alle Quizmodule existieren und werden vor app.js geladen", () => {
  const skripte = [
    "src/core/quiz-utils.js",
    "src/core/session-store.js",
    "src/ui/masked-input.js",
    "src/ui/text-to-speech.js",
    "src/ui/explanation-dialog.js",
    "src/ui/question-elements.js",
    "src/features/video-player.js",
    "src/features/guest-mode.js",
    "src/features/freetext-answers.js",
    "src/features/decision-answers.js",
    "src/features/history-mode.js",
    "src/features/weekly-quiz.js",
    "src/features/access.js",
    "app.js",
  ];

  let vorherigePosition = -1;
  for (const skript of skripte) {
    assert.equal(existsSync(new URL("../" + skript, import.meta.url)), true, skript + " fehlt");
    const position = quiz.indexOf(`src="${skript}"`);
    assert.ok(position > vorherigePosition, skript + " steht nicht in der erwarteten Ladereihenfolge");
    vorherigePosition = position;
  }

  assert.doesNotMatch(quiz, /src="src\/quiz-utils\.js"/);
});

test("die zusammengeführten HTML-Dateien enthalten keine Konfliktmarker", () => {
  assert.doesNotMatch(startseite, /^(<<<<<<<|=======|>>>>>>>)/m);
  assert.doesNotMatch(quiz, /^(<<<<<<<|=======|>>>>>>>)/m);
});
