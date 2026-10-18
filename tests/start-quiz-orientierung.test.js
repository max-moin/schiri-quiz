import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {darfZurueckziehen, schiriAktionen} from '../src/website/prozess-linie.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Wochenquiz direkt unter kleinerem Aufmacher, kein verwechselbarer Gastlink',()=>{
 const html=read('index.html');
 assert.ok(html.indexOf('class="wochenquiz-einstieg"')>html.indexOf('class="aufmacher"'));
 assert.ok(html.indexOf('class="wochenquiz-einstieg"')<html.indexOf('id="aktuelles"'));
 assert.match(html,/href="quiz.html">Zum Wochenquiz/);
 assert.doesNotMatch(html,/href="quiz.html#gast"|start.knopf-rechts/);
 assert.match(html,/href="schiri-werden.html"/);
});
test('Vier Foto-Themen behalten Fotos und haben dekorative, eindeutige Symbole',()=>{
 const html=read('index.html');
 for(const topic of ['termine','absage','melden','unterlagen'])assert.match(html,new RegExp('class="schnellweg-icon '+topic+'" aria-hidden="true"><svg'));
 assert.equal((html.match(/class="ki-bildmarke"/g)||[]).length,4);
 assert.match(read('stil/startseite.css'),/\.schnellweg-icon svg/);
});
test('Gast vor Start und beim Spielen eindeutig; bestehender Mitgliedereinstieg bleibt',()=>{
 const html=read('quiz.html');
 assert.match(html,/<div id="gast-bereich" hidden>\s*<div class="gast-modus-hinweis">/);
 assert.match(html,/<section id="gast-quiz-schritt" hidden>\s*<div class="gast-modus-hinweis">/);
 assert.match(html,/Gästequiz · nicht dein Wochenquiz/);
 assert.match(html,/id="gast-verlassen-button"[^>]*>← Für das Wochenquiz anmelden/);
 assert.match(read('src/features/guest-mode.js'),/verlassenButton.addEventListener\("click", zuruecksetzen\)/);
});
test('Rücknahme nur explizit freigegeben, keine abgeleiteten Statusberechtigungen',()=>{
 for(const value of [null,{}, {prozess_status:'eingereicht'}, {meine_aktionen:[]}, {meine_aktionen:[{schritt:'gekauft'}]}])assert.equal(darfZurueckziehen(value),false);
 const request={meine_aktionen:[{schritt:'zurueckgezogen'},{schritt:'gekauft'}]};
 assert.equal(darfZurueckziehen(request),true);
 assert.deepEqual(schiriAktionen(request),[{schritt:'gekauft',wort:'Gekauft · Beleg folgt'}]);
});
test('Rücknahme ist bestätigter eigener Schritt, keine Löschoperation',()=>{
 const code=read('src/website/ausruestung-seite.js'), dialog=read('src/website/anfrage-ruecknahme.js');
 assert.match(code,/await bestaetigeRuecknahme/);
 assert.match(code,/p_schritt: "zurueckgezogen"/);
 assert.match(dialog,/dialog.showModal\(\)/);
 assert.match(dialog,/behalten.autofocus = true/);
 assert.match(dialog,/dialog.returnValue === "zurueckziehen"/);
 assert.match(dialog,/Andere Artikel deiner Anfrage bleiben unverändert/);
 assert.match(dialog,/ausloeser.focus\(\)/);
});
