(function stelleFragenElementeBereit(global) {
  "use strict";

  function erstelleFragenElemente({ schwierigkeitSterne }) {
    /// Anzeigename und Farbklasse je Fragetyp (07.08.2026, Max' Wunsch:
    /// "vielleicht sieht man da dann auch deutlicher, dass eine Frage Video oder
    /// Freitext ist, vielleicht mit Farben"). Bewusst mit Symbol UND Text, damit
    /// der Typ nicht allein über die Farbe erkennbar ist.
    const FRAGETYP_BADGE = {
      multiple_choice: null, // Standardfall - kein Badge, sonst steht es überall
      freitext: { text: "✍️ Freitext", klasse: "typ-freitext" },
      video_mc: { text: "▶ Video", klasse: "typ-video" },
      video_freitext: { text: "▶ Video + Freitext", klasse: "typ-video" },
    };

    function baueBadges(frage) {
      const wrap = document.createElement("div");
      wrap.className = "frage-badges";

      // Nummer ganz vorn, damit man sie beim Besprechen im Team nennen kann
      // ("bei F3 war ich unsicher").
      if (frage.anzeigeNummer) {
        const nummerBadge = document.createElement("span");
        nummerBadge.className = "badge frage-nummer";
        nummerBadge.textContent = "F" + frage.anzeigeNummer;
        wrap.appendChild(nummerBadge);
      }

      // Fragetyp danach - die Information, die beim Überfliegen am meisten
      // hilft ("muss ich hier ein Video ansehen oder etwas schreiben?").
      const typInfo = FRAGETYP_BADGE[frage.typ];
      if (typInfo) {
        const typBadge = document.createElement("span");
        typBadge.className = "badge " + typInfo.klasse;
        typBadge.textContent = typInfo.text;
        wrap.appendChild(typBadge);
      }

      if (frage.regel_nummer && frage.regel_bezeichnung) {
        const regelBadge = document.createElement("span");
        regelBadge.className = "badge regel";
        const regelSymbol = document.createElement("span");
        regelSymbol.className = "badge-symbol";
        regelSymbol.setAttribute("aria-hidden", "true");
        regelSymbol.textContent = "§";
        regelBadge.append(
          regelSymbol,
          document.createTextNode("Regel " + frage.regel_nummer + " · " + frage.regel_bezeichnung)
        );
        wrap.appendChild(regelBadge);
      }

      const sterne = schwierigkeitSterne(frage.schwierigkeit);
      if (sterne) {
        const schwierigkeitBadge = document.createElement("span");
        schwierigkeitBadge.className = "badge schwierigkeit";
        schwierigkeitBadge.textContent = sterne;
        wrap.appendChild(schwierigkeitBadge);
      }

      return wrap.childElementCount > 0 ? wrap : null;
    }

    // ============================================================
    // Auflösung der Antwortmöglichkeiten einfärben (07.08.2026, Max' Wunsch)
    //
    // Nach dem Abschicken soll auf einen Blick erkennbar sein, was richtig war
    // und was man selbst gewählt hat - vorher blieb alles einfarbig und die
    // gesperrten Felder wirkten durch den Hover-Effekt weiterhin anklickbar
    // ("die sind trotzdem wieso getoggeld, das ist halt dumm").
    //
    // Farblogik (siehe auch style.css):
    //   grün = richtige Antwort · rot = eigene Antwort, falls falsch
    //   blau (".ausgewaehlt") wird hier entfernt, weil die Auswahl jetzt
    //   aufgelöst ist und blau sonst mit grün/rot konkurrieren würde.
    //
    // Zusätzlich bekommt jede aufgelöste Zeile ein Zeichen (✓ / ✗) - die
    // Auflösung darf nicht ausschließlich über Farbe transportiert werden,
    // sonst ist sie für farbfehlsichtige Nutzer nicht erkennbar (WCAG 1.4.1).
    // ============================================================
    function loeseOptionenAuf(container, richtigeOption, gewaehlteOption) {
      const optionen = container.querySelectorAll(".option");
      optionen.forEach((label) => {
        const radio = label.querySelector('input[type="radio"]');
        if (!radio) return;

        // Sperren: Radio deaktivieren UND die Karte als gesperrt markieren,
        // damit der Hover-Effekt aus dem CSS nicht mehr greift.
        radio.disabled = true;
        label.classList.add("gesperrt");
        label.classList.remove("ausgewaehlt");

        // Doppelte Marken vermeiden, falls diese Funktion zweimal läuft.
        const alteMarke = label.querySelector(".option-marke");
        if (alteMarke) alteMarke.remove();

        const istRichtige = richtigeOption && radio.value === richtigeOption.toLowerCase();
        const istGewaehlte = gewaehlteOption && radio.value === gewaehlteOption.toLowerCase();

        if (istRichtige) {
          label.classList.add("ist-richtig");
          label.appendChild(marke("\u2713", istGewaehlte ? "Deine Antwort - richtig" : "Richtige Antwort"));
        } else if (istGewaehlte) {
          label.classList.add("ist-falsch");
          label.appendChild(marke("\u2717", "Deine Antwort - falsch"));
        }
      });

      function marke(zeichen, beschreibung) {
        const span = document.createElement("span");
        span.className = "option-marke";
        span.textContent = zeichen;
        span.setAttribute("aria-label", beschreibung);
        span.title = beschreibung;
        return span;
      }
    }

    return Object.freeze({ baueBadges, loeseOptionenAuf });
  }

  global.SchiriQuizQuestionElements = Object.freeze({ erstelleFragenElemente });
})(globalThis);
