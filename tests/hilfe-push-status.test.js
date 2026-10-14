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
    if (!knoten.has(id)) knoten.set(id, { textContent: "", hidden: true, disabled: false, checked: false, dataset: {}, events: {},
      addEventListener(typ, fn) { this.events[typ] = fn; }, replaceChildren() {}, append() {} });
    return knoten.get(id);
  };
  let person = { id: "11111111-1111-1111-1111-111111111111", pin: "1234" };
  let abonnent;
  const context = { document: { getElementById: $, createElement: () => ({ append() {}, setAttribute() {}, addEventListener() {} }) },
    SchiriSeitenAnmeldung: { anmeldung: { lesen: () => person, abonniere: (fn) => { abonnent = fn; } } },
    DATENBANK: {}, Notification: { permission: "default" }, lagebericht: () => ({ moeglich: true }),
    erklaereMitteilungsstatus, fetch: antwort, aktuellesAbo: async () => null,
    montiereTerminerinnerungen: async () => {}, addEventListener() {}, confirm: () => true,
    einschalten: () => { throw new Error("kein Permission-Prompt beim Laden"); } };
  const skript = lies("src/website/mitteilungen-steuerung.js").replace(/^import .+;\n/gm, "");
  vm.runInNewContext(skript, context);
  abonnent(person);
  await new Promise((resolve) => setImmediate(resolve));
  $.wechsel = async (neu) => { person = neu; abonnent(neu); await new Promise((resolve) => setImmediate(resolve)); };
  return $;
}

function erfolgreicheAntwort(url) {
  return url === "/api/push-bereitschaft"
    ? { ok: true, json: async () => ({ bereit: true, modus: "einrichtung", oeffentlicherSchluessel: "test" }) }
    : { ok: true, text: async () => JSON.stringify({ feedback_antwort: false, quiz_neu: false, quiz_erinnerung: false, termine: false, geraete: [] }) };
}

test("Themen anklicken lädt nichts neu; ein Speichern sendet alle fünf Werte", async () => {
  const aufrufe = [];
  const $ = await steuerungMit(async (url, init) => { aufrufe.push({ url, body: JSON.parse(init.body) }); return erfolgreicheAntwort(url); });
  aufrufe.length = 0;
  $("mitteilungen-quiz-neu").checked = true;
  $("mitteilungen-quiz-neu").events.change();
  $("mitteilungen-termine").checked = true;
  $("mitteilungen-termine").events.change();
  $("mitteilungen-ausruestung").checked = true;
  $("mitteilungen-ausruestung").events.change();
  assert.equal(aufrufe.length, 0);
  assert.equal($("mitteilungen-steuerung").hidden, false);
  assert.match($("mitteilungen-speicherstand").textContent, /Noch nicht gespeichert/);
  assert.equal($("mitteilungen-abo-knopf").disabled, true);
  await $("mitteilungen-auswahl-speichern").events.click();
  assert.equal(aufrufe.length, 1);
  assert.match(aufrufe[0].url, /schiri_push_auswahl_v2_setzen$/);
  assert.equal(aufrufe[0].body.p_ausruestung_status,true);
  assert.equal(aufrufe[0].body.p_quiz_neu, true);
  assert.equal(aufrufe[0].body.p_termine, true);
  assert.equal(aufrufe[0].body.p_feedback_antwort, false);
  assert.equal(aufrufe[0].body.p_quiz_erinnerung, false);
  assert.equal($("mitteilungen-steuerung").hidden, false);
  assert.equal($("mitteilungen-auswahl-speichern").disabled, true);
  assert.equal($("mitteilungen-abo-knopf").disabled, false);
});

test("Speicherfehler behält Entwurf und sichtbare Auswahl; erneutes Speichern bleibt möglich", async () => {
  const $ = await steuerungMit(async (url) => /schiri_push_auswahl_v2_setzen$/.test(url)
    ? { ok: false, text: async () => "" } : erfolgreicheAntwort(url));
  $("mitteilungen-quiz-neu").checked = true; $("mitteilungen-quiz-neu").events.change();
  await $("mitteilungen-auswahl-speichern").events.click();
  assert.equal($("mitteilungen-quiz-neu").checked, true);
  assert.equal($("mitteilungen-steuerung").hidden, false);
  assert.equal($("mitteilungen-auswahl-speichern").disabled, false);
  assert.equal($("mitteilungen-speicherstand").dataset.zustand, "fehler");
});

test("Doppelklick speichert nur einmal; Abmeldung ignoriert späte Speicherantwort", async () => {
  let fertig; let anzahl = 0;
  const $ = await steuerungMit(async (url) => {
    if (/schiri_push_auswahl_v2_setzen$/.test(url)) { anzahl++; await new Promise((r) => { fertig = r; }); }
    return erfolgreicheAntwort(url);
  });
  $("mitteilungen-quiz-neu").checked = true; $("mitteilungen-quiz-neu").events.change();
  const lauf = $("mitteilungen-auswahl-speichern").events.click();
  await $("mitteilungen-auswahl-speichern").events.click();
  assert.equal(anzahl, 1);
  await $.wechsel(null); fertig(); await lauf;
  assert.equal($("mitteilungen-steuerung").hidden, true);
  assert.equal($("mitteilungen-terminbereich").hidden, true);
});

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
