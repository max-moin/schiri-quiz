import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCKTYPEN, neuerBlock, sichereBlockURL, pruefeBlockseite } from '../src/website/block-inhalte.js';
import { erstelleBlockseitenSpeicher } from '../src/admin/blockseiten-store.js';

const seite = (...bloecke) => ({ version: 1, bloecke });
test('Blockpilot akzeptiert vollständige typisierte Inhalte und Grenzen', () => {
  for (const typ of Object.keys(BLOCKTYPEN)) {
    const b = { ...neuerBlock(typ), text: 'Hinweis', url: 'https://example.org/quelle', alt: 'Bildbeschreibung', stand: '2026-10-14' };
    if (b.eintraege.length) b.eintraege[0].text = 'Prüfen';
    assert.deepEqual(pruefeBlockseite(seite(b)), [], typ);
  }
  assert.ok(pruefeBlockseite(seite()).length);
  const b = { ...neuerBlock(), text: 'x' };
  assert.ok(pruefeBlockseite(seite(b, b)).length, 'Doppelte Kennungen');
  assert.ok(pruefeBlockseite(seite({ ...b, text: 'x'.repeat(12001) })).length);
});
test('URLs schließen Skripte, fremde Protokolle und versteckte Hosts aus', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,x', '//example.org', 'https://user:pw@example.org', '../intern', 'https://a\n.example', 'https:\\example.org']) assert.equal(sichereBlockURL(url), null, url);
  for (const url of ['https://example.org/a.pdf', 'vorlagen.html', '#sonderbericht', 'tel:+49123456789']) assert.ok(sichereBlockURL(url), url);
  assert.equal(sichereBlockURL('tel:+49123456789', true), null);
});
test('Bilder und Screenshot-Schritte verlangen Bildbeschreibungen', () => {
  assert.ok(pruefeBlockseite(seite({ ...neuerBlock('bild'), url: 'https://example.org/bild.png' })).length);
  const b = neuerBlock('schritte'); b.eintraege = [{ text: 'Schritt', url: 'https://example.org/bild.png' }];
  assert.ok(pruefeBlockseite(seite(b)).length);
  b.eintraege[0].alt = 'Anonymisierte Menüansicht';
  assert.deepEqual(pruefeBlockseite(seite(b)), []);
});
test('Entwurf und Veröffentlichung sind getrennt und senden die Revision', async () => {
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { revision: 2 } }; } };
  const store = erstelleBlockseitenSpeicher(client, 'test-verein', 'dfbnet');
  const b = { ...neuerBlock(), text: 'Entwurf' };
  await store.speichern(seite(b), 1);
  assert.equal(calls[0].args.p_veroeffentlichen, false);
  assert.equal(calls[0].args.p_revision, 1);
  await store.speichern(seite(b), 2, true);
  assert.equal(calls[1].args.p_veroeffentlichen, true);
});
test('Serverkonflikt überschreibt nichts und bleibt verständlich', async () => {
  const store = erstelleBlockseitenSpeicher({ rpc: async () => ({ error: { message: 'Anderes Gerät: neu laden.' } }) }, 'test-verein', 'dfbnet');
  await assert.rejects(store.speichern(seite({ ...neuerBlock(), text: 'x' }), 2), /Anderes Gerät/);
});
test('Renderer benutzt Textknoten statt eingeschleustes HTML und Tastaturbedienung bleibt möglich', () => {
  const renderer = readFileSync(new URL('../src/website/block-inhalte.js', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /innerHTML\s*=/);
  const editor = readFileSync(new URL('../src/admin/blockeditor.js', import.meta.url), 'utf8');
  for (const label of ['Nach oben', 'Nach unten', 'Entwurf speichern', 'Veröffentlichen', 'Quellenstand']) assert.ok(editor.includes(label));
  assert.match(editor, /showModal/);
  assert.match(editor, /SIGNED_OUT/);
});
test('Spesen starten als Übersicht; Freischaltung wird nicht umgangen', () => {
  const html = readFileSync(new URL('../spesenrechner.html', import.meta.url), 'utf8');
  assert.match(html, /id="spesenWerkzeug" hidden/);
  assert.match(html, /id="spesenUebersicht"/);
  assert.match(html, /data-funktionsinhalt="spesen" hidden/);
});
