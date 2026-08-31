import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
const videoPlayer = readFileSync(new URL("../src/features/video-player.js", import.meta.url), "utf8");
const vorlesen = readFileSync(new URL("../src/ui/text-to-speech.js", import.meta.url), "utf8");
const maskierteEingabe = readFileSync(new URL("../src/ui/masked-input.js", import.meta.url), "utf8");
const erklaerungsDialog = readFileSync(new URL("../src/ui/explanation-dialog.js", import.meta.url), "utf8");
const kopfmenue = readFileSync(new URL("../src/ui/header-menu.js", import.meta.url), "utf8");
const fragenElemente = readFileSync(new URL("../src/ui/question-elements.js", import.meta.url), "utf8");
const gastmodus = readFileSync(new URL("../src/features/guest-mode.js", import.meta.url), "utf8");
const wochenQuiz = readFileSync(new URL("../src/features/weekly-quiz.js", import.meta.url), "utf8");
const freitext = readFileSync(new URL("../src/features/freetext-answers.js", import.meta.url), "utf8");

test("der Vorlese-Button nennt Screenreadern seinen aktuellen Zustand", () => {
  assert.match(vorlesen, /setAttribute\("aria-label", "Frage vorlesen"\)/);
  assert.match(vorlesen, /setAttribute\("aria-label", "Vorlesen stoppen"\)/);
});

test("das Paragraphzeichen im Regel-Badge ist rein dekorativ", () => {
  assert.match(fragenElemente, /regelSymbol\.setAttribute\("aria-hidden", "true"\)/);
  assert.doesNotMatch(css, /\.badge\.regel::before/);
});

test("ein leerer Gastmodus erklärt den Zustand statt einen Abschluss vorzutäuschen", () => {
  assert.match(gastmodus, /Für den Gast-Modus sind momentan noch keine Fragen freigeschaltet/);
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
  assert.match(wochenQuiz + freitext, /frage\.antwort_hinweis/);
  assert.match(videoPlayer, /synchronisiereZustand\(YT\)/);
  assert.match(videoPlayer, /window\.setInterval/);
  assert.match(css, /\.video-info-panel/);
  assert.match(css, /\.video-dialog-karte/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 52px/);
});

test("app.js bindet die ausgelagerten Browsermodule ein", () => {
  assert.match(app, /SchiriQuizSessionStore/);
  assert.match(app, /SchiriQuizVideoPlayer/);
  assert.match(app, /SchiriQuizMaskedInputs/);
  assert.match(app, /SchiriQuizTextToSpeech/);
  assert.match(app, /SchiriQuizExplanationDialog/);
  assert.match(app, /SchiriQuizHeaderMenu/);
  assert.match(app, /SchiriQuizQuestionElements/);
  assert.match(app, /SchiriQuizGuestMode/);
  assert.match(app, /SchiriQuizProfileRequests/);
  assert.match(app, /SchiriQuizFreetextAnswers/);
  assert.match(app, /SchiriQuizDecisionAnswers/);
  assert.match(app, /SchiriQuizHistoryMode/);
  assert.match(app, /SchiriQuizWeeklyQuiz/);
  assert.match(app, /SchiriQuizAccess/);
  assert.doesNotMatch(app, /function baueVideoEinbettungModal/);
  assert.doesNotMatch(app, /sessionStorage/);
  assert.doesNotMatch(app, /SpeechSynthesisUtterance/);
  assert.doesNotMatch(app, /function initialisiereKopfmenue/);
  assert.doesNotMatch(app, /function starteGastModus/);
});

test("UI-Module behalten Sicherheits- und Bedienungsfallbacks", () => {
  assert.match(maskierteEingabe, /CSS\.supports/);
  assert.match(maskierteEingabe, /feld\.type = "password"/);
  assert.match(maskierteEingabe, /aria-pressed/);
  assert.match(erklaerungsDialog, /\/api\/erklaerung/);
  assert.match(erklaerungsDialog, /cacheSchluessel/);
  assert.match(kopfmenue, /knopf\.focus\(\)/);
  assert.match(gastmodus, /gast_fragen_liste/);
  assert.match(gastmodus, /gast_antwort_pruefen/);
  assert.match(gastmodus, /gast_interesse_melden/);
});
