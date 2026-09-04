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
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;

const person = () => anmeldung?.lesen() || null;
const sicher = (t) => String(t ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// ---------- Kacheln ----------

function wochenKachel({ offen, gesamt, unbekannt }) {
  const fertig = !unbekannt && gesamt > 0 && offen === 0;
  const anteil = gesamt > 0 ? Math.round(((gesamt - offen) / gesamt) * 100) : 0;

  return `
    <a class="modus-kachel${fertig ? "" : " hervorgehoben"}" href="quiz.html">
      <div class="modus-kopf">
        <span class="modus-name">Fragen dieser Woche</span>
        ${unbekannt ? ""
          : fertig
            ? '<span class="modus-pille erledigt">Erledigt</span>'
            : `<span class="modus-pille">${offen} offen</span>`}
      </div>
      <p class="modus-text">
        ${fertig
          ? "Diese Woche hast du alles beantwortet. Nächste Woche gibt es neue."
          : "Die Pflichtrunde: ein paar Regelfragen, in unter zwei Minuten erledigt."}
      </p>
      ${unbekannt || gesamt === 0 ? "" : `
        <div class="modus-balken" role="img"
             aria-label="${gesamt - offen} von ${gesamt} beantwortet">
          <span style="width:${anteil}%"></span>
        </div>
        <span class="modus-fuss">${gesamt - offen} von ${gesamt} beantwortet</span>`}
    </a>`;
}

function entscheidenKachel(statistik, hervorgehoben) {
  if (!statistik) {
    return `
      <a class="modus-kachel${hervorgehoben ? " hervorgehoben" : ""}" href="entscheiden.html">
        <div class="modus-kopf">
          <span class="modus-name">Entscheiden</span>
          <span class="modus-pille neu">Neu</span>
        </div>
        <p class="modus-text">
          Eine Szene, zwei Entscheidungen: Wie geht es weiter, und gibt es eine Karte?
        </p>
      </a>`;
  }

  const { offen, szenarien_gesamt: gesamt, serie, quote } = statistik;

  return `
    <a class="modus-kachel${hervorgehoben ? " hervorgehoben" : ""}" href="entscheiden.html">
      <div class="modus-kopf">
        <span class="modus-name">Entscheiden</span>
        ${Number(serie) > 0
          ? `<span class="modus-pille serie">${serie} in Serie</span>`
          : '<span class="modus-pille neu">Neu</span>'}
      </div>
      <p class="modus-text">
        Eine Szene, zwei Entscheidungen: Wie geht es weiter, und gibt es eine Karte?
      </p>
      <span class="modus-fuss">
        ${gesamt > 0
          ? `${offen} von ${gesamt} noch nicht gespielt${Number(quote) > 0 ? ` · ${quote}% komplett richtig` : ""}`
          : "Noch keine Szenen freigegeben"}
      </span>
    </a>`;
}

function gesperrteKachel() {
  return `
    <div class="modus-kachel gesperrt">
      <div class="modus-kopf">
        <span class="modus-name">Entscheiden</span>
        <span class="modus-pille">Nur für Mitglieder</span>
      </div>
      <p class="modus-text">
        Eine Szene, zwei Entscheidungen: Wie geht es weiter, und gibt es eine Karte?
        Dafür brauchst du deine Vereinskennung – die Serie und dein Stand hängen
        an deinem Namen.
      </p>
      <button class="modus-anmelden" type="button" data-anmelden>Anmelden</button>
    </div>`;
}

function duellKachel() {
  return `
    <a class="modus-kachel" href="duell.html">
      <div class="modus-kopf">
        <span class="modus-name">Quiz-Duell</span>
        <span class="modus-pille neu">Neu</span>
      </div>
      <p class="modus-text">Fünf frühere Wochenfragen. Erstelle einen Code oder tritt als Gast bei.</p>
      <span class="modus-fuss">Asynchron · ohne Einfluss aufs Scoreboard</span>
    </a>`;
}

// ---------- Seite ----------

function zeichne({ woche, statistik, angemeldet }) {
  const wochenfragenFertig = woche && !woche.unbekannt && woche.gesamt > 0 && woche.offen === 0;

  const kacheln = angemeldet
    ? (wochenfragenFertig
        ? [entscheidenKachel(statistik, true), wochenKachel(woche), duellKachel()]
        : [wochenKachel(woche), entscheidenKachel(statistik, false), duellKachel()])
    : [wochenKachel({ unbekannt: true, offen: 0, gesamt: 0 }), duellKachel(), gesperrteKachel()];

  bereich.innerHTML = `
    <h1 class="seiten-titel">Was willst du machen?</h1>
    <p class="seiten-unter">
      ${angemeldet
        ? `Hallo ${sicher(person()?.name || "")} – such dir aus, womit du anfängst.`
        : "Melde dich an, dann zählt alles mit."}
    </p>
    <div class="modus-liste">${kacheln.join("")}</div>
    <p class="modus-nachsatz">
      Alte Fragen noch einmal durchgehen? Das findest du
      <a href="quiz.html">im Quiz ganz unten</a>.
    </p>
    <p class="modus-nachsatz">
      Etwas erlebt, das nicht ins Quiz gehört – ein Regelfall, ein Vorfall
      oder einfach ein Gesprächswunsch? Dafür gibt es den
      <a href="melden.html">Meldebogen</a>.
    </p>`;

  bereich.querySelector("[data-anmelden]")?.addEventListener("click", async () => {
    const ergebnis = await loginDialog?.oeffne({
      grund: "Für den Entscheidungs-Modus brauchst du deine Anmeldung.",
      gastErlaubt: false,
    });
    if (ergebnis?.status === "angemeldet") starte();
  });
}

async function starte() {
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
  zeichne({ woche, statistik, angemeldet: true });
}

// abonniere() ruft sofort einmal auf - deshalb hier KEIN zusaetzliches
// starte(), sonst zeichnet die Seite beim Laden zweimal.
if (anmeldung) anmeldung.abonniere(() => starte());
else starte();
