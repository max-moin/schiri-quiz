import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* ============================================================
   Der Spesenrechner auf dem Handy
   ============================================================
   Max am 29.08.2026: "vor allem auch fuer die mobile Version auf dem
   Handy besser." Zielbreite ist 390 px.

   Die Regeln, die das tragen, stehen in CSS und lassen sich nicht
   ausrechnen. Deshalb pruefen diese Tests nicht das Aussehen, sondern
   die Zusagen, an denen es haengt: Tippziele, Zifferntastaturen, eine
   sichtbare Ergebniszeile - und die Auflage, dass spesen.css keine
   nackten Elementselektoren dazubekommt. Die Datei laedt auch
   obmann.html; ein neues "input { ... }" hier faerbt dort die
   Redaktionsmaske mit ein.
   ============================================================ */

const html = readFileSync(new URL("../spesenrechner.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../stil/spesen.css", import.meta.url), "utf8");

const cssOhneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Zerlegt einen CSS-Abschnitt in { selektor -> Deklarationen }. */
function regeln(abschnitt) {
  const gefunden = new Map();
  const muster = /([^{}]+)\{([^{}]*)\}/g;
  let treffer;
  while ((treffer = muster.exec(abschnitt)) !== null) {
    const kopf = treffer[1].trim();
    if (kopf.startsWith("@")) continue;
    for (const selektor of kopf.split(",")) {
      const name = selektor.trim().replace(/\s+/g, " ");
      if (!name) continue;
      gefunden.set(name, (gefunden.get(name) || "") + treffer[2]);
    }
  }
  return gefunden;
}

/**
 * Sammelt die Rumpfe ALLER Medienabfragen mit diesem Kopf.
 *
 * Es gibt mehr als eine: Das Raster wird seit dem 21.08.2026 in einem
 * eigenen Block einspaltig, die Handyfassung kam am 29.08.2026 als
 * zweiter dazu. Wer nur den ersten liest, prueft die falsche Haelfte.
 */
function medienbloecke(quelle, kopf) {
  const rumpfe = [];
  let ab = 0;
  for (;;) {
    const start = quelle.indexOf(kopf, ab);
    if (start === -1) break;
    const auf = quelle.indexOf("{", start);
    let tiefe = 0;
    let ende = -1;
    for (let j = auf; j < quelle.length; j += 1) {
      if (quelle[j] === "{") tiefe += 1;
      else if (quelle[j] === "}") {
        tiefe -= 1;
        if (tiefe === 0) { ende = j; break; }
      }
    }
    assert.notEqual(ende, -1, `Medienabfrage "${kopf}" ist nicht geschlossen`);
    rumpfe.push(quelle.slice(auf + 1, ende));
    ab = ende;
  }
  assert.ok(rumpfe.length, `Medienabfrage "${kopf}" fehlt in stil/spesen.css`);
  return rumpfe.join("\n");
}

// Einzige erlaubte Ausnahme. Sie stammt aus dem alten <style>-Block der
// Seite und ist beim Aufteilen am 29.08.2026 bewusst so uebernommen
// worden - neue duerfen nicht dazukommen.
const ERLAUBTE_ELEMENTSELEKTOREN = new Set(["label"]);

test("spesen.css bekommt keine weiteren nackten Elementselektoren", () => {
  const muster = /([^{}]+)\{/g;
  let treffer;
  const nackt = [];
  while ((treffer = muster.exec(cssOhneKommentare)) !== null) {
    const kopf = treffer[1].trim();
    if (kopf.startsWith("@")) continue;
    for (const selektor of kopf.split(",")) {
      const name = selektor.trim();
      if (!name) continue;
      const erstesGlied = name.split(/[\s>+~]/)[0];
      const istGeschuetzt = /^[.#:\[]/.test(erstesGlied) || erstesGlied.includes(".") || erstesGlied.includes("#");
      if (!istGeschuetzt && !ERLAUBTE_ELEMENTSELEKTOREN.has(erstesGlied)) nackt.push(name);
    }
  }
  assert.deepEqual(nackt, [],
    "stil/spesen.css laedt auch obmann.html - solche Regeln schlagen dort durch");
});

const SCHMAL = "@media (max-width: 880px)";

test("auf dem Handy ist jedes Tippziel mindestens 44 px hoch", () => {
  const schmal = regeln(medienbloecke(cssOhneKommentare, SCHMAL));
  const tippziele = [
    ".rechner .feld",
    ".rechner .haken",
    ".rechner .q-eingabe",
    ".rechner .segment-breit button",
    ".el-sprung",
  ];
  for (const selektor of tippziele) {
    const block = schmal.get(selektor);
    assert.ok(block, `${selektor} hat in ${SCHMAL} keine eigene Regel`);
    const hoehe = /min-height:\s*(\d+)px/.exec(block);
    assert.ok(hoehe, `${selektor} setzt kein min-height`);
    assert.ok(Number(hoehe[1]) >= 44,
      `${selektor} ist nur ${hoehe[1]} px hoch - unter 44 px trifft der Daumen daneben`);
  }
});

test("Eingabefelder bleiben bei 16 px, damit iOS Safari nicht hineinzoomt", () => {
  const schmal = regeln(medienbloecke(cssOhneKommentare, SCHMAL));
  for (const selektor of [".rechner .feld", ".rechner .q-eingabe"]) {
    assert.match(schmal.get(selektor) || "", /font-size:\s*16px/,
      `${selektor} unter 16px laesst iOS beim Antippen in die Seite zoomen`);
  }
});

test("das Ergebnis bleibt auf dem Handy sichtbar", () => {
  // Einspaltig steht die Quittung hinter dem Formular. Ohne diese Zeile
  // tippt man oben und sieht die Zahl erst nach dem Durchscrollen.
  assert.match(html, /class="ergebnis-leiste"/);
  assert.match(html, /id="elBetrag"/);
  assert.match(html, /id="elTitel"/);
  assert.match(html, /\$\("elBetrag"\)\.textContent = euro\(gesamt\)/,
    "die klebende Zeile wird nicht mit dem Gesamtbetrag gefuellt");

  const schmal = regeln(medienbloecke(cssOhneKommentare, SCHMAL));
  assert.match(schmal.get(".ergebnis-leiste") || "", /position:\s*sticky/);
  assert.match(schmal.get(".ergebnis-leiste") || "", /bottom:\s*0/);
  // Die Quittung darf einspaltig nicht mehr kleben, sonst kleben zwei
  // Dinge gleichzeitig und die halbe Anzeige ist belegt.
  assert.match(schmal.get(".quittung") || "", /position:\s*static/);
});

const NUMMERNFELDER = ["stunden", "plz", "plzA1", "plzA2", "ticketBetrag", "km"];

test("jedes Zahlenfeld oeffnet auf dem Handy die Zifferntastatur", () => {
  for (const id of NUMMERNFELDER) {
    const tag = new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
    assert.ok(tag, `Feld #${id} fehlt`);
    assert.match(tag[0], /inputmode="(decimal|numeric)"/,
      `#${id} hat kein inputmode - auf dem Handy erscheint die Buchstabentastatur`);
  }
  // Die Betragsfelder der Quittung entstehen erst im Skript.
  assert.match(html, /feld\.inputMode = "decimal"/);
});

test("kein Wert aus der Datenbank wird als Markup eingesetzt", () => {
  // Vereinsname und Ort kommen aus der vom Obmann veroeffentlichten
  // Konfiguration. Sie standen bis zum 29.08.2026 in einer
  // innerHTML-Zuweisung.
  assert.doesNotMatch(html, /innerHTML\s*=\s*`/,
    "Datenbankwerte gehoeren ueber textContent in die Seite, nicht ueber innerHTML");
});
