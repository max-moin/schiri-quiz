import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {zeichneJokerVorrat} from '../src/website/joker-vorrat.js';
class E{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.events={};this.dataset={};this.textContent='';}
 append(...e){this.children.push(...e);}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.events[k]=f;}
 replaceChildren(...e){this.children=e;}showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}
 get text(){return this.textContent+' '+this.children.map(x=>x.text).join(' ');}
}
const doc={createElement:tag=>new E(tag)};
const alle=(e,filter)=>[...(filter(e)?[e]:[]),...e.children.flatMap(c=>alle(c,filter))];
test('Leerer Vorrat: sieben graue anklickbare Typen und keine Besitz-Zahl',()=>{
 const e=zeichneJokerVorrat(doc,{joker:[]});assert.equal(alle(e,x=>x.className?.includes('joker-leer')).length,7);assert.equal(alle(e,x=>x.className==='joker-anzahl').length,0);assert.match(e.text,/Noch kein Joker/);
 alle(e,x=>x.title?.startsWith('Serienjoker'))[0].events.click();assert.match(e.text,/Einmal verwendbar, ohne Ablaufdatum/);
});
test('Nur tatsächlicher Bestand erhält eine Zahl, auch leere Quizjoker erklären ihre Wirkung',()=>{
 const e=zeichneJokerVorrat(doc,{joker:[{jahr:2025},{jahr:2026}]});const badges=alle(e,x=>x.className==='joker-anzahl');assert.equal(badges.length,1);assert.equal(badges[0].textContent,'2');assert.equal(alle(e,x=>x.className?.includes('joker-leer')).length,6);
 alle(e,x=>x.title?.startsWith('50/50'))[0].events.click();assert.match(e.text,/Vor deiner ersten Antwort einsetzen/);assert.doesNotMatch(e.text,/Noch nicht einlösbar/);
});
test('Info erklärt drei echte Vergabewege, Zufallsbox und unbegrenzte Gültigkeit',()=>{
 const e=zeichneJokerVorrat(doc,{});alle(e,x=>x.className==='joker-info')[0].events.click();assert.match(e.text,/Geburtstag → 1 Box/);assert.match(e.text,/4 vollständige Quizwochen → 1 Box/);assert.match(e.text,/90 % Zweiter Versuch, 10 % Serien-Retter/);assert.match(e.text,/vorhandene bleiben nutzbar/);assert.match(e.text,/verfallen nicht/);
});
test('Boxen und alle drei Jokerbestände stammen ausschließlich aus Serverdaten',()=>{
 const e=zeichneJokerVorrat(doc,{belohnungen:{bestand:{serienjoker:0,halbhalb:3,'zweiter-versuch':1},boxen:[{id:'echte-box',quelle:'Geburtstag'}]}});
 assert.deepEqual(alle(e,x=>x.className==='joker-anzahl').map(x=>x.textContent),['3','1']);
 assert.equal(alle(e,x=>x.className==='joker-box-knopf')[0].dataset.jokerBox,'echte-box');assert.match(e.text,/1 Box · Öffnen/);
});
test('Sammlung ist eigener Quizbereich statt Teil der Ergebnisstatistik',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');assert.match(read('sammlung.html'),/src\/website\/sammlung-seite.js/);assert.match(read('sammlung.html'),/id="meine-wochenserie"/);assert.match(read('meine-statistik.html'),/id="meine-wochenserie"/);assert.match(read('src/website/modus-seite.js'),/href="sammlung.html"/);assert.match(read('src/website/meine-statistik-seite.js'),/bereich:'serie'/);assert.match(read('src/website/sammlung-seite.js'),/bereich:'sammlung'/);
});
