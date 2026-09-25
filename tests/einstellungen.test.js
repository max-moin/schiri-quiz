import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { erklaereMitteilungsstatus } from "../src/features/mitteilungen-status.js";
import { BAUM } from "../src/ui/wegweiser.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

test("das Kontomenü führt zu Einstellungen statt direkt zu Meine Daten", () => {
  const seite = lies("seite.js");
  assert.match(seite, /text: "Einstellungen"[\s\S]*einstellungen\.html/);
  assert.doesNotMatch(seite, /text: "Meine Daten", tun:/);
});

test("Einstellungen hat zwei echte Unterbereiche ohne neue Hauptnavigation", () => {
  const seite = lies("einstellungen.html");
  assert.match(seite, /href="meine-daten\.html"/);
  assert.match(seite, /href="mitteilungen\.html"/);
  assert.equal(BAUM["meine-daten.html"].eltern, "einstellungen.html");
  assert.equal(BAUM["mitteilungen.html"].eltern, "einstellungen.html");
  assert.match(seite, /id="einstellungen-zugang"[^>]*hidden/);
  assert.match(lies("mitteilungen.html"), /id="einstellungen-inhalt"[^>]*hidden/);
});

test("Mitteilungen bleiben bis zur Pilotfreigabe gesperrt und fragen beim Laden keine Erlaubnis an", () => {
  const html = lies("mitteilungen.html");
  const skript = lies("src/website/einstellungen-seite.js");
  const steuerung = lies("src/website/mitteilungen-steuerung.js");
  assert.match(html, /Noch nicht gestartet/);
  assert.doesNotMatch(skript, /requestPermission|\.subscribe\(/);
  assert.match(html, /id="mitteilungen-steuerung"[^>]*hidden/);
  assert.match(steuerung, /\/api\/push-bereitschaft/);
  assert.match(lies("verein.config.js"), /versandAktiv: false/);
  assert.doesNotMatch(lies("verein.config.js"), /pilotSchiedsrichterId/);
});

test("der bisherige Installationsschalter braucht Schluessel UND freigegebenen Versand", () => {
  const konfiguration = lies("verein.config.js");
  const schalter = lies("src/website/push-schalter.js");
  assert.match(konfiguration, /versandAktiv: false/);
  assert.match(schalter, /!SCHLUESSEL \|\| VEREIN\.push\?\.versandAktiv !== true/);
});

test("iPhone im Safari-Tab bekommt einen konkreten Installationshinweis", () => {
  const status = erklaereMitteilungsstatus({
    moeglich: false, hinweis: "installieren", grund: "Home-Bildschirm nötig",
  }, "default", false);
  assert.equal(status.installationZeigen, true);
  assert.match(status.hinweis, /installierten Web-App/);
});

test("geeigneter Browser ist noch kein aktiver Versand", () => {
  const status = erklaereMitteilungsstatus({ moeglich: true }, "default", false);
  assert.match(status.kurz, /Vorbereitung/);
  assert.equal(status.erlaubnis, "Noch nicht angefragt");
});

test("blockierte Berechtigung wird statt Aktivierung erklärt", () => {
  const status = erklaereMitteilungsstatus({ moeglich: false }, "denied", false);
  assert.match(status.kurz, /blockiert/);
  assert.match(status.hinweis, /Einstellungen deines Geräts/);
});
