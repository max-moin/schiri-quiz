import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const wurzel = new URL("../", import.meta.url);
const lies = (pfad) => readFileSync(new URL(pfad, wurzel), "utf8");

function pngGroesse(pfad) {
  const datei = readFileSync(new URL(pfad, wurzel));
  assert.equal(datei.toString("hex", 0, 8), "89504e470d0a1a0a", `${pfad} ist keine PNG-Datei`);
  return { breite: datei.readUInt32BE(16), hoehe: datei.readUInt32BE(20) };
}

test("das Web-App-Manifest beschreibt eine eigenstaendige Kickers-App", () => {
  const manifest = JSON.parse(lies("app.webmanifest"));
  assert.equal(manifest.name, "Schiedsrichter FV Löbtauer Kickers");
  assert.equal(manifest.short_name, "Kickers SR");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#1f2937");

  const symbole = new Map(manifest.icons.map((symbol) => [symbol.sizes, symbol]));
  for (const groesse of ["192x192", "512x512"]) {
    assert.ok(symbole.has(groesse), `Manifest-Symbol ${groesse} fehlt`);
    assert.match(symbole.get(groesse).purpose, /maskable/);
  }
});

test("die Home-Bildschirm-Symbole haben die angekuendigten Abmessungen", () => {
  for (const [pfad, breite, hoehe] of [
    ["bilder/app-icon-192.png", 192, 192],
    ["bilder/app-icon-512.png", 512, 512],
    ["bilder/apple-touch-icon.png", 180, 180],
  ]) {
    assert.ok(existsSync(new URL(pfad, wurzel)), `${pfad} fehlt`);
    assert.deepEqual(pngGroesse(pfad), { breite, hoehe });
  }
});

test("jede HTML-Seite bindet Manifest und iPhone-Symbol ein", () => {
  const seiten = readdirSync(wurzel, { encoding: "utf8" }).filter((name) => name.endsWith(".html"));
  assert.ok(seiten.length >= 20, "unerwartet wenige HTML-Seiten");
  for (const seite of seiten) {
    const inhalt = lies(seite);
    assert.match(inhalt, /<link rel="manifest" href="app\.webmanifest"\s*\/?>/, `${seite}: Manifest fehlt`);
    assert.match(inhalt, /<link rel="apple-touch-icon" href="bilder\/apple-touch-icon\.png"\s*\/?>/, `${seite}: iPhone-Symbol fehlt`);
    assert.match(inhalt, /<meta name="theme-color" content="#1f2937"\s*\/?>/, `${seite}: Theme-Farbe fehlt`);
  }
});

test("das iPhone-Teilen-Symbol ist gezeichnet und steht neben dem Wort", () => {
  // Runde 3 des Usability-Tests, iPhone: "Die Anleitung ist gut, aber das
  // abgebildete Symbol ist nur ein Pfeil nach oben." Im Safari-Menue gibt
  // es keinen blossen Pfeil - der Teilen-Knopf ist ein oben offenes
  // Rechteck mit einem Pfeil, der herausragt.
  const seite = lies("installieren.html");
  const anfang = seite.indexOf("<li>Tippe auf");
  assert.ok(anfang > -1, "der Teilen-Schritt fehlt");
  const schritt = seite.slice(anfang, seite.indexOf("</li>", anfang));

  assert.match(schritt, /<svg /, "das Teilen-Symbol ist nicht gezeichnet");
  assert.doesNotMatch(schritt, /↑/, "der blosse Pfeil ist zurueck");
  // "Woerter statt blosser Icons": das Bild ist Beiwerk, das Wort traegt.
  assert.match(schritt, /<strong>Teilen<\/strong>/);
  assert.match(schritt, /aria-hidden="true"/);
});

test("die Anleitung haengt nicht nur tief unter den Unterlagen", () => {
  // Runde 3: die Testperson suchte die Anleitung ueber ein Hilfemenue und
  // kam nicht darauf, dass sie unter "Unterlagen" liegt. Sie steht jetzt
  // zusaetzlich im Fuss jeder Seite.
  //
  // quiz.html fehlt hier bewusst: an der Datei arbeitet gerade jemand
  // anderes, sie wurde in dieser Runde nicht angefasst.
  const seiten = readdirSync(wurzel, { encoding: "utf8" })
    .filter((name) => name.endsWith(".html") && name !== "quiz.html");
  for (const seite of seiten) {
    assert.match(lies(seite), /<a href="installieren\.html"[^>]*>App installieren<\/a>/,
      `${seite}: der Fusseintrag zur Installationsanleitung fehlt`);
  }
});

test("die Anleitung deckt iPhone, iPad und Android ohne Zwangsdialog ab", () => {
  const seite = lies("installieren.html");
  const skript = lies("src/website/installieren-seite.js");

  assert.match(seite, /iPhone oder iPad · Safari/);
  assert.match(seite, /Zum Home-Bildschirm/);
  assert.match(seite, /Android · Chrome/);
  assert.match(seite, /Zum Startbildschirm hinzufügen/);
  assert.match(seite, /Apple Support/);
  assert.match(seite, /Google Chrome-Hilfe/);
  assert.match(lies("informationen.html"), /href="installieren\.html"/);

  assert.match(skript, /beforeinstallprompt/);
  assert.match(skript, /knopf\?\.addEventListener\("click"/);
  assert.doesNotMatch(skript, /(?:alert|confirm|window\.prompt)\s*\(/);
  assert.doesNotMatch(skript, /installEreignis\.prompt\(\)[\s\S]*addEventListener\("beforeinstallprompt"/);

  // Die Kachel "Direkt installieren" traegt im HTML hidden. Ohne eigene
  // [hidden]-Regel schlaegt das display: flex aus dem Stylesheet die
  // Browserregel, und auf dem iPhone stand dauerhaft "Dein Browser kann
  // die Seite direkt installieren" - was dort gerade nicht stimmt.
  assert.match(lies("stil/installieren.css"), /\.installieren-direkt\[hidden\]\s*\{\s*display: none;\s*\}/);
});
