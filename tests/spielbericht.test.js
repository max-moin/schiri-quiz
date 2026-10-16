import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ABSCHNITTE, abschnittFuerAnker, montiereSpielbericht } from '../src/website/spielbericht.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=lies('spielbericht.html');
test('Spielbericht enthält die vollständige Folge 0 bis 14 genau einmal',()=>{
 assert.deepEqual([...html.matchAll(/data-sb-inhalt="schritt-(\d+)"/g)].map(x=>Number(x[1])),Array.from({length:15},(_,i)=>i));
 for(const titel of ['Spielleitung','Ergebnis','Spielzeit','Kontrollen','Schiedsrichterkosten','Zuschaueranzahl','Bemerkungen','Ein- und Auswechslungen','Strafen für Spieler','Strafen für Teamoffizielle','Vorkommnisse &amp; STOPP']){
  assert.ok(html.includes(titel.replace('&amp;','&')),titel);
 }
 assert.ok(html.indexOf('schritt-12')<html.indexOf('schritt-13'));
});
test('Wiedereinwechslung ist begrenzt, Altquellen und offene Klickwege bleiben erkennbar',()=>{
 assert.match(html,/Nur in den dafür eingerichteten Wettbewerben/);
 assert.match(html,/erste Einwechselminute/);assert.match(html,/Ausgewechselte Person dort nicht angeben/);
 assert.match(html,/Bildschirmbeispiele von 2009/);assert.match(html,/kein aktueller|nicht als aktueller Klickplan/);
 assert.match(html,/keine DFBnet-Eingabemaske/);assert.match(html,/Empfänger-Klickweg bleibt ein Prüfpunkt/);
 assert.doesNotMatch(html,/48\s*Stunden|alle vier Empfänger|immer Nein/);
});
test('Anker auf Unterpunkte wählen das passende Panel, fremde Anker bleiben neutral',()=>{
 const w={querySelectorAll:()=>ABSCHNITTE.map(id=>({id,querySelectorAll:()=>id==='erfassen'?[{id:'wechsel'},{id:'strafen'}]:[]}))};
 assert.equal(abschnittFuerAnker(w,'#wechsel'),'erfassen');assert.equal(abschnittFuerAnker(w,'#abschliessen'),'abschliessen');
 assert.equal(abschnittFuerAnker(w,'#inhalt'),'erfassen');assert.equal(abschnittFuerAnker(w,''),'erfassen');
});
test('Navigation, Quellen und Seitenhilfe führen in die echte neue Seite',()=>{
 assert.match(lies('hilfe.html'),/href="spielbericht.html"/);
 assert.match(lies('src/ui/wegweiser.js'),/"spielbericht.html"/);
 assert.match(lies('src/website/hilfe-inhalte.js'),/'spielbericht.html'/);
 assert.match(html,/handreichung-wiedereinwechslungen-im-spielbericht/);
 assert.match(html,/rote-karte.html#nach-dem-spiel/);assert.match(html,/Schiedsrichterordnung.pdf/);
 assert.match(html,/aria-label="Textumfang"/);assert.match(html,/data-ansicht="kurz"/);
});
test('Feste Redaktion nutzt bestehende Rechte und getrennte Veröffentlichung',()=>{
 const js=lies('src/website/spielbericht-redaktion.js');
 assert.match(js,/seite:'spielbericht'/);assert.match(js,/kennung = 'spielbericht-v1'/);
 assert.match(js,/festeStruktur:true/);assert.match(js,/pruefeBlockseite/);assert.match(js,/sichereBlockURL/);
 assert.doesNotMatch(js,/innerHTML\s*=|eval\(|service_role|signInWithPassword/);
 assert.match(js,/\.seiten-werkzeuge,\.wegweiser/);
 const ids=[...html.matchAll(/data-sb-inhalt="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length<=60);
 const sql=lies('supabase/migrations/20261016175530_spielbericht_blockredaktion.sql');
 assert.match(sql,/'spielbericht'/);assert.match(sql,/'aal2'/);assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/seitenschluessel=p_seitenschluessel/);assert.match(sql,/revoke all on function private\.blockredaktion_pruefen/);
 assert.doesNotMatch(sql,/insert into public\.website_blockseiten|update public\.website_blockseiten|grant .*entwurf/);
});
test('Lange Fußlinks können bei vergrößerter Schrift umbrechen',()=>{
 const css=lies('stil/kopf-fuss.css');assert.match(css,/max-width: 100%; white-space: normal; overflow-wrap: anywhere/);
});
test('Wiederholte Redaktion verdoppelt keine Phasen- oder Fensterlistener',()=>{
 const mk=dataset=>{const n=new EventTarget();n.dataset=dataset||{};n.hidden=false;n.attrs={};n.setAttribute=(k,v)=>n.attrs[k]=v;return n;};
 const panels=ABSCHNITTE.map(id=>Object.assign(mk(),{id,querySelectorAll:()=>[]})),buttons=ABSCHNITTE.map(id=>mk({sbPhase:id})),views=['kurz','erklaert'].map(id=>mk({sbAnsicht:id})),tools=mk(),root=mk({ansicht:'kurz'}),win=mk();
 root.querySelectorAll=s=>s==='[data-sb-panel]'?panels:s==='[data-sb-phase]'?buttons:s==='[data-sb-ansicht]'?views:panels;
 root.querySelector=()=>tools;
 const calls=[],history={replaceState(...a){calls.push(a);}},ort={hash:''};
 montiereSpielbericht(root,ort,history,win);const stop=montiereSpielbericht(root,ort,history,win);
 buttons[2].dispatchEvent(new Event('click'));assert.equal(calls.length,1);assert.deepEqual(panels.map(p=>p.hidden),[true,true,false]);
 views[1].dispatchEvent(new Event('click'));assert.equal(root.dataset.ansicht,'erklaert');
 ort.hash='#vorbereiten';win.dispatchEvent(new Event('hashchange'));assert.deepEqual(panels.map(p=>p.hidden),[false,true,true]);
 stop();buttons[1].dispatchEvent(new Event('click'));assert.equal(calls.length,1);
});
