(function stelleKopfmenueBereit(global) {
  "use strict";

  function initialisiereKopfmenue() {
    const knopf = document.getElementById("menue-button");
    const panel = document.getElementById("menue-panel");
    if (!knopf || !panel) return;

    function setzeOffen(offen) {
      panel.hidden = !offen;
      knopf.setAttribute("aria-expanded", offen ? "true" : "false");
      knopf.setAttribute("aria-label", offen ? "Menü schließen" : "Menü öffnen");
    }

    knopf.addEventListener("click", (ereignis) => {
      ereignis.stopPropagation();
      setzeOffen(panel.hidden);
    });

    document.addEventListener("click", (ereignis) => {
      if (panel.hidden) return;
      if (!panel.contains(ereignis.target) && ereignis.target !== knopf) {
        setzeOffen(false);
      }
    });

    document.addEventListener("keydown", (ereignis) => {
      if (ereignis.key !== "Escape" || panel.hidden) return;
      setzeOffen(false);
      knopf.focus();
    });
  }

  global.SchiriQuizHeaderMenu = Object.freeze({
    initialisiereKopfmenue,
  });
})(globalThis);
