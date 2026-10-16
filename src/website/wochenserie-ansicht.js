import { berechneWochenserie } from './wochenserie.js';

const datum = t => new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
function element(doc,tag,klasse,text) {
  const e=doc.createElement(tag); e.className=klasse; if(text!==undefined)e.textContent=text; return e;
}
export function zeichneWochenserie(ziel,basis) {
  const s=berechneWochenserie(basis), doc=ziel.ownerDocument;
  const kopf=element(doc,'div','serie-kopf');
  const titel=element(doc,'div','');
  titel.append(element(doc,'h2','', 'Deine Wochenserie'),element(doc,'p','serie-privat','Nur für dich · keine Rangliste'));
  const neu=element(doc,'button','serie-neuladen','Aktualisieren'); neu.type='button'; neu.dataset.serieNeuladen='';
  kopf.append(titel,neu);
  const zahlen=element(doc,'div','serie-zahlen');
  for (const [zahl,text] of [[s.serie,'Wochen in Folge'],[s.beste,'Deine längste Serie'],[s.abgeschlossen,'Wochen vollständig']]) {
    const k=element(doc,'div','serie-zahl'); k.append(element(doc,'strong','',String(zahl)),element(doc,'span','',text)); zahlen.append(k);
  }
  const stand=element(doc,'p','serie-stand',s.aktuell
    ? s.aktuell.status==='abgeschlossen' ? 'Diese Woche geschafft. Jede beantwortete Frage zählt – auch eine falsche Antwort.'
      : `Diese Woche: ${Math.min(s.aktuell.beantwortet,s.aktuell.fragen_gesamt)} von ${s.aktuell.fragen_gesamt} abschließend beantwortet. Du hast bis ${datum(s.aktuell.endet_am)} Zeit.`
    : 'Gerade läuft kein Wochenquiz für deinen Verein. Deine bisherigen Erfolge bleiben sichtbar.');
  const teile=[kopf,zahlen,stand];
  const joker=Array.isArray(basis.joker)?basis.joker:[];
  const geschenk=element(doc,'div','serie-rettung');
  geschenk.append(element(doc,'h3','','Dein Geburtstagsjoker'),element(doc,'p','',joker.length
    ? `Du hast ${joker.length} Joker. Er rettet eine verpasste Quizwoche innerhalb der normalen siebentägigen Rettungsfrist – ohne Antworten oder Punkte zu verändern. Gültig bis ${new Intl.DateTimeFormat('de-DE').format(new Date(joker[0].gueltig_bis+'T12:00:00'))}.`
    : 'Zum Geburtstag erhältst du einen privaten Serienjoker, sofern dein Geburtsdatum hinterlegt ist. Er gilt ein Jahr. Aktuell ist keiner verfügbar.'));
  teile.push(geschenk);
  for (const r of s.rettungen) {
    const k=element(doc,'div','serie-rettung');
    k.append(element(doc,'h3','', 'Eine Woche retten'),element(doc,'p','',`„${r.bezeichnung}“: ${Math.min(r.uebung_richtig,5)} von 5 verschiedenen Übungsfragen richtig. Noch ${r.fehlen} bis ${datum(r.retten_bis)}.`));
    const fortschritt=doc.createElement('progress'); fortschritt.max=5;fortschritt.value=Math.min(r.uebung_richtig,5);fortschritt.setAttribute('aria-label','Richtige Übungsfragen für die Rettung'); k.append(fortschritt);
    if(r.serieDavor)k.append(element(doc,'p','',`Davor hattest du ${r.serieDavor} Wochen in Folge. Diese Lücke zählt erst nach erfolgreicher Rettung zur Serie.`));
    const link=element(doc,'a','serie-link','Zum Quiz und Üben'); link.href='quiz.html#ueben';k.append(link);
    if(joker.length){
      const knopf=element(doc,'button','serie-neuladen','Geburtstagsjoker einsetzen');knopf.type='button';knopf.dataset.jokerRunde=r.runde_id;
      knopf.dataset.jokerTitel=r.bezeichnung;k.append(knopf);
    }
    k.append(element(doc,'p','','Falls diese Woche noch Fragen offen sind, beantworte sie zuerst. Danach öffnet sich der Übungsmodus.'));
    teile.push(k);
  }
  const badges=element(doc,'div','serie-abzeichen');
  for(const b of s.abzeichen) {
    const k=element(doc,'div',`serie-abzeichen-karte${b.verdient?' verdient':''}`);
    const symbol=element(doc,'span','serie-abzeichen-symbol',b.verdient?'✓':'◇');symbol.setAttribute('aria-hidden','true');
    k.append(symbol,element(doc,'h3','',b.titel),element(doc,'p','',b.text),element(doc,'span','serie-abzeichen-status',b.verdient?'Erreicht':'Noch offen'));badges.append(k);
  }
  teile.push(element(doc,'h3','','Deine Abzeichen'),badges);
  const details=element(doc,'details','serie-regeln'); details.append(element(doc,'summary','','Wie zählt die Serie?'));
  details.append(element(doc,'p','','Alle Fragen einer Wochenrunde müssen abschließend beantwortet sein; die Trefferquote ist egal. Offene Nachfragen zählen noch nicht als fertig. Eine laufende Woche und Wochen ohne Quiz unterbrechen die Serie nicht.'));
  details.append(element(doc,'p','','Eine verpasste Woche kannst du in den sieben Tagen danach mit fünf verschiedenen, richtig beantworteten Übungsfragen retten. Wiederholungen derselben Frage zählen einmal. Die Rettung füllt keine Wochenantworten nach und verändert weder Quizquote noch Saisonpunkte. Abzeichen zeigen deinen eigenen Verlauf; es gibt keine Sounds oder Erfolgsanimationen.'));
  details.append(element(doc,'p','','Alternativ rettet ein Geburtstagsjoker genau eine verpasste Woche in derselben Frist. Ein Joker pro Geburtstag ab dem 16.10.2026, kein Nachtragen früherer Geburtstage. Am 29. Februar gibt es das Geschenk in Nicht-Schaltjahren am 28. Februar. Die Einlösung ist endgültig.'));
  if(s.gerettet)details.append(element(doc,'p','',`${s.gerettet} ${s.gerettet===1?'Woche wurde':'Wochen wurden'} gerettet.`));
  teile.push(details); ziel.replaceChildren(...teile);
  return s;
}

export function erstelleSerienSteuerung({ziel,rpc,anmeldung}) {
  let version=0,laedt=false,jokerDialog=null;
  const doc=ziel.ownerDocument;
  async function laden(person=anmeldung.lesen()) {
    jokerDialog?.close();
    const lauf=++version;laedt=true;
    ziel.replaceChildren();ziel.hidden=!person;
    ziel.removeAttribute('aria-busy');
    if(!person){laedt=false;return;}
    ziel.setAttribute('aria-busy','true');
    ziel.append(element(doc,'p','serie-stand','Deine Serie wird geladen …'));
    let data,error;
    // Enthält weiterhin die Daten von meine_wochenserie_basis, ergänzt um eigene Joker.
    try { ({data,error}=await rpc.rpc('meine_wochenserie_mit_joker',{p_schiedsrichter_id:person.id,p_pin:person.pin})); }
    catch { error={message:'Nicht verfügbar'}; }
    const aktuell=anmeldung.lesen();
    if(lauf!==version || aktuell?.id!==person.id || aktuell?.pin!==person.pin)return;
    laedt=false;ziel.removeAttribute('aria-busy');
    try {
      if(error)throw new Error('Nicht verfügbar');
      zeichneWochenserie(ziel,data);
    } catch {
      ziel.replaceChildren(element(doc,'p','serie-stand','Deine Serie konnte gerade nicht geladen werden. Deine Antworten bleiben gespeichert.'));
      const neu=element(doc,'button','serie-neuladen','Erneut versuchen');neu.type='button';neu.dataset.serieNeuladen='';ziel.append(neu);
    }
  }
  ziel.addEventListener('click',event=>{if(event.target.closest('[data-serie-neuladen]')&&!laedt)void laden();});
  ziel.addEventListener('click',event=>{
    const knopf=event.target.closest('[data-joker-runde]');if(!knopf||laedt)return;
    const person=anmeldung.lesen();if(!person)return;
    const dialog=doc.createElement('dialog');jokerDialog=dialog;dialog.className='serie-joker-dialog';
    const titel=element(doc,'h2','','Joker verbindlich einsetzen?');titel.id='joker-dialog-titel';dialog.setAttribute('aria-labelledby',titel.id);
    const hinweis=element(doc,'p','',`Damit rettest du „${knopf.dataset.jokerTitel}“ für deine private Serie. Der Joker ist danach verbraucht. Quizantworten und Punkte bleiben unverändert.`);
    const fehler=element(doc,'p','');fehler.setAttribute('role','status');
    const zurueck=element(doc,'button','serie-neuladen','Abbrechen');zurueck.type='button';zurueck.autofocus=true;
    const bestaetigen=element(doc,'button','serie-neuladen','Joker einsetzen');bestaetigen.type='button';
    dialog.append(titel,hinweis,fehler,zurueck,bestaetigen);doc.body.append(dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(jokerDialog===dialog)jokerDialog=null;knopf.focus();});zurueck.onclick=()=>dialog.close();
    bestaetigen.onclick=async()=>{
      const aktuell=anmeldung.lesen();
      if(aktuell?.id!==person.id||aktuell?.pin!==person.pin){dialog.close();return;}
      if(laedt)return;laedt=true;bestaetigen.disabled=true;
      try{
        const {error}=await rpc.rpc('geburtstagsjoker_einloesen',{p_schiedsrichter_id:person.id,p_pin:person.pin,p_runde_id:knopf.dataset.jokerRunde});
        if(error)throw new Error(error.message);
        dialog.close();await laden();ziel.querySelector('[data-serie-neuladen]')?.focus();
      }catch{fehler.textContent='Einlösen nicht möglich. Bitte lade den Serienstand neu; möglicherweise ist die Frist abgelaufen oder der Joker bereits verbraucht.';}
      finally{laedt=false;bestaetigen.disabled=false;}
    };
    dialog.showModal();
  });
  return {laden};
}
