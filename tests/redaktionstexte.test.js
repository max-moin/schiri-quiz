// ============================================================
//  Der Editor darf nie etwas anderes zeigen als die Seite
// ------------------------------------------------------------
//  Die Gefahr bei diesem Baukasten ist nicht der Fehler beim
//  Speichern, sondern das leise Auseinanderlaufen: jemand aendert
//  eine Ueberschrift direkt im HTML, der Editor zeigt weiter den
//  alten Ausgangsstand an - und beim naechsten "Veroeffentlichen"
//  setzt er die Aenderung stillschweigend zurueck.
//
//  Deshalb liest dieser Test die Haken aus dem HTML und vergleicht
//  sie zeichengenau mit der erzeugten Vorgabedatei.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TEXTE_STANDARD, TEXT_SEITEN } from "../src/website/redaktionstexte-standard.js";
import { saeubereText, wendeTexteAn } from "../src/website/redaktionstexte.js";
import { INHALTSBEREICHE, normalisiereWebsiteInhalt, validiereWebsiteInhalt } from "../src/website/content-config.js";

function hakenAusDatei(datei) {
  const html = readFileSync(new URL(`../${datei}`, import.meta.url), "utf8");
  const gefunden = {};
  const muster = /<([a-z0-9]+)([^>]*?)data-text="([^"]+)"([^>]*)>/gi;
  let treffer;
  while ((treffer = muster.exec(html)) !== null) {
    const [, tag, , schluessel] = treffer;
    const start = treffer.index + treffer[0].length;
    const ende = html.indexOf(`</${tag}>`, start);
    assert.ok(ende > start, `${datei}: kein Schlusstag für ${schluessel}`);
    gefunden[schluessel] = html.slice(start, ende);
  }
  return gefunden;
}

const alleFelder = (seite) => seite.gruppen.flatMap((gruppe) => gruppe.felder);

test("jeder Haken im HTML hat genau denselben Ausgangsstand wie der Editor", () => {
  let gezaehlt = 0;
  for (const seite of TEXT_SEITEN) {
    const haken = hakenAusDatei(seite.datei);
    for (const feld of alleFelder(seite)) {
      assert.ok(feld.schluessel in haken,
        `${seite.datei}: Haken data-text="${feld.schluessel}" fehlt im HTML`);
      assert.equal(haken[feld.schluessel], TEXTE_STANDARD[feld.schluessel],
        `${seite.datei}: Text im HTML weicht vom Ausgangsstand im Editor ab (${feld.schluessel})`);
      gezaehlt += 1;
    }
    // Umgekehrt: kein Haken im HTML, den der Editor nicht kennt.
    for (const schluessel of Object.keys(haken)) {
      assert.ok(TEXT_SEITEN.some((s) => alleFelder(s).some((f) => f.schluessel === schluessel)),
        `${seite.datei}: Haken ${schluessel} ist im Editor nicht aufgeführt`);
    }
  }
  assert.equal(gezaehlt, Object.keys(TEXTE_STANDARD).length);
  assert.ok(gezaehlt >= 70, `nur ${gezaehlt} Texte redaktionell erreichbar`);
});

test("jeder Schlüssel beginnt mit dem Kürzel seiner Seite", () => {
  for (const seite of TEXT_SEITEN) {
    for (const feld of alleFelder(seite)) {
      assert.ok(feld.schluessel.startsWith(`${seite.schluessel}.`), feld.schluessel);
      assert.ok(feld.beschriftung.length > 2, feld.schluessel);
    }
  }
});

test("der Bereich texte ist angemeldet und fällt auf den Ausgangsstand zurück", () => {
  assert.ok(INHALTSBEREICHE.includes("texte"));
  const leer = normalisiereWebsiteInhalt("texte", {}, TEXTE_STANDARD);
  assert.deepEqual(leer, { ...TEXTE_STANDARD });
  // Ein geleertes Feld darf keine Ueberschrift verschwinden lassen.
  const geleert = normalisiereWebsiteInhalt("texte", { "start.titel": "   " }, TEXTE_STANDARD);
  assert.equal(geleert["start.titel"], TEXTE_STANDARD["start.titel"]);
  // Ein unbekannter Schluessel wird nicht mitgeschleppt.
  const fremd = normalisiereWebsiteInhalt("texte", { "gibts.nicht": "hallo" }, TEXTE_STANDARD);
  assert.ok(!("gibts.nicht" in fremd));
});

test("die Prüfung meldet Nicht-Texte und zu lange Texte", () => {
  assert.deepEqual(validiereWebsiteInhalt("texte", { "start.titel": "Kurz" }), []);
  assert.equal(validiereWebsiteInhalt("texte", { "start.titel": 42 }).length, 1);
  assert.equal(validiereWebsiteInhalt("texte", { "start.titel": "x".repeat(601) }).length, 1);
});

test("nur harmlose Auszeichnungen überleben die Säuberung", () => {
  assert.equal(saeubereText("Ohne uns geht<br />kein Spiel"), "Ohne uns geht<br />kein Spiel");
  assert.equal(saeubereText("Sehr <strong>wichtig</strong>"), "Sehr <strong>wichtig</strong>");
  assert.equal(saeubereText('<img src=x onerror=alert(1)>Hallo'), "Hallo");
  assert.equal(saeubereText("<script>alert(1)</script>Text"), "alert(1)Text");
  assert.equal(saeubereText("<iframe src=\"x\"></iframe>"), "");
});

test("erlaubte Tags verlieren ihre Attribute", () => {
  // Das war das eigentliche Loch: der Tagname stand auf der Liste,
  // also blieb der ganze Tag stehen - samt onmouseover.
  assert.equal(saeubereText('<b onmouseover="alert(1)">x</b>'), "<b>x</b>");
  assert.equal(saeubereText('<span style="position:fixed" onclick="k()">x</span>'), "<span>x</span>");
  assert.equal(saeubereText('<em class="gross">x</em>'), "<em>x</em>");
  // Nur der Vereinsname darf am span bleiben, sonst stuende im Weg
  // zur Pfeife nach einer Veroeffentlichung eine Luecke.
  assert.equal(saeubereText('<span data-verein="name">FV</span>'), '<span data-verein="name">FV</span>');
  assert.equal(saeubereText('<span data-verein="name" onclick="k()">FV</span>'),
    '<span data-verein="name">FV</span>');
});

test("Links dürfen nur auf harmlose Ziele zeigen", () => {
  assert.equal(saeubereText('<a href="vorlagen.html">Absagen</a>'),
    '<a href="vorlagen.html">Absagen</a>');
  assert.equal(saeubereText('<a href="https://www.svf-dresden.de/">SVFD</a>'),
    '<a href="https://www.svf-dresden.de/" target="_blank" rel="noopener noreferrer">SVFD</a>');
  assert.equal(saeubereText('<a href="mailto:max@example.org">Mail</a>'),
    '<a href="mailto:max@example.org">Mail</a>');
  // javascript: und data: verlieren das Ziel und werden zum blossen Text.
  assert.equal(saeubereText('<a href="javascript:alert(1)">Klick</a>'), "<a>Klick</a>");
  assert.equal(saeubereText('<a href="data:text/html,x">Klick</a>'), "<a>Klick</a>");
});

test("die tatsächlich hinterlegten Texte überstehen die Säuberung unverändert", () => {
  // Kein Ausgangsstand darf durch die Saeuberung anders werden -
  // sonst aenderte sich die Seite allein durch ein Veroeffentlichen,
  // ohne dass jemand etwas getippt hat.
  for (const [schluessel, wert] of Object.entries(TEXTE_STANDARD)) {
    assert.equal(saeubereText(wert), wert, schluessel);
  }
});

test("wendeTexteAn ersetzt nur, was wirklich dasteht", () => {
  const elemente = [
    { dataset: { text: "start.titel" }, innerHTML: "alt" },
    { dataset: { text: "start.kicker" }, innerHTML: "alt" },
    { dataset: { text: "gibts.nicht" }, innerHTML: "alt" },
  ];
  const dokument = { querySelectorAll: () => elemente };
  const ersetzt = wendeTexteAn(dokument, { "start.titel": "Neu", "start.kicker": "   " });
  assert.equal(ersetzt, 1);
  assert.equal(elemente[0].innerHTML, "Neu");
  assert.equal(elemente[1].innerHTML, "alt");
  assert.equal(elemente[2].innerHTML, "alt");
  assert.equal(wendeTexteAn(null, {}), 0);
  assert.equal(wendeTexteAn(dokument, null), 0);
});

test("nach dem Ersetzen wird nachbearbeitet", () => {
  const element = { dataset: { text: "start.titel" }, innerHTML: "alt" };
  const dokument = { querySelectorAll: () => [element] };
  const nachgetragen = [];
  wendeTexteAn(dokument, { "start.titel": "Neu" }, (el) => nachgetragen.push(el));
  assert.deepEqual(nachgetragen, [element]);
  // Unveraenderter Text loest keine Nachbearbeitung aus.
  nachgetragen.length = 0;
  wendeTexteAn(dokument, { "start.titel": "Neu" }, (el) => nachgetragen.push(el));
  assert.deepEqual(nachgetragen, []);
});
