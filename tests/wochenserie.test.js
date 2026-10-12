import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { berechneWochenserie } from '../src/website/wochenserie.js';
const tag=24*60*60*1000;
const beginn=Date.parse('2026-09-07T00:00:00+02:00');
const woche=(n,beantwortet=5,uebung=0)=>({runde_id:`w${n}`,bezeichnung:`Woche ${n}`,startet_am:new Date(beginn+n*7*tag).toISOString(),endet_am:new Date(beginn+(n+1)*7*tag).toISOString(),retten_bis:new Date(beginn+(n+2)*7*tag).toISOString(),fragen_gesamt:5,beantwortet,uebung_richtig:uebung});
const stand=(wochen,jetzt=beginn+31*tag)=>berechneWochenserie({jetzt:new Date(jetzt).toISOString(),wochen});
test('Leerer Vereinsquizstand erfindet keine Serie oder Abzeichen',()=>{
  const s=stand([]);assert.equal(s.serie,0);assert.equal(s.beste,0);assert.equal(s.aktuell,null);
  assert.ok(s.abzeichen.every(b=>!b.verdient));
});
test('Nur vollständige Wochen zählen; Trefferquote und falsche Antworten sind unerheblich',()=>{
  const s=stand([woche(0),woche(1),woche(2),woche(3)]);
  assert.equal(s.serie,4);assert.equal(s.beste,4);assert.equal(s.abgeschlossen,4);
  assert.equal(s.abzeichen.find(b=>b.id==='vier-wochen').verdient,true);
});
test('Laufende unvollständige Woche unterbricht die bestehende Serie nicht',()=>{
  const s=stand([woche(0),woche(1),woche(2),woche(3,2)],beginn+24*tag);
  assert.equal(s.serie,3);assert.equal(s.aktuell.status,'offen');assert.equal(s.rettungen.length,0);
});
test('Eine abgelaufene Lücke bricht die Serie, lässt aber längste Serie und erreichte Meilensteine stehen',()=>{
  const s=stand([woche(0),woche(1),woche(2,2),woche(3)]);
  assert.equal(s.serie,1);assert.equal(s.beste,2);
  assert.equal(s.wochen[2].status,'verpasst');
});
test('Rettung braucht fünf verschiedene richtige Übungen, vier reichen nicht',()=>{
  const s=stand([woche(0),woche(1),woche(2,2,4),woche(3,0)],beginn+24*tag);
  assert.equal(s.rettungen[0].fehlen,1);assert.equal(s.rettungen[0].serieDavor,2);
  assert.equal(s.gerettet,0);assert.equal(s.abzeichen.find(b=>b.id==='wieder-da').verdient,false);
  const fertig=stand([woche(0),woche(1),woche(2,2,5),woche(3,0)],beginn+24*tag);
  assert.equal(fertig.serie,3);assert.equal(fertig.gerettet,1);assert.equal(fertig.abgeschlossen,2);
  assert.equal(fertig.wochen[2].beantwortet,2); // Kein nachträglicher Quizabschluss.
});
test('Historische Rettungen bleiben nach Ende des Fensters erkennbar',()=>{
  const s=stand([woche(0),woche(1,0,5),woche(2)],beginn+50*tag);
  assert.equal(s.serie,3);assert.equal(s.gerettet,1);assert.equal(s.rettungen.length,0);
});
test('Leere Quizwochen werden übersprungen; kein künstlicher Serienbruch',()=>{
  const leer={...woche(1,0),fragen_gesamt:0};
  const s=stand([woche(0),leer,woche(2)]);
  assert.equal(s.serie,2);assert.equal(s.wochen.length,2);
});
test('Offene Nachbesserung bleibt unvollständig; aktuelle Woche zählt erst nach Abschluss',()=>{
  const s=stand([woche(0),woche(1,4)],beginn+9*tag);
  assert.equal(s.serie,1);assert.equal(s.abgeschlossen,1);
});
test('Serverzeit und halb offene Fristen gelten genau an der Grenze',()=>{
  const s=stand([woche(0,0,4)],beginn+14*tag);
  assert.equal(s.wochen[0].status,'verpasst');assert.equal(s.rettungen.length,0);
});
test('Daten werden sortiert und nicht am Originalobjekt verändert',()=>{
  const a=woche(0),b=woche(1);const s=stand([b,a]);
  assert.deepEqual(s.wochen.map(w=>w.runde_id),['w0','w1']);assert.equal(a.status,undefined);
});
test('Ungültige Werte, doppelte Runden und Zukunftsdaten werden nicht als Erfolge ausgegeben',()=>{
  for(const w of [{...woche(0),beantwortet:-1},{...woche(0),fragen_gesamt:'5'},woche(10)])assert.throws(()=>stand([w]),/Ungültige/);
  assert.throws(()=>stand([woche(0),woche(0)]),/Ungültige/);
  assert.throws(()=>berechneWochenserie({jetzt:'kaputt',wochen:[]}),/Ungültiger/);
});
test('Serienoberfläche schreibt keine Antwortdaten und enthält keine öffentlichen Vergleichswerte',()=>{
  const js=readFileSync(new URL('../src/website/wochenserie-ansicht.js',import.meta.url),'utf8');
  assert.match(js,/meine_wochenserie_basis/);assert.doesNotMatch(js,/\.innerHTML|\.insert\(|\.update\(|obmann_|localStorage/);
  assert.match(js,/lauf!==version/);assert.match(js,/aktuell\?\.id!==person.id/);
  assert.match(js,/quiz.html#ueben/);assert.match(js,/aria-label/);assert.match(js,/textContent/);
});
