import { filter, suche } from "./hilfe-suche.js";
import { websiteFunktionsfreigaben } from "../../seite.js";

const box = document.getElementById("hilfe-suche");
const form = document.getElementById("hilfe-suchform");
const liste = document.getElementById("hilfe-suchergebnisse");
const status = document.getElementById("hilfe-suchstatus");
let freigaben = {};
for (const [name, werte] of Object.entries(filter)) {
  for (const [id, titel] of Object.entries(werte)) form.elements[name].add(new Option(titel, id));
}
function render() {
  const daten = Object.fromEntries(new FormData(form));
  const aktiv = Object.values(daten).some(v=>v.trim());
  const treffer = aktiv ? suche(daten.q, daten, freigaben) : [];
  status.textContent = !aktiv ? "" : treffer.length ? `${treffer.length} Treffer` : "Nichts Passendes gefunden. Versuche einen kürzeren Begriff oder entferne einen Filter.";
  liste.replaceChildren(...treffer.map(x=>{
    const li=document.createElement("li"), link=document.createElement("a"), titel=document.createElement("strong"), info=document.createElement("small");
    link.href=x.href; titel.textContent=x.titel; info.textContent=x.beschreibung;
    if (x.href.startsWith("https:")) {link.target="_blank"; link.rel="noopener noreferrer"; titel.append(" ↗");}
    link.append(titel,info); li.append(link); return li;
  }));
}
form.addEventListener("input",render);
form.addEventListener("submit",e=>{e.preventDefault();render();});
form.addEventListener("reset",()=>queueMicrotask(render));
box.hidden=false;
void websiteFunktionsfreigaben.then(aktuell=>{freigaben=aktuell;render();});
