// ============================================================
//  Gemeinsames Skript aller Vereinsseiten.
//
//  Zwei Aufgaben:
//  1. Das Menü für schmale Bildschirme (stand vorher wortgleich in
//     jeder einzelnen Seite - genau die Doppelung, die man später
//     an vier Stellen nachziehen müsste).
//  2. Die Werte aus verein.config.js in die Seite schreiben.
//
//  Punkt 2 ist der eigentliche Grund für diese Datei: verein.config.js
//  behauptet, die einzige Stelle mit Vereinsspezifischem zu sein. Solange
//  Name und Kürzel fest im HTML stehen, stimmt das nicht - ein anderer
//  Verein müsste doch wieder alle Seiten durchsuchen. Alles, was hier
//  gesetzt wird, trägt im HTML ein "data-verein"-Attribut.
//
//  Das HTML enthält bewusst trotzdem sinnvolle Vorgabewerte. Fällt das
//  Skript aus, steht immer noch der richtige Vereinsname da statt einer
//  leeren Fläche.
// ============================================================

import { VEREIN } from "./verein.config.js";

// ---------- Vereinswerte einsetzen ----------

const WERTE = {
  name: VEREIN.name,
  kurz: VEREIN.kurz,
  abteilung: VEREIN.abteilung,
  kuerzel: VEREIN.kuerzel,
};

document.querySelectorAll("[data-verein]").forEach((el) => {
  const schluessel = el.dataset.verein;
  if (WERTE[schluessel]) el.textContent = WERTE[schluessel];
});

// Links, die je Verein anders sind.
document.querySelectorAll("[data-verein-link]").forEach((el) => {
  const ziel = VEREIN.links[el.dataset.vereinLink];
  if (ziel) {
    el.setAttribute("href", ziel);
  } else {
    // Kein Link hinterlegt: Eintrag stillschweigend entfernen statt ins
    // Leere zeigen zu lassen.
    el.remove();
  }
});

// Seitentitel ergänzen, damit im Browser-Tab der richtige Verein steht.
if (document.title.includes("{VEREIN}")) {
  document.title = document.title.replace("{VEREIN}", VEREIN.name);
}

// ---------- Menü für schmale Bildschirme ----------

const navKnopf = document.getElementById("nav-knopf");
const navBereich = document.getElementById("haupt-nav");

if (navKnopf && navBereich) {
  navKnopf.addEventListener("click", () => {
    const offen = navBereich.classList.toggle("offen");
    navKnopf.setAttribute("aria-expanded", String(offen));
    navKnopf.setAttribute("aria-label", offen ? "Menü schließen" : "Menü öffnen");
  });

  // Mit Escape schließen - sonst sitzt man auf dem Handy im offenen Menü
  // fest, wenn man daneben tippt.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navBereich.classList.contains("offen")) {
      navBereich.classList.remove("offen");
      navKnopf.setAttribute("aria-expanded", "false");
      navKnopf.focus();
    }
  });
}
