import test from 'node:test';
import assert from 'node:assert/strict';
import {pruefeGeraetename, pushGeraetebeschreibung} from '../src/features/geraetename.js';
import handler from '../api/push-test.js';
import {baueGeraetenameBearbeitung} from '../src/website/geraetename-bearbeitung.js';

test('Gerätenamen: trimmen, Unicode, leere/zu lange/Steuerzeichen abweisen',()=>{
  assert.equal(pruefeGeraetename('  Mein iPad  '),'Mein iPad');
  for(const name of [null,{},'', '  ','a'.repeat(61),'iPad\u0000','Mein\nGerät'])assert.equal(pruefeGeraetename(name),null);
  assert.equal(pruefeGeraetename('📱'.repeat(60)),'📱'.repeat(60));
});
test('iPad mit Desktopkennung nicht als Mac registrieren; echte Macs bleiben Macs',()=>{
  const mac={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15',maxTouchPoints:0};
  assert.equal(pushGeraetebeschreibung({...mac,maxTouchPoints:5},true),'iPad (App)');
  assert.equal(pushGeraetebeschreibung(mac,true),'Mac (App)');
  assert.equal(pushGeraetebeschreibung({userAgent:'iPhone'},true),'iPhone (App)');
  assert.equal(pushGeraetebeschreibung({userAgent:'Android'}),'Android');
});
const res=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
test('App umbenennt nur gewähltes Abo, ohne Versand; Antworten auf Name/ID begrenzt',async()=>{
  const alt={...process.env},fetchAlt=globalThis.fetch;const id='11111111-1111-4111-8111-111111111111';
  try{
    Object.assign(process.env,{SUPABASE_SECRET_KEY:'synthetisch',PUSH_TEST_AKTIV:'false',PUSH_DISPATCH_AKTIV:'false',PUSH_ANMELDUNG_AKTIV:'false'});
    delete process.env.VAPID_PRIVATER_SCHLUESSEL;
    let calls=0;
    globalThis.fetch=async(url,opt)=>{calls++;assert.match(String(url),/rpc\/obmann_push_geraet_umbenennen$/);
      assert.deepEqual(JSON.parse(opt.body),{p_passwort:'synthetisch',p_abo_id:id,p_name:'Mein iPad'});
      return new Response(JSON.stringify({id,geraet:'Mein iPad',endpunkt:'privat',auth:'privat'}));};
    const req={method:'POST',body:{aktion:'obmann_umbenennen',passwort:'synthetisch',aboId:id,name:' Mein iPad '}};
    const gut=res();await handler(req,gut);assert.equal(gut.code,200);assert.deepEqual(gut.body,{id,geraet:'Mein iPad'});assert.equal(calls,1);
    for(const body of [{...req.body,name:' '},{...req.body,name:'a'.repeat(61)},{...req.body,aboId:'x'},{...req.body,passwort:''}]){
      const schlecht=res();await handler({method:'POST',body},schlecht);assert.equal(schlecht.code,400);
    }
    assert.equal(calls,1);
    globalThis.fetch=async()=>new Response('{"message":"Falsches Passwort"}',{status:400});
    const falsch=res();await handler(req,falsch);assert.equal(falsch.code,403);
  }finally{globalThis.fetch=fetchAlt;for(const k of Object.keys(process.env))if(!(k in alt))delete process.env[k];Object.assign(process.env,alt)}
});

function node(){return {children:[],events:{},value:'',hidden:false,disabled:false,attrs:{},
  append(...n){this.children.push(...n)},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
  addEventListener(k,v){this.events[k]=v},focus(){},select(){}};}
test('Web-Editor behält Entwurf bei Fehlern, sendet erst nach Speichern, blockiert Doppelklick',async()=>{
  const vorher=globalThis.document;globalThis.document={createElement:node};
  try{
    const geraet={id:'test',geraet:'Mac'};let calls=0,resolve,korrekt=false;
    const ui=baueGeraetenameBearbeitung({geraet,istAktuell:()=>true,umbenannt:()=>{korrekt=true},speichern:async(name)=>{
      calls++;assert.equal(name,'Mein iPad');if(calls===1)throw new Error('Netzfehler');return await new Promise(r=>resolve=r);
    }});
    ui.knopf.events.click();const input=ui.formular.children[1];input.value='Mein iPad';assert.equal(calls,0);
    await ui.formular.events.submit({preventDefault(){}});assert.equal(input.value,'Mein iPad');assert.equal(ui.formular.hidden,false);
    assert.match(ui.formular.children.at(-1).textContent,/Netzfehler/);
    const pending=ui.formular.events.submit({preventDefault(){}});await ui.formular.events.submit({preventDefault(){}});assert.equal(calls,2);
    resolve({id:'test',geraet:'Mein iPad'});await pending;assert.equal(ui.formular.hidden,true);assert.equal(geraet.geraet,'Mein iPad');assert.equal(korrekt,true);
  }finally{globalThis.document=vorher}
});
test('Web-Editor ignoriert verspätete Antwort nach Kontowechsel',async()=>{
  const vorher=globalThis.document;globalThis.document={createElement:node};
  try{
    let aktuell=true,resolve,korrekt=false;const geraet={id:'test',geraet:'Mac'};
    const ui=baueGeraetenameBearbeitung({geraet,istAktuell:()=>aktuell,umbenannt:()=>{korrekt=true},speichern:()=>new Promise(r=>resolve=r)});
    ui.knopf.events.click();ui.formular.children[1].value='iPad';
    const p=ui.formular.events.submit({preventDefault(){}});aktuell=false;resolve({id:'test',geraet:'iPad'});await p;
    assert.equal(korrekt,false);assert.equal(geraet.geraet,'Mac');
  }finally{globalThis.document=vorher}
});
