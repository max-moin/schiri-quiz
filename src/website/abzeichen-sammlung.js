function el(d,tag,klasse,text){const e=d.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;}

// Nur eigene abgeleitete Statistiken. Die Bilder sind vorab erzeugte lokale
// Dateien; beim Anklicken wird weder KI noch ein Vergabe-Endpunkt aufgerufen.
export function zeichneAbzeichenSammlung(doc,serie){
 const sammlung=el(doc,'section','abzeichen-sammlung');sammlung.setAttribute('aria-label','Deine Abzeichensammlung');
 const verdient=serie.abzeichen.filter(b=>b.verdient).length;
 const kopf=el(doc,'div','abzeichen-kopf');kopf.append(el(doc,'h3','','Deine Sammlung'),el(doc,'span','abzeichen-zaehler',`${verdient} / ${serie.abzeichen.length}`));
 const schrank=el(doc,'div','abzeichen-schrank'),dialog=el(doc,'dialog','abzeichen-dialog');
 const gruppen=new Map();
 for(const [id,titel] of [['mitmachen','Mitmachen & Dranbleiben'],['wissen','Dein Regelwissen'],['besonderes','Besondere Momente']]){
  const fach=el(doc,'section','abzeichen-fach');fach.setAttribute('aria-label',titel);
  fach.append(el(doc,'h4','abzeichen-fachtitel',titel));const raster=el(doc,'div','abzeichen-raster');fach.append(raster);schrank.append(fach);gruppen.set(id,raster);
 }
 dialog.setAttribute('aria-labelledby','abzeichen-dialog-titel');let ausloeser=null;
 dialog.addEventListener('close',()=>{if(ausloeser?.isConnected)ausloeser.focus();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 for(const b of serie.abzeichen){
  const knopf=el(doc,'button',`abzeichen-aufmacher${b.verdient?' verdient':' nicht-verdient'}`);knopf.type='button';
  knopf.setAttribute('aria-label',`${b.titel} – ${b.datenFehlen?'Statistik nicht verfügbar':b.verdient?'erreicht':'noch nicht erreicht'}`);knopf.setAttribute('aria-haspopup','dialog');
  const bild=doc.createElement('img');bild.src=`bilder/abzeichen/${b.id}.webp`;bild.alt='';bild.width=256;bild.height=256;bild.loading='lazy';knopf.append(bild);
  knopf.addEventListener('click',()=>{
   ausloeser=knopf;const schliessen=el(doc,'button','abzeichen-schliessen','×');schliessen.type='button';schliessen.autofocus=true;schliessen.setAttribute('aria-label','Schließen');schliessen.addEventListener('click',()=>dialog.close());
   const titel=el(doc,'h2','',b.titel);titel.id='abzeichen-dialog-titel';
   const motiv=bild.cloneNode();motiv.loading='eager';motiv.className=b.verdient?'abzeichen-dialog-bild':'abzeichen-dialog-bild nicht-verdient';
   const stand=el(doc,'p','abzeichen-status',b.datenFehlen?'Zusätzliche Statistik gerade nicht verfügbar':b.verdient?'Erreicht':'Noch nicht erreicht');
   const einheiten={serie:'Wochen · längste Serie',rettung:'Wochen gerettet',teilnahme:'Wochen vollständig',perfekt:'perfekte Wochen','perfekt-serie':'perfekte Wochen in Folge',regel:'verschiedene Fragen',kompass:'Regeln',treffer:'verschiedene Fragen',mut:'Wochen',vorschlag:'übernommene Vorschläge'};
   const fortschritt=el(doc,'p','abzeichen-fortschritt',b.datenFehlen?'Bitte aktualisiere die Ansicht später. Es wird kein Nullstand als Erfolgshistorie ausgegeben.':`${b.stand} / ${b.ziel} ${einheiten[b.art]||''}`);
   const balken=doc.createElement('progress');balken.max=b.ziel;balken.value=Math.min(b.stand,b.ziel);balken.setAttribute('aria-label',`${b.titel}: ${b.stand} von ${b.ziel}`);
   balken.hidden=!!b.datenFehlen;
   dialog.replaceChildren(schliessen,motiv,titel,stand,el(doc,'p','',b.text),fortschritt,balken);
   if(b.art==='teilnahme')dialog.append(el(doc,'p','abzeichen-kurzinfo','Richtige und falsche Antworten zählen. Gerettete Wochen zählen hier nicht.'));
   if(b.art==='serie')dialog.append(el(doc,'p','abzeichen-kurzinfo','Gerettete Wochen zählen mit. Eine spätere Lücke nimmt dir die längste Serie nicht weg.'));
   if(b.art==='rettung')dialog.append(el(doc,'p','abzeichen-kurzinfo','Mit fünf richtigen Übungsfragen oder einem Joker. Quizpunkte bleiben unverändert.'));
   const wochen=serie.wochen.filter(w=>b.art==='rettung'?w.status==='gerettet':w.status==='abgeschlossen');
   if(wochen.length&&['rettung','teilnahme'].includes(b.art)){
    dialog.append(el(doc,'h3','',b.art==='rettung'?'Zuletzt gerettet':'Zuletzt abgeschlossen'));const liste=el(doc,'ul','abzeichen-wochen');
    for(const w of wochen.slice(-3).reverse())liste.append(el(doc,'li','',w.bezeichnung||'Wochenquiz'));dialog.append(liste);
   }
   if(['regel','kompass','treffer'].includes(b.art))dialog.append(el(doc,'p','abzeichen-kurzinfo','Wochenquiz und Üben zählen gemeinsam; dieselbe Frage nur einmal. Gast und Duell zählen nicht.'));
   if(b.art==='kompass'&&!b.datenFehlen){
    const regeln=el(doc,'ul','abzeichen-regeln');
    for(const r of serie.regeln)regeln.append(el(doc,'li',r.stand?'regel-erreicht':'',`Regel ${r.nummer} · ${r.stand} richtig`));dialog.append(regeln);
   }
   const hinweis=el(doc,'a','abzeichen-bildhinweis','KI-Bildhinweis');hinweis.href='impressum.html#ki-bilder';dialog.append(hinweis);dialog.showModal();
  });gruppen.get(['teilnahme','serie','rettung'].includes(b.art)?'mitmachen':['regel','kompass','treffer'].includes(b.art)?'wissen':'besonderes').append(knopf);
 }
 sammlung.append(kopf,schrank,dialog);return sammlung;
}
