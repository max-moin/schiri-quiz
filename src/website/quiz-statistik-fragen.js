export const STATUS_TEXTE=Object.freeze({richtig:'Richtig',nachbessern:'Rückfrage offen',falsch:'Falsch',offen:'Nicht beantwortet'});
export function wochenAnteile(woche){
 const zahl=x=>Math.max(0,Math.floor(Number(x)||0)),gesamt=zahl(woche.fragen_gesamt);
 const richtig=Math.min(gesamt,zahl(woche.richtig));
 const nachbessern=Math.min(gesamt-richtig,zahl(woche.nachbessern));
 const falsch=Math.min(gesamt-richtig-nachbessern,zahl(woche.falsch));
 return {gesamt,richtig,nachbessern,falsch,offen:gesamt-richtig-nachbessern-falsch};
}
export function zeichneStatusZaehler(doc,anteile){
 const zeile=doc.createElement('div');zeile.className='statistik-statuszaehler';
 for(const [status,text] of Object.entries(STATUS_TEXTE)){
  const gruppe=doc.createElement('span');gruppe.className='statistik-statusgruppe';
  const zahl=doc.createElement('strong');zahl.className='statistik-statuskreis '+status;zahl.textContent=String(anteile[status]);
  const label=doc.createElement('span');label.textContent=text;
  gruppe.append(zahl,label);zeile.append(gruppe);
 }
 return zeile;
}
export function zeichneFragenStatus(doc,daten){
 const liste=doc.createElement('ol');liste.className='statistik-fragen';
 for(const f of Array.isArray(daten)?daten:[]){
  const zeile=doc.createElement('li'),status=Object.hasOwn(STATUS_TEXTE,f.status)?f.status:'offen';zeile.className='statistik-frage '+status;
  const titel=doc.createElement('span');titel.className='statistik-frage-text';
  // Keine internen Titel, Videoadressen, eigenen Antworten oder Lösungen.
  titel.textContent=f.medium==='video'?'Video-Frage':f.medium==='bild'?'Bild-Frage':String(f.frage_text||'Regelfrage');
  const wert=doc.createElement('strong');wert.className='statistik-status '+status;wert.textContent=STATUS_TEXTE[status];
  zeile.append(titel,wert);liste.append(zeile);
 }
 if(!liste.children.length){const leer=doc.createElement('li');leer.textContent='Keine Fragen in dieser Woche.';liste.append(leer);}
 return liste;
}
