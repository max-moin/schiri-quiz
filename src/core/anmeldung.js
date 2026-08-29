// ============================================================
//  Anmeldung - eine Stelle fuer die ganze Vereinsseite
// ============================================================
//  Bis zum 29.08.2026 gab es die Anmeldung nur auf quiz.html, fest
//  eingebaut in die Login-Karte dort. Max' Vorgabe an diesem Tag:
//  "dass wir das so machen, dass der Login ausgelagert wird, nicht mehr
//  nur auf der Quizseite, sondern fuer die generelle Seite."
//
//  Diese Datei haelt deshalb NUR den Zustand und die Serveraufrufe. Wie
//  das Anmeldefenster aussieht, steht in src/ui/login-dialog.js; wo der
//  Knopf im Kopf sitzt, in seite.js. So kann jede Seite anmelden, ohne
//  eine Zeile Anmeldelogik zu kennen.
//
//  Bewusste Entscheidungen (Max, 29.08.2026):
//
//  1. Die PIN bleibt das Zugangsmittel. Sie ist kein Konto: jede der rund
//     zwanzig Datenbankfunktionen bekommt sie bei JEDEM Aufruf mit, und
//     dieselben Funktionen nutzt die Swift-App. Echte Konten mit Google-
//     oder Apple-Anmeldung waeren deshalb ein eigener, grosser Umbau -
//     ausdruecklich auf spaeter verschoben.
//
//  2. Gespeichert wird in sessionStorage, nicht in localStorage. Beim
//     Schliessen des Tabs ist man abgemeldet. Der uebliche Weg waere
//     "angemeldet bleiben" - der hiesse hier aber, die PIN dauerhaft auf
//     der Festplatte abzulegen, weil sie und nicht ein Sitzungsschluessel
//     das Zugangsmittel ist. Solange das so ist, bleibt es beim Tab.
//     Seitenwechsel innerhalb desselben Tabs behaelt die Anmeldung -
//     genau das macht die seitenweite Anmeldung ueberhaupt moeglich.
//
//  3. Die Schluesselnamen sind absichtlich dieselben wie bisher in
//     app.js. Eine im Quiz begonnene Sitzung gilt damit auch auf der
//     Vereinsseite und umgekehrt - ohne Umzug bestehender Sitzungen.
// ============================================================

(function stelleAnmeldungBereit(global) {
  "use strict";

  const SCHLUESSEL_SITZUNG = "schiriQuizSession";
  const SCHLUESSEL_KENNUNG = "schiriQuizVereinskennung";

  function leseRoh(schluessel, { altesRohformatLesen = false } = {}) {
    try {
      const roh = global.sessionStorage.getItem(schluessel);
      if (roh === null) return null;
      try {
        return JSON.parse(roh);
      } catch {
        // Die Vereinskennung lag in aelteren Fassungen als reiner Text
        // vor. Ohne diesen Rueckfall wuerde eine laufende Sitzung beim
        // Ausrollen dieser Datei stillschweigend verloren gehen.
        return altesRohformatLesen ? roh : null;
      }
    } catch {
      // Im privaten Modus kann sessionStorage gesperrt sein. Dann
      // funktioniert alles weiter, nur ohne Gedaechtnis.
      return null;
    }
  }

  function schreibeRoh(schluessel, wert) {
    try {
      global.sessionStorage.setItem(schluessel, JSON.stringify(wert));
      return true;
    } catch {
      return false;
    }
  }

  function loescheRoh(schluessel) {
    try {
      global.sessionStorage.removeItem(schluessel);
    } catch {
      // Kein Abbruch noetig - die laufende Sitzung bleibt nutzbar.
    }
  }

  function erstelleAnmeldung({ adresse, oeffentlicherSchluessel }) {
    if (!adresse || !oeffentlicherSchluessel) {
      throw new Error("Anmeldung braucht Adresse und oeffentlichen Schluessel.");
    }

    const zuhoerer = new Set();

    function melde() {
      const stand = lesen();
      // Kopie je Zuhoerer: sonst koennte ein Zuhoerer das Objekt aendern
      // und der naechste bekaeme den veraenderten Stand.
      zuhoerer.forEach((rueckruf) => {
        try {
          rueckruf(stand ? { ...stand } : null);
        } catch {
          // Ein fehlerhafter Zuhoerer darf die anderen nicht aufhalten.
        }
      });
    }

    // Ein einziger Weg zum Server. Bewusst ohne die Supabase-Bibliothek:
    // die Vereinsseiten laden sie nicht, und fuer drei Aufrufe lohnt sich
    // kein zusaetzliches Skript auf jeder Seite.
    async function rufe(name, parameter) {
      const antwort = await global.fetch(`${adresse}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: oeffentlicherSchluessel,
          Authorization: `Bearer ${oeffentlicherSchluessel}`,
        },
        body: JSON.stringify(parameter),
      });
      if (!antwort.ok) {
        throw new Error(`Server antwortet mit ${antwort.status}`);
      }
      return antwort.json();
    }

    // ---------- Zustand ----------

    function lesen() {
      const stand = leseRoh(SCHLUESSEL_SITZUNG);
      if (!stand || !stand.id || !stand.pin) return null;
      return stand;
    }

    const istAngemeldet = () => lesen() !== null;

    function leseKennung() {
      return leseRoh(SCHLUESSEL_KENNUNG, { altesRohformatLesen: true });
    }

    function merkeKennung(kennung) {
      schreibeRoh(SCHLUESSEL_KENNUNG, kennung);
    }

    function vergissKennung() {
      loescheRoh(SCHLUESSEL_KENNUNG);
    }

    function abmelden() {
      loescheRoh(SCHLUESSEL_SITZUNG);
      // Die Vereinskennung bleibt bewusst stehen. Sie ist kein
      // persoenliches Merkmal, und wer sich abmeldet, will sich in aller
      // Regel gleich als jemand anderes anmelden - nicht die Kennung des
      // eigenen Vereins neu tippen.
      melde();
    }

    function abonniere(rueckruf) {
      zuhoerer.add(rueckruf);
      rueckruf(lesen());
      return () => zuhoerer.delete(rueckruf);
    }

    // ---------- Serverschritte ----------

    // Prueft die Vereinskennung und sagt zugleich, wie der Verein heisst
    // und ob er eine Namensliste herausgibt.
    async function pruefeKennung(kennung) {
      const daten = await rufe("verein_zugang", { p_kennung: String(kennung || "").trim() });
      const zugang = Array.isArray(daten) ? daten[0] : daten;
      if (!zugang || !zugang.gefunden) return null;
      return {
        vereinName: zugang.verein_name || "",
        zeigtNamensliste: zugang.namensliste_anzeigen !== false,
      };
    }

    // Nur der Server entscheidet, ob und welche Namen herausgehen. Ohne
    // gueltige Kennung kommt bewusst eine leere Antwort.
    async function ladeNamen(kennung) {
      const daten = await rufe("schiri_liste", { p_kennung: String(kennung || "").trim() });
      return Array.isArray(daten) ? daten : [];
    }

    // Bei falscher Kennung, falschem Namen, falscher PIN und gesperrtem
    // Zugang antwortet der Server absichtlich gleich. Diese Funktion darf
    // die Faelle deshalb auch nicht auseinanderhalten - sonst liesse sich
    // durch Ausprobieren herausfinden, wer im Verein ueberhaupt dabei ist.
    async function meldeAn({ kennung, name, pin }) {
      const daten = await rufe("schiri_anmelden", {
        p_kennung: String(kennung || "").trim(),
        p_name: String(name || "").trim(),
        p_pin: String(pin || "").trim(),
      });
      const treffer = Array.isArray(daten) ? daten[0] : daten;
      if (!treffer || !treffer.schiedsrichter_id) return null;

      // Den vom Server gelieferten Namen uebernehmen, nicht den getippten -
      // sonst stuende bei abweichender Gross-/Kleinschreibung die Eingabe
      // in der Begruessung statt des hinterlegten Namens.
      const stand = {
        id: treffer.schiedsrichter_id,
        pin: String(pin || "").trim(),
        name: treffer.name || String(name || "").trim(),
      };
      schreibeRoh(SCHLUESSEL_SITZUNG, stand);
      merkeKennung(String(kennung || "").trim());
      melde();
      return { ...stand };
    }

    return Object.freeze({
      lesen,
      istAngemeldet,
      abmelden,
      abonniere,
      leseKennung,
      merkeKennung,
      vergissKennung,
      pruefeKennung,
      ladeNamen,
      meldeAn,
    });
  }

  global.SchiriAnmeldung = Object.freeze({ erstelleAnmeldung });
})(globalThis);
