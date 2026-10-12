import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erstelleSerienSteuerung } from '../src/website/wochenserie-ansicht.js';
class Element {
  constructor(doc,tag='section'){this.ownerDocument=doc;this.tagName=tag;this.children=[];this.dataset={};this.attribute={};this.textContent='';}
  append(...k){this.children.push(...k);}
  appendChild(k){this.children.push(k);return k;}
  replaceChildren(...k){this.children=k;}
  setAttribute(k,v){this.attribute[k]=v;}
  removeAttribute(k){delete this.attribute[k];}
  addEventListener(){}
  get text(){return this.textContent+this.children.map(e=>e.text||'').join(' ');}
}
const doc={createElement(tag){return new Element(doc,tag);}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const basis={jetzt:'2026-10-12T12:00:00+02:00',wochen:[]};
test('Verspätete Antwort des vorherigen Kontos wird verworfen',async()=>{
  const ziel=new Element(doc),a=deferred(),b=deferred();let person={id:'a',pin:'a-pin'};
  const rpc={rpc:(_name,p)=>p.p_schiedsrichter_id==='a'?a.promise:b.promise};
  const s=erstelleSerienSteuerung({ziel,rpc,anmeldung:{lesen:()=>person}});
  const laufA=s.laden();person={id:'b',pin:'b-pin'};const laufB=s.laden();
  a.resolve({error:null,data:basis});await laufA;
  assert.equal(ziel.text,'Deine Serie wird geladen …');
  b.resolve({error:null,data:basis});await laufB;
  assert.match(ziel.text,/Nur für dich/);assert.equal(ziel.attribute['aria-busy'],undefined);
});
test('Abmelden entfernt auch bei laufendem Request jeden persönlichen Stand',async()=>{
  const ziel=new Element(doc),a=deferred();let person={id:'a',pin:'a-pin'};
  const s=erstelleSerienSteuerung({ziel,rpc:{rpc:()=>a.promise},anmeldung:{lesen:()=>person}});
  const lauf=s.laden();person=null;await s.laden();a.resolve({data:basis,error:null});await lauf;
  assert.equal(ziel.hidden,true);assert.equal(ziel.text,'');
});
test('Netzwerkfehler und ungültige Antwort zeigen keinen erfundenen Nullstand',async()=>{
  for(const antwort of [{data:null,error:{message:'offline'}},{data:{},error:null}]) {
    const ziel=new Element(doc),person={id:'a',pin:'pin'};
    const s=erstelleSerienSteuerung({ziel,rpc:{rpc:async()=>antwort},anmeldung:{lesen:()=>person}});
    await s.laden();assert.match(ziel.text,/konnte gerade nicht geladen/);
    assert.doesNotMatch(ziel.text,/Wochen in Folge/);assert.match(ziel.text,/Erneut versuchen/);
  }
});
test('Ein verworfener Request bleibt wiederholbar statt endlos zu laden',async()=>{
  const ziel=new Element(doc),person={id:'a',pin:'pin'};
  const s=erstelleSerienSteuerung({ziel,rpc:{rpc:async()=>{throw new Error('offline');}},anmeldung:{lesen:()=>person}});
  await s.laden();assert.match(ziel.text,/Erneut versuchen/);assert.equal(ziel.attribute['aria-busy'],undefined);
});
test('Freitext im Üben verwendet Antworttext und Renderer getrennt',async()=>{
  const text=readFileSync(new URL('../src/features/history-mode.js',import.meta.url),'utf8');
  const start=text.indexOf('    async function historieFreitextAntwortAbschicken(');
  const ende=text.indexOf('    function stoppeAutoTimer()',start);
  assert.ok(start>=0 && ende>start);
  const feedback=new Element(doc),lade=new Element(doc);let gerendert=false,gesendet=null;
  const container={querySelector:s=>s==='.feedback'?feedback:lade};
  const renderer={baueFreitextErgebnisInhalt:e=>{gerendert=e.korrekt;return new Element(doc);}};
  feedback.classList={add(){}};
  const abgeben=new Function('freitext','fetch','getZugang','zeigeFehler','versteckeFehler','baueWarumButton',
    `let historieSessionGesamt=0,historieSessionRichtig=0;function aktualisiereHistorieFortschrittText(){} function zeigeHistorieWeiterButton(){} ${text.slice(start,ende)} return historieFreitextAntwortAbschicken;`)
    (renderer,async(_url,p)=>{gesendet=JSON.parse(p.body);return {ok:true,json:async()=>({korrekt:true})};},()=>({schiedsrichterId:'test',pin:'test'}),()=>{},()=>{},()=>new Element(doc));
  await abgeben('test-frage',container,{disabled:false},{value:'Meine Begründung',disabled:false});
  assert.equal(gesendet.freitext,'Meine Begründung');assert.equal(gesendet.historie,true);assert.equal(gerendert,true);
});
