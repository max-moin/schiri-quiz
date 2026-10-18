// "Zum Quiz" führt unabhängig von einer gespeicherten Sitzung zuerst zu
// den Wochenfragen. Fehlende Anmeldung ist kein Wunsch nach dem Gastquiz.
import { DATENBANK } from "../../verein.config.js";
import { erstelleWochenZaehler } from "./szenario-zugriff.js";

const bereich = document.getElementById("modusBereich");
const zaehleWoche = erstelleWochenZaehler({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const person = () => anmeldung?.lesen() || null;

function symbol(art) {
  const pfade = {
    woche: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m8 12 2 2 5-5M8 17h8"/>',
    ueben: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3"/>',
    duell: '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M1 21v-3a6 6 0 0 1 12 0v3M13 13a6 6 0 0 1 10 5v3"/>',
  };
  return `<svg class="modus-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfade[art] || pfade.woche}</svg>`;
}

function wochenAktionsText({ offen, gesamt, unbekannt, fertig, angemeldet }) {
  if (!angemeldet) return "Anmelden & starten";
  if (fertig) return "Antworten ansehen";
  if (unbekannt || gesamt === 0 || offen >= gesamt) return "Fragen dieser Woche starten";
  return `Weiter – Frage ${gesamt - offen + 1} von ${gesamt}`;
}

function wochenKachel(woche, angemeldet) {
  const {offen = 0, gesamt = 0, unbekannt = true} = woche || {};
  const fertig = !unbekannt && gesamt > 0 && offen === 0;
  const anteil = gesamt > 0 ? Math.round(((gesamt - offen) / gesamt) * 100) : 0;
  return `<a class="modus-kachel modus-wochenquiz hervorgehoben" href="quiz.html">
    <div class="modus-kopf">
      <span class="modus-name">${symbol('woche')}Fragen dieser Woche</span>
      ${!angemeldet ? '<span class="modus-pille">Für unsere Schiris</span>'
        : unbekannt ? '' : fertig ? '<span class="modus-pille erledigt">Erledigt</span>'
        : `<span class="modus-pille">${offen} offen</span>`}
    </div>
    ${!angemeldet ? '<p class="modus-text">Dein Wochenquiz im Verein. Melde dich mit deinen Zugangsdaten an.</p>' : ''}
    ${unbekannt || gesamt === 0 ? '' : `<div class="modus-balken" role="img" aria-label="${gesamt - offen} von ${gesamt} beantwortet"><span style="width:${anteil}%"></span></div><span class="modus-fuss">${gesamt - offen} von ${gesamt} beantwortet</span>`}
    <span class="modus-aktion">${wochenAktionsText({offen,gesamt,unbekannt,fertig,angemeldet})}<span aria-hidden="true">→</span></span>
  </a>`;
}

function uebenKachel(frei) {
  return frei
    ? `<a class="modus-kachel" href="quiz.html#ueben"><div class="modus-kopf"><span class="modus-name">${symbol('ueben')}Üben</span><span class="modus-pille erledigt">Frei</span></div><p class="modus-text">Frühere Fragen wiederholen.</p></a>`
    : `<div class="modus-kachel gesperrt" aria-disabled="true"><div class="modus-kopf"><span class="modus-name">${symbol('ueben')}Üben</span><span class="modus-pille">Noch gesperrt</span></div><p class="modus-text">Zuerst anmelden und die Wochenfragen abschließen.</p></div>`;
}

function zeichne({woche, angemeldet}) {
  const fertig = woche && !woche.unbekannt && woche.gesamt > 0 && woche.offen === 0;
  bereich.innerHTML = `<h1 class="seiten-titel">Dein Quiz</h1>
    <nav class="quiz-untermenue" aria-label="Dein Quiz"><a href="modus.html" aria-current="page">Quiz</a><a href="meine-statistik.html">Quiz-Statistik</a><a href="sammlung.html">Sammlung</a></nav>
    <div class="modus-liste">
      ${wochenKachel(woche,angemeldet)}
      ${uebenKachel(angemeldet && fertig)}
      <a class="modus-kachel" href="duell.html"><div class="modus-kopf"><span class="modus-name">${symbol('duell')}Quiz-Duell</span></div><p class="modus-text">Per Einladung gegeneinander spielen.</p></a>
    </div>
    ${angemeldet ? '' : '<p class="modus-gastalternative">Keine Zugangsdaten? <a href="quiz.html#gast">Gästequiz ausprobieren</a> <span>– ohne Wochenwertung.</span></p>'}
    <p class="modus-nachsatz"><a href="melden.html">Ideen &amp; Feedback</a></p>`;
}

let ladeStand = 0;
bereich.addEventListener("click", async (e) => {
  const link = e.target.closest?.('a.modus-wochenquiz');
  if (!link || person() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const dialog = globalThis.SchiriSeitenAnmeldung?.loginDialog;
  if (!dialog) return; // Der normale Link zeigt die vorhandene Quiz-Anmeldung.
  e.preventDefault();
  const ergebnis = await dialog.oeffne({grund:"Melde dich für deine Wochenfragen mit deinen Zugangsdaten an.",gastErlaubt:true});
  if (ergebnis.status === "angemeldet") location.href = "quiz.html";
  else if (ergebnis.status === "gast") location.href = "quiz.html#gast";
});
async function starte() {
  const generation = ++ladeStand, ich = person();
  zeichne({woche:{unbekannt:true},angemeldet:Boolean(ich)});
  if (!ich) return;
  const woche = await zaehleWoche(ich).catch(()=>({unbekannt:true}));
  if (generation !== ladeStand || person()?.id !== ich.id) return;
  zeichne({woche,angemeldet:true});
}

if (anmeldung?.abonniere) anmeldung.abonniere(starte);
else starte();
window.addEventListener("pageshow", starte);
