import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gleicherGuideBlock } from '../src/website/guide-redaktion.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('JSONB-Schlüsselreihenfolge verändert weder Inhalte noch freigegebenes Layout',()=>{
 assert.equal(gleicherGuideBlock({id:'a',eintraege:[{titel:'T',text:'X'}]},{eintraege:[{text:'X',titel:'T'}],id:'a'}),true);
 assert.equal(gleicherGuideBlock({eintraege:['a','b']},{eintraege:['b','a']}),false);
 assert.equal(gleicherGuideBlock({text:'a'},{text:'b'}),false);
 assert.equal(gleicherGuideBlock({text:'a'},null),false);
});
test('Guide-Redaktion nutzt vorhandene sichere Speicherung, keine eigene Anmeldung',()=>{
 const h=lies('rote-karte.html'),start=lies('src/website/rote-karte-redaktion.js');
 assert.match(h,/src\/website\/rote-karte-redaktion\.js/);
 assert.match(start,/seite:'rote-karte'/);
 assert.match(start,/montiereBlockeditor/);
 assert.doesNotMatch(start,/service_role|signInWithPassword|localStorage/);
});
test('Feste Guide-Struktur erhält Layout und schützt globale Hilfekomponenten',()=>{
 const a=lies('src/website/guide-redaktion.js');
 assert.match(a,/festeStruktur:true/);assert.match(a,/textlisten:true/);
 assert.match(a,/vorlage:'rote-karte-v1'/);
 assert.match(a,/Die feste Guide-Struktur ist unvollständig/);
 assert.match(a,/werkzeuge=\[\.\.\.ziel\.children\]/);
 assert.doesNotMatch(a,/innerHTML\s*=|eval\(/);
 assert.match(a,/sichereBlockURL\(b\.url,true\)/);
});
test('Editor-Dialoge haben Namen, Fokusrückkehr und getrennte Entwurfsprüfung',()=>{
 const editor=lies('src/admin/blockeditor.js'),login=lies('src/ui/login-dialog.js'),termine=lies('src/website/termine-seite.js');
 assert.match(editor,/aria-labelledby/);assert.match(editor,/fokusRueckkehr/);
 assert.match(editor,/if \(pruefen\(entwurf\)\.length\)/);
 assert.match(login,/schiri-anmelde-dialog-titel/);
 assert.match(termine,/aria-labelledby', 'termin-vorschlag-titel'/);
 assert.match(lies('rote-karte.html'),/class="rk-ansicht" role="group" aria-label="Textumfang"/);
});
test('Grau auf hellem Verlauf und helle Quiz-Kacheltexte behalten AA-Kontrast',()=>{
 assert.match(lies('style.css'),/--muted: #5b6371/);
 assert.match(lies('stil/modus.css'),/\.hervorgehoben \.modus-fuss \{ color: rgba\(255, 255, 255, \.9\)/);
 const luminanz=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const kontrast=(a,b)=>{const x=luminanz(a),y=luminanz(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 assert.ok(kontrast([91,99,113],[238,240,244])>=4.5);
 const blau=[29,78,216],weiss=blau.map(v=>255*.9+v*.1);
 assert.ok(kontrast(weiss,blau)>=4.5);
});
test('Neue Seite erweitert lediglich vorhandene AAL2- und Vereinsprüfung',()=>{
 const sql=lies('supabase/migrations/20261016164939_rote_karte_blockredaktion.sql');
 assert.match(sql,/'rote-karte'/);assert.match(sql,/auth\.uid\(\) is null/);assert.match(sql,/'aal2'/);
 assert.match(sql,/seitenschluessel=p_seitenschluessel/);
 assert.match(sql,/revoke all on function private\.blockredaktion_pruefen/);
 assert.doesNotMatch(sql,/grant .*entwurf|update public\.website_blockseiten|insert into public\.website_blockseiten/);
});
