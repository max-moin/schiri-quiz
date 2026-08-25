(function stelleFreitextAntwortenBereit(global) {
  "use strict";

  function erstelleFreitextAntworten({
    getZugang,
    zeigeFehler,
    versteckeFehler,
    frageAnsicht,
    baueVideoEinbettungModal,
    baueVorlesenButton,
    baueWarumButton,
    freitextStatus,
    beiWochenfrageBeantwortet,
  }) {
    // ============================================================
    // Freitext-Fragen mit KI-Auswertung (10.07.2026)
    // ============================================================
    const FREITEXT_ZEICHENLIMIT = 400;

    function baueFreitextFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte frage-karte-freitext";
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

      if (frage.antwort_hinweis && !frage.video_url) {
        const hinweis = document.createElement("p");
        hinweis.className = "freitext-hinweis";
        hinweis.textContent = frage.antwort_hinweis;
        container.appendChild(hinweis);
      }

      const textarea = document.createElement("textarea");
      textarea.className = "freitext-eingabe";
      textarea.maxLength = FREITEXT_ZEICHENLIMIT;
      textarea.rows = 3;
      textarea.placeholder = "Deine Antwort ...";
      container.appendChild(textarea);

      const zaehler = document.createElement("div");
      zaehler.className = "freitext-zaehler";
      zaehler.textContent = "0 / " + FREITEXT_ZEICHENLIMIT;
      textarea.addEventListener("input", () => {
        zaehler.textContent = textarea.value.length + " / " + FREITEXT_ZEICHENLIMIT;
      });
      container.appendChild(zaehler);

      const absendenButton = document.createElement("button");
      absendenButton.className = "absenden-button";
      absendenButton.textContent = "Antwort abschicken";
      absendenButton.addEventListener("click", () =>
        freitextAntwortAbschicken(frage.id, container, absendenButton, textarea)
      );
      container.appendChild(absendenButton);

      // Lade-Hinweis: erscheint erst beim Absenden (nicht vorher!). Wichtig für
      // Freitext, weil die Auswertung ein paar Sekunden dauert (anders als bei
      // Multiple Choice, wo die Rückmeldung sofort da ist) - ohne diesen Hinweis
      // würden ungeduldige Nutzer:innen vermutlich mehrfach auf den Button
      // klicken. Bewusst ohne "KI"-Erwähnung im Text (Max' Feedback: die
      // KI-Anbindung soll im Hintergrund bleiben, nicht ständig betont werden).
      const ladeHinweis = document.createElement("p");
      ladeHinweis.className = "freitext-lade-hinweis";
      ladeHinweis.hidden = true;
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      ladeHinweis.appendChild(spinner);
      ladeHinweis.append(" Einen Moment, deine Antwort wird geprüft ...");
      container.appendChild(ladeHinweis);

      // Als <div> statt <p> angelegt, weil hier gleich mehrere <p>-Zeilen
      // (Kopf/Musterantwort/KI-Feedback) reingehängt werden - ein <p> darf laut
      // HTML-Spec kein Block-Element wie ein weiteres <p> enthalten.
      const feedback = document.createElement("div");
      feedback.className = "feedback";
      feedback.hidden = true;
      container.appendChild(feedback);

      return container;
    }

    // Baut den Ergebnis-Inhalt für eine Freitext-Antwort - fest formuliert
    // ("Antwort korrekt"/"Antwort nicht korrekt" + die tatsächliche Musterantwort
    // wortwörtlich), die freie KI-Formulierung kommt nur noch als zusätzliche,
    // kleiner gesetzte Zeile dazu. Max' Feedback nach dem ersten Test: die
    // bisherige, komplett KI-generierte Formulierung wirkte zu variabel/informell -
    // die feste Musterantwort sorgt dafür, dass die eigentlich richtige Antwort
    // (z.B. "Gelbe Karte") immer exakt und gleich dargestellt wird.
    // Aus dem früheren Booleanpaar (korrekt + teilweise) ist ein Status
    // geworden. Diese Funktion liest ihn aus allem, was ankommen kann: der
    // Antwort des Endpunkts (status), der Zeile aus meine_antworten
    // (bewertungsstatus / nachbesserung_offen) und - als letzte Rückfallebene -
    // den alten Feldern. So macht eine noch nicht neu geladene Seite nichts
    // kaputt.
    function baueFreitextErgebnisInhalt(ergebnis) {
      const wrap = document.createElement("div");
      const status = freitextStatus(ergebnis);

      // Drei Stufen statt zwei (07.08.2026, Max' Wunsch): wer den Grundgedanken
      // richtig hatte und nur ein gefordertes Element vergessen hat, bekommt eine
      // orange "fast"-Rückmeldung statt derselben roten Ablehnung wie jemand, der
      // inhaltlich danebenlag ("das verwirrt ja auch, wenn man den Grundgedanken
      // eigentlich schon verstanden hat"). Gewertet wird eine Teilantwort
      // weiterhin als nicht bestanden - die Stufe ist reine Rückmeldung.
      const kopf = document.createElement("p");
      kopf.className = "freitext-ergebnis-kopf";
      if (status === "richtig") {
        kopf.textContent = "Antwort korrekt ✅";
      } else if (status === "nachbessern") {
        kopf.textContent = "Fast! Da fehlt noch ein Punkt 🟠";
        kopf.classList.add("teilweise");
      } else {
        kopf.textContent = "Antwort nicht korrekt";
      }
      wrap.appendChild(kopf);

      // Solange eine Ergänzung offen ist, wird die Lösung NICHT gezeigt - sonst
      // wäre die Nachfrage sinnlos. Der Server liefert sie in dem Fall ohnehin
      // gar nicht erst mit; die Bedingung hier ist die zweite Sicherung.
      if (status !== "nachbessern" && ergebnis.musterantwort) {
        const musterZeile = document.createElement("p");
        musterZeile.className = "freitext-ergebnis-muster";
        musterZeile.textContent = "Richtige Antwort: " + ergebnis.musterantwort;
        wrap.appendChild(musterZeile);
      }

      if (ergebnis.ki_feedback) {
        const kiZeile = document.createElement("p");
        kiZeile.className = "freitext-ergebnis-ki";
        kiZeile.textContent = ergebnis.ki_feedback;
        wrap.appendChild(kiZeile);
      }

      return wrap;
    }

    // ============================================================
    // Zweiter Versuch bei orange (11.08.2026)
    //
    // Wer den Kern getroffen, aber einen zwingenden Punkt vergessen hat, bekommt
    // GENAU EINE Ergänzung. Die Lösung wird dabei bewusst nicht gezeigt - nur
    // eine gezielte Rückfrage, die zum fehlenden Punkt hinführt.
    //
    // Wichtig für die Erwartung: eine offene Ergänzung zählt in der Auswertung
    // bereits als beantwortet. Wer sie liegen lässt, hat die Frage falsch. Das
    // steht deshalb ausdrücklich auf der Karte und wird nicht weggelächelt.
    // ============================================================
    function baueErgaenzungsBereich(frageId, nachfrage) {
      const wrap = document.createElement("div");
      wrap.className = "freitext-ergaenzung";

      const frageZeile = document.createElement("p");
      frageZeile.className = "freitext-nachfrage";
      frageZeile.textContent = nachfrage || "Begründe bitte noch kurz, warum du so entscheidest.";
      wrap.appendChild(frageZeile);

      const hinweis = document.createElement("p");
      hinweis.className = "freitext-ergaenzung-hinweis";
      hinweis.textContent =
        "Du hast genau eine Ergänzung. Schickst du sie nicht ab, bleibt die Frage als falsch stehen.";
      wrap.appendChild(hinweis);

      const textarea = document.createElement("textarea");
      textarea.className = "freitext-eingabe";
      textarea.maxLength = FREITEXT_ZEICHENLIMIT;
      textarea.rows = 3;
      textarea.placeholder = "Deine Ergänzung ...";
      wrap.appendChild(textarea);

      const zaehler = document.createElement("div");
      zaehler.className = "freitext-zaehler";
      zaehler.textContent = "0 / " + FREITEXT_ZEICHENLIMIT;
      textarea.addEventListener("input", () => {
        zaehler.textContent = textarea.value.length + " / " + FREITEXT_ZEICHENLIMIT;
      });
      wrap.appendChild(zaehler);

      const button = document.createElement("button");
      button.className = "absenden-button";
      button.textContent = "Antwort ergänzen";
      button.addEventListener("click", () => freitextErgaenzungAbschicken(frageId, wrap, button, textarea));
      wrap.appendChild(button);

      const ladeHinweis = document.createElement("p");
      ladeHinweis.className = "freitext-lade-hinweis";
      ladeHinweis.hidden = true;
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      ladeHinweis.appendChild(spinner);
      ladeHinweis.append(" Einen Moment, deine Ergänzung wird geprüft ...");
      wrap.appendChild(ladeHinweis);

      return wrap;
    }

    async function freitextErgaenzungAbschicken(frageId, wrap, button, textarea) {
      const ergaenzung = textarea.value.trim();
      if (ergaenzung.length === 0) {
        zeigeFehler("Bitte erst eine Ergänzung eingeben.");
        return;
      }
      versteckeFehler();

      button.disabled = true;
      textarea.disabled = true;
      const ladeHinweis = wrap.querySelector(".freitext-lade-hinweis");
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
            freitext: ergaenzung,
            modus: "nachbesserung",
          }),
        });
        ergebnis = await antwort.json();
        if (!antwort.ok) throw new Error(ergebnis.fehler || "Unbekannter Fehler");
      } catch (e) {
        if (ladeHinweis) ladeHinweis.hidden = true;
        // Sonderfall: Die Ergänzung wurde gespeichert, aber die Antwort kam nicht
        // mehr an (Verbindungsabbruch). Ein erneuter Klick liefert dann immer
        // dieselbe Absage. Statt die Person in dieser Schleife zu lassen, hier
        // klar sagen, was zu tun ist.
        const schonGespeichert = /keine Ergänzung mehr offen/i.test(e.message || "");
        zeigeFehler(
          schonGespeichert
            ? "Deine Ergänzung ist schon angekommen. Lade die Seite neu, dann siehst du das Ergebnis."
            : "Ergänzung konnte nicht geprüft werden: " + e.message + " - bitte nochmal versuchen."
        );
        if (!schonGespeichert) {
          button.disabled = false;
          textarea.disabled = false;
        }
        return;
      }

      const status = freitextStatus(ergebnis);
      const karte = wrap.closest(".frage-karte");

      // Der Ergänzungsblock wird durch das Endergebnis ersetzt. Die eigene
      // Ergänzung bleibt dabei sichtbar - die Person soll nachvollziehen können,
      // worauf sich die Bewertung bezieht.
      wrap.innerHTML = "";
      wrap.classList.add("abgeschlossen");

      const eigene = document.createElement("p");
      eigene.className = "freitext-eigene-antwort";
      eigene.textContent = "Deine Ergänzung: " + ergaenzung;
      wrap.appendChild(eigene);

      const ergebnisWrap = document.createElement("div");
      ergebnisWrap.className = "beantwortet-ergebnis " + (status === "richtig" ? "richtig" : "falsch");
      ergebnisWrap.appendChild(baueFreitextErgebnisInhalt(ergebnis));
      wrap.appendChild(ergebnisWrap);
      wrap.appendChild(baueWarumButton(frageId, false));

      if (karte) {
        karte.classList.remove("teilweise-karte");
        karte.classList.add("beantwortet", status === "richtig" ? "richtig-karte" : "falsch-karte");

        const tag = karte.querySelector(".beantwortet-tag");
        if (tag) {
          tag.classList.remove("teilweise");
          tag.textContent = "🔒 Bereits beantwortet";
        }

        // Der orange Zwischenstand von vorhin muss weg - sonst stünde direkt
        // über dem Endergebnis weiterhin "Fast! Da fehlt noch ein Punkt" und
        // darunter der feste Zwischensatz "Der Kern stimmt - ein Punkt fehlt
        // noch.", was einem roten Endergebnis offen widerspricht.
        karte.querySelectorAll(".beantwortet-ergebnis.teilweise, .feedback.teilweise").forEach((alt) => {
          if (alt === wrap || wrap.contains(alt)) return;
          alt.classList.remove("teilweise");
          alt.querySelectorAll(".freitext-ergebnis-kopf, .freitext-ergebnis-ki").forEach((zeile) => zeile.remove());
        });
      }
    }

    function baueBeantworteteFreitextElement(frage, antwort) {
      const status = freitextStatus(antwort);
      const wartetAufErgaenzung = status === "nachbessern";

      const container = document.createElement("div");
      container.className =
        "frage-karte beantwortet frage-karte-freitext " +
        (wartetAufErgaenzung ? "teilweise-karte" : status === "richtig" ? "richtig-karte" : "falsch-karte");
      container.dataset.frageId = frage.id;

      const badges = frageAnsicht.baueBadges(frage);
      if (badges) container.appendChild(badges);

      const tag = document.createElement("div");
      tag.className = wartetAufErgaenzung ? "beantwortet-tag teilweise" : "beantwortet-tag";
      tag.textContent = wartetAufErgaenzung ? "🟠 Wartet auf deine Ergänzung" : "🔒 Bereits beantwortet";
      container.appendChild(tag);

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

      const deineAntwort = document.createElement("p");
      deineAntwort.className = "freitext-eigene-antwort";
      deineAntwort.textContent = "Deine Antwort: " + (antwort.gegebener_freitext || "");
      container.appendChild(deineAntwort);

      // Beim abgeschlossenen zweiten Versuch stehen beide Texte in der Reihenfolge
      // da, in der sie entstanden sind - erst die Antwort, dann die Ergänzung,
      // dann das Ergebnis, das sich auf beides zusammen bezieht.
      if (!wartetAufErgaenzung && antwort.zweiter_freitext) {
        const ergaenzung = document.createElement("p");
        ergaenzung.className = "freitext-eigene-antwort";
        ergaenzung.textContent = "Deine Ergänzung: " + antwort.zweiter_freitext;
        container.appendChild(ergaenzung);
      }

      const ergebnisWrap = document.createElement("div");
      ergebnisWrap.className =
        "beantwortet-ergebnis " + (status === "richtig" ? "richtig" : wartetAufErgaenzung ? "teilweise" : "falsch");
      ergebnisWrap.appendChild(baueFreitextErgebnisInhalt(antwort));
      container.appendChild(ergebnisWrap);

      if (wartetAufErgaenzung) {
        // Nach einem Neuladen steht der orange Zustand vollständig wieder da:
        // erste Antwort, gespeicherte Rückfrage, leeres Ergänzungsfeld.
        container.appendChild(baueErgaenzungsBereich(frage.id, antwort.ki_nachfrage));
        return container;
      }

      container.appendChild(baueWarumButton(frage.id, false));

      return container;
    }

    async function freitextAntwortAbschicken(frageId, container, button, textarea) {
      const freitext = textarea.value.trim();
      if (freitext.length === 0) {
        zeigeFehler("Bitte erst eine Antwort eingeben.");
        return;
      }
      versteckeFehler();

      // Button UND Textfeld sperren, solange die KI-Bewertung läuft - verhindert
      // Doppel-Absenden durch ungeduldiges Mehrfachklicken (Max' ausdrücklicher
      // Wunsch nach dem ersten Live-Test).
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

      const status = freitextStatus(ergebnis);
      const wartetAufErgaenzung = status === "nachbessern";

      const feedback = container.querySelector(".feedback");
      feedback.hidden = false;
      feedback.innerHTML = "";
      feedback.classList.add(status === "richtig" ? "richtig" : wartetAufErgaenzung ? "teilweise" : "falsch");

      if (ergebnis.bereits_beantwortet) {
        const hinweisZeile = document.createElement("p");
        hinweisZeile.className = "freitext-ergebnis-hinweis";
        hinweisZeile.textContent = "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt:";
        feedback.appendChild(hinweisZeile);
      }
      feedback.appendChild(baueFreitextErgebnisInhalt(ergebnis));

      if (wartetAufErgaenzung) {
        // Kein "Warum?"-Button, solange die Ergänzung offen ist - der würde die
        // Auflösung liefern, nach der hier gerade gefragt wird.
        container.classList.add("teilweise-karte");
        feedback.appendChild(baueErgaenzungsBereich(frageId, ergebnis.ki_nachfrage));
      } else {
        feedback.appendChild(baueWarumButton(frageId, false));
      }

      // Auch eine offene Ergänzung zählt als beantwortet. Das ist bewusst so:
      // In der Auswertung ist die Frage damit erledigt, und wer nicht ergänzt,
      // hat sie falsch. Der Hinweistext auf der Karte sagt das auch so.
      beiWochenfrageBeantwortet();
    }

    return Object.freeze({
      zeichenlimit: FREITEXT_ZEICHENLIMIT,
      baueFreitextErgebnisInhalt,
      baueFreitextFrageElement,
      baueBeantworteteFreitextElement,
    });
  }

  global.SchiriQuizFreetextAnswers = Object.freeze({ erstelleFreitextAntworten });
})(globalThis);
