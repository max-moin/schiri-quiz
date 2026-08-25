(function stelleHistorienModusBereit(global) {
  "use strict";

  function erstelleHistorienModus({
    sb,
    getZugang,
    zeigeFehler,
    versteckeFehler,
    frageAnsicht,
    freitext,
    baueVorlesenButton,
    stoppeVorlesen,
    baueWarumButton,
  }) {
    const historieStartButton = document.getElementById("historie-start-button");
    const historieSchritt = document.getElementById("historie-schritt");
    const historieZurueckButton = document.getElementById("historie-zurueck-button");
    const historieNeuLadenButton = document.getElementById("historie-neu-laden-button");
    const historieNeuLadenIcon = historieNeuLadenButton
      ? historieNeuLadenButton.querySelector(".historie-neu-laden-icon")
      : null;
    const historieFrageBereich = document.getElementById("historie-frage-bereich");
    const historieLeerHinweis = document.getElementById("historie-leer-hinweis");
    const historieScoreboard = document.getElementById("historie-scoreboard");
    const historieScoreboardGesamt = document.getElementById("historie-scoreboard-gesamt");
    const historieScoreboardRichtig = document.getElementById("historie-scoreboard-richtig");
    const historieScoreboardGesamtHinweis = document.getElementById("historie-scoreboard-gesamt-hinweis");
    const kopf = document.getElementById("kopf");
    const kopfUntertitel = document.getElementById("kopf-untertitel");
    const kopfUntertitelOriginal = kopfUntertitel ? kopfUntertitel.textContent : "";
    const fortschrittWrap = document.getElementById("fortschritt-wrap");
    const fragenSchritt = document.getElementById("fragen-schritt");
    const UEBEN_UNTERTITEL = "Übe hier so viele alte Fragen, wie du möchtest - ganz ohne Zeitdruck.";

    let historieAktuelleFrageId = null;
    let historieBasisGesamt = 0;
    let historieBasisRichtig = 0;
    let historieSessionGesamt = 0;
    let historieSessionRichtig = 0;
    let historieAutoTimer = null;
    let historieScoreboardLetzterGesamt = null;
    let historieScoreboardLetzterRichtig = null;

    // ============================================================
    // Historie - Wiederholung alter Fragen (11.07.2026)
    //
    // Eigener Bereich, erreichbar über den Button in der "Fertig"-Meldung.
    // Zeigt immer genau EINE zufällige historische Frage (Multiple-Choice oder
    // Freitext, gleiche Kartenoptik/TTS wie im normalen Quiz), gewichtet nach
    // einer sanften Leitner-Stufe (RPC "historie_naechste_frage" macht die
    // Gewichtung serverseitig, siehe Migration v41). Die Antworten landen in
    // einem eigenen DB-Log (historie_antworten), NICHT in "antworten" - die
    // normale wöchentliche Auswertung bleibt dadurch unverfälscht (Max'
    // ausdrücklicher Wunsch). Über den Kreis-Button ("🔄") kann man sich
    // jederzeit eine andere Frage anzeigen lassen, statt auf die aktuelle
    // antworten zu müssen.
    // ============================================================

    // Betreten/Verlassen des "Üben"-Modus (11.07.2026, Update nach Max'
    // Feedback): der Kopf bekommt eine eigene Farbe + einen eigenen Untertitel,
    // und die wöchentliche "X von Y beantwortet"-Leiste verschwindet - im
    // Üben-Modus weiß man ja per Definition schon, dass man "in dem Menü" ist,
    // da störte die Leiste laut Max nur noch.
    function betreteUebenModus() {
      if (kopf) kopf.classList.add("kopf-uebung");
      if (kopfUntertitel) kopfUntertitel.textContent = UEBEN_UNTERTITEL;
      fortschrittWrap.hidden = true;
      fragenSchritt.hidden = true;
      historieSchritt.hidden = false;
      if (historieScoreboard) historieScoreboard.hidden = false;
      ladeHistorieFortschritt();
      ladeHistorieFrage(null);
    }

    function verlasseUebenModus() {
      if (historieAutoTimer) {
        clearTimeout(historieAutoTimer);
        historieAutoTimer = null;
      }
      stoppeVorlesen();
      if (kopf) kopf.classList.remove("kopf-uebung");
      if (kopfUntertitel) kopfUntertitel.textContent = kopfUntertitelOriginal;
      // Die wöchentliche Fortschrittsleiste gehört nur ins normale Quiz - war sie
      // vorher (angemeldeter Zustand) sichtbar, kommt sie jetzt einfach wieder.
      fortschrittWrap.hidden = false;
      historieSchritt.hidden = true;
      fragenSchritt.hidden = false;
    }

    historieStartButton.addEventListener("click", betreteUebenModus);

    historieZurueckButton.addEventListener("click", verlasseUebenModus);

    historieNeuLadenButton.addEventListener("click", () => {
      if (historieNeuLadenIcon) {
        historieNeuLadenIcon.classList.remove("dreht-sich");
        // Reflow erzwingen, damit die Animation bei mehrfachem Klick hintereinander
        // jedes Mal neu abspielt, statt beim erneuten Hinzufügen derselben Klasse
        // einfach ignoriert zu werden.
        void historieNeuLadenIcon.offsetWidth;
        historieNeuLadenIcon.classList.add("dreht-sich");
      }
      ladeHistorieFrage(historieAktuelleFrageId);
    });

    async function ladeHistorieFortschritt() {
      historieSessionGesamt = 0;
      historieSessionRichtig = 0;
      // Zähler-Tracking zurücksetzen, damit der erste Render dieser Sitzung nie
      // eine Flip-Animation auslöst (siehe animiereScoreboardZiffer) - sonst
      // würde beim erneuten Betreten des Üben-Modus kurz sichtbar von der alten
      // Sitzungszahl auf 0 "geklappt".
      historieScoreboardLetzterGesamt = null;
      historieScoreboardLetzterRichtig = null;

      const { data, error } = await sb.rpc("historie_fortschritt_uebersicht", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
      });

      if (error || !data || data.length === 0) {
        historieBasisGesamt = 0;
        historieBasisRichtig = 0;
      } else {
        historieBasisGesamt = data[0].gesamt_beantwortet;
        historieBasisRichtig = data[0].richtig_beantwortet;
      }

      aktualisiereHistorieFortschrittText();
    }

    // Rendert das Scoreboard rein aus lokalem Zustand (Server-Basis + Antworten
    // dieser Sitzung) - siehe Kommentar bei den Variablen weiter oben, warum das
    // nicht mehr bei jeder Antwort neu vom Server geladen wird. Zeigt groß den
    // Sitzungs-Fortschritt ("Heute geübt"), der Gesamt-Stand seit Beginn steht
    // klein im Kopf des Kastens. Jede Zahl, die sich seit dem letzten Aufruf
    // geändert hat, bekommt kurz die Flip-Animation (".aktualisiert",
    // siehe style.css) - beim allerersten Rendern (Betreten des Üben-Modus)
    // bewusst ohne Animation, das würde nur unruhig wirken.
    function aktualisiereHistorieFortschrittText() {
      if (!historieScoreboard) return;

      const gesamtGesamt = historieBasisGesamt + historieSessionGesamt;
      const gesamtRichtig = historieBasisRichtig + historieSessionRichtig;

      animiereScoreboardZiffer(historieScoreboardGesamt, historieSessionGesamt, historieScoreboardLetzterGesamt);
      animiereScoreboardZiffer(historieScoreboardRichtig, historieSessionRichtig, historieScoreboardLetzterRichtig);
      historieScoreboardLetzterGesamt = historieSessionGesamt;
      historieScoreboardLetzterRichtig = historieSessionRichtig;

      historieScoreboardGesamtHinweis.textContent =
        gesamtGesamt === 0
          ? ""
          : "Insgesamt " + gesamtGesamt + " gemacht, " + gesamtRichtig + " davon richtig";
    }

    function animiereScoreboardZiffer(element, neuerWert, alterWert) {
      if (!element) return;
      element.textContent = String(neuerWert);
      if (alterWert === null || alterWert === neuerWert) return;
      element.classList.remove("aktualisiert");
      void element.offsetWidth; // Reflow erzwingen, damit die Animation bei mehreren Änderungen hintereinander jedes Mal neu abspielt.
      element.classList.add("aktualisiert");
    }

    async function ladeHistorieFrage(ausschlussFrageId) {
      versteckeFehler();
      stoppeVorlesen();
      if (historieAutoTimer) {
        clearTimeout(historieAutoTimer);
        historieAutoTimer = null;
      }
      historieFrageBereich.innerHTML = "";
      historieLeerHinweis.hidden = true;

      const { data, error } = await sb.rpc("historie_naechste_frage", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
        p_ausschluss_frage_id: ausschlussFrageId,
      });

      if (error) {
        zeigeFehler("Wiederholungsfrage konnte nicht geladen werden: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        historieAktuelleFrageId = null;
        historieLeerHinweis.hidden = false;
        return;
      }

      const frage = data[0];
      historieAktuelleFrageId = frage.frage_id;
      historieFrageBereich.appendChild(
        frage.typ === "freitext" ? baueHistorieFreitextFrageElement(frage) : baueHistorieFrageElement(frage)
      );
    }

    // "Nächste Frage"-Button direkt in der Karte (11.07.2026, Max' Feedback:
    // vorher blieb man nach dem Antworten einfach "hängen" - jetzt ist der Weg
    // zur nächsten Frage Teil der Karte selbst statt eines weit entfernten
    // Icons oben). Bei Multiple-Choice zählt zusätzlich ein automatischer
    // Weiterschalt-Timer mit sichtbarer Countdown-Linie (bei Freitext bewusst
    // nicht, weil das KI-Feedback erst gelesen werden soll). Der Timer ist über
    // "historieAutoTimer" jederzeit abbrechbar (Reload-Klick, Zurück-Klick,
    // eigener Klick auf den Weiter-Button).
    function zeigeHistorieWeiterButton(container, bisherigeFrageId, automatisch) {
      if (historieAutoTimer) {
        clearTimeout(historieAutoTimer);
        historieAutoTimer = null;
      }

      const alterButton = container.querySelector(".historie-weiter-button");
      if (alterButton) alterButton.remove();

      const weiterButton = document.createElement("button");
      weiterButton.type = "button";
      weiterButton.className = "historie-weiter-button";

      const label = document.createElement("span");
      label.textContent = "Nächste Frage →";
      weiterButton.appendChild(label);

      const fortschrittsLinie = document.createElement("span");
      fortschrittsLinie.className = "historie-weiter-fortschritt";
      weiterButton.appendChild(fortschrittsLinie);

      function weiter() {
        if (historieAutoTimer) {
          clearTimeout(historieAutoTimer);
          historieAutoTimer = null;
        }
        ladeHistorieFrage(bisherigeFrageId);
      }

      weiterButton.addEventListener("click", weiter);
      container.appendChild(weiterButton);

      if (automatisch) {
        // Bei falscher Antwort etwas mehr Zeit zum Lesen der richtigen Lösung,
        // bei richtiger Antwort geht's flotter weiter. Werte am 11.07.2026 nach
        // Max' Feedback verlängert (vorher 1800ms/3200ms - ging ihm zu schnell).
        const istKorrekt = !!container.querySelector(".feedback.richtig");
        const dauerMs = istKorrekt ? 3200 : 5000;

        // Countdown-Linie: startet bei voller Breite (scaleX(1), siehe CSS) und
        // läuft in "dauerMs" linear auf 0 - der kurze Timeout davor sorgt dafür,
        // dass der Browser den Startzustand erst rendert, bevor die
        // CSS-Transition zum Zielwert losläuft (sonst würde direkt der Endwert
        // gezeichnet, ohne sichtbare Animation).
        requestAnimationFrame(() => {
          fortschrittsLinie.style.transition = "transform " + dauerMs + "ms linear";
          fortschrittsLinie.style.transform = "scaleX(0)";
        });

        historieAutoTimer = setTimeout(weiter, dauerMs);
      }
    }

    function baueHistorieFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte frage-karte-historie";
      container.dataset.frageId = frage.frage_id;

      const badges = frageAnsicht.baueBadges(frage);
      if (badges) container.appendChild(badges);

      const titel = document.createElement("div");
      titel.className = "frage-text";
      titel.textContent = frage.frage_text;

      const titelZeile = document.createElement("div");
      titelZeile.className = "frage-text-zeile";
      titelZeile.appendChild(titel);
      const vorlesenButton = baueVorlesenButton(frage.frage_text);
      if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
      container.appendChild(titelZeile);

      const optionListe = document.createElement("div");
      optionListe.className = "option-liste";

      const optionen = [
        { key: "a", text: frage.option_a },
        { key: "b", text: frage.option_b },
        { key: "c", text: frage.option_c },
      ];

      for (const opt of optionen) {
        const label = document.createElement("label");
        label.className = "option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "historie-frage-" + frage.frage_id;
        radio.value = opt.key;
        radio.addEventListener("change", () => {
          optionListe.querySelectorAll(".option").forEach((el) => el.classList.remove("ausgewaehlt"));
          label.classList.add("ausgewaehlt");
        });

        label.appendChild(radio);
        label.append(opt.text);
        optionListe.appendChild(label);
      }

      container.appendChild(optionListe);

      const absendenButton = document.createElement("button");
      absendenButton.className = "absenden-button";
      absendenButton.textContent = "Antwort abschicken";
      absendenButton.addEventListener("click", () => historieAntwortAbschicken(frage.frage_id, container, absendenButton));
      container.appendChild(absendenButton);

      const feedback = document.createElement("p");
      feedback.className = "feedback";
      // "aria-live" sorgt dafür, dass Screenreader die Auflösung ("Richtig!"/
      // "Leider falsch...") automatisch vorlesen, sobald sie erscheint - ohne
      // das bliebe sie für blinde Nutzer unbemerkt (07.08.2026, WCAG 4.1.3).
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      feedback.hidden = true;
      container.appendChild(feedback);

      return container;
    }

    async function historieAntwortAbschicken(frageId, container, button) {
      const gewaehlt = container.querySelector('input[type="radio"]:checked');
      if (!gewaehlt) {
        zeigeFehler("Bitte erst eine Antwort auswählen.");
        return;
      }
      versteckeFehler();

      button.disabled = true;
      container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

      const { data, error } = await sb.rpc("historie_antwort_abgeben", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
        p_frage_id: frageId,
        p_gegebene_option: gewaehlt.value,
      });

      const feedback = container.querySelector(".feedback");
      feedback.hidden = false;

      if (error) {
        feedback.textContent = "Fehler beim Speichern: " + error.message;
        feedback.classList.add("falsch");
        button.disabled = false;
        container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = false));
        return;
      }

      const ergebnis = data[0];
      if (ergebnis.korrekt) {
        feedback.textContent = "Richtig! ✅";
        feedback.classList.add("richtig");
      } else {
        feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
        feedback.classList.add("falsch");
      }

      feedback.appendChild(document.createElement("br"));
      feedback.appendChild(baueWarumButton(frageId, true));

      historieSessionGesamt += 1;
      if (ergebnis.korrekt) historieSessionRichtig += 1;
      aktualisiereHistorieFortschrittText();
      zeigeHistorieWeiterButton(container, frageId, true);
    }

    function baueHistorieFreitextFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte frage-karte-freitext frage-karte-historie";
      container.dataset.frageId = frage.frage_id;

      const badges = frageAnsicht.baueBadges(frage);
      if (badges) container.appendChild(badges);

      const titel = document.createElement("div");
      titel.className = "frage-text";
      titel.textContent = frage.frage_text;

      const titelZeile = document.createElement("div");
      titelZeile.className = "frage-text-zeile";
      titelZeile.appendChild(titel);
      const vorlesenButton = baueVorlesenButton(frage.frage_text);
      if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
      container.appendChild(titelZeile);

      if (frage.antwort_hinweis) {
        const hinweis = document.createElement("p");
        hinweis.className = "freitext-hinweis";
        hinweis.textContent = frage.antwort_hinweis;
        container.appendChild(hinweis);
      }

      const textarea = document.createElement("textarea");
      textarea.className = "freitext-eingabe";
      textarea.maxLength = freitext.zeichenlimit;
      textarea.rows = 3;
      textarea.placeholder = "Deine Antwort ...";
      container.appendChild(textarea);

      const zaehler = document.createElement("div");
      zaehler.className = "freitext-zaehler";
      zaehler.textContent = "0 / " + freitext.zeichenlimit;
      textarea.addEventListener("input", () => {
        zaehler.textContent = textarea.value.length + " / " + freitext.zeichenlimit;
      });
      container.appendChild(zaehler);

      const absendenButton = document.createElement("button");
      absendenButton.className = "absenden-button";
      absendenButton.textContent = "Antwort abschicken";
      absendenButton.addEventListener("click", () =>
        historieFreitextAntwortAbschicken(frage.frage_id, container, absendenButton, textarea)
      );
      container.appendChild(absendenButton);

      const ladeHinweis = document.createElement("p");
      ladeHinweis.className = "freitext-lade-hinweis";
      ladeHinweis.hidden = true;
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      ladeHinweis.appendChild(spinner);
      ladeHinweis.append(" Einen Moment, deine Antwort wird geprüft ...");
      container.appendChild(ladeHinweis);

      const feedback = document.createElement("div");
      feedback.className = "feedback";
      feedback.hidden = true;
      container.appendChild(feedback);

      return container;
    }

    async function historieFreitextAntwortAbschicken(frageId, container, button, textarea) {
      const freitext = textarea.value.trim();
      if (freitext.length === 0) {
        zeigeFehler("Bitte erst eine Antwort eingeben.");
        return;
      }
      versteckeFehler();

      button.disabled = true;
      textarea.disabled = true;

      const ladeHinweis = container.querySelector(".freitext-lade-hinweis");
      if (ladeHinweis) ladeHinweis.hidden = false;

      let ergebnis;
      try {
        const antwort = await fetch("/api/freitext-bewerten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schiedsrichterId: getZugang().schiedsrichterId,
            frageId,
            pin: getZugang().pin,
            freitext,
            historie: true,
          }),
        });
        ergebnis = await antwort.json();
        if (!antwort.ok) throw new Error(ergebnis.fehler || "Unbekannter Fehler");
      } catch (e) {
        if (ladeHinweis) ladeHinweis.hidden = true;
        const feedback = container.querySelector(".feedback");
        feedback.hidden = false;
        feedback.textContent = "Fehler bei der Auswertung: " + e.message + " - bitte nochmal versuchen.";
        feedback.classList.add("falsch");
        button.disabled = false;
        textarea.disabled = false;
        return;
      }

      if (ladeHinweis) ladeHinweis.hidden = true;

      // Im Üben-Bereich gibt es nur richtig oder falsch - hier kann man dieselbe
      // Frage ohnehin beliebig oft wiederholen, ein zweiter Versuch wäre ohne
      // Wirkung. Der Server klemmt "nachbessern" bereits ab; die Zuweisung hier
      // ist die zweite Sicherung, damit in diesem Bereich niemals eine orange
      // Karte ohne Ergänzungsfeld und ohne Auflösung stehen bleibt.
      ergebnis.status = ergebnis.korrekt ? "richtig" : "falsch";
      ergebnis.teilweise = false;

      const feedback = container.querySelector(".feedback");
      feedback.hidden = false;
      feedback.innerHTML = "";
      feedback.classList.add(ergebnis.korrekt ? "richtig" : "falsch");
      feedback.appendChild(freitext.baueFreitextErgebnisInhalt(ergebnis));
      feedback.appendChild(baueWarumButton(frageId, true));

      historieSessionGesamt += 1;
      if (ergebnis.korrekt) historieSessionRichtig += 1;
      aktualisiereHistorieFortschrittText();
      // Bewusst OHNE automatisches Weiterschalten (anders als bei Multiple
      // Choice) - das KI-Feedback braucht Lesezeit, die sich nicht sinnvoll
      // pauschal timen lässt.
      zeigeHistorieWeiterButton(container, frageId, false);
    }

    function stoppeAutoTimer() {
      if (!historieAutoTimer) return;
      clearTimeout(historieAutoTimer);
      historieAutoTimer = null;
    }

    function zeigeStartButton() {
      historieStartButton.hidden = false;
    }

    return Object.freeze({ stoppeAutoTimer, zeigeStartButton });
  }

  global.SchiriQuizHistoryMode = Object.freeze({ erstelleHistorienModus });
})(globalThis);
