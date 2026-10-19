import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pruefeSoccergolf,soccergolfRangliste,zeichneSoccergolf,sicheresPlanbild} from '../src/website/soccergolf-ergebnisse.js';
import {leseGolfZeilen} from '../src/admin/soccergolf-editor.js';
import {leseRpcAntwort} from '../src/website/termine.js';
const basis={bahnen:2,text:'Unser Tag',teilnehmer:[{name:'A',schlaege:[2,3]},{name:'B',schlaege:[1,4]},{name:'C',schlaege:[3,4]},{name:'D',schlaege:[null,1]}]};
const doc={createElement(tag){return {tag,children:[],style:{},append(...k){this.children.push(...k);},setAttribute(k,v){this[k]=v;}};}};
test('Gleiche Summen teilen einen Platz; unvollständige Runde bekommt keinen Rang',()=>{
 assert.deepEqual(soccergolfRangliste(basis).map(p=>[p.name,p.summe,p.platz]),[['A',5,1],['B',5,1],['C',7,3],['D',1,null]]);
});
test('Neue Ergebnis-RPC darf ein JSON-Objekt liefern; alte Listen behalten ihr Format',async()=>{
 assert.deepEqual(await leseRpcAntwort({text:async()=>JSON.stringify(basis)},{objekt:true}),basis);
 assert.equal(await leseRpcAntwort({text:async()=>'null'},{objekt:true}),null);
 assert.deepEqual(await leseRpcAntwort({text:async()=>JSON.stringify(basis)}),[]);
});
test('Null bleibt fehlend, falsche Werte/Anzahl/Namen werden nicht still passend gemacht',()=>{
 for(const teilnehmer of [[{name:'A',schlaege:[0,1]}],[{name:'A',schlaege:[1.5,1]}],[{name:'A',schlaege:[1]}],[{name:'A',schlaege:[1,2]},{name:'a',schlaege:[2,3]}]])assert.ok(pruefeSoccergolf({...basis,teilnehmer}).length);
 assert.deepEqual(leseGolfZeilen('Max; 2; –\nRené\t3\t4',2),[{name:'Max',schlaege:[2,null]},{name:'René',schlaege:[3,4]}]);
 assert.throws(()=>leseGolfZeilen('Max; 2',2));
});
test('Nur eigene Planbilder; kein Fremdtracking, kein HTML aus Eingaben',()=>{
 assert.equal(sicheresPlanbild('https://evil.example/bild.webp'),false);assert.equal(sicheresPlanbild('bilder/../geheim.png'),false);
 assert.equal(sicheresPlanbild('bilder/plan.webp'),true);
 const darstellung=zeichneSoccergolf(doc,{...basis,text:'<script>nicht ausführen</script>',plan_link:'https://example.org/plan'});
 assert.match(JSON.stringify(darstellung),/nicht ausführen/);assert.doesNotMatch(JSON.stringify(darstellung),/innerHTML/);
});
test('Rückblick bleibt in eigener PIN-RPC, nicht im öffentlichen Feed',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019151824_soccergolf_termin_rueckblick.sql',import.meta.url),'utf8');
 assert.match(sql,/private\.soccergolf_rueckblicke enable row level security/);assert.match(sql,/public\.schiri_pin_pruefen/);assert.match(sql,/t\.verein_id=v/);assert.match(sql,/for update/);assert.match(sql,/p_revision is distinct from/);
 assert.doesNotMatch(sql,/create (or replace )?function public\.oeffentliche/);
});
