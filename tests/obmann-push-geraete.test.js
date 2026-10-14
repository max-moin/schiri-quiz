import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../api/push-test.js';
import { vapidSchluesselpaarErzeugen } from '../server/webpush.js';
const res=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});
test('Obmann-Geräteliste schützt Anmeldung und gibt keine Endpunkte/Schlüssel aus',async()=>{
  const key=process.env.SUPABASE_SECRET_KEY,alt=globalThis.fetch;process.env.SUPABASE_SECRET_KEY='sb_secret_synthetisch';
  try{
    globalThis.fetch=async(url,options)=>{
      assert.match(url,/rpc\/obmann_push_geraete_v2$/);assert.equal(JSON.parse(options.body).p_passwort,'synthetisch');
      return new Response(JSON.stringify([{name:'Test',abo_id:'test',endpunkt:'privat',auth:'privat',p256dh:'privat'}]));
    };
    const r=res();await handler({method:'POST',body:{aktion:'obmann_geraete',passwort:'synthetisch'}},r);
    assert.equal(r.code,200);assert.equal(r.body.geraete[0].name,'Test');
    assert.equal(r.body.geraete[0].endpunkt,undefined);assert.equal(r.body.geraete[0].auth,undefined);
    globalThis.fetch=async()=>new Response('{}',{status:403});
    const falsch=res();await handler({method:'POST',body:{aktion:'obmann_geraete',passwort:'falsch'}},falsch);assert.equal(falsch.code,403);
    const fehlt=res();await handler({method:'POST',body:{aktion:'obmann_geraete'}},fehlt);assert.equal(fehlt.code,400);
  }finally{globalThis.fetch=alt;if(key===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=key}
});
test('Gerätetest kann weder beliebigen Ziel-URL noch freien Text verwenden',async()=>{
  const r=res();await handler({method:'POST',body:{aktion:'obmann_test',passwort:'test',aboId:'https://intern.example'}},r);assert.equal(r.code,400);
});

test('Obmann-Test sendet ausschließlich an das ausgewählte Gerät und behandelt Ablauf/Rate-Limit',async()=>{
  const alt={...process.env},fetchAlt=globalThis.fetch;
  const vapid=vapidSchluesselpaarErzeugen(),client=vapidSchluesselpaarErzeugen();
  const id='11111111-1111-4111-8111-111111111111',endpunkt='https://web.push.apple.com/synthetischer-test';
  try {
    Object.assign(process.env,{SUPABASE_SECRET_KEY:'sb_secret_synthetisch',PUSH_TEST_AKTIV:'true',
      VAPID_PRIVATER_SCHLUESSEL:vapid.privat,VAPID_SUB:'mailto:test@example.org'});
    let pushStatus=201,limitiert=false;const aufrufe=[];
    globalThis.fetch=async(url,options)=>{
      aufrufe.push(String(url));
      if(String(url).endsWith('/rpc/obmann_push_test_abo')) {
        assert.deepEqual(JSON.parse(options.body),{p_passwort:'synthetisch',p_abo_id:id});
        if(limitiert)return new Response(JSON.stringify({message:'Bitte warte eine Minute vor dem nächsten Gerätetest.'}),{status:400});
        return new Response(JSON.stringify([{id,endpunkt,p256dh:client.oeffentlich,auth:Buffer.alloc(16,7).toString('base64url')}]));
      }
      if(String(url).endsWith('/rpc/push_abo_entfernen')) {
        assert.deepEqual(JSON.parse(options.body),{p_id:id});return new Response('{}');
      }
      assert.equal(String(url),endpunkt);assert.equal(options.method,'POST');assert.ok(options.body.length>0);
      return new Response(null,{status:pushStatus});
    };
    const req={method:'POST',body:{aktion:'obmann_test',passwort:'synthetisch',aboId:id,text:'Wird ignoriert'}};
    const gut=res();await handler(req,gut);assert.equal(gut.code,200);assert.equal(aufrufe.filter(x=>x===endpunkt).length,1);
    pushStatus=410;const abgelaufen=res();await handler(req,abgelaufen);assert.equal(abgelaufen.code,409);
    assert.ok(aufrufe.at(-1).endsWith('/rpc/push_abo_entfernen'));
    limitiert=true;const vorher=aufrufe.filter(x=>x===endpunkt).length;
    const schnell=res();await handler(req,schnell);assert.equal(schnell.code,429);
    assert.equal(aufrufe.filter(x=>x===endpunkt).length,vorher);
  } finally {
    globalThis.fetch=fetchAlt;
    for(const k of Object.keys(process.env))if(!(k in alt))delete process.env[k];Object.assign(process.env,alt);
  }
});
