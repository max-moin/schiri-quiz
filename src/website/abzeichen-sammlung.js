function el(d,tag,klasse,text){const e=d.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;}

// Ausschließlich abgeleitete eigene Statistiken: kein Vergabe-Endpunkt und
// keine Speicherung vermeintlich erreichter Abzeichen auf dem Gerät.
export function zeichneAbzeichenSammlung(doc,serie){
 const sammlung=el(doc,'section','abzeichen-sammlung');sammlung.setAttribute('aria-label','Deine Abzeichensammlung');
 const verdient=serie.abzeichen.filter(b=>b.verdient).length;
 sammlung.append(el(doc,'h3','',`Deine Abzeichen · ${verdient} von ${serie.abzeichen.length}`),el(doc,'p','abzeichen-einstieg','Tippe auf ein Abzeichen: Ziel, Fortschritt und dein Weg dorthin.'));
 const raster=el(doc,'div','abzeichen-raster');
 for(const b of serie.abzeichen){
  const karte=el(doc,'details',`abzeichen-karte${b.verdient?' verdient':''}`);
  const knopf=el(doc,'summary','abzeichen-aufmacher');
  const bild=doc.createElement('img');bild.src=`bilder/abzeichen/${b.id}.svg`;bild.alt='';bild.width=144;bild.height=160;bild.loading='lazy';
  const name=el(doc,'span','abzeichen-name',b.titel),status=el(doc,'span','abzeichen-status',b.verdient?'✓ Erreicht':'Noch offen');
  knopf.append(bild,name,status,el(doc,'span','abzeichen-mehr','Details +'));karte.append(knopf);
  const inhalt=el(doc,'div','abzeichen-inhalt');inhalt.append(el(doc,'p','',b.text));
  const einheit=b.stand===1?'Woche':'Wochen';
  const text=b.art==='serie'?`Beste Serie: ${b.stand} ${einheit} · Ziel: ${b.ziel}.`:b.art==='rettung'?`${b.stand} ${einheit} gerettet · Ziel: ${b.ziel}.`:`${b.stand} ${einheit} vollständig · Ziel: ${b.ziel}.`;
  inhalt.append(el(doc,'p','abzeichen-fortschritt',text));
  const balken=doc.createElement('progress');balken.max=b.ziel;balken.value=Math.min(b.stand,b.ziel);balken.setAttribute('aria-label',`${b.titel}: ${text}`);inhalt.append(balken);
  inhalt.append(el(doc,'p','abzeichen-erklaerung',b.art==='serie'?'Gerettete Wochen zählen zur Serie. Eine spätere Lücke nimmt dir diesen Meilenstein nicht weg.':b.art==='rettung'?'Durch fünf richtige Übungsantworten oder einen Joker. Die ursprünglichen Wochenantworten bleiben unverändert.':'Nur vollständig beantwortete Wochen zählen hier, keine geretteten Wochen. Richtige und falsche Antworten zählen gleichermaßen.'));
  const wochen=serie.wochen.filter(w=>b.art==='rettung'?w.status==='gerettet':w.status==='abgeschlossen');
  // Keine scheinbar exakte Erreichungswoche für Serien aus bloß gefilterten
  // Abschlüssen ableiten: dafür wären auch Lücken/Rettungen zu berücksichtigen.
  if(wochen.length&&b.art!=='serie'){
   inhalt.append(el(doc,'h4','',b.art==='rettung'?'Deine geretteten Wochen':'Zuletzt abgeschlossen'));
   const liste=el(doc,'ul','abzeichen-wochen');
   for(const w of wochen.slice(-3).reverse())liste.append(el(doc,'li','',w.bezeichnung||'Wochenquiz'));
   inhalt.append(liste);
  }
  karte.append(inhalt);raster.append(karte);
 }
 sammlung.append(raster);return sammlung;
}
