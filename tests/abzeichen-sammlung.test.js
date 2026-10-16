import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {berechneWochenserie} from '../src/website/wochenserie.js';
const tag=86400000,start=Date.parse('2026-01-05T00:00:00Z');
const w=(i,n=5,u=0,j=false)=>({runde_id:`r${i}`,bezeichnung:`Woche ${i}`,startet_am:new Date(start+i*7*tag).toISOString(),endet_am:new Date(start+(i+1)*7*tag).toISOString(),retten_bis:new Date(start+(i+2)*7*tag).toISOString(),fragen_gesamt:5,beantwortet:n,uebung_richtig:u,joker_gerettet:j});
const s=a=>berechneWochenserie({jetzt:new Date(start+200*tag).toISOString(),wochen:a});
test('Acht stabile private Abzeichen mit eigenen Vektormotiven',()=>{
 const b=s([]).abzeichen;assert.equal(b.length,8);assert.equal(new Set(b.map(x=>x.id)).size,8);
 for(const x of b){assert.equal(x.verdient,false);assert.equal(x.stand,0);const svg=readFileSync(new URL(`../bilder/abzeichen/${x.id}.svg`,import.meta.url),'utf8');assert.match(svg,/<svg/);assert.match(svg,/<path/);assert.doesNotMatch(svg,/<script|<image|onload=/);}
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
test('Sammlung nutzt native zugängliche Details und schreibt keine Erfolge',()=>{
 const js=readFileSync(new URL('../src/website/abzeichen-sammlung.js',import.meta.url),'utf8');
 assert.match(js,/'details'/);assert.match(js,/'summary'/);assert.match(js,/'progress'/);
 assert.doesNotMatch(js,/innerHTML|localStorage|\.rpc\(|\.insert\(|\.update\(/);
});
