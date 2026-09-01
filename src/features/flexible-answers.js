(function stelleFlexibleAntwortenBereit(global) {
  "use strict";

  function erstelleFlexibleAntworten({
    sb, getZugang, zeigeFehler, versteckeFehler, frageAnsicht,
    baueVideoEinbettungModal, baueVorlesenButton, baueWarumButton,
    beiWochenfrageBeantwortet,
  }) {
    function kopf(frage, container) {
      const badges = frageAnsicht.baueBadges(frage);
      if (badges) container.appendChild(badges);

      const titel = document.createElement("div");
      titel.className = "frage-text";
      titel.textContent = frage.frage_text;
      const zeile = document.createElement("div");
      zeile.className = "frage-text-zeile";
      zeile.appendChild(titel);
      const vorlesen = baueVorlesenButton(frage.frage_text);
      if (vorlesen) zeile.appendChild(vorlesen);
      container.appendChild(zeile);

      const bild = frageAnsicht.baueFrageBild?.(frage);
      if (bild) container.appendChild(bild);
      const video = baueVideoEinbettungModal(
        frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden,
        frage.video_stumm, frage.antwort_hinweis
      );
      if (video) container.appendChild(video);
    }

    function neueKarte(frage, beantwortet, korrekt) {
      const karte = document.createElement("div");
      karte.className = "frage-karte frage-karte-flex";
      if (beantwortet) {
        karte.classList.add("beantwortet", korrekt ? "richtig-karte" : "falsch-karte");
      }
      karte.dataset.frageId = frage.id;
      kopf(frage, karte);
      return karte;
    }

    function optionen(frage) {
      return Array.isArray(frage.antwortoptionen)
        ? frage.antwortoptionen.filter((option) => option && option.schluessel && option.text)
        : [];
    }

    function baueAuswahl(frage, antwort) {
      const beantwortet = Boolean(antwort?.beantwortet);
      const karte = neueKarte(frage, beantwortet, Boolean(antwort?.korrekt));
      const liste = document.createElement("div");
      liste.className = "option-liste flexible-optionen";
      const mehrfach = frage.antworttyp === "mehrfachauswahl";
      const gewaehlt = new Set(
        Array.isArray(antwort?.gegebene_auswahl)
          ? antwort.gegebene_auswahl
          : antwort?.gegebene_option ? [antwort.gegebene_option] : []
      );
      const richtig = new Set(
        Array.isArray(antwort?.richtige_auswahl)
          ? antwort.richtige_auswahl
          : antwort?.richtige_option ? [antwort.richtige_option] : []
      );

      for (const option of optionen(frage)) {
        const label = document.createElement(beantwortet ? "div" : "label");
        label.className = "option";
        if (!beantwortet) {
          const input = document.createElement("input");
          input.type = mehrfach ? "checkbox" : "radio";
          input.name = "frage-" + frage.id;
          input.value = option.schluessel;
          input.addEventListener("change", () => label.classList.toggle("ausgewaehlt", input.checked));
          label.appendChild(input);
        }
        const text = document.createElement("span");
        text.textContent = option.text;
        label.appendChild(text);

        if (beantwortet) {
          label.classList.add("gesperrt");
          const istRichtig = richtig.has(option.schluessel);
          const istGewaehlte = gewaehlt.has(option.schluessel);
          if (istRichtig) {
            label.classList.add("ist-richtig");
            label.appendChild(marke("✓", istGewaehlte ? "Deine Antwort – richtig" : "Richtige Antwort"));
          } else if (istGewaehlte) {
            label.classList.add("ist-falsch");
            label.appendChild(marke("✗", "Deine Antwort – falsch"));
          }
        }
        liste.appendChild(label);
      }
      karte.appendChild(liste);

      if (beantwortet) {
        karte.appendChild(baueWarumButton(frage.id, false));
        return karte;
      }

      const button = absendenButton();
      button.addEventListener("click", async () => {
        const auswahl = Array.from(liste.querySelectorAll("input:checked"), (input) => input.value);
        if (auswahl.length === 0) {
          zeigeFehler(mehrfach ? "Bitte mindestens eine Antwort auswählen." : "Bitte eine Antwort auswählen.");
          return;
        }
        versteckeFehler();
        button.disabled = true;
        liste.querySelectorAll("input").forEach((input) => (input.disabled = true));
        const { data, error } = await sb.rpc("antwort_auswahl_abgeben", {
          p_schiedsrichter_id: getZugang().schiedsrichterId,
          p_frage_id: frage.id,
          p_auswahl: auswahl,
          p_pin: getZugang().pin,
        });
        if (error) return fehlerZuruecksetzen(karte, liste, button, error.message);
        loeseAuswahlAuf(liste, new Set(data[0].richtige_auswahl || []), new Set(auswahl));
        zeigeErgebnis(karte, frage.id, data[0].korrekt, data[0].bereits_beantwortet);
      });
      karte.appendChild(button);
      karte.appendChild(feedbackFeld());
      return karte;
    }

    function baueZahl(frage, antwort) {
      const beantwortet = Boolean(antwort?.beantwortet);
      const karte = neueKarte(frage, beantwortet, Boolean(antwort?.korrekt));
      const einheiten = Array.isArray(frage.zahl_einheiten)
        ? frage.zahl_einheiten.map((eintrag) => eintrag.einheit).filter(Boolean)
        : [];

      if (beantwortet) {
        const ergebnis = document.createElement("div");
        ergebnis.className = "zahl-aufloesung";
        const eigene = document.createElement("p");
        eigene.textContent = `Deine Antwort: ${formatZahl(antwort.gegebene_zahl)} ${antwort.gegebene_einheit || ""}`.trim();
        ergebnis.appendChild(eigene);
        if (Array.isArray(antwort.richtige_zahlen)) {
          const korrekt = document.createElement("p");
          korrekt.textContent = "Richtig: " + antwort.richtige_zahlen
            .map((wert) => `${formatZahl(wert.wert)} ${wert.einheit}`)
            .join(" oder ");
          ergebnis.appendChild(korrekt);
        }
        karte.appendChild(ergebnis);
        karte.appendChild(baueWarumButton(frage.id, false));
        return karte;
      }

      const zeile = document.createElement("div");
      zeile.className = "zahl-eingabe-zeile";
      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.placeholder = "Zahl";
      input.setAttribute("aria-label", "Zahlenwert");
      const einheit = document.createElement("select");
      einheit.setAttribute("aria-label", "Einheit");
      for (const wert of einheiten) {
        const option = document.createElement("option");
        option.value = wert;
        option.textContent = wert;
        einheit.appendChild(option);
      }
      zeile.append(input, einheit);
      karte.appendChild(zeile);

      const button = absendenButton();
      button.addEventListener("click", async () => {
        const wert = Number(input.value.trim().replace(",", "."));
        if (!Number.isFinite(wert) || !einheit.value) {
          zeigeFehler("Bitte eine gültige Zahl und Einheit eingeben.");
          return;
        }
        versteckeFehler();
        button.disabled = input.disabled = einheit.disabled = true;
        const { data, error } = await sb.rpc("antwort_zahl_abgeben", {
          p_schiedsrichter_id: getZugang().schiedsrichterId,
          p_frage_id: frage.id,
          p_wert: wert,
          p_einheit: einheit.value,
          p_pin: getZugang().pin,
        });
        if (error) {
          button.disabled = input.disabled = einheit.disabled = false;
          return fehlerZuruecksetzen(karte, zeile, button, error.message);
        }
        const korrekt = data[0].korrekt;
        const loesung = (data[0].richtige_antworten || [])
          .map((item) => `${formatZahl(item.wert)} ${item.einheit}`).join(" oder ");
        zeigeErgebnis(karte, frage.id, korrekt, data[0].bereits_beantwortet,
          korrekt ? null : `Richtig wäre: ${loesung}`);
      });
      karte.appendChild(button);
      karte.appendChild(feedbackFeld());
      return karte;
    }

    function baueFrageElement(frage) {
      return frage.antworttyp === "zahl" ? baueZahl(frage, null) : baueAuswahl(frage, null);
    }

    function baueBeantworteteFrageElement(frage, antwort) {
      return frage.antworttyp === "zahl" ? baueZahl(frage, antwort) : baueAuswahl(frage, antwort);
    }

    function absendenButton() {
      const button = document.createElement("button");
      button.className = "absenden-button";
      button.textContent = "Antwort abschicken";
      return button;
    }

    function feedbackFeld() {
      const feld = document.createElement("div");
      feld.className = "feedback";
      feld.hidden = true;
      feld.setAttribute("role", "status");
      feld.setAttribute("aria-live", "polite");
      return feld;
    }

    function fehlerZuruecksetzen(karte, bereich, button, text) {
      zeigeFehler("Antwort konnte nicht gespeichert werden: " + text);
      button.disabled = false;
      bereich.querySelectorAll("input, select").forEach((feld) => (feld.disabled = false));
      const feedback = karte.querySelector(".feedback");
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = "Bitte versuche es noch einmal.";
        feedback.className = "feedback falsch";
      }
    }

    function loeseAuswahlAuf(liste, richtig, gewaehlt) {
      liste.querySelectorAll(".option").forEach((label) => {
        const input = label.querySelector("input");
        if (!input) return;
        label.classList.add("gesperrt");
        label.classList.remove("ausgewaehlt");
        if (richtig.has(input.value)) {
          label.classList.add("ist-richtig");
          label.appendChild(marke("✓", gewaehlt.has(input.value) ? "Deine Antwort – richtig" : "Richtige Antwort"));
        } else if (gewaehlt.has(input.value)) {
          label.classList.add("ist-falsch");
          label.appendChild(marke("✗", "Deine Antwort – falsch"));
        }
      });
    }

    function marke(zeichen, beschreibung) {
      const span = document.createElement("span");
      span.className = "option-marke";
      span.textContent = zeichen;
      span.setAttribute("aria-label", beschreibung);
      span.title = beschreibung;
      return span;
    }

    function zeigeErgebnis(karte, frageId, korrekt, bereits, zusatz) {
      karte.classList.add("beantwortet", korrekt ? "richtig-karte" : "falsch-karte");
      const feedback = karte.querySelector(".feedback");
      feedback.hidden = false;
      feedback.className = "feedback " + (korrekt ? "richtig" : "falsch");
      feedback.textContent = bereits
        ? `Diese Frage hattest du schon beantwortet – dein erstes Ergebnis zählt: ${korrekt ? "Richtig ✅" : "Falsch"}`
        : korrekt ? "Richtig! ✅" : "Leider falsch.";
      if (zusatz) feedback.append(document.createElement("br"), zusatz);
      feedback.append(document.createElement("br"), baueWarumButton(frageId, false));
      beiWochenfrageBeantwortet();
    }

    function formatZahl(wert) {
      const zahl = Number(wert);
      return Number.isFinite(zahl)
        ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(zahl)
        : String(wert ?? "");
    }

    return Object.freeze({ baueFrageElement, baueBeantworteteFrageElement });
  }

  global.SchiriQuizFlexibleAnswers = Object.freeze({ erstelleFlexibleAntworten });
})(globalThis);
