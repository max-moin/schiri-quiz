(function stelleEntscheidungsAntwortenBereit(global) {
  "use strict";

  const ORTE = [
    "Ort des Vergehens",
    "Wo der Ball zuletzt gespielt wurde",
    "Nächster Punkt auf der Seitenlinie",
    "Torraumlinie",
    "Strafstoßmarke",
    "Mittelpunkt",
  ];

  function erstelleEntscheidungsAntworten({
    getZugang, zeigeFehler, versteckeFehler, frageAnsicht,
    baueVideoEinbettungModal, baueVorlesenButton, baueWarumButton,
    beiWochenfrageBeantwortet,
  }) {
    let optionen = null;

    async function bereiteVor() {
      if (!optionen) optionen = await import("../website/entscheidungs-optionen.js");
      return optionen;
    }

    // ============================================================
    //  Was verlangt diese Frage ueberhaupt? (v101/v102)
    // ============================================================
    //  Max am 31.08.2026: "Dass man das alles selektieren kann und sagen
    //  kann: die Antwortoptionen, die musst du nicht mit angeben."
    //
    //  Die Schalter kommen mit wochen_fragen aus der Datenbank. Fehlen
    //  sie (aeltere Datenbank oder eine Frage ohne Icon-Loesung), gilt
    //  der alte Zustand: alles verlangt. Lieber zu streng als
    //  stillschweigend nachlaessig - eine zu strenge Oberflaeche faellt
    //  sofort auf, eine zu lasche erst bei der Auswertung.
    function verlangt(frage, name) {
      return frage?.[name] !== false;
    }

    // Die Trikotfarben sind Darstellung, keine Antwort. Aus, wenn die
    // Frage keine Farben nennt - dann steht dort nur "Heim" und "Gast".
    function zeigtTrikotfarben(frage) {
      return frage?.zeigt_trikotfarben !== false;
    }

    function neueWahl() {
      return {
        spielfortsetzung: null,
        fortsetzung_fuer: null,
        fortsetzung_ort: "",
        persoenliche_strafe: null,
        strafe_fuer_mannschaft: null,
        strafe_fuer_rolle: "feldspieler",
        strafe_rueckennummer: null,
      };
    }

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
      const video = baueVideoEinbettungModal(
        frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden,
        frage.video_stumm, frage.antwort_hinweis
      );
      if (video) container.appendChild(video);
    }

    function feldset(titel) {
      const feld = document.createElement("fieldset");
      feld.className = "entscheidung-block";
      const legend = document.createElement("legend");
      legend.textContent = titel;
      feld.appendChild(legend);
      return feld;
    }

    function auswahlButton({ text, wert, aktiv, icon, klasse = "" }, beiKlick) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `entscheidung-knopf ${klasse}${aktiv ? " aktiv" : ""}`;
      button.setAttribute("aria-pressed", aktiv ? "true" : "false");
      if (icon) {
        const symbol = document.createElement("span");
        symbol.className = "entscheidung-symbol";
        symbol.innerHTML = icon;
        button.appendChild(symbol);
      }
      const label = document.createElement("span");
      label.textContent = text;
      button.appendChild(label);
      button.dataset.wert = wert;
      button.addEventListener("click", beiKlick);
      return button;
    }

    function trikotButton(frage, seite, aktiv, beiKlick) {
      const button = auswahlButton({
        text: optionen.mannschaftLabel(seite), wert: seite, aktiv, klasse: "mannschaft",
      }, beiKlick);
      // Ohne Farbangabe in der Frage waere eine Farbflaeche eine
      // Information, die die Frage nie gegeben hat.
      if (!zeigtTrikotfarben(frage)) return button;
      const farbe = frage.trikot_heim && seite === "heim" ? frage.trikot_heim
        : frage.trikot_gast && seite === "gast" ? frage.trikot_gast
        : frage.entscheidung_darstellung?.[`trikot_${seite}`]
          || (seite === "heim" ? "#e4032e" : "#1d4ed8");
      const trikot = document.createElement("span");
      trikot.className = "entscheidung-trikot";
      trikot.style.setProperty("--trikot", farbe);
      button.prepend(trikot);
      return button;
    }

    function zeichneForm(frage, container, wahl) {
      const alt = container.querySelector(".entscheidung-form");
      const form = document.createElement("div");
      form.className = "entscheidung-form";

      if (verlangt(frage, "fordert_fortsetzung")) {
      const fortsetzung = feldset("Wie geht es weiter?");
      const fortRaster = document.createElement("div");
      fortRaster.className = "entscheidung-raster fortsetzungen";
      for (const eintrag of optionen.FORTSETZUNGEN) {
        fortRaster.appendChild(auswahlButton({
          text: eintrag.label,
          wert: eintrag.schluessel,
          aktiv: wahl.spielfortsetzung === eintrag.schluessel,
          icon: eintrag.icon,
        }, () => {
          wahl.spielfortsetzung = eintrag.schluessel;
          if (!optionen.brauchtRichtung(eintrag.schluessel)) wahl.fortsetzung_fuer = null;
          if (eintrag.schluessel === "weiterspielen") wahl.fortsetzung_ort = "";
          zeichneForm(frage, container, wahl);
        }));
      }
      fortsetzung.appendChild(fortRaster);
      form.appendChild(fortsetzung);

      if (optionen.brauchtRichtung(wahl.spielfortsetzung)
          && verlangt(frage, "fordert_fortsetzung_fuer")) {
        const richtung = feldset("Für welche Mannschaft?");
        const reihe = document.createElement("div");
        reihe.className = "entscheidung-raster zwei";
        ["heim", "gast"].forEach((seite) => reihe.appendChild(trikotButton(
          frage, seite, wahl.fortsetzung_fuer === seite,
          () => { wahl.fortsetzung_fuer = seite; zeichneForm(frage, container, wahl); }
        )));
        richtung.appendChild(reihe);
        form.appendChild(richtung);
      }

      if (wahl.spielfortsetzung && wahl.spielfortsetzung !== "weiterspielen"
          && verlangt(frage, "fordert_fortsetzung_ort")) {
        const ort = feldset("Wo wird fortgesetzt?");
        const chips = document.createElement("div");
        chips.className = "entscheidung-orte";
        ORTE.forEach((text) => chips.appendChild(auswahlButton({
          text, wert: text, aktiv: wahl.fortsetzung_ort === text, klasse: "ort-chip",
        }, () => { wahl.fortsetzung_ort = text; zeichneForm(frage, container, wahl); })));
        ort.appendChild(chips);
        const label = document.createElement("label");
        label.className = "entscheidung-anderer-ort";
        label.append("Anderer Ort oder eigene Formulierung");
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 180;
        input.placeholder = "z. B. dort, wo das Foul passiert ist";
        input.value = ORTE.includes(wahl.fortsetzung_ort) ? "" : wahl.fortsetzung_ort;
        input.addEventListener("input", () => {
          wahl.fortsetzung_ort = input.value;
          chips.querySelectorAll(".entscheidung-knopf").forEach((knopf) => {
            knopf.classList.remove("aktiv");
            knopf.setAttribute("aria-pressed", "false");
          });
          aktualisiereSenden(form, wahl, frage);
        });
        label.appendChild(input);
        ort.appendChild(label);
        form.appendChild(ort);
      }

      }   // Ende: fordert_fortsetzung

      if (verlangt(frage, "fordert_strafe")) {
      const strafe = feldset("Persönliche Strafe?");
      const strafRaster = document.createElement("div");
      strafRaster.className = "entscheidung-raster strafen";
      for (const eintrag of optionen.STRAFEN) {
        const kartenIcon = `<span class="entscheidung-karte ${eintrag.art}"></span>`;
        strafRaster.appendChild(auswahlButton({
          text: eintrag.label, wert: eintrag.schluessel,
          aktiv: wahl.persoenliche_strafe === eintrag.schluessel,
          icon: kartenIcon,
        }, () => {
          wahl.persoenliche_strafe = eintrag.schluessel;
          if (eintrag.schluessel === "keine") {
            wahl.strafe_fuer_mannschaft = null;
            wahl.strafe_fuer_rolle = null;
            wahl.strafe_rueckennummer = null;
          } else if (!wahl.strafe_fuer_rolle) {
            wahl.strafe_fuer_rolle = "feldspieler";
          }
          zeichneForm(frage, container, wahl);
        }));
      }
      strafe.appendChild(strafRaster);
      form.appendChild(strafe);

      if (wahl.persoenliche_strafe && wahl.persoenliche_strafe !== "keine"
          && verlangt(frage, "fordert_strafe_mannschaft")) {
        const ziel = feldset("Wen trifft die Strafe?");
        const teams = document.createElement("div");
        teams.className = "entscheidung-raster zwei";
        ["heim", "gast"].forEach((seite) => teams.appendChild(trikotButton(
          frage, seite, wahl.strafe_fuer_mannschaft === seite,
          () => { wahl.strafe_fuer_mannschaft = seite; zeichneForm(frage, container, wahl); }
        )));
        ziel.appendChild(teams);

        const details = document.createElement("div");
        details.className = "entscheidung-person";
        const rollenLabel = document.createElement("label");
        rollenLabel.append("Rolle");
        const select = document.createElement("select");
        Object.entries(optionen.ROLLEN).forEach(([wert, text]) => {
          const opt = document.createElement("option");
          opt.value = wert; opt.textContent = text; opt.selected = wahl.strafe_fuer_rolle === wert;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => { wahl.strafe_fuer_rolle = select.value; aktualisiereSenden(form, wahl, frage); });
        rollenLabel.appendChild(select);
        details.appendChild(rollenLabel);
        const nummerLabel = document.createElement("label");
        nummerLabel.append("Rückennummer (optional)");
        const nummer = document.createElement("input");
        nummer.type = "number"; nummer.min = "1"; nummer.max = "99"; nummer.inputMode = "numeric";
        nummer.value = wahl.strafe_rueckennummer || "";
        nummer.addEventListener("input", () => {
          wahl.strafe_rueckennummer = nummer.value ? Number(nummer.value) : null;
          aktualisiereSenden(form, wahl, frage);
        });
        nummerLabel.appendChild(nummer);
        details.appendChild(nummerLabel);
        ziel.appendChild(details);
        form.appendChild(ziel);
      }
      }   // Ende: fordert_strafe

      const senden = document.createElement("button");
      senden.type = "button";
      senden.className = "absenden-button entscheidung-absenden";
      senden.textContent = "Entscheidung abschicken";
      senden.addEventListener("click", () => abschicken(frage, container, wahl, senden));
      form.appendChild(senden);
      const feedback = document.createElement("p");
      feedback.className = "feedback entscheidung-feedback";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      feedback.hidden = true;
      form.appendChild(feedback);
      if (alt) alt.replaceWith(form); else container.appendChild(form);
      aktualisiereSenden(form, wahl, frage);
    }

    // Prueft nur, was die Frage verlangt. Der Server prueft dasselbe noch
    // einmal (v101) - diese Fassung sorgt bloss dafuer, dass der
    // Absenden-Knopf grau bleibt, statt eine Fehlermeldung zu ernten.
    function istVollstaendig(wahl, frage) {
      if (verlangt(frage, "fordert_fortsetzung") && !wahl.spielfortsetzung) return false;
      if (verlangt(frage, "fordert_strafe") && !wahl.persoenliche_strafe) return false;
      if (verlangt(frage, "fordert_fortsetzung") && verlangt(frage, "fordert_fortsetzung_fuer")
          && optionen.brauchtRichtung(wahl.spielfortsetzung) && !wahl.fortsetzung_fuer) return false;
      if (verlangt(frage, "fordert_fortsetzung") && verlangt(frage, "fordert_fortsetzung_ort")
          && wahl.spielfortsetzung !== "weiterspielen"
          && !String(wahl.fortsetzung_ort || "").trim()) return false;
      if (verlangt(frage, "fordert_strafe") && wahl.persoenliche_strafe !== "keine") {
        if (verlangt(frage, "fordert_strafe_mannschaft") && !wahl.strafe_fuer_mannschaft) return false;
        if (verlangt(frage, "fordert_strafe_rolle") && !wahl.strafe_fuer_rolle) return false;
        if (frage?.fordert_strafe_nummer === true && wahl.strafe_rueckennummer == null) return false;
      }
      if (wahl.strafe_rueckennummer != null
          && (!Number.isInteger(wahl.strafe_rueckennummer)
            || wahl.strafe_rueckennummer < 1
            || wahl.strafe_rueckennummer > 99)) return false;
      return true;
    }

    function aktualisiereSenden(form, wahl, frage) {
      const button = form.querySelector(".entscheidung-absenden");
      if (button) button.disabled = !istVollstaendig(wahl, frage);
    }

    async function abschicken(frage, container, wahl, button) {
      if (!istVollstaendig(wahl, frage)) return;
      versteckeFehler();
      button.disabled = true;
      button.textContent = "Wird geprüft …";
      const feedback = container.querySelector(".entscheidung-feedback");
      try {
        const zugang = getZugang();
        const antwort = await fetch("/api/entscheidung-bewerten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schiedsrichterId: zugang.schiedsrichterId,
            frageId: frage.id,
            pin: zugang.pin,
            antwort: wahl,
          }),
        });
        const daten = await antwort.json();
        if (!antwort.ok) throw new Error(daten.fehler || "Unbekannter Fehler");
        container.replaceWith(baueBeantworteteFrageElement(frage, {
          korrekt: daten.korrekt,
          entscheidung: { antwort: daten.antwort, loesung: daten.loesung, ergebnis: daten.ergebnis },
        }));
        beiWochenfrageBeantwortet();
      } catch (fehler) {
        feedback.hidden = false;
        feedback.classList.add("falsch");
        feedback.textContent = fehler.message;
        button.disabled = false;
        button.textContent = "Entscheidung abschicken";
      }
    }

    function baueFrageElement(frage) {
      const container = document.createElement("div");
      container.className = "frage-karte frage-karte-entscheidung";
      container.dataset.frageId = frage.id;
      kopf(frage, container);
      zeichneForm(frage, container, neueWahl());
      return container;
    }

    function ergebnisZeile(label, richtig, deins, korrekt) {
      const li = document.createElement("li");
      li.className = `entscheidung-ergebnis-zeile ${richtig ? "gut" : "schlecht"}`;
      const marke = document.createElement("span");
      marke.className = "entscheidung-ergebnis-marke";
      marke.textContent = richtig ? "✓" : "✗";
      const text = document.createElement("span");
      const stark = document.createElement("strong");
      stark.textContent = label;
      text.append(stark, document.createTextNode(`: ${deins || "—"}`));
      if (!richtig) {
        const loesung = document.createElement("small");
        loesung.textContent = `Richtig: ${korrekt || "—"}`;
        text.appendChild(loesung);
      }
      li.append(marke, text);
      return li;
    }

    function antwortTexte(wert) {
      return {
        fortsetzung: optionen.fortsetzungLabel(wert?.spielfortsetzung)
          + (wert?.fortsetzung_fuer ? ` für ${optionen.mannschaftLabel(wert.fortsetzung_fuer)}` : ""),
        ort: wert?.spielfortsetzung === "weiterspielen" ? "Entfällt" : wert?.fortsetzung_ort,
        strafe: optionen.strafeLabel(wert?.persoenliche_strafe)
          + (wert?.strafe_fuer_mannschaft ? ` für ${optionen.mannschaftLabel(wert.strafe_fuer_mannschaft)}` : "")
          + (wert?.strafe_fuer_rolle ? ` (${optionen.ROLLEN[wert.strafe_fuer_rolle] || wert.strafe_fuer_rolle}${wert.strafe_rueckennummer ? `, Nr. ${wert.strafe_rueckennummer}` : ""})` : ""),
      };
    }

    function baueBeantworteteFrageElement(frage, antwort) {
      const details = antwort.entscheidung || {};
      const gegeben = details.antwort || {};
      const loesung = details.loesung || {};
      const e = details.ergebnis || {};
      const container = document.createElement("div");
      container.className = `frage-karte frage-karte-entscheidung beantwortet ${antwort.korrekt ? "richtig-karte" : "falsch-karte"}`;
      container.dataset.frageId = frage.id;
      kopf(frage, container);
      const liste = document.createElement("ul");
      liste.className = "entscheidung-ergebnis";
      const deins = antwortTexte(gegeben);
      const richtig = antwortTexte(loesung);
      liste.appendChild(ergebnisZeile("Spielfortsetzung", Boolean(e.fortsetzung_richtig && e.richtung_richtig), deins.fortsetzung, richtig.fortsetzung));
      liste.appendChild(ergebnisZeile("Ausführungsort", Boolean(e.ort_richtig), deins.ort, richtig.ort));
      liste.appendChild(ergebnisZeile("Persönliche Strafe", Boolean(e.strafe_richtig && e.strafziel_richtig && e.rolle_richtig && e.rueckennummer_richtig), deins.strafe, richtig.strafe));
      container.appendChild(liste);
      if (e.ort_feedback) {
        const hinweis = document.createElement("p");
        hinweis.className = "entscheidung-ort-feedback";
        hinweis.textContent = e.ort_feedback;
        container.appendChild(hinweis);
      }
      container.appendChild(baueWarumButton(frage.id, false));
      return container;
    }

    return Object.freeze({ bereiteVor, baueFrageElement, baueBeantworteteFrageElement });
  }

  global.SchiriQuizDecisionAnswers = Object.freeze({ erstelleEntscheidungsAntworten });
})(globalThis);
