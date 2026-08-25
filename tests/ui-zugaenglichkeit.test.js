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

test("Video-Fragen bedienen YouTube ohne Klickfänger vor dem Player", () => {
  assert.doesNotMatch(app, /video-klickfaenger/);
  assert.doesNotMatch(css, /\.video-klickfaenger/);
  assert.match(app, /controls:\s*0/);
  assert.match(app, /playerVars\.origin\s*=\s*window\.location\.origin/);
  assert.match(app, /onAutoplayBlocked:/);
  assert.match(app, /onError:/);
  assert.doesNotMatch(app, /unloadModule\("captions"\)/);
  assert.doesNotMatch(app, /modestbranding/);
});

test("Video-Fragen starten modal und bieten Reset, Endkarte und Info-Fallback", () => {
  assert.match(app, /function baueVideoEinbettungModal/);
  assert.match(app, /oeffneVideoGrossansicht\(dialogInhalt, ausloeser, controller\)/);
  assert.match(app, /↻ Neu starten/);
  assert.match(app, /Ausschnitt beendet/);
  assert.match(app, /ⓘ Ausschnitt & Situation/);
  assert.match(app, /frage\.antwort_hinweis/);
  assert.match(app, /synchronisiereZustand\(YT\)/);
  assert.match(app, /window\.setInterval/);
  assert.match(css, /\.video-info-panel/);
  assert.match(css, /\.video-dialog-karte/);
});
