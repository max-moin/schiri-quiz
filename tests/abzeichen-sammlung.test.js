import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {berechneWochenserie} from '../src/website/wochenserie.js';
const tag=86400000,start=Date.parse('2026-01-05T00:00:00Z');
const w=(i,n=5,u=0,j=false)=>({runde_id:`r${i}`,bezeichnung:`Woche ${i}`,startet_am:new Date(start+i*7*tag).toISOString(),endet_am:new Date(start+(i+1)*7*tag).toISOString(),retten_bis:new Date(start+(i+2)*7*tag).toISOString(),fragen_gesamt:5,beantwortet:n,uebung_richtig:u,joker_gerettet:j});
const s=a=>berechneWochenserie({jetzt:new Date(start+200*tag).toISOString(),wochen:a});
test('Acht stabile private Abzeichen mit echten lokal gespeicherten Bildmotiven',()=>{
 const b=s([]).abzeichen;assert.equal(b.length,8);assert.equal(new Set(b.map(x=>x.id)).size,8);
 for(const x of b){assert.equal(x.verdient,false);assert.equal(x.stand,0);const bild=readFileSync(new URL(`../bilder/abzeichen/${x.id}.webp`,import.meta.url));assert.equal(bild.subarray(8,12).toString(),'WEBP');const original=readFileSync(new URL(`../bilder/abzeichen/originale/${x.id}.png`,import.meta.url));assert.deepEqual([...original.subarray(0,8)],[137,80,78,71,13,10,26,10]);}
});
test('Teilnahmeziele sind exakt, nicht aus Trefferquoten erfunden',()=>{
 for(const n of [1,4,5,9,10,24,25]){
  const b=s(Array.from({length:n},(_,i)=>w(i))).abzeichen;
  for(const x of b.filter(x=>x.art==='teilnahme'))assert.equal(x.verdient,n>=x.ziel);
 }
});
test('Gerettete Woche erhöht keine Teilnahmezahl, zählt aber für Serie und Rückkehr',()=>{
 const a=s([w(0),w(1,0,0,true),w(2),w(3)]);
 assert.equal(a.abgeschlossen,3);assert.equal(a.beste,4);assert.equal(a.abzeichen.find(x=>x.id==='wieder-da').verdient,true);
 assert.equal(a.abzeichen.find(x=>x.id==='vier-wochen').verdient,true);
 assert.equal(a.abzeichen.find(x=>x.id==='fuenf-wochen').stand,3);
});
test('Lücke löscht keinen bereits erreichten Serienmeilenstein',()=>{
 const a=s([...Array.from({length:12},(_,i)=>w(i)),w(12,0),w(13)]);
 assert.equal(a.serie,1);assert.equal(a.abzeichen.find(x=>x.id==='zwoelf-wochen').verdient,true);
});
test('Sammlung hat Bildknöpfe ohne Pfeil oder Bildunterschrift und einen nativen Dialog',()=>{
 const js=readFileSync(new URL('../src/website/abzeichen-sammlung.js',import.meta.url),'utf8');
 assert.match(js,/'dialog'/);assert.match(js,/showModal\(\)/);assert.match(js,/aria-label/);assert.match(js,/'progress'/);assert.match(js,/aria-haspopup/);
 assert.doesNotMatch(js,/'summary'|'details'|Details \+|abzeichen-name/);
 assert.doesNotMatch(js,/innerHTML|localStorage|\.rpc\(|\.insert\(|\.update\(/);
});
test('Neue Bildsammlung lädt eine eigene Stylesheet-Datei und dokumentiert KI ohne Laufzeitdienst',()=>{
 const html=readFileSync(new URL('../meine-statistik.html',import.meta.url),'utf8');assert.match(html,/stil\/abzeichen-sammlung.css/);
 const css=readFileSync(new URL('../stil/abzeichen-sammlung.css',import.meta.url),'utf8');assert.match(css,/grayscale\(1\)/);assert.match(css,/focus-visible/);
 const hinweis=readFileSync(new URL('../impressum.html',import.meta.url),'utf8');assert.match(hinweis,/id="ki-bilder"/);assert.match(hinweis,/kein Bildgenerierungsdienst/);
});
