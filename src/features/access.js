(function stelleZugangBereit(global) {
  "use strict";

  function erstelleZugang({
    sb,
    mitgliedSession,
    kennungSession,
    gastController,
    zeigeFehler,
    versteckeFehler,
    verdecke,
    initialisiereMaskierteFelder,
    verbindeSichtbarkeit,
    setZugang,
    beiAngemeldet,
    beiStatusPruefen,
  }) {
    const nameAuswahl = document.getElementById("name-auswahl");
    const nameEingabe = document.getElementById("name-eingabe");
    const namenslisteBereich = document.getElementById("namensliste-bereich");
    const namenseingabeBereich = document.getElementById("namenseingabe-bereich");
    const pinEingabe = document.getElementById("pin-eingabe");
    const startButton = document.getElementById("start-button");
    const nameSchritt = document.getElementById("name-schritt");
    const angemeldetLeiste = document.getElementById("angemeldet-leiste");
    const angemeldetName = document.getElementById("angemeldet-name");
    const fragenSchritt = document.getElementById("fragen-schritt");
    const fortschrittWrap = document.getElementById("fortschritt-wrap");
    const kennungBereich = document.getElementById("kennung-bereich");
    const kennungEingabe = document.getElementById("kennung-eingabe");
    const kennungAugeButton = document.getElementById("kennung-auge-button");
    const kennungWeiterButton = document.getElementById("kennung-weiter-button");
    const kennungHinweis = document.getElementById("kennung-hinweis");
    const gastWechselButton = document.getElementById("gast-wechsel-button");
    const mitgliedBereich = document.getElementById("mitglied-bereich");
    const gastBereich = document.getElementById("gast-bereich");
    const gastNameEingabe = document.getElementById("gast-name-eingabe");
    const gastZurueckButton = document.getElementById("gast-zurueck-button");

    let loginModus = "kennung";
    let aktuelleKennung = null;
    let vereinZeigtNamensliste = true;

    initialisiereMaskierteFelder();
    verbindeSichtbarkeit(kennungEingabe, kennungAugeButton, {
      anzeigenText: "Vereinskennung anzeigen",
      verbergenText: "Vereinskennung verbergen",
    });

    function zeigeAngemeldetenZustand(name) {
      nameSchritt.hidden = true;
      angemeldetName.textContent = name;
      angemeldetLeiste.hidden = false;
      fragenSchritt.hidden = false;
      fortschrittWrap.hidden = false;
      // Baustein 5a: prüft im Hintergrund, ob es Neuigkeiten zu bestehenden
      // Anfragen gibt (Status-Punkt am Profil-Badge) - bewusst "fire and
      // forget", damit das Login nicht auf diesen Zusatz-Request warten muss.
      void beiStatusPruefen();
    }

    // Lädt die Namensliste des Vereins zur bestätigten Kennung.
    //
    // Vorher las diese Funktion die View "schiedsrichter_oeffentlich" direkt.
    // Die kannte keinen Verein und gab die Namen ALLER Schiedsrichter heraus -
    // auch ohne jede Kennung. Jetzt entscheidet der Server anhand der Kennung,
    // ob und welche Namen herausgehen; bei Vereinen ohne Liste kommt bewusst
    // eine leere Antwort zurück.
    async function ladeSchiedsrichter(kennung) {
      nameAuswahl.length = 1; // alles außer "– bitte auswählen –" verwerfen

      if (!kennung) return;

      const { data, error } = await sb.rpc("schiri_liste", { p_kennung: kennung });

      if (error) {
        zeigeFehler("Namensliste konnte nicht geladen werden: " + error.message);
        return;
      }

      for (const person of data || []) {
        const option = document.createElement("option");
        option.value = person.id;
        option.textContent = person.name;
        nameAuswahl.appendChild(option);
      }
    }

    function pruefeEingabenVollstaendig() {
      // Update (13.07.2026, Baustein A/B): der gemeinsame "Los geht's"-Button
      // gilt je nach "loginModus" für unterschiedliche Felder - im
      // "kennung"-Zustand ist er ohnehin unsichtbar (siehe zeigeMitgliedBereich/
      // zeigeGastBereich), daher hier einfach dauerhaft deaktiviert lassen.
      if (loginModus === "gast") {
        startButton.disabled = !gastController.istStartbereit();
      } else if (loginModus === "mitglied") {
        // Je nach Verein zählt entweder die Auswahlliste oder das Namensfeld.
        const nameDa = vereinZeigtNamensliste
          ? !!nameAuswahl.value
          : nameEingabe.value.trim().length > 0;
        startButton.disabled = !(nameDa && pinEingabe.value.trim().length > 0);
      } else {
        startButton.disabled = true;
      }
    }

    nameAuswahl.addEventListener("change", pruefeEingabenVollstaendig);
    if (nameEingabe) nameEingabe.addEventListener("input", pruefeEingabenVollstaendig);
    pinEingabe.addEventListener("input", pruefeEingabenVollstaendig);
    gastNameEingabe.addEventListener("input", pruefeEingabenVollstaendig);

    // ============================================================
    // Vereinskennung / Gast-Zugang (13.07.2026, Baustein A/B) - siehe
    // Kopf-Kommentar in index.html für den genauen Ablauf: die Vereinskennung
    // bleibt sichtbar stehen, darunter poppt entweder der Mitglieder- oder der
    // Gast-Bereich auf, "Los geht's" ganz unten gilt für beide Wege.
    // ============================================================

    function zeigeMitgliedBereich() {
      loginModus = "mitglied";
      kennungEingabe.disabled = true;
      kennungWeiterButton.hidden = true;
      gastWechselButton.hidden = true;
      gastBereich.hidden = true;
      mitgliedBereich.hidden = false;
      startButton.hidden = false;

      // Liste oder Eingabefeld - richtet sich nach dem Verein (siehe
      // "vereinZeigtNamensliste", gesetzt aus der Serverantwort).
      if (namenslisteBereich && namenseingabeBereich) {
        namenslisteBereich.hidden = !vereinZeigtNamensliste;
        namenseingabeBereich.hidden = vereinZeigtNamensliste;
      }

      pruefeEingabenVollstaendig();
      if (!vereinZeigtNamensliste && nameEingabe) nameEingabe.focus();
    }

    function zeigeGastBereich() {
      loginModus = "gast";
      kennungBereich.hidden = true;
      mitgliedBereich.hidden = true;
      gastBereich.hidden = false;
      startButton.hidden = false;
      pruefeEingabenVollstaendig();
      gastNameEingabe.focus();
    }

    function zeigeKennungBereich() {
      loginModus = "kennung";
      kennungBereich.hidden = false;
      kennungEingabe.disabled = false;
      verdecke(kennungEingabe);
      kennungWeiterButton.hidden = false;
      gastWechselButton.hidden = false;
      mitgliedBereich.hidden = true;
      gastBereich.hidden = true;
      startButton.hidden = true;
      pruefeEingabenVollstaendig();
    }

    async function pruefeVereinskennung(kennungWert, options) {
      const ausSession = !!(options && options.ausSession);
      const kennung = kennungWert.trim();
      if (!kennung) return;

      // Feld wieder verdecken, falls gerade per Augen-Button aufgedeckt (13.07.2026).
      verdecke(kennungEingabe);

      kennungHinweis.hidden = true;
      kennungHinweis.classList.remove("hinweis-fehler", "hinweis-erfolg");
      kennungWeiterButton.disabled = true;

      // Seit dem Mehr-Vereine-Umbau (11.08.2026) reicht ein Ja/Nein nicht mehr:
      // "verein_zugang" sagt zusätzlich, wie der Verein heißt und ob er eine
      // Namensliste herausgibt.
      const { data: zugangDaten, error } = await sb.rpc("verein_zugang", { p_kennung: kennung });

      kennungWeiterButton.disabled = false;

      if (error) {
        kennungHinweis.textContent = "Kennung konnte nicht geprüft werden: " + error.message;
        kennungHinweis.classList.add("hinweis-fehler");
        kennungHinweis.hidden = false;
        return;
      }

      const zugang = Array.isArray(zugangDaten) ? zugangDaten[0] : zugangDaten;
      const istOk = !!(zugang && zugang.gefunden);

      if (!istOk) {
        if (ausSession) {
          // Eine gespeicherte Kennung, die jetzt nicht mehr gültig ist (z.B.
          // zwischenzeitlich geändert) - Session verwerfen, normal von vorn
          // starten, kein Fehler-Hinweis nötig (Person hat ja nichts falsch
          // gemacht).
          kennungSession.loeschen();
          return;
        }
        kennungHinweis.textContent = "Diese Vereinskennung ist uns nicht bekannt.";
        kennungHinweis.classList.add("hinweis-fehler");
        kennungHinweis.hidden = false;
        kennungEingabe.value = "";
        kennungEingabe.focus();
        return;
      }

      aktuelleKennung = kennung;
      vereinZeigtNamensliste = zugang.namensliste_anzeigen !== false;

      kennungSession.speichern(kennung);
      kennungHinweis.textContent = zugang.verein_name
        ? "✓ " + zugang.verein_name
        : "✓ Vereinskennung bestätigt";
      kennungHinweis.classList.add("hinweis-erfolg");
      kennungHinweis.hidden = false;

      // Die Namensliste wird erst JETZT geladen - vorher ist gar nicht bekannt,
      // zu welchem Verein sie gehören würde. Bei Vereinen ohne Liste holt die
      // Funktion nichts und der Block bleibt ohnehin verborgen.
      if (vereinZeigtNamensliste) {
        await ladeSchiedsrichter(kennung);
      }

      zeigeMitgliedBereich();
    }

    kennungWeiterButton.addEventListener("click", () => pruefeVereinskennung(kennungEingabe.value));
    kennungEingabe.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        pruefeVereinskennung(kennungEingabe.value);
      }
    });

    gastWechselButton.addEventListener("click", () => {
      versteckeFehler();
      zeigeGastBereich();
    });

    gastZurueckButton.addEventListener("click", () => {
      versteckeFehler();
      zeigeKennungBereich();
    });

    startButton.addEventListener("click", async () => {
      if (loginModus === "gast") {
        await gastController.starte();
        return;
      }

      versteckeFehler();

      // Ein Weg für beide Vereinsarten (11.08.2026): Der Name kommt entweder
      // aus der Auswahlliste oder aus dem Eingabefeld, geprüft wird beides über
      // dieselbe RPC "schiri_anmelden". Die liefert bei falscher Kennung,
      // falschem Namen, falscher PIN und gesperrtem Zugang bewusst DIESELBE
      // Fehlermeldung - sonst könnte man durch Ausprobieren herausfinden,
      // welche Namen es in einem Verein überhaupt gibt.
      const name = vereinZeigtNamensliste
        ? (nameAuswahl.selectedIndex > 0
            ? nameAuswahl.options[nameAuswahl.selectedIndex].textContent
            : "")
        : nameEingabe.value.trim();
      const pin = pinEingabe.value.trim();
      const kennung = aktuelleKennung || kennungSession.lesen();

      if (!name || !pin || !kennung) return;

      startButton.disabled = true;
      const buttonText = startButton.querySelector("span");
      const vorherigerText = buttonText ? buttonText.textContent : null;
      if (buttonText) buttonText.textContent = "Prüfe PIN ...";

      const { data: anmeldung, error } = await sb.rpc("schiri_anmelden", {
        p_kennung: kennung,
        p_name: name,
        p_pin: pin,
      });

      if (buttonText && vorherigerText) buttonText.textContent = vorherigerText;

      const treffer = Array.isArray(anmeldung) ? anmeldung[0] : anmeldung;

      if (error || !treffer) {
        zeigeFehler(
          vereinZeigtNamensliste
            ? "PIN ist falsch. Bitte nochmal versuchen."
            : "Name oder PIN stimmt nicht. Bitte nochmal versuchen."
        );
        startButton.disabled = false;
        pinEingabe.value = "";
        pinEingabe.focus();
        return;
      }

      setZugang({ schiedsrichterId: treffer.schiedsrichter_id, pin });

      // Den vom Server zurückgegebenen Namen verwenden, nicht den getippten -
      // sonst stünde bei abweichender Groß-/Kleinschreibung die Eingabe in der
      // Begrüßung statt der tatsächlich hinterlegte Name.
      const echterName = treffer.name || name;
      mitgliedSession.speichern({ id: treffer.schiedsrichter_id, pin, name: echterName });
      zeigeAngemeldetenZustand(echterName);

      await beiAngemeldet(echterName);
    });

    // Hier stand bis zum 30.08.2026 der "Abmelden"-Knopf der Quizseite. Er
    // loeschte die Sitzung und lud die Seite neu - und landete damit
    // zwangslaeufig wieder in der quiz-eigenen Anmeldemaske. Max: "Das soll
    // halt nicht passieren."
    //
    // Abgemeldet wird jetzt ausschliesslich im Kontomenue der Kopfleiste
    // (seite.js). Das ist dieselbe Sitzung - beide Welten teilen sich die
    // Schluessel "schiriQuizSession" und "schiriQuizVereinskennung" - und es
    // gibt danach keine zweite Anmeldemaske mehr, in die man fallen kann.

    async function behandleGastVerlassen() {
      const gemerkteKennung = kennungSession.lesen();
      if (gemerkteKennung) {
        await pruefeVereinskennung(gemerkteKennung, { ausSession: true });
      } else {
        zeigeKennungBereich();
      }
    }

    async function start() {
      // Die Namensliste wird NICHT mehr blind beim Start geladen - erst wenn
      // eine Vereinskennung bestätigt ist, steht überhaupt fest, wessen Namen
      // gemeint wären (siehe pruefeVereinskennung).
      const gespeichert = mitgliedSession.lesen();
      if (gespeichert && gespeichert.id && gespeichert.pin) {
        setZugang({ schiedsrichterId: gespeichert.id, pin: gespeichert.pin });
        zeigeAngemeldetenZustand(gespeichert.name || "");
        await beiAngemeldet(gespeichert.name || "");
        return;
      }

      // Vereinskennung (13.07.2026, Baustein A): eine schon einmal bestätigte
      // Kennung wird gemerkt, damit man nicht bei jedem Neuladen erneut tippen
      // muss - wird aber sicherheitshalber erneut serverseitig geprüft (falls
      // sie sich zwischenzeitlich geändert hat), nicht blind übernommen.
      const gespeicherteKennung = kennungSession.lesen();
      if (gespeicherteKennung) {
        kennungEingabe.value = gespeicherteKennung;
        await pruefeVereinskennung(gespeicherteKennung, { ausSession: true });
      }
    }

    return Object.freeze({ start, behandleGastVerlassen });
  }

  global.SchiriQuizAccess = Object.freeze({ erstelleZugang });
})(globalThis);
