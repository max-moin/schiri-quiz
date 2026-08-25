(function stelleGastmodusBereit(global) {
  "use strict";

  const INTERESSE_TRIGGER_ANZAHL = 3;

  function erstelleGastmodus({
    sb,
    zeigeFehler,
    versteckeFehler,
    loeseOptionenAuf,
    beiVerlassen,
  }) {
    const nameEingabe = document.getElementById("gast-name-eingabe");
    const quizSchritt = document.getElementById("gast-quiz-schritt");
    const nameAnzeige = document.getElementById("gast-name-anzeige");
    const fortschrittAnzeige = document.getElementById("gast-fortschritt-anzeige");
    const frageBereich = document.getElementById("gast-frage-bereich");
    const verlassenButton = document.getElementById("gast-verlassen-button");
    const nameSchritt = document.getElementById("name-schritt");

    const interesseOverlay = document.getElementById("interesse-overlay");
    const interesseJaButton = document.getElementById("interesse-ja-button");
    const interesseNeinButton = document.getElementById("interesse-nein-button");
    const interesseNeinOverlay = document.getElementById("interesse-nein-overlay");
    const interesseNeinSchliessenButton = document.getElementById("interesse-nein-schliessen-button");
    const formularOverlay = document.getElementById("interessenten-formular-overlay");
    const formularInhalt = document.getElementById("interessenten-formular-inhalt");
    const formularErfolg = document.getElementById("interessenten-formular-erfolg");
    const emailEingabe = document.getElementById("interessent-email-eingabe");
    const absendenButton = document.getElementById("interessent-absenden-button");
    const formularSchliessenButton = document.getElementById("interessenten-formular-schliessen-button");

    let name = null;
    let fragenPool = [];
    let frageIndex = 0;
    let beantwortetAnzahl = 0;
    let richtigAnzahl = 0;
    let interessePopupGezeigt = false;

    function istStartbereit() {
      return Boolean(nameEingabe && nameEingabe.value.trim());
    }

    function aktualisiereFortschritt() {
      if (!fortschrittAnzeige) return;
      fortschrittAnzeige.textContent = richtigAnzahl + " von " + beantwortetAnzahl + " richtig";
    }

    function baueFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte";
      container.dataset.frageId = frage.frage_id;

      const titel = document.createElement("div");
      titel.className = "frage-text";
      titel.textContent = frage.frage_text;
      const titelZeile = document.createElement("div");
      titelZeile.className = "frage-text-zeile";
      titelZeile.appendChild(titel);
      container.appendChild(titelZeile);

      const optionListe = document.createElement("div");
      optionListe.className = "option-liste";
      const optionen = [
        { key: "a", text: frage.option_a },
        { key: "b", text: frage.option_b },
        { key: "c", text: frage.option_c },
      ];

      for (const option of optionen) {
        if (!option.text) continue;
        const label = document.createElement("label");
        label.className = "option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "gast-frage-" + frage.frage_id;
        radio.value = option.key;
        radio.addEventListener("change", () => {
          optionListe.querySelectorAll(".option").forEach((element) => element.classList.remove("ausgewaehlt"));
          label.classList.add("ausgewaehlt");
        });
        label.append(radio, option.text);
        optionListe.appendChild(label);
      }
      container.appendChild(optionListe);

      const antwortButton = document.createElement("button");
      antwortButton.className = "absenden-button";
      antwortButton.textContent = "Antwort abschicken";
      antwortButton.addEventListener("click", () => antwortAbschicken(frage.frage_id, container, antwortButton));
      container.appendChild(antwortButton);

      const feedback = document.createElement("p");
      feedback.className = "feedback";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      feedback.hidden = true;
      container.appendChild(feedback);
      return container;
    }

    function zeigeNaechsteFrage() {
      frageBereich.replaceChildren();
      if (fragenPool.length === 0) {
        const hinweis = document.createElement("p");
        hinweis.className = "hinweis card";
        hinweis.textContent =
          "Für den Gast-Modus sind momentan noch keine Fragen freigeschaltet. Du kannst später wiederkommen oder den Gast-Modus verlassen.";
        frageBereich.appendChild(hinweis);
        return;
      }
      if (frageIndex >= fragenPool.length) {
        const hinweis = document.createElement("p");
        hinweis.className = "hinweis card";
        hinweis.textContent = "Das waren erstmal alle Fragen – danke fürs Ausprobieren! 🎉";
        frageBereich.appendChild(hinweis);
        return;
      }
      frageBereich.appendChild(baueFrageElement(fragenPool[frageIndex]));
    }

    async function antwortAbschicken(frageId, container, button) {
      const gewaehlt = container.querySelector('input[type="radio"]:checked');
      if (!gewaehlt) {
        zeigeFehler("Bitte erst eine Antwort auswählen.");
        return;
      }
      versteckeFehler();
      button.disabled = true;
      container.querySelectorAll('input[type="radio"]').forEach((radio) => (radio.disabled = true));

      const { data, error } = await sb.rpc("gast_antwort_pruefen", {
        p_frage_id: frageId,
        p_option: gewaehlt.value,
      });
      const feedback = container.querySelector(".feedback");
      feedback.hidden = false;

      if (error || !data || !data[0]) {
        feedback.textContent = "Antwort konnte nicht geprüft werden" + (error ? ": " + error.message : ".");
        feedback.classList.add("falsch");
        button.disabled = false;
        container.querySelectorAll('input[type="radio"]').forEach((radio) => (radio.disabled = false));
        return;
      }

      const ergebnis = data[0];
      loeseOptionenAuf(container, ergebnis.richtige_option, gewaehlt.value);
      container.classList.add("beantwortet", ergebnis.korrekt ? "richtig-karte" : "falsch-karte");
      beantwortetAnzahl += 1;
      if (ergebnis.korrekt) {
        richtigAnzahl += 1;
        feedback.textContent = "Richtig! ✅";
        feedback.classList.add("richtig");
      } else {
        feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
        feedback.classList.add("falsch");
      }
      aktualisiereFortschritt();

      const weiterButton = document.createElement("button");
      weiterButton.className = "historie-weiter-button";
      weiterButton.type = "button";
      weiterButton.textContent = "Nächste Frage →";
      weiterButton.addEventListener("click", () => {
        frageIndex += 1;
        zeigeNaechsteFrage();
      });
      container.appendChild(weiterButton);

      if (beantwortetAnzahl === INTERESSE_TRIGGER_ANZAHL && !interessePopupGezeigt) {
        interessePopupGezeigt = true;
        interesseOverlay.hidden = false;
      }
    }

    async function starte() {
      versteckeFehler();
      const eingegebenerName = nameEingabe.value.trim();
      if (!eingegebenerName) return;

      name = eingegebenerName;
      beantwortetAnzahl = 0;
      richtigAnzahl = 0;
      frageIndex = 0;
      interessePopupGezeigt = false;
      nameSchritt.hidden = true;
      quizSchritt.hidden = false;
      nameAnzeige.textContent = name;
      aktualisiereFortschritt();

      const { data, error } = await sb.rpc("gast_fragen_liste");
      if (error) {
        zeigeFehler("Fragen konnten nicht geladen werden: " + error.message);
        return;
      }
      fragenPool = data || [];
      frageIndex = 0;
      zeigeNaechsteFrage();
    }

    function zuruecksetzen() {
      quizSchritt.hidden = true;
      frageBereich.replaceChildren();
      name = null;
      fragenPool = [];
      frageIndex = 0;
      beantwortetAnzahl = 0;
      richtigAnzahl = 0;
      interessePopupGezeigt = false;
      nameEingabe.value = "";
      nameSchritt.hidden = false;
      if (typeof beiVerlassen === "function") beiVerlassen();
    }

    function schliesseInteressePopup() {
      interesseOverlay.hidden = true;
    }

    function schliesseNeinOverlay() {
      interesseNeinOverlay.hidden = true;
    }

    function schliesseFormular() {
      formularOverlay.hidden = true;
    }

    verlassenButton.addEventListener("click", zuruecksetzen);
    interesseNeinButton.addEventListener("click", () => {
      schliesseInteressePopup();
      interesseNeinOverlay.hidden = false;
    });
    interesseOverlay.addEventListener("click", (ereignis) => {
      if (ereignis.target === interesseOverlay) schliesseInteressePopup();
    });
    interesseNeinSchliessenButton.addEventListener("click", schliesseNeinOverlay);
    interesseNeinOverlay.addEventListener("click", (ereignis) => {
      if (ereignis.target === interesseNeinOverlay) schliesseNeinOverlay();
    });
    interesseJaButton.addEventListener("click", () => {
      schliesseInteressePopup();
      formularInhalt.hidden = false;
      formularErfolg.hidden = true;
      emailEingabe.value = "";
      formularOverlay.hidden = false;
    });
    formularSchliessenButton.addEventListener("click", schliesseFormular);
    formularOverlay.addEventListener("click", (ereignis) => {
      if (ereignis.target === formularOverlay) schliesseFormular();
    });
    absendenButton.addEventListener("click", async () => {
      absendenButton.disabled = true;
      const email = emailEingabe.value.trim();
      const { error } = await sb.rpc("gast_interesse_melden", {
        p_gast_name: name || "Gast",
        p_email: email || null,
      });
      absendenButton.disabled = false;
      if (error) {
        zeigeFehler("Konnte leider nicht gespeichert werden: " + error.message);
        return;
      }
      formularInhalt.hidden = true;
      formularErfolg.hidden = false;
    });

    document.addEventListener("keydown", (ereignis) => {
      if (ereignis.key !== "Escape") return;
      if (!interesseOverlay.hidden) schliesseInteressePopup();
      if (!interesseNeinOverlay.hidden) schliesseNeinOverlay();
      if (!formularOverlay.hidden) schliesseFormular();
    });

    return Object.freeze({ istStartbereit, starte });
  }

  global.SchiriQuizGuestMode = Object.freeze({ erstelleGastmodus });
})(globalThis);
