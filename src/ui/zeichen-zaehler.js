// ============================================================
//  Zeichenzaehler: warnen statt sperren
// ============================================================
//  Max am 03.09.2026: "Auf jeden Fall wuerde ich sagen, eine maximale
//  Zeichenanzahl, aber dass da auch nicht so richtig gesperrt wird."
//
//  Das ist eine genauere Vorgabe, als sie klingt. Der uebliche Weg waere
//  ein maxlength am Feld - dann hoert das Tippen mitten im Wort einfach
//  auf, ohne ein Wort der Erklaerung, und wer den Text vorher woanders
//  geschrieben und hereinkopiert hat, verliert das Ende lautlos. Genau
//  das soll hier NICHT passieren.
//
//  Deshalb:
//   - Kein maxlength. Dieses Modul entfernt ein vorhandenes sogar wieder,
//     damit es nicht spaeter jemand "zur Sicherheit" dazuschreibt.
//   - Der Zaehler taucht erst kurz vor der Grenze auf (Vorgabe: ab 90 %).
//     Ein Zaehler, der von Zeichen eins an mitlaeuft, ist bei einem Feld
//     fuer zwei Saetze nur Druck.
//   - Ueber der Grenze sagt er, WIE VIELE Zeichen zu viel sind. "Zu lang"
//     allein zwingt zum Raten.
//   - Erst dann - ab dem 1001. Zeichen - darf der Aufrufer das Absenden
//     sperren. Die Datenbank lehnt laengere Texte ohnehin ab (CHECK), und
//     eine Fehlermeldung vom Server, nachdem der Text weg ist, waere das
//     schlechteste aller Enden.
//
//  Klassisches Skript und kein ES-Modul, weil es beides bedienen muss:
//  das Quiz laedt klassische Skripte (frage-melden.js), die Vereinsseite
//  ein Modul (melden-seite.js), das sich den Baustein wie die Anmeldung
//  ueber globalThis holt. Eine zweite Kopie der Regel waere die Stelle,
//  an der die beiden Formulare auseinanderlaufen.
// ============================================================

(function stelleZeichenZaehlerBereit(global) {
  "use strict";

  function haengeZeichenZaehlerAn(feld, anzeige, einstellungen) {
    const { grenze, abZeigen, beiAenderung } = einstellungen || {};
    if (!feld || !anzeige || !grenze) return null;

    // Ab wann der Zaehler sichtbar wird. 90 % der Grenze - bei 1000
    // Zeichen also ab 900, genau die Zahl aus Max' Vorgabe.
    const schwelle = abZeigen || Math.round(grenze * 0.9);

    // Falls doch jemand ein maxlength ins HTML schreibt: weg damit. Sonst
    // waere die Warnung unerreichbar, weil das Feld vorher dichtmacht.
    if (typeof feld.removeAttribute === "function") feld.removeAttribute("maxlength");

    function pruefe() {
      const text = String(feld.value || "");
      const laenge = text.length;
      const zuViel = Math.max(0, laenge - grenze);

      anzeige.hidden = laenge < schwelle;
      anzeige.classList.toggle("zu-lang", zuViel > 0);
      anzeige.textContent = zuViel > 0
        ? `${laenge} Zeichen – das sind ${zuViel} zu viel. Bitte kürze den Text.`
        : `${laenge} von ${grenze} Zeichen`;

      const stand = {
        laenge,
        zuViel,
        zuLang: zuViel > 0,
        leer: text.trim() === "",
      };
      if (typeof beiAenderung === "function") beiAenderung(stand);
      return stand;
    }

    feld.addEventListener("input", pruefe);
    return { pruefe };
  }

  global.SchiriZeichenZaehler = Object.freeze({ haengeZeichenZaehlerAn });
})(globalThis);
