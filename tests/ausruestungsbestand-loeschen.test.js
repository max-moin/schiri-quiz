import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const seite = readFileSync(new URL('../src/website/ausruestung-seite.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../ausruestung.html', import.meta.url), 'utf8');

// Der Bestand ist eine Liste, die man pflegt - dazu gehoert das Entfernen.
// Die RPC dafuer gab es serverseitig schon (v123), auf der Seite fehlte der
// Weg dorthin: eintragen und aendern ging, loeschen nicht.
test('Ausruestungsbestand: Loeschen ist von der Seite aus erreichbar', () => {
  assert.match(html, /id="bestand-loeschen"[^>]*hidden/,
    'Der Loeschknopf muss vorhanden und zunaechst ausgeblendet sein.');
  assert.match(seite, /schiri_ausruestungsbestand_loeschen/,
    'Die Seite muss die vorhandene Loesch-RPC auch wirklich aufrufen.');
  assert.match(seite, /p_id:\s*id/,
    'Geloescht wird genau der geoeffnete Eintrag.');
});

test('Ausruestungsbestand: Rueckfrage ohne Browserdialog, Knopf nur bei geoeffnetem Eintrag', () => {
  // Hausregel des Projekts: keine alert/confirm/prompt-Dialoge.
  assert.doesNotMatch(seite, /\b(confirm|alert|prompt)\s*\(/,
    'Statt eines Browserdialogs fragt der Knopf selbst nach.');
  // Erst der zweite Druck loescht.
  assert.match(seite, /dataset\.sicher\s*!==\s*"ja"/,
    'Der erste Druck stellt nur die Rueckfrage.');
  assert.match(seite, /k\.hidden\s*=\s*!\$\("bestand-id"\)\.value/,
    'Ohne geoeffneten Eintrag gibt es nichts zu loeschen - dann bleibt der Knopf weg.');
});
