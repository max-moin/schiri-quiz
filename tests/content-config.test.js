import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { REGELN_STANDARD, UNTERLAGEN_STANDARD, VORLAGEN_STANDARD } from "../src/website/content-defaults.js";
import { ladeWebsiteInhalt, normalisiereWebsiteInhalt, validiereWebsiteInhalt } from "../src/website/content-config.js";

test("alle drei Redaktionsbereiche besitzen einen vollständigen statischen Fallback", () => {
  assert.ok(REGELN_STANDARD.svfdMeister.length > 10);
  assert.ok(REGELN_STANDARD.sfvMeister.length > 3);
  assert.ok(UNTERLAGEN_STANDARD.dokumente.length > 10);
  assert.match(VORLAGEN_STANDARD.spiel.text, /Spielkennung/);
});

test("Unterlagen akzeptieren nur Weblinks und bekannte Gruppen", () => {
  const ergebnis = normalisiereWebsiteInhalt("unterlagen", {
    ...UNTERLAGEN_STANDARD,
    dokumente: [{ id: "x", g: "vor", titel: "Unsicher", sub: "Test", href: "javascript:alert(1)", q: "falsch" }],
  }, UNTERLAGEN_STANDARD);
  assert.equal(ergebnis.dokumente.length, 0);
});

test("Vorlagen begrenzen die bearbeitbaren Felder auf Text und Entwurfsstatus", () => {
  const ergebnis = normalisiereWebsiteInhalt("vorlagen", {
    spiel: { ...VORLAGEN_STANDARD.spiel, titel: "Geändert", entwurf: 1 },
    lehrabend: VORLAGEN_STANDARD.lehrabend,
  }, VORLAGEN_STANDARD);
  assert.equal(ergebnis.spiel.titel, "Geändert");
  assert.equal(ergebnis.spiel.entwurf, true);
  assert.deepEqual(Object.keys(ergebnis.spiel).sort(), ["entwurf", "hinweis", "quelle", "text", "titel"]);
});

test("alle statischen Ausgangsstände erfüllen die Veröffentlichungsprüfung", () => {
  assert.deepEqual(validiereWebsiteInhalt("regeln", REGELN_STANDARD), []);
  assert.deepEqual(validiereWebsiteInhalt("vorlagen", VORLAGEN_STANDARD), []);
  assert.deepEqual(validiereWebsiteInhalt("unterlagen", UNTERLAGEN_STANDARD), []);
});

test("eine unvollständige neue Regelzeile kann nicht unbemerkt veröffentlicht werden", () => {
  const entwurf = structuredClone(REGELN_STANDARD);
  entwurf.sfvPokal.push({ a: "Test", k: "Testklasse", zeit: "2 × 45 Minuten" });
  const fehler = validiereWebsiteInhalt("regeln", entwurf);
  assert.ok(fehler.some((meldung) => meldung.includes("Spielfeld".toLowerCase()) || meldung.includes("„feld“ fehlt")));
  assert.ok(fehler.length > 5);
});

test("Unterlagen melden unsichere Links vor dem Veröffentlichen verständlich", () => {
  const entwurf = structuredClone(UNTERLAGEN_STANDARD);
  entwurf.dokumente[0].href = "javascript:alert(1)";
  assert.ok(validiereWebsiteInhalt("unterlagen", entwurf).some((meldung) => meldung.includes("https://")));
});

test("öffentliche Inhaltsseiten fallen bei Datenbankfehler auf den Code zurück", async () => {
  const ergebnis = await ladeWebsiteInhalt({
    datenbank: { adresse: "https://example.supabase.co", oeffentlicherSchluessel: "sb_publishable_test" },
    seitenschluessel: "test-verein", bereich: "vorlagen", fallback: VORLAGEN_STANDARD,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(ergebnis.quelle, "statisch");
  assert.deepEqual(ergebnis.konfiguration, VORLAGEN_STANDARD);
});

test("Regeln, Vorlagen und Unterlagen laden dieselbe gesicherte Redaktionsquelle", () => {
  for (const datei of ["regeluebersicht.html", "vorlagen.html", "informationen.html"]) {
    const html = readFileSync(new URL(`../${datei}`, import.meta.url), "utf8");
    assert.match(html, /ladeWebsiteInhalt/);
    assert.match(html, /type="module"/);
  }
  const html = readFileSync(new URL("../informationen.html", import.meta.url), "utf8");
  assert.match(html, /dokument\.aktiv !== false/);
});
