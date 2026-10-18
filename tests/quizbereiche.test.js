import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wochenAnteile,zeichneFragenStatus} from '../src/website/quiz-statistik-fragen.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Wochenbalken bildet richtig, offene Rückfrage, falsch und unbeantwortet ab',()=>{
 assert.deepEqual(wochenAnteile({fragen_gesamt:5,richtig:1,nachbessern:1,falsch:2}),{gesamt:5,richtig:1,nachbessern:1,falsch:2,offen:1});
 assert.deepEqual(wochenAnteile({fragen_gesamt:0,richtig:7,nachbessern:-3,falsch:NaN}),{gesamt:0,richtig:0,nachbessern:0,falsch:0,offen:0});
 assert.equal(Object.values(wochenAnteile({fragen_gesamt:5,richtig:8,nachbessern:3,falsch:2})).slice(1).reduce((a,b)=>a+b,0),5);
});
test('Fragenübersicht zeigt keine Antworten/Interna und behandelt Text als Text',()=>{
 const doc={createElement(tag){return {tag,children:[],textContent:'',append(...kids){this.children.push(...kids);}};}};
 const e=zeichneFragenStatus(doc,[{medium:'video',frage_text:'Interner Max-Titel',status:'richtig',musterantwort:'Geheim'},
  {medium:'text',frage_text:'<script>Test</script>',status:'falsch',antwort:'Nicht zeigen'},
  {medium:'bild',frage_text:'Nicht zeigen',status:'offen'}]);
 assert.equal(e.children[0].children[0].textContent,'Video-Frage');
 assert.equal(e.children[1].children[0].textContent,'<script>Test</script>');
 assert.equal(e.children[2].children[0].textContent,'Bild-Frage');
 assert.equal(e.children[0].children[1].textContent,'Richtig');
 assert.doesNotMatch(JSON.stringify(e),/Geheim|Nicht zeigen|Max-Titel/);
});
test('Drei gemeinsame Textreiter statt zweier Statistik-/Sammlungskacheln',()=>{
 const js=read('src/website/modus-seite.js');
 assert.match(js,/quiz-untermenue/);assert.match(js,/Quiz-Statistik/);assert.doesNotMatch(js,/persoenlicheKacheln/);
 for(const p of ['modus.html','meine-statistik.html','sammlung.html'])assert.match(read(p),/stil\/quiz-bereiche.css/);
});
test('Gästequiz heißt ausdrücklich so und bekommt eigene Kopf-Farbfläche',()=>{
 assert.match(read('src/features/access.js'),/gast \? "Gästequiz" : "Quiz"/);
 assert.match(read('style.css'),/\.quiz-gastmodus \.kopf/);
});
test('Gesunde Sammlung ohne Aktualisieren; Serie separat in Statistik, Fehlerretry bleibt',()=>{
 const js=read('src/website/wochenserie-ansicht.js');
 assert.doesNotMatch(js,/'Aktualisieren'/);assert.match(js,/'Erneut versuchen'/);
 assert.match(js,/bereich==='sammlung'/);assert.match(read('src/website/sammlung-seite.js'),/bereich:'sammlung'/);
 assert.match(read('src/website/meine-statistik-seite.js'),/bereich:'serie'/);
 assert.match(js,/bestand\?\.serienjoker\?\?joker.length/);
});
test('Statistik-Detail verwendet schmale eigene RPC statt vollständiger Quizdaten',()=>{
 const js=read('src/website/meine-statistik-seite.js');assert.match(js,/meine_quizwochen_fragen/);
 assert.doesNotMatch(js,/wochen_fragen_v2|richtige_option|musterantwort|gegebener_freitext/);
});
