import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const seiten = readdirSync(new URL('..', import.meta.url))
  .filter((n) => n.endsWith('.html'));

const lies = (n) => readFileSync(new URL('../' + n, import.meta.url), 'utf8');

// In Deutschland muss das Impressum von JEDER Seite aus unmittelbar
// erreichbar sein (Paragraf 5 DDG). Das ist hier schon zweimal weggerutscht:
// obmann.html hatte zeitweise gar keinen Fuss, ausruestung.html und
// frage-vorschlagen.html gingen ohne einen an den Start-Vorbereitungen
// vorbei. Deshalb ein Test statt guter Vorsaetze.
test('jede Seite verlinkt Impressum, Datenschutz und Nutzungsbedingungen', () => {
  assert.ok(seiten.length >= 15, 'zu wenige Seiten gefunden - stimmt der Pfad?');
  for (const seite of seiten) {
    const inhalt = lies(seite);
    for (const pflicht of ['impressum.html', 'datenschutz.html', 'nutzungsbedingungen.html']) {
      assert.match(inhalt, new RegExp(`href="${pflicht}"`),
        `${seite} verlinkt ${pflicht} nicht`);
    }
  }
});

// Eine Sprungmarke ohne Ziel schickt die Tastaturbedienung ins Leere - das
// ist schlimmer als keine, weil der Sprung dann wirkungslos bleibt.
test('jede Sprungmarke hat auch ein Ziel', () => {
  for (const seite of seiten) {
    const inhalt = lies(seite);
    if (!inhalt.includes('class="sprungmarke"')) continue;
    assert.match(inhalt, /id="inhalt"/,
      `${seite} hat eine Sprungmarke, aber kein Element mit id="inhalt"`);
  }
});
