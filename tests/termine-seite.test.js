// Die Terminseite der Vereinsseite (29.08.2026).
//
// Haelt die Entscheidungen fest, die beim Bauen getroffen wurden - und
// vor allem die Trennlinie, die man beim Weiterbauen leicht versehentlich
// verschiebt: was OHNE Anmeldung sichtbar ist und was nicht.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

/* Kommentare wegwerfen, bevor auf Verbotenes geprueft wird - sonst
   schlagen die Pruefungen auf die Erklaerungen an, warum es etwas hier
   gerade NICHT gibt. Dieselbe Falle wie in api-sicherheit.test.js. */
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

const SEITEN = [
  "index.html", "termine.html", "regeluebersicht.html", "informationen.html",
  "spesenrechner.html", "vorlagen.html", "schiri-werden.html",
];

test("die Terminseite und ihre Bausteine existieren", () => {
  for (const datei of ["termine.html", "src/website/termine.js", "src/website/termine-seite.js"]) {
    assert.equal(existsSync(new URL("../" + datei, import.meta.url)), true, datei + " fehlt");
  }
});

test("jede Vereinsseite verlinkt die Termine in der Navigation", () => {
  // Max' Entscheidung vom 29.08.2026: eigener Punkt oben UND weiterhin
  // der Abschnitt ganz unten auf der Startseite.
  for (const seite of SEITEN) {
    const html = lies(seite);
    const nav = html.slice(html.indexOf('id="haupt-nav"'), html.indexOf("</nav>"));
    assert.match(nav, /href="termine\.html"/, seite + " verlinkt die Termine nicht");
  }
});

test("die Startseite behält ihren Terminabschnitt und führt zur vollen Liste", () => {
  const html = lies("index.html");
  assert.match(html, /id="termineAbschnitt"/);
  assert.match(html, /class="termine-alle" href="termine\.html"/);
  // Die Zeilen sind seit dem 29.08.2026 anklickbar - dafuer braucht es die
  // ID, die v90 mitliefert.
  assert.match(html, /termine\.html\?termin=/);
});

test("die Terminseite lädt die Anmeldung vor ihrem eigenen Skript", () => {
  // Ohne diese Reihenfolge steht globalThis.SchiriSeitenAnmeldung noch
  // nicht bereit und die Seite faellt still in die oeffentliche Sicht
  // zurueck - ein Angemeldeter saehe dann keine Antwortknoepfe.
  const html = lies("termine.html");
  const anmeldung = html.indexOf('src="src/core/anmeldung.js"');
  const seiteJs = html.indexOf('src="seite.js"');
  const terminSkript = html.indexOf('src="src/website/termine-seite.js"');
  assert.ok(anmeldung > -1 && seiteJs > -1 && terminSkript > -1);
  assert.ok(anmeldung < seiteJs, "anmeldung.js steht hinter seite.js");
  assert.ok(seiteJs < terminSkript, "termine-seite.js steht vor seite.js");
});

test("ohne Anmeldung wird nur die öffentliche Abfrage benutzt", () => {
  // Die Datenschutz-Auflage aus dem Backlog: auf der oeffentlichen Seite
  // stehen keine vereinsinternen Termine. Das haengt daran, dass der
  // nicht angemeldete Weg ausschliesslich ueber oeffentliche_termine_alle
  // laeuft - die filtert auf "oeffentlich".
  const js = ohneKommentare(lies("src/website/termine-seite.js"));
  assert.match(js, /alleOeffentlich\(VEREIN\.seitenschluessel\)/);
  assert.match(js, /if \(ich\)/);

  // Und: die Mitgliederabfrage darf nur mit einer Person aufgerufen werden.
  const zugriff = ohneKommentare(lies("src/website/termine.js"));
  assert.match(zugriff, /p_schiedsrichter_id: person\.id, p_pin: person\.pin/);
});

test("Namen der Zusagen erscheinen nur für Angemeldete", () => {
  // Max' Entscheidung: Zusagen mit Namen fuer die anderen Schiedsrichter,
  // Absagegruende nur fuer ihn. Fuer Besucher der oeffentlichen Seite sind
  // die Namen der Vereinsmitglieder nichts.
  const js = ohneKommentare(lies("src/website/termine-seite.js"));
  assert.match(js, /const teilnehmer = ich && zusagen\.length/);
});

test("die Oberfläche fängt eine Absage ohne Grund selbst ab", () => {
  // Die Datenbank lehnt sie ohnehin ab (v90). Die Oberflaeche soll aber
  // vorher fragen, statt einen Serverfehler anzuzeigen.
  const js = ohneKommentare(lies("src/website/termine-seite.js"));
  assert.match(js, /if \(!gewaehlterGrund\)/);
  assert.match(js, /Bitte wähle noch einen Grund aus/);
});

test("die sechs Absagegründe stimmen mit der Datenbank überein", () => {
  // Ein Grund, den die Oberflaeche anbietet und die Datenbank nicht
  // kennt, scheitert erst beim Abschicken - beim Nutzer, nicht beim Bauen.
  const js = lies("src/website/termine.js");
  const sql = lies("supabase/migrations/20260829150000_v90_termine_mit_rueckmeldungen.sql");

  const ausJs = [...js.matchAll(/\["([a-z_]+)", "[^"]+"\]/g)].map((t) => t[1]);
  const zeile = sql.match(/grund in\s*\n?\s*\('([^)]+)\)/);
  assert.ok(zeile, "Gruendeliste in der Migration nicht gefunden");
  const ausSql = zeile[1].split(",").map((t) => t.trim().replace(/'/g, ""));

  assert.deepEqual(ausJs.sort(), ausSql.sort());
});

test("kein Kalenderraster", () => {
  // Max am 29.08.2026: "Kalender finde ich sehr unnuetzig dafuer. Wir
  // haben zu wenig Termine, die da drinstehen." Steht hier, damit es
  // nicht in einem halben Jahr jemand gut gemeint nachruestet.
  const js = ohneKommentare(lies("src/website/termine-seite.js"));
  assert.doesNotMatch(js, /kalender/i);
  assert.match(js, /nachMonatenGruppiert/);
});
