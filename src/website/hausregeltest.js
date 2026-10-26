export const HAUSREGELTEST = Object.freeze({
 titel: 'Hausregeltest 1 · 2026/27',
 vorbereitung_bis: '2026-11-09T00:00:00+01:00',
 endfassung_ab: '2026-11-09T00:00:00+01:00',
 abgabe_bis: '2026-11-23T00:00:00+01:00',
 fragen: [
  'Ein Ersatzspieler muss wegen eines zu langsam durchgeführten Spielerwechsels eine Minute außerhalb des Feldes warten. Unter welchen Voraussetzungen darf der Spieler das Spielfeld wieder betreten.',
  'Ein Verteidiger spielt den Ball nach vorn. Der Ball trifft den Schiedsrichter und gelangt dadurch zu einem gegnerischen Angreifer. Der Schiedsrichter unterbricht. Wie, wo und mit welcher Mannschaft wird das Spiel fortgesetzt?',
  'Nach einer Verletzungsbehandlung auf dem Feld setzt ein Spieler die Versorgung außerhalb fort. Eine Minute ist vergangen. Er bittet um Rückkehr, während der Ball weit entfernt gespielt wird und er nicht unmittelbar eingreifen kann. Muss der Schiedsrichter eine Spielunterbrechung abwarten? Was ist für seine Rückkehr erforderlich?',
  'Ein Angreifer läuft allein auf das Tor zu. Rund 25 Meter davor reißt ihn ein Verteidiger um und verhindert damit eine offensichtliche Torchance. Der Schiedsrichter lässt Vorteil gelten. Ein weiterer Angreifer übernimmt den Ball und erzielt nach wenigen Metern ein Tor. Welche Spielfortsetzung und welche persönliche Strafe sind richtig?',
  'Bei einem Abstoß verzögert der Torhüter die Ausführung. Der Schiedsrichter zeigt mit erhobenem Arm den Fünf-Sekunden-Countdown an. Auch nach dessen Ablauf ist der Ball nicht im Spiel. Welche Spielfortsetzung erfolgt und von welcher Seite?',
  'Bei einem Einwurf hebt der Werfer einen Fuß bereits vor dem Loslassen des Balls deutlich an. Der Ball berührt zunächst außerhalb des Feldes den Boden und rollt erst anschließend hinein. Ein Gegner nimmt ihn auf und könnte aussichtsreich angreifen. Wie entscheidet der Schiedsrichter? Begründe.',
  'Ein Spieler verlässt nach einer Verletzungsbehandlung das Spielfeld. Seine Mannschaft möchte ihn unmittelbar durch einen Ersatzspieler ersetzen. Darf dieser sofort mitspielen oder muss er eine Minute warten? Begründe.',
  'Ein Spieler führt einen Eckstoß trotz Aufforderung weiterhin nicht aus. Der Schiedsrichter zählt fünf Sekunden herunter und entscheidet danach auf Abstoß, ohne den Spieler zu verwarnen. Wie hätte er richtig entscheiden müssen?',
  'Bei einem Strafstoß rutscht der Schütze aus. Nach dem Schuss berührt der Ball unabsichtlich noch sein Standbein und fliegt anschließend direkt ins Tor. Der Torhüter hat sich regelkonform verhalten. Wie entscheidet der Schiedsrichter? Begründe.',
  'Ein Flügelspieler dribbelt auf der linken Seite und will eine Flanke vorbereiten. Sein zentraler Mitspieler läuft sich frei, steht nicht im Abseits und hat den Ball noch nicht erhalten. Bevor die Flanke gespielt wird, stellt ihm ein Verteidiger knapp außerhalb des Strafraums in unsportlicher Absicht ein Bein. Damit unterbindet er eine gute Angriffssituation mit zu erwartendem Zuspiel. Welche Spielfortsetzung und persönliche Strafe folgen?',
 ],
});

export function auswerterAdresse(name) {
 const worte=String(name||'').trim().split(/\s+/);
 const nachname=worte.at(-1)?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^ß/i,'s').toUpperCase();
 if(!nachname || !/^[A-Z]/.test(nachname)) return '';
 return `auswerter${nachname[0]<='J'?1:nachname[0]<='Q'?2:3}@svf-dresden.de`;
}
export function textdatei(fassung) {
 const k=fassung?.kopf,a=fassung?.antworten;
 if(!fassung?.bestaetigt_am || !k || !['name','verein','einstufung'].every(f=>typeof k[f]==='string'&&k[f].trim()&&!/[\r\n]/.test(k[f])) || !Array.isArray(a)||a.length!==10||!a.every(x=>typeof x==='string'&&x.trim()))throw new Error('Bitte zuerst die vollständige Endfassung bestätigen.');
 return [`Name: ${k.name}`,`Verein: ${k.verein}`,`Einstufung: ${k.einstufung}`,'__________________________________________________________________________','',
 ...a.flatMap((x,i)=>[`(${i+1})`,x.replace(/\r\n?/g,'\n'),'','    Punkte:','--------------------------------------------------------------------------',''])].join('\r\n').replace(/(?<!\r)\n/g,'\r\n');
}
export function dateiname(fassung) {
 const name=String(fassung?.kopf?.name||'Abgabe').normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,70);
 return `Hausregeltest_1_2026-27_${name}_v${Number(fassung.revision)||1}.txt`;
}
export function ladeTextdatei(fassung,doc=document) {
 const url=URL.createObjectURL(new Blob([textdatei(fassung)],{type:'text/plain;charset=utf-8'}));
 const a=doc.createElement('a');a.href=url;a.download=dateiname(fassung);doc.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function erstelleHrtZugriff({adresse,oeffentlicherSchluessel}) {
 async function rpc(name,params){
  const r=await fetch(`${adresse}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:oeffentlicherSchluessel,Authorization:`Bearer ${oeffentlicherSchluessel}`},body:JSON.stringify(params)});
  const d=await r.json();if(!r.ok)throw new Error(d.message||'Speichern nicht möglich. Bitte erneut versuchen.');return d;
 }
 const login=p=>({p_schiedsrichter_id:p.id,p_pin:p.pin});
 return {laden:p=>rpc('hausregeltest_laden',login(p)),speichern:(p,s)=>rpc('hausregeltest_speichern',{...login(p),...s})};
}

// Genau eine laufende Speicherung; Eingaben währenddessen werden danach gespeichert.
// Keine lokale Speicherung von Antworten. Ein Fehler stoppt Autosave bis zum bewussten Retry.
export function erstelleHrtSpeicher({senden,erfolg,fehler,takt=700}) {
 let timer=null,laeuft=false,offen=null,gestoppt=false,geschlossen=false;
 async function flush(){
  clearTimeout(timer);if(laeuft||!offen||gestoppt||geschlossen)return false;
  const x=offen;offen=null;laeuft=true;
  try{const d=await senden(x);if(!geschlossen)erfolg(d,x,Boolean(offen));}
  catch(e){if(!offen)offen=x;gestoppt=true;if(!geschlossen)fehler(e);}
  finally{laeuft=false;if(offen&&!gestoppt&&!geschlossen)void flush();}
  return !gestoppt&&!offen;
 }
 return {merken(x){offen=x;if(!gestoppt){clearTimeout(timer);timer=setTimeout(flush,takt);}},flush,
  retry(){gestoppt=false;return flush();},offen:()=>!geschlossen&&Boolean(offen||laeuft),stop(){geschlossen=true;offen=null;clearTimeout(timer);}};
}
