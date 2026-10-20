import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler,{bereinigeEntscheidung,pruefeForm,pruefeVollstaendig,pruefeFreieEntscheidung} from '../api/entscheidung-bewerten.js';
const kontext={frage_text:'Foul außerhalb des Strafraums.',fordert_fortsetzung:true,fordert_fortsetzung_fuer:false,fordert_fortsetzung_ort:false,fordert_strafe:false,fordert_begruendung:true,begruendung_muster:'Verhindert einen aussichtsreichen Angriff.',begruendung_gewicht:3,kern_richtig:true};
const antwort=()=>({spielfortsetzung:'direkter_freistoss',strafen:[],begruendung:'Stoppt einen aussichtsreichen Angriff.'});
const res=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;}});
function env(t){for(const k of ['SUPABASE_SECRET_KEY','GEMINI_API_KEY']){const alt=process.env[k];process.env[k]='synthetic-test';t.after(()=>{if(alt===undefined)delete process.env[k];else process.env[k]=alt;});}t.mock.method(console,'error',()=>{});}
const ki=(daten)=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(daten)}]}}]}));
test('Begründung ist strikt opt-in und auf 600 Zeichen begrenzt',()=>{
 assert.equal(pruefeVollstaendig(antwort(),kontext),null);
 assert.match(pruefeVollstaendig({...antwort(),begruendung:''},kontext),/Begründung fehlt/);
 assert.equal(pruefeVollstaendig({...antwort(),begruendung:''},{...kontext,fordert_begruendung:false}),null);
 assert.match(pruefeForm({...antwort(),begruendung:'x'.repeat(601)}),/600/);
 assert.match(pruefeForm({...antwort(),begruendung:{richtig:true}}),/ungültig/);
});
test('Browser darf keine Begründungsnote mitsenden',()=>{
 assert.equal(bereinigeEntscheidung({...antwort(),_begruendung:{richtig:true}})._begruendung,undefined);
});
test('Falsche feste Entscheidung spart KI und kann durch Begründung nicht gerettet werden',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Kein Aufruf erlaubt');});
 const a=antwort();await pruefeFreieEntscheidung(a,{...kontext,kern_richtig:false});
 assert.equal(a._begruendung.richtig,false);assert.match(a._begruendung.feedback,/nicht richtig/);
});
test('Nicht verlangte Begründung wird weder bewertet noch heimlich gespeichert',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Kein Aufruf erlaubt');});
 const a=antwort();await pruefeFreieEntscheidung(a,{...kontext,fordert_begruendung:false});assert.equal(a.begruendung,undefined);assert.equal(a._begruendung,undefined);
});
test('Ort und Begründung nutzen zusammen genau einen kompakten KI-Aufruf',async t=>{
 env(t);let n=0,prompt;
 t.mock.method(globalThis,'fetch',async(url,o)=>{n++;prompt=JSON.parse(o.body).contents[0].parts[0].text;return ki({begruendung_richtig:true,begruendung_feedback:'Passend.',ort_richtig:true});});
 const a={...antwort(),fortsetzung_ort:'neben dem zweiten Pfosten'};
 const r=await pruefeFreieEntscheidung(a,{...kontext,fordert_fortsetzung_ort:true,fortsetzung_ort:'Ort des Vergehens',begruendung_gewicht:1});
 assert.equal(n,1);assert.equal(r.gleichwertig,true);assert.equal(a._begruendung.richtig,true);assert.match(prompt,/"naehe":1/);assert.doesNotMatch(prompt,/synthetic-test/);
});
test('Kaputte KI-Antwort vergibt kein richtig',async t=>{
 env(t);t.mock.method(globalThis,'fetch',async()=>ki({begruendung_richtig:'ja'}));
 await assert.rejects(pruefeFreieEntscheidung(antwort(),kontext),/Ungültige/);
});
test('Joker-API speichert Originalbegründung und serverseitige Note, verrät beim Angebot nichts',async t=>{
 env(t);let saved;
 t.mock.method(globalThis,'fetch',async(url,o)=>{
  if(String(url).includes('entscheidung_kontext_v3'))return new Response(JSON.stringify(kontext));
  if(String(url).includes('generativelanguage'))return ki({begruendung_richtig:false,begruendung_feedback:'Grund fehlt.'});
  assert.match(String(url),/quiz_joker_bewertet$/);saved=JSON.parse(o.body);return new Response('{"joker_offen":true}');
 });
 const r=res();await handler({method:'POST',body:{schiedsrichterId:'dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51',frageId:'3863476e-e0ba-4ae4-b664-1e238086c287',pin:'test',joker:true,antwort:{...antwort(),_begruendung:{richtig:true}}}},r);
 assert.equal(r.statusCode,200);assert.deepEqual(r.body,{joker_offen:true});assert.equal(saved.p_antwort.antwort._begruendung.richtig,false);assert.equal(saved.p_antwort.antwort.begruendung,antwort().begruendung);
});
test('KI-Fehler speichert nichts und gibt keine interne Musterantwort aus',async t=>{
 env(t);let calls=0;t.mock.method(globalThis,'fetch',async(url)=>{calls++;if(String(url).includes('entscheidung_kontext_v3'))return new Response(JSON.stringify(kontext));return ki({});});
 const r=res();await handler({method:'POST',body:{schiedsrichterId:'dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51',frageId:'3863476e-e0ba-4ae4-b664-1e238086c287',pin:'test',antwort:antwort()}},r);
 assert.equal(r.statusCode,503);assert.equal(calls,2);assert.doesNotMatch(JSON.stringify(r.body),/aussichtsreichen/);
});
test('Formular, vierte Ergebniszeile und reduzierte Bewegung sind verdrahtet',()=>{
 const js=readFileSync(new URL('../src/features/decision-answers.js',import.meta.url),'utf8');
 assert.match(js,/frage.fordert_begruendung === true/);assert.match(js,/text.maxLength = 600/);assert.match(js,/e.begruendung_richtig === true/);
 assert.match(readFileSync(new URL('../stil/wochen-entscheidung.css',import.meta.url),'utf8'),/prefers-reduced-motion:no-preference/);
});
