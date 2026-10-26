// Reine Auswertung + Darstellung. Keine Teilnehmerdaten im öffentlichen HTML.
export function pruefeSoccergolf(d){
 const fehler=[];
 if(!d||!Number.isInteger(d.bahnen)||d.bahnen<1||d.bahnen>36)return ['Bitte 1 bis 36 Bahnen angeben.'];
 if(!Array.isArray(d.teilnehmer)||d.teilnehmer.length>60)return ['Maximal 60 Personen sind möglich.'];
 const namen=new Set();
 for(const p of d.teilnehmer){
  const name=String(p?.name||'').trim();
  if(!name||name.length>80)fehler.push('Jede Person braucht einen Namen (maximal 80 Zeichen).');
  if(namen.has(name.toLocaleLowerCase('de')))fehler.push('Namen müssen zur Zuordnung eindeutig sein.');
  namen.add(name.toLocaleLowerCase('de'));
  if(!Array.isArray(p?.schlaege)||p.schlaege.length!==d.bahnen||p.schlaege.some(n=>n!==null&&(!Number.isInteger(n)||n<1||n>99)))fehler.push('Je Bahn: 1 bis 99 Schläge oder leer.');
 }
 if(typeof d.text!=='string'||d.text.length>2000)fehler.push('Der Rückblick darf maximal 2000 Zeichen lang sein.');
 if(String(d.plan_quelle||'').length>200)fehler.push('Die Bildquelle darf maximal 200 Zeichen lang sein.');
 if(d.plan_link&&!sichererLink(d.plan_link))fehler.push('Bitte einen vollständigen HTTPS-Link zum Anlagenplan angeben.');
 if(d.plan_bild&&!sicheresPlanbild(d.plan_bild))fehler.push('Der Plan muss aus euren Website-Bildern stammen.');
 return fehler;
}
export function sichererLink(wert){try{const u=new URL(wert);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export function externesPlanbild(wert){
 try {const u=new URL(wert);return u.protocol==='https:'&&u.hostname==='www.soccergolf-sachsen.de'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/assets\/images\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/i.test(u.pathname);}catch{return false;}
}
export function sicheresPlanbild(wert){
 const s=String(wert||'');
 if(/^bilder\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(s)&&!s.includes('..'))return true;
 try{const u=new URL(s);return u.origin==='https://ivwmixaicpmtvcjtnbjv.supabase.co'&&u.pathname.startsWith('/storage/v1/object/public/website-bilder/')&&/\.(png|jpe?g|webp)$/i.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}
}
export function soccergolfRangliste(d){
 if(pruefeSoccergolf(d).length)throw new Error('Ungültige Soccer-Golf-Ergebnisse.');
 const reihen=d.teilnehmer.map((p,i)=>({...p,index:i,gespielt:p.schlaege.filter(n=>n!==null).length,summe:p.schlaege.reduce((a,n)=>a+(n??0),0)}));
 const fertig=reihen.filter(p=>p.gespielt===d.bahnen).sort((a,b)=>a.summe-b.summe||a.index-b.index);
 let letzter=null,rang=0;
 fertig.forEach((p,i)=>{if(p.summe!==letzter)rang=i+1;p.platz=rang;letzter=p.summe;});
 return [...fertig,...reihen.filter(p=>p.gespielt!==d.bahnen).map(p=>({...p,platz:null}))];
}
function el(doc,tag,klasse,text){const e=doc.createElement(tag);e.className=klasse;if(text!==undefined)e.textContent=text;return e;}
export function zeichneSoccergolf(doc,d){
 const rangliste=soccergolfRangliste(d),bereich=el(doc,'section','golf-rueckblick');
 const kopf=el(doc,'header','golf-kopf');kopf.append(el(doc,'span','golf-kicker','Unser gemeinsamer Spieltag'),el(doc,'h2','','Soccer-Golf · der Rückblick'),el(doc,'p','',`${rangliste.length} Personen · ${d.bahnen} Bahnen · weniger Schläge ist besser`));bereich.append(kopf);
 if(d.text){const text=el(doc,'p','golf-erinnerung',d.text);text.style.whiteSpace='pre-line';bereich.append(text);}
 const top=el(doc,'div','golf-podium');
 for(const p of rangliste.filter(p=>p.platz!==null&&p.platz<=3)){
  const k=el(doc,'div','golf-platz golf-platz-'+p.platz);k.append(el(doc,'span','golf-rang','Platz '+p.platz),el(doc,'h3','',p.name),el(doc,'strong','',`${p.summe} Schläge`));top.append(k);
 }
 if(top.children.length)bereich.append(top);
 const scroll=el(doc,'div','golf-tabelle-halter');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Ergebnisse je Bahn, horizontal scrollbar');
 const t=el(doc,'table','golf-tabelle');t.append(el(doc,'caption','','Ergebnisse je Bahn'));
 const head=el(doc,'thead',''),hr=el(doc,'tr','');
 for(const label of ['Platz','Name','Gesamt',...Array.from({length:d.bahnen},(_,i)=>'Bahn '+(i+1))]){const th=el(doc,'th',label==='Gesamt'?'golf-summe':'',label);th.scope='col';hr.append(th);}head.append(hr);t.append(head);
 const body=el(doc,'tbody','');
 for(const p of rangliste){const tr=el(doc,'tr','');tr.append(el(doc,'td','',p.platz??'–'));const name=el(doc,'th','',p.name);name.scope='row';tr.append(name);tr.append(el(doc,'td','golf-summe',p.platz===null?`${p.summe} · ${p.gespielt}/${d.bahnen} Bahnen`:String(p.summe)));for(const n of p.schlaege)tr.append(el(doc,'td','',n??'–'));body.append(tr);}t.append(body);scroll.append(t);bereich.append(scroll);
 bereich.append(el(doc,'p','golf-tabellenhinweis','Alle Bahnen: seitlich scrollen. Gleiche Summe = gleicher Platz. Unvollständige Runden ohne Rang.'));
 if(d.plan_bild&&sicheresPlanbild(d.plan_bild)){const fig=el(doc,'figure','golf-plan'),img=el(doc,'img','');img.src=d.plan_bild;img.alt='Anlagenplan der Soccer-Golf-Anlage mit den Spielbahnen';img.loading='lazy';fig.append(img,el(doc,'figcaption','',d.plan_quelle||'Anlagenplan'));bereich.append(fig);}
 else if(externesPlanbild(d.plan_link)){
  const fig=el(doc,'figure','golf-plan');
  const b=el(doc,'button','golf-plan-laden','Anlagenplan hier anzeigen');b.type='button';
  const info=el(doc,'p','golf-tabellenhinweis','Lädt das Bild von SoccerGolf Sachsen. Dabei wird deine IP-Adresse an den Betreiber übertragen.');
  b.addEventListener('click',()=>{b.disabled=true;const img=el(doc,'img','');img.alt='Anlagenplan von SoccerGolf Sachsen mit den Spielbahnen';img.referrerPolicy='no-referrer';img.src=d.plan_link;img.addEventListener('load',()=>{b.remove();info.textContent=d.plan_quelle||'Quelle: SoccerGolf Sachsen · Anlagenplan';});img.addEventListener('error',()=>{img.remove();b.disabled=false;info.textContent='Bild konnte nicht geladen werden. Nutze den Betreiberlink darunter.';});fig.prepend(img);});
  fig.append(b,info);bereich.append(fig);
 }
 if(d.plan_link&&sichererLink(d.plan_link)){const a=el(doc,'a','golf-plan-link','Anlagenplan / Betreiber öffnen');a.href=d.plan_link;a.target='_blank';a.rel='noopener noreferrer';bereich.append(a);}
 return bereich;
}
