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

    // ============================================================
    //  Mehrere persoenliche Strafen (v104, 31.08.2026)
    // ============================================================
    //  Max' Fall: der Einwechselspieler bekommt erst eine Verwarnung
    //  fuer das Betreten des Feldes und danach Gelb-Rot fuer das
    //  Unterbinden eines verheissungsvollen Angriffs. Zwei Strafen in
    //  einer Szene - vorher passte in das Formular genau eine.
    //
    //  Zwei Entscheidungen von Max stecken in der Datenstruktur:
    //  - Reihenfolge egal: Gelb+Gelb-Rot zaehlt wie Gelb-Rot+Gelb. Die
    //    Bewertung sortiert beide Listen, hier genuegt eine Reihe.
    //  - Je Strafe eine eigene Person: Mannschaft, Rolle und
    //    Rueckennummer stehen im Eintrag, nicht an der Frage.
    //
    //  "keine" ist KEIN Listeneintrag - keine Strafe ist die leere
    //  Liste. Weil die leere Liste aber auch "noch nichts gewaehlt"
    //  heisst, merkt keine_strafe die ausdrueckliche Wahl "Keine".
    //  Ohne diese Unterscheidung waere der Absenden-Knopf sofort frei,
    //  obwohl die Frage unbeantwortet ist.
    const HOECHSTENS_STRAFEN = 4;   // die Datenbank laesst position 1..4

    function neueWahl() {
      return {
        spielfortsetzung: null,
        fortsetzung_fuer: null,
        fortsetzung_ort: "",
        strafen: [],
        keine_strafe: false,
      };
    }

    function neueStrafe(schluessel) {
      return {
        strafe: schluessel,
        fuer_mannschaft: null,
        strafe_fuer_rolle: "feldspieler",
        rueckennummer: null,
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
      const bild = frageAnsicht.baueFrageBild?.(frage);
      if (bild) container.appendChild(bild);
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

    function auswahlButton({ text, wert, aktiv, icon, klasse = "", langtext }, beiKlick) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `entscheidung-knopf ${klasse}${aktiv ? " aktiv" : ""}`;
      button.setAttribute("aria-pressed", aktiv ? "true" : "false");
      // Abgekuerzt wird nur, was man sieht. Wer vorlesen laesst, hoert
      // weiterhin "Schiedsrichter-Ball" statt "SR-Ball".
      if (langtext && langtext !== text) {
        button.title = langtext;
        button.setAttribute("aria-label", langtext);
      }
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
          // Kurzform auf dem Knopf, voller Name fuer Vorleseprogramme.
          text: optionen.fortsetzungKurz(eintrag.schluessel),
          langtext: eintrag.label,
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
        // Sechs Knopfreihen plus Textfeld haben die Frage auf dem iPhone
        // ewig lang gemacht - Max am 31.08.2026: "Das mit 'Wo wird
        // fortgesetzt' wuerde ich eher als Drop-down-Menue machen, weil
        // sonst die Liste zu lang wird. Stell dir mal vor, das ist auf
        // dem iPhone, und das zieht sich ja dann alles ewig lang."
        //
        // Das Freitextfeld bleibt und erscheint nur, wenn "Anderer Ort"
        // gewaehlt ist. Es ersatzlos zu streichen waere falsch: der Ort
        // ist eine freie Antwort, die die KI bewertet, und sechs
        // Vorgaben decken nicht jede Szene ab.
        const ort = feldset("Wo wird fortgesetzt?");
        const eigenerOrt = wahl.fortsetzung_ort !== "" && !ORTE.includes(wahl.fortsetzung_ort);

        const auswahl = document.createElement("select");
        auswahl.className = "entscheidung-ort-auswahl";
        auswahl.setAttribute("aria-label", "Wo wird fortgesetzt?");
        const leer = document.createElement("option");
        leer.value = "";
        leer.textContent = "Bitte wählen …";
        auswahl.appendChild(leer);
        for (const text of ORTE) {
          const option = document.createElement("option");
          option.value = text;
          option.textContent = text;
          option.selected = wahl.fortsetzung_ort === text;
          auswahl.appendChild(option);
        }
        const anderer = document.createElement("option");
        anderer.value = "__anderer__";
        anderer.textContent = "Anderer Ort – selbst formulieren";
        anderer.selected = eigenerOrt;
        auswahl.appendChild(anderer);
        ort.appendChild(auswahl);

        const label = document.createElement("label");
        label.className = "entscheidung-anderer-ort";
        label.hidden = !eigenerOrt;
        label.append("Eigene Formulierung");
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 180;
        input.placeholder = "z. B. dort, wo das Foul passiert ist";
        input.value = eigenerOrt ? wahl.fortsetzung_ort : "";
        input.addEventListener("input", () => {
          wahl.fortsetzung_ort = input.value;
          aktualisiereSenden(form, wahl, frage);
        });
        label.appendChild(input);
        ort.appendChild(label);

        auswahl.addEventListener("change", () => {
          if (auswahl.value === "__anderer__") {
            // Nicht neu zeichnen, sonst verliert das Textfeld sofort den
            // Fokus und die Tastatur klappt auf dem Handy wieder zu.
            wahl.fortsetzung_ort = input.value;
            label.hidden = false;
            input.focus();
          } else {
            wahl.fortsetzung_ort = auswahl.value;
            label.hidden = true;
          }
          aktualisiereSenden(form, wahl, frage);
        });
        form.appendChild(ort);
      }

      }   // Ende: fordert_fortsetzung

      if (verlangt(frage, "fordert_strafe")) {
      // Die obere Reihe bleibt der Einstieg und entscheidet nur ueber die
      // ERSTE Karte: "Keine" heisst keine Bloecke, jede Karte legt den
      // ersten Block an. Wer nur eine Karte gibt - der Normalfall - tippt
      // also genau einmal, wie vorher auch.
      //
      // Max zur Bedienung: "Du hast so einen Button 'Weitere
      // persoenliche Strafe hinzufuegen'. Du klickst darauf, dann kommt
      // nochmal das Fenster auf, und dann klickst du auf 'Gelbe Karte'."
      const strafe = feldset("Persönliche Strafe?");
      const strafRaster = document.createElement("div");
      strafRaster.className = "entscheidung-raster strafen";
      for (const eintrag of optionen.STRAFEN) {
        const kartenIcon = `<span class="entscheidung-karte ${eintrag.art}"></span>`;
        const istKeine = eintrag.schluessel === "keine";
        strafRaster.appendChild(auswahlButton({
          text: eintrag.label, wert: eintrag.schluessel,
          aktiv: istKeine ? wahl.keine_strafe === true
            : wahl.keine_strafe !== true && wahl.strafen[0]?.strafe === eintrag.schluessel,
          icon: kartenIcon,
        }, () => {
          if (istKeine) {
            wahl.keine_strafe = true;
            wahl.strafen = [];
          } else {
            wahl.keine_strafe = false;
            if (wahl.strafen.length === 0) wahl.strafen.push(neueStrafe(eintrag.schluessel));
            else wahl.strafen[0].strafe = eintrag.schluessel;
          }
          zeichneForm(frage, container, wahl);
        }));
      }
      strafe.appendChild(strafRaster);

      const strafliste = document.createElement("div");
      strafliste.className = "entscheidung-strafliste";
      wahl.strafen.forEach((eintrag, stelle) => {
        strafliste.appendChild(strafblock(frage, container, form, wahl, eintrag, stelle));
      });
      strafe.appendChild(strafliste);

      if (wahl.strafen.length > 0 && wahl.strafen.length < HOECHSTENS_STRAFEN) {
        const mehr = document.createElement("button");
        mehr.type = "button";
        mehr.className = "entscheidung-strafe-mehr";
        mehr.textContent = "Weitere persönliche Strafe hinzufügen";
        mehr.addEventListener("click", () => {
          // Ohne Karte: der neue Block fragt zuerst nach ihr - genau das
          // "Fenster", das Max beschreibt.
          wahl.strafen.push(neueStrafe(null));
          zeichneForm(frage, container, wahl);
        });
        strafe.appendChild(mehr);
      } else if (wahl.strafen.length >= HOECHSTENS_STRAFEN) {
        // Kein stummer Knopf, der nichts tut: lieber sagen, warum hier
        // Schluss ist.
        const grenze = document.createElement("p");
        grenze.className = "entscheidung-strafe-grenze";
        grenze.textContent = `Mehr als ${HOECHSTENS_STRAFEN} persönliche Strafen sind nicht vorgesehen.`;
        strafe.appendChild(grenze);
      }
      form.appendChild(strafe);
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

    // ============================================================
    //  Ein Block = eine Strafe = eine Person
    // ============================================================
    //  Mannschaft, Rolle und Rueckennummer stehen IM Block, nicht einmal
    //  fuer die ganze Frage. In Max' Fall trifft es zweimal denselben
    //  Einwechselspieler, in anderen Szenen trifft die zweite Karte
    //  jemand anderen - eine gemeinsame Person waere dort schlicht
    //  falsch, ohne dass man es am Bildschirm saehe.
    //
    //  Die Kartenwahl steht erst ab dem zweiten Block IM Block: die des
    //  ersten ist die Reihe oben, damit der haeufige Fall "eine Karte"
    //  ein einziges Tippen bleibt. In den weiteren Bloecken fehlt
    //  "Keine" - keine Strafe ist die leere Liste, kein Listeneintrag.
    function strafblock(frage, container, form, wahl, eintrag, stelle) {
      const block = document.createElement("div");
      block.className = "entscheidung-strafblock";

      const kopfzeile = document.createElement("div");
      kopfzeile.className = "entscheidung-strafblock-kopf";
      const titel = document.createElement("span");
      titel.className = "entscheidung-strafblock-titel";
      titel.textContent = `${stelle + 1}. persönliche Strafe`;
      const weg = document.createElement("button");
      weg.type = "button";
      weg.className = "entscheidung-strafe-entfernen";
      weg.textContent = "Entfernen";
      weg.setAttribute("aria-label", `${stelle + 1}. persönliche Strafe entfernen`);
      weg.addEventListener("click", () => {
        wahl.strafen.splice(stelle, 1);
        // Den letzten Block zu entfernen heisst NICHT "keine Strafe",
        // sondern "noch nichts gewaehlt". Dafuer gibt es den Knopf
        // "Keine" - sonst gaebe ein Fehlgriff stillschweigend eine
        // Antwort ab, die niemand gemeint hat.
        if (wahl.strafen.length === 0) wahl.keine_strafe = false;
        zeichneForm(frage, container, wahl);
      });
      kopfzeile.append(titel, weg);
      block.appendChild(kopfzeile);

      if (stelle > 0) {
        const raster = document.createElement("div");
        raster.className = "entscheidung-raster strafen-weitere";
        for (const karte of optionen.STRAFEN.filter((k) => k.schluessel !== "keine")) {
          raster.appendChild(auswahlButton({
            text: karte.label, wert: karte.schluessel,
            aktiv: eintrag.strafe === karte.schluessel,
            icon: `<span class="entscheidung-karte ${karte.art}"></span>`,
          }, () => {
            eintrag.strafe = karte.schluessel;
            zeichneForm(frage, container, wahl);
          }));
        }
        block.appendChild(raster);
      }

      const willMannschaft = verlangt(frage, "fordert_strafe_mannschaft");
      const willRolle = verlangt(frage, "fordert_strafe_rolle");
      // Die Rueckennummer haengt an ihrem EIGENEN Schalter und ist nur an,
      // wenn die Frage sie ausdruecklich nennt.
      const willNummer = frage?.fordert_strafe_nummer === true;

      if (willMannschaft || willRolle || willNummer) {
        const hinweis = document.createElement("p");
        hinweis.className = "entscheidung-strafblock-hinweis";
        hinweis.textContent = "Wen trifft die Strafe?";
        block.appendChild(hinweis);
      }

      if (willMannschaft) {
        const teams = document.createElement("div");
        teams.className = "entscheidung-raster zwei";
        ["heim", "gast"].forEach((seite) => teams.appendChild(trikotButton(
          frage, seite, eintrag.fuer_mannschaft === seite,
          () => { eintrag.fuer_mannschaft = seite; zeichneForm(frage, container, wahl); }
        )));
        block.appendChild(teams);
      }

      const details = document.createElement("div");
      details.className = "entscheidung-person";
      if (willRolle) {
        const rollenLabel = document.createElement("label");
        rollenLabel.append("Rolle");
        const select = document.createElement("select");
        Object.entries(optionen.ROLLEN).forEach(([wert, text]) => {
          const opt = document.createElement("option");
          opt.value = wert; opt.textContent = text; opt.selected = eintrag.strafe_fuer_rolle === wert;
          select.appendChild(opt);
        });
        select.addEventListener("change", () => {
          eintrag.strafe_fuer_rolle = select.value;
          aktualisiereSenden(form, wahl, frage);
        });
        rollenLabel.appendChild(select);
        details.appendChild(rollenLabel);
      }
      if (willNummer) {
        const nummerLabel = document.createElement("label");
        nummerLabel.append("Rückennummer");
        const nummer = document.createElement("input");
        nummer.type = "number"; nummer.min = "1"; nummer.max = "99"; nummer.inputMode = "numeric";
        nummer.value = eintrag.rueckennummer == null ? "" : String(eintrag.rueckennummer);
        nummer.addEventListener("input", () => {
          // Nicht neu zeichnen: sonst verliert das Feld bei jeder Ziffer
          // den Fokus und die Tastatur klappt auf dem Handy zu.
          eintrag.rueckennummer = nummer.value ? Number(nummer.value) : null;
          aktualisiereSenden(form, wahl, frage);
        });
        nummerLabel.appendChild(nummer);
        details.appendChild(nummerLabel);
      }
      if (details.childElementCount > 0) block.appendChild(details);
      return block;
    }

    function istRueckennummer(wert) {
      return Number.isInteger(wert) && wert >= 1 && wert <= 99;
    }

    // Prueft nur, was die Frage verlangt. Der Server prueft dasselbe noch
    // einmal (v101) - diese Fassung sorgt bloss dafuer, dass der
    // Absenden-Knopf grau bleibt, statt eine Fehlermeldung zu ernten.
    function istVollstaendig(wahl, frage) {
      if (verlangt(frage, "fordert_fortsetzung") && !wahl.spielfortsetzung) return false;
      // Weder "Keine" noch ein Block: die Frage ist unbeantwortet.
      if (verlangt(frage, "fordert_strafe") && !wahl.keine_strafe
          && wahl.strafen.length === 0) return false;
      if (verlangt(frage, "fordert_fortsetzung") && verlangt(frage, "fordert_fortsetzung_fuer")
          && optionen.brauchtRichtung(wahl.spielfortsetzung) && !wahl.fortsetzung_fuer) return false;
      if (verlangt(frage, "fordert_fortsetzung") && verlangt(frage, "fordert_fortsetzung_ort")
          && wahl.spielfortsetzung !== "weiterspielen"
          && !String(wahl.fortsetzung_ort || "").trim()) return false;
      if (verlangt(frage, "fordert_strafe")) {
        if (wahl.strafen.length > HOECHSTENS_STRAFEN) return false;
        for (const eintrag of wahl.strafen) {
          // Ein frisch hinzugefuegter Block hat noch keine Karte.
          if (!eintrag.strafe || eintrag.strafe === "keine") return false;
          if (verlangt(frage, "fordert_strafe_mannschaft") && !eintrag.fuer_mannschaft) return false;
          if (verlangt(frage, "fordert_strafe_rolle") && !eintrag.strafe_fuer_rolle) return false;
          if (frage?.fordert_strafe_nummer === true
              && !istRueckennummer(eintrag.rueckennummer)) return false;
          if (eintrag.rueckennummer != null
              && !istRueckennummer(eintrag.rueckennummer)) return false;
        }
      }
      return true;
    }

    function aktualisiereSenden(form, wahl, frage) {
      const button = form.querySelector(".entscheidung-absenden");
      if (button) button.disabled = !istVollstaendig(wahl, frage);
    }

    // ============================================================
    //  Der Vertrag mit dem Server (v104)
    // ============================================================
    //  Neu ist das Feld "strafen": eine Liste mit gelb | gelb_rot | rot.
    //  "keine" steht dort nie - keine Strafe ist die leere Liste.
    //
    //  Mannschaft, Rolle und Rueckennummer gehen nur mit, wenn die Frage
    //  sie verlangt. Ein Wert, nach dem nie gefragt wurde, waere eine
    //  Behauptung ueber die Szene - und die Datenbank wuerde ihn beim
    //  naechsten Umkonfigurieren als Altlast nicht mehr erkennen.
    function baueAntwort(frage, wahl) {
      const strafen = wahl.strafen.map((eintrag) => {
        const raus = { strafe: eintrag.strafe };
        if (verlangt(frage, "fordert_strafe_mannschaft")) raus.fuer_mannschaft = eintrag.fuer_mannschaft;
        if (verlangt(frage, "fordert_strafe_rolle")) raus.strafe_fuer_rolle = eintrag.strafe_fuer_rolle;
        if (frage?.fordert_strafe_nummer === true) {
          raus.rueckennummer = eintrag.rueckennummer == null ? null : String(eintrag.rueckennummer);
        }
        return raus;
      });
      const erste = strafen[0];
      return {
        spielfortsetzung: wahl.spielfortsetzung,
        fortsetzung_fuer: wahl.fortsetzung_fuer,
        fortsetzung_ort: wahl.fortsetzung_ort,
        strafen,
        // Die erste Strafe steht zusaetzlich in den alten Einzelfeldern.
        // Bewertet wird ausschliesslich "strafen" - aber die Klartextzeile
        // der Antwort (entscheidung_anzeige in der Datenbank) liest
        // weiterhin diese Felder. Ohne den Spiegel stuende in der
        // Historie "Keine Strafangabe", obwohl eine Karte gegeben wurde.
        persoenliche_strafe: erste ? erste.strafe : "keine",
        strafe_fuer_mannschaft: erste?.fuer_mannschaft ?? null,
        strafe_fuer_rolle: erste?.strafe_fuer_rolle ?? null,
        strafe_rueckennummer: erste?.rueckennummer ?? null,
      };
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
            antwort: baueAntwort(frage, wahl),
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
      };
    }

    // null heisst "war nicht gefragt" (v101), nicht "falsch". Nur ein
    // ausdrueckliches false ist ein Fehler - sonst zeigte die Aufloesung
    // ein rotes Kreuz bei einem Bestandteil, nach dem nie gefragt wurde.
    function teilnoteOk(...werte) {
      return werte.every((wert) => wert !== false);
    }

    // Die Strafen kommen seit v104 als Liste - die eigene Antwort als
    // antwort.strafen, die Loesung als loesung.strafen. Aeltere Antworten
    // haben nur die vier Einzelfelder; die Historie muss lesbar bleiben,
    // sonst stuende bei jeder alten Antwort "keine Strafe".
    function strafenAusAntwort(wert) {
      if (Array.isArray(wert?.strafen)) return wert.strafen;
      const einzeln = wert?.persoenliche_strafe;
      if (!einzeln || einzeln === "keine") return [];
      return [{
        strafe: einzeln,
        fuer_mannschaft: wert.strafe_fuer_mannschaft,
        strafe_fuer_rolle: wert.strafe_fuer_rolle,
        rueckennummer: wert.strafe_rueckennummer,
      }];
    }

    function strafeText(eintrag) {
      const rolle = eintrag?.strafe_fuer_rolle;
      const nummer = eintrag?.rueckennummer;
      const person = rolle
        ? ` (${optionen.ROLLEN[rolle] || rolle}${nummer ? `, Nr. ${nummer}` : ""})`
        : nummer ? ` (Nr. ${nummer})` : "";
      return optionen.strafeLabel(eintrag?.strafe)
        + (eintrag?.fuer_mannschaft ? ` für ${optionen.mannschaftLabel(eintrag.fuer_mannschaft)}` : "")
        + person;
    }

    function strafenListeElement(liste) {
      const ul = document.createElement("ul");
      ul.className = "entscheidung-strafen-anzeige";
      const eintraege = liste.length ? liste.map(strafeText) : ["Keine persönliche Strafe"];
      for (const text of eintraege) {
        const li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      }
      return ul;
    }

    // Eine eigene Zeile statt ergebnisZeile: mehrere Strafen in einer
    // Textzeile aneinanderzuhaengen ist auf 390 px nicht mehr lesbar.
    // Untereinander sieht man sofort, welche Karte gefehlt hat.
    function strafenZeile(richtig, deine, korrekte) {
      const li = document.createElement("li");
      li.className = `entscheidung-ergebnis-zeile ${richtig ? "gut" : "schlecht"}`;
      const marke = document.createElement("span");
      marke.className = "entscheidung-ergebnis-marke";
      marke.textContent = richtig ? "✓" : "✗";
      const text = document.createElement("span");
      const stark = document.createElement("strong");
      stark.textContent = Math.max(deine.length, korrekte.length) > 1
        ? "Persönliche Strafen" : "Persönliche Strafe";
      text.append(stark, strafenListeElement(deine));
      if (!richtig) {
        const hinweis = document.createElement("small");
        hinweis.textContent = "Richtig:";
        text.append(hinweis, strafenListeElement(korrekte));
      }
      li.append(marke, text);
      return li;
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
      liste.appendChild(ergebnisZeile("Spielfortsetzung",
        teilnoteOk(e.fortsetzung_richtig, e.richtung_richtig), deins.fortsetzung, richtig.fortsetzung));
      liste.appendChild(ergebnisZeile("Ausführungsort",
        teilnoteOk(e.ort_richtig), deins.ort, richtig.ort));
      liste.appendChild(strafenZeile(
        teilnoteOk(e.strafe_richtig, e.strafziel_richtig, e.rolle_richtig, e.rueckennummer_richtig),
        strafenAusAntwort(gegeben), strafenAusAntwort(loesung)));
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
