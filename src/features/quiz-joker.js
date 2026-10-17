(function(global){
 'use strict';
 function erstelleQuizJoker({sb,getZugang}){
  let stand=null,version=0,dialogNummer=0;
  const el=(tag,klasse,text)=>{const e=document.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;};
  const zugang=()=>{const z=getZugang();return {p_schiedsrichter_id:z.schiedsrichterId,p_pin:z.pin};};
  const vorgang=id=>stand?.vorgaenge?.find(v=>v.frage_id===id);
  async function laden(){const n=++version,z=zugang();stand=null;try{const {data,error}=await sb.rpc('mein_jokerbestand',z);if(n===version&&z.p_schiedsrichter_id===getZugang().schiedsrichterId&&z.p_pin===getZugang().pin&&!error)stand=data;}catch{/* Der optionale Bestand blockiert das Quiz nicht. */}}
  async function aktion(id,art,antwort={},typ=null){const {data,error}=await sb.rpc('quiz_joker_antwort',{...zugang(),p_frage_id:id,p_aktion:art,p_art:typ,p_antwort:antwort});if(error)throw error;return data;}
  function auswahlDialog(){return new Promise(resolve=>{
   const vorher=document.activeElement,d=el('dialog','quiz-joker-dialog'),titelId='quiz-joker-titel-'+(++dialogNummer);d.setAttribute('aria-labelledby',titelId);
   const h=el('h2','','Noch eine Chance?');h.id=titelId;
   const text=el('p','','Deine Erstantwort ist nicht richtig. Die Lösung bleibt verborgen. Mit einem Joker kannst du einmal neu antworten. Ein richtiger zweiter Versuch zählt voll.');
   const x=el('button','quiz-joker-x','×');x.type='button';x.setAttribute('aria-label','Schließen und später entscheiden');x.autofocus=true;
   const ja=el('button','quiz-joker-primaer','Joker einsetzen'),nein=el('button','quiz-joker-neben','Ohne Joker · Lösung zeigen');ja.type=nein.type='button';
   let wahl='spaeter';ja.onclick=()=>{wahl='joker';d.close();};nein.onclick=()=>{wahl='aufloesen';d.close();};x.onclick=()=>d.close();
   d.append(x,h,text,ja,nein);document.body.append(d);d.addEventListener('close',()=>{d.remove();if(vorher?.isConnected)vorher.focus();resolve(wahl);},{once:true});d.showModal();
  });}
  async function ergebnis(id,result){
   if(!result?.joker_offen)return result;
   if(stand){const v=vorgang(id);if(v)v.status='angebot';else(stand.vorgaenge??=[]).push({frage_id:id,status:'angebot'});}
   const wahl=await auswahlDialog();
   if(wahl==='spaeter')return {joker_pause:true};
   const x=await aktion(id,wahl);await laden();return x;
  }
  async function senden(name,parameter){
   const id=parameter.p_frage_id;let art,antwort;
   if(name==='antwort_abgeben'){art='option';antwort={option:parameter.p_gegebene_option};}
   else if(name==='antwort_auswahl_abgeben'){art='auswahl';antwort={auswahl:parameter.p_auswahl};}
   else if(name==='antwort_zahl_abgeben'){art='zahl';antwort={wert:parameter.p_wert,einheit:parameter.p_einheit};}
   else return sb.rpc(name,parameter);
   try{return {data:[await ergebnis(id,await aktion(id,'antwort',antwort,art))],error:null};}catch(error){return {data:null,error};}
  }
  async function bewertet(id,anfrage){
   if(vorgang(id)?.status==='angebot')return ergebnis(id,{joker_offen:true});
   return ergebnis(id,await anfrage());
  }
  function fortsetzen(karte,result){
   if(!result?.joker_wiederholen&&!result?.joker_pause)return false;
   karte.querySelectorAll('input,textarea,select,button.absenden-button,button.entscheidung-senden').forEach(e=>{e.disabled=false;});
   karte.querySelectorAll('.absenden-button').forEach(e=>{e.disabled=false;e.textContent='Antwort abschicken';});
   karte.querySelectorAll('.freitext-lade-hinweis').forEach(e=>{e.hidden=true;});
   let info=karte.querySelector('.quiz-joker-status');if(!info){info=el('p','quiz-joker-status');info.setAttribute('role','status');karte.append(info);}
   info.textContent=result.joker_wiederholen?'Joker eingesetzt · Antworte jetzt noch einmal.':'Entscheidung offen · Beim Abschicken kannst du Joker oder Lösung wählen.';
   karte.querySelector('textarea,input,select')?.focus();return true;
  }
  function markiere(karte,result){if(!result?.joker_eingesetzt)return;let m=karte.querySelector('.quiz-joker-marke');if(!m){m=el('p','quiz-joker-marke');karte.prepend(m);}m.textContent=result.korrekt?'✓ Mit Joker geschafft':'Joker eingesetzt';}
  function schmuecken(karte,frage,beantwortet){
   const v=vorgang(frage.id);if(v?.joker_eingesetzt)markiere(karte,{joker_eingesetzt:true,korrekt:beantwortet?.korrekt});
   if(beantwortet?.beantwortet)return;
   const kandidaten=v?.kandidaten; if(kandidaten)anwenden(karte,kandidaten);
   if(v?.status==='angebot'||v?.status==='zweiter'){const p=el('p','quiz-joker-status',v.status==='angebot'?'Erstantwort gespeichert · Lösung noch verborgen. Beim Abschicken entscheidest du über deinen Joker.':'Zweiter Versuch offen · Dein Joker ist bereits eingesetzt.');p.setAttribute('role','status');karte.append(p);}
   const optionen=frage.antwortoptionen?.length||[frage.option_a,frage.option_b,frage.option_c].filter(Boolean).length;
   if(frage.antworttyp!=='multiple_choice'||optionen<3||!stand?.bestand?.halbhalb||v?.status==='angebot'||v?.status==='zweiter'||kandidaten)return;
   const b=el('button','quiz-joker-knopf','50/50-Joker einsetzen');b.type='button';
   const info=el('p','quiz-joker-klein','Verbraucht einen Joker. Zwei Antwortmöglichkeiten bleiben übrig.');
   b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{const x=await aktion(frage.id,'halbhalb');anwenden(karte,x.kandidaten);b.textContent='50/50 eingesetzt';await laden();}catch(e){b.disabled=false;info.textContent=e.message||'Joker konnte nicht eingesetzt werden.';}};
   karte.append(b,info);
  }
  function anwenden(karte,kandidaten){karte.querySelectorAll('.option input').forEach(input=>{const weg=!kandidaten.includes(input.value);input.closest('.option').hidden=weg;if(weg){input.checked=false;input.disabled=true;}});}
  const wochenRpc={rpc:(name,parameter)=>name.startsWith('antwort_')?senden(name,parameter):sb.rpc(name,parameter)};
  return Object.freeze({laden,senden,bewertet,fortsetzen,markiere,schmuecken,wochenRpc});
 }
 global.SchiriQuizJoker=Object.freeze({erstelleQuizJoker});
})(globalThis);
