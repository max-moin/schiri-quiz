import { DATENBANK } from "../../verein.config.js";
import {erstelleSerienSteuerung} from './wochenserie-ansicht.js';
import {wochenAnteile,zeichneFragenStatus,zeichneStatusZaehler} from './quiz-statistik-fragen.js';

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const rpc = globalThis.SchiriRpc.erstelleRpc({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});
const $ = (id) => document.getElementById(id);
let datenVersion = 0;
const serienZiel=$('meine-wochenserie');
const serienSteuerung=serienZiel?erstelleSerienSteuerung({ziel:serienZiel,rpc,anmeldung,bereich:'serie'}):null;

function kennzahl(zahl, label, klasse = "") {
  const k = document.createElement("div");
  k.className = `meine-kennzahl ${klasse}`.trim();
  const stark = document.createElement("strong");
  stark.textContent = String(zahl);
  const text = document.createElement("span");
  text.textContent = label;
  k.append(stark, text);
  return k;
}

// Zwei Testpersonen am 10.09.2026: "Man sieht die Schwaechen nicht." Die
// Seite zeigte nur Zahlen und ueberliess das Deuten der Person.
//
// Ein Themengebiet kann hier NICHT benannt werden: "meine_quiz_statistik"
// liefert ausschliesslich Werte pro Woche, keine Kategorie und keine
// Regelnummer. Statt eine Schwaeche zu erfinden, sagt diese Auswertung in
// Saetzen genau das, was die vorhandenen Zahlen hergeben - und wo ihre
// Grenze liegt.
function schwaechsteWoche(wochen) {
  const gespielt = wochen.filter((w) => Number(w.beantwortet) > 0);
  if (!gespielt.length) return null;
  return gespielt.slice().sort((a, b) => {
    const quoteA = Number(a.richtig) / Number(a.beantwortet);
    const quoteB = Number(b.richtig) / Number(b.beantwortet);
    if (quoteA !== quoteB) return quoteA - quoteB;
    // Bei gleicher Quote zaehlt die Woche mit mehr Antworten mehr: sie ist
    // die belastbarere Aussage.
    return Number(b.beantwortet) - Number(a.beantwortet);
  })[0];
}

function deutungsSaetze(wochen, summe) {
  if (!wochen.length) return ["Sobald die erste Quizwoche läuft, steht hier, was deine Zahlen bedeuten."];
  if (!summe.beantwortet) {
    return ["Du hast bisher keine einzige Quizfrage beantwortet – deshalb kann diese Seite noch nicht sagen, wo du stehst.",
      "Mach eine Woche mit, dann steht hier, wo es bei dir hakt."];
  }

  const saetze = [];
  const woche = schwaechsteWoche(wochen);
  const name = woche?.bezeichnung || "einer Quizwoche";
  const richtig = Number(woche?.richtig || 0);
  const beantwortet = Number(woche?.beantwortet || 0);
  if (richtig >= beantwortet) {
    saetze.push(`Danebengelegen bist du bisher in keiner Woche: alle ${summe.beantwortet} beantworteten Fragen waren richtig.`);
  } else if (beantwortet === 1) {
    saetze.push(`Am häufigsten danebengelegen hast du in der Woche „${name}“ – dort war deine einzige Antwort falsch.`);
  } else {
    saetze.push(`Am häufigsten danebengelegen hast du in der Woche „${name}“: dort waren nur ${richtig} von ${beantwortet} Antworten richtig.`);
  }

  if (summe.offen > summe.falsch) {
    saetze.push(`Dein größter Hebel ist aber nicht das Regelwissen, sondern das Mitmachen: ${summe.offen} Fragen hast du gar nicht erst beantwortet.`);
  }
  if (summe.nachbessern > 0) {
    saetze.push(`Bei ${summe.nachbessern} Antworten ist noch eine Rückfrage offen.`);
  }
  saetze.push("Nach Themengebieten kann diese Übersicht nicht auswerten – sie kennt nur deine Wochen.");
  return saetze;
}

function zeichneDeutung(saetze) {
  const ziel = $("statistik-deutung");
  if (!ziel) return;
  ziel.replaceChildren(...saetze.map((satz) => {
    const p = document.createElement("p");
    p.textContent = satz;
    return p;
  }));
}

function zeichne(wochen) {
  const beantwortet = wochen.reduce((summe, w) => summe + Number(w.beantwortet || 0), 0);
  const richtig = wochen.reduce((summe, w) => summe + Number(w.richtig || 0), 0);
  const aktiv = wochen.filter((w) => Number(w.beantwortet) > 0).length;
  const quote = beantwortet ? Math.round(richtig * 100 / beantwortet) : 0;
  $("statistik-zeitraum").textContent = `${wochen.length} Quizwochen · ${aktiv} davon mitgemacht`;
  $("statistik-kennzahlen").replaceChildren(
    kennzahl(aktiv, "Wochen mitgemacht"),
    kennzahl(beantwortet, "Fragen beantwortet"),
    kennzahl(richtig, "richtig", "richtig"),
    kennzahl(`${quote} %`, "Trefferquote"),
  );

  const gestellt = wochen.reduce((summe, w) => summe + Number(w.fragen_gesamt || 0), 0);
  zeichneDeutung(deutungsSaetze(wochen, {
    beantwortet,
    richtig,
    falsch: wochen.reduce((summe, w) => summe + Number(w.falsch || 0), 0),
    nachbessern: wochen.reduce((summe, w) => summe + Number(w.nachbessern || 0), 0),
    offen: Math.max(0, gestellt - beantwortet),
  }));

  const verlauf = $("statistik-verlauf");
  verlauf.replaceChildren();
  if (!wochen.length) {
    const leer = document.createElement("p");
    leer.className = "meine-leer";
    leer.textContent = "Es gibt noch keine Quizwochen für deinen Verein.";
    verlauf.appendChild(leer);
    return;
  }
  for (const woche of wochen) {
    const gesamt = Number(woche.fragen_gesamt || 0);
    const beantwortetWoche = Number(woche.beantwortet || 0);
    const anteile=wochenAnteile(woche);
    const artikel = document.createElement("details");
    artikel.className = "statistik-woche" + (woche.ist_aktuelle_runde ? " aktuell" : "");
    const zusammenfassung=document.createElement('summary');
    const kopf = document.createElement("div");
    kopf.className = "statistik-woche-kopf";
    const titel = document.createElement("strong");
    titel.textContent = woche.bezeichnung || "Quizwoche";
    const stand = document.createElement("span");
    stand.textContent = gesamt ? `${beantwortetWoche}/${gesamt} beantwortet` : "Noch keine Fragen eingeplant";
    kopf.append(titel, stand);
    const balken = document.createElement("div");
    balken.className = "statistik-balken";
    balken.setAttribute("role", "img");
    balken.setAttribute("aria-label", `${anteile.richtig} richtig, ${anteile.nachbessern} mit offener Rückfrage, ${anteile.falsch} falsch, ${anteile.offen} nicht beantwortet`);
    for(const status of ['richtig','nachbessern','falsch','offen']){
      const teil=document.createElement('span');teil.className=status;teil.style.width=`${gesamt?anteile[status]*100/gesamt:0}%`;balken.append(teil);
    }
    zusammenfassung.append(kopf,balken,zeichneStatusZaehler(document,anteile));
    const fragen=document.createElement('div');fragen.className='statistik-fragen-bereich';
    let geladen=false,laedt=false;
    const person=anmeldung.lesen(),generation=datenVersion;
    async function ladeFragen(){
      if(laedt||geladen||!person)return;laedt=true;fragen.textContent='Fragen werden geladen …';
      try{
        const {data,error}=await rpc.rpc('meine_quizwochen_fragen',{p_schiedsrichter_id:person.id,p_pin:person.pin,p_runde_id:woche.runde_id});
        const aktuell=anmeldung.lesen();
        if(generation!==datenVersion||aktuell?.id!==person.id||aktuell?.pin!==person.pin)return;
        if(error)throw error;
        fragen.replaceChildren(zeichneFragenStatus(document,data));geladen=true;
      }catch{
        if(generation!==datenVersion)return;
        fragen.textContent='Fragen konnten nicht geladen werden. ';
        const retry=document.createElement('button');retry.type='button';retry.textContent='Erneut versuchen';retry.onclick=ladeFragen;fragen.append(retry);
      }finally{laedt=false;}
    }
    artikel.addEventListener('toggle',()=>{if(artikel.open)void ladeFragen();});
    artikel.append(zusammenfassung,fragen);
    verlauf.appendChild(artikel);
  }
}

async function lade(person, version) {
  const { data, error } = await rpc.rpc("meine_quiz_statistik", {
    p_schiedsrichter_id: person.id,
    p_pin: person.pin,
    p_wochen: 26,
  });
  const aktuell = anmeldung.lesen();
  if (version !== datenVersion || aktuell?.id !== person.id || aktuell?.pin !== person.pin) return;
  if (error) {
    $("statistik-verlauf").innerHTML = '<p class="meine-leer">Dein Verlauf konnte gerade nicht geladen werden.</p>';
    $("statistik-zeitraum").textContent = "Nicht verfügbar";
    zeichneDeutung(["Ohne deine Zahlen lässt sich hier nichts deuten. Versuch es später noch einmal."]);
    return;
  }
  zeichne(Array.isArray(data) ? data : []);
}

function starte() {
  const version = ++datenVersion;
  const person = anmeldung.lesen();
  $("meine-zugang").hidden = !!person;
  $("meine-inhalt").hidden = !person;
  $('statistik-kennzahlen').replaceChildren();
  $('statistik-deutung').replaceChildren();
  $('statistik-verlauf').replaceChildren();
  $('statistik-zeitraum').textContent = person ? 'Wird geladen …' : '';
  void serienSteuerung?.laden(person);
  if (person) void lade(person, version);
}

$("meine-anmelden")?.addEventListener("click", async () => {
  if (!loginDialog) return;
  const ergebnis = await loginDialog.oeffne({ grund: "Melde dich an, um deine Quizstatistik zu sehen." });
  if (ergebnis.status === "angemeldet") starte();
});

anmeldung.abonniere(starte);
window.addEventListener('pageshow', event => { if(event.persisted) starte(); });
document.addEventListener('visibilitychange', () => { if(!document.hidden) starte(); });
