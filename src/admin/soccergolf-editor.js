import { erstellePasswortSchloss } from './obmann-passwort.js';
import { pruefeSoccergolf, zeichneSoccergolf } from '../website/soccergolf-ergebnisse.js';

export function leseGolfZeilen(text,bahnen){
 return String(text).split(/\r?\n/).filter(z=>z.trim()).map(z=>{
  const [name,...werte]=z.split(/[;\t]/).map(s=>s.trim());
  if(werte.length!==bahnen)throw new Error(`Für „${name}“ bitte genau ${bahnen} Bahnwerte eintragen. Leer oder – bedeutet noch nicht erfasst.`);
  return {name,schlaege:werte.map(s=>s===''||s==='–'||s==='-'?null:/^\d+$/.test(s)?Number(s):NaN)};
 });
}
export function erstelleSoccergolfEditor({wurzel,client}){
 if(!wurzel)return;
 wurzel.innerHTML=`<div class="admin-bereich-einstieg"><div><h2>Soccer-Golf · Rückblick</h2><p>Ergebnisse am bestehenden Termin festhalten. Nur für angemeldete Mitglieder desselben Vereins.</p></div></div>
 <p data-golf-status role="status"></p>
 <form data-golf-login class="admin-panel"><label>Obmann-Passwort<input type="password" name="passwort" autocomplete="off" required></label><button class="knopf" type="submit">Ergebnisse verwalten</button></form>
 <div data-golf-inhalt hidden><div class="admin-panel"><label>Termin<select data-golf-termin></select></label><p data-golf-stand></p></div>
 <form data-golf-form class="admin-panel golf-editor-form">
 <div class="golf-editor-raster"><label>Anzahl Bahnen<input name="bahnen" type="number" min="1" max="36" value="18" required></label><label>Kurzer Rückblick<textarea name="text" rows="3" maxlength="2000"></textarea></label></div>
 <fieldset><legend>Ergebnisse</legend><p id="golf-eingabehilfe">Eine Person pro Zeile: Name; Bahn 1; Bahn 2; … Leer oder – = noch nicht erfasst. Auch aus einer Tabelle mit Tabulatoren einfügbar. Kleinere Summe gewinnt. Namen nur so eintragen, wie sie im Verein angezeigt werden dürfen.</p><label>Bahnwerte<textarea name="werte" rows="10" aria-describedby="golf-eingabehilfe" spellcheck="false"></textarea></label></fieldset>
 <fieldset><legend>Anlagenplan (optional)</legend><div class="golf-editor-raster"><label>Link zum Plan beim Betreiber<input name="plan_link" type="url" placeholder="https://…"></label><label>Planbild aus euren Website-Bildern<input name="plan_bild" placeholder="Adresse aus der Bilderverwaltung"></label><label>Bildquelle / Bildtitel<input name="plan_quelle" maxlength="200"></label></div><p>Nur eigene oder zur Verwendung freigegebene Bilder verwenden. Ohne Bild bleibt der Betreiberlink möglich.</p></fieldset>
 <label class="admin-checkbox"><input name="freigabe_geprueft" type="checkbox"> Namensanzeige und gegebenenfalls Bildrechte für die Vereinsansicht geprüft.</label>
 <div class="admin-aktionsleiste"><button type="button" class="knopf" data-golf-vorschau-knopf>Vorschau</button><button type="submit" class="knopf">Entwurf speichern</button><button type="button" class="knopf knopf-primaer" data-golf-publizieren>Für Verein veröffentlichen</button><button type="button" class="knopf" data-golf-zurueckziehen>Veröffentlichung zurückziehen</button><button type="button" class="knopf" data-golf-abmelden>Passwort vergessen</button></div>
 <div data-golf-vorschau></div></form></div>`;
 const $=s=>wurzel.querySelector(s),status=$('[data-golf-status]'),form=$('[data-golf-form]'),select=$('[data-golf-termin]');
 let termine=[],aktuell=null,beschaeftigt=false,lauf=0;
 const meldung=t=>{status.textContent=t;};
 const schloss=erstellePasswortSchloss({pruefe:async pass=>{const {data,error}=await client.rpc('obmann_soccergolf_liste',{p_passwort:pass});if(error)throw new Error(error.message);termine=data||[];}});
 function laden(){
  aktuell=termine.find(t=>t.id===select.value)||null;
  form.hidden=!aktuell;if(!aktuell)return;
  const d=aktuell.entwurf||{bahnen:18,teilnehmer:[],text:'',plan_link:'https://www.soccergolf-sachsen.de/',plan_bild:'bilder/termine/soccergolf-anlagenplan.png',plan_quelle:'Anlagenplan · SoccerGolf Sachsen · soccergolf-sachsen.de',freigabe_geprueft:false};
  for(const k of ['bahnen','text','plan_link','plan_bild','plan_quelle'])form.elements[k].value=d[k]??'';
  form.elements.freigabe_geprueft.checked=d.freigabe_geprueft===true;
  form.elements.werte.value=d.teilnehmer.map(p=>[p.name,...p.schlaege.map(n=>n??'–')].join('; ')).join('\n');
  $('[data-golf-vorschau]').replaceChildren();
  $('[data-golf-stand]').textContent=aktuell.veroeffentlicht?'Für den Verein veröffentlicht. Entwurfsänderungen sind noch nicht sichtbar.':'Noch nicht veröffentlicht.';
 }
 function inhalt(){const bahnen=Number(form.elements.bahnen.value);const d={bahnen,teilnehmer:leseGolfZeilen(form.elements.werte.value,bahnen),freigabe_geprueft:form.elements.freigabe_geprueft.checked};for(const k of ['text','plan_link','plan_bild','plan_quelle'])d[k]=form.elements[k].value.trim();const fehler=pruefeSoccergolf(d);if(fehler.length)throw new Error(fehler.join(' '));return d;}
 async function speichern(aktion){
  if(beschaeftigt||!aktuell)return;
  let d;try{d=aktion==='zurueckziehen'?aktuell.entwurf:inhalt();if(!d)throw new Error('Es gibt noch keine Veröffentlichung.');if(aktion==='veroeffentlichen'&&!d.freigabe_geprueft)throw new Error('Bitte zuerst Namensanzeige und Bildrechte prüfen und bestätigen.');if(aktion==='veroeffentlichen'&&!d.teilnehmer.length)throw new Error('Bitte zuerst Ergebnisse eintragen.');}catch(e){meldung(e.message);return;}
  const version=lauf,id=aktuell.id;beschaeftigt=true;select.disabled=true;for(const b of form.querySelectorAll('button,input,textarea'))b.disabled=true;meldung('Wird gespeichert …');
  try{const {data,error}=await client.rpc('obmann_soccergolf_speichern',{p_passwort:schloss.wert(),p_termin_id:id,p_inhalt:d,p_revision:aktuell.revision,p_aktion:aktion});if(error)throw new Error(error.message);if(version!==lauf)return;Object.assign(aktuell,data);if(aktion!=='zurueckziehen')form.dataset.geaendert='';$('[data-golf-stand]').textContent=aktuell.veroeffentlicht?'Für den Verein veröffentlicht.':'Noch nicht veröffentlicht.';meldung(aktion==='veroeffentlichen'?'Ergebnisse für den Verein veröffentlicht.':aktion==='zurueckziehen'?'Veröffentlichung zurückgezogen; dein Entwurf bleibt erhalten.':'Entwurf gespeichert.');}
  catch(e){if(version===lauf)meldung(e.message+' Deine Eingabe bleibt erhalten. Bei einem Versionskonflikt bitte vor dem Neuladen kopieren.');}
  finally{beschaeftigt=false;select.disabled=false;for(const b of form.querySelectorAll('button,input,textarea'))b.disabled=false;}
 }
 $('[data-golf-login]').addEventListener('submit',async e=>{e.preventDefault();if(beschaeftigt)return;beschaeftigt=true;const f=e.currentTarget;try{await schloss.oeffnen(f.elements.passwort.value);f.reset();f.hidden=true;$('[data-golf-inhalt]').hidden=false;select.replaceChildren();for(const t of termine){const o=document.createElement('option');o.value=t.id;o.textContent=`${t.datum} · ${t.titel}`;select.append(o);}laden();meldung(termine.length?'Termin auswählen und Ergebnisse ergänzen.':'Noch keine vergangenen Events vorhanden.');}catch(err){meldung(err.message);}finally{beschaeftigt=false;}});
 select.addEventListener('change',()=>{if(form.dataset.geaendert==='ja'&&!confirm('Ungespeicherte Änderungen verwerfen?')){select.value=aktuell.id;return;}form.dataset.geaendert='';laden();});
 form.addEventListener('input',e=>{form.dataset.geaendert='ja';if(['werte','plan_bild','plan_link'].includes(e.target.name))form.elements.freigabe_geprueft.checked=false;});
 form.addEventListener('submit',e=>{e.preventDefault();void speichern('entwurf');});
 $('[data-golf-publizieren]').onclick=()=>{void speichern('veroeffentlichen');};
 $('[data-golf-zurueckziehen]').onclick=()=>{void speichern('zurueckziehen');};
 $('[data-golf-vorschau-knopf]').onclick=()=>{try{$('[data-golf-vorschau]').replaceChildren(zeichneSoccergolf(document,inhalt()));meldung('Vorschau – noch keine Veröffentlichung.');}catch(e){meldung(e.message);}};
 $('[data-golf-abmelden]').onclick=()=>{lauf++;schloss.schliessen();termine=[];aktuell=null;select.replaceChildren();form.reset();$('[data-golf-vorschau]').replaceChildren();$('[data-golf-inhalt]').hidden=true;$('[data-golf-login]').hidden=false;meldung('Passwort und geladene Daten vergessen.');};
}
