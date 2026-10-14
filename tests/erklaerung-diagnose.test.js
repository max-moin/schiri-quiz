import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import handler from '../api/erklaerung.js';

test('Screenshot-Fehlermeldung ist der kontrollierte Gemini-Timeout nach erfolgreicher Kontextprüfung',async()=>{
  const alt={...process.env},fetchAlt=globalThis.fetch,warn=console.error;
  try{
    Object.assign(process.env,{GEMINI_API_KEY:'synthetisch',SUPABASE_SECRET_KEY:'sb_secret_synthetisch'});
    let n=0;console.error=()=>{};
    globalThis.fetch=async(url)=>{
      n++;if(n===1){assert.match(String(url),/erklaerung_kontext_laden$/);
        return new Response(JSON.stringify([{typ:'entscheidung',frage_text:'Synthetische Szene',musterantwort:'Weiterspielen.',korrekt:true}]))}
      assert.match(String(url),/generativelanguage/);throw Object.assign(new Error('synthetisch'),{name:'AbortError'});
    };
    const res={setHeader(){},status(c){this.code=c;return this},json(b){this.body=b;return this}};
    await handler({method:'POST',body:{schiedsrichterId:'11111111-1111-4111-8111-111111111111',frageId:'22222222-2222-4222-8222-222222222222',pin:'synthetisch'}},res);
    assert.equal(n,2);assert.equal(res.code,504);assert.equal(res.body.fehler,'Die KI antwortet gerade zu langsam. Bitte versuche es gleich noch einmal.');
  }finally{globalThis.fetch=fetchAlt;console.error=warn;for(const k of Object.keys(process.env))if(!(k in alt))delete process.env[k];Object.assign(process.env,alt)}
});

test('Warum-Dialog lässt sich nach dem Screenshot-Timeout über X schließen; er schreibt keine Antworten',async()=>{
  const node=()=>({hidden:true,children:[],events:{},textContent:'',append(...x){this.children.push(...x)},appendChild(x){this.children.push(x)},replaceChildren(){this.children=[]},addEventListener(n,f){this.events[n]=f}});
  const overlay=node(),inhalt=node(),close=node();
  const doc={events:{},getElementById(id){return {'erklaerung-overlay':overlay,'erklaerung-inhalt':inhalt,'erklaerung-schliessen-button':close}[id]},createElement:node,addEventListener(n,f){this.events[n]=f}};
  const context={document:doc,fetch:async(url)=>{assert.equal(url,'/api/erklaerung');return {ok:false,json:async()=>({fehler:'Die KI antwortet gerade zu langsam. Bitte versuche es gleich noch einmal.'})}}};
  vm.runInNewContext(readFileSync(new URL('../src/ui/explanation-dialog.js',import.meta.url),'utf8'),context);
  const dialog=context.SchiriQuizExplanationDialog.erstelleErklaerungsDialog({getZugang:()=>({schiedsrichterId:'synthetisch',pin:'synthetisch'})});
  const button=dialog.baueWarumButton('synthetisch',false);button.events.click();await new Promise(r=>setImmediate(r));
  assert.equal(overlay.hidden,false);assert.match(inhalt.children[0].textContent,/KI antwortet gerade zu langsam/);
  close.events.click();assert.equal(overlay.hidden,true);
});
