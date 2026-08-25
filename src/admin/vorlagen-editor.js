import { VORLAGEN_STANDARD } from "../website/content-defaults.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

export function erstelleVorlagenEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(VORLAGEN_STANDARD);
  const speicher = erstelleInhaltsSpeicher({ client, verein, benutzer, bereich: "vorlagen", fallback: VORLAGEN_STANDARD });
  wurzel.innerHTML = bereichsGeruest({
    titel: "Absagevorlagen",
    untertitel: "Texte und Hinweise bearbeiten und direkt als fertige Mail prüfen.",
    kennung: "Vorlagen",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  function rendern() {
    editor.replaceChildren();
    for (const [schluessel, ueberschrift] of [["spiel", "Spielabsage"], ["lehrabend", "Regellehrabend"]]) {
      const wert = zustand[schluessel];
      const panel = document.createElement("section");
      panel.className = "admin-panel admin-text-panel";
      panel.innerHTML = `
        <div class="admin-panel-kopf"><h2>${ueberschrift}</h2><p>${wert.entwurf ? "Aktuell als Entwurf gekennzeichnet" : "Veröffentlichte Vorlage"}</p></div>
        <div class="admin-text-form">
          <label>Titel<input data-feld="titel" /></label>
          <label class="admin-breit">E-Mail-Text<textarea data-feld="text" rows="15"></textarea></label>
          <label class="admin-breit">Hinweis für Schiedsrichter<textarea data-feld="hinweis" rows="4"></textarea></label>
          <label class="admin-breit">Quelle / Stand<textarea data-feld="quelle" rows="3"></textarea></label>
          <label class="admin-checkbox"><input data-feld="entwurf" type="checkbox" /> Als Entwurf kennzeichnen</label>
          <details class="admin-vorschau"><summary>Vorschau öffnen</summary><pre></pre></details>
        </div>`;
      for (const feld of ["titel", "text", "hinweis", "quelle"]) {
        const input = panel.querySelector(`[data-feld="${feld}"]`);
        input.value = wert[feld];
        input.addEventListener("input", () => {
          wert[feld] = input.value;
          panel.querySelector(".admin-vorschau pre").textContent = wert.text;
        });
      }
      const entwurf = panel.querySelector('[data-feld="entwurf"]');
      entwurf.checked = wert.entwurf;
      entwurf.addEventListener("change", () => { wert.entwurf = entwurf.checked; });
      panel.querySelector(".admin-vorschau pre").textContent = wert.text;
      editor.appendChild(panel);
    }
  }

  bindeInhaltsAktionen({
    wurzel, speicher, bereichName: "Diese Absagevorlagen",
    aktuellerStand: () => zustand,
    setzeStand: (wert) => { zustand = wert; },
    rendern,
  });
  speicher.laden().then((ergebnis) => {
    zustand = kopie(ergebnis.konfiguration);
    rendern();
    setzeStatus(wurzel, ergebnis.istFallback ? "Statischer Ausgangsstand – noch nicht aus der Redaktion veröffentlicht." : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`);
  }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
