import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../hilfe.html', import.meta.url), 'utf8');
const praxis = html.match(/<section class="hilfe-themenbereich hilfe-praxis"[\s\S]*?<\/section>/)?.[0];

test('Hilfe bietet drei offizielle Praxislinks ohne neue Regelantworten', () => {
  assert.ok(praxis);
  for (const slug of ['spielvorbereitung', 'warm-up', 'fitness']) {
    assert.ok(praxis.includes(`https://www.meinfussball.de/schiris/aktive/${slug}`));
  }
  assert.equal((praxis.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 3);
  assert.match(praxis, /neuen Tab/);
  assert.doesNotMatch(praxis, /regel-ecke|patensystem|iframe|<video|Luca|RBC/);
});

test('Praxislinks bleiben Teil der Übersicht und bestehende DFBnet-Detailwege bleiben erhalten', () => {
  assert.ok(html.indexOf('hilfe-praxis-titel') > html.indexOf('id="hilfe-uebersicht"'));
  assert.ok(html.indexOf('hilfe-praxis-titel') < html.indexOf('id="dfbnet"'));
  for (const page of ['spielbericht.html', 'rote-karte.html', 'sperrtermine.html']) {
    assert.ok(html.includes(`href="${page}"`));
  }
});
