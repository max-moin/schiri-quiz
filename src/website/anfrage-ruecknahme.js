// Bestätigung einer einzelnen Artikelanfrage, keine Löschung des Verlaufs.
export function bestaetigeRuecknahme({ artikel, ausloeser, dokument = document }) {
  return new Promise((resolve) => {
    const dialog = dokument.createElement("dialog");
    dialog.className = "bestand-ruecknahme-dialog";
    dialog.setAttribute("aria-labelledby", "ruecknahme-titel");
    dialog.setAttribute("aria-describedby", "ruecknahme-text");
    const titel = dokument.createElement("h2");
    titel.id = "ruecknahme-titel";
    titel.textContent = "Anfrage zurückziehen?";
    const text = dokument.createElement("p");
    text.id = "ruecknahme-text";
    text.textContent = `Du brauchst „${artikel}“ nicht mehr? Diese Artikelanfrage wird beendet. Der bisherige Verlauf bleibt erhalten. Andere Artikel deiner Anfrage bleiben unverändert.`;
    const aktionen = dokument.createElement("div");
    aktionen.className = "bestand-ruecknahme-aktionen";
    const behalten = dokument.createElement("button");
    behalten.type = "button";
    behalten.className = "bestand-knopf-sekundaer";
    behalten.textContent = "Anfrage behalten";
    behalten.autofocus = true;
    const bestaetigen = dokument.createElement("button");
    bestaetigen.type = "button";
    bestaetigen.className = "bestand-ruecknahme-bestaetigen";
    bestaetigen.textContent = "Ja, zurückziehen";
    behalten.addEventListener("click", () => dialog.close());
    bestaetigen.addEventListener("click", () => dialog.close("zurueckziehen"));
    dialog.addEventListener("close", () => {
      const erlaubt = dialog.returnValue === "zurueckziehen";
      dialog.remove();
      if (ausloeser?.isConnected) {
        ausloeser.disabled = false;
        ausloeser.focus();
      }
      resolve(erlaubt);
    }, { once: true });
    aktionen.append(behalten, bestaetigen);
    dialog.append(titel, text, aktionen);
    dokument.body.append(dialog);
    dialog.showModal();
  });
}
