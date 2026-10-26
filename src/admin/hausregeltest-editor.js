import {erstellePasswortSchloss} from './obmann-passwort.js';
import {ladeTextdatei} from '../website/hausregeltest.js';

export function erstelleHausregeltestEditor({wurzel,client}){
 if(!wurzel)return;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let daten=null,busy=false,version=0;
 wurzel.innerHTML=`<h2>Hausregeltest</h2><p>Vorantworten, Überarbeitung und bestätigte Textdateien – getrennt vom Wochenquiz.</p><p data-hrt-status role="status"></p>
 <form data-hrt-login class="admin-panel"><label>Obmann-Passwort<input name="passwort" type="password" required autocomplete="off"></label><button class="knopf" type="submit">Hausregeltest verwalten</button></form>
 <div data-hrt-inhalt hidden></div>`;
 const $=s=>wurzel.querySelector(s),status=$('[data-hrt-status]');
 const rpc=async(name,p)=>{const r=await client.rpc(name,p);if(r.error)throw new Error(r.error.message);return r.data;};
 const schloss=erstellePasswortSchloss({pruefe:async p=>{daten=await rpc('obmann_hausregeltest_laden',{p_passwort:p});}});
 function zeichne(){
  const r=$('[data-hrt-inhalt]');r.hidden=false;
  if(!daten.test){
   r.innerHTML='<div class="admin-panel"><p>Für deinen Verein ist aktuell kein Hausregeltest hinterlegt. Der vereinbarte November-Test benötigt keine zusätzliche Website-Freigabe.</p></div>';
  }else{
   r.innerHTML=`<div class="admin-panel"><h3>${esc(daten.test.titel)}</h3><p>Phase: ${esc(({vorbereitung:'Vorbereitung',pause:'Bearbeitungspause',endfassung:'Überarbeitung',beendet:'Frist beendet'})[daten.phase])}</p><a href="hausregeltest.html">Teilnehmeransicht öffnen</a></div>
   ${(daten.personen||[]).map((p,i)=>{const vor=p.vor_antworten.filter(a=>a.trim()).length,end=p.end_antworten?.filter(a=>a.trim()).length;
    return `<details class="admin-panel"><summary>${esc(p.name)} · ${p.bestaetigt?'Endfassung bestätigt':end!==undefined?`${end}/10 überarbeitet`:`${vor}/10 vorbereitet`}</summary>
    ${p.bestaetigt?`<button type="button" class="knopf" data-hrt-download="${i}">Bestätigte Textdatei herunterladen</button>`:''}
    <ol>${daten.test.fragen.map((f,n)=>`<li><strong>${esc(f)}</strong><p>Vorantwort: ${esc(p.vor_antworten[n]||'Noch leer')}</p>${p.end_antworten?`<p>Überarbeitung: ${esc(p.end_antworten[n]||'Noch leer')}</p>`:''}</li>`).join('')}</ol></details>`;}).join('')}`;
  }
  r.insertAdjacentHTML('beforeend','<div class="admin-aktionsleiste"><button class="knopf" type="button" data-hrt-laden>Stand aktualisieren</button><button class="knopf" type="button" data-hrt-schliessen>Passwort und Antworten vergessen</button></div>');
 }
 $('[data-hrt-login]').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;busy=true;const n=++version;
  try{await schloss.oeffnen(e.currentTarget.elements.passwort.value);if(n!==version)return;e.target.reset();e.target.hidden=true;zeichne();status.textContent='Nur Daten deines Vereins.';}
  catch(err){status.textContent=err.message;}finally{busy=false;}
 });
 wurzel.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-hrt-schliessen')){version++;schloss.schliessen();daten=null;$('[data-hrt-inhalt]').replaceChildren();$('[data-hrt-inhalt]').hidden=true;$('[data-hrt-login]').hidden=false;status.textContent='Passwort und geladene Antworten vergessen.';return;}
  if(b.hasAttribute('data-hrt-download')){try{ladeTextdatei(daten.personen[Number(b.dataset.hrtDownload)].bestaetigt);}catch(err){status.textContent=err.message;}return;}
  if(!b.matches('[data-hrt-laden]')||busy)return;
  busy=true;b.disabled=true;const n=version;
  try{const neu=await rpc('obmann_hausregeltest_laden',{p_passwort:schloss.wert()});if(n!==version)return;daten=neu;zeichne();status.textContent='Aktueller Stand geladen.';}
  catch(err){if(n===version)status.textContent=err.message;}finally{busy=false;b.disabled=false;}
 });
}
