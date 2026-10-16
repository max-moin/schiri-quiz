import { SPIELBERICHT_THEMEN, spielberichtThema } from './spielbericht-themen.js';

const quelle='https://portal.dfbnet.org/de/service/handbuecher/spielbericht';
const bildpunkte={
 'spielleitung':[[68,28,'Schiedsrichter auswählen']],
 'ergebnis':[[69,31,'Ergebnisart wählen'],[48,67,'Heim- und Gast-Ergebnis prüfen']],
 'spielzeit':[[30,25,'Beginn und Ende abgleichen'],[47,66,'Nachspielzeit eintragen']],
 'strafen':[[23,59,'Heim- oder Gastmannschaft wählen']],
 'strafe-eintragen':[[91,37,'Mannschaft und Spieler prüfen'],[91,57,'Kartentyp wählen'],[51,73,'Spielminute und Nachspielminute trennen']],
 'torschuetzen':[[24,77,'Tor Heim oder Tor Gast hinzufügen']],
 'tor-eintragen':[[91,30,'Mannschaft und Spieler wählen'],[91,45,'Torart wählen'],[51,61,'Minute prüfen']],
 'freigabe':[[12,0,'Zuerst speichern'],[38,0,'Nach Prüfung freigeben']],
};
function el(d,tag,klasse,text){const n=d.createElement(tag);n.className=klasse;if(text!==undefined)n.textContent=text;return n;}
const adresse=t=>`spielbericht.html?thema=${encodeURIComponent(t.id)}`;

// Echte Dokumentnavigation mit URL je Thema, kein Kurz/Lang-Umschalter.
// Alle kanonischen Inhaltsblöcke bleiben im DOM, damit die vorhandene
// Redaktion dieselben IDs und gespeicherten Inhalte weiterverwendet.
export function montiereSpielberichtUebersicht(wurzel,ort=globalThis.location){
 const d=wurzel.ownerDocument,aktuell=spielberichtThema(ort?.search);
 wurzel.querySelectorAll('[data-sb-ansichts-chrome]').forEach(n=>n.remove());
 wurzel.classList.add('sb-nachschlagen');wurzel.dataset.sbDetail=aktuell?.id||'';
 const panels=[...wurzel.querySelectorAll('[data-sb-panel]')];panels.forEach(p=>p.hidden=false);
 const altWerkzeuge=wurzel.querySelector('[data-sb-werkzeuge]');if(altWerkzeuge)altWerkzeuge.hidden=true;
 const schritte=[...wurzel.querySelectorAll('[data-sb-inhalt^="schritt-"]')];
 const elementFuer=t=>schritte.find(n=>n.dataset.sbInhalt===`schritt-${t.schritt}`);
 for(const t of SPIELBERICHT_THEMEN){
  const n=elementFuer(t);if(!n)continue;
  n.hidden=Boolean(aktuell&&aktuell.id!==t.id);
  n.querySelector('h3')?.removeAttribute('aria-level');
  if(!aktuell){
   const h=n.querySelector('h3'),a=el(d,'a','sb-thema-link',h.textContent);a.href=adresse(t);h.replaceChildren(a);
   const mehr=el(d,'a','sb-detail-link',t.bilder?.length?'Erklärung & Bilder →':'Erklärung öffnen →');mehr.href=adresse(t);mehr.dataset.sbAnsichtsChrome='';
   mehr.setAttribute('aria-label',`${t.kurz}: Erklärung öffnen`);n.append(mehr);
  }else{
   n.querySelector('h3 a')?.replaceWith(d.createTextNode(n.querySelector('h3 a').textContent));
  }
 }
 if(!aktuell)return;
 panels.forEach(p=>p.hidden=!p.contains(elementFuer(aktuell)));
 const kopf=el(d,'header','sb-detail-kopf');kopf.dataset.sbAnsichtsChrome='';
 kopf.append(el(d,'p','rk-oberzeile',`Spielbericht · Schritt ${aktuell.schritt}`),el(d,'h1','',aktuell.kurz));
 const nav=el(d,'nav','sb-detail-navigation');nav.dataset.sbAnsichtsChrome='';nav.setAttribute('aria-label','Spielbericht-Themen');
 const zurueck=el(d,'a','rk-knopf','‹ Alle Eintragungen');zurueck.href=`spielbericht.html#${elementFuer(aktuell)?.id||'erfassen'}`;nav.append(zurueck);
 const index=SPIELBERICHT_THEMEN.indexOf(aktuell),danach=SPIELBERICHT_THEMEN[index+1];
 if(danach){const weiter=el(d,'a','rk-knopf',`Weiter: ${danach.kurz} →`);weiter.href=adresse(danach);nav.append(weiter);}
 const originalKopf=wurzel.querySelector('.rk-kopf');originalKopf.before(kopf,nav);
 const n=elementFuer(aktuell);
 n.querySelector('h3')?.setAttribute('aria-level','2');
 if(aktuell.hinweise?.length){
  const felder=el(d,'section','sb-felder');felder.dataset.sbAnsichtsChrome='';felder.setAttribute('aria-label','Was du wo einträgst');
  for(const [titel,text] of aktuell.hinweise){const k=el(d,'div','sb-feld');k.append(el(d,'h3','',titel),el(d,'p','',text));felder.append(k);}n.append(felder);
 }
 if(aktuell.bilder?.length){
  const bilder=el(d,'section','sb-originalbilder');bilder.dataset.sbAnsichtsChrome='';bilder.append(el(d,'h3','','So sieht der Bereich im Handbuch aus'));
  bilder.append(el(d,'p','sb-bildquelle','Originalabbildungen: DFB GmbH, Sammelspielbericht-Handbuch, Stand 03.06.2019. Beispielansichten; einzelne Felder und Berechtigungen können heute abweichen.'));
  for(const [datei,seite,titel] of aktuell.bilder){
   const f=el(d,'figure','sb-originalbild'),a=el(d,'a','sb-bildflaeche'),img=d.createElement('img');img.src=`bilder/dfbnet/${datei}.webp`;img.alt=titel;img.loading='lazy';
   a.href=img.src;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',`${titel}: Originalausschnitt in voller Größe öffnen`);a.append(img);
   const punkte=bildpunkte[datei]||[],legende=el(d,'ol','sb-bildlegende');
   punkte.forEach(([x,y,text],index)=>{const marke=el(d,'span','sb-bildmarke',String(index+1));marke.setAttribute('aria-hidden','true');marke.style.left=x+'%';marke.style.top=y+'%';a.append(marke);legende.append(el(d,'li','',text));});
   const caption=el(d,'figcaption','',`${titel} · Handbuch S. ${seite}. `),q=el(d,'a','','Originalquelle ↗');q.href=quelle;q.target='_blank';q.rel='noopener noreferrer';caption.append(q);f.append(a,legende,caption);bilder.append(f);
  }n.append(bilder);
 }
 document.title=`${aktuell.kurz} – DFBnet-Spielbericht`;
 const ende=nav.cloneNode(true);panels.find(p=>p.contains(n))?.append(ende);
}
