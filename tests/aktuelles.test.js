// Das wechselnde Band "Das steht an" auf der Startseite.
//
// Ein Karussell ist der klassische Fall, in dem Bequemlichkeit und
// Barrierefreiheit auseinanderlaufen. Diese Tests halten die drei
// Zusagen fest, die es von einem Werbebanner unterscheiden.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

import { baueMeldungen } from "../src/website/aktuelles.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const HEUTE = new Date(2026, 8, 12); // 12.09.2026, Monate sind nullbasiert

const termin = (tageVoraus, rest = {}) => {
  const d = new Date(HEUTE.getFullYear(), HEUTE.getMonth(), HEUTE.getDate() + tageVoraus);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { id: `t${tageVoraus}`, titel: `Termin in ${tageVoraus} Tagen`, datum: iso, ...rest };
};

test("das Band zeigt nur, was wirklich ansteht", () => {
  const meldungen = baueMeldungen([
    termin(-1),   // gestern
    termin(3),
    termin(39),
    termin(41),   // ausserhalb des Vorschaufensters
  ], HEUTE);
  assert.deepEqual(meldungen.map((m) => m.id), ["t3", "t39"]);
});

test("hoechstens fuenf Meldungen - danach ist es keine Erinnerung mehr", () => {
  const viele = [1, 2, 3, 4, 5, 6, 7].map((n) => termin(n));
  assert.equal(baueMeldungen(viele, HEUTE).length, 5);
});

test("keine Termine heisst kein Band - das ist die Aussage, keine Luecke", () => {
  assert.deepEqual(baueMeldungen([], HEUTE), []);
  assert.deepEqual(baueMeldungen(null, HEUTE), []);
  // Unbrauchbare Zeilen fallen still heraus statt die Seite zu sprengen.
  assert.deepEqual(baueMeldungen([{ titel: "", datum: "2026-09-13" }, { titel: "x", datum: "keins" }], HEUTE), []);
});

test("der Abstand steht in Worten, wie man ueber Termine redet", () => {
  const wann = (n) => baueMeldungen([termin(n)], HEUTE)[0].wann;
  assert.equal(wann(0), "Heute");
  assert.equal(wann(1), "Morgen");
  assert.equal(wann(2), "Übermorgen");
  assert.match(wann(4), /in 4 Tagen/);
  assert.equal(wann(9), "Nächste Woche");
  assert.match(wann(28), /^In \d Wochen$/);
});

test("jedes Motiv zeigt auf ein Bild, das es wirklich gibt", () => {
  // Ein Verweis ins Leere faellt erst auf, wenn das Band live laeuft.
  const meldungen = baueMeldungen([
    termin(2, { titel: "Regellehrabend" }),
    termin(3, { titel: "Quizabend" }),
    termin(4, { titel: "Ausrüstung abholen" }),
    termin(5, { titel: "Spesenabrechnung" }),
    termin(6, { titel: "Irgendwas anderes" }),
  ], HEUTE);
  assert.equal(meldungen.length, 5);
  for (const m of meldungen) {
    assert.ok(existsSync(new URL("../" + m.bild, import.meta.url)),
      `${m.titel}: Bild ${m.bild} fehlt`);
  }
});

test("Bewegung laesst sich anhalten - und steht bei prefers-reduced-motion gar nicht erst an", () => {
  // WCAG 2.2.2: alles, was laenger als fuenf Sekunden automatisch
  // laeuft, braucht eine Pause. Und "reduzierte Bewegung" heisst hier
  // nicht "eine Karte zeigen, Rest verstecken" - dann fehlte Inhalt -,
  // sondern alle Karten untereinander.
  const js = lies("src/website/aktuelles.js");
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /aktuelles-gestapelt/);
  assert.match(js, /data-schalter/);
  assert.match(js, /aria-pressed/);
  assert.match(js, /mouseenter|focusin/);
  const css = lies("stil/aktuelles.css");
  assert.match(css, /\.aktuelles-gestapelt \.aktuelles-karte \{ display: grid !important; \}/);
  // Die Punkte sehen klein aus, muessen aber gross genug sein.
  assert.match(css, /\.aktuelles-punkt \{[^}]*width: 44px;[^}]*height: 44px;/s);
});

test("bei nur einer Meldung gibt es keine Bedienung fuer nichts", () => {
  const js = lies("src/website/aktuelles.js");
  assert.match(js, /if \(gesamt < 2\) return halter;/);
});

test("die Startseite haengt das Band ein und laedt die Termine nur einmal", () => {
  const html = lies("index.html");
  assert.match(html, /<section class="abschnitt aktuelles" id="aktuelles" hidden/);
  assert.match(html, /src\/website\/startseite-aktuelles\.js/);
  assert.match(html, /stil\/aktuelles\.css/);
  // Der Abschnitt weiter unten holt die Liste jetzt aus demselben Modul.
  assert.match(html, /holeOeffentlicheTermine\(\)/);
  assert.doesNotMatch(html, /rpc\/oeffentliche_termine/);
});
