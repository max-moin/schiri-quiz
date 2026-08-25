import assert from "node:assert/strict";
import test from "node:test";

import {
  ladeSpesenKonfiguration,
  normalisiereSpesenKonfiguration,
  standardSpesenKonfiguration,
} from "../src/website/spesen-config.js";

const fallback = standardSpesenKonfiguration({
  altersklassen: [{ name: "Herren", ligen: [{ stufe: 1, kurz: "Stadt", voll: "Stadt", verband: "svfd", sr: 25, sra: 20 }] }],
  turnier: { grundpauschale: 32, grundstunden: 4, jeWeitereStunde: 8 },
  fahrtkosten: {
    svfd: { preisJeKarte: 3.6, kartenJeZone: 2 },
    sfv: { monatskartePauschale: 3.5, kmAuto: 0.35, kmZuschlagMitnahme: 0.04, kmFahrrad: 0.1 },
  },
  vereine: [{ name: "Test", lage: "dd" }],
  ausfallAnteil: 0.5,
});

test("ungueltige Datenbankwerte werden auf sichere Standardwerte normalisiert", () => {
  const ergebnis = normalisiereSpesenKonfiguration({
    altersklassen: [{ name: "Herren", ligen: [{ kurz: "Neu", voll: "Neu", verband: "falsch", sr: -2, sra: null }] }],
    turnier: { grundpauschale: "kaputt", grundstunden: 0 },
    fahrtkosten: {},
    ausfallAnteil: 1.5,
  }, fallback);
  assert.equal(ergebnis.altersklassen[0].ligen[0].verband, "svfd");
  assert.equal(ergebnis.altersklassen[0].ligen[0].sr, 25);
  assert.equal(ergebnis.turnier.grundpauschale, 32);
  assert.equal(ergebnis.turnier.grundstunden, 4);
  assert.equal(ergebnis.ausfallAnteil, 0.5);
});

test("der oeffentliche Rechner faellt bei Datenbankfehler auf den statischen Stand zurueck", async () => {
  const ergebnis = await ladeSpesenKonfiguration({
    datenbank: { adresse: "https://example.supabase.co", oeffentlicherSchluessel: "sb_publishable_test" },
    seitenschluessel: "test-verein",
    fallback,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(ergebnis.quelle, "statisch");
  assert.deepEqual(ergebnis.konfiguration, fallback);
});

test("ein veroeffentlichter Datenbankstand ersetzt den Fallback", async () => {
  const ergebnis = await ladeSpesenKonfiguration({
    datenbank: { adresse: "https://example.supabase.co", oeffentlicherSchluessel: "sb_publishable_test" },
    seitenschluessel: "test-verein",
    fallback,
    fetchImpl: async () => ({
      ok: true,
      json: async () => [{ konfiguration: { ...fallback, turnier: { ...fallback.turnier, grundpauschale: 40 } }, updated_at: "2026-08-25T10:00:00Z" }],
    }),
  });
  assert.equal(ergebnis.quelle, "datenbank");
  assert.equal(ergebnis.konfiguration.turnier.grundpauschale, 40);
});
