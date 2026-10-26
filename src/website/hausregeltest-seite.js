import {DATENBANK} from '../../verein.config.js';
import {erstelleHrtZugriff,erstelleHrtSpeicher,ladeTextdatei,auswerterAdresse} from './hausregeltest.js';

const root=document.getElementById('hausregeltestBereich');
const anmeldung=globalThis.SchiriSeitenAnmeldung?.anmeldung;
const api=erstelleHrtZugriff(DATENBANK);
const sicher=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datum=x=>new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(x));
let stand=null,ich=null,kopf={},antworten=[],frage=0,speicher=null,generation=0,bestaetigungLaeuft=false;
let letzterStatus='',letzterFehler=false;
let speicherGestoppt=false;
const editierbar=()=>['vorbereitung','endfassung'].includes(stand?.phase);
function meldung(t,fehler=false){letzterStatus=t;letzterFehler=fehler;const el=root.querySelector('[data-status]');if(el){el.textContent=t;el.classList.toggle('fehler',fehler);}}
function snapshot(final=false){return {p_test_id:stand.test.id,p_phase:stand.phase,p_antworten:[...antworten],p_kopf:{...kopf},p_bestaetigen:final};}
function downloadStand(){
 const e=root.querySelector('[data-export]');if(!e)return;
 const f=stand?.bestaetigt;e.hidden=!f;
 if(f){e.querySelector('[data-empfaenger]').textContent=auswerterAdresse(f.kopf.name)||'Bitte im Originalblatt nachsehen.';}
}
function fortschritt(){
 root.querySelector('[data-fortschritt]').textContent=`${antworten.filter(x=>x.trim()).length} von ${antworten.length} beantwortet`;
 root.querySelectorAll('[data-frage]').forEach((b,i)=>{b.classList.toggle('beantwortet',Boolean(antworten[i]?.trim()));b.setAttribute('aria-label',`Frage ${i+1}${antworten[i]?.trim()?' · beantwortet':''}`);});
}
function zeichne(){
 const phase=stand.phase,test=stand.test,offen=editierbar();
 root.innerHTML=`<section class="hrt-kopf"><h1>${sicher(test.titel)}</h1><ol class="hrt-phasen"><li ${phase==='vorbereitung'?'aria-current="step"':''}>1 · Vorbereiten</li><li ${phase==='endfassung'?'aria-current="step"':''}>2 · Besprechen</li><li ${stand.bestaetigt?'aria-current="step"':''}>3 · Textdatei</li></ol>
 <p>${phase==='vorbereitung'?`Eigene Antworten bis ${datum(new Date(new Date(test.vorbereitung_bis)-1))} eintragen und ändern. Ab ${datum(test.endfassung_ab)} überarbeiten wir sie gemeinsam.`:phase==='pause'?'Die Vorbereitung ist abgeschlossen. Die Überarbeitung öffnet zur Besprechung.':phase==='endfassung'?'Deine Vorantworten sind übernommen. Überarbeite sie und bestätige anschließend deine eigene Endfassung.':'Die Bearbeitungsfrist ist beendet. Bestätigte Textdateien bleiben herunterladbar.'}</p><span>Keine KI-Bewertung · kein Wochenquiz</span></section>
 <div class="hrt-meta hrt-panel">${['name','verein','einstufung'].map((k,i)=>`<label>${['Name','Verein','Einstufung'][i]}<input data-kopf="${k}" value="${sicher(kopf[k])}" maxlength="150" ${!offen?'disabled':''} autocomplete="off"></label>`).join('')}</div>
 <p class="hrt-status" data-status role="status" aria-live="polite">Geladen. ${offen?'Änderungen werden automatisch gespeichert.':''}</p>
 <div class="hrt-aktionen"><button class="knopf" data-retry type="button" hidden>Speichern erneut versuchen</button><button class="knopf" data-reload type="button">Stand neu laden</button></div>
 <p data-fortschritt></p><nav class="hrt-fragen" aria-label="Frage auswählen">${test.fragen.map((_,i)=>`<button type="button" data-frage="${i}" ${i===frage?'aria-current="true"':''}>${i+1}</button>`).join('')}</nav>
 <section class="hrt-panel"><h2 id="hrt-frage-titel" tabindex="-1">Frage ${frage+1}</h2><p class="hrt-frage">${sicher(test.fragen[frage])}</p>
 <label>Deine ${phase==='vorbereitung'?'Vorantwort':'Antwort'}<textarea data-antwort maxlength="5000" rows="6" ${!offen?'disabled':''}>${sicher(antworten[frage])}</textarea></label>
 ${phase!=='vorbereitung'&&stand.vor_antworten[frage]?`<details><summary>Meine ursprüngliche Vorantwort</summary><p class="hrt-ursprung">${sicher(stand.vor_antworten[frage])}</p></details>`:''}
 <div class="hrt-aktionen"><button class="knopf" data-vor type="button" ${frage===0?'disabled':''}>Vorherige Frage</button><button class="knopf" data-nach type="button" ${frage===test.fragen.length-1?'disabled':''}>Nächste Frage</button></div></section>
 <div class="hrt-panel"><p>Wenn die Frage nichts anderes verlangt: persönliche Strafe sowie Art, Ort und ausführende Mannschaft der Spielfortsetzung nennen. Abgabe an den Auswerter bis ${datum(new Date(new Date(test.abgabe_bis)-1))}.</p>
 <details><summary>Hinweise und Abkürzungen</summary><p>IF = indirekter Freistoß · DF = direkter Freistoß · SRB = Schiedsrichterball · GK = gelbe Karte · GRK = gelb-rote Karte · RK = rote Karte.</p><p><a href="dokumente/hausregeltest-1-2026-2027.pdf">Original-Aufgabenblatt des SVFD (PDF)</a></p><p>Deine Antworten können von deinem Obmann zur Vorbereitung eingesehen werden. Andere Schiris sehen sie hier nicht. Es werden keine Musterantworten oder automatischen Umformulierungen erzeugt.</p></details>
 ${phase==='endfassung'?'<button type="button" class="knopf knopf-primaer" data-final>Endfassung bestätigen</button>':''}</div>
 <section data-export class="hrt-panel hrt-erfolg" hidden><h2>Deine Textdatei ist bereit</h2><button type="button" class="knopf knopf-primaer" data-download>Textdatei herunterladen</button><p>Auswerter: <strong data-empfaenger></strong> · Zuordnung nach dem Nachnamen im Feld „Name“; bitte vor Versand am Originalblatt prüfen.</p><p>Die Datei noch selbst als Anhang per E-Mail senden. Hier wird nichts automatisch verschickt.</p></section>`;
 fortschritt();downloadStand();if(letzterStatus)meldung(letzterStatus,letzterFehler);root.querySelector('[data-retry]').hidden=!speicherGestoppt;
}
async function laden(){
 const n=++generation;speicher?.stop();ich=anmeldung?.lesen()||null;stand=null;letzterStatus='';letzterFehler=false;speicherGestoppt=false;
 root.innerHTML=ich?'<h1>Hausregeltest</h1><p role="status">Wird geladen …</p>':'<h1>Hausregeltest</h1><p>Mit deinen Vereinszugangsdaten anmelden, um deine Antworten zu bearbeiten.</p><button type="button" class="knopf knopf-primaer" data-login>Anmelden</button>';
 if(!ich)return;
 try{
  const d=await api.laden(ich);if(n!==generation)return;
  if(!d){root.innerHTML='<h1>Hausregeltest</h1><p>Dein Verein hat hier noch keinen Hausregeltest bereitgestellt.</p><a href="modus.html">Zur Quizübersicht</a>';return;}
  stand=d;kopf={...d.kopf};antworten=d.test.fragen.map((_,i)=>d.antworten[i]||'');frage=Math.min(frage,antworten.length-1);zeichne();
  const person={...ich};
  speicher=erstelleHrtSpeicher({senden:x=>api.speichern(person,{...x,p_revision:stand.revision}),
   erfolg:(data,x,mehr)=>{if(n!==generation)return;speicherGestoppt=false;stand.revision=data.revision;stand.bestaetigt=mehr?null:data.bestaetigt;
    if(data.phase!==stand.phase){meldung('Die Phase hat gewechselt. Bitte Stand neu laden.',true);return;}
    meldung(mehr?'Weitere Änderungen werden gespeichert …':x.p_bestaetigen?'Endfassung bestätigt. Textdatei jetzt herunterladen.':'Gespeichert.');
    root.querySelector('[data-retry]').hidden=true;if(!bestaetigungLaeuft||x.p_bestaetigen){bestaetigungLaeuft=false;root.querySelectorAll('input,textarea,[data-final]').forEach(e=>e.disabled=!editierbar());}downloadStand();},
   fehler:e=>{if(n!==generation)return;speicherGestoppt=true;meldung(`${e.message} Deine Eingabe bleibt in diesem Fenster erhalten. Nicht ungesichert schließen.`,true);root.querySelector('[data-retry]').hidden=false;bestaetigungLaeuft=false;root.querySelectorAll('input,textarea,[data-final]').forEach(e=>e.disabled=!editierbar());}});
 }catch(e){if(n===generation){root.innerHTML='<h1>Hausregeltest</h1><p data-status role="status"></p><button type="button" class="knopf" data-reload>Erneut laden</button>';meldung(e.message,true);}}
}
root.addEventListener('input',e=>{
 if(!editierbar()||bestaetigungLaeuft)return;
 if(e.target.matches('[data-antwort]'))antworten[frage]=e.target.value;
 else if(e.target.dataset.kopf)kopf[e.target.dataset.kopf]=e.target.value.replace(/[\r\n]/g,' ');else return;
 stand.bestaetigt=null;downloadStand();fortschritt();meldung('Noch nicht gespeichert …');speicher.merken(snapshot());
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-login')){const r=await globalThis.SchiriSeitenAnmeldung?.loginDialog?.oeffne({grund:'Melde dich für deinen Hausregeltest an.',gastErlaubt:false});if(r?.status==='angemeldet')void laden();return;}
 if(b.hasAttribute('data-reload')){if(speicher?.offen()&&!confirm('Es gibt ungespeicherte Antworten. Vor dem Neuladen bitte kopieren. Trotzdem neu laden?'))return;void laden();return;}
 if(b.hasAttribute('data-retry')){void speicher.retry();return;}
 if(b.hasAttribute('data-download')){try{ladeTextdatei(stand.bestaetigt);}catch(err){meldung(err.message,true);}return;}
 if(bestaetigungLaeuft)return;
 if(b.hasAttribute('data-final')){
  if(speicherGestoppt){meldung('Bitte zuerst „Speichern erneut versuchen“ wählen.',true);return;}
  if(!antworten.every(x=>x.trim())||!['name','verein','einstufung'].every(k=>kopf[k]?.trim())){meldung('Bitte alle zehn Antworten sowie Name, Verein und Einstufung ausfüllen.',true);return;}
  if(!confirm('Diese eigene Endfassung bestätigen und als Textdatei bereitstellen? Es wird noch keine E-Mail verschickt.'))return;
  bestaetigungLaeuft=true;root.querySelectorAll('input,textarea,[data-final]').forEach(el=>el.disabled=true);speicher.merken(snapshot(true));void speicher.flush();return;
 }
 if(b.hasAttribute('data-frage'))frage=Number(b.dataset.frage);else if(b.hasAttribute('data-vor'))frage--;else if(b.hasAttribute('data-nach'))frage++;else return;
 zeichne();root.querySelector('#hrt-frage-titel').focus();
});
window.addEventListener('beforeunload',e=>{if(speicher?.offen()){e.preventDefault();e.returnValue='';}});
if(anmeldung?.abonniere)anmeldung.abonniere(()=>void laden());else void laden();
