// ============================================================
//  Rueckmeldung zu einer Frage ("Passt was nicht?")
// ============================================================
//  Max am 03.09.2026: "Ich wuerde keinen unaufdringlichen Link machen,
//  sondern so einen Button mit einem Fragezeichen oder Feedback - ein
//  Button sieht geiler aus als so ein Text mit Hyperlink."
//
//  ------------------------------------------------------------
//  WO DER KNOPF STEHT - und warum nicht an der offenen Frage
//  ------------------------------------------------------------
//  Er steht BEI DER LOESUNG: erst nachdem die Frage beantwortet und
//  abgeschickt ist. Zwei Gruende:
//
//  1. An der offenen Frage waere er eine Ablenkung. Wer nicht weiter
//     weiss, haette dort einen zweiten Knopf, der nicht "antworten"
//     heisst - eine Einladung zum Ausweichen.
//  2. Der Zweifel entsteht ohnehin erst mit der Loesung. "Das kann nicht
//     stimmen" denkt niemand vor der Aufloesung.
//
//  Max' Sorge dabei, woertlich: "die Frage ist, ob das dann zu ueberladen
//  wird". Deshalb steht an der Frage nichts und bei der Loesung genau ein
//  Knopf - nicht zwei, nicht ein Menue.
//
//  Technisch ist das nicht nur eine Absprache: Dieses Modul gibt den
//  Knopf ausschliesslich ueber baueLoesungsAktionen() heraus, und die
//  verlangt den fertigen "Warum?"-Knopf als ersten Parameter. Ohne
//  Loesung gibt es keinen "Warum?"-Knopf, und ohne den keinen
//  Melde-Knopf. baueMeldeKnopf bleibt bewusst modulintern.
//
//  ------------------------------------------------------------
//  DIE MARKE AN SCHON GEMELDETEN FRAGEN
//  ------------------------------------------------------------
//  Wer meldet und danach nichts sieht, meldet dieselbe Sache noch einmal
//  - und hoert dann ganz auf. Beim Aufbau wird deshalb einmal
//  "frage_melde_markierungen" gelesen: eigene offene Hinweise der aktuellen
//  Woche und ungelöste Video-/Technikprobleme im eigenen Verein. Keine
//  fremden Texte oder Namen. Erledigtes und der Übungsmodus bleiben ohne Marke.
//
//  Faellt die Abfrage aus, fehlt die Marke und sonst nichts. Ein Quiz,
//  das wegen einer Marke nicht laedt, waere der schlechtere Tausch.
//
//  ------------------------------------------------------------
//  KEIN BROWSER-DIALOG
//  ------------------------------------------------------------
//  confirm/alert/prompt sind hier verboten und koennten ihre Knoepfe
//  ohnehin nicht beschriften. Das Fenster uebernimmt die Formsprache von
//  src/ui/verlassen-dialog.js und der Video-Grossansicht: dunkle Flaeche,
//  eine Karte darin, Knoepfe mit Woertern.
// ============================================================

(function stelleFrageMeldungBereit(global) {
  "use strict";

  // Genau die fuenf Kategorien der Datenbank (v111). Ein sechster Eintrag
  // hier wuerde vom Server abgelehnt - die Liste ist keine Deko.
  const KATEGORIEN = [
    { wert: "antwort", text: "Antwort", hinweis: "Die hinterlegte Lösung stimmt nicht." },
    { wert: "feedback", text: "Feedback", hinweis: "Anmerkung zur Frage." },
    { wert: "text_unklar", text: "Text unklar", hinweis: "Die Frage ist missverständlich." },
    { wert: "video_technik", text: "Video/Technik", hinweis: "Video oder Bild lädt nicht." },
    { wert: "sonstiges", text: "Sonstiges", hinweis: "Etwas anderes." },
  ];

  // Die Datenbank prueft dasselbe (CHECK, 1 bis 1000 Zeichen). Hier steht
  // die Zahl, damit der Zaehler warnen kann, BEVOR der Text weg ist.
  const GRENZE = 1000;

  function erstelleFrageMeldung({ sb, getZugang } = {}) {
    // frage_id -> { status, anzahl }
    const meldungen = new Map();
    let fenster = null;
    let offeneFrageId = null;
    let vorherigerFokus = null;
    let dialogVersion = 0;
    let sendet = false;
    let markenVersion = 0;

    // ---------- Marke an einer schon gemeldeten Frage ----------

    function markenText(eintrag) {
      if (!eintrag || ["erledigt", "abgelehnt"].includes(eintrag.status)) return "";
      return "Gemeldet";
    }

    function setzeMarke(zeile) {
      const frageId = zeile.dataset ? zeile.dataset.frageId : null;
      const alte = zeile.querySelector(".melde-marke");
      if (alte) alte.remove();
      const eintrag = frageId ? meldungen.get(frageId) : null;
      if (zeile.dataset.istHistorie === "true" || !markenText(eintrag)) return;
      const marke = document.createElement("span");
      marke.className = "melde-marke";
      marke.textContent = markenText(eintrag);
      zeile.appendChild(marke);
    }

    function markiereAlle() {
      document.querySelectorAll(".loesung-aktionen").forEach(setzeMarke);
    }

    // Die Bestaetigung nach dem Abschicken. Kein zweites Fenster und kein
    // Browser-Dialog: sie steht in derselben Zeile wie der Knopf, der
    // gerade gedrueckt wurde, meldet sich Vorleseprogrammen als "status"
    // und verschwindet nach ein paar Sekunden von allein. Nichts, was man
    // wegklicken muss - und nichts, was man versehentlich noch einmal
    // abschickt.
    function zeigeBestaetigung(frageId, nachricht) {
      document.querySelectorAll(".loesung-aktionen").forEach((zeile) => {
        const alte = zeile.querySelector(".melde-bestaetigung");
        if (alte) alte.remove();
        if (!zeile.dataset || zeile.dataset.frageId !== frageId) return;
        const hinweis = document.createElement("p");
        hinweis.className = "melde-bestaetigung";
        hinweis.setAttribute("role", "status");
        hinweis.textContent = nachricht;
        zeile.appendChild(hinweis);
        // unref, damit ein offener Timer in Tests den Prozess nicht haelt.
        const uhr = setTimeout(() => hinweis.remove(), 9000);
        if (uhr && typeof uhr.unref === "function") uhr.unref();
      });
    }

    async function ladeEigeneMeldungen() {
      const version = ++markenVersion;
      meldungen.clear();
      markiereAlle();
      const zugang = typeof getZugang === "function" ? getZugang() : {};
      if (!zugang.schiedsrichterId || !zugang.pin || !sb) return;
      let antwort;
      try { antwort = await sb.rpc("frage_melde_markierungen", {
        p_schiedsrichter_id: zugang.schiedsrichterId,
        p_pin: zugang.pin,
      }); } catch { return; }
      const aktuell = typeof getZugang === "function" ? getZugang() : {};
      if (version !== markenVersion || aktuell.schiedsrichterId !== zugang.schiedsrichterId || aktuell.pin !== zugang.pin) return;
      const { data, error } = antwort;
      // Stillschweigend aufgeben: eine fehlende Marke ist ein Schoenheits-
      // fehler, ein Fehlerbalken ueber dem ganzen Quiz waere keiner.
      if (error || !Array.isArray(data)) return;
      meldungen.clear();
      for (const zeile of data) {
        if (!zeile || !zeile.frage_id) continue;
        // Die Funktion liefert neueste zuerst; zu einer Frage kann es nach
        // dem Erledigen wieder eine neue offene Meldung geben. Die erste
        // Zeile ist damit die aktuelle - spaetere nicht ueberschreiben.
        if (meldungen.has(zeile.frage_id)) continue;
        meldungen.set(zeile.frage_id, {
          status: zeile.status || "offen",
          anzahl: Number(zeile.anzahl_eintraege) || 0,
        });
      }
      markiereAlle();
    }

    // ---------- Das Fenster ----------

    function baueFenster() {
      const overlay = document.createElement("div");
      overlay.className = "melde-overlay";
      overlay.id = "melde-overlay";
      overlay.hidden = true;

      const karte = document.createElement("div");
      karte.className = "melde-karte";
      karte.setAttribute("role", "dialog");
      karte.setAttribute("aria-modal", "true");
      karte.setAttribute("aria-labelledby", "melde-titel");

      const titel = document.createElement("h2");
      titel.id = "melde-titel";
      titel.textContent = "Passt was nicht?";

      const einleitung = document.createElement("p");
      einleitung.className = "melde-einleitung";
      einleitung.textContent = "Deine Rückmeldung geht an den Schiedsrichter-Obmann – "
        + "mit deinem Namen, damit er bei dir nachfragen kann.";

      const gruppe = document.createElement("fieldset");
      gruppe.className = "melde-kategorien";
      const legende = document.createElement("legend");
      legende.textContent = "Worum geht es?";
      gruppe.appendChild(legende);

      KATEGORIEN.forEach((kategorie, stelle) => {
        const label = document.createElement("label");
        label.className = "melde-kategorie";
        const feld = document.createElement("input");
        feld.type = "radio";
        feld.name = "melde-kategorie";
        feld.value = kategorie.wert;
        if (stelle === 0) feld.checked = true;
        const wort = document.createElement("span");
        wort.className = "melde-kategorie-wort";
        wort.textContent = kategorie.text;
        const hinweis = document.createElement("span");
        hinweis.className = "melde-kategorie-hinweis";
        hinweis.textContent = kategorie.hinweis;
        label.append(feld, wort, hinweis);
        gruppe.appendChild(label);
      });

      const textLabel = document.createElement("label");
      textLabel.className = "melde-text-label";
      textLabel.setAttribute("for", "melde-text");
      textLabel.textContent = "Was passt nicht?";

      const text = document.createElement("textarea");
      text.id = "melde-text";
      text.className = "melde-text";
      text.rows = 5;
      text.placeholder = "Zwei Sätze reichen.";

      const zaehler = document.createElement("p");
      zaehler.className = "melde-zaehler";
      zaehler.hidden = true;

      const hinweis = document.createElement("p");
      hinweis.className = "melde-hinweis";
      hinweis.setAttribute("role", "status");
      hinweis.hidden = true;

      const aktionen = document.createElement("div");
      aktionen.className = "melde-aktionen";
      const senden = document.createElement("button");
      senden.type = "button";
      senden.className = "melde-knopf-senden";
      senden.textContent = "Rückmeldung abschicken";
      const abbrechen = document.createElement("button");
      abbrechen.type = "button";
      abbrechen.className = "melde-knopf-abbrechen";
      abbrechen.textContent = "Abbrechen";
      aktionen.append(senden, abbrechen);

      karte.append(titel, einleitung, gruppe, textLabel, text, zaehler, hinweis, aktionen);
      overlay.appendChild(karte);
      document.body.appendChild(overlay);

      const zaehlwerk = global.SchiriZeichenZaehler
        ? global.SchiriZeichenZaehler.haengeZeichenZaehlerAn(text, zaehler, {
            grenze: GRENZE,
            abZeigen: 900,
            // Gesperrt wird erst ab dem 1001. Zeichen - und dann steht
            // direkt darueber, um wie viel gekuerzt werden muss.
            beiAenderung: (stand) => { senden.disabled = stand.zuLang; },
          })
        : null;

      return { overlay, karte, gruppe, text, zaehler, hinweis, senden, abbrechen, zaehlwerk };
    }

    function schliessen() {
      if (!fenster) return;
      dialogVersion += 1;
      fenster.overlay.hidden = true;
      document.body.classList.remove("melde-dialog-offen");
      offeneFrageId = null;
      if (vorherigerFokus && vorherigerFokus.focus) vorherigerFokus.focus();
    }

    function sageAn(nachricht, klasse) {
      fenster.hinweis.className = "melde-hinweis" + (klasse ? " " + klasse : "");
      fenster.hinweis.textContent = nachricht;
      fenster.hinweis.hidden = !nachricht;
    }

    async function abschicken() {
      // Nach dem Abschicken ist das Fenster zu und keine Frage mehr offen.
      // Ein zweiter Aufruf - egal woher - schickt dann nichts mehr los.
      if (!offeneFrageId || sendet) return;
      const zugang = typeof getZugang === "function" ? getZugang() : {};
      if (!zugang.schiedsrichterId || !zugang.pin) {
        sageAn("Dafür musst du angemeldet sein.", "melde-fehler");
        return;
      }

      const stand = fenster.zaehlwerk
        ? fenster.zaehlwerk.pruefe()
        : { leer: String(fenster.text.value || "").trim() === "", zuLang: false, zuViel: 0 };

      if (stand.leer) {
        sageAn("Schreib bitte kurz, was nicht passt.", "melde-fehler");
        return;
      }
      if (stand.zuLang) {
        sageAn(`Dein Text ist ${stand.zuViel} Zeichen zu lang. Bitte kürze ihn um ${stand.zuViel} Zeichen.`,
          "melde-fehler");
        return;
      }

      const gewaehlt = fenster.gruppe.querySelector('input[name="melde-kategorie"]:checked');
      const frageId = offeneFrageId;
      const version = dialogVersion;
      sendet = true;
      fenster.senden.disabled = true;
      sageAn("Wird abgeschickt …", "");

      let data, error;
      try {
        ({ data, error } = await sb.rpc("meldung_frage_abgeben", {
          p_schiedsrichter_id: zugang.schiedsrichterId,
          p_pin: zugang.pin,
          p_frage_id: frageId,
          p_kategorie: gewaehlt ? gewaehlt.value : "sonstiges",
          p_text: String(fenster.text.value || "").trim(),
        }));
      } catch (fehler) {
        error = fehler;
      } finally {
        sendet = false;
        fenster.senden.disabled = false;
      }

      if (error) {
        if (version !== dialogVersion) return;
        fenster.senden.disabled = false;
        sageAn("Das hat nicht geklappt: " + (error.message || "unbekannter Fehler"), "melde-fehler");
        return;
      }

      const ergebnis = Array.isArray(data) ? data[0] || {} : data || {};
      const anzahl = Number(ergebnis.anzahl_eintraege) || 1;

      // Die Frage merken, BEVOR schliessen() sie vergisst.
      meldungen.set(frageId, { status: "offen", anzahl });

      // Max am 04.09.2026: "wenn man die Rueckmeldung abgeschickt hat, soll
      // das Fenster sich einfach schliessen und dann so eine Meldung kommen
      // ... und nicht, dass das dann noch offen bleibt, dass man nochmal ein
      // Feedback schicken kann, weil das soll ja ausdruecklich nicht
      // passieren. Du hast es ja so gebaut, dass das dann ergaenzt wird -
      // aber dann muss man es halt nochmal aufrufen."
      //
      // Also: erst leerraeumen, dann zu. Ergaenzen bleibt moeglich, aber nur
      // ueber den Knopf an der Frage - ein bewusster Griff statt eines
      // zweiten Klicks auf einen stehengebliebenen Senden-Knopf.
      if (version === dialogVersion) {
        fenster.text.value = "";
        fenster.zaehler.hidden = true;
        fenster.senden.disabled = false;
        sageAn("", "");
        schliessen();
      }

      // Erst danach die Frage selbst: die Marke aktualisiert sich sofort
      // (ohne Neuladen), und daneben steht, was gerade passiert ist. Der
      // Unterschied zwischen "neu" und "ergaenzt" ist die eigentliche
      // Antwort auf "ist mein zweiter Hinweis untergegangen?".
      markiereAlle();
      zeigeBestaetigung(frageId, ergebnis.neu_angelegt
        ? "Danke – deine Rückmeldung ist angekommen."
        : `Danke – deine Rückmeldung ist angekommen und wurde zu deiner `
          + `bisherigen Meldung zu dieser Frage ergänzt. `
          + `Sie hat jetzt ${anzahl} Einträge.`);
    }

    function oeffne(frageId) {
      dialogVersion += 1;
      if (!fenster) {
        fenster = baueFenster();
        fenster.abbrechen.addEventListener("click", schliessen);
        fenster.senden.addEventListener("click", () => void abschicken());
        fenster.overlay.addEventListener("click", (ereignis) => {
          if (ereignis.target === fenster.overlay) schliessen();
        });
        // Escape schliesst, Tab bleibt im Fenster - sonst tabbt man
        // dahinter ins Quiz, das man gerade gar nicht bedienen kann.
        fenster.overlay.addEventListener("keydown", (ereignis) => {
          if (ereignis.key === "Escape") {
            ereignis.preventDefault();
            schliessen();
            return;
          }
          if (ereignis.key !== "Tab") return;
          const ziele = Array.from(
            fenster.karte.querySelectorAll("input, textarea, button")
          ).filter((el) => !el.disabled);
          if (ziele.length === 0) return;
          ereignis.preventDefault();
          const jetzt = ziele.indexOf(document.activeElement);
          const schritt = ereignis.shiftKey ? -1 : 1;
          ziele[(jetzt + schritt + ziele.length) % ziele.length].focus();
        });
      }

      offeneFrageId = frageId;
      fenster.text.value = "";
      fenster.zaehler.hidden = true;
      fenster.senden.disabled = false;
      fenster.abbrechen.textContent = "Abbrechen";

      const bisher = meldungen.get(frageId);
      sageAn(bisher
        ? "Zu dieser Frage hast du schon etwas gemeldet. Was du jetzt schreibst, "
          + "kommt als weiterer Eintrag dazu – deine erste Meldung bleibt stehen."
        : "", "");

      vorherigerFokus = document.activeElement;
      fenster.overlay.hidden = false;
      document.body.classList.add("melde-dialog-offen");
      fenster.text.focus();
    }

    // ---------- Der Knopf ----------

    // Modulintern und ohne Ausgang nach draussen: so kann ihn niemand an
    // eine offene Frage haengen, siehe Kopfkommentar.
    function baueMeldeKnopf(frageId) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "melde-knopf";
      // Hausregel: Woerter statt blosser Icons. Das Fragezeichen begleitet
      // das Wort, es ersetzt es nicht.
      const symbol = document.createElement("span");
      symbol.className = "melde-symbol";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "❓";
      knopf.append(symbol, document.createTextNode("Passt was nicht?"));
      knopf.setAttribute("aria-label", "Passt was nicht? Rückmeldung zu dieser Frage geben");
      knopf.addEventListener("click", () => oeffne(frageId));
      return knopf;
    }

    // Die einzige Tuer nach draussen. Ohne "Warum?"-Knopf - also ohne
    // Loesung - gibt es hier gar nichts.
    function baueLoesungsAktionen(warumKnopf, frageId, istHistorie = false) {
      if (!warumKnopf) return null;
      const zeile = document.createElement("div");
      zeile.className = "loesung-aktionen";
      zeile.dataset.frageId = frageId;
      zeile.dataset.istHistorie = String(Boolean(istHistorie));
      zeile.appendChild(warumKnopf);
      zeile.appendChild(baueMeldeKnopf(frageId));
      setzeMarke(zeile);
      return zeile;
    }

    return Object.freeze({
      baueLoesungsAktionen,
      ladeEigeneMeldungen,
      markiereAlle,
    });
  }

  global.SchiriQuizFrageMeldung = Object.freeze({ erstelleFrageMeldung, KATEGORIEN, GRENZE });
})(globalThis);
