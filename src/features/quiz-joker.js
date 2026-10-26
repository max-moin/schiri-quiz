(function(global){
 'use strict';
 function erstelleQuizJoker({sb,getZugang}){
  let stand=null,version=0,dialogNummer=0;
  const menues=new Map();
  const el=(tag,klasse,text)=>{const e=document.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;};
  const zugang=()=>{const z=getZugang();return {p_schiedsrichter_id:z.schiedsrichterId,p_pin:z.pin};};
  const vorgang=id=>stand?.vorgaenge?.find(v=>v.frage_id===id);
  const hinweise=id=>stand?.hinweise?.find(v=>v.frage_id===id);
  function zeigeHinweis(karte,text){const p=el('p','quiz-joker-status',text);p.setAttribute('role','status');karte.append(p);}
  async function laden(){const n=++version,z=zugang();stand=null;try{const {data,error}=await sb.rpc('mein_jokerbestand',z);if(n===version&&z.p_schiedsrichter_id===getZugang().schiedsrichterId&&z.p_pin===getZugang().pin&&!error)stand=data;}catch{/* Der optionale Bestand blockiert das Quiz nicht. */}for(const [b,update] of menues){if(b.isConnected)update();else menues.delete(b);}}
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
  function markiere(karte,result){if(!result?.joker_eingesetzt&&!hinweise(karte.dataset.frageId)?.einsaetze?.length)return;let m=karte.querySelector('.quiz-joker-marke');if(!m){m=el('p','quiz-joker-marke');karte.prepend(m);}m.textContent=result.korrekt?'✓ Mit Joker geschafft':'Joker eingesetzt';}
  function schmuecken(karte,frage,beantwortet){
   const v=vorgang(frage.id),h=hinweise(frage.id);if(v?.joker_eingesetzt||h?.einsaetze?.length)markiere(karte,{joker_eingesetzt:true,korrekt:beantwortet?.korrekt});
   for(const e of h?.einsaetze||[])zeigeHinweis(karte,e.hinweis);
   if(beantwortet?.beantwortet)return;
   const kandidaten=v?.kandidaten; if(kandidaten)anwenden(karte,kandidaten);
   if(v?.status==='angebot'||v?.status==='zweiter'){const p=el('p','quiz-joker-status',v.status==='angebot'?'Erstantwort gespeichert · Lösung noch verborgen. Beim Abschicken entscheidest du über deinen Joker.':'Zweiter Versuch offen · Dein Joker ist bereits eingesetzt.');p.setAttribute('role','status');karte.append(p);}
   const optionen=frage.antwortoptionen?.length||[frage.option_a,frage.option_b,frage.option_c].filter(Boolean).length;
   if(!stand)return;
   const b=el('button','quiz-joker-menue');b.type='button';b.setAttribute('aria-haspopup','dialog');
   const bestand=()=>geeigneterVorrat(frage,stand,beantwortet);
   const beschriften=()=>{const n=bestand();b.hidden=n===0||!getZugang().schiedsrichterId||!getZugang().pin;b.disabled=b.hidden;b.replaceChildren(el('span','quiz-joker-symbol','✦'),el('span','quiz-joker-anzahl',String(n)));b.setAttribute('aria-label',`Deine Joker: ${n} für diese Frage verfügbar. Auswahl öffnen`);};
   menues.set(b,beschriften);
   beschriften();b.onclick=()=>{
    beschriften();if(b.hidden)return;
    const aktuell=vorgang(frage.id);
    const vorher=document.activeElement,d=el('dialog','quiz-joker-dialog'),tid='quiz-joker-inventar-'+(++dialogNummer);d.setAttribute('aria-labelledby',tid);
    const x=el('button','quiz-joker-x','×');x.type='button';x.autofocus=true;x.setAttribute('aria-label','Jokerauswahl schließen');x.onclick=()=>d.close();
    const h=el('h2','','Deine Joker');h.id=tid;
    const info=el('p','quiz-joker-klein','Öffnen kostet keinen Joker. Ein Einsatz ist einmalig.');info.setAttribute('role','status');d.append(x,h,info);
    const zeile=(typ,titel,grund,aktionFn)=>{const a=el('button','quiz-joker-auswahl',`${titel} · ${Number(stand?.bestand?.[typ])||0}`);a.type='button';const hinweis=el('p','quiz-joker-klein',grund);hinweis.id=tid+'-'+typ;a.setAttribute('aria-describedby',hinweis.id);a.disabled=!aktionFn||!stand?.bestand?.[typ];if(aktionFn)a.onclick=async()=>{a.disabled=true;try{await aktionFn();await laden();beschriften();d.close();}catch(e){info.textContent=e.message||'Joker konnte nicht eingesetzt werden.';a.disabled=false;}};d.append(a,hinweis);};
    const halbErlaubt=antworttyp(frage)==='multiple_choice'&&optionen>=3&&!aktuell?.kandidaten&&!aktuell?.status&&!beantwortet?.beantwortet;
    zeile('halbhalb','50/50',halbErlaubt?'Verbraucht einen Joker und lässt zwei Möglichkeiten übrig.':'Nur vor der Erstantwort bei einer Einfachauswahl mit mindestens drei Möglichkeiten.',halbErlaubt?async()=>{const r=await aktion(frage.id,'halbhalb');anwenden(karte,r.kandidaten);}:null);
    zeile('zweiter-versuch','Zweiter Versuch',aktuell?.status==='angebot'?'Erstantwort verwerfen und einmal neu antworten.':'Wird nach einer falschen Erstantwort angeboten. Noch kein Verbrauch.',aktuell?.status==='angebot'?async()=>{const r=await aktion(frage.id,'joker');fortsetzen(karte,r);}:null);
    for(const [typ,titel,grund] of [['denkanstoss','Denkanstoß','Zeigt den von Max hinterlegten Tipp.'],['fehlerlupe','Fehlerlupe','Lenkt deinen Blick auf einen Antwortbereich. Verrät keine Lösung und bestätigt keine Teilantwort.'],['zufallsbaustein','Zufallsbaustein','Deckt einen zufälligen geforderten Antwortteil auf.'],['schluesselbaustein','Schlüsselbaustein','Deckt gezielt einen noch fehlenden oder abweichenden Antwortteil auf.']]){
     const bereit=(typ==='denkanstoss'?h?.denkanstoss:h?.icon)&&!h?.einsaetze?.some(e=>e.typ===typ)&&!aktuell?.status;
     if(!stand?.bestand?.[typ]||!bereit)continue;
     zeile(typ,titel,grund,async()=>{const {data,error}=await sb.rpc('quiz_hinweisjoker',{...zugang(),p_frage_id:frage.id,p_typ:typ,p_antwort:karte.schiriAntwortLesen?.()||{freitext:(karte.querySelector('textarea')?.value||'').slice(0,2000)}});if(error)throw error;zeigeHinweis(karte,data.hinweis);});
    }
    zeile('serienjoker','Serienrettung','Rettet eine verpasste Woche in deiner Quiz-Statistik. Hier nicht einsetzbar.',null);
    const link=el('a','quiz-joker-sammlung','Zur Sammlung und den Boxen');link.href='sammlung.html';d.append(link);document.body.append(d);d.addEventListener('close',()=>{d.remove();if(vorher?.isConnected)vorher.focus();},{once:true});d.showModal();
   };karte.append(b);
  }
  function anwenden(karte,kandidaten){karte.querySelectorAll('.option input').forEach(input=>{const weg=!kandidaten.includes(input.value);input.closest('.option').hidden=weg;if(weg){input.checked=false;input.disabled=true;}});}
  const wochenRpc={rpc:(name,parameter)=>name.startsWith('antwort_')?senden(name,parameter):sb.rpc(name,parameter)};
  return Object.freeze({laden,senden,bewertet,fortsetzen,markiere,schmuecken,wochenRpc});
 }
 function geeigneterVorrat(frage,stand,beantwortet){
  if(!stand||beantwortet?.beantwortet||beantwortet?.nachbesserung_offen||beantwortet?.bewertungsstatus==='nachbessern')return 0;
  const v=stand.vorgaenge?.find(x=>x.frage_id===frage.id);
  if(v?.status==='zweiter'||v?.status==='fertig')return 0;
  const n=k=>Math.max(0,Number(stand.bestand?.[k])||0);
  const typ=antworttyp(frage);
  if(!['multiple_choice','freitext','video_freitext','entscheidung','einfachauswahl','mehrfachauswahl','zahl'].includes(typ))return 0;
  let zahl=n('zweiter-versuch');
  const optionen=frage.antwortoptionen?.length||[frage.option_a,frage.option_b,frage.option_c].filter(Boolean).length;
  if(typ==='multiple_choice'&&optionen>=3&&!v?.kandidaten&&!v?.status)zahl+=n('halbhalb');
  const h=stand.hinweise?.find(x=>x.frage_id===frage.id),benutzt=t=>h?.einsaetze?.some(e=>e.typ===t);
  if(!v?.status){if(h?.denkanstoss&&!benutzt('denkanstoss'))zahl+=n('denkanstoss');if(h?.icon)for(const t of ['fehlerlupe','zufallsbaustein','schluesselbaustein'])if(!benutzt(t))zahl+=n(t);}
  return zahl;
 }
 function antworttyp(frage){return frage.antworttyp||frage.video_antworttyp||(frage.typ==='video'?'video_freitext':'multiple_choice');}
 global.SchiriQuizJoker=Object.freeze({erstelleQuizJoker,geeigneterVorrat});
})(globalThis);
