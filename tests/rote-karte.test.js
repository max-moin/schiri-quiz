import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PHASEN, phaseFuerAnker, montiereRoteKarte } from '../src/website/rote-karte.js';
import { BAUM } from '../src/ui/wegweiser.js';
const lies = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('Guide verknüpft drei Phasen und unveränderte Nummern 0–7',()=>{
 const h=lies('rote-karte.html');
 for(const id of PHASEN) assert.ok(h.includes(`id="${id}"`));
 assert.deepEqual([...h.matchAll(/class="rk-nummer"[^>]*>(\d+)</g)].map(m=>Number(m[1])),[0,1,2,3,4,5,6,7]);
 assert.equal(phaseFuerAnker(''),'im-spiel');
 assert.equal(phaseFuerAnker('#sonderbericht-schreiben'),'nach-dem-spiel');
 assert.equal(phaseFuerAnker('#vor-dem-spiel'),'vor-dem-spiel');
 assert.equal(phaseFuerAnker('#unbekannt'),'im-spiel');
});
test('Vollständiges Muster mit Kontext, Alternativtext und proportionaler Bildhöhe',()=>{
 const h=lies('rote-karte.html'),css=lies('stil/rote-karte.css');
 assert.ok(existsSync(new URL('../bilder/dfbnet-strafen-muster.png',import.meta.url)));
 assert.match(h,/Vollständiges anonymes DFBnet-Muster mit Überschrift Strafen für Spieler/);
 assert.match(css,/\.rk-muster img[^}]*height:auto/);
 assert.doesNotMatch(css,/object-fit:\s*cover/);
 assert.match(h,/Bild größer öffnen/);
});
test('Sicherheit offen sichtbar, zusätzliche Details sichtbar beschriftet',()=>{
 const h=lies('rote-karte.html');
 assert.match(h,/<aside class="rk-sicherheit"[\s\S]*?Angriff auf das SR-Team/);
 assert.match(h,/Schreibhilfe & Beispiel ansehen/);
 assert.match(h,/erfundenes Beispiel/);
 assert.match(h,/Keine Empfänger auf Verdacht/);
 assert.doesNotMatch(h,/48\s*(?:h|Stunden)/);
 assert.match(h,/Empfehlung: innerhalb von 24 Stunden/);
});
test('Originalquellen und Einstiege bleiben erreichbar',()=>{
 const h=lies('rote-karte.html');
 for(const url of ['portal.dfbnet.org/de/service/handbuecher/spielbericht','svf-dresden.de/dokumente/sonderbericht/','svf-dresden.de/dokumente/dfbnet-anleitung-fuer-schiedsrichter/','svf-dresden.de/dokumente/handreichung-wiedereinwechslungen-im-spielbericht/','sfv-online.de/vereinsservice/downloads']) assert.ok(h.includes(url));
 for(const m of h.matchAll(/(?:href|src)="([^"#:]+\.(?:html|js|css|png))"/g)) assert.ok(existsSync(new URL('../'+m[1],import.meta.url)),m[1]);
 assert.match(lies('hilfe.html'),/href="rote-karte.html"/);
 assert.equal(BAUM['rote-karte.html'].eltern,'dfbnet.html');
});
test('Ansichtswechsel ist lokal, öffnet nicht alle Details und springt nicht beim Scrollen',()=>{
 const mk=(dataset={})=>({dataset,events:{},hidden:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(t,fn){this.events[t]=fn;}});
 const panels=PHASEN.map(id=>({...mk(),id})),buttons=PHASEN.map(id=>mk({rkPhase:id})),views=['kurz','erklaert'].map(v=>mk({rkAnsicht:v})),tools=mk(),root=mk({ansicht:'kurz'}),win=mk();
 root.querySelectorAll=s=>s==='[data-rk-panel]'?panels:s==='[data-rk-phase]'?buttons:views;
 root.querySelector=()=>tools;
 const calls=[];montiereRoteKarte(root,{hash:''},{replaceState(...a){calls.push(a);}},win);
 assert.deepEqual(panels.map(p=>p.hidden),[true,false,true]);
 buttons[2].events.click();assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
 views[1].events.click();assert.equal(root.dataset.ansicht,'erklaert');assert.equal(views[1].attrs['aria-pressed'],'true');
 assert.equal(calls[0][2],'#nach-dem-spiel');
 assert.equal(win.events.scroll,undefined);
 assert.doesNotMatch(lies('src/website/rote-karte.js'),/fetch\(|localStorage|scrollIntoView|\.open\s*=/);
});
test('Nach Editor-Neuzeichnen wird jede Phase nur einmal bedient',()=>{
 const mk=dataset=>{const e=new EventTarget();e.dataset=dataset||{};e.hidden=false;e.setAttribute=()=>{};return e;};
 const panels=PHASEN.map(id=>Object.assign(mk(),{id})),buttons=PHASEN.map(id=>mk({rkPhase:id})),views=['kurz','erklaert'].map(v=>mk({rkAnsicht:v})),tools=mk(),root=mk({ansicht:'kurz'}),win=mk();
 root.querySelectorAll=s=>s==='[data-rk-panel]'?panels:s==='[data-rk-phase]'?buttons:views;root.querySelector=()=>tools;
 const calls=[],history={replaceState(...a){calls.push(a);}};
 montiereRoteKarte(root,{hash:''},history,win);
 const stop=montiereRoteKarte(root,{hash:''},history,win);
 buttons[2].dispatchEvent(new Event('click'));
 assert.equal(calls.length,1);assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
 stop();buttons[0].dispatchEvent(new Event('click'));assert.equal(calls.length,1);
});
