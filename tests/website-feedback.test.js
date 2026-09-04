import test from 'node:test';
import assert from 'node:assert/strict';
import { gastFeedbackEingabe, gastLimitSchluessel } from '../server/website-feedback.js';
import handler from '../api/website-feedback.js';

test('Gastfeedback: Textgrenzen, optionaler ungeprüfter Name, keine fremden Felder', () => {
  assert.deepEqual(gastFeedbackEingabe({seite:'test-verein',text:' Hallo ',name:'Max\nM.'}),
    {p_seite:'test-verein',p_text:'Freiwilliger Name (nicht geprüft): Max M.\n\nHallo'});
  assert.deepEqual(gastFeedbackEingabe({seite:'test',text:'Hallo',schiedsrichter_id:'injected',art:'gespraech'}),
    {p_seite:'test',p_text:'Hallo'});
  for (const input of [null,[],{}, {seite:'test',text:''},{seite:'test',text:'x'.repeat(3801)},
    {seite:'test',text:'x',name:'n'.repeat(81)},{seite:'../../test',text:'x'}]) assert.equal(gastFeedbackEingabe(input),null);
});

test('Limiter: keine Klartext-IP, täglich anderer Hash, ungültige Quelle fail-closed', () => {
  const old = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    const req = {headers:{'x-forwarded-for':'192.0.2.1'}};
    const a = gastLimitSchluessel(req,'test-secret',new Date('2026-09-04'));
    assert.match(a,/^[a-f0-9]{64}$/);
    assert.notEqual(a,gastLimitSchluessel(req,'test-secret',new Date('2026-09-05')));
    assert.equal(gastLimitSchluessel({headers:{}},'test-secret'),null);
    assert.equal(gastLimitSchluessel(req,''),null);
  } finally { if (old === undefined) delete process.env.VERCEL; else process.env.VERCEL = old; }
});

test('Gast-API: Methode, Format, Erfolg, Quota und Fehler ohne geheime Details', async () => {
  const oldFetch = globalThis.fetch, oldSecret = process.env.SUPABASE_SECRET_KEY;
  const oldVercel = process.env.VERCEL;
  process.env.SUPABASE_SECRET_KEY = 'server-test-secret'; process.env.VERCEL = '1';
  const request = {method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.4'},body:{seite:'test',text:'Test'}};
  const run = async req => {
    const res = {headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
    await handler(req,res); return res;
  };
  try {
    assert.equal((await run({...request,method:'GET'})).code,405);
    assert.equal((await run({...request,headers:{}})).code,415);
    assert.equal((await run({...request,body:{}})).code,400);
    globalThis.fetch = async (url,options) => {
      assert.ok(url.endsWith('/rpc/website_feedback_gast'));
      assert.equal(options.headers.apikey,'server-test-secret');
      const data = JSON.parse(options.body);
      assert.equal(data.p_text,'Test'); assert.match(data.p_limit_schluessel,/^[a-f0-9]{64}$/);
      return new Response(JSON.stringify({ok:true}),{status:200});
    };
    assert.equal((await run(request)).code,200);
    globalThis.fetch = async () => new Response(JSON.stringify({ok:false,limit:true}),{status:200});
    const limited = await run(request); assert.equal(limited.code,429); assert.equal(limited.headers['Retry-After'],'900');
    globalThis.fetch = async () => { throw new Error('secret-database-detail'); };
    const failed = await run(request); assert.equal(failed.code,503); assert.ok(!JSON.stringify(failed.body).includes('secret-database-detail'));
  } finally {
    globalThis.fetch = oldFetch;
    if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY=oldSecret;
    if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL=oldVercel;
  }
});
