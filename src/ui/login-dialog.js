// ============================================================
//  Anmeldefenster - einmal gebaut, von jeder Seite aufrufbar
// ============================================================
//  Max am 29.08.2026, woertlich: "nicht so, dass es auf der Quizseite
//  integriert ist, wie jetzt, sondern so, dass es wie ein Pop-up-Fenster
//  designt wird, das universal gemacht wird, wenn Login gefordert wird.
//  Wenn du ein Login brauchst, wird das Login-Fenster aufgeblockt, ausser
//  du bist schon eingeloggt."
//
//  Genau das ist die Schnittstelle: oeffne() liefert ein Versprechen, das
//  sagt, wie es ausgegangen ist. Die aufrufende Seite muss nichts ueber
//  Vereinskennung, Namensliste oder PIN wissen.
//
//  Zwei Punkte, die aus aelteren Entscheidungen stammen und hier bewusst
//  weitergefuehrt werden:
//
//  - KEIN type="password" fuer Kennung und PIN. Safari und iOS blenden bei
//    jedem echten Passwortfeld ungefragt den "Starkes Passwort
//    verwenden"-Vorschlag ein und ignorieren dabei autocomplete="off".
//    Fuer eine vierstellige PIN ist das nur verwirrend, besonders fuer
//    aeltere Nutzer (Begruendung vom 10.08.2026, siehe style.css).
//    Die Felder werden deshalb nur optisch maskiert; kann der Browser das
//    nicht, schaltet masked-input.js sie doch auf type="password" um.
//
//  - Der Gastweg ist ein richtiger Knopf, kein Textlink. Max am
//    29.08.2026: "nicht so, dass es nur als Textklickfeld ist, sondern
//    wirklich als Button."
// ============================================================

(function stelleLoginDialogBereit(global) {
  "use strict";

  const GERUEST = `
    <div class="anmelde-karte">
      <button type="button" class="anmelde-schliessen" data-schliessen aria-label="Anmeldefenster schliessen">&times;</button>

      <h2 class="anmelde-titel" data-titel>Anmelden</h2>
      <p class="anmelde-grund" data-grund hidden></p>

      <div class="anmelde-schritt" data-schritt="kennung">
        <label class="anmelde-feld">
          <span class="anmelde-bezeichnung">Vereinskennung</span>
          <span class="anmelde-eingabezeile">
            <input data-feld="kennung" type="text" class="maskiert" autocomplete="one-time-code"
                   autocapitalize="none" spellcheck="false" data-gramm="false"
                   placeholder="Vereinskennung" />
            <button type="button" class="anmelde-zeigen" data-zeigen="kennung">Anzeigen</button>
          </span>
        </label>
        <button type="button" class="anmelde-haupt" data-weiter>Weiter</button>
      </div>

      <div class="anmelde-schritt" data-schritt="mitglied" hidden>
        <p class="anmelde-verein" data-vereinname hidden></p>

        <label class="anmelde-feld" data-block="liste">
          <span class="anmelde-bezeichnung">Wer bist du?</span>
          <select data-feld="name-auswahl">
            <option value="">&ndash; bitte ausw&auml;hlen &ndash;</option>
          </select>
        </label>

        <label class="anmelde-feld" data-block="eingabe" hidden>
          <span class="anmelde-bezeichnung">Dein Name</span>
          <input data-feld="name-eingabe" type="text" autocomplete="off" spellcheck="false"
                 data-gramm="false" placeholder="so wie du eingetragen bist" />
        </label>

        <label class="anmelde-feld">
          <span class="anmelde-bezeichnung">Deine PIN</span>
          <span class="anmelde-eingabezeile">
            <input data-feld="pin" type="text" class="maskiert" inputmode="numeric"
                   autocomplete="one-time-code" spellcheck="false" data-gramm="false"
                   placeholder="z.B. 1234" />
            <button type="button" class="anmelde-zeigen" data-zeigen="pin">Anzeigen</button>
          </span>
        </label>

        <button type="button" class="anmelde-haupt" data-anmelden disabled>Anmelden</button>
        <button type="button" class="anmelde-zurueck" data-kennung-aendern>Andere Vereinskennung</button>
      </div>

      <p class="anmelde-fehler" data-fehler hidden role="alert"></p>

      <div class="anmelde-gast" data-gastbereich hidden>
        <p class="anmelde-trenner"><span>oder</span></p>
        <button type="button" class="anmelde-gastknopf" data-gast>Ohne Anmeldung ansehen</button>
        <p class="anmelde-gasthinweis">Ein paar Fragen zum Ausprobieren &ndash; ohne PIN, ohne Konto.</p>
      </div>

      <p class="anmelde-hilfe">Deine PIN kennst nur du &ndash; frag beim Obmann nach, falls du sie noch nicht hast.</p>
    </div>`;

  function erstelleLoginDialog({ anmeldung, maskierung }) {
    let dialog = null;
    let teile = null;
    let aufloesen = null;
    let zeigtNamensliste = true;
    let bestaetigteKennung = null;

    function baue() {
      if (dialog) return;
      dialog = document.createElement("dialog");
      dialog.className = "anmeldedialog";
      dialog.innerHTML = GERUEST;
      document.body.appendChild(dialog);

      const hole = (auswahl) => dialog.querySelector(auswahl);
      teile = {
        titel: hole("[data-titel]"),
        grund: hole("[data-grund]"),
        schrittKennung: hole('[data-schritt="kennung"]'),
        schrittMitglied: hole('[data-schritt="mitglied"]'),
        kennung: hole('[data-feld="kennung"]'),
        weiter: hole("[data-weiter]"),
        vereinname: hole("[data-vereinname]"),
        blockListe: hole('[data-block="liste"]'),
        blockEingabe: hole('[data-block="eingabe"]'),
        auswahl: hole('[data-feld="name-auswahl"]'),
        nameEingabe: hole('[data-feld="name-eingabe"]'),
        pin: hole('[data-feld="pin"]'),
        anmeldenKnopf: hole("[data-anmelden]"),
        kennungAendern: hole("[data-kennung-aendern]"),
        fehler: hole("[data-fehler]"),
        gastbereich: hole("[data-gastbereich]"),
        gastKnopf: hole("[data-gast]"),
        schliessen: hole("[data-schliessen]"),
      };

      // Erst jetzt, nachdem das Markup im Dokument steht: faellt der
      // Browser bei der optischen Maskierung durch, werden die Felder
      // hier auf type="password" umgestellt.
      maskierung.initialisiereMaskierteFelder();
      verbindeZeigen(teile.kennung, hole('[data-zeigen="kennung"]'), "Vereinskennung");
      verbindeZeigen(teile.pin, hole('[data-zeigen="pin"]'), "PIN");

      teile.weiter.addEventListener("click", () => void pruefeKennungSchritt(teile.kennung.value));
      teile.kennung.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        void pruefeKennungSchritt(teile.kennung.value);
      });

      teile.auswahl.addEventListener("change", pruefeVollstaendig);
      teile.nameEingabe.addEventListener("input", pruefeVollstaendig);
      teile.pin.addEventListener("input", pruefeVollstaendig);
      teile.pin.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || teile.anmeldenKnopf.disabled) return;
        e.preventDefault();
        void meldeAn();
      });

      teile.anmeldenKnopf.addEventListener("click", () => void meldeAn());
      teile.kennungAendern.addEventListener("click", () => {
        anmeldung.vergissKennung();
        bestaetigteKennung = null;
        teile.kennung.value = "";
        zeigeSchritt("kennung");
        teile.kennung.focus();
      });

      teile.gastKnopf.addEventListener("click", () => schliesse({ status: "gast" }));
      teile.schliessen.addEventListener("click", () => schliesse({ status: "abgebrochen" }));

      // Escape und Klick auf den Hintergrund sollen dasselbe tun wie das
      // Kreuz: abbrechen. Ohne das "cancel"-Ereignis bliebe das Versprechen
      // bei Escape fuer immer offen - die aufrufende Seite wuerde dann
      // stillschweigend nie weiterlaufen.
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        schliesse({ status: "abgebrochen" });
      });
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) schliesse({ status: "abgebrochen" });
      });
    }

    function verbindeZeigen(feld, knopf, bezeichnung) {
      if (!feld || !knopf) return;
      maskierung.verbindeSichtbarkeit(feld, knopf, {
        anzeigenText: bezeichnung + " anzeigen",
        verbergenText: bezeichnung + " verbergen",
      });
      // Wortmarke statt Augensymbol (Hausregel "Woerter statt Icons"):
      // der Text muss dem Zustand folgen, den masked-input.js setzt.
      knopf.addEventListener("click", () => {
        knopf.textContent = knopf.getAttribute("aria-pressed") === "true" ? "Verbergen" : "Anzeigen";
      });
      feld.addEventListener("input", () => { knopf.textContent = "Anzeigen"; });
    }

    function zeigeFehler(text) {
      teile.fehler.textContent = text;
      teile.fehler.hidden = false;
    }

    function versteckeFehler() {
      teile.fehler.hidden = true;
    }

    function zeigeSchritt(name) {
      versteckeFehler();
      teile.schrittKennung.hidden = name !== "kennung";
      teile.schrittMitglied.hidden = name !== "mitglied";
    }

    function pruefeVollstaendig() {
      const nameDa = zeigtNamensliste
        ? !!teile.auswahl.value
        : teile.nameEingabe.value.trim().length > 0;
      teile.anmeldenKnopf.disabled = !(nameDa && teile.pin.value.trim().length > 0);
    }

    // "ausSession" heisst: die Kennung kam aus dem Gedaechtnis, nicht aus
    // der Tastatur. Ist sie inzwischen ungueltig, hat die Person nichts
    // falsch gemacht - dann still zum ersten Schritt zurueck statt einen
    // Fehler anzuzeigen, den niemand verursacht hat.
    async function pruefeKennungSchritt(wert, { ausSession = false } = {}) {
      const kennung = String(wert || "").trim();
      if (!kennung) return;

      maskierung.verdecke(teile.kennung);
      versteckeFehler();
      teile.weiter.disabled = true;

      let zugang = null;
      try {
        zugang = await anmeldung.pruefeKennung(kennung);
      } catch (fehler) {
        teile.weiter.disabled = false;
        if (ausSession) { zeigeSchritt("kennung"); return; }
        zeigeFehler("Kennung konnte nicht geprüft werden: " + fehler.message);
        return;
      }
      teile.weiter.disabled = false;

      if (!zugang) {
        anmeldung.vergissKennung();
        if (ausSession) { zeigeSchritt("kennung"); return; }
        zeigeFehler("Diese Vereinskennung ist uns nicht bekannt.");
        teile.kennung.value = "";
        teile.kennung.focus();
        return;
      }

      bestaetigteKennung = kennung;
      anmeldung.merkeKennung(kennung);
      zeigtNamensliste = zugang.zeigtNamensliste;

      teile.vereinname.textContent = zugang.vereinName;
      teile.vereinname.hidden = !zugang.vereinName;
      teile.blockListe.hidden = !zeigtNamensliste;
      teile.blockEingabe.hidden = zeigtNamensliste;

      if (zeigtNamensliste) {
        // Erst jetzt laden: vorher steht gar nicht fest, wessen Namen
        // gemeint waeren.
        teile.auswahl.length = 1;
        try {
          for (const person of await anmeldung.ladeNamen(kennung)) {
            const option = document.createElement("option");
            option.value = person.id;
            option.textContent = person.name;
            teile.auswahl.appendChild(option);
          }
        } catch (fehler) {
          zeigeFehler("Namensliste konnte nicht geladen werden: " + fehler.message);
        }
      }

      zeigeSchritt("mitglied");
      pruefeVollstaendig();
      if (zeigtNamensliste) teile.auswahl.focus();
      else teile.nameEingabe.focus();
    }

    async function meldeAn() {
      versteckeFehler();
      const name = zeigtNamensliste
        ? (teile.auswahl.selectedIndex > 0
            ? teile.auswahl.options[teile.auswahl.selectedIndex].textContent
            : "")
        : teile.nameEingabe.value.trim();
      const pin = teile.pin.value.trim();
      const kennung = bestaetigteKennung || anmeldung.leseKennung();
      if (!name || !pin || !kennung) return;

      teile.anmeldenKnopf.disabled = true;
      const vorher = teile.anmeldenKnopf.textContent;
      teile.anmeldenKnopf.textContent = "Prüfe PIN …";

      let stand = null;
      try {
        stand = await anmeldung.meldeAn({ kennung, name, pin });
      } catch (fehler) {
        teile.anmeldenKnopf.textContent = vorher;
        teile.anmeldenKnopf.disabled = false;
        zeigeFehler("Anmeldung fehlgeschlagen: " + fehler.message);
        return;
      }

      teile.anmeldenKnopf.textContent = vorher;

      if (!stand) {
        // Absichtlich EINE Meldung fuer alle Fehlerfaelle - siehe
        // anmeldung.js. Bei Vereinen mit Namensliste kann der Name nicht
        // falsch sein, dort darf die Meldung deutlicher werden.
        zeigeFehler(zeigtNamensliste
          ? "PIN ist falsch. Bitte nochmal versuchen."
          : "Name oder PIN stimmt nicht. Bitte nochmal versuchen.");
        teile.pin.value = "";
        teile.pin.focus();
        pruefeVollstaendig();
        return;
      }

      schliesse({ status: "angemeldet", person: stand });
    }

    function schliesse(ergebnis) {
      // Felder leeren, bevor das Fenster zugeht: die PIN soll nicht im
      // geschlossenen Dialog im Dokument stehen bleiben.
      if (teile) {
        teile.pin.value = "";
        teile.anmeldenKnopf.disabled = true;
      }
      if (dialog && dialog.open) dialog.close();
      const fertig = aufloesen;
      aufloesen = null;
      if (fertig) fertig(ergebnis);
    }

    async function oeffne({ grund = "", gastErlaubt = false } = {}) {
      // Schon angemeldet: gar nicht erst aufmachen. Genau Max' Vorgabe -
      // "ausser du bist schon eingeloggt, dann wird das gleich uebernommen".
      const bestehend = anmeldung.lesen();
      if (bestehend) return { status: "angemeldet", person: bestehend };

      baue();

      // Ein zweiter Aufruf, waehrend das Fenster noch offen steht, wuerde
      // sonst das erste Versprechen ueberschreiben und den ersten Aufrufer
      // fuer immer warten lassen.
      if (aufloesen) schliesse({ status: "abgebrochen" });

      teile.grund.textContent = grund;
      teile.grund.hidden = !grund;
      teile.gastbereich.hidden = !gastErlaubt;
      teile.pin.value = "";
      teile.auswahl.selectedIndex = 0;
      teile.nameEingabe.value = "";
      versteckeFehler();
      pruefeVollstaendig();

      const gemerkt = anmeldung.leseKennung();
      if (gemerkt) {
        teile.kennung.value = gemerkt;
        zeigeSchritt("mitglied");
      } else {
        zeigeSchritt("kennung");
      }

      const versprechen = new Promise((fertig) => { aufloesen = fertig; });
      dialog.showModal();

      if (gemerkt) {
        // Eine gemerkte Kennung wird trotzdem erneut serverseitig geprueft,
        // nicht blind uebernommen - sie kann sich zwischenzeitlich geaendert
        // haben. Laeuft parallel zum Oeffnen, damit das Fenster nicht
        // verzoegert erscheint.
        void pruefeKennungSchritt(gemerkt, { ausSession: true });
      } else {
        teile.kennung.focus();
      }

      return versprechen;
    }

    return Object.freeze({ oeffne });
  }

  global.SchiriLoginDialog = Object.freeze({ erstelleLoginDialog });
})(globalThis);
