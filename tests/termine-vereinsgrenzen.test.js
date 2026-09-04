import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as termine from '../src/website/termine.js';

const oeffentlich = { id: 'public', titel: 'Schiri-Treff', datum: '2027-01-01', art: 'sonstiges', vergangen: false };
const intern = { id: 'intern', titel: 'Eigener Termin', datum: '2027-01-02', mein_status: null, vergangen: false };

test('öffentliche und eigene Termine vereinigen sich ohne Dubletten', () => {
  const ergebnis = termine.verbindeTerminSichten([oeffentlich], [{ ...oeffentlich, mein_status: 'zu' }, intern]);
  assert.equal(ergebnis.length, 2);
  assert.equal(ergebnis[0].mitgliedSicht, true);
  assert.equal(ergebnis[0].mein_status, 'zu');
  assert.equal(termine.verbindeTerminSichten([oeffentlich], [intern])[0].mitgliedSicht, false);
});

async function seite({ ich = { id: 'andere-person', pin: 'test' }, id = '', eigene = [intern] } = {}) {
  const aufrufe = [];
  const bereich = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const rpc = {
    alleOeffentlich: async () => [oeffentlich],
    alleFuerMitglied: async () => { aufrufe.push('eigene'); if (eigene instanceof Error) throw eigene; return eigene; },
    zusagen: async () => { aufrufe.push('zusagen'); return [{ name: 'Interner Name' }]; },
    terminfindungen: async () => [],
  };
  const kontext = vm.createContext({
    ...termine,
    erstelleTerminZugriff: () => rpc,
    DATENBANK: {}, VEREIN: { seitenschluessel: 'kickers' },
    document: { getElementById: () => bereich }, location: { search: id ? `?termin=${id}` : '' },
    URLSearchParams,
    SchiriSeitenAnmeldung: { anmeldung: { lesen: () => ich } },
  });
  const code = readFileSync(new URL('../src/website/termine-seite.js', import.meta.url), 'utf8')
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, '')
    .replace('void start();', 'globalThis.pruefen = start;');
  vm.runInContext(code, kontext);
  await kontext.pruefen();
  return { html: bereich.innerHTML, aufrufe };
}

test('anderer Verein sieht öffentliche Termine auch in der Liste', async () => {
  const { html } = await seite();
  assert.match(html, /Schiri-Treff/);
  assert.match(html, /Eigener Termin/);
  assert.match(html, /1 Termin wartet/); // nur eigener Termin, nicht der öffentliche
});

test('fremder öffentlicher Detailtermin lädt keine Teilnehmer und keine Antwortknöpfe', async () => {
  const { html, aufrufe } = await seite({ id: 'public' });
  assert.doesNotMatch(html, /data-status|Interner Name|data-kommentar/);
  assert.match(html, /Öffentlicher Termin eines anderen Vereins/);
  assert.ok(!aufrufe.includes('zusagen'));
});

test('eigener Detailtermin bleibt mit Teilnehmerliste und Rückmeldung bedienbar', async () => {
  const { html, aufrufe } = await seite({ id: 'intern' });
  assert.match(html, /data-status="zu"/);
  assert.match(html, /Interner Name/);
  assert.ok(aufrufe.includes('zusagen'));
});

test('ohne Anmeldung werden ausschließlich öffentliche Termine geladen', async () => {
  const { html, aufrufe } = await seite({ ich: null, id: 'public' });
  assert.match(html, /Schiri-Treff/);
  assert.doesNotMatch(html, /data-status/);
  assert.deepEqual(aufrufe, []);
});

test('defekte Anmeldung fällt auf öffentliche, nicht interne Details zurück', async () => {
  const { html, aufrufe } = await seite({ id: 'public', eigene: new Error('PIN abgelaufen') });
  assert.match(html, /Schiri-Treff/);
  assert.doesNotMatch(html, /data-status/);
  assert.ok(!aufrufe.includes('zusagen'));
});
