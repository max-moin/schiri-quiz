// Der Baum der Seite und der Weg eine Ebene hoch.
//
// Max am 12.09.2026: "In viele Menüs fehlt der Zurück-Button [...] das
// wird gerade relevant, wenn man die Webapp nutzt ohne die Safari-Vor-
// und-Zurück-Steuerung."
//
// Vom Home-Bildschirm gestartet laeuft die Seite im standalone-Modus:
// keine Adresszeile, keine Pfeile. Wer dann in einer Unterseite steht,
// kommt ohne einen Weg IM INHALT nicht mehr heraus. Diese Tests halten
// fest, dass es diesen Weg auf jeder Seite gibt und dass er ein Ziel
// benennt statt nur "zurueck" zu sagen.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { BAUM, pfadZu, elternVon, baueWegweiser } from "../src/ui/wegweiser.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

// Seiten, die absichtlich nicht im Baum haengen.
const AUSSERHALB = new Set([
  // Eigener Bereich hinter Passwort und TOTP, mit eigener Wurzel.
  "obmann.html",
]);

test("jede Seite der Vereinsseite haengt im Baum", () => {
  const seiten = readdirSync(new URL("../", import.meta.url))
    .filter((d) => d.endsWith(".html"));
  for (const seite of seiten) {
    if (AUSSERHALB.has(seite)) continue;
    assert.ok(BAUM[seite], `${seite} fehlt im Baum - dort gaebe es keinen Weg zurueck`);
  }
});

test("jeder Weg endet an der Startseite, und keiner dreht sich im Kreis", () => {
  for (const seite of Object.keys(BAUM)) {
    const weg = pfadZu(seite);
    assert.ok(weg.length >= 1, seite + " hat gar keinen Pfad");
    assert.equal(weg[0].href, "index.html", seite + ": der Pfad beginnt nicht an der Startseite");
    assert.equal(weg[weg.length - 1].titel, BAUM[seite].titel, seite + ": der Pfad endet woanders");
    // Ein Ringschluss wuerde den Pfad an der Obergrenze abschneiden und
    // damit nicht mehr an index.html beginnen - oben schon gepruaeft.
    // Hier zusaetzlich: jeder Elternknoten existiert wirklich.
    const eltern = elternVon(seite);
    if (eltern) assert.ok(BAUM[eltern], `${seite} zeigt auf ein unbekanntes Eltern "${eltern}"`);
  }
});

test("nur die Startseite hat keinen Weg nach oben", () => {
  assert.equal(elternVon("index.html"), null);
  for (const seite of Object.keys(BAUM)) {
    if (seite === "index.html") continue;
    assert.ok(elternVon(seite), seite + " ist eine Sackgasse");
  }
});

// Ein sehr kleiner Test-DOM: nur das, was baueWegweiser benutzt.
class TestKnoten {
  constructor(tag) {
    this.tag = tag;
    this.kinder = [];
    this.attribute = {};
    this.text = "";
    this.className = "";
  }
  set textContent(wert) { this.text = String(wert); }
  get textContent() { return this.text || this.kinder.map((k) => k.textContent).join(""); }
  setAttribute(name, wert) { this.attribute[name] = String(wert); }
  getAttribute(name) { return this.attribute[name] ?? null; }
  set href(wert) { this.attribute.href = wert; }
  get href() { return this.attribute.href; }
  appendChild(kind) { this.kinder.push(kind); return kind; }
  alle() { return this.kinder.flatMap((k) => [k, ...k.alle()]); }
  mitKlasse(klasse) { return this.alle().filter((k) => k.className === klasse); }
}
const testDokument = { createElement: (tag) => new TestKnoten(tag) };

test("der Weg nach oben nennt sein Ziel statt nur 'zurueck'", () => {
  // "Zurueck" allein sagt nicht, wo man landet. Auf installieren.html
  // ist das Ziel "Unterlagen", nicht die Startseite - wer das nicht
  // liest, tippt und verliert zwei Ebenen.
  const leiste = baueWegweiser("installieren.html", testDokument);
  assert.ok(leiste, "installieren.html bekommt keinen Wegweiser");
  const hoch = leiste.mitKlasse("wegweiser-zurueck")[0];
  assert.ok(hoch, "es gibt keinen Weg nach oben");
  assert.equal(hoch.href, "informationen.html");
  assert.equal(hoch.getAttribute("aria-label"), "Zurück zu Unterlagen");
  assert.equal(leiste.mitKlasse("wegweiser-ziel")[0].textContent, "Unterlagen");
});

test("der Pfad zeigt die ganze Tiefe und markiert die aktuelle Seite", () => {
  const leiste = baueWegweiser("frage-vorschlagen.html", testDokument);
  const punkte = leiste.alle().filter((k) => k.tag === "li");
  assert.equal(punkte.length, 3, "Start > Ideen & Feedback > Frage vorschlagen");
  assert.equal(punkte[0].textContent, "Start");
  assert.equal(punkte[2].textContent, "Frage vorschlagen");
  const jetzt = leiste.alle().filter((k) => k.getAttribute("aria-current") === "page");
  assert.equal(jetzt.length, 1, "genau eine Angabe 'hier bist du'");
  assert.equal(jetzt[0].textContent, "Frage vorschlagen");
});

test("auf der Startseite steht kein Wegweiser", () => {
  assert.equal(baueWegweiser("index.html", testDokument), null);
  // Und auf einer unbekannten Seite lieber gar keiner als ein falscher.
  assert.equal(baueWegweiser("gibtesnicht.html", testDokument), null);
});

test("der eigene Bereich fuehrt ueber einen benannten Zwischenschritt", () => {
  // Das Kontomenue ist ein Ort im Kopf der Leute, aber keine Adresse.
  // Es steht deshalb im Pfad, ist aber kein Link.
  const weg = pfadZu("ausruestung.html");
  assert.deepEqual(weg.map((s) => s.titel), ["Start", "Mein Konto", "Meine Ausrüstung"]);
  assert.equal(weg[1].href, null, '"Mein Konto" darf kein Link sein');
});

test("seite.js haengt den Wegweiser in jede Vereinsseite", () => {
  const js = lies("seite.js");
  assert.match(js, /import \{ montiereWegweiser \}/);
  assert.match(js, /montiereWegweiser\(document\.querySelector\("main\.inhalt"\)\)/);
});

test("die rechtlichen Seiten tragen den Weg fest im HTML", () => {
  // Sie laden kein JavaScript - ein Modul kann dort nicht laufen. Ohne
  // festen Link waeren sie in der App eine Sackgasse.
  for (const seite of ["impressum.html", "datenschutz.html", "nutzungsbedingungen.html"]) {
    const html = lies(seite);
    assert.match(html, /class="wegweiser-zurueck" href="index\.html"/, seite + ": kein Weg zurueck");
    assert.doesNotMatch(html, /<script/, seite + " laedt jetzt doch JavaScript - dann gehoert der Wegweiser ins Modul");
  }
});

test("auf JEDER Seite unterhalb der Wurzel gibt es wirklich einen Weg nach oben", () => {
  // Der eigentliche Zweck der ganzen Sache. Drei Bauarten sind erlaubt,
  // und jede Seite muss genau eine davon haben:
  //   1. Vereinsseite   -> seite.js haengt den Wegweiser in main.inhalt
  //   2. rechtliche Seite -> fester Link im HTML (dort laeuft kein JS)
  //   3. Quizoberflaeche -> der Hausknopf im kompakten Kopf
  // Faellt eine Seite durch alle drei Raster, ist sie in der App eine
  // Sackgasse - und genau das faellt beim Bauen nicht auf, weil im
  // Browser die Pfeile ja da sind.
  for (const seite of Object.keys(BAUM)) {
    if (seite === "index.html") continue;
    const html = lies(seite);
    const ueberModul = /<main class="inhalt/.test(html) && /src="seite\.js"/.test(html);
    const festImHtml = /class="wegweiser-zurueck"/.test(html);
    const hausknopf = /class="heim-knopf"/.test(html);
    assert.ok(ueberModul || festImHtml || hausknopf,
      `${seite} hat keinen Weg nach oben - ohne Browserleiste eine Sackgasse`);
  }
});

test("der Weg nach oben ist ein echter Link und nicht history.back()", () => {
  // history.back() tut nichts, wenn die Seite der erste Aufruf war -
  // genau der Fall beim Start vom Home-Bildschirm oder ueber einen
  // geteilten Link.
  // Ohne Kommentarzeilen geprueft: im Kopf der Datei steht genau diese
  // Begruendung, und die soll den Test nicht selbst ausloesen.
  const js = lies("src/ui/wegweiser.js")
    .split("\n").filter((z) => !z.trimStart().startsWith("//")).join("\n");
  assert.doesNotMatch(js, /history\.back\(\)/);
  assert.match(js, /hoch\.href = eltern/);
});
