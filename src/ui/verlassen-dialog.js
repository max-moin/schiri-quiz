// ============================================================
//  Rueckfrage, bevor man das Quiz mit angefangenen Antworten verlaesst
// ============================================================
//  Max am 03.09.2026: "das find ich gut, dass da ein Hinweis kommt, wenn
//  man das Quiz verlaesst, dass ungespeicherte Antworten verschluckt
//  werden."
//
//  Die schwierige Frage daran ist nicht das Fenster, sondern WANN es
//  kommen darf. Eine Rueckfrage, die immer erscheint, wird nach dem
//  dritten Mal blind weggetippt und schuetzt danach gar nichts mehr.
//
//  Der Zustand, an dem sie haengt, ist nicht erfunden, sondern der, den
//  das Quiz ohnehin schon fuehrt:
//
//  - Eine abgeschickte Frage bekommt die Klasse "beantwortet" auf ihre
//    Karte (src/features/weekly-quiz.js, flexible-answers.js,
//    decision-answers.js). Was diese Klasse traegt, liegt beim Server -
//    da geht nichts mehr verloren.
//  - Offen ist also ".frage-karte:not(.beantwortet)".
//  - Angefangen ist eine offene Karte dann, wenn in ihr etwas steht, was
//    die Person selbst hineingetan hat. Genau dieselbe Unterscheidung
//    trifft der Sammel-Absenden-Knopf schon heute, wenn er die "offenen
//    Fragen mit Auswahl" einsammelt.
//
//  Kein confirm(): Browser-Dialoge sind hier nicht erlaubt und saehen
//  auch nicht aus wie die Seite. Das Fenster uebernimmt die Formsprache
//  der Video-Grossansicht (dunkle Flaeche, Karte, zwei Knoepfe).
//
//  Und kein "beforeunload": das Ereignis erlaubt keine eigenen
//  Beschriftungen. Der Browser zeigt dort seinen eigenen Text mit "OK"
//  und "Abbrechen" - genau die zwei Woerter, die nicht sagen, was
//  passiert.
// ============================================================

(function stelleVerlassenDialogBereit(global) {
  "use strict";

  // Eine Karte, die noch nicht beim Server liegt.
  const OFFENE_KARTE = ".frage-karte:not(.beantwortet)";

  // Steht in dieser offenen Karte etwas, was die Person selbst
  // hineingetan hat?
  function hatBegonneneAntwort(karte) {
    // Wochenfragen und flexible Fragen: angeklickte Option.
    if (karte.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked')) {
      return true;
    }

    // Entscheidungs-Modus: dort sind die Auswahlen Knoepfe, keine
    // Ankreuzfelder. "aria-pressed" ist ihr Zustand.
    if (karte.querySelector('.entscheidung-knopf[aria-pressed="true"]')) return true;

    // Getippter Text: Freitextantwort, Ergaenzung, Rueckennummer,
    // eigener Ort, Zahlenwert.
    const felder = karte.querySelectorAll(
      'textarea, input[type="text"], input[type="number"], input[type="search"]'
    );
    for (const feld of felder) {
      if (String(feld.value || "").trim() !== "") return true;
    }

    // Ausklappmenues nur dann, wenn sie ueberhaupt eine leere Vorgabe
    // anbieten ("Bitte waehlen ..."). Die Einheit einer Zahlenfrage und
    // die Rolle im Strafblock stehen von Anfang an auf einem Wert - sie
    // als Antwort zu zaehlen, hiesse die Rueckfrage immer zu zeigen.
    for (const menue of karte.querySelectorAll("select")) {
      const hatLeereVorgabe = Array.from(menue.options).some((o) => o.value === "");
      if (hatLeereVorgabe && String(menue.value || "").trim() !== "") return true;
    }

    return false;
  }

  function zaehleBegonneneAntworten(wurzel) {
    const bereich = wurzel || document;
    return Array.from(bereich.querySelectorAll(OFFENE_KARTE)).filter(hatBegonneneAntwort).length;
  }

  // ---------- Das Fenster ----------

  function baueFenster() {
    const overlay = document.createElement("div");
    overlay.className = "verlassen-overlay";
    overlay.id = "verlassen-overlay";
    overlay.hidden = true;

    const karte = document.createElement("div");
    karte.className = "verlassen-karte";
    karte.setAttribute("role", "dialog");
    karte.setAttribute("aria-modal", "true");
    karte.setAttribute("aria-labelledby", "verlassen-titel");
    karte.setAttribute("aria-describedby", "verlassen-text");

    const titel = document.createElement("h2");
    titel.id = "verlassen-titel";
    titel.textContent = "Angefangene Antworten gehen verloren";

    const text = document.createElement("p");
    text.id = "verlassen-text";

    const aktionen = document.createElement("div");
    aktionen.className = "verlassen-aktionen";

    // Der sichere Weg steht vorn und traegt die kraeftige Farbe. Wer aus
    // Versehen tippt, bleibt damit im Quiz statt seine Antworten zu
    // verlieren.
    const bleiben = document.createElement("button");
    bleiben.type = "button";
    bleiben.className = "verlassen-knopf verlassen-bleiben";
    bleiben.textContent = "Weiter beantworten";

    const gehen = document.createElement("button");
    gehen.type = "button";
    gehen.className = "verlassen-knopf verlassen-gehen";
    gehen.textContent = "Quiz verlassen";

    aktionen.append(bleiben, gehen);
    karte.append(titel, text, aktionen);
    overlay.appendChild(karte);
    document.body.appendChild(overlay);

    return { overlay, text, bleiben, gehen };
  }

  function montiereQuizVerlassen({ knopfWaehler = "a.heim-knopf" } = {}) {
    const heimKnopf = document.querySelector(knopfWaehler);
    if (!heimKnopf) return null;

    let fenster = null;
    let vorherigerFokus = null;

    function schliessen() {
      if (!fenster) return;
      fenster.overlay.hidden = true;
      document.body.classList.remove("verlassen-dialog-offen");
      if (vorherigerFokus && vorherigerFokus.focus) vorherigerFokus.focus();
    }

    function oeffne(anzahl, ziel) {
      if (!fenster) {
        fenster = baueFenster();
        fenster.bleiben.addEventListener("click", schliessen);
        fenster.gehen.addEventListener("click", () => {
          // Bewusst kein schliessen() davor: das Fenster bleibt stehen,
          // bis die neue Seite da ist. Sonst blitzt das Quiz noch einmal
          // auf, als waere doch nichts passiert.
          location.href = ziel;
        });
        fenster.overlay.addEventListener("click", (ereignis) => {
          if (ereignis.target === fenster.overlay) schliessen();
        });
        // Tastatur: Escape bricht ab (der sichere Weg), Tab bleibt im
        // Fenster - sonst tabbt man hinter das Fenster ins Quiz.
        fenster.overlay.addEventListener("keydown", (ereignis) => {
          if (ereignis.key === "Escape") {
            ereignis.preventDefault();
            schliessen();
            return;
          }
          if (ereignis.key !== "Tab") return;
          ereignis.preventDefault();
          const ziele = [fenster.bleiben, fenster.gehen];
          const jetzt = ziele.indexOf(document.activeElement);
          const schritt = ereignis.shiftKey ? -1 : 1;
          ziele[(jetzt + schritt + ziele.length) % ziele.length].focus();
        });
      }

      fenster.text.textContent = anzahl === 1
        ? "Bei einer Frage hast du schon etwas ausgewählt oder geschrieben, "
          + "aber noch nicht abgeschickt. Wenn du das Quiz jetzt verlässt, ist das weg."
        : "Bei " + anzahl + " Fragen hast du schon etwas ausgewählt oder geschrieben, "
          + "aber noch nicht abgeschickt. Wenn du das Quiz jetzt verlässt, ist das weg.";

      vorherigerFokus = document.activeElement;
      fenster.overlay.hidden = false;
      document.body.classList.add("verlassen-dialog-offen");
      fenster.bleiben.focus();
    }

    heimKnopf.addEventListener("click", (ereignis) => {
      // Nichts angefangen: der Knopf tut genau das, was draufsteht. Eine
      // Rueckfrage, die immer kommt, schuetzt nach dreimal nichts mehr.
      const anzahl = zaehleBegonneneAntworten(document);
      if (anzahl === 0) return;
      ereignis.preventDefault();
      oeffne(anzahl, heimKnopf.getAttribute("href") || "index.html");
    });

    return { zaehleBegonneneAntworten: () => zaehleBegonneneAntworten(document) };
  }

  global.SchiriQuizVerlassenDialog = Object.freeze({
    montiereQuizVerlassen,
    zaehleBegonneneAntworten,
    hatBegonneneAntwort,
  });
})(globalThis);
