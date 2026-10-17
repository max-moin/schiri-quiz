function el(d,tag,klasse,text){const e=d.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;}

// Nur eigene abgeleitete Statistiken. Die Bilder sind vorab erzeugte lokale
// Dateien; beim Anklicken wird weder KI noch ein Vergabe-Endpunkt aufgerufen.
export function zeichneAbzeichenSammlung(doc,serie){
 const sammlung=el(doc,'section','abzeichen-sammlung');sammlung.setAttribute('aria-label','Deine Abzeichensammlung');
 const verdient=serie.abzeichen.filter(b=>b.verdient).length;
 const kopf=el(doc,'div','abzeichen-kopf');kopf.append(el(doc,'h3','','Deine Sammlung'),el(doc,'span','abzeichen-zaehler',`${verdient} / ${serie.abzeichen.length}`));
 const raster=el(doc,'div','abzeichen-raster'),dialog=el(doc,'dialog','abzeichen-dialog');
 dialog.setAttribute('aria-labelledby','abzeichen-dialog-titel');let ausloeser=null;
 dialog.addEventListener('close',()=>{if(ausloeser?.isConnected)ausloeser.focus();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 for(const b of serie.abzeichen){
  const knopf=el(doc,'button',`abzeichen-aufmacher${b.verdient?' verdient':' nicht-verdient'}`);knopf.type='button';
  knopf.setAttribute('aria-label',`${b.titel} – ${b.verdient?'erreicht':'noch nicht erreicht'}`);knopf.setAttribute('aria-haspopup','dialog');
  const bild=doc.createElement('img');bild.src=`bilder/abzeichen/${b.id}.webp`;bild.alt='';bild.width=256;bild.height=256;bild.loading='lazy';knopf.append(bild);
  knopf.addEventListener('click',()=>{
   ausloeser=knopf;const schliessen=el(doc,'button','abzeichen-schliessen','×');schliessen.type='button';schliessen.autofocus=true;schliessen.setAttribute('aria-label','Schließen');schliessen.addEventListener('click',()=>dialog.close());
   const titel=el(doc,'h2','',b.titel);titel.id='abzeichen-dialog-titel';
   const motiv=bild.cloneNode();motiv.loading='eager';motiv.className=b.verdient?'abzeichen-dialog-bild':'abzeichen-dialog-bild nicht-verdient';
   const stand=el(doc,'p','abzeichen-status',b.verdient?'Erreicht':'Noch nicht erreicht');
   const fortschritt=el(doc,'p','abzeichen-fortschritt',`${b.stand} / ${b.ziel} ${b.art==='serie'?'Wochen · längste Serie':b.art==='rettung'?'Wochen gerettet':'Wochen vollständig'}`);
   const balken=doc.createElement('progress');balken.max=b.ziel;balken.value=Math.min(b.stand,b.ziel);balken.setAttribute('aria-label',`${b.titel}: ${b.stand} von ${b.ziel}`);
   dialog.replaceChildren(schliessen,motiv,titel,stand,el(doc,'p','',b.text),fortschritt,balken);
   if(b.art==='teilnahme')dialog.append(el(doc,'p','abzeichen-kurzinfo','Richtige und falsche Antworten zählen. Gerettete Wochen zählen hier nicht.'));
   if(b.art==='serie')dialog.append(el(doc,'p','abzeichen-kurzinfo','Gerettete Wochen zählen mit. Eine spätere Lücke nimmt dir die längste Serie nicht weg.'));
   if(b.art==='rettung')dialog.append(el(doc,'p','abzeichen-kurzinfo','Mit fünf richtigen Übungsfragen oder einem Joker. Quizpunkte bleiben unverändert.'));
   const wochen=serie.wochen.filter(w=>b.art==='rettung'?w.status==='gerettet':w.status==='abgeschlossen');
   if(wochen.length&&b.art!=='serie'){
    dialog.append(el(doc,'h3','',b.art==='rettung'?'Zuletzt gerettet':'Zuletzt abgeschlossen'));const liste=el(doc,'ul','abzeichen-wochen');
    for(const w of wochen.slice(-3).reverse())liste.append(el(doc,'li','',w.bezeichnung||'Wochenquiz'));dialog.append(liste);
   }
   const hinweis=el(doc,'a','abzeichen-bildhinweis','KI-Bildhinweis');hinweis.href='impressum.html#ki-bilder';dialog.append(hinweis);dialog.showModal();
  });raster.append(knopf);
 }
 sammlung.append(kopf,raster,dialog);return sammlung;
}
