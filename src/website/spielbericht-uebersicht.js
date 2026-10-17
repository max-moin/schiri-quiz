import { SPIELBERICHT_THEMEN, spielberichtThema } from './spielbericht-themen.js';

const quelle='https://portal.dfbnet.org/de/service/handbuecher/spielbericht';
const bildpunkte={
 'spielleitung':[[68,28,'Schiedsrichter','Tatsächlich leitende Person auswählen. Im Einzelspielbericht auch die Assistenten abgleichen.']],
 'ergebnis':[[65,40,'Ergebnisart','Passenden Eintrag wählen: normales Ergebnis oder z. B. tatsächlicher Abbruch.'],[59.5,66,'Heim / Gast','Die angebotenen Ergebnisfelder mit den Notizen abgleichen. Heim und Gast nicht vertauschen.']],
 'spielzeit':[[17,25,'Beginn / Ende','Vorbelegte Zeiten mit dem tatsächlichen Verlauf vergleichen.'],[24,62,'Nachspielzeit','Zusätzliche Minuten eintragen, nicht die gesamte Halbzeitlänge. Bei verspätetem Beginn den Grund unter Bemerkungen nennen.']],
 'strafen':[[23,59,'Heim- oder Gastmannschaft wählen']],
 'strafe-eintragen':[[91,37,'Mannschaft und Spieler prüfen'],[91,57,'Kartentyp wählen'],[51,73,'Spielminute und Nachspielminute trennen']],
 'torschuetzen':[[24,77,'Tor Heim oder Tor Gast hinzufügen']],
 'tor-eintragen':[[91,30,'Mannschaft und Spieler wählen'],[91,45,'Torart wählen'],[51,61,'Minute prüfen']],
 'freigabe':[[12,0,'Zuerst speichern'],[38,0,'Nach Prüfung freigeben']],
};
function el(d,tag,klasse,text){const n=d.createElement(tag);n.className=klasse;if(text!==undefined)n.textContent=text;return n;}
const adresse=t=>`spielbericht.html?thema=${encodeURIComponent(t.id)}`;
function hotbar(d,aktuell,zurueckAdresse){
 const nav=el(d,'nav','sb-hotbar');nav.dataset.sbAnsichtsChrome='';nav.setAttribute('aria-label','Spielbericht-Themen');
 const index=SPIELBERICHT_THEMEN.indexOf(aktuell);
 const symbole={vor:'M17 4L5 12l12 8z',liste:'M4 6h1m5 0h10M4 12h1m5 0h10M4 18h1m5 0h10',weiter:'M7 4l12 8-12 8z'};
 for(const [art,t,text] of [['vor',SPIELBERICHT_THEMEN[index-1],'Zurück'],['liste',null,'Übersicht'],['weiter',SPIELBERICHT_THEMEN[index+1],'Weiter']]){
  const aktiv=art==='liste'||t,knopf=el(d,aktiv?'a':'span','sb-hotbar-knopf');
  if(aktiv){knopf.href=art==='liste'?zurueckAdresse:adresse(t);knopf.setAttribute('aria-label',art==='liste'?'Zur Übersicht aller Eintragungen':`${text}: ${t.kurz}`);}else knopf.setAttribute('aria-disabled','true');
  const svg=d.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=d.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',symbole[art]);svg.append(path);knopf.append(svg);nav.append(knopf);
 }return nav;
}

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
  if(!n.id)n.id=`sb-thema-${t.id}`;
  n.hidden=Boolean(aktuell&&aktuell.id!==t.id);
  n.querySelector('h3')?.removeAttribute('aria-level');
  if(!aktuell){
   const h=n.querySelector('h3'),a=el(d,'a','sb-thema-link',h.textContent);a.href=adresse(t);h.replaceChildren(a);
  }else{
   n.querySelector('h3 a')?.replaceWith(d.createTextNode(n.querySelector('h3 a').textContent));
  }
 }
 if(!aktuell)return;
 panels.forEach(p=>p.hidden=!p.contains(elementFuer(aktuell)));
 const kopf=el(d,'header','sb-detail-kopf');kopf.dataset.sbAnsichtsChrome='';
 const themenTitel=elementFuer(aktuell)?.querySelector('h3')?.textContent||aktuell.kurz;
 kopf.append(el(d,'p','rk-oberzeile',`Spielbericht · Schritt ${aktuell.schritt}`),el(d,'h1','',themenTitel));
 const nav=hotbar(d,aktuell,`spielbericht.html#${elementFuer(aktuell)?.id||'erfassen'}`);
 const originalKopf=wurzel.querySelector('.rk-kopf');originalKopf.before(kopf,nav);
 const n=elementFuer(aktuell);
 n.querySelector('h3')?.setAttribute('aria-level','2');
 if(!aktuell.bilder?.length&&aktuell.hinweise?.length){
  const felder=el(d,'section','sb-felder');felder.dataset.sbAnsichtsChrome='';felder.setAttribute('aria-label','Was du wo einträgst');
  felder.append(el(d,'h2','','Das trägst du ein'));
  for(const [titel,text] of aktuell.hinweise){const k=el(d,'div','sb-feld');k.append(el(d,'h3','',titel),el(d,'p','',text));felder.append(k);}n.append(felder);
 }
 if(aktuell.bilder?.length){
  const bilder=el(d,'section','sb-originalbilder');bilder.dataset.sbAnsichtsChrome='';bilder.append(el(d,'h2','','Im Spielbericht'));
  for(const [datei,seite,titel] of aktuell.bilder){
   const f=el(d,'figure','sb-originalbild'),a=el(d,'div','sb-bildflaeche'),img=d.createElement('img');img.src=`bilder/dfbnet/${datei}.webp`;img.alt=titel;img.loading='lazy';a.append(img);
   const punkte=bildpunkte[datei]||[],legende=el(d,'ol','sb-bildlegende');
   punkte.forEach(([x,y,text,erklaerung],index)=>{const marke=el(d,'span','sb-bildmarke',String(index+1));marke.setAttribute('aria-hidden','true');marke.style.left=x+'%';marke.style.top=y+'%';a.append(marke);const k=el(d,'li','sb-bildkarte'),nummer=el(d,'span','sb-hinweisnummer',String(index+1));nummer.setAttribute('aria-hidden','true');const inhalt=el(d,'div','');inhalt.append(el(d,'h3','',text));if(erklaerung)inhalt.append(el(d,'p','',erklaerung));k.append(nummer,inhalt);legende.append(k);});
   const caption=el(d,'figcaption','',`DFB-Handbuch · S. ${seite} · 2019. `),q=el(d,'a','','Originalquelle ↗');q.href=quelle;q.target='_blank';q.rel='noopener noreferrer';caption.append(q);f.append(a,legende,caption);bilder.append(f);
  }bilder.append(el(d,'p','sb-bildquelle','Stand 03.06.2019 · Sammelspielbericht. Felder und Rechte können heute im Einzelspielbericht abweichen.'));n.append(bilder);
 }
 const lang=[...n.querySelectorAll(':scope > .rk-lang')];lang.forEach((p,i)=>{p.hidden=true;p.id=`sb-lang-${aktuell.schritt}-${i}`;});
 if(lang.length){const mehr=el(d,'button','sb-mehr-hinweise','Weitere Hinweise');mehr.type='button';mehr.dataset.sbAnsichtsChrome='';mehr.setAttribute('aria-expanded','false');mehr.setAttribute('aria-controls',lang.map(p=>p.id).join(' '));mehr.addEventListener('click',()=>{const offen=mehr.getAttribute('aria-expanded')!=='true';mehr.setAttribute('aria-expanded',String(offen));lang.forEach(p=>p.hidden=!offen);});n.append(mehr,...lang);}
 document.title=`${themenTitel} – DFBnet-Spielbericht`;
}
