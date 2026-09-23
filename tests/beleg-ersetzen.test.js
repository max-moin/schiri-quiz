import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { belegAktion, prozessLinieHtml } from '../src/website/prozess-linie.js';

test('Beleg erstmals hochladen nur bei erlaubter Schiri-Aktion', () => {
  assert.equal(belegAktion(null), null);
  assert.equal(belegAktion({ prozess_status: 'gekauft', meine_aktionen: [] }), null);
  assert.equal(belegAktion({
    prozess_status: 'gekauft',
    meine_aktionen: [{ schritt: 'beleg_hochgeladen' }],
  }), 'Beleg hochladen');
});

test('Noch ungeprüften Beleg ohne Rücksprung ersetzen', () => {
  assert.equal(belegAktion({
    prozess_status: 'beleg_hochgeladen', meine_aktionen: [],
  }), 'Beleg ersetzen');
  assert.equal(belegAktion({
    prozess_status: 'beleg_geprueft', meine_aktionen: [],
  }), null);
});

test('Die Bestandsseite lädt nach einem erfolgreichen Upload sofort neu', () => {
  const profil = readFileSync(new URL('../src/features/profile-requests.js', import.meta.url), 'utf8');
  const bestand = readFileSync(new URL('../src/website/ausruestung-seite.js', import.meta.url), 'utf8');
  assert.match(profil, /dispatchEvent\(new Event\("schiri:beleg-aktualisiert"\)\)/);
  assert.match(bestand, /addEventListener\("schiri:beleg-aktualisiert", \(\) => \{ void ladeAnfragen\(\); \}\)/);
});

test('Ein zurückgewiesener Beleg zeigt kein altes Datum als neuen Schritt', () => {
  const html = prozessLinieHtml({ schritte: [
    { stand: 'erledigt', titel: 'Gekauft', zeitpunkt: '2026-09-22T10:00:00Z' },
    { stand: 'wartet', titel: 'Beleg einreichen', zeitpunkt: '2026-09-22T12:00:00Z' },
  ] }, String);
  assert.match(html, /22\.09\.2026/);
  assert.equal((html.match(/22\.09\.2026/g) || []).length, 1);
});
