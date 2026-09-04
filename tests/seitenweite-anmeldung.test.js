// Die seitenweite Anmeldung (29.08.2026).
//
// Diese Tests halten die Entscheidungen fest, die beim Rausloesen des
// Logins aus der Quizseite getroffen wurden. Sie pruefen bewusst Dinge,
// die man beim Weiterbauen leicht versehentlich kippt und die dann still
// kaputtgehen - nicht laut, sondern erst beim naechsten Nutzer.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

/* Kommentare wegwerfen, bevor auf Verbotenes geprueft wird.
   Beim ersten Lauf am 29.08.2026 schlugen zwei Pruefungen an - und zwar
   auf die ERKLAERUNGEN, warum es type="password" und localStorage hier
   gerade NICHT gibt. Man haette den Code kaputtmachen und den Kommentar
   stehen lassen koennen, und die Tests waeren gruen geblieben. Genau der
   Fehler, der in diesem Projekt schon einmal in api-sicherheit.test.js
   steckte.
   Zeichenketten bleiben unangetastet: "https://..." darf nicht als
   Zeilenkommentar verschwinden. */
const ohneKommentare = (quelltext) =>
  quelltext
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((zeile) => {
      let inZeichenkette = null;
      for (let i = 0; i < zeile.length; i += 1) {
        const z = zeile[i];
        if (inZeichenkette) {
          if (z === "\\") i += 1;
          else if (z === inZeichenkette) inZeichenkette = null;
        } else if (z === '"' || z === "'" || z === "`") {
          inZeichenkette = z;
        } else if (z === "/" && zeile[i + 1] === "/") {
          return zeile.slice(0, i);
        }
      }
      return zeile;
    })
    .join("\n");

const VEREINSSEITEN = [
  "index.html",
  "regeluebersicht.html",
  "informationen.html",
  "spesenrechner.html",
  "vorlagen.html",
  "schiri-werden.html",
  "melden.html",
];

const BAUSTEINE = ["src/core/anmeldung.js", "src/ui/masked-input.js", "src/ui/login-dialog.js"];

test("die Anmeldebausteine existieren", () => {
  for (const datei of BAUSTEINE) {
    assert.equal(existsSync(new URL("../" + datei, import.meta.url)), true, datei + " fehlt");
  }
});

test("jede Vereinsseite laedt die Anmeldung VOR seite.js", () => {
  // seite.js ist ein Modul und wird dadurch verzoegert ausgefuehrt, die
  // Bausteine sind klassische Skripte. Steht ein Baustein trotzdem
  // dahinter, faellt das nicht auf - die Anmeldung verschwindet dann
  // einfach lautlos aus dem Kopf.
  for (const seite of VEREINSSEITEN) {
    const html = lies(seite);
    const seiteJs = html.indexOf('src="seite.js"');
    assert.ok(seiteJs > -1, seite + " laedt seite.js nicht");
    for (const baustein of BAUSTEINE) {
      const stelle = html.indexOf(`src="${baustein}"`);
      assert.ok(stelle > -1, `${seite} laedt ${baustein} nicht`);
      assert.ok(stelle < seiteJs, `${seite}: ${baustein} steht hinter seite.js`);
    }
  }
});

test("die Anmeldung benutzt dieselben Sitzungsschluessel wie das Quiz", () => {
  // Der eigentliche Grund, warum eine Anmeldung auf der Vereinsseite auch
  // im Quiz gilt. Wird einer der beiden Namen geaendert, funktioniert
  // beides fuer sich weiter - nur die Uebernahme faellt still aus.
  const anmeldung = lies("src/core/anmeldung.js");
  const app = lies("app.js");

  for (const schluessel of ["schiriQuizSession", "schiriQuizVereinskennung"]) {
    assert.ok(anmeldung.includes(`"${schluessel}"`), `anmeldung.js kennt ${schluessel} nicht`);
    assert.ok(app.includes(`"${schluessel}"`), `app.js kennt ${schluessel} nicht`);
  }
});

test("Kennung und PIN sind keine echten Passwortfelder", () => {
  // Begruendung vom 10.08.2026 (siehe style.css): Safari und iOS blenden
  // bei jedem echten Passwortfeld ungefragt den "Starkes Passwort
  // verwenden"-Vorschlag ein und ignorieren autocomplete="off". Fuer eine
  // vierstellige PIN ist das nur verwirrend.
  const dialog = lies("src/ui/login-dialog.js");
  assert.doesNotMatch(ohneKommentare(dialog), /type="password"/);
  assert.match(dialog, /data-feld="kennung"[\s\S]{0,200}class="maskiert"/);
  assert.match(dialog, /data-feld="pin"[\s\S]{0,200}class="maskiert"/);
});

test("der Gastweg ist ein Knopf, kein Textlink", () => {
  // Max, 29.08.2026: "nicht so, dass es nur als Textklickfeld ist,
  // sondern wirklich als Button."
  const dialog = lies("src/ui/login-dialog.js");
  assert.match(dialog, /<button[^>]*data-gast>/);
  assert.doesNotMatch(dialog, /<a[^>]*data-gast/);
});

test("die Anmeldung liegt in sessionStorage, nicht in localStorage", () => {
  // Max' Entscheidung vom 29.08.2026: angemeldet bleiben ueber das
  // Schliessen des Tabs hinaus hiesse hier, die PIN dauerhaft auf der
  // Festplatte abzulegen - denn sie und nicht ein Sitzungsschluessel ist
  // das Zugangsmittel. Solange das so ist, bleibt es beim Tab.
  const anmeldung = ohneKommentare(lies("src/core/anmeldung.js"));
  assert.match(anmeldung, /sessionStorage/);
  assert.doesNotMatch(anmeldung, /localStorage/);
});

test("der Gast-Direkteinstieg bleibt ohne Anmeldefenster erreichbar", () => {
  // "quiz.html#gast" ist auf der Startseite die ausdrueckliche Einladung
  // zum Ausprobieren. seite.js faengt deshalb nur Verweise ohne Anker ab.
  //
  // Seit dem 29.08.2026 fuehrt "Zum Quiz" auf modus.html (die Auswahl
  // zwischen Wochenfragen und Entscheidungs-Modus); abgefangen wird
  // seither dieser Verweis. Am Gastweg aendert das nichts, und genau
  // das prueft dieser Test: er darf NICHT auf modus.html umgebogen
  // werden, sonst faellt der Gasteinstieg still weg.
  const seiteJs = lies("seite.js");
  assert.match(seiteJs, /querySelectorAll\('a\[href="modus\.html"\]'\)/);
  assert.ok(
    !seiteJs.includes('a[href^="quiz.html"]') && !seiteJs.includes('a[href^="modus.html"]'),
    "seite.js faengt auch quiz.html#gast ab - der Gastweg waere damit zu"
  );
  assert.match(lies("index.html"), /href="quiz\.html#gast"/);
  // Vom allgemeinen "Zum Quiz"-Weg bekommt ein Gast die Wahl zwischen
  // Gastquiz und Duell. Der ausdrueckliche Gastknopf auf der Startseite
  // bleibt trotzdem ein Direkteinstieg.
  assert.match(seiteJs, /=== "gast"\) location\.href = "modus\.html#ohne-anmeldung"/);
  const modus = lies("src/website/modus-seite.js");
  assert.match(modus, /function gastKachel\(\)[\s\S]*href="quiz\.html#gast"/);
  assert.match(modus, /: \[gastKachel\(\), duellKachel\(\)\]/);
  assert.doesNotMatch(modus, /: \[wochenKachel\(\{ unbekannt: true/);
});

test("andere Bausteine koennen dasselbe Anmeldefenster benutzen", () => {
  // Die Termin-Anmeldung soll kein zweites Fenster bauen muessen.
  const seiteJs = lies("seite.js");
  assert.match(seiteJs, /globalThis\.SchiriSeitenAnmeldung\s*=/);
  assert.match(seiteJs, /loginDialog/);
});
