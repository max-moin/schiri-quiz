const typen = [
  {id:'serienjoker',titel:'Serienjoker',text:'Rettet eine verpasste Quizwoche für deine Wochenserie. Du setzt ihn bei einer rettbaren Woche ein. Einmal verwendbar, ohne Ablaufdatum. Das Sieben-Tage-Fenster der verpassten Woche bleibt bestehen.',fertig:true},
  {id:'halbhalb',titel:'50/50-Joker',text:'Bei einer Einfachauswahl mit mindestens drei Optionen bleiben zwei Antwortmöglichkeiten übrig, eine davon richtig. Vor deiner ersten Antwort einsetzen. Nur im Wochenquiz, nicht im Üben. Einmal verwendbar, ohne Ablaufdatum.',fertig:true},
  {id:'zweiter-versuch',titel:'Zweiter Versuch',text:'Nach einer falschen Erstantwort noch einmal antworten, bevor du die Lösung siehst. Gelingt es, zählt die Antwort voll als richtig. Der Obmann sieht Jokereinsatz, Erst- und Zweitantwort. Nicht mit der kostenlosen KI-Ergänzung kombinierbar und nicht nach bereits angezeigter Lösung. Nur Wochenquiz. Einmal verwendbar, ohne Ablaufdatum.',fertig:true},
];
const el=(d,tag,klasse,text)=>{const e=d.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;};

export function zeichneJokerVorrat(doc,basis){
 const bereich=el(doc,'section','joker-vorrat');bereich.setAttribute('aria-label','Deine Joker');
 const kopf=el(doc,'div','joker-kopf'),info=el(doc,'button','joker-info','i');info.type='button';info.setAttribute('aria-label','Wie bekomme ich Joker?');info.setAttribute('aria-haspopup','dialog');kopf.append(el(doc,'h3','','Deine Joker'),info);
 const dialog=el(doc,'dialog','abzeichen-dialog joker-dialog');dialog.setAttribute('aria-labelledby','joker-info-titel');let trigger=null;
 dialog.addEventListener('close',()=>{if(trigger?.isConnected)trigger.focus();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 function oeffnen(button,titel,inhalt){
  trigger=button;const x=el(doc,'button','abzeichen-schliessen','×');x.type='button';x.autofocus=true;x.setAttribute('aria-label','Schließen');x.addEventListener('click',()=>dialog.close());
  const h=el(doc,'h2','',titel);h.id='joker-info-titel';dialog.replaceChildren(x,h,...inhalt);dialog.showModal();
 }
 const anzahl=Array.isArray(basis?.joker)?basis.joker.length:0,raster=el(doc,'div','joker-raster');
 for(const typ of typen){
  const n=Number(basis?.belohnungen?.bestand?.[typ.id]??(typ.id==='serienjoker'?anzahl:0));
  const knopf=el(doc,'button',`joker-motiv${n?'':' joker-leer'}`);knopf.type='button';knopf.title=`${typ.titel} · ${typ.fertig?`${n} verfügbar`:'in Vorbereitung'}`;
  knopf.setAttribute('aria-label',knopf.title);knopf.setAttribute('aria-haspopup','dialog');
  const bild=doc.createElement('img');bild.src=`bilder/joker/${typ.id}.webp`;bild.alt='';bild.width=160;bild.height=160;knopf.append(bild);
  if(n){const kreis=el(doc,'span','joker-anzahl',String(n));kreis.setAttribute('aria-hidden','true');knopf.append(kreis);}
  knopf.addEventListener('click',()=>oeffnen(knopf,typ.titel,[el(doc,'p','',typ.text),el(doc,'p','joker-status',typ.fertig?`${n} verfügbar`:'In Vorbereitung')]));raster.append(knopf);
 }
 info.addEventListener('click',()=>{
  const aktuell=el(doc,'div','joker-verdienen');aktuell.append(el(doc,'p','joker-weg','Geburtstag → 1 Box'),el(doc,'p','joker-weg','Bestätigter Test / Lehrabend → 1 Box'),el(doc,'p','joker-weg','4 vollständige Quizwochen → 1 Box'),el(doc,'p','','Ab dem 18.10.2026. Teilnahme muss bestätigt sein; eine Zusage reicht nicht. Für Quizwochen zählt das vollständige Beantworten, nicht die Trefferquote. Die vier Wochen müssen nicht direkt aufeinanderfolgen. Keine Nachholung älterer Ereignisse.'));
  const zufall=el(doc,'div','joker-verdienen');zufall.append(el(doc,'h3','','Öffnen & behalten'),el(doc,'p','joker-weg','Box öffnen → Zufallsjoker → einmal einsetzen'),el(doc,'p','','Neue Ziehungen: 90 % Zweiter Versuch, 10 % Serien-Retter. Keine neuen 50/50-Joker; vorhandene bleiben nutzbar. Kein Kauf, keine freie Auswahl. Boxen und Joker verfallen nicht. Alte Geburtstags-Serienjoker bleiben erhalten.'));
  oeffnen(info,'Wie bekomme ich Joker?',[aktuell,zufall]);
 });
 bereich.append(kopf);
 const boxen=basis?.belohnungen?.boxen;
 if(Array.isArray(boxen)){
  const box=el(doc,'div','joker-boxbereich'),b=el(doc,'button','joker-box-knopf');b.type='button';
  const img=doc.createElement('img');img.src='bilder/joker/box.webp';img.alt='';img.width=100;img.height=100;
  b.append(img,el(doc,'span','',boxen.length?`${boxen.length} ${boxen.length===1?'Box':'Boxen'} · Öffnen`:'Keine ungeöffnete Box'));
  b.disabled=!boxen.length;if(boxen.length)b.dataset.jokerBox=boxen[0].id;
  box.append(b);if(boxen.length)box.append(el(doc,'p','joker-kurzinfo',boxen[0].quelle));bereich.append(box);
 }
 const gesamt=Object.values(basis?.belohnungen?.bestand||{serienjoker:anzahl}).reduce((a,n)=>a+Number(n||0),0);
 bereich.append(raster,el(doc,'p','joker-kurzinfo',gesamt?'Tippe auf ein Symbol für die Erklärung.':'Noch kein Joker im Vorrat. Tippe auf ein graues Symbol für die Erklärung.'),dialog);return bereich;
}
