import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {aeltereTermine} from '../src/website/termine.js';
import {externesPlanbild,zeichneSoccergolf} from '../src/website/soccergolf-ergebnisse.js';
import {tourSchritte,tourAdresse,TOUR_TERMIN} from '../src/website/hilfe-inhalte.js';
import {begruendungsStatus,offeneNachfrage,nachfrageAntwort,ICON_NACHFRAGE_FREIGEGEBEN} from '../server/icon-nachfrage.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Ältere Termine: 0/5/10/Rest, aufsteigend, stabile IDs und keine Eingabemutation',()=>{
 const input=Array.from({length:12},(_,i)=>({id:String(i),datum:`2026-09-${String(i+1).padStart(2,'0')}`,vergangen:true})).reverse();
 const vorher=JSON.stringify(input);
 assert.equal(aeltereTermine(input,0).length,0);
 assert.deepEqual(aeltereTermine(input,5).map(x=>x.id),['7','8','9','10','11']);
 assert.deepEqual(aeltereTermine(input,10).map(x=>x.id),Array.from({length:10},(_,i)=>String(i+2)));
 assert.equal(aeltereTermine(input,15).length,12);assert.equal(JSON.stringify(input),vorher);
 assert.equal(aeltereTermine(input,NaN).length,0);
});
test('Planvorschau: nur Betreiber-Bildhost, kein beliebiger HTML-/Trackinglink',()=>{
 assert.equal(externesPlanbild('https://www.soccergolf-sachsen.de/assets/images/h/plan.webp'),true);
 for(const s of ['https://evil.test/plan.webp','https://www.soccergolf-sachsen.de.example.test/assets/images/a.webp','https://www.soccergolf-sachsen.de/assets/images/a.webp?track=1','https://www.soccergolf-sachsen.de/page.html','https://a:b@www.soccergolf-sachsen.de/assets/images/a.webp'])assert.equal(externesPlanbild(s),false);
 assert.match(read('src/website/soccergolf-ergebnisse.js'),/addEventListener\('click',[\s\S]*referrerPolicy='no-referrer'/);
});
test('Einführung zeigt Übergänge und echten Beispieltermin, kein Antworttutorial',()=>{
 const s=tourSchritte('einstieg','hilfe.html');
 assert.equal(s.filter(x=>x.id.startsWith('weg-')).length,5);
 assert.equal(s.some(x=>x.id==='loesung'),false);
 for(const t of s.filter(x=>x.termin))assert.equal(tourAdresse(t),'termine.html?termin='+TOUR_TERMIN);
 assert.equal(s.find(x=>x.id==='ueben').ziel,'[data-tour-ueben-duell]');
 assert.doesNotMatch(read('src/ui/seitenhilfe.js'),/Ausführliche Einstiegstour/);
});
test('Nachfrage wird nur bei plausibler Lücke orange, Unsinn und falscher Ort bleiben rot',()=>{
 assert.equal(begruendungsStatus({begruendung_status:'nachbessern',begruendung_richtig:false,nachfrage:'Was begründet deine Entscheidung?'},true,true).status,'nachbessern');
 assert.equal(begruendungsStatus({ungueltig:true,begruendung_status:'nachbessern',nachfrage:'Was fehlt noch?'},true,true).status,'falsch');
 assert.equal(begruendungsStatus({begruendung_status:'nachbessern',nachfrage:'Was fehlt noch?'},false,true).status,'falsch');
 assert.equal(ICON_NACHFRAGE_FREIGEGEBEN,false); // Keine neue Provider-Freigabe suggerieren.
});
test('Nachfrage verrät keine Noten/Muster, Ergänzung kann feste Erstantwort nicht ändern',()=>{
 const c={nachfrage_offen:true,nachfrage:'Warum?',erste_antwort:{spielfortsetzung:'weiterspielen',begruendung:'Erste Begründung',_begruendung:{richtig:false}},begruendung_muster:'Geheim'};
 assert.doesNotMatch(JSON.stringify(offeneNachfrage(c)),/Geheim|_begruendung|richtig/);
 assert.deepEqual(nachfrageAntwort({spielfortsetzung:'strafstoss',begruendung:'Ergänzung'},c),{spielfortsetzung:'weiterspielen',begruendung:'Ergänzung'});
});
test('Neue Hinweisjoker erscheinen nur bei passender Frage und unbenutztem Effekt',()=>{
 const c={};vm.runInNewContext(read('src/features/quiz-joker.js'),c);
 const f=c.SchiriQuizJoker.geeigneterVorrat;
 const stand={bestand:{denkanstoss:1,fehlerlupe:1,zufallsbaustein:1,schluesselbaustein:1},hinweise:[{frage_id:'f',denkanstoss:true,icon:false,einsaetze:[]}]};
 assert.equal(f({id:'f',antworttyp:'freitext'},stand,{}),1);
 stand.hinweise[0].icon=true;
 assert.equal(f({id:'f',antworttyp:'entscheidung'},stand,{}),4);
 stand.hinweise[0].einsaetze=[{typ:'denkanstoss'}];
 assert.equal(f({id:'f',antworttyp:'entscheidung'},stand,{}),3);
 assert.equal(f({id:'f',antworttyp:'entscheidung'},stand,{nachbesserung_offen:true}),0);
});
