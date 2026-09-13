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

test("jeder Haken im HTML hat genau denselben Ausgangsstand wie der Editor", () => {
  let gezaehlt = 0;
  for (const seite of TEXT_SEITEN) {
    const haken = hakenAusDatei(seite.datei);
    for (const feld of seite.felder) {
      assert.ok(feld.schluessel in haken,
        `${seite.datei}: Haken data-text="${feld.schluessel}" fehlt im HTML`);
      assert.equal(haken[feld.schluessel], TEXTE_STANDARD[feld.schluessel],
        `${seite.datei}: Text im HTML weicht vom Ausgangsstand im Editor ab (${feld.schluessel})`);
      gezaehlt += 1;
    }
    // Umgekehrt: kein Haken im HTML, den der Editor nicht kennt.
    for (const schluessel of Object.keys(haken)) {
      assert.ok(TEXT_SEITEN.some((s) => s.felder.some((f) => f.schluessel === schluessel)),
        `${seite.datei}: Haken ${schluessel} ist im Editor nicht aufgeführt`);
    }
  }
  assert.equal(gezaehlt, Object.keys(TEXTE_STANDARD).length);
  assert.ok(gezaehlt >= 20);
});

test("jeder Schlüssel beginnt mit dem Kürzel seiner Seite", () => {
  for (const seite of TEXT_SEITEN) {
    for (const feld of seite.felder) {
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
  assert.equal(saeubereText('<script>alert(1)</script>Text'), "alert(1)Text");
  assert.equal(saeubereText('<a href="https://example.invalid">Link</a>'), "Link");
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
