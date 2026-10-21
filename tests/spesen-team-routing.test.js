import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { rechneTeam } from '../src/website/spesen-team-rechnung.js';
import { berechneRoute, sucheOrte, koordinaten } from '../server/spesen-routing.js';
import handler from '../server/spesen-route-handler.js';
import { normalisiereSpesenKonfiguration, standardSpesenKonfiguration } from '../src/website/spesen-config.js';
import { ALTERSKLASSEN, TURNIER, FAHRTKOSTEN, VEREINE, AUSFALL_ANTEIL } from '../verein.config.js';
const saetze=FAHRTKOSTEN;
const p=(id,art='auto',extra={})=>({id,name:id,art,km:'20',...extra});
test('Gemeinsame Klasse, unterschiedliche Funktionssätze, getrennte Fahrtkosten',()=>{
 const r=rechneTeam({liga:{verband:'sfv',sr:45,sra:35},personen:[p('SR'),p('SRA','karte')],saetze});
 assert.equal(r.zeilen[0].gesamt,52);assert.equal(r.zeilen[1].gesamt,38.5);assert.equal(r.gesamt,90.5);assert.equal(r.unsicher,false);
});
test('Mitfahrt rechnet nicht das zweite Auto ab; verschwundener Fahrer macht Ergebnis unvollständig',()=>{
 const r=rechneTeam({liga:{verband:'sfv',sr:45,sra:35},personen:[p('a'),p('b','mitfahrt',{fahrer:'a'})],saetze});
 assert.equal(r.gesamt,87);assert.equal(r.zeilen[1].fahrt.betrag,0);assert.equal(r.unsicher,false);
 assert.equal(rechneTeam({liga:{verband:'sfv',sr:45,sra:35},personen:[p('b','mitfahrt',{fahrer:'a'})],saetze}).unsicher,true);
});
test('Stadt kennt 1–3 bestätigte Zonen, keine automatische SFV-km-Regel',()=>{
 const r=z=>rechneTeam({liga:{verband:'svfd',sr:30,sra:25},personen:[p('a','zonen',{zonen:z})],saetze});
 assert.equal(r('1').gesamt,37.2);assert.equal(r('3').gesamt,51.6);assert.equal(r('4').unsicher,true);assert.equal(r('').unsicher,true);
 assert.equal(rechneTeam({liga:{verband:'svfd',sr:30},personen:[p('a')],saetze}).unsicher,true);
});
test('Fehlender SRA-Satz und leere Kilometer werden nicht zu gültigen 0 €',()=>{
 assert.equal(rechneTeam({liga:{verband:'sfv',sr:30,sra:null},personen:[p('a'),p('b')],saetze}).unsicher,true);
 assert.equal(rechneTeam({liga:{verband:'sfv',sr:30},personen:[p('a','auto',{km:''})],saetze}).unsicher,true);
});
test('Öffentliche Spielstätten bleiben erhalten, invalide Koordinaten nicht',()=>{
 const fallback=standardSpesenKonfiguration({altersklassen:ALTERSKLASSEN,turnier:TURNIER,fahrtkosten:FAHRTKOSTEN,vereine:VEREINE,ausfallAnteil:AUSFALL_ANTEIL});
 const c=normalisiereSpesenKonfiguration({vereine:[{name:'Testverein',spielstaetten:[{id:'x',name:'Sportplatz',adresse:'Testweg 1',koordinaten:[13.7,51.1]},{name:'Zweiter Platz',koordinaten:[200,200]}]}]},fallback);
 assert.deepEqual(c.vereine[0].spielstaetten[0].koordinaten,[13.7,51.1]);assert.equal(c.vereine[0].spielstaetten[1].koordinaten,undefined);
});
test('Routenprüfung verwirft fremde URLs, Strings und Koordinaten außerhalb des Gebiets',()=>{
 for(const k of ['https://evil.test', ['13','51'],[180,0],[NaN,51],null])assert.throws(()=>koordinaten(k));
});
test('Hin- und Rückweg separat, shortest statt fastest, kein Schlüssel im Ergebnis',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,o)=>{calls.push([url,o]);return Response.json({features:[{properties:{summary:{distance:calls.length===1?12000:14000}},geometry:{coordinates:[[13.7,51],[13.8,51.1]]}}]});});
 const r=await berechneRoute([13.7,51],[13.8,51.1],'secret-test');assert.equal(r.kilometer,26);assert.equal(calls.length,2);
 const a=JSON.parse(calls[0][1].body),b=JSON.parse(calls[1][1].body);assert.equal(a.preference,'shortest');assert.deepEqual(a.coordinates,[...b.coordinates].reverse());assert.doesNotMatch(JSON.stringify(r),/secret-test/);
});
test('Geocoder verwendet feste Provideradresse und bereinigt Treffer',async t=>{
 t.mock.method(globalThis,'fetch',async(url,o)=>{assert.equal(url.hostname,'api.openrouteservice.org');assert.equal(url.searchParams.get('text'),'Testweg 1 Dresden');assert.equal(o.redirect,'error');return Response.json({features:[{properties:{label:'Testweg'},geometry:{coordinates:[13.7,51]}},{geometry:{coordinates:[200,200]}}]});});
 assert.equal((await sucheOrte('Testweg 1 Dresden','test')).length,1);
});
const res=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}});
const body={schiedsrichterId:'dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51',pin:'test',einverstanden:true,aktion:'route',start:[13.7,51],ziel:[13.8,51.1]};
function env(t){for(const k of ['ORS_API_KEY','SUPABASE_SECRET_KEY']){const v=process.env[k];process.env[k]='secret-test';t.after(()=>v===undefined?delete process.env[k]:process.env[k]=v);}}
test('Ohne Schlüssel nur manueller Fallback, keine Provideranfrage',async t=>{env(t);delete process.env.ORS_API_KEY;t.mock.method(globalThis,'fetch',()=>{throw Error('nicht erlaubt');});const r=res();await handler({method:'POST',body},r);assert.equal(r.statusCode,503);assert.equal(r.body.code,'ROUTING_NOT_CONFIGURED');});
test('Ohne aktive Zustimmung oder mit ungültiger Eingabe kein Quota-/Provideraufruf',async t=>{env(t);t.mock.method(globalThis,'fetch',()=>{throw Error('nicht erlaubt');});for(const b of [{...body,einverstanden:false},{...body,start:'https://evil.test'}]){const r=res();await handler({method:'POST',body:b},r);assert.equal(r.statusCode,400);}});
test('Kontingent vor Provider reservieren; Limit stoppt Route',async t=>{env(t);let n=0;t.mock.method(globalThis,'fetch',async(url,o)=>{n++;assert.match(String(url),/spesen_routing_erlauben$/);assert.equal(JSON.parse(o.body).p_einheiten,2);return Response.json(false);});const r=res();await handler({method:'POST',body},r);assert.equal(n,1);assert.equal(r.statusCode,429);});
test('Jokerknopf zählt ausschließlich anwendbare Typen',()=>{
 const sandbox={};vm.runInNewContext(readFileSync(new URL('../src/features/quiz-joker.js',import.meta.url),'utf8'),sandbox);
 const n=sandbox.SchiriQuizJoker.geeigneterVorrat;
 const stand={bestand:{halbhalb:2,serienjoker:1,'zweiter-versuch':0},vorgaenge:[]};
 assert.equal(n({id:'a',antworttyp:'freitext'},stand),0);assert.equal(n({id:'a',antworttyp:'multiple_choice',antwortoptionen:[1,2,3]},stand),2);
 assert.equal(n({id:'a',antworttyp:'multiple_choice',antwortoptionen:[1,2]},stand),0);
 assert.equal(n({id:'a',antworttyp:'multiple_choice',antwortoptionen:[1,2,3]},stand,{beantwortet:true}),0);
 stand.bestand['zweiter-versuch']=1;assert.equal(n({id:'a',antworttyp:'entscheidung'},stand),1);
 stand.vorgaenge=[{frage_id:'a',status:'zweiter'}];assert.equal(n({id:'a',antworttyp:'entscheidung'},stand),0);
});
