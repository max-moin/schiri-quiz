import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const quelle = readFileSync(new URL('../src/features/flexible-answers.js', import.meta.url), 'utf8');
const stil = readFileSync(new URL('../stil/flexible-answers.css', import.meta.url), 'utf8');

// Nutzertest 08.09.2026: Dass mehrere Antworten erlaubt sind, war nur an der
// eckigen statt runden Schaltflaeche erkennbar, und die Fehlermeldung kam
// erst nach dem Absenden.
test('bei Mehrfachauswahl steht ein Hinweis VOR den Optionen', () => {
  assert.match(quelle, /Mehrere Antworten möglich/,
    'der Hinweistext fehlt');
  assert.match(quelle, /if \(mehrfach && !beantwortet\)/,
    'der Hinweis darf nur bei Mehrfachauswahl und nur vor dem Beantworten stehen');
  assert.match(stil, /\.auswahl-hinweis/,
    'ohne eigene Regel faellt der Hinweis optisch nicht auf');
});
