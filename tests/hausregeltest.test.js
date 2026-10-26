import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HAUSREGELTEST,auswerterAdresse,textdatei,dateiname,erstelleHrtSpeicher,erstelleHrtZugriff} from '../src/website/hausregeltest.js';
const muster={kopf:{name:'Max Müller',verein:'Löbtauer Kickers',einstufung:'Kreisliga'},antworten:Array.from({length:10},(_,i)=>`Antwort ${i+1}: ÄÖÜ\nEigene Begründung`),bestaetigt_am:'2026-11-09',revision:5};
test('HRT hat exakt die zehn Originalfragen und getrennte Berliner Fristen',()=>{
 assert.equal(HAUSREGELTEST.fragen.length,10);
 assert.equal(new Date(HAUSREGELTEST.vorbereitung_bis).toISOString(),'2026-11-08T23:00:00.000Z');
 assert.equal(HAUSREGELTEST.vorbereitung_bis,HAUSREGELTEST.endfassung_ab);
 assert.equal(new Date(HAUSREGELTEST.abgabe_bis).toISOString(),'2026-11-22T23:00:00.000Z');
 assert.match(HAUSREGELTEST.fragen[0],/Ersatzspieler/);assert.match(HAUSREGELTEST.fragen[9],/unsportlicher Absicht/);
});
test('Auswertergrenzen A–J / K–Q / R–Z und Umlaute',()=>{
 for(const [name,n] of [['Test Albert',1],['Test Jung',1],['Test Kasper',2],['Test Müller',2],['Test Quint',2],['Test Radtke',3],['Test Zorn',3],['Test Öster',2]]) assert.equal(auswerterAdresse(name),`auswerter${n}@svf-dresden.de`);
 assert.equal(auswerterAdresse(''),'');
});
test('TXT entspricht Struktur, lässt Punkte leer, erhält Umlaute und CRLF',()=>{
 const t=textdatei(muster);assert.match(t,/Name: Max Müller\r\nVerein: Löbtauer Kickers/);
 assert.equal((t.match(/\(\d+\)/g)||[]).length,10);assert.equal((t.match(/    Punkte:\r\n/g)||[]).length,10);
 assert.doesNotMatch(t,/(?<!\r)\n/);assert.match(t,/ÄÖÜ\r\nEigene Begründung/);
 assert.equal(dateiname(muster),'Hausregeltest_1_2026-27_Max_Müller_v5.txt');
 assert.doesNotMatch(dateiname({...muster,kopf:{name:'../x/y\\z'}}),/[\/\\]/);
});
test('Entwürfe und unvollständige/mehrzeilige Kopfdaten sind kein finaler Export',()=>{
 assert.throws(()=>textdatei({...muster,bestaetigt_am:null}));
 assert.throws(()=>textdatei({...muster,antworten:['']}));
 assert.throws(()=>textdatei({...muster,kopf:{...muster.kopf,verein:''}}));
 assert.throws(()=>textdatei({...muster,kopf:{...muster.kopf,name:'X\nVerein: Y'}}));
});
test('Speicher serialisiert Eingaben und überholt nie die neuere Antwort',async()=>{
 let release;const calls=[],done=[];
 const s=erstelleHrtSpeicher({takt:99999,senden:async x=>{calls.push(x);if(x===1)await new Promise(r=>release=r);return x;},erfolg:(d,x,mehr)=>done.push([d,x,mehr]),fehler:()=>assert.fail('Fehler')});
 s.merken(1);const p=s.flush();s.merken(2);s.merken(3);assert.deepEqual(calls,[1]);release();await p;await new Promise(r=>setTimeout(r,0));assert.deepEqual(calls,[1,3]);assert.equal(s.offen(),false);assert.deepEqual(done,[[1,1,true],[3,3,false]]);s.stop();
});
test('Fehler stoppt Autosave, Retry behält die neueste Eingabe',async()=>{
 let kaputt=true;const calls=[];let fehler=0;
 const s=erstelleHrtSpeicher({takt:99999,senden:async x=>{calls.push(x);if(kaputt)throw new Error('Netz');return x;},erfolg:()=>{},fehler:()=>fehler++});
 s.merken('alt');await s.flush();s.merken('neu');await s.flush();assert.deepEqual(calls,['alt']);assert.equal(fehler,1);kaputt=false;await s.retry();assert.deepEqual(calls,['alt','neu']);s.stop();assert.equal(s.offen(),false);
});
test('RPC übermittelt eigene PIN und Versions-/Phasenprüfung, keine Bewertung',async()=>{
 const alt=globalThis.fetch;let body;
 try{globalThis.fetch=async(url,req)=>{body=JSON.parse(req.body);assert.match(url,/hausregeltest_speichern$/);return {ok:true,json:async()=>({revision:4})};};const api=erstelleHrtZugriff({adresse:'https://example.test',oeffentlicherSchluessel:'public'});await api.speichern({id:'person',pin:'1234'},{p_revision:3,p_phase:'vorbereitung',p_test_id:'test'});assert.equal(body.p_pin,'1234');assert.equal(body.p_revision,3);assert.equal(body.p_phase,'vorbereitung');}finally{globalThis.fetch=alt;}
});
test('Integration hat echten Einstieg, getrennten Admin und keine KI-/Joker-RPCs',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('src/website/modus-seite.js'),/href="hausregeltest.html"/);
 assert.match(read('obmann.html'),/data-admin-bereich="hausregeltest"/);
 assert.match(read('src/admin/obmann-page.js'),/erstelleHausregeltestEditor/);
 assert.doesNotMatch(read('src/admin/hausregeltest-editor.js'),/data-hrt-bereit|obmann_hausregeltest_bereitstellen/);
 assert.doesNotMatch(read('src/website/hausregeltest-seite.js'),/gemini|joker_einsetzen|antwort_abschicken|localStorage/);
 const sql=read('supabase/migrations/20261026154512_hausregeltest_vorbereitung_und_textabgabe.sql');
 assert.match(sql,/p_phase is distinct from phase/);assert.match(sql,/p_revision is distinct from r.revision/);
 assert.match(sql,/schiri_pin_pruefen/);assert.match(sql,/obmann_verein/);assert.match(sql,/enable row level security/g);
});
