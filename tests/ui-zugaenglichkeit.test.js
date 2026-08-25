import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const videoPlayer = readFileSync(new URL("../src/video-player.js", import.meta.url), "utf8");

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
  assert.doesNotMatch(videoPlayer, /video-klickfaenger/);
  assert.doesNotMatch(css, /\.video-klickfaenger/);
  assert.match(videoPlayer, /controls:\s*0/);
  assert.match(videoPlayer, /playerVars\.origin\s*=\s*window\.location\.origin/);
  assert.match(videoPlayer, /onAutoplayBlocked:/);
  assert.match(videoPlayer, /onError:/);
  assert.doesNotMatch(videoPlayer, /unloadModule\("captions"\)/);
  assert.doesNotMatch(videoPlayer, /modestbranding/);
});

test("Video-Fragen starten modal und bieten Reset, Endkarte und Info-Fallback", () => {
  assert.match(videoPlayer, /function baueVideoEinbettungModal/);
  assert.match(videoPlayer, /oeffneVideoGrossansicht\(dialogInhalt, ausloeser, controller\)/);
  assert.match(videoPlayer, /Video neu starten/);
  assert.match(videoPlayer, /Ausschnitt beendet/);
  assert.match(videoPlayer, /ⓘ Hilfe zum Video/);
  assert.match(app, /frage\.antwort_hinweis/);
  assert.match(videoPlayer, /synchronisiereZustand\(YT\)/);
  assert.match(videoPlayer, /window\.setInterval/);
  assert.match(css, /\.video-info-panel/);
  assert.match(css, /\.video-dialog-karte/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 52px/);
});

test("app.js bindet die ausgelagerten Browsermodule ein", () => {
  assert.match(app, /SchiriQuizSessionStore/);
  assert.match(app, /SchiriQuizVideoPlayer/);
  assert.doesNotMatch(app, /function baueVideoEinbettungModal/);
  assert.doesNotMatch(app, /sessionStorage/);
});
