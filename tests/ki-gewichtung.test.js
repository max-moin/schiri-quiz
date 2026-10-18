import test from 'node:test';
import assert from 'node:assert/strict';
import {baueErstversuchPrompt,baueNachbesserungsPrompt,extrahiereBewertungskriterien,normalisiereKIBewertung} from '../api/freitext-bewerten.js';
const k=(id,bezeichnung,gewichtung=3,aktiv=true)=>({id,bezeichnung,erwartung:bezeichnung==='Begründung'?'Schiedsrichterfehler, Wechsel rückgängig':'Verwarnung',gewichtung,aktiv,bei_fehlen:'nachfragen',bei_widerspruch:'falsch',rueckfrage:'Bitte ergänze diesen Punkt.'});
const rubric=rows=>'[[KI-KRITERIEN-JSON]]\n'+JSON.stringify(rows)+'\n[[/KI-KRITERIEN-JSON]]';
test('Gewichtung bleibt begrenzt, Strafe mindestens vier, abgeschaltete Kriterien werden nicht bewertet',()=>{
 const hinweis=rubric([k('a','Persönliche Strafe',0),k('b','Begründung',1),k('c','Alt',3,false)]);
 assert.deepEqual(extrahiereBewertungskriterien(hinweis).map(x=>[x.id,x.gewichtung]),[['a',4],['b',1]]);
 const ergebnis=normalisiereKIBewertung({kriterien:[{id:'1',status:'erfuellt'},{id:'2',status:'erfuellt'}]},hinweis);
 assert.equal(ergebnis.status,'richtig');
});
test('Nichtfachlicher Erstversuch bleibt falsch, selbst wenn das Modell Orange meldet',()=>{
 const hinweis=rubric([k('a','Persönliche Strafe',5),k('b','Spielfortsetzung',4)]);
 const ergebnis=normalisiereKIBewertung({status:'nachbessern',kriterien:[{id:'1',status:'fehlt'},{id:'2',status:'fehlt'}],nachfrage:'Welche Karte?'},hinweis);
 assert.equal(ergebnis.status,'falsch');assert.equal(ergebnis.nachfrage,null);
});
test('Ungültig überstimmt Legacy- und Kriterienurteile ohne zusätzlichen KI-Aufruf',()=>{
 for(const hinweis of [null,rubric([k('a','Strafe')])]){
  const ergebnis=normalisiereKIBewertung({status:'richtig',ungueltig:true,kriterien:[]},hinweis);
  assert.equal(ergebnis.status,'falsch');assert.equal(ergebnis.nachfrage,null);
 }
});
test('Ernsthafter Teiltreffer bleibt Orange, falsche Karte bleibt rot',()=>{
 const h=rubric([k('a','Persönliche Strafe',5),k('b','Spielfortsetzung',4)]);
 assert.equal(normalisiereKIBewertung({kriterien:[{id:'a',status:'erfuellt'},{id:'b',status:'fehlt'}]},h).status,'nachbessern');
 assert.equal(normalisiereKIBewertung({kriterien:[{id:'a',status:'widersprochen'},{id:'b',status:'erfuellt'}]},h).status,'falsch');
});
test('Kompakter Prompt erhält Erwartungen, Synonyme und Gewichtung, nicht doppelte UUIDs oder Serverfolgen',()=>{
 const a=k('lange-uuid-nicht-an-ki','Persönliche Strafe',5);a.akzeptierte_formulierungen='Gelb; Verwarnung';
 const h=rubric([a,k('b','Begründung',1),k('c','Deaktiviert',3,false)]);
 const prompt=baueErstversuchPrompt({frage_text:'Wie entscheidest du?',musterantwort:'Verwarnung',bewertungshinweise:h},'Gelb',true);
 assert.match(prompt,/"g":1/);assert.match(prompt,/Gelb; Verwarnung/);assert.match(prompt,/Nicht bewerten.*Deaktiviert/);
 assert.doesNotMatch(prompt,/lange-uuid-nicht-an-ki|bei_fehlen|Bitte ergänze diesen Punkt/);
 assert.match(prompt,/nie Wortlauttreue verlangen/);
 assert.match(prompt,/Kick-Bass-Gott/);
});
test('Stufe null bleibt aktiv und sinnvoller Situationsbezug wird ausdrücklich verlangt',()=>{
 const h=rubric([k('a','Begründung',0)]);
 assert.equal(extrahiereBewertungskriterien(h)[0].gewichtung,0);
 const prompt=baueNachbesserungsPrompt({frage_text:'Warum?',bewertungshinweise:h,erster_freitext:'Muss besser machen'},'Gelb');
 assert.match(prompt,/0=nur sinnvoller Situationsbezug/);assert.match(prompt,/ausschließlich fachfremder Unsinn/);
});
