(function stelleWochenQuizBereit(global) {
  "use strict";

  function erstelleWochenQuiz({
    sb,
    getZugang,
    zeigeFehler,
    versteckeFehler,
    frageAnsicht,
    freitext,
    entscheidung,
    baueVideoEinbettungModal,
    baueVorlesenButton,
    baueWarumButton,
    beiQuizFertig,
  }) {
    const fragenListe = document.getElementById("fragen-liste");
    const sammelAbsendenWrap = document.getElementById("sammel-absenden-wrap");
    const sammelAbsendenButton = document.getElementById("sammel-absenden-button");
    const keineFragenHinweis = document.getElementById("keine-fragen-hinweis");
    const fertigHinweis = document.getElementById("fertig-hinweis");
    const naechsteRundeText = document.getElementById("naechste-runde-text");
    const fortschrittWrap = document.getElementById("fortschritt-wrap");
    const fortschrittText = document.getElementById("fortschritt-text");
    const fortschrittProzent = document.getElementById("fortschritt-prozent");
    const fortschrittFill = document.getElementById("fortschritt-fill");
    const fortschrittTrack = fortschrittFill ? fortschrittFill.parentElement : null;

    let gesamtFragenAnzahl = 0;
    let beantworteFragenAnzahl = 0;
    let countdownInterval = null;

    function registriereBeantwortung() {
      beantworteFragenAnzahl += 1;
      aktualisiereFortschritt();
      aktualisiereSammelButtonSichtbarkeit();
      if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
        fertigHinweis.hidden = false;
        beiQuizFertig();
        void zeigeNaechsteRundeCountdown();
      }
    }

    async function ladeFragenUndAntworten() {
      const [fragenErgebnis, antwortenErgebnis] = await Promise.all([
        // Früher die View "fragen_oeffentlich". Die kannte nur eine einzige
        // Wochenzuordnung für alle. Seit dem Mehr-Vereine-Umbau entscheidet der
        // Server anhand des angemeldeten Schiedsrichters, welche Woche gilt -
        // die Sortierung nach Fragennummer kommt gleich mit.
        sb.rpc("wochen_fragen", {
          p_schiedsrichter_id: getZugang().schiedsrichterId,
          p_pin: getZugang().pin,
        }),
        sb.rpc("meine_antworten", {
          p_schiedsrichter_id: getZugang().schiedsrichterId,
          p_pin: getZugang().pin,
        }),
      ]);

      if (fragenErgebnis.error) {
        zeigeFehler("Fragen konnten nicht geladen werden: " + fragenErgebnis.error.message);
        return;
      }

      const fragen = fragenErgebnis.data;

      if (!fragen || fragen.length === 0) {
        keineFragenHinweis.hidden = false;
        fortschrittWrap.hidden = true;
        return;
      }

      // Falls das Nachladen der bisherigen Antworten fehlschlägt, zeigt die Seite
      // trotzdem alle Fragen ganz normal als offen an - kein Blocker fürs Mitmachen.
      const antwortenNachFrageId = new Map();
      if (!antwortenErgebnis.error && antwortenErgebnis.data) {
        for (const eintrag of antwortenErgebnis.data) {
          antwortenNachFrageId.set(eintrag.frage_id, eintrag);
        }
      }

      gesamtFragenAnzahl = fragen.length;
      beantworteFragenAnzahl = 0;

      // Die Icon-/Textlabel-Liste ist dieselbe wie im separaten
      // Entscheidungs-Modus und wird als ES-Modul nur dann geladen, wenn
      // diese Woche wirklich eine strukturierte Entscheidung enthält.
      if (fragen.some((frage) => frage.antworttyp === "entscheidung" || frage.typ === "szenario")) {
        try {
          await entscheidung.bereiteVor();
        } catch (fehler) {
          zeigeFehler("Die Icon-Antworten konnten nicht geladen werden. Bitte lade die Seite neu.");
          console.error("Entscheidungsoptionen konnten nicht geladen werden", fehler);
          return;
        }
      }

      for (const [index, frage] of fragen.entries()) {
        // Feste Anzeigenummer je Frage (07.08.2026, Max' Wunsch "jede Frage
        // bekommt so eine eigene Rangnummer ... F1 ist überall die gleiche
        // Frage"). Sie ergibt sich aus der Reihenfolge, in der die Datenbank
        // die Fragen liefert - und die ist nach der Spalte "position" sortiert,
        // also derselben Reihenfolge wie im Planung-Reiter der App.
        // Seit Migration v75 (11.08.2026) kommt die Nummer fertig vom Server
        // (View "wochen_frage_nummern"), statt hier aus der Listenposition
        // abgeleitet zu werden. Vorher stimmte sie nur zufällig, solange alle
        // Ansichten dieselbe Sortierung hatten - was in der App nicht der Fall
        // war. Der Rückfall auf "Index + 1" bleibt für den Fall, dass die
        // Website noch gegen eine ältere Datenbankversion läuft.
        frage.anzeigeNummer = frage.frage_nummer ?? index + 1;
        const bisherigeAntwort = antwortenNachFrageId.get(frage.id);
        // "video_freitext" wird wie "freitext" behandelt (gleiche KI-Bewertung,
        // gleiche Bau-Funktionen) - der Video-Player wird zusätzlich innerhalb
        // dieser Funktionen gerendert, siehe "baueVideoEinbettung".
        const istFreitext = frage.typ === "freitext" || frage.typ === "video_freitext";
        const istEntscheidung = frage.antworttyp === "entscheidung" || frage.typ === "szenario";
        if (bisherigeAntwort && bisherigeAntwort.beantwortet) {
          beantworteFragenAnzahl += 1;
          fragenListe.appendChild(
            istEntscheidung
              ? entscheidung.baueBeantworteteFrageElement(frage, bisherigeAntwort)
              : istFreitext
              ? freitext.baueBeantworteteFreitextElement(frage, bisherigeAntwort)
              : baueBeantworteteFrageElement(frage, bisherigeAntwort)
          );
        } else {
          fragenListe.appendChild(
            istEntscheidung
              ? entscheidung.baueFrageElement(frage)
              : istFreitext
              ? freitext.baueFreitextFrageElement(frage)
              : baueFrageElement(frage)
          );
        }
      }

      aktualisiereFortschritt();
      aktualisiereSammelButtonSichtbarkeit();

      if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
        fertigHinweis.hidden = false;
        beiQuizFertig();
        zeigeNaechsteRundeCountdown();
      }
    }

    // Der gemeinsame Modal-first-Player für alle Videofragen liegt gekapselt in
    // src/video-player.js. app.js entscheidet nur noch, an welcher Frage er mit
    // welchen Zeit- und Fallbackdaten eingebunden wird.
    function baueFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte";
      container.dataset.frageId = frage.id;

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

      const video = baueVideoEinbettungModal(
        frage.video_url,
        frage.video_start_sekunden,
        frage.video_end_sekunden,
        frage.video_stumm,
        frage.antwort_hinweis
      );
      if (video) container.appendChild(video);

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
        radio.name = "frage-" + frage.id;
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
      absendenButton.addEventListener("click", () => antwortAbschicken(frage.id, container, absendenButton));
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

    function baueBeantworteteFrageElement(frage, antwort) {
      const container = document.createElement("div");
      container.className = "frage-karte beantwortet " + (antwort.korrekt ? "richtig-karte" : "falsch-karte");
      container.dataset.frageId = frage.id;

      const badges = frageAnsicht.baueBadges(frage);
      if (badges) container.appendChild(badges);

      // Das frühere "🔒 Bereits beantwortet"-Etikett ist entfallen (07.08.2026,
      // Max: "das würde ich vielleicht sogar rausnehmen"). Der Zustand ist jetzt
      // am Aussehen der Karte erkennbar - grauer Hintergrund, kein Schatten,
      // blasse Antwortzeilen (siehe ".frage-karte.beantwortet" in style.css).
      // Eine Textzeile, die dasselbe nochmal sagt, kostet nur Platz.

      const titel = document.createElement("div");
      titel.className = "frage-text";
      titel.textContent = frage.frage_text;

      const titelZeile = document.createElement("div");
      titelZeile.className = "frage-text-zeile";
      titelZeile.appendChild(titel);
      const vorlesenButton = baueVorlesenButton(frage.frage_text);
      if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
      container.appendChild(titelZeile);

      const video = baueVideoEinbettungModal(
        frage.video_url,
        frage.video_start_sekunden,
        frage.video_end_sekunden,
        frage.video_stumm,
        frage.antwort_hinweis
      );
      if (video) container.appendChild(video);

      const optionTexte = { a: frage.option_a, b: frage.option_b, c: frage.option_c };

      // Auflösung bei bereits beantworteten Fragen (07.08.2026, überarbeitet):
      // vorher stand hier ein einzelner Fließtext-Satz ("Damals geantwortet: X ·
      // Richtig gewesen wäre: Y"). Jetzt dieselbe farbige Darstellung wie direkt
      // nach dem Abschicken - grün für richtig, rot für die eigene falsche
      // Antwort -, damit man beim Zurückblättern nicht erst lesen muss, um zu
      // erkennen, wie es ausgegangen ist. Die Zeichen ✓/✗ tragen dieselbe
      // Information nochmal ohne Farbe (Farbfehlsichtigkeit).
      const aufloesung = document.createElement("div");
      aufloesung.className = "option-liste beantwortet-aufloesung";

      ["a", "b", "c"].forEach((schluessel) => {
        const text = optionTexte[schluessel];
        if (!text) return;

        const zeile = document.createElement("div");
        zeile.className = "option gesperrt";

        const istRichtige = antwort.richtige_option
          ? schluessel === String(antwort.richtige_option).toLowerCase()
          : antwort.korrekt && schluessel === String(antwort.gegebene_option).toLowerCase();
        const istGewaehlte = schluessel === String(antwort.gegebene_option).toLowerCase();

        zeile.append(text);

        if (istRichtige) {
          zeile.classList.add("ist-richtig");
          zeile.appendChild(marke("\u2713", istGewaehlte ? "Deine Antwort - richtig" : "Richtige Antwort"));
        } else if (istGewaehlte) {
          zeile.classList.add("ist-falsch");
          zeile.appendChild(marke("\u2717", "Deine Antwort - falsch"));
        }

        aufloesung.appendChild(zeile);
      });

      container.appendChild(aufloesung);

      function marke(zeichen, beschreibung) {
        const span = document.createElement("span");
        span.className = "option-marke";
        span.textContent = zeichen;
        span.setAttribute("aria-label", beschreibung);
        span.title = beschreibung;
        return span;
      }
      container.appendChild(baueWarumButton(frage.id, false));

      return container;
    }

    async function antwortAbschicken(frageId, container, button) {
      const gewaehlt = container.querySelector('input[type="radio"]:checked');
      if (!gewaehlt) {
        zeigeFehler("Bitte erst eine Antwort auswählen.");
        return;
      }
      versteckeFehler();

      button.disabled = true;
      container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

      const { data, error } = await sb.rpc("antwort_abgeben", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_frage_id: frageId,
        p_gegebene_option: gewaehlt.value,
        p_pin: getZugang().pin,
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

      // Farbige Auflösung direkt in den Antwortmöglichkeiten (07.08.2026).
      frageAnsicht.loeseOptionenAuf(container, ergebnis.richtige_option, gewaehlt.value);
      container.classList.add("beantwortet", ergebnis.korrekt ? "richtig-karte" : "falsch-karte");

      if (ergebnis.bereits_beantwortet) {
        feedback.textContent =
          "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt: " +
          (ergebnis.korrekt ? "Richtig ✅" : "Falsch (richtig wäre " + ergebnis.richtige_option.toUpperCase() + " gewesen)");
        feedback.classList.add(ergebnis.korrekt ? "richtig" : (ergebnis.teilweise ? "teilweise" : "falsch"));
      } else if (ergebnis.korrekt) {
        feedback.textContent = "Richtig! ✅";
        feedback.classList.add("richtig");
      } else {
        feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
        feedback.classList.add("falsch");
      }

      feedback.appendChild(document.createElement("br"));
      feedback.appendChild(baueWarumButton(frageId, false));

      registriereBeantwortung();
    }

    // Sammel-Button: schickt alle offenen Fragen ab, bei denen schon eine Antwort
    // ausgewählt (aber noch nicht abgeschickt) wurde - vor allem am Desktop praktisch,
    // wo man mehrere Fragen bequem nacheinander anklicken kann, statt jede einzeln
    // abzuschicken. Die einzelnen "Antwort abschicken"-Buttons bleiben trotzdem nutzbar.
    sammelAbsendenButton.addEventListener("click", async () => {
      // Freitext-Karten haben keine Radio-Buttons und werden hier bewusst nicht
      // mit erfasst (eigener "Antwort abschicken"-Button je Karte, wegen der
      // KI-Wartezeit lieber einzeln als im Sammel-Rutsch).
      const offeneMitAuswahl = Array.from(
        fragenListe.querySelectorAll(".frage-karte:not(.beantwortet):not(.frage-karte-freitext):not(.frage-karte-entscheidung)")
      ).filter((karte) => {
        const button = karte.querySelector(".absenden-button");
        return karte.querySelector('input[type="radio"]:checked') && button && !button.disabled;
      });

      if (offeneMitAuswahl.length === 0) {
        zeigeFehler("Bitte wähle zuerst bei mindestens einer offenen Frage eine Antwort aus.");
        return;
      }

      versteckeFehler();
      sammelAbsendenButton.disabled = true;

      for (const karte of offeneMitAuswahl) {
        const frageId = karte.dataset.frageId;
        const button = karte.querySelector(".absenden-button");
        await antwortAbschicken(frageId, karte, button);
      }

      sammelAbsendenButton.disabled = false;
      aktualisiereSammelButtonSichtbarkeit();
    });

    function aktualisiereSammelButtonSichtbarkeit() {
      // "Offen" heißt hier: weder als bereits-beantwortet-Karte gerendert (beim Laden
      // erkannt) NOCH schon in dieser Sitzung abgeschickt (Button dann disabled) -
      // eine Karte, die man gerade eben abgeschickt hat, zählt also nicht mehr mit.
      const offeneAnzahl = Array.from(
        fragenListe.querySelectorAll(".frage-karte:not(.beantwortet):not(.frage-karte-freitext):not(.frage-karte-entscheidung)")
      ).filter((karte) => {
        const button = karte.querySelector(".absenden-button");
        return button && !button.disabled;
      }).length;
      sammelAbsendenWrap.hidden = offeneAnzahl < 2;
    }

    function aktualisiereFortschritt() {
      const prozent = gesamtFragenAnzahl > 0
        ? Math.round((beantworteFragenAnzahl / gesamtFragenAnzahl) * 100)
        : 0;
      fortschrittText.textContent = beantworteFragenAnzahl + " von " + gesamtFragenAnzahl + " beantwortet";
      fortschrittProzent.textContent = prozent + "%";
      fortschrittFill.style.width = prozent + "%";
      if (fortschrittTrack) {
        fortschrittTrack.setAttribute("aria-valuenow", String(prozent));
        fortschrittTrack.setAttribute(
          "aria-valuetext",
          beantworteFragenAnzahl + " von " + gesamtFragenAnzahl + " Fragen beantwortet"
        );
      }
    }

    // Zeigt einen Live-Countdown bis zum Start der nächsten Fragen-Runde (aus der
    // echten DB, keine feste Annahme wie "immer Montag"). Wird nur einmal gestartet,
    // egal ob man schon fertig war beim Laden oder gerade eben fertig geworden ist.
    async function zeigeNaechsteRundeCountdown() {
      if (countdownInterval) return;

      const { data, error } = await sb.rpc("naechste_runde_start");
      if (error || !data || data.length === 0) return;

      const zielZeit = new Date(data[0].startet_am).getTime();
      if (Number.isNaN(zielZeit)) return;

      function formatUndAktualisieren() {
        const restMs = zielZeit - Date.now();
        if (restMs <= 0) {
          naechsteRundeText.textContent = "Die nächste Runde müsste schon da sein - lade die Seite neu.";
          clearInterval(countdownInterval);
          return;
        }
        const tage = Math.floor(restMs / 86400000);
        const stunden = Math.floor((restMs % 86400000) / 3600000);
        const minuten = Math.floor((restMs % 3600000) / 60000);

        let dauer = "";
        if (tage > 0) dauer += tage + (tage === 1 ? " Tag, " : " Tagen, ");
        dauer += stunden + " Std. " + minuten + " Min.";

        naechsteRundeText.replaceChildren("Nächste Fragen in ", Object.assign(document.createElement("strong"), { textContent: dauer }));
      }

      naechsteRundeText.hidden = false;
      formatUndAktualisieren();
      countdownInterval = setInterval(formatUndAktualisieren, 30000);
    }

    return Object.freeze({ ladeFragenUndAntworten, registriereBeantwortung });
  }

  global.SchiriQuizWeeklyQuiz = Object.freeze({ erstelleWochenQuiz });
})(globalThis);
