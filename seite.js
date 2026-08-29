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

import { VEREIN, BILDER, DATENBANK } from "./verein.config.js";

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

// ---------- Bilder: Foto nur, wenn es wirklich lädt ----------
//
// Das Ersatzmotiv steht seit dem 22.08.2026 direkt als "src" im HTML und
// nicht mehr erst hier. Grund aus dem Review: Vorher hatten sechs <img>
// gar kein src-Attribut. Ohne JavaScript - oder schon bei einem
// Tippfehler in verein.config.js, die beide Module laden - waren alle
// Bilder leer. Das widerspricht genau der Zusage im Kopf dieser Datei.
//
// Diese Schleife hat deshalb nur noch eine Aufgabe: das Motiv gegen ein
// Foto tauschen, sobald das Foto nachweislich geladen ist. Am 21.08.2026
// blieben Kacheln leer, weil geratene Foto-Adressen ins Leere zeigten -
// so kann daraus höchstens noch "kein Foto" werden, nie "kein Bild".

document.querySelectorAll("img[data-bild]").forEach((el) => {
  const eintrag = BILDER[el.dataset.bild];
  if (!eintrag) return;
  // Ersatzmotiv nachtragen, falls im HTML doch keins steht.
  if (!el.getAttribute("src") && eintrag.ersatz) el.src = eintrag.ersatz;
  if (!eintrag.foto) return;
  const probe = new Image();
  probe.onload = () => { el.src = eintrag.foto; };
  probe.src = eintrag.foto;
});

// Der Redaktionszugang ist kein Sicherheitsgeheimnis und wird deshalb nicht
// durch einen kryptischen URL-Trick versteckt. Er bleibt im Footer bewusst
// leise, waehrend Auth, TOTP und RLS den eigentlichen Schutz uebernehmen.
document.querySelectorAll(".seiten-fuss .fuss-innen").forEach((fuss) => {
  if (fuss.querySelector('[href="obmann.html"]')) return;
  const link = document.createElement("a");
  link.href = "obmann.html";
  link.textContent = "Obmann-Zugang";
  link.className = "fuss-obmann";
  const zeile = fuss.querySelector(".fuss-zeile");
  fuss.insertBefore(link, zeile || null);
});

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

// ============================================================
//  Anmeldung fuer die ganze Vereinsseite (29.08.2026)
// ============================================================
//  Max' Vorgabe an diesem Tag, sinngemaess: der Login soll nicht mehr nur
//  auf der Quizseite liegen, sondern fuer die ganze Seite gelten - "aber
//  nicht so, dass, wenn du direkt die Seite besuchst, du dich dann
//  anmelden musst, sondern so, dass du rechts oben einen Login-Button
//  siehst". Und beim Quiz: "wenn du dich vorher schon angemeldet hast,
//  wirst du gleich weitergeleitet ... wenn du dich noch nicht eingeloggt
//  hast, kommt da dann nochmal das Login-Fenster".
//
//  Der Knopf wird hier eingesetzt statt in jede Seite geschrieben - aus
//  demselben Grund wie beim Menue und beim Vereinsnamen: sonst muesste man
//  ihn in sechs Dateien nachziehen. Anders als beim Fusszeilen-Link gibt es
//  hier bewusst KEINEN Vorgabewert im HTML: ein Anmeldeknopf, der ohne
//  JavaScript sichtbar waere, aber nichts tun kann, waere schlechter als
//  gar keiner.
// ============================================================

const kopfInnen = document.querySelector(".seiten-kopf .kopf-innen");

if (kopfInnen && globalThis.SchiriAnmeldung && globalThis.SchiriLoginDialog) {
  const anmeldung = globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });

  const loginDialog = globalThis.SchiriLoginDialog.erstelleLoginDialog({
    anmeldung,
    maskierung: globalThis.SchiriQuizMaskedInputs,
  });

  // Fuer andere Bausteine derselben Seite bereitgestellt - als naechstes
  // fuer die Termin-Anmeldung, die wissen muss, WER sich eintraegt, und
  // dafuer dasselbe Fenster oeffnen soll statt ein zweites zu bauen:
  //
  //   const { anmeldung, loginDialog } = globalThis.SchiriSeitenAnmeldung;
  //   const e = await loginDialog.oeffne({ grund: "..." });
  //   if (e.status === "angemeldet") { ... }
  //
  // oeffne() gibt bei bereits angemeldeten Personen sofort zurueck, ohne
  // das Fenster zu zeigen. Aufrufer muessen das also nicht selbst pruefen.
  globalThis.SchiriSeitenAnmeldung = Object.freeze({ anmeldung, loginDialog });

  // ---------- Knopf und Menue in den Kopf setzen ----------

  const bereich = document.createElement("div");
  bereich.className = "konto-bereich";
  bereich.innerHTML = `
    <button class="konto-knopf" type="button" data-konto-knopf aria-expanded="false" aria-haspopup="menu"></button>
    <div class="konto-menue" data-konto-menue role="menu" hidden>
      <div class="konto-menue-kopf"><strong data-konto-name></strong><span>Angemeldet in diesem Tab</span></div>
      <a href="quiz.html" role="menuitem">Zum Quiz</a>
      <button type="button" class="konto-abmelden" data-abmelden role="menuitem">Abmelden</button>
    </div>`;
  // Hinter die Navigation: auf breiten Bildschirmen sitzt er damit ganz
  // rechts, auf schmalen schiebt ihn die CSS-Regel vor den Menueknopf.
  kopfInnen.appendChild(bereich);

  const kontoKnopf = bereich.querySelector("[data-konto-knopf]");
  const kontoMenue = bereich.querySelector("[data-konto-menue]");
  const kontoName = bereich.querySelector("[data-konto-name]");

  function schliesseKontoMenue() {
    kontoMenue.hidden = true;
    kontoKnopf.setAttribute("aria-expanded", "false");
  }

  // Nur der Vorname im Knopf: "Maximilian Mustermann" sprengt den Kopf auf
  // dem Handy, der volle Name steht im aufgeklappten Menue.
  const vorname = (name) => String(name || "").trim().split(/\s+/)[0] || "Mein Konto";

  anmeldung.abonniere((stand) => {
    if (stand) {
      kontoKnopf.innerHTML = '<span class="konto-punkt" aria-hidden="true"></span>';
      kontoKnopf.append(vorname(stand.name));
      kontoKnopf.setAttribute("aria-label", `Angemeldet als ${stand.name || "Mitglied"} – Kontomenü öffnen`);
      kontoName.textContent = stand.name || "Angemeldet";
    } else {
      kontoKnopf.textContent = "Anmelden";
      kontoKnopf.removeAttribute("aria-label");
      schliesseKontoMenue();
    }
  });

  kontoKnopf.addEventListener("click", async () => {
    if (anmeldung.istAngemeldet()) {
      const offen = kontoMenue.hidden;
      kontoMenue.hidden = !offen;
      kontoKnopf.setAttribute("aria-expanded", String(offen));
      return;
    }
    await loginDialog.oeffne({
      grund: "Melde dich mit deiner Vereinskennung und deiner PIN an.",
      gastErlaubt: false,
    });
  });

  bereich.querySelector("[data-abmelden]").addEventListener("click", () => {
    anmeldung.abmelden();
    schliesseKontoMenue();
  });

  document.addEventListener("click", (e) => {
    if (kontoMenue.hidden || bereich.contains(e.target)) return;
    schliesseKontoMenue();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") schliesseKontoMenue();
  });

  // ---------- "Zum Quiz" prueft zuerst die Anmeldung ----------
  //
  // Nur Links, die WIRKLICH ins Quiz fuehren sollen - "quiz.html#gast"
  // bleibt unangetastet. Diese Verweise sind auf der Startseite die
  // ausdrueckliche Einladung zum Ausprobieren ohne Anmeldung; ein
  // Anmeldefenster davor waere genau das Gegenteil davon.
  document.querySelectorAll('a[href="quiz.html"]').forEach((link) => {
    link.addEventListener("click", async (e) => {
      if (anmeldung.istAngemeldet()) return; // direkt durch, wie versprochen
      e.preventDefault();
      const ergebnis = await loginDialog.oeffne({
        grund: "Für dein persönliches Quiz brauchst du deine Anmeldung.",
        gastErlaubt: true,
      });
      if (ergebnis.status === "angemeldet") location.href = "quiz.html";
      else if (ergebnis.status === "gast") location.href = "quiz.html#gast";
    });
  });
}
