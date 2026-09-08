import { DATENBANK } from "../../verein.config.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung ||
  globalThis.SchiriAnmeldung.erstelleAnmeldung({ adresse:DATENBANK.adresse, oeffentlicherSchluessel:DATENBANK.oeffentlicherSchluessel });
const rpc = globalThis.SchiriRpc.erstelleRpc({ adresse:DATENBANK.adresse, oeffentlicherSchluessel:DATENBANK.oeffentlicherSchluessel });
const $ = (id) => document.getElementById(id);
const person = () => anmeldung?.lesen();
const statusText = { entwurf:"Entwurf", eingereicht:"Eingereicht", in_pruefung:"In Prüfung", aenderung_erbeten:"Änderung erbeten", angenommen:"Angenommen", abgelehnt:"Abgelehnt" };
let aktuelleVorschlaege = [];

function escapeHtml(text){return String(text??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function feld(id,label,placeholder=""){return `<label>${label}<input id="${id}" placeholder="${placeholder}"></label>`;}
function zeichneMedium(){
  const medium=$("medium").value;
  $("medium-zusatz").innerHTML=medium==="video"?feld("medium-url","YouTube-Link")+feld("medium-ausschnitt","Ausschnitt / Situation","z. B. 07:29–08:24"):medium==="bild"?feld("medium-url","Bild-Link")+feld("medium-alt","Bildbeschreibung"):"";
}
function zeichneLoesung(){
  const typ=$("antworttyp").value;
  const ziel=$("loesung-felder");
  if(typ==="multiple_choice"||typ==="mehrfachauswahl") ziel.innerHTML=["A","B","C","D"].map(x=>feld(`option-${x.toLowerCase()}`,`Antwort ${x}`)).join("")+feld("richtig","Richtige Auswahl",typ==="mehrfachauswahl"?"z. B. A,C":"z. B. B");
  else if(typ==="freitext") ziel.innerHTML='<label>Musterantwort<textarea id="musterantwort" rows="4"></textarea></label><label>Zwingende Kernaussagen / Bewertungshinweise<textarea id="bewertung" rows="4"></textarea></label>';
  else if(typ==="zahl") ziel.innerHTML=feld("zahl","Richtige Zahl")+feld("einheit","Einheit","z. B. Meter oder Sekunden")+feld("toleranz","Zulässige Toleranz","optional");
  else ziel.innerHTML='<label>Entscheidung / Spielfortsetzung<textarea id="entscheidung" rows="3"></textarea></label><label>Persönliche Strafe<textarea id="strafe" rows="2"></textarea></label><label>Ort / für wen<textarea id="ort-fuer" rows="2"></textarea></label>';
}
function loesung(){
  const typ=$("antworttyp").value;
  if(typ==="multiple_choice"||typ==="mehrfachauswahl") return {optionen:["a","b","c","d"].map(x=>$(`option-${x}`)?.value.trim()).filter(Boolean),richtig:$("richtig")?.value.trim()};
  if(typ==="freitext") return {musterantwort:$("musterantwort")?.value.trim(),bewertungshinweise:$("bewertung")?.value.trim()};
  if(typ==="zahl") return {wert:$("zahl")?.value.trim(),einheit:$("einheit")?.value.trim(),toleranz:$("toleranz")?.value.trim()};
  return {entscheidung:$("entscheidung")?.value.trim(),strafe:$("strafe")?.value.trim(),ort_und_fuer_wen:$("ort-fuer")?.value.trim()};
}
function loesungGueltig(typ,wert){
  if(typ==="multiple_choice"||typ==="mehrfachauswahl") return wert.optionen.length>=2&&Boolean(wert.richtig);
  if(typ==="freitext") return (wert.musterantwort?.length||0)>=5&&(wert.bewertungshinweise?.length||0)>=10;
  if(typ==="zahl") return Boolean(wert.wert);
  return Boolean([wert.entscheidung,wert.strafe,wert.ort_und_fuer_wen].some(Boolean));
}
function inhalt(){return {kurztitel:$("kurztitel").value.trim(),frage_text:$("fragetext").value.trim(),medium:$("medium").value,antworttyp:$("antworttyp").value,regel_nummer:$("regelnummer").value.trim()||null,medium_url:$("medium-url")?.value.trim()||null,medium_hinweis:$("medium-ausschnitt")?.value.trim()||$("medium-alt")?.value.trim()||null,loesung:loesung()};}
function setzeMeldung(text,fehler=false){$("formular-meldung").textContent=text;$("formular-meldung").style.color=fehler?"#b91c1c":"";}

async function speichern(einreichen){
  const ich=person(); if(!ich)return;
  const body=inhalt();
  if(body.frage_text.length<10||$("begruendung").value.trim().length<40||$("beleg").value.trim().length<20){setzeMeldung("Bitte Fragestellung, ausführliche Begründung und belastbaren Beleg vollständig ausfüllen.",true);return;}
  if(body.medium!=="text"&&!body.medium_url){setzeMeldung("Bitte das Bild oder Video verlinken.",true);return;}
  if(!loesungGueltig(body.antworttyp,body.loesung)){setzeMeldung("Bitte die zum Antworttyp gehörende Lösung vollständig ausfüllen.",true);return;}
  setzeMeldung("Wird gespeichert …");
  const {error}=await rpc.rpc("schiri_fragenvorschlag_speichern",{p_schiedsrichter_id:ich.id,p_pin:ich.pin,p_inhalt:body,p_begruendung:$("begruendung").value.trim(),p_beleg:$("beleg").value.trim(),p_vorschlag_id:$("vorschlag-id").value||null,p_einreichen:einreichen});
  if(error){setzeMeldung("Speichern fehlgeschlagen: "+error.message,true);return;}
  setzeMeldung(einreichen?"Zur Prüfung eingereicht.":"Entwurf gespeichert."); await ladeListe();
}

async function ladeListe(){
  const ich=person(); const {data,error}=await rpc.rpc("schiri_fragenvorschlaege_liste",{p_schiedsrichter_id:ich.id,p_pin:ich.pin});
  if(error){$("vorschlag-liste").innerHTML="<p>Vorschläge konnten nicht geladen werden.</p>";return;}
  aktuelleVorschlaege=Array.isArray(data)?data:[];
  $("vorschlag-liste").innerHTML=aktuelleVorschlaege.length?aktuelleVorschlaege.map(v=>`<button class="vorschlag-eintrag" data-id="${v.id}"><strong>${escapeHtml(v.frage_text)}</strong><span class="status">${statusText[v.status]||v.status}</span>${v.rueckmeldung_obmann?`<span>${escapeHtml(v.rueckmeldung_obmann)}</span>`:""}</button>`).join(""):"<p>Noch keine Vorschläge.</p>";
  document.querySelectorAll(".vorschlag-eintrag").forEach(b=>b.addEventListener("click",()=>oeffne(b.dataset.id)));
}
function fuelle(detail){const x=detail.inhalt||{};$("vorschlag-id").value=detail.id;$("kurztitel").value=x.kurztitel||"";$("fragetext").value=x.frage_text||"";$("medium").value=x.medium||"text";$("antworttyp").value=x.antworttyp||"multiple_choice";$("regelnummer").value=x.regel_nummer||"";zeichneMedium();zeichneLoesung();if($("medium-url"))$("medium-url").value=x.medium_url||"";if($("medium-ausschnitt"))$("medium-ausschnitt").value=x.medium_hinweis||"";if($("medium-alt"))$("medium-alt").value=x.medium_hinweis||"";const l=x.loesung||{};["a","b","c","d"].forEach((n,i)=>{if($(`option-${n}`))$(`option-${n}`).value=l.optionen?.[i]||""});if($("richtig"))$("richtig").value=l.richtig||"";if($("musterantwort"))$("musterantwort").value=l.musterantwort||"";if($("bewertung"))$("bewertung").value=l.bewertungshinweise||"";if($("zahl"))$("zahl").value=l.wert||"";if($("einheit"))$("einheit").value=l.einheit||"";if($("toleranz"))$("toleranz").value=l.toleranz||"";if($("entscheidung"))$("entscheidung").value=l.entscheidung||"";if($("strafe"))$("strafe").value=l.strafe||"";if($("ort-fuer"))$("ort-fuer").value=l.ort_und_fuer_wen||"";$("begruendung").value=detail.begruendung||"";$("beleg").value=detail.beleg||"";const editierbar=["entwurf","aenderung_erbeten"].includes(detail.status);document.querySelectorAll("#vorschlag-formular input,#vorschlag-formular select,#vorschlag-formular textarea,#vorschlag-formular button").forEach(el=>el.disabled=!editierbar);setzeMeldung(editierbar?(detail.rueckmeldung_obmann||""):`Status: ${statusText[detail.status]||detail.status}. Dieser Stand ist schreibgeschützt.`);}
async function oeffne(id){const ich=person();const [{data:d},{data:v}]=await Promise.all([rpc.rpc("schiri_fragenvorschlag_details",{p_schiedsrichter_id:ich.id,p_pin:ich.pin,p_vorschlag_id:id}),rpc.rpc("schiri_fragenvorschlag_versionen",{p_schiedsrichter_id:ich.id,p_pin:ich.pin,p_vorschlag_id:id})]);const detail=Array.isArray(d)?d[0]:d;if(!detail)return;fuelle(detail);zeichneVersionen(Array.isArray(v)?v:[]);window.scrollTo({top:0,behavior:"smooth"});}
function zeichneVersionen(versionen){const bereich=$("versionen-bereich");bereich.hidden=!versionen.length;$("versionen-liste").innerHTML=versionen.map((v,i)=>{const vor=versionen[i+1];const a=v.inhalt||{},b=vor?.inhalt||{};const geaendert=[];if(vor&&a.frage_text!==b.frage_text)geaendert.push("Fragestellung");if(vor&&JSON.stringify(a.loesung)!==JSON.stringify(b.loesung))geaendert.push("Lösung");if(vor&&v.begruendung!==vor.begruendung)geaendert.push("Begründung");if(vor&&v.beleg!==vor.beleg)geaendert.push("Beleg");return `<div class="version"><strong>Version ${v.version} · ${v.bearbeiter==="obmann"?"vom Obmann":"von dir"}</strong>${geaendert.length?`<div class="geaendert">Geändert: ${geaendert.join(", ")}</div>`:""}<details><summary>Stand ansehen</summary><p><b>Frage:</b> ${escapeHtml(a.frage_text)}</p><p><b>Begründung:</b> ${escapeHtml(v.begruendung)}</p><p><b>Beleg:</b> ${escapeHtml(v.beleg)}</p></details></div>`}).join("");}
function neu(){$("vorschlag-formular").reset();$("vorschlag-id").value="";document.querySelectorAll("#vorschlag-formular input,#vorschlag-formular select,#vorschlag-formular textarea,#vorschlag-formular button").forEach(el=>el.disabled=false);zeichneMedium();zeichneLoesung();setzeMeldung("");$("versionen-bereich").hidden=true;}

$("medium").addEventListener("change",zeichneMedium);$("antworttyp").addEventListener("change",zeichneLoesung);$("vorschlag-formular").addEventListener("submit",e=>{e.preventDefault();speichern(true)});$("entwurf-speichern").addEventListener("click",()=>speichern(false));$("neuer-vorschlag").addEventListener("click",neu);
if(person()){
  $("vorschlag-inhalt").hidden=false;
  neu();
  ladeListe().then(()=>{
    const id=new URLSearchParams(location.search).get("vorschlag");
    if(id&&/^[0-9a-f-]{36}$/i.test(id))void oeffne(id);
  });
}else{$("vorschlag-zugang").hidden=false;}
