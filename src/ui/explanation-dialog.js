(function stelleErklaerungsDialogBereit(global) {
  "use strict";

  function erstelleErklaerungsDialog({ getZugang, vorHistorieErklaerung } = {}) {
    const overlay = document.getElementById("erklaerung-overlay");
    const inhalt = document.getElementById("erklaerung-inhalt");
    const schliessenButton = document.getElementById("erklaerung-schliessen-button");
    const cache = new Map();

    function schliessen() {
      if (overlay) overlay.hidden = true;
    }

    if (schliessenButton) schliessenButton.addEventListener("click", schliessen);
    if (overlay) {
      overlay.addEventListener("click", (ereignis) => {
        if (ereignis.target === overlay) schliessen();
      });
    }
    document.addEventListener("keydown", (ereignis) => {
      if (ereignis.key === "Escape" && overlay && !overlay.hidden) schliessen();
    });

    async function oeffnen(frageId, istHistorie) {
      if (!overlay || !inhalt) return;
      if (istHistorie && typeof vorHistorieErklaerung === "function") {
        vorHistorieErklaerung();
      }

      const zugang = typeof getZugang === "function" ? getZugang() : {};
      overlay.hidden = false;
      inhalt.replaceChildren();

      const cacheSchluessel = istHistorie ? null : `${zugang.schiedsrichterId}:${frageId}`;
      if (cacheSchluessel && cache.has(cacheSchluessel)) {
        const text = document.createElement("p");
        text.textContent = cache.get(cacheSchluessel);
        inhalt.appendChild(text);
        return;
      }

      const ladeHinweis = document.createElement("p");
      ladeHinweis.className = "erklaerung-lade-hinweis";
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      ladeHinweis.append(spinner, " Einen Moment, die Erklärung wird erstellt ...");
      inhalt.appendChild(ladeHinweis);

      try {
        const antwort = await fetch("/api/erklaerung", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schiedsrichterId: zugang.schiedsrichterId,
            frageId,
            pin: zugang.pin,
            historie: istHistorie,
          }),
        });
        const daten = await antwort.json();
        if (!antwort.ok) throw new Error(daten.fehler || "Unbekannter Fehler");

        inhalt.replaceChildren();
        const text = document.createElement("p");
        text.textContent = daten.erklaerung;
        inhalt.appendChild(text);
        if (cacheSchluessel) cache.set(cacheSchluessel, daten.erklaerung);
      } catch (fehler) {
        inhalt.replaceChildren();
        const fehlerText = document.createElement("p");
        fehlerText.className = "erklaerung-fehler";
        fehlerText.textContent = "Erklärung konnte nicht geladen werden: " + fehler.message;
        inhalt.appendChild(fehlerText);
      }
    }

    function baueWarumButton(frageId, istHistorie) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "warum-button";
      button.append("💡 Warum?");
      button.addEventListener("click", () => oeffnen(frageId, istHistorie));
      return button;
    }

    return Object.freeze({ baueWarumButton, schliessen });
  }

  global.SchiriQuizExplanationDialog = Object.freeze({
    erstelleErklaerungsDialog,
  });
})(globalThis);
