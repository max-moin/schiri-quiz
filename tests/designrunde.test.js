import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { tourRahmen } from '../src/ui/tour-position.js';
const lies = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Tourrahmen verwendet den sichtbaren Rest, nicht die gesamte Höhe des abgeschnittenen Ziels', () => {
  assert.deepEqual(tourRahmen({left:20, right:300, top:-100, bottom:100}, {width:390, height:700}),
    {left:15, top:6, width:290, height:99});
  assert.deepEqual(tourRahmen({left:0, right:1000, top:0, bottom:1000}, {width:320, height:600}),
    {left:6, top:6, width:308, height:588});
  assert.equal(tourRahmen({left:0,right:20,top:-100,bottom:-50}, {width:320,height:600}).height,0);
});
test('Tourrahmen berücksichtigt verschobenen visuellen Viewport', () => {
  assert.deepEqual(tourRahmen({left:0,right:400,top:50,bottom:800}, {width:320,height:500,offsetLeft:10,offsetTop:100}),
    {left:16,top:106,width:308,height:488});
});

function hilfe(hash = '') {
  const events = {};
  const elemente = Object.fromEntries(['hilfe-seitentitel','hilfe-einstieg','hilfe-uebersicht','dfbnet','sonderbericht','schiri-treff'].map(id => [id,{hidden:false,querySelector:()=>({focus(){}})}]));
  const ziel = {}; const back = {querySelector:()=>ziel, setAttribute(){}};
  const location = {hash};
  vm.runInNewContext(lies('src/website/hilfe-seite.js'), {
    location, document:{getElementById:id=>elemente[id],querySelector:s=>s==='main'?{scrollIntoView(){}}:back},
    window:{addEventListener:(name,fn)=>{events[name]=fn;}}
  });
  return {elemente,back,location,events};
}
test('Hilfe zeigt zunächst Übersicht, nicht alle Leitfäden darunter', () => {
  const h = hilfe();
  assert.equal(h.elemente['hilfe-uebersicht'].hidden,false);
  assert.equal(h.elemente.dfbnet.hidden,true);
  assert.equal(h.elemente.sonderbericht.hidden,true);
  assert.equal(h.back.href,'index.html');
});
test('Geteilter Sonderbericht-Link öffnet eigenen Bereich und führt zur Hilfe zurück', () => {
  const h = hilfe('#sonderbericht');
  assert.equal(h.elemente['hilfe-uebersicht'].hidden,true);
  assert.equal(h.elemente.sonderbericht.hidden,false);
  assert.equal(h.elemente.dfbnet.hidden,true);
  assert.equal(h.back.href,'hilfe.html');
  h.location.hash = '#unbekannt'; h.events.hashchange();
  assert.equal(h.elemente['hilfe-uebersicht'].hidden,false);
  assert.equal(h.elemente.sonderbericht.hidden,true);
});

function modus(ich, zaehler = async()=>({gesamt:5,offen:5,unbekannt:false}), dialogStatus = 'abgebrochen') {
  let callback; let person = ich;
  const events={},location={},dialogAufrufe=[];
  const bereich = {innerHTML:'',addEventListener(name,fn){events[name]=fn;}};
  vm.runInNewContext(lies('src/website/modus-seite.js').replace(/^import .*;\n/gm,''), {
    document:{getElementById:()=>bereich}, window:{addEventListener(){}}, location, DATENBANK:{},
    erstelleWochenZaehler:()=>zaehler,
    erstelleSzenarioZugriff:()=>({statistik:async()=>({szenarien_gesamt:0})}),
    SchiriSeitenAnmeldung:{anmeldung:{lesen:()=>person,abonniere:fn=>{callback=fn;fn();}},loginDialog:{oeffne:async options=>{dialogAufrufe.push(options);return {status:dialogStatus};}}}
  });
  return {bereich,location,dialogAufrufe,wechsel:p=>{person=p;callback();},klick:()=>events.click({target:{closest:()=>({})},button:0,preventDefault(){}})};
}
test('Ohne Sitzung bleibt die blaue Wochenrunde vor der nachgeordneten Gästealternative', async()=>{
  const m=modus(null);await tick();
  assert.ok(m.bereich.innerHTML.indexOf('modus-wochenquiz')<m.bereich.innerHTML.indexOf('modus-gastalternative'));
  assert.match(m.bereich.innerHTML,/modus-wochenquiz hervorgehoben" href="quiz.html"/);
  await m.klick();assert.equal(m.dialogAufrufe.length,1);assert.equal(m.location.href,undefined);
});
test('Erfolgreiche Anmeldung führt zu Wochenfragen, Gast nur nach expliziter Wahl',async()=>{
  const m=modus(null,undefined,'angemeldet');await m.klick();assert.equal(m.location.href,'quiz.html');
  const g=modus(null,undefined,'gast');await g.klick();assert.equal(g.location.href,'quiz.html#gast');
});
test('Gespeicherte Sitzung öffnet nicht erneut das Anmeldefenster',async()=>{
  const m=modus({id:'test'});await m.klick();assert.equal(m.dialogAufrufe.length,0);
});
test('Kompakte Quiz-Auswahl behält Üben-Sperre und Fortschritt ohne leeren Entscheidungsmodus', async () => {
  const m = modus({id:'test'}); await tick();
  assert.match(m.bereich.innerHTML,/0 von 5 beantwortet/);
  assert.match(m.bereich.innerHTML,/<div class="modus-kachel gesperrt"/);
  assert.match(m.bereich.innerHTML,/aria-disabled="true"/);
  assert.doesNotMatch(m.bereich.innerHTML,/unter zwei Minuten/);
  assert.match(m.bereich.innerHTML,/modus-symbol/);
});
test('Fertige Wochenrunde schaltet Üben weiterhin frei', async () => {
  const m = modus({id:'test'}, async()=>({gesamt:5,offen:0,unbekannt:false})); await tick();
  assert.match(m.bereich.innerHTML,/href="quiz.html#ueben"/);
  assert.match(m.bereich.innerHTML,/Antworten ansehen/);
});
test('Verspätete Quizstatistik darf ausgeloggten Gast nicht überschreiben', async () => {
  let fertig;
  const m = modus({id:'test'}, ()=>new Promise(r=>{fertig=r;}));
  m.wechsel(null); fertig({gesamt:5,offen:0,unbekannt:false}); await tick();
  assert.match(m.bereich.innerHTML,/Gästequiz ausprobieren/);
  assert.match(m.bereich.innerHTML,/Anmelden & starten/);
  assert.doesNotMatch(m.bereich.innerHTML,/Antworten ansehen/);
});
