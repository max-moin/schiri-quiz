import { DATENBANK } from "../../verein.config.js";
import { abschnitte, formatZeit, maxSperren, normalisiereAntwort, normalisiereSperrzeiten, raster, tage, tiers, version, zeitVerschieben, zeiten } from "../shared/stimmungsbild.js";

const root = document.querySelector("#umfrage");
const vorschau = new URLSearchParams(location.search).get("vorschau") === "1";
const anmeldung = vorschau ? null : globalThis.SchiriAnmeldung.erstelleAnmeldung(DATENBANK);
const login = anmeldung && globalThis.SchiriLoginDialog.erstelleLoginDialog({ anmeldung, maskierung:globalThis.SchiriQuizMaskedInputs });
let person, generation = 0, stand = vorschau ? "offen" : "login", busy = false, seite = 0, messung, zug = null;
const bearbeiteteTage = new Set();
const leer = () => ({ konflikte:undefined, sperrzeiten:{}, tier:{}, start:[zeiten.min,zeiten.max], frequenz:5 });
let antwort = leer();
const aktiveSperren = () => Object.fromEntries(Object.entries(antwort.sperrzeiten).filter(([tag])=>!antwort.konflikte?.includes(tag)));
const button = (text, aktion, klasse = "") => `<button type="button" class="${klasse}" data-aktion="${aktion}">${text}</button>`;
const platz = ["frei", ...tiers];
const tierInfo = ["Passt am besten", "Passt gut", "Passt", "Eher ungünstig", "Am wenigsten passend"];
const frequenz = n => n <= 2 ? "Etwa einmal im Quartal" : n <= 4 ? "Etwa alle 6–8 Wochen" : n === 5 ? "Etwa einmal im Monat" : n <= 7 ? "Etwa alle 3 Wochen" : "Etwa alle zwei Wochen";
const endpunkt = (wert, bis) => formatZeit(wert + (bis ? zeiten.dauer : 0));
function box(titel, html) { return `<fieldset><legend>${titel}</legend>${html}</fieldset>`; }
const abendEnde = zeiten.max + zeiten.dauer;
const kalenderProzent = minuten => minuten * 100 / (abendEnde - zeiten.min);
const ticks = bis => raster(zeiten.min,bis).filter(m => m % 60 === 0).map(m=>`<span>${formatZeit(m)}</span>`).join("");
const sperrzeitText = ([von,bis]) => `${formatZeit(von)}–${formatZeit(bis)}`;
function wochenkalender(ganztags) {
  const uhrzeiten = raster(zeiten.min,abendEnde);
  return box("Deine Woche · 17:00 bis 22:00 Uhr", `<p class="um-kalender-info">Beispiel: Dienstag nur bis 20 Uhr verfügbar? Sperre 20:00–22:00. Wege und Umziehen kannst du direkt mit einrechnen.</p>
    <div class="um-ticks" aria-hidden="true">${ticks(abendEnde)}</div>
    <div class="um-kalender">${tage.map((tag,i)=>{
      const block = !!ganztags?.includes(tag), sperren=antwort.sperrzeiten[tag] || [];
      const offen = !block && bearbeiteteTage.has(tag), gueltig=sperren.filter(([a,b])=>a!==null && b!==null && a<b);
      const balken = (block ? [[zeiten.min,abendEnde]] : gueltig).map(([a,b]) =>
        `<i style="left:${kalenderProzent(a-zeiten.min)}%;width:${kalenderProzent(b-a)}%"></i>`).join("");
      const optionen = wert => '<option value="">Wählen</option>'+uhrzeiten.map(m=>`<option value="${m}"${m===wert?" selected":""}>${formatZeit(m)}</option>`).join("");
      return `<div class="um-tag">
        <div class="um-tag-kopf"><strong>${tag}</strong><div class="um-tag-aktionen">
          <button type="button" aria-label="${tag} ganztägig sperren" aria-pressed="${block}" data-konflikt="${tag}">Ganztägig</button>
          <button type="button" aria-label="Sperrzeiten für ${tag}" aria-controls="um-sperren-${i}" aria-expanded="${offen}" data-tagkalender="${tag}"${block?" disabled":""}>Zeiten</button>
        </div></div>
        <div class="um-sperrbahn" aria-hidden="true">${balken}</div>
        <small>${block?"Ganztägig gesperrt":gueltig.length?gueltig.map(sperrzeitText).join(" · ")+" Uhr gesperrt":"Keine Uhrzeit gesperrt"}</small>
        <div id="um-sperren-${i}"${offen?"":" hidden"}>${offen ? sperren.map(([a,b],j)=>`<div class="um-sperrzeile" role="group" aria-label="Sperrzeit ${j+1} am ${tag}">
          <label>Gesperrt ab <select data-sperrtag="${tag}" data-nr="${j}" data-grenze="0">${optionen(a)}</select></label>
          <label>Gesperrt bis <select data-sperrtag="${tag}" data-nr="${j}" data-grenze="1">${optionen(b)}</select></label>
          <button type="button" aria-label="Sperrzeit ${j+1} am ${tag} entfernen" data-entfernen="${tag}" data-nr="${j}">Entfernen</button></div>`).join("")+
          (sperren.length < maxSperren ? `<button type="button" data-hinzufuegen="${tag}">Sperrzeit hinzufügen</button>` : "") : ""}</div>
      </div>`;
    }).join("")}</div>
    <button type="button" class="um-neutral" aria-pressed="${ganztags?.length===0}" data-konflikt="kein">Kein Tag fällt komplett aus</button>`);
}
function haupt() {
  const badge = vorschau ? "Vorschau · nichts wird gespeichert" : "Vereinsinterne Umfrage";
  const oben = `<div class="um-hero"><span class="um-kicker">${badge}</span><h1>Schiri-Stimmungsbild</h1><p>Deine Woche, unsere Treffen und was wir im Verein besser machen können.</p></div>`;
  if (stand !== "offen") {
    const erklaerung = {
      login:"Melde dich mit deinem Vereinszugang an, um den Fragebogen zu öffnen.",
      laden:"Vereinszugang und Umfragestand werden geprüft.",
      zu:"Für deinen Vereinszugang ist gerade keine Umfrage geöffnet.",
      fertig:vorschau ? "Du hast den Fragebogen ausprobiert. Deine Eingaben wurden nicht gespeichert." : "Deine Rückmeldung ist eingegangen. Pro Vereinszugang ist eine Abgabe möglich.",
      fehler:"Die Umfrage war gerade nicht erreichbar. Bitte versuch es erneut.",
    };
    root.innerHTML = oben + `<section class="um-karte"><h2 tabindex="-1">${stand === "fertig" ? (vorschau ? "Vorschau abgeschlossen" : "Danke fürs Mitmachen!") : "Teilnahme"}</h2><p role="status">${erklaerung[stand]}</p>
      ${stand === "login" ? button("Mit Vereinskennung anmelden","login","um-primaer") : stand === "fehler" ? button("Erneut prüfen","laden","um-primaer") : ""}
      ${vorschau ? button("Noch einmal ausprobieren","reset","um-primaer") : '<p><a href="?vorschau=1">Fragebogen ohne Speicherung ausprobieren</a></p>'}</section>`;
    return;
  }
  const abschnitt = abschnitte[seite];
  root.innerHTML = oben + `<p class="um-hinweis">${vorschau ? "In dieser Vorschau verlässt keine Antwort deinen Browser." : "Max sieht deinen Namen und deine Antworten. Der Vorstand erhält nur zusammengefasste Zahlen, keine Namen oder Freitexte. Du kannst einmal teilnehmen."}</p>
    <nav class="um-schritte" aria-label="Fragebogen-Fortschritt"><span>Abschnitt ${seite+1} von ${abschnitte.length}</span><progress max="${abschnitte.length}" value="${seite+1}" aria-label="Fortschritt"></progress></nav>
    <section class="um-karte"><span class="um-icon" aria-hidden="true">${abschnitt.icon}</span>
    <h2 tabindex="-1">${abschnitt.titel}</h2><p class="um-erkl">${abschnitt.info}</p>
    <div class="um-felder">${abschnitt.felder.map(feld).join("")}</div>
    <p class="um-status" role="status" data-status></p>
    <div class="um-aktionen">${seite > 0 ? button("Zurück","zurueck") : ""}${seite === abschnitte.length-1 ? button(vorschau ? "Vorschau abschließen" : "Verbindlich abgeben","abgeben","um-primaer") : button("Weiter","weiter","um-primaer")}</div></section>`;
  for (const t of root.querySelectorAll("textarea")) t.value = antwort[t.dataset.text] || "";
  if (seite === 2) zeitAnzeigen();
}

function feld(f) {
  const wert = antwort[f.key];
  if (f.typ === "text") return f.wenn && !antwort[f.wenn] ? "" : `<label class="um-label">${f.titel}<textarea rows="2" maxlength="350" data-text="${f.key}"></textarea></label>`;
  if (f.typ === "konflikte") return wochenkalender(wert);
  if (f.typ === "tier") return `<div class="um-tier" aria-label="Wochen-Tierliste">
    ${platz.map((s,i) => `<div class="um-lane" data-lane="${s}"><div class="um-lane-label"><strong>${i ? s : "Offen"}</strong><small>${i ? tierInfo[i-1] : "Noch nicht sortiert"}</small></div>
    <div class="um-chips">${tage.filter(t => !antwort.konflikte?.includes(t) && (antwort.tier[t] ?? "frei") === s)
      .map(t => `<button type="button" class="um-chip" data-tag="${t}" aria-label="${t}, ${i ? "Stufe "+s : "nicht eingeordnet"}; Verschieben öffnen" aria-haspopup="dialog">${t}</button>`).join("") || '<span class="um-leer">Hier ablegen</span>'}</div></div>`).join("")}
    </div>${antwort.konflikte?.length ? `<p class="um-konflikte"><strong>Feste Konflikte:</strong> ${antwort.konflikte.join(", ")}</p>` : ""}
    <dialog class="um-dialog" aria-labelledby="um-verschieben"><h3 id="um-verschieben">Tag verschieben</h3><div class="um-ziele">${platz.map((s,i) => `<button type="button" data-ziel="${s}">${i ? s+" · "+tierInfo[i-1] : "Nicht eingeordnet"}</button>`).join("")}</div>${button("Schließen","dialog-zu")}</dialog>`;
  if (f.typ === "zeit") return box("Zeitfenster für den Start",
    `<div class="um-zeitwerte"><div><small>Frühester Start</small><strong data-zeit="0"></strong></div><div><small>Spätester Start</small><strong data-zeit="1"></strong></div></div>
    <div class="um-timeline"><div class="um-rail" data-rail><span class="um-zeitband" data-band></span>
    ${[0,1].map(i=>`<button class="um-griff um-griff-${i}" type="button" role="slider" data-griff="${i}" aria-label="${i ? "Spätester Start" : "Frühester Start"}" aria-valuemin="${zeiten.min}" aria-valuemax="${zeiten.max}"></button>`).join("")}</div>
    <div class="um-ticks">${ticks(zeiten.max)}</div></div>
    <div class="um-ende"><span class="um-ende-kopf">Bis zu 2 Stunden Treff</span><p data-ende></p><div class="um-ende-rail" aria-hidden="true"><span data-startband></span><span data-puffer></span></div>
    <div class="um-ticks">${ticks(abendEnde)}</div></div>`);
  if (f.typ === "frequenz") return box("Wie oft soll der Schiri-Treff sein?",
    `<label class="um-label"><output data-frequenz-text>${frequenz(wert)}</output><input type="range" aria-label="Gewünschte Häufigkeit" aria-valuetext="${frequenz(wert)}" min="0" max="10" step="1" value="${wert}" data-frequenz></label><div class="um-ticks"><span>0 · Quartal</span><span>5 · passt so</span><span>10 · alle 2 Wochen</span></div>`);
  if (f.typ === "likert") return box(f.titel,
    `<div class="um-likert"><div class="um-skala">${f.labels.map((label,i)=>`<label title="${label}"><input type="radio" name="${f.key}" value="${i+1}" ${wert===i+1?"checked":""}><span class="um-punkt">${i+1}</span><span class="um-skalenlabel">${label}</span></label>`).join("")}</div>
    <label class="um-na"><input type="radio" name="${f.key}" value="na" ${wert==="na"?"checked":""}> ${f.nicht}</label></div>`);
  return box(f.titel,`<div class="um-optionen">${f.optionen.map((o,i)=>`<button type="button" data-frage="${f.key}" data-option="${i}" aria-pressed="${f.typ==="mehrfach" ? !!wert?.includes(o) : wert===o}">${o}</button>`).join("")}</div>`);
}
function status(s) { const n = root.querySelector("[data-status]"); if (n) n.textContent = s; }
function fokus(selector = "h2") { root.querySelector(selector)?.focus({preventScroll: selector !== "h2"}); }
function refresh(selector, meldung = "") { haupt(); fokus(selector); status(meldung); }
function zeitAnzeigen() {
  const [a,b] = antwort.start;
  root.querySelector("[data-rail]").toggleAttribute("data-gleich",a===b);
  const pct = (n, ende) => (n-zeiten.min) / (ende-zeiten.min) * 100 + "%";
  function band(sel, links, rechts, ende) {
    Object.assign(root.querySelector(sel).style,{left:pct(links,ende), width:(rechts-links)/(ende-zeiten.min)*100+"%"});
  }
  for (const [i,m] of antwort.start.entries()) {
    root.querySelector(`[data-zeit="${i}"]`).textContent = endpunkt(m,false)+" Uhr";
    const griff = root.querySelector(`[data-griff="${i}"]`);
    griff.style.left = pct(m,zeiten.max);
    griff.setAttribute("aria-valuenow",m);
    griff.setAttribute("aria-valuetext",endpunkt(m,false)+" Uhr");
    griff.setAttribute("aria-valuemin",i ? a : zeiten.min);
    griff.setAttribute("aria-valuemax",i ? zeiten.max : b);
  }
  const buffer = zeiten.max+zeiten.dauer;
  band("[data-band]",a,b,zeiten.max);
  band("[data-startband]",a,b,buffer);
  band("[data-puffer]",b,b+zeiten.dauer,buffer);
  root.querySelector("[data-ende]").textContent = `Bei Start um ${formatZeit(b)} Uhr endet der Treff spätestens um ${endpunkt(b,true)} Uhr.`;
}
function einordnen(tag,s) {
  if (!tage.includes(tag) || !platz.includes(s) || antwort.konflikte.includes(tag)) return;
  if (s === "frei") delete antwort.tier[tag]; else antwort.tier[tag] = s;
  refresh(`[data-tag="${tag}"]`,s==="frei" ? tag+" ist noch nicht eingeordnet." : `${tag}: Stufe ${s}.`);
}
const railZeit = (rail,x) => {
  const r = rail.getBoundingClientRect();
  return zeiten.min + Math.min(1,Math.max(0,(x-r.left)/r.width))*(zeiten.max-zeiten.min);
};
const setZeit = (i,v) => { antwort.start = zeitVerschieben(antwort.start,i,v); zeitAnzeigen(); };
root.addEventListener("pointerdown", e => {
  if (!e.isPrimary || e.button !== 0) return;
  const chip = e.target.closest("[data-tag]");
  if (chip) { chip.setPointerCapture(e.pointerId); zug = {chip,id:e.pointerId, x:e.clientX, y:e.clientY}; return; }
  const rail = e.target.closest("[data-rail]");
  if (!rail) return;
  const v = railZeit(rail,e.clientX), griff = e.target.closest("[data-griff]");
  const [a,b] = antwort.start;
  const i = griff ? Number(griff.dataset.griff) : a === b ? Number(v >= a) : Number(Math.abs(v-b) <= Math.abs(v-a));
  rail.setPointerCapture(e.pointerId);
  rail.querySelector(`[data-griff="${i}"]`).focus({preventScroll:true});
  messung={rail,i,id:e.pointerId, start:antwort.start, x:e.clientX, getrennt:a!==b || !griff};
  if (!griff) setZeit(i,v);
});
function absolut(el,x,y) { el.style.left = x+"px"; el.style.top = y+"px"; }
function zielAktualisieren(x,y) {
  const lane = document.elementFromPoint(x,y)?.closest("[data-lane]");
  if (lane!==zug.lane) { zug.lane?.classList.remove("um-ziel"); lane?.classList.add("um-ziel"); zug.lane=lane; }
}
function ziehScrollen() {
  if (!zug?.ghost) return;
  const {clientX:x,clientY:y} = zug;
  const rand=48, unten=window.innerHeight-rand;
  const schritt=y<rand ? -Math.min(14,(rand-y)/3) : y>unten ? Math.min(14,(y-unten)/3) : 0;
  if (schritt) { window.scrollBy(0,schritt); zielAktualisieren(x,y); }
  requestAnimationFrame(ziehScrollen);
}
root.addEventListener("pointermove", e => {
  if (messung?.id === e.pointerId) {
    if (!messung.getrennt && Math.abs(e.clientX-messung.x) >= 5) {
      messung.i = Number(e.clientX > messung.x); messung.getrennt = true;
      messung.rail.querySelector(`[data-griff="${messung.i}"]`).focus({preventScroll:true});
    }
    if (messung.getrennt) setZeit(messung.i,railZeit(messung.rail,e.clientX));
  }
  if (zug?.id !== e.pointerId) return;
  if (!zug.ghost && Math.hypot(e.clientX-zug.x,e.clientY-zug.y)<7) return;
  zug.clientX=e.clientX; zug.clientY=e.clientY;
  if (!zug.ghost) {
    zug.ghost=document.createElement("span"); zug.ghost.className="um-chip um-geist";
    zug.ghost.textContent=zug.chip.textContent; zug.ghost.setAttribute("aria-hidden","true"); root.append(zug.ghost);
    requestAnimationFrame(ziehScrollen);
  }
  absolut(zug.ghost,e.clientX,e.clientY);
  zielAktualisieren(e.clientX,e.clientY);
});
let unterdrueckeKlick = false;
function pointerEnde(e) {
  if (messung?.id === e.pointerId) {
    if (e.type !== "pointerup") { antwort.start=messung.start; zeitAnzeigen(); }
    else if (messung.getrennt) setZeit(messung.i,railZeit(messung.rail,e.clientX));
    messung=null;
  }
  if (zug?.id !== e.pointerId) return;
  const {chip,ghost,lane} = zug; zug = null;
  if (!ghost) return;
  ghost.remove(); lane?.classList.remove("um-ziel");
  unterdrueckeKlick = true; setTimeout(() => unterdrueckeKlick=false,0);
  const ziel = e.type==="pointerup" ? document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-lane]") : null;
  if (ziel) einordnen(chip.dataset.tag,ziel.dataset.lane);
}
for (const name of ["pointerup","pointercancel","lostpointercapture"]) root.addEventListener(name,pointerEnde);
root.addEventListener("keydown", e => {
  if (!e.target.matches("[data-griff]")) return;
  const i=Number(e.target.dataset.griff);
  const v = ({ArrowLeft:antwort.start[i]-15,ArrowDown:antwort.start[i]-15,ArrowRight:antwort.start[i]+15,ArrowUp:antwort.start[i]+15,Home:zeiten.min,End:zeiten.max})[e.key];
  if (v !== undefined) { e.preventDefault(); setZeit(i,v); }
});
root.addEventListener("input", e => {
  if (e.target.matches("[data-text]")) antwort[e.target.dataset.text] = e.target.value;
  if (e.target.matches("[data-frequenz]")) {
    antwort.frequenz=Number(e.target.value);
    root.querySelector("[data-frequenz-text]").textContent=frequenz(antwort.frequenz);
    e.target.setAttribute("aria-valuetext",frequenz(antwort.frequenz));
  }
  if (e.target.matches(".um-likert input")) antwort[e.target.name] = e.target.value === "na" ? "na" : Number(e.target.value);
});
root.addEventListener("change", e => {
  const {sperrtag,nr,grenze} = e.target.dataset;
  if (!sperrtag) return;
  const paar=antwort.sperrzeiten[sperrtag][nr];
  paar[grenze]=e.target.value === "" ? null : Number(e.target.value);
  refresh(`[data-sperrtag="${sperrtag}"][data-nr="${nr}"][data-grenze="${grenze}"]`,
    paar.every(x=>x!==null) && paar[0]>=paar[1] ? "Das Ende muss nach dem Beginn liegen." : "");
});
async function api(aktion, weitere) {
  const r = await fetch("/api/umfragen", {method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
    body:JSON.stringify({aktion, person:person?.id, pin:person?.pin, version, ...weitere})});
  const data=await r.json();
  if(!r.ok) throw new Error(data.fehler==="warte" ? "Zu viele Versuche. Bitte warte 15 Minuten." : "Die Vereinsumfrage ist gerade nicht erreichbar.");
  return data;
}
async function laden() {
  if (!person) return;
  const g=generation; stand="laden"; haupt();
  try { const d=await api("status"); if(g!==generation)return; stand=d.stand; }
  catch { if(g!==generation)return; stand="fehler"; }
  haupt(); fokus();
}
let tagDialog;
root.addEventListener("click", async e => {
  const b=e.target.closest("button");
  if (!b || busy || unterdrueckeKlick) return;
  if (b.dataset.tagkalender) {
    const tag=b.dataset.tagkalender;
    if (bearbeiteteTage.has(tag)) bearbeiteteTage.delete(tag); else bearbeiteteTage.add(tag);
    refresh(`[data-tagkalender="${tag}"]`); return;
  }
  if (b.dataset.hinzufuegen) {
    const tag=b.dataset.hinzufuegen, fenster=antwort.sperrzeiten[tag] ??= [];
    if(fenster.length>=maxSperren)return;
    fenster.push([null,null]);
    refresh(`[data-sperrtag="${tag}"][data-nr="${fenster.length-1}"][data-grenze="0"]`); return;
  }
  if (b.dataset.entfernen) {
    const tag=b.dataset.entfernen;
    antwort.sperrzeiten[tag].splice(Number(b.dataset.nr),1);
    if(!antwort.sperrzeiten[tag].length) delete antwort.sperrzeiten[tag];
    refresh(`[data-hinzufuegen="${tag}"]`); return;
  }
  if (b.dataset.konflikt) {
    const k=b.dataset.konflikt;
    if (k==="kein") antwort.konflikte=[];
    else {
      const t=new Set(antwort.konflikte || []);
      if(t.has(k)) t.delete(k); else { t.add(k); delete antwort.tier[k]; }
      antwort.konflikte=[...t];
    }
    refresh(`[data-konflikt="${k}"]`); return;
  }
  if(b.dataset.tag) {
    tagDialog=b.dataset.tag;
    const dialog=root.querySelector("dialog");
    dialog.querySelector("h3").textContent=tagDialog+" verschieben"; dialog.showModal(); return;
  }
  if(b.dataset.ziel) { root.querySelector("dialog").close(); einordnen(tagDialog,b.dataset.ziel); return; }
  if(b.dataset.frage) {
    const f=abschnitte[seite].felder.find(x=>x.key===b.dataset.frage);
    const opt=f.optionen[Number(b.dataset.option)], alt=antwort[f.key];
    if(f.typ==="mehrfach") {
      if(alt?.includes(opt)) antwort[f.key]=alt.filter(v=>v!==opt);
      else if(f.key==="hilfe" && opt==="Mir fehlt gerade nichts") antwort[f.key]=[opt];
      else {
        const bisher=(alt||[]).filter(v=>v!=="Mir fehlt gerade nichts");
        if(bisher.length>=f.max) return status(`Bitte wähle höchstens ${f.max} Antworten.`);
        antwort[f.key]=[...bisher,opt];
      }
    } else if(alt===opt) delete antwort[f.key]; else antwort[f.key]=opt;
    refresh(`[data-frage="${f.key}"][data-option="${b.dataset.option}"]`); return;
  }
  const a=b.dataset.aktion;
  if (a==="dialog-zu") root.querySelector("dialog").close();
  if (a==="login") await login.oeffne({grund:"Melde dich für das vereinsinterne Stimmungsbild an.",gastErlaubt:false});
  if (a==="laden") await laden();
  if (a==="reset") { bearbeiteteTage.clear(); antwort=leer(); seite=0; stand="offen"; refresh(); }
  if (a==="zurueck") { seite--; refresh(); }
  if (a==="weiter") {
    if(seite===0) {
      if(!normalisiereSperrzeiten(aktiveSperren(),antwort.konflikte || [])) return status("Bitte vervollständige die Sperrzeiten oder entferne leere Zeilen.");
      if(!antwort.konflikte && !Object.keys(aktiveSperren()).length) return status("Trage einen Konflikt ein oder bestätige, dass kein Tag komplett ausfällt.");
      antwort.konflikte ??= [];
    }
    if(seite===1 && tage.some(t=>!antwort.konflikte.includes(t) && !antwort.tier[t])) return status("Ordne alle Tage ohne festen Konflikt einer Stufe zu.");
    seite++; refresh();
  }
  if (a==="abgeben") {
    const abgabe = {...antwort,sperrzeiten:aktiveSperren()};
    if(!normalisiereAntwort(abgabe)) return status("Bitte überprüfe deine Terminangaben.");
    if (vorschau) { stand="fertig"; antwort=leer(); refresh(); return; }
    const g=generation; busy=true; b.disabled=true;
    try {
      const d=await api("abgeben",{antwort:abgabe}); if(g!==generation)return;
      if(d.stand==="fertig" || d.stand==="zu"){ stand=d.stand; antwort=leer(); refresh(); }
      else status("Die Rückmeldung wurde nicht gespeichert.");
    } catch(e) { if(g===generation) status(e.message); }
    finally { if(g===generation) {busy=false; b.disabled=false;} }
  }
});
if(vorschau) haupt();
else anmeldung.abonniere(p => { person=p; generation++; seite=0; bearbeiteteTage.clear(); antwort=leer(); busy=false; stand=p?"laden":"login"; haupt(); if(p) laden(); });
