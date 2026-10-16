import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { berechneWochenserie } from '../src/website/wochenserie.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Vorschlagskennzeichnung ist freiwillig, getrennt und an die Gruppe gebunden',()=>{
 const html=lies('frage-vorschlagen.html'),js=lies('src/website/frage-vorschlagen.js');
 assert.match(html,/id="herkunft-gruppe"/);assert.match(html,/id="herkunft-name" disabled/);
 assert.doesNotMatch(html,/<input[^>]*id="herkunft-[^"]+"[^>]*checked/);
 assert.match(js,/herkunft_name:\$\("herkunft-gruppe"\)\.checked&&/);
 assert.match(js,/x.herkunft_gruppe===true/);assert.match(js,/herkunftAktualisieren\(\)/);
});
test('Joker rettet nur die private Serie, nicht den Quizabschluss',()=>{
 const w={runde_id:'test',bezeichnung:'Woche',startet_am:'2026-10-01T00:00Z',endet_am:'2026-10-08T00:00Z',retten_bis:'2026-10-15T00:00Z',fragen_gesamt:5,beantwortet:2,uebung_richtig:0,joker_gerettet:true};
 const s=berechneWochenserie({jetzt:'2026-10-20T00:00Z',wochen:[w]});
 assert.equal(s.serie,1);assert.equal(s.gerettet,1);assert.equal(s.abgeschlossen,0);assert.equal(w.beantwortet,2);
 assert.equal(s.wochen[0].status,'gerettet');
});
test('String statt serverseitigem Joker-Boolean gewährt keinen Erfolg',()=>{
 const w={runde_id:'x',startet_am:'2026-10-01',endet_am:'2026-10-08',retten_bis:'2026-10-15',fragen_gesamt:5,beantwortet:0,uebung_richtig:0,joker_gerettet:'true'};
 assert.equal(berechneWochenserie({jetzt:'2026-10-20',wochen:[w]}).gerettet,0);
});
test('Quiz verwendet ausschließlich sichere Textausgabe für Urheberschaft',()=>{
 const js=lies('src/ui/question-elements.js');assert.match(js,/beitrag.textContent = frage.herkunft/);
 assert.doesNotMatch(js,/beitrag.innerHTML/);
 const w=lies('src/features/weekly-quiz.js');assert.match(w,/schiri_fragen_herkunft/);assert.match(w,/Kennzeichnung ist optional/);
});
