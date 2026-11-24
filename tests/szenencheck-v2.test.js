import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const code=readFileSync(new URL("../src/website/szenencheck-seite.js",import.meta.url),"utf8").replace(/^import .*;\n/,"");
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function browser(antworten) {
  const request=[], events={};
  const status={textContent:"",classList:{toggle(){}}};
  const root={innerHTML:"",querySelector(sel){if(sel==="[data-status]") return status;},addEventListener(name,fn){events[name]=fn;}};
  runInNewContext(code,{
    document:{getElementById:()=>root},
    DATENBANK:{adresse:"https://example.invalid",oeffentlicherSchluessel:"test"},
    SchiriAnmeldung:{erstelleAnmeldung:()=>({abonniere(fn){fn({id:"m",pin:"x"});}})},
    SchiriLoginDialog:{erstelleLoginDialog:()=>({})},
    fetch:async(_,{body})=>{request.push(JSON.parse(body));const [status,data]=antworten.shift();return {ok:status===200,status,json:async()=>data};},
    URL,Intl,
  });
  await tick();
  return {request,root,status,async click(action){ await events.click({target:{closest:()=>({dataset:{action}})}}); await tick(); }};
}
const scene={id:"s",titel:"Szenentitel",art:"pfiff",privat:true,start:0,ende:5};
const stand=phase=>({phase,id:"r",titel:"Runde",schluss:"2026-12-01T10:00:00Z",szenen:[scene],stimmen:{},recap:{},archiv:[]});
test("Vereinslogin öffnet ohne Pilotcode; eine Vorschau sendet nur Teststimmen",async()=>{
  const b=await browser([[200,stand("test")],[200,{ok:true}]]);
  assert.equal(b.request[0].aktion,"v2-laden");
  assert.ok(!("code" in b.request[0]));
  assert.match(b.root.innerHTML,/Testvorschau/);
  assert.doesNotMatch(b.root.innerHTML,/Rundenstatistik/);
  await b.click("enthalten");
  assert.equal(b.request[1].aktion,"v2-stimme");
  assert.equal(b.request[1].test,true);
});
test("Alte Pilot-Runden behalten ihren eigenen Code-Weg",async()=>{
  const explicit=await browser([[200,{phase:"pilot"}]]);
  assert.match(explicit.root.innerHTML,/name="code"/);
  const legacy=await browser([[400,{fehler:"anfrage"}]]);
  assert.match(legacy.root.innerHTML,/name="code"/);
  const denied=await browser([[403,{fehler:"zugang"}]]);
  assert.doesNotMatch(denied.root.innerHTML,/name="code"/);
});
test("Pause blendet Clips aus; Statistik und Quellen erst im Rückblick",async()=>{
  const pause=await browser([[200,{phase:"pausiert",id:"r",archiv:[]}]]);
  assert.match(pause.root.innerHTML,/pausiert/);
  assert.doesNotMatch(pause.root.innerHTML,/data-video/);
  const daten=stand("recap");
  daten.szenen=[{...scene,feld:"Text",quelle:"https://www.dfb.de/"}];
  daten.recap={s:[{antwort:{pfiff:"foul"},anzahl:2}]};
  const rueckblick=await browser([[200,daten]]);
  assert.match(rueckblick.root.innerHTML,/<meter[^>]*value="2"/);
  assert.match(rueckblick.root.innerHTML,/href="https:\/\/www.dfb.de\/"/);
  daten.szenen[0].quelle="javascript:alert(1)";
  const unsafe=await browser([[200,daten]]);
  assert.doesNotMatch(unsafe.root.innerHTML,/javascript:/);
});
