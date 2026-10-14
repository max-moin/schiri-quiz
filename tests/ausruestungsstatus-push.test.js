import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {nachrichtFuer} from '../server/schiri-push.js';
import dispatch from '../api/push-auftraege.js';
import {vapidSchluesselpaarErzeugen} from '../server/webpush.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=lies('supabase/migrations/20261013200524_schiri_push_ausruestungsstatus.sql');
const kandidaten=lies('supabase/migrations/20261013201607_schiri_push_ausruestung_eigene_schritte.sql');
test('Ausrüstungsstatus ist extra Opt-in, Alt-Auswahl bleibt unverändert',()=>{
  assert.match(sql,/ausruestung_status boolean not null default false/);
  assert.match(sql,/function public\.schiri_push_auswahl_v2_setzen/);
  assert.match(sql,/perform public\.schiri_pin_pruefen/);
  assert.match(sql,/e\.erstellt_am>=p\.ausruestung_aktiviert_am/);
  assert.match(lies('src/website/mitteilungen-steuerung.js'),/p_ausruestung_status: wahl\.ausruestung_status/);
});
test('Queue verwendet den aktuellen eigenen Fachstand und sammelt Bündelentscheidungen',()=>{
  assert.match(kandidaten,/distinct on \(coalesce\(a\.buendel_id,a\.id\)\)/);
  assert.match(kandidaten,/e\.runde=a\.prozess_runde and e\.schritt=a\.prozess_status/);
  assert.match(kandidaten,/n\.akteur_rolle in \('obmann','vorstand'\)/);
  assert.doesNotMatch(kandidaten,/e\.akteur_rolle in \('obmann','vorstand'\)/);
  assert.match(kandidaten,/s\.verein_id=e\.verein_id/);
  assert.match(kandidaten,/n\.schritt in \('freigegeben','abgelehnt'\)/);
  assert.match(sql,/for update of a skip locked/);
  assert.match(sql,/e\.erstellt_am>=now\(\)-interval '24 hours'/);
  assert.match(sql,/einwilligung_widerrufen/);
  assert.match(sql,/to service_role/);
});
test('Sperrbildschirm erhält keine Namen, Preise, Entscheidungen oder Notizen; Tippen führt zu eigenen Anliegen',async()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const nachricht=JSON.parse(nachrichtFuer('ausruestung.status',id));
  assert.equal(nachricht.ziel,'/meine-anliegen.html');
  assert.doesNotMatch(JSON.stringify(nachricht),/preis|Betrag|Notiz|PIN|Max|freigegeben|abgelehnt/);
  const handler=new Map(),ziele=[];
  vm.runInNewContext(lies('sw.js'),{self:{addEventListener:(n,f)=>handler.set(n,f),
    registration:{showNotification:async(t,o)=>ziele.push(o.data.ziel)},clients:{claim(){}},skipWaiting(){}}});
  handler.get('push')({data:{json:()=>nachricht},waitUntil(){}});
  assert.deepEqual(ziele,['/meine-anliegen.html']);
});
test('Dispatcher führt die neue Kategorie über deren private Zustellliste und quittiert genau einen Auftrag',async()=>{
  const alt={...process.env},fetchAlt=globalThis.fetch;const vapid=vapidSchluesselpaarErzeugen(),client=vapidSchluesselpaarErzeugen();
  const id='11111111-1111-4111-8111-111111111111',endpoint='https://web.push.apple.com/synthetischer-status';
  const aufrufe=[];
  try{
    Object.assign(process.env,{SUPABASE_SECRET_KEY:'sb_secret_synthetisch',PUSH_DISPATCH_AKTIV:'true',
      PUSH_SENDE_SCHLUESSEL:'synthetischer-sender',VAPID_PRIVATER_SCHLUESSEL:vapid.privat,VAPID_SUB:'mailto:test@example.org'});
    globalThis.fetch=async(url,init)=>{
      aufrufe.push(String(url));const rpc=String(url).split('/rpc/')[1];
      if(rpc==='schiri_push_ausruestung_auftraege_beanspruchen')return new Response(JSON.stringify([{auftrag_id:id,typ:'ausruestung.status',meldung_id:id,gruppe:'ausruestung_'+id}]));
      if(rpc?.endsWith('_auftraege_beanspruchen'))return new Response('[]');
      if(rpc==='schiri_push_ausruestung_zustellliste'){
        assert.deepEqual(JSON.parse(init.body),{p_auftrag_id:id});
        return new Response(JSON.stringify([{id,endpunkt:endpoint,p256dh:client.oeffentlich,auth:Buffer.alloc(16,8).toString('base64url')}]));
      }
      if(rpc==='benachrichtigung_auftrag_versendet'){assert.equal(JSON.parse(init.body).p_auftrag_id,id);return new Response('{}')}
      assert.equal(String(url),endpoint);return new Response(null,{status:201});
    };
    const res={setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}};
    await dispatch({method:'POST',headers:{'x-push-schluessel':'synthetischer-sender'}},res);
    assert.equal(res.code,200);assert.deepEqual(res.body,{beansprucht:1,versendet:1,fehlgeschlagen:0});
    assert.equal(aufrufe.filter(x=>x===endpoint).length,1);
  }finally{globalThis.fetch=fetchAlt;for(const k of Object.keys(process.env))if(!(k in alt))delete process.env[k];Object.assign(process.env,alt)}
});
