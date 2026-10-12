import test from 'node:test';
import assert from 'node:assert/strict';
import { markiereTerminPdfs } from '../src/website/termin-pdf-markierungen.js';
import handler from '../api/protokoll-hochladen.js';

function karte(id) {
  const marken = []; const ziel = {append:m=>marken.push(m),querySelector:()=>marken[0]};
  return {marken,isConnected:true,getAttribute:()=>id,querySelector:()=>ziel};
}
const ich = {id:'synthetisch',pin:'test'};
const termin = {id:'intern',mitgliedSicht:true,eigenerVerein:true};
const dokument = {createElement:()=>({dataset:{}})};
test('PDF-Markierung fragt nur eigene Mitgliedertermine ab und liefert keine Links', async () => {
  const karten = [karte('intern'),karte('fremd'),karte('public')]; const aufrufe = [];
  await markiereTerminPdfs([termin,{id:'fremd',mitgliedSicht:true,eigenerVerein:false},{id:'public',mitgliedSicht:false,eigenerVerein:false}],ich,
    {querySelectorAll:()=>karten},{person:()=>ich,dokument,fetch:async(_,options)=>{aufrufe.push(JSON.parse(options.body));return {ok:true,json:async()=>({vorhanden:true})};}});
  assert.equal(aufrufe.length,1); assert.equal(aufrufe[0].nurStatus,true);
  assert.equal(karten[0].marken.length,1); assert.equal(karten[1].marken.length,0); assert.equal(karten[2].marken.length,0);
  assert.match(karten[0].marken[0].innerHTML,/PDF-Protokoll/);
});
test('PDF-Markierung wird nach Konto-/Ansichtswechsel verworfen', async () => {
  const k = karte('intern'); let konto = ich;
  await markiereTerminPdfs([termin],ich,{querySelectorAll:()=>[k]}, {person:()=>konto,dokument,
    fetch:async()=>{konto = {id:'anderer'}; return {ok:true,json:async()=>({vorhanden:true})};}});
  assert.equal(k.marken.length,0);
});
test('Ohne Anmeldung oder bei Fehler gibt es keine erfundene PDF-Markierung', async () => {
  const k = karte('intern'); let aufrufe=0;
  await markiereTerminPdfs([termin],null,{querySelectorAll:()=>[k]},{fetch:async()=>{aufrufe++;}});
  assert.equal(aufrufe,0);
  await markiereTerminPdfs([termin],ich,{querySelectorAll:()=>[k]},{person:()=>ich,dokument,fetch:async()=>{throw new Error('offline');}});
  assert.equal(k.marken.length,0);
});
test('Status-API verwendet geschützte RPC, aber signiert weder PDF noch gibt sie Pfade aus', async () => {
  const altFetch = globalThis.fetch; const altKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY='sb_secret_synthetischer_test';
  const res = ()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  const body = {terminId:'00000000-0000-0000-0000-000000000001',schiedsrichterId:'00000000-0000-0000-0000-000000000002',pin:'test',nurStatus:true};
  let aufrufe=0;
  try {
    globalThis.fetch = async(url,options)=>{
      aufrufe++; assert.match(String(url),/rpc\/termin_protokoll_pdf_fuer_schiri$/);
      assert.equal(JSON.parse(options.body).p_pin,'test');
      return new Response(JSON.stringify([{pfad:'privat.pdf',name:'Privat.pdf'}]));
    };
    const r=res(); await handler({method:'POST',body},r);
    assert.equal(r.code,200); assert.deepEqual(r.body,{vorhanden:true}); assert.equal(aufrufe,1);
    globalThis.fetch=async()=>new Response('[]');
    const leer=res(); await handler({method:'POST',body},leer); assert.equal(leer.code,404);
    globalThis.fetch=async()=>new Response('{}',{status:403});
    const falsch=res(); await handler({method:'POST',body},falsch); assert.equal(falsch.code,403);
    assert.equal(falsch.body.vorhanden,undefined);
  } finally {
    globalThis.fetch=altFetch;
    if (altKey===undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY=altKey;
  }
});
