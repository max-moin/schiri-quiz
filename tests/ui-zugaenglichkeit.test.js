import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

test("der Vorlese-Button nennt Screenreadern seinen aktuellen Zustand", () => {
  assert.match(app, /setAttribute\("aria-label", "Frage vorlesen"\)/);
  assert.match(app, /setAttribute\("aria-label", "Vorlesen stoppen"\)/);
});

test("das Paragraphzeichen im Regel-Badge ist rein dekorativ", () => {
  assert.match(app, /regelSymbol\.setAttribute\("aria-hidden", "true"\)/);
  assert.doesNotMatch(css, /\.badge\.regel::before/);
});

test("ein leerer Gastmodus erklärt den Zustand statt einen Abschluss vorzutäuschen", () => {
  assert.match(app, /Für den Gast-Modus sind momentan noch keine Fragen freigeschaltet/);
});
