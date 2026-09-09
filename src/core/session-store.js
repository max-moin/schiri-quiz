(function stelleSessionSpeicherBereit(global) {
  "use strict";

  function erstelleSessionSpeicher(schluessel, {
    altesRohformatLesen = false,
    dauerhafterSchluessel = null,
    gueltigkeitMs = 30 * 24 * 60 * 60 * 1000,
  } = {}) {
    if (!schluessel) throw new Error("Ein Session-Schlüssel ist erforderlich.");

    return Object.freeze({
      speichern(wert, { dauerhaft = false } = {}) {
        let sessionGespeichert = false;
        try {
          global.sessionStorage.setItem(schluessel, JSON.stringify(wert));
          sessionGespeichert = true;
        } catch {
          // Im privaten Browsermodus kann sessionStorage gesperrt sein. Das
          // Quiz bleibt dann nutzbar, merkt den Zustand aber nicht.
        }
        if (dauerhafterSchluessel) {
          try {
            if (dauerhaft) {
              global.localStorage.setItem(dauerhafterSchluessel, JSON.stringify({
                gueltigBis: Date.now() + gueltigkeitMs,
                wert,
              }));
            } else {
              global.localStorage.removeItem(dauerhafterSchluessel);
            }
          } catch { /* privater Browsermodus: Sitzung bleibt trotzdem nutzbar */ }
        }
        return sessionGespeichert;
      },

      lesen() {
        try {
          const roh = global.sessionStorage.getItem(schluessel);
          if (roh !== null) {
            try {
              return JSON.parse(roh);
            } catch {
              return altesRohformatLesen ? roh : null;
            }
          }
        } catch { /* danach noch den freiwilligen Gerätespeicher prüfen */ }

        if (!dauerhafterSchluessel) return null;
        try {
          const dauerhaft = JSON.parse(global.localStorage.getItem(dauerhafterSchluessel));
          if (!dauerhaft?.wert || !Number.isFinite(dauerhaft.gueltigBis) || dauerhaft.gueltigBis <= Date.now()) {
            global.localStorage.removeItem(dauerhafterSchluessel);
            return null;
          }
          try {
            global.sessionStorage.setItem(schluessel, JSON.stringify(dauerhaft.wert));
          } catch { /* dauerhaft gelesener Zugang bleibt direkt nutzbar */ }
          return dauerhaft.wert;
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
        if (dauerhafterSchluessel) {
          try { global.localStorage.removeItem(dauerhafterSchluessel); } catch { /* nichts weiter */ }
        }
      },
    });
  }

  global.SchiriQuizSessionStore = Object.freeze({
    erstelleSessionSpeicher,
  });
})(globalThis);
