import {DATENBANK} from "../../verein.config.js";
import {aktuelleSaison, punkteStand, PUNKTE_ARTEN} from "../features/fortbildungspunkte.js";

const wurzel = document.getElementById("fortbildungspunkte");
let generation = 0;
const element = (typ, text, klasse) => {
  const e = document.createElement(typ); if (text !== undefined) e.textContent = text;
  if (klasse) e.className = klasse; return e;
};
const datum = wert => wert ? new Intl.DateTimeFormat("de-DE", {day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${wert}T12:00:00Z`)) : "";
function detail(t) {
  const bereich = document.getElementById("punkte-detail"); bereich.replaceChildren();
  bereich.append(element("h3", t.titel), element("p", `${PUNKTE_ARTEN[t.punkte_art] || "Fortbildung"} · ${datum(t.datum)}`));
  if (t.zeitraum_von) bereich.append(element("p", `Bearbeitungszeitraum: ${datum(t.zeitraum_von)} bis ${datum(t.datum)} · Abgabetermin`));
  bereich.append(element("p", t.gewertet ? "Vom Obmann als gewertet bestätigt." : t.erfasst ? "Nicht angerechnet – vom Obmann erfasst." : "Anrechnung noch nicht erfasst. Eine Terminzusage zählt nicht automatisch."));
  if (t.bestaetigt_am) bereich.append(element("p", `Stand: ${new Intl.DateTimeFormat("de-DE", {dateStyle:"medium",timeStyle:"short"}).format(new Date(t.bestaetigt_am))}`));
  if (t.notiz) bereich.append(element("p", t.notiz));
  if (t.termin_sichtbar !== false) {
    const a = element("a", "Termin ansehen"); a.href = `termine.html?termin=${encodeURIComponent(t.id)}`; bereich.append(a);
  }
  if (t.verlauf?.length) {
    const auf = element("details"); auf.append(element("summary", "Bestätigung und Korrekturen"));
    for (const k of t.verlauf) auf.append(element("p", `${new Date(k.erstellt_am).toLocaleString("de-DE")} · ${k.nachher ? "Angerechnet" : "Anrechnung zurückgenommen"}${k.notiz ? ` · ${k.notiz}` : ""}`));
    bereich.append(auf);
  }
}
export async function ladeFortbildung(person) {
  if (!wurzel) return;
  const nummer = ++generation;
  wurzel.replaceChildren(); wurzel.hidden = !person;
  if (!person) return;
  const kopf = element("div", undefined, "punkte-kopf"); kopf.append(element("h2", "Meine Fortbildungspunkte"));
  const label = element("label", "Saison "); const auswahl = element("select"); auswahl.setAttribute("aria-label", "Saison der Fortbildungspunkte");
  const jahr = Number(aktuelleSaison().slice(0,4));
  for (let y=jahr+1; y>=2024; y--) { const saison = `${y}/${String(y+1).slice(-2)}`; const o=element("option",saison); o.value=saison; auswahl.append(o); }
  auswahl.value = aktuelleSaison(); label.append(auswahl); kopf.append(label); wurzel.append(kopf);
  const inhalt = element("div"); wurzel.append(inhalt);
  let abruf = 0;
  async function laden() {
    const lauf = ++abruf; inhalt.replaceChildren(element("p", "Punkte werden geladen …"));
    try {
      const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/meine_fortbildungspunkte`, {
        method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",apikey:DATENBANK.oeffentlicherSchluessel,Authorization:`Bearer ${DATENBANK.oeffentlicherSchluessel}`},
        body:JSON.stringify({p_schiedsrichter_id:person.id,p_pin:person.pin,p_saison:auswahl.value})
      });
      if (!antwort.ok) throw new Error("Punkte konnten nicht geladen werden. Bitte erneut versuchen.");
      const daten = await antwort.json();
      if (!daten || !Array.isArray(daten.termine)) throw new Error("Ungültiger Punktestand.");
      if (generation!==nummer || lauf!==abruf) return;
      const stand = punkteStand(daten); inhalt.replaceChildren();
      inhalt.append(element("p", `${stand.anzahl} Punkte bestätigt · ${stand.gelegenheiten} reguläre Möglichkeiten${stand.bonus ? ` · davon ${stand.bonus} U18-Zusatzpunkt` : ""}`, "punkte-zahl"));
      inhalt.append(element("p", `Orientierungsziel: ${stand.ziel} Fortbildungspunkte. Weitere Sollbedingungen bleiben davon unabhängig.`, "punkte-hinweis"));
      const raster = element("div", undefined, "punkte-raster");
      const regulaer = stand.bestaetigt.filter(t => t.punkte_art !== "u18");
      for (let i=0;i<Math.max(stand.gelegenheiten,regulaer.length);i++) {
        const t=regulaer[i]; const b=element("button", t ? (t.punkte_art === "hrt" ? "HRT" : t.punkte_art === "jhv" ? "JHV" : "RLA") : String(i+1), `punkte-kreis ${t ? t.punkte_art : "leer"}`);
        b.type="button"; b.disabled=!t;
        b.setAttribute("aria-label", t ? `${t.titel}, ${PUNKTE_ARTEN[t.punkte_art]}, ${datum(t.datum)}, angerechnet. Details öffnen` : `Punkt ${i+1}: noch nicht bestätigt`);
        if(t) b.addEventListener("click",()=>detail(t)); raster.append(b);
      }
      for(const t of stand.bestaetigt.filter(t=>t.punkte_art==="u18")) {const b=element("button","U18+","punkte-kreis u18"); b.type="button"; b.setAttribute("aria-label",`${t.titel}, Zusatzpunkt. Details öffnen`); b.addEventListener("click",()=>detail(t)); raster.append(b);}
      inhalt.append(raster,element("p","RLA = Lehrabend · HRT = Hausregeltest · JHV = Jahreshauptversammlung · U18 = zusätzliche Schulung","punkte-hinweis"));
      if(!daten.termine.length) inhalt.append(element("p","Für diese Saison sind noch keine Fortbildungstermine erfasst. Dein Obmann trägt die bestätigten DFBnet-Nachweise ein."));
      const liste=element("div",undefined,"punkte-termine");
      for(const t of daten.termine) {const b=element("button",`${t.gewertet ? "✓" : "○"} ${t.titel} · ${datum(t.datum)} · ${t.gewertet ? "angerechnet" : t.erfasst ? "nicht angerechnet" : "noch nicht erfasst"}`);b.type="button";b.addEventListener("click",()=>detail(t));liste.append(b);}
      const details=element("div",undefined,"punkte-detail");details.id="punkte-detail";details.setAttribute("aria-live","polite");
      inhalt.append(liste,details);
    } catch(fehler) {if(generation===nummer && lauf===abruf) {inhalt.replaceChildren(element("p",fehler.message));const b=element("button","Erneut laden");b.type="button";b.addEventListener("click",laden);inhalt.append(b);}}
  }
  auswahl.addEventListener("change",laden); await laden();
}
