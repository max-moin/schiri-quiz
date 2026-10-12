// ============================================================
//  modus.html - die Auswahl hinter "Zum Quiz"
// ============================================================
//  Max am 29.08.2026: "Ob man das, wenn man zum Quiz klickt, dann
//  vielleicht noch einen anderen Modus vorher auswaehlen kann? ... dass
//  man da vielleicht noch irgendwie 'Question of the Week' highlightet,
//  sodass das auch mehr aussieht wie ein Game."
//
//  ------------------------------------------------------------
//  Die Reihenfolge ist der halbe Entwurf
//  ------------------------------------------------------------
//  Solange Wochenfragen offen sind, stehen sie oben und sind die einzige
//  hervorgehobene Kachel. Sind sie erledigt, rutscht "Entscheiden" nach
//  oben und uebernimmt die Hervorhebung. Damit fuehrt die Seite ohne ein
//  Wort Erklaerung zum jeweils naechsten sinnvollen Schritt - und die
//  Pflicht bleibt Pflicht, ohne dass irgendwo "Pflicht" steht.
//
//  ------------------------------------------------------------
//  Was passiert, wenn der Server schweigt
//  ------------------------------------------------------------
//  Die Zahlen sind Schmuck, die Wege sind es nicht. Faellt eine Abfrage
//  aus, verschwinden die Zaehler, nicht die Kacheln. Eine Auswahlseite,
//  die wegen einer Statistik leer bleibt, waere schlimmer als eine ohne
//  Statistik.
// ============================================================

import { DATENBANK } from "../../verein.config.js";
import { erstelleSzenarioZugriff, erstelleWochenZaehler } from "./szenario-zugriff.js";

const bereich = document.getElementById("modusBereich");
const zugriff = erstelleSzenarioZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});
const zaehleWoche = erstelleWochenZaehler({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;

const person = () => anmeldung?.lesen() || null;
const sicher = (t) => String(t ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function symbol(art) {
  const pfade = {
    woche: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m8 12 2 2 5-5M8 17h8"/>',
    ueben: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3"/>',
    entscheiden: '<path d="M12 21V4M12 12 5 5M12 12l7-7M3 5h4v4M17 5h4v4"/>',
    duell: '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M1 21v-3a6 6 0 0 1 12 0v3M13 13a6 6 0 0 1 10 5v3"/>',
  };
  return `<svg class="modus-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfade[art] || pfade.woche}</svg>`;
}

// ---------- Kacheln ----------

// Usability-Test Runde 3 (iPhone): Die Testperson tippte in der Kopfleiste
// auf "Zum Quiz", landete hier - und wartete. Dass erst ein Tipp auf die
// Kachel die Runde startet, stand nirgends: "Fragen dieser Woche" nennt ein
// Thema, keine Handlung. Diese Zeile spricht die Handlung aus (ISO 9241-110,
// Selbstbeschreibungsfaehigkeit) und sagt bei einer angefangenen Runde
// gleich, bei welcher Frage es weitergeht. Der Zustand steht damit zweimal
// da - in der Pille oben ("3 offen") und hier als naechster Schritt.
function wochenAktionsText({ offen, gesamt, unbekannt, fertig }) {
  if (fertig) return "Antworten ansehen";
  // Solange die Zahlen noch nicht da sind, verspricht die Zeile nur das,
  // was in jedem Fall stimmt: ein Tipp startet die Runde.
  if (unbekannt || gesamt === 0 || offen >= gesamt) return "Fragen dieser Woche starten";
  return `Weiter – Frage ${gesamt - offen + 1} von ${gesamt}`;
}

function wochenKachel({ offen, gesamt, unbekannt }) {
  const fertig = !unbekannt && gesamt > 0 && offen === 0;
  const anteil = gesamt > 0 ? Math.round(((gesamt - offen) / gesamt) * 100) : 0;

  return `
    <a class="modus-kachel${fertig ? "" : " hervorgehoben"}" href="quiz.html">
      <div class="modus-kopf">
        <span class="modus-name">${symbol('woche')}Fragen dieser Woche</span>
        ${unbekannt ? ""
          : fertig
            ? '<span class="modus-pille erledigt">Erledigt</span>'
            : `<span class="modus-pille">${offen} offen</span>`}
      </div>
      ${unbekannt || gesamt === 0 ? "" : `
        <div class="modus-balken" role="img"
             aria-label="${gesamt - offen} von ${gesamt} beantwortet">
          <span style="width:${anteil}%"></span>
        </div>
        <span class="modus-fuss">${gesamt - offen} von ${gesamt} beantwortet</span>`}
      <span class="modus-aktion">${wochenAktionsText({ offen, gesamt, unbekannt, fertig })}<span aria-hidden="true">→</span></span>
    </a>`;
}

/* Runde 2 und 3 des Usability-Tests: beide Personen sind in "Entscheiden"
   gelandet und standen vor einer leeren Seite - der Modus hat noch keine
   Szenen. Gesperrt wird aber nur, wenn die Statistik wirklich geladen
   wurde und null Szenarien meldet. Faellt die Abfrage aus (statistik ===
   null), ist "keine Fragen" nicht bewiesen: dann bleibt der Weg offen,
   sonst sperrt eine schlechte Verbindung einen fertigen Modus weg. */
function entscheidenOhneInhalt(statistik) {
  return Boolean(statistik) && Number(statistik.szenarien_gesamt) === 0;
}

function entscheidenKachel(statistik, hervorgehoben) {
  /* Kein <a>, sondern eine tote Flaeche mit aria-disabled - dasselbe
     Muster, mit dem die Kopfleiste Spesenrechner und Regeluebersicht als
     noch nicht verfuegbar markiert (.nav-deaktiviert). Und ein Satz,
     warum hier gerade nichts geht: ein toter Knopf ohne Begruendung ist
     schlimmer als gar keiner. */
  if (entscheidenOhneInhalt(statistik)) {
    return `
      <div class="modus-kachel modus-vorbereitung" aria-disabled="true"
           title="Für „Entscheiden“ sind noch keine Szenen freigegeben">
        <div class="modus-kopf">
          <span class="modus-name">${symbol('entscheiden')}Entscheiden</span>
          <span class="modus-pille vorbereitung">In Vorbereitung</span>
        </div>
        <span class="modus-fuss">
          Noch keine Szenen freigegeben.
        </span>
      </div>`;
  }

  if (!statistik) {
    return `
      <a class="modus-kachel${hervorgehoben ? " hervorgehoben" : ""}" href="entscheiden.html">
        <div class="modus-kopf">
          <span class="modus-name">${symbol('entscheiden')}Entscheiden</span>
          <span class="modus-pille neu">Neu</span>
        </div>
        <p class="modus-text">
          Spielfortsetzung und persönliche Strafe.
        </p>
      </a>`;
  }

  const { offen, szenarien_gesamt: gesamt, serie, quote } = statistik;

  return `
    <a class="modus-kachel${hervorgehoben ? " hervorgehoben" : ""}" href="entscheiden.html">
      <div class="modus-kopf">
        <span class="modus-name">${symbol('entscheiden')}Entscheiden</span>
        ${Number(serie) > 0
          ? `<span class="modus-pille serie">${serie} in Serie</span>`
          : '<span class="modus-pille neu">Neu</span>'}
      </div>
      <p class="modus-text">
        Spielfortsetzung und persönliche Strafe.
      </p>
      <span class="modus-fuss">
        ${gesamt > 0
          ? `${offen} von ${gesamt} noch nicht gespielt${Number(quote) > 0 ? ` · ${quote}% komplett richtig` : ""}`
          : "Noch keine Szenen freigegeben"}
      </span>
    </a>`;
}

function duellKachel() {
  return `
    <a class="modus-kachel" href="duell.html">
      <div class="modus-kopf">
        <span class="modus-name">${symbol('duell')}Quiz-Duell</span>
        <span class="modus-pille neu">Neu</span>
      </div>
      <p class="modus-text">Fünf Fragen. Einladen oder mitspielen.</p>
    </a>`;
}

function uebenKachel(freigeschaltet) {
  return freigeschaltet
    ? `<a class="modus-kachel" href="quiz.html#ueben">
        <div class="modus-kopf"><span class="modus-name">${symbol('ueben')}Üben</span><span class="modus-pille erledigt">Frei</span></div>
        <p class="modus-text">Frühere Fragen wiederholen.</p>
      </a>`
    : `<a class="modus-kachel gesperrt" href="quiz.html">
        <div class="modus-kopf"><span class="modus-name">${symbol('ueben')}Üben</span><span class="modus-pille">Noch gesperrt</span></div>
        <p class="modus-text">Zuerst die Wochenfragen abschließen.</p>
      </a>`;
}

function gastKachel() {
  return `
    <a class="modus-kachel hervorgehoben" href="quiz.html#gast">
      <div class="modus-kopf">
        <span class="modus-name">Gastquiz</span>
        <span class="modus-pille">Ohne Anmeldung</span>
      </div>
      <p class="modus-text">Ein paar freigegebene Fragen unverbindlich ausprobieren.</p>
      <span class="modus-fuss">Ohne Wochenstand · ohne Scoreboard</span>
      <span class="modus-aktion">Gastquiz starten<span aria-hidden="true">→</span></span>
    </a>`;
}

// ---------- Seite ----------

function zeichne({ woche, statistik, angemeldet }) {
  const wochenfragenFertig = woche && !woche.unbekannt && woche.gesamt > 0 && woche.offen === 0;

  /* Nach erledigter Wochenrunde uebernimmt "Entscheiden" sonst die
     Hervorhebung und die erste Stelle. Ein Modus ohne Inhalt darf das
     nicht: die Reihenfolge soll zum naechsten sinnvollen Schritt fuehren,
     und eine gesperrte Kachel ganz oben ist das Gegenteil davon. Dann
     rutscht sie nach hinten, und "Üben" bleibt trotzdem frei. */
  const entscheidenFuehrt = wochenfragenFertig && !entscheidenOhneInhalt(statistik);

  const kacheln = angemeldet
    ? (entscheidenFuehrt
        ? [entscheidenKachel(statistik, true), wochenKachel(woche), uebenKachel(true), duellKachel()]
        : [wochenKachel(woche), uebenKachel(wochenfragenFertig), entscheidenKachel(statistik, false), duellKachel()])
    : [gastKachel(), duellKachel()];

  bereich.innerHTML = `
    <h1 class="seiten-titel">Dein Quiz</h1>
    <p class="seiten-unter">
      ${angemeldet
        ? ""
        : "Wähle das Gastquiz oder tritt mit einem Code einem Duell bei. Deine persönlichen Wochenfragen bleiben geschützt."}
    </p>
    <div class="modus-liste">${kacheln.join("")}</div>
    <p class="modus-nachsatz">
      <a href="melden.html">Ideen &amp; Feedback</a>
    </p>`;

}

let ladeStand = 0;
async function starte() {
  const generation = ++ladeStand;
  const ich = person();
  if (!ich) {
    zeichne({ woche: null, statistik: null, angemeldet: false });
    return;
  }

  // Erst die Kacheln, dann die Zahlen: die Seite steht sofort, auch
  // wenn die Datenbank ein paar hundert Millisekunden braucht.
  zeichne({ woche: { unbekannt: true, offen: 0, gesamt: 0 }, statistik: null, angemeldet: true });

  const [woche, statistik] = await Promise.all([
    zaehleWoche(ich).catch(() => ({ unbekannt: true, offen: 0, gesamt: 0 })),
    zugriff.statistik(ich).catch(() => null),
  ]);
  if (generation !== ladeStand || person()?.id !== ich.id) return;
  zeichne({ woche, statistik, angemeldet: true });
}

// abonniere() ruft sofort einmal auf - deshalb hier KEIN zusaetzliches
// starte(), sonst zeichnet die Seite beim Laden zweimal.
if (anmeldung) anmeldung.abonniere(() => starte());
else starte();
