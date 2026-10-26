import {DATENBANK} from '../../verein.config.js';
import {erstelleHrtZugriff,erstelleHrtSpeicher,ladeTextdatei,auswerterAdresse,mitExportname} from './hausregeltest.js';

const root=document.getElementById('hausregeltestBereich');
// Gleiche Anmeldung wie im Wochenquiz, aber ohne die Navigation der Vereinsseite.
const anmeldung=globalThis.SchiriAnmeldung?.erstelleAnmeldung(DATENBANK);
const loginDialog=globalThis.SchiriLoginDialog?.erstelleLoginDialog({anmeldung,maskierung:globalThis.SchiriQuizMaskedInputs});
const api=erstelleHrtZugriff(DATENBANK);
const sicher=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const datum=x=>new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(x));
let stand=null,ich=null,kopf={},antworten=[],frage=0,speicher=null,generation=0,bestaetigungLaeuft=false;
let letzterStatus='',letzterFehler=false;
let speicherGestoppt=false;
let exportName='';
const editierbar=()=>['vorbereitung','endfassung'].includes(stand?.phase);
function meldung(t,fehler=false){letzterStatus=t;letzterFehler=fehler;const el=root.querySelector('[data-status]');if(el){el.textContent=t;el.classList.toggle('fehler',fehler);}}
function snapshot(final=false){return {p_test_id:stand.test.id,p_phase:stand.phase,p_antworten:[...antworten],p_bestaetigen:final};}
function downloadStand(){
 const e=root.querySelector('[data-export]');if(!e)return;
 const f=stand?.bestaetigt;e.hidden=!f;
 root.querySelectorAll('.hrt-phasen li').forEach((li,i)=>{
  const aktiv=f?i===2:stand.phase==='vorbereitung'?i===0:stand.phase==='endfassung'&&i===1;
  if(aktiv)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');
 });
 const finalKnopf=root.querySelector('[data-final]');if(finalKnopf)finalKnopf.disabled=Boolean(f)||!editierbar()||bestaetigungLaeuft;
 if(f){e.querySelector('[data-empfaenger]').textContent=auswerterAdresse(exportName.trim()||f.kopf.name)||'Bitte im Originalblatt nachsehen.';}
}
function fortschritt(){
 root.querySelector('[data-fortschritt]').textContent=`${antworten.filter(x=>x.trim()).length} von ${antworten.length} beantwortet`;
 root.querySelectorAll('[data-frage]').forEach((b,i)=>{b.classList.toggle('beantwortet',Boolean(antworten[i]?.trim()));b.setAttribute('aria-label',`Frage ${i+1}${antworten[i]?.trim()?' · beantwortet':''}`);});
}
function zeichne(){
 const phase=stand.phase,test=stand.test,offen=editierbar();
 root.innerHTML=`<section class="hrt-kopf"><span class="hrt-kicker">In Ruhe vorbereiten · ohne Bewertung</span><h1>${sicher(test.titel)}</h1><ol class="hrt-phasen" aria-label="Dein Ablauf"><li ${phase==='vorbereitung'?'aria-current="step"':''}>1 · Vorbereiten</li><li ${phase==='endfassung'&&!stand.bestaetigt?'aria-current="step"':''}>2 · Besprechen</li><li ${stand.bestaetigt?'aria-current="step"':''}>3 · Textdatei</li></ol>
 <p>${phase==='vorbereitung'?`Deine Antworten bis ${datum(new Date(new Date(test.vorbereitung_bis)-1))}. Ab ${datum(test.endfassung_ab)} kannst du sie zur Besprechung überarbeiten.`:phase==='pause'?'Die Vorbereitung ist abgeschlossen. Die Überarbeitung öffnet zur Besprechung.':phase==='endfassung'?'Deine Vorantworten sind übernommen. Überarbeite sie und bestätige deine eigene Endfassung.':'Die Bearbeitungsfrist ist beendet. Bestätigte Textdateien bleiben herunterladbar.'}</p></section>
 <section class="hrt-meta hrt-panel" aria-label="Deine Angaben">
 <div><span class="hrt-feldname">Name</span><strong>${sicher(kopf.name)}</strong><label>Voller Name für die Textdatei (optional)<input data-export-name value="${sicher(exportName)}" maxlength="150" autocomplete="off" aria-describedby="hrt-name-hilfe"></label><small id="hrt-name-hilfe">Nur in deinem TXT-Download, nicht im gespeicherten Antwortstand. Nach Neuladen erneut eintragen.</small></div>
 <div><span class="hrt-feldname">Verein</span><strong>${sicher(kopf.verein)}</strong></div>
 <div><span class="hrt-feldname">Einstufung</span><strong>${sicher(kopf.einstufung)||'Noch nicht hinterlegt'}</strong><small>${kopf.einstufung?'Aus deinen Vereinsdaten übernommen.':'Dein Obmann ergänzt sie in der App. Du kannst schon antworten.'}</small></div></section>
 <div class="hrt-speicherleiste"><p class="hrt-status" data-status role="status" aria-live="polite">${offen?'Antworten werden automatisch gespeichert.':'Gespeicherter Stand.'}</p>
 <div class="hrt-aktionen"><button class="knopf" data-retry type="button" hidden>Speichern erneut versuchen</button><button class="knopf hrt-neuladen" data-reload type="button">Stand neu laden</button></div></div>
 <p class="hrt-fortschritt" data-fortschritt></p><nav class="hrt-fragen" aria-label="Frage auswählen">${test.fragen.map((_,i)=>`<button type="button" data-frage="${i}" ${i===frage?'aria-current="true"':''}>${i+1}</button>`).join('')}</nav>
 <section class="hrt-panel hrt-fragekarte"><div class="hrt-fragekopf"><span class="hrt-fragenummer" aria-hidden="true">${frage+1}</span><h2 id="hrt-frage-titel" tabindex="-1">Frage ${frage+1} von ${test.fragen.length}</h2></div><p class="hrt-frage">${sicher(test.fragen[frage])}</p>
 <label>Deine ${phase==='vorbereitung'?'Vorantwort':'Antwort'}<textarea data-antwort maxlength="5000" rows="6" ${!offen?'disabled':''}>${sicher(antworten[frage])}</textarea></label>
 ${phase!=='vorbereitung'&&stand.vor_antworten[frage]?`<button type="button" class="knopf hrt-ursprung-knopf" data-ursprung aria-expanded="false" aria-controls="hrt-ursprung">Meine Vorantwort</button><p id="hrt-ursprung" class="hrt-ursprung" hidden>${sicher(stand.vor_antworten[frage])}</p>`:''}
 <div class="hrt-aktionen"><button class="knopf" data-vor type="button" ${frage===0?'disabled':''}>Vorherige Frage</button><button class="knopf" data-nach type="button" ${frage===test.fragen.length-1?'disabled':''}>Nächste Frage</button></div></section>
 <aside class="hrt-panel hrt-hinweise" aria-labelledby="hrt-hinweise-titel"><h2 id="hrt-hinweise-titel">Das gehört in deine Antwort</h2><p>Wenn nicht anders gefragt: <strong>persönliche Strafe</strong> und <strong>Art, Ort, Mannschaft</strong> der Spielfortsetzung.</p>
 <dl class="hrt-kuerzel" aria-label="Abkürzungen">${[['IF','Indirekter Freistoß'],['DF','Direkter Freistoß'],['SRB','Schiedsrichterball'],['GK','Gelbe Karte'],['GRK','Gelb-rote Karte'],['RK','Rote Karte']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
 <a href="dokumente/hausregeltest-1-2026-2027.pdf">Original-Aufgabenblatt (PDF)</a><p class="hrt-info">Dein Obmann sieht deine Antworten zur Vorbereitung. Andere Schiris sehen sie nicht. Keine KI-Bewertung und keine Musterlösungen.</p></aside>
 <div class="hrt-abschluss"><span class="hrt-info">Abgabe bis ${datum(new Date(new Date(test.abgabe_bis)-1))}</span>${phase==='endfassung'?'<button type="button" class="knopf knopf-primaer" data-final>Endfassung bestätigen</button>':''}</div>
 <section data-export class="hrt-panel hrt-erfolg" hidden><h2>Deine Textdatei ist bereit</h2><button type="button" class="knopf knopf-primaer" data-download>Textdatei herunterladen</button><p>Auswerter: <strong data-empfaenger></strong> · Zuordnung nach dem Nachnamen im Feld „Name“; bitte vor Versand am Originalblatt prüfen.</p><p>Die Datei noch selbst als Anhang per E-Mail senden. Hier wird nichts automatisch verschickt.</p></section>`;
 fortschritt();downloadStand();if(letzterStatus)meldung(letzterStatus,letzterFehler);root.querySelector('[data-retry]').hidden=!speicherGestoppt;
}
async function laden(){
 const n=++generation;speicher?.stop();const neu=anmeldung?.lesen()||null;if(neu?.id!==ich?.id)exportName='';ich=neu;stand=null;letzterStatus='';letzterFehler=false;speicherGestoppt=false;bestaetigungLaeuft=false;
 document.querySelector('[data-konto]').hidden=!ich;
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
    root.querySelector('[data-retry]').hidden=true;if(!bestaetigungLaeuft||x.p_bestaetigen){bestaetigungLaeuft=false;root.querySelectorAll('textarea,[data-final]').forEach(e=>e.disabled=!editierbar());}downloadStand();},
   fehler:e=>{if(n!==generation)return;speicherGestoppt=true;meldung(`${e.message} Deine Eingabe bleibt in diesem Fenster erhalten. Nicht ungesichert schließen.`,true);root.querySelector('[data-retry]').hidden=false;bestaetigungLaeuft=false;root.querySelectorAll('textarea,[data-final]').forEach(e=>e.disabled=!editierbar());}});
 }catch(e){if(n===generation){root.innerHTML='<h1>Hausregeltest</h1><p data-status role="status"></p><button type="button" class="knopf" data-reload>Erneut laden</button>';meldung(e.message,true);}}
}
root.addEventListener('input',e=>{
 if(e.target.matches('[data-export-name]')){exportName=e.target.value;downloadStand();return;}
 if(!editierbar()||bestaetigungLaeuft)return;
 if(e.target.matches('[data-antwort]'))antworten[frage]=e.target.value;
 else return;
 stand.bestaetigt=null;downloadStand();fortschritt();meldung('Noch nicht gespeichert …');speicher.merken(snapshot());
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-login')){await loginDialog?.oeffne({grund:'Melde dich für deinen Hausregeltest an.',gastErlaubt:false});return;}
 if(b.hasAttribute('data-reload')){if(speicher?.offen()&&!confirm('Es gibt ungespeicherte Antworten. Vor dem Neuladen bitte kopieren. Trotzdem neu laden?'))return;void laden();return;}
 if(b.hasAttribute('data-retry')){void speicher.retry();return;}
 if(b.hasAttribute('data-download')){try{ladeTextdatei(mitExportname(stand.bestaetigt,exportName));}catch(err){meldung(err.message,true);}return;}
 if(b.hasAttribute('data-ursprung')){const el=root.querySelector('#hrt-ursprung');el.hidden=!el.hidden;b.setAttribute('aria-expanded',String(!el.hidden));return;}
 if(bestaetigungLaeuft)return;
 if(b.hasAttribute('data-final')){
  if(speicherGestoppt){meldung('Bitte zuerst „Speichern erneut versuchen“ wählen.',true);return;}
  if(!antworten.every(x=>x.trim())){meldung('Bitte alle zehn Fragen beantworten.',true);return;}
  if(!['name','verein','einstufung'].every(k=>kopf[k]?.trim())){meldung('Deine Vereinsdaten sind noch unvollständig. Bitte deinen Obmann um Ergänzung der Einstufung bitten und danach den Stand neu laden.',true);return;}
  if(!confirm('Diese eigene Endfassung bestätigen und als Textdatei bereitstellen? Es wird noch keine E-Mail verschickt.'))return;
  bestaetigungLaeuft=true;root.querySelectorAll('textarea,[data-final]').forEach(el=>el.disabled=true);speicher.merken(snapshot(true));void speicher.flush();return;
 }
 if(b.hasAttribute('data-frage'))frage=Number(b.dataset.frage);else if(b.hasAttribute('data-vor'))frage--;else if(b.hasAttribute('data-nach'))frage++;else return;
 zeichne();root.querySelector('#hrt-frage-titel').focus();
});
window.addEventListener('beforeunload',e=>{if(speicher?.offen()){e.preventDefault();e.returnValue='';}});
document.querySelector('[data-konto]').addEventListener('click',()=>{
 if(speicher?.offen()&&!confirm('Es gibt ungespeicherte Antworten. Vor dem Abmelden bitte kopieren. Trotzdem abmelden?'))return;
 exportName='';anmeldung?.abmelden();
});
if(anmeldung?.abonniere)anmeldung.abonniere(()=>void laden());else void laden();
