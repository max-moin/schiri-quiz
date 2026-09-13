// ============================================================
//  Editor: Texte der oeffentlichen Seiten
// ------------------------------------------------------------
//  Eine Karte je Seite, darin aufklappbare Gruppen ("Der Weg zur
//  Pfeife", "Haeufige Fragen"), darin je ein Feld pro Text.
//
//  Zwei Entscheidungen, die man sonst spaeter bereut:
//
//  1. Unter jedem Feld steht der Ausgangsstand aus dem HTML und
//     ein Knopf "Zuruecksetzen". Ohne den muesste man eine
//     verunglueckte Aenderung aus dem Versionsarchiv zurueckholen -
//     fuer einen einzelnen Satz zu umstaendlich.
//  2. Geaenderte Felder bekommen eine Markierung und werden je
//     Gruppe gezaehlt. Bei 77 Feldern sieht man sonst nicht mehr,
//     was man in dieser Sitzung ueberhaupt angefasst hat.
// ============================================================
import { TEXTE_STANDARD, TEXT_SEITEN } from "../website/redaktionstexte-standard.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

// Ab dieser Laenge wird aus dem einzeiligen Feld ein Textfeld.
const LANG_AB = 70;

export function erstelleTexteEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(TEXTE_STANDARD);
  const speicher = erstelleInhaltsSpeicher({
    client, verein, benutzer, bereich: "texte", fallback: TEXTE_STANDARD,
  });

  wurzel.innerHTML = bereichsGeruest({
    titel: "Texte der öffentlichen Seiten",
    untertitel: "Überschriften, Einleitungen und Fließtext von Startseite, „Schiri werden“, Spesenrechner, Unterlagen und Regelübersicht.",
    kennung: "Texte",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  const vorgabeVon = (schluessel) => TEXTE_STANDARD[schluessel] ?? "";
  const istGeaendert = (schluessel) =>
    (zustand[schluessel] ?? "").trim() !== vorgabeVon(schluessel).trim();

  function zaehleNeu() {
    for (const kopfZeile of editor.querySelectorAll("[data-gruppe]")) {
      const schluessel = kopfZeile.dataset.gruppe.split(" ");
      const anzahl = schluessel.filter(istGeaendert).length;
      const marke = kopfZeile.querySelector("[data-gruppe-marke]");
      marke.textContent = anzahl ? `${anzahl} geändert` : "";
      marke.hidden = !anzahl;
    }
  }

  function feldZeile(feld) {
    const vorgabe = vorgabeVon(feld.schluessel);
    const zeile = document.createElement("div");
    zeile.className = "admin-text-zeile";
    const lang = vorgabe.length > LANG_AB;
    const reihen = Math.min(10, Math.max(3, Math.ceil(vorgabe.length / 70) + 1));
    zeile.innerHTML = `
      <label class="admin-breit">${feld.beschriftung}
        ${lang ? `<textarea rows="${reihen}"></textarea>` : "<input />"}
      </label>
      <p class="admin-vorgabe"><span>Ausgangsstand:</span> <code></code>
        <button type="button" class="knopf" data-zuruecksetzen>Zurücksetzen</button></p>`;

    const eingabe = zeile.querySelector("textarea, input");
    eingabe.value = zustand[feld.schluessel] ?? vorgabe;
    // textContent, nicht innerHTML: der Ausgangsstand soll als Text
    // lesbar sein, einschliesslich eines enthaltenen <br />.
    zeile.querySelector("code").textContent = vorgabe.trim();

    const merke = () => {
      zeile.classList.toggle("ist-geaendert", istGeaendert(feld.schluessel));
      zaehleNeu();
    };
    eingabe.addEventListener("input", () => {
      zustand[feld.schluessel] = eingabe.value;
      merke();
    });
    zeile.querySelector("[data-zuruecksetzen]").addEventListener("click", () => {
      zustand[feld.schluessel] = vorgabe;
      eingabe.value = vorgabe;
      merke();
      eingabe.focus();
    });
    merke();
    return zeile;
  }

  function gruppenBlock(gruppe) {
    const block = document.createElement("details");
    block.className = "admin-textgruppe";
    const schluessel = gruppe.felder.map((f) => f.schluessel).join(" ");
    block.innerHTML = `
      <summary data-gruppe="${schluessel}">
        <span>${gruppe.titel}</span>
        <small>${gruppe.felder.length} ${gruppe.felder.length === 1 ? "Feld" : "Felder"}</small>
        <em data-gruppe-marke hidden></em>
      </summary>
      <div class="admin-text-form" data-felder></div>`;
    const felder = block.querySelector("[data-felder]");
    gruppe.felder.forEach((feld) => felder.appendChild(feldZeile(feld)));
    return block;
  }

  function rendern() {
    editor.replaceChildren();
    for (const seite of TEXT_SEITEN) {
      const anzahl = seite.gruppen.reduce((summe, g) => summe + g.felder.length, 0);
      const panel = document.createElement("section");
      panel.className = "admin-panel admin-text-panel";
      panel.innerHTML = `
        <div class="admin-panel-kopf">
          <h2>${seite.titel}</h2>
          <p>${anzahl} Texte · <a href="${seite.datei}" target="_blank" rel="noopener noreferrer">Seite ansehen ↗</a></p>
        </div>
        <div data-gruppen></div>`;
      const ziel = panel.querySelector("[data-gruppen]");
      seite.gruppen.forEach((gruppe) => ziel.appendChild(gruppenBlock(gruppe)));
      editor.appendChild(panel);
    }
    zaehleNeu();
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
      ? "Es gelten die Texte, die im Seitenaufbau stehen. Noch nichts veröffentlicht."
      : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`);
  }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
