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
  // Bleibt leer, solange in der Konfiguration keine Adresse steht. Dann
  // greift der Vorgabewert im HTML ("[E-Mail eures Obmanns]") - besser
  // eine sichtbare Lücke als eine private Adresse, die ungefragt auf
  // einer öffentlichen Seite landet.
  obmannMail: VEREIN.kontakt?.email,
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

// Wappen und Tab-Symbol aus der Konfiguration setzen.
//
// Vorher stand hier eine Ersetzung von "{VEREIN}" im Seitentitel - den
// Platzhalter benutzte aber keine einzige Seite, der Code war also tot.
// Das eigentliche Problem lag woanders: "bilder/logo.png" stand je Seite
// zweimal fest im HTML, obwohl VEREIN.logo existiert. Genau das hätte ein
// anderer Verein wieder in allen Dateien suchen müssen.
if (VEREIN.logo) {
  document.querySelectorAll("img.wappen").forEach((el) => {
    el.setAttribute("src", VEREIN.logo);
  });
  const symbol = document.querySelector('link[rel="icon"]');
  if (symbol) symbol.setAttribute("href", VEREIN.logo);
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

  const schliessen = (zurueckAufKnopf) => {
    if (!navBereich.classList.contains("offen")) return;
    navBereich.classList.remove("offen");
    navKnopf.setAttribute("aria-expanded", "false");
    navKnopf.setAttribute("aria-label", "Menü öffnen");
    if (zurueckAufKnopf) navKnopf.focus();
  };

  // Mit Escape schließen - für Tastatur und externe Tastaturen am Tablet.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") schliessen(true);
  });

  // Auf dem Handy gibt es keine Escape-Taste. Dort sind das hier die
  // beiden Wege, die man tatsächlich benutzt: daneben tippen und einen
  // Menüpunkt antippen. Ohne sie sitzt man im offenen Menü fest, sobald
  // das Ziel ein Anker auf derselben Seite ist.
  document.addEventListener("click", (e) => {
    if (!navBereich.classList.contains("offen")) return;
    if (navBereich.contains(e.target) || navKnopf.contains(e.target)) return;
    schliessen(false);
  });

  navBereich.addEventListener("click", (e) => {
    if (e.target.closest("a")) schliessen(false);
  });
}
