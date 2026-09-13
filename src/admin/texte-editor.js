// ============================================================
//  Editor: Texte der oeffentlichen Seiten
// ------------------------------------------------------------
//  Eine Karte je Seite, darin je ein Feld pro Text. Neben jedem
//  Feld steht der Ausgangsstand aus dem HTML - so sieht Max, was
//  er gerade ueberschreibt, und kann mit einem Klick zurueck.
// ============================================================
import { TEXTE_STANDARD, TEXT_SEITEN } from "../website/redaktionstexte-standard.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

export function erstelleTexteEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(TEXTE_STANDARD);
  const speicher = erstelleInhaltsSpeicher({
    client, verein, benutzer, bereich: "texte", fallback: TEXTE_STANDARD,
  });

  wurzel.innerHTML = bereichsGeruest({
    titel: "Texte der öffentlichen Seiten",
    untertitel: "Überschriften und Einleitungen von Startseite, „Schiri werden“, Spesenrechner, Unterlagen und Regelübersicht.",
    kennung: "Texte",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  function feldZeile(feld) {
    const vorgabe = TEXTE_STANDARD[feld.schluessel] || "";
    const zeile = document.createElement("div");
    zeile.className = "admin-text-zeile";
    const eingabe = vorgabe.length > 80 ? "textarea" : "input";
    zeile.innerHTML = `
      <label class="admin-breit">${feld.beschriftung}
        ${eingabe === "textarea" ? '<textarea rows="3"></textarea>' : "<input />"}
      </label>
      <p class="admin-vorgabe"><span>Ausgangsstand:</span> <code></code>
        <button type="button" class="knopf" data-zuruecksetzen>Zurücksetzen</button></p>`;
    const eingabefeld = zeile.querySelector("textarea, input");
    eingabefeld.value = zustand[feld.schluessel] ?? vorgabe;
    // textContent, nicht innerHTML: der Ausgangsstand soll als Text zu
    // lesen sein, einschliesslich eines enthaltenen <br />.
    zeile.querySelector("code").textContent = vorgabe;
    eingabefeld.addEventListener("input", () => { zustand[feld.schluessel] = eingabefeld.value; });
    zeile.querySelector("[data-zuruecksetzen]").addEventListener("click", () => {
      zustand[feld.schluessel] = vorgabe;
      eingabefeld.value = vorgabe;
      eingabefeld.focus();
    });
    return zeile;
  }

  function rendern() {
    editor.replaceChildren();
    for (const seite of TEXT_SEITEN) {
      const panel = document.createElement("section");
      panel.className = "admin-panel admin-text-panel";
      panel.innerHTML = `
        <div class="admin-panel-kopf">
          <h2>${seite.titel}</h2>
          <p><a href="${seite.datei}" target="_blank" rel="noopener noreferrer">Seite ansehen ↗</a></p>
        </div>
        <div class="admin-text-form" data-felder></div>`;
      const felder = panel.querySelector("[data-felder]");
      seite.felder.forEach((feld) => felder.appendChild(feldZeile(feld)));
      editor.appendChild(panel);
    }
  }

  bindeInhaltsAktionen({
    wurzel, speicher, bereichName: "Die geänderten Texte",
    aktuellerStand: () => zustand,
    setzeStand: (wert) => { zustand = wert; },
    rendern,
  });

  speicher.laden().then((ergebnis) => {
    zustand = kopie(ergebnis.konfiguration);
    rendern();
    setzeStatus(wurzel, ergebnis.istFallback
      ? "Es sind noch die Texte in Kraft, die im Seitenaufbau stehen."
      : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`);
  }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
