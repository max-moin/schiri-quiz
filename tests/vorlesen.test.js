import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(unterstuetzt=true) {
  const ansagen=[];
  const element=()=>({innerHTML:'',textContent:'',className:'',attribute:{},events:{},
    classList:{s:new Set(),add(s){this.s.add(s)},remove(s){this.s.delete(s)},contains(s){return this.s.has(s)}},
    setAttribute(k,v){this.attribute[k]=v},addEventListener(k,f){this.events[k]=f},insertAdjacentElement(_,e){this.hinweis=e}});
  const c={document:{createElement:element},SpeechSynthesisUtterance:unterstuetzt?function(text){this.text=text}:undefined};
  if(unterstuetzt)c.speechSynthesis={cancel(){},getVoices:()=>[{lang:'de-DE',localService:true,name:'Test'}],speak:u=>ansagen.push(u)};
  vm.runInNewContext(readFileSync(new URL('../src/ui/text-to-speech.js',import.meta.url),'utf8'),c);
  return {api:c.SchiriQuizTextToSpeech,ansagen};
}
const click=b=>b.events.click({preventDefault(){}});
test('Fehlende Browser-TTS lässt Lautsprecher und verständlichen Hinweis stehen',()=>{
  const s=setup(false),b=s.api.baueVorlesenButton('Testfrage');
  assert.match(b.innerHTML,/<svg/);click(b);assert.match(b.hinweis.textContent,/unterstützt.*nicht/);
});
test('Vorlesen startet nur beim Tippen und wählt eine deutsche lokale Stimme',()=>{
  const s=setup(),b=s.api.baueVorlesenButton('Testfrage');assert.equal(s.ansagen.length,0);
  click(b);assert.equal(s.ansagen.length,1);assert.equal(s.ansagen[0].voice.name,'Test');
  assert.equal(b.attribute['aria-pressed'],'true');s.ansagen[0].onend();assert.equal(b.attribute['aria-pressed'],'false');
});
test('Spätes Ende einer alten Ansage setzt den neuen Vorlese-Button nicht zurück',()=>{
  const s=setup(),b=s.api.baueVorlesenButton('Testfrage');click(b);const alt=s.ansagen[0];
  s.api.stoppeVorlesen();click(b);alt.onend();assert.equal(b.attribute['aria-pressed'],'true');
  s.ansagen[1].onerror();assert.equal(b.attribute['aria-pressed'],'false');assert.match(b.hinweis.textContent,/nicht gestartet/);
});
