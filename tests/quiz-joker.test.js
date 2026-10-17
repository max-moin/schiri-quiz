import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import entscheidung from '../api/entscheidung-bewerten.js';
import freitext from '../api/freitext-bewerten.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Joker-Gateway behält den PostgREST-Querybuilder für Lesefunktionen',async()=>{
 const context={};vm.runInNewContext(read('src/features/quiz-joker.js'),context);
 const calls=[],query={select:()=>query};const sb={rpc:(name,p)=>{calls.push({name,p});return name==='wochen_fragen_v2'?query:Promise.resolve({data:{korrekt:true},error:null});}};
 const j=context.SchiriQuizJoker.erstelleQuizJoker({sb,getZugang:()=>({schiedsrichterId:'eigen',pin:'pin'})});
 assert.equal(j.wochenRpc.rpc('wochen_fragen_v2',{}).select('id'),query);
 const result=await j.wochenRpc.rpc('antwort_auswahl_abgeben',{p_frage_id:'f',p_auswahl:['a']});
 assert.equal(result.data[0].korrekt,true);assert.equal(calls.at(-1).name,'quiz_joker_antwort');assert.equal(calls.at(-1).p.p_art,'auswahl');
});
function mock(t){for(const key of ['SUPABASE_SECRET_KEY','GEMINI_API_KEY']){const old=process.env[key];process.env[key]='only-local-test';t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old;});}t.mock.method(console,'error',()=>{});}
const response=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(x){this.body=x;}});
test('Icon-API gibt beim Jokerangebot weder Lösung noch Teilbewertung zurück',async t=>{
 mock(t);let saved;
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  if(String(url).includes('entscheidung_kontext_laden'))return new Response(JSON.stringify([{frage_text:'Test',fordert_fortsetzung:true,fordert_fortsetzung_fuer:false,fordert_fortsetzung_ort:false,fordert_strafe:false}]));
  assert.match(String(url),/quiz_joker_bewertet$/);saved=JSON.parse(opts.body);return new Response('{"joker_offen":true}');
 });
 const res=response();await entscheidung({method:'POST',body:{schiedsrichterId:'dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51',frageId:'3863476e-e0ba-4ae4-b664-1e238086c287',pin:'pin',joker:true,antwort:{spielfortsetzung:'weiterspielen',strafen:[],persoenliche_strafe:'keine'}}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,{joker_offen:true});assert.equal(saved.p_art,'entscheidung');
});
test('Freitext-API hält Musterantwort und KI-Feedback beim Jokerangebot im Server',async t=>{
 mock(t);let saved;
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  if(String(url).includes('generativelanguage'))return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({status:'falsch',feedback:'Geheime Lösungsbegründung',nachfrage:null})}]}}]}));
  if(String(url).includes('freitext_kontext_laden'))return new Response(JSON.stringify([{frage_text:'Test',musterantwort:'Geheime Musterantwort',bewertungshinweise:null}]));
  assert.match(String(url),/quiz_joker_bewertet$/);saved=JSON.parse(opts.body);return new Response('{"joker_offen":true}');
 });
 const res=response();await freitext({method:'POST',body:{schiedsrichterId:'dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51',frageId:'3863476e-e0ba-4ae4-b664-1e238086c287',pin:'pin',joker:true,freitext:'falsch'}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body,{joker_offen:true});assert.equal(saved.p_art,'freitext');assert.equal(saved.p_antwort.feedback,'Geheime Lösungsbegründung');
});
test('Startseiten-Fotostrecke ist lokal, als KI erkennbar und ersetzt die vier alten Vektoren',()=>{
 const html=read('index.html');for(const name of ['termine','absagen','feedback','unterlagen'])assert.match(html,new RegExp('bilder/startfotos/'+name+'\\.webp'));
 assert.equal((html.match(/class="ki-bildmarke"/g)||[]).length,4);assert.doesNotMatch(html,/<svg viewBox="0 0 240 140"/);
 assert.match(read('impressum.html'),/keine Fotos unserer Mitglieder/);assert.match(read('datenschutz.html'),/Erstantwort/);
});
