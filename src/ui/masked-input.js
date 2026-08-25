(function stelleMaskierteEingabenBereit(global) {
  "use strict";

  const maskierungMoeglich =
    typeof global.CSS !== "undefined" &&
    typeof global.CSS.supports === "function" &&
    (global.CSS.supports("-webkit-text-security", "disc") ||
      global.CSS.supports("text-security", "disc"));

  function initialisiereMaskierteFelder() {
    if (maskierungMoeglich) return;
    document.querySelectorAll("input.maskiert").forEach((feld) => {
      feld.classList.remove("maskiert");
      feld.type = "password";
    });
  }

  function istAufgedeckt(feld) {
    return feld.classList.contains("maskiert")
      ? feld.classList.contains("sichtbar")
      : feld.type === "text";
  }

  function aufdecken(feld) {
    if (feld.classList.contains("maskiert")) {
      feld.classList.add("sichtbar");
    } else {
      feld.type = "text";
    }
  }

  function verdecke(feld) {
    if (feld.classList.contains("maskiert")) {
      feld.classList.remove("sichtbar");
    } else {
      feld.type = "password";
    }
  }

  function verbindeSichtbarkeit(feld, button, {
    anzeigenText = "Eingabe anzeigen",
    verbergenText = "Eingabe verbergen",
  } = {}) {
    if (!feld || !button) return;

    function setzeButtonZustand(sichtbar) {
      button.setAttribute("aria-pressed", String(sichtbar));
      button.setAttribute("aria-label", sichtbar ? verbergenText : anzeigenText);
    }

    button.addEventListener("click", () => {
      const wirdSichtbar = !istAufgedeckt(feld);
      if (wirdSichtbar) aufdecken(feld);
      else verdecke(feld);
      setzeButtonZustand(wirdSichtbar);
    });

    feld.addEventListener("input", () => {
      if (!istAufgedeckt(feld)) return;
      verdecke(feld);
      setzeButtonZustand(false);
    });
  }

  global.SchiriQuizMaskedInputs = Object.freeze({
    initialisiereMaskierteFelder,
    verbindeSichtbarkeit,
    verdecke,
  });
})(globalThis);
