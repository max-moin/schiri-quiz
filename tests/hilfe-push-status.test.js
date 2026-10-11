import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { erklaereMitteilungsstatus } from "../src/features/mitteilungen-status.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

test("Hilfe hat gültige lokale Ziele und offizielle Sonderberichtquelle", () => {
  const html = lies("hilfe.html");
  for (const match of html.matchAll(/href="([^"#:]+\.html)"/g)) {
    assert.ok(existsSync(new URL("../" + match[1], import.meta.url)), match[1]);
  }
  for (const id of ["dfbnet", "sonderbericht", "schiri-treff"]) {
    assert.ok(html.includes(`href="#${id}"`));
    assert.ok(html.includes(`id="${id}"`));
  }
  assert.match(html, /Ruf Max nach dem Spiel an/);
  assert.match(html, /https:\/\/www\.svf-dresden\.de\/dokumente\/sonderbericht\//);
  assert.match(html, /nicht automatisch ein anrechenbarer Regellehrabend/);
});

test("Push unterscheidet Prüfen, Ladefehler und deaktivierten Versand", () => {
  const lage = { moeglich: true };
  assert.match(erklaereMitteilungsstatus(lage, "default", "pruefen").kurz, /geprüft/);
  assert.match(erklaereMitteilungsstatus(lage, "default", "fehler").kurz, /nicht geprüft/);
  assert.match(erklaereMitteilungsstatus(lage, "default", false).hinweis, /Browsererlaubnis allein/);
  assert.match(erklaereMitteilungsstatus(lage, "granted", true).kurz, /empfangen/);
});

async function steuerungMit(antwort) {
  const knoten = new Map();
  const $ = (id) => {
    if (!knoten.has(id)) knoten.set(id, { textContent: "", hidden: true, disabled: false, checked: false,
      addEventListener() {}, replaceChildren() {}, append() {} });
    return knoten.get(id);
  };
  const person = { id: "11111111-1111-1111-1111-111111111111", pin: "1234" };
  let abonnent;
  const context = { document: { getElementById: $, createElement: () => ({ append() {}, setAttribute() {}, addEventListener() {} }) },
    SchiriSeitenAnmeldung: { anmeldung: { lesen: () => person, abonniere: (fn) => { abonnent = fn; } } },
    DATENBANK: {}, Notification: { permission: "default" }, lagebericht: () => ({ moeglich: true }),
    erklaereMitteilungsstatus, fetch: antwort, aktuellesAbo: async () => null, einschalten: () => { throw new Error("kein Permission-Prompt beim Laden"); } };
  const skript = lies("src/website/mitteilungen-steuerung.js").replace(/^import .+;\n/gm, "");
  vm.runInNewContext(skript, context);
  abonnent(person);
  await new Promise((resolve) => setImmediate(resolve));
  return $;
}

test("Serverfehler bleibt sichtbar, auch wenn die Auswahl verborgen ist", async () => {
  const $ = await steuerungMit(async () => ({ ok: false, status: 503 }));
  assert.equal($("mitteilungen-steuerung").hidden, true);
  assert.match($("mitteilungen-versand").textContent, /fehlgeschlagen/);
  assert.match($("mitteilungen-hinweis").textContent, /erneut/);
});

test("Nur echte Serverantwort bereit:false zeigt noch nicht gestartet", async () => {
  const $ = await steuerungMit(async () => ({ ok: true, json: async () => ({ bereit: false }) }));
  assert.equal($("mitteilungen-versand").textContent, "Noch nicht gestartet");
  assert.match($("mitteilungen-hinweis").textContent, /Obmann/);
});

test("Ungültiges Antwortformat wird nicht als Freigabe interpretiert", async () => {
  const $ = await steuerungMit(async () => ({ ok: true, json: async () => ({}) }));
  assert.equal($("mitteilungen-steuerung").hidden, true);
  assert.match($("mitteilungen-versand").textContent, /fehlgeschlagen/);
});

test("Freigabe allein zeigt noch keine alten Kontodaten bei Fehlern der persönlichen Auswahl", async () => {
  const $ = await steuerungMit(async (url) => url === "/api/push-bereitschaft"
    ? { ok: true, json: async () => ({ bereit: true, modus: "pilot", oeffentlicherSchluessel: "test" }) }
    : { ok: false, text: async () => "" });
  assert.equal($("mitteilungen-steuerung").hidden, true);
  assert.match($("mitteilungen-versand").textContent, /fehlgeschlagen/);
});
