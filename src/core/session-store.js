(function stelleSessionSpeicherBereit(global) {
  "use strict";

  function erstelleSessionSpeicher(schluessel, { altesRohformatLesen = false } = {}) {
    if (!schluessel) throw new Error("Ein Session-Schlüssel ist erforderlich.");

    return Object.freeze({
      speichern(wert) {
        try {
          global.sessionStorage.setItem(schluessel, JSON.stringify(wert));
          return true;
        } catch {
          // Im privaten Browsermodus kann sessionStorage gesperrt sein. Das
          // Quiz bleibt dann nutzbar, merkt den Zustand aber nicht.
          return false;
        }
      },

      lesen() {
        try {
          const roh = global.sessionStorage.getItem(schluessel);
          if (roh === null) return null;
          try {
            return JSON.parse(roh);
          } catch {
            // Die Vereinskennung wurde in älteren Versionen als reiner Text
            // gespeichert. Dieser Fallback hält bestehende Sessions gültig.
            return altesRohformatLesen ? roh : null;
          }
        } catch {
          return null;
        }
      },

      loeschen() {
        try {
          global.sessionStorage.removeItem(schluessel);
        } catch {
          // Kein Abbruch nötig: Die aktive Sitzung funktioniert weiter.
        }
      },
    });
  }

  global.SchiriQuizSessionStore = Object.freeze({
    erstelleSessionSpeicher,
  });
})(globalThis);
