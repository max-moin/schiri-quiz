import assert from "node:assert/strict";
import test from "node:test";

await import("../src/core/quiz-utils.js");

const {
  extrahiereYoutubeId,
  freitextStatus,
  schwierigkeitSterne,
} = globalThis.SchiriQuizUtils;

test("YouTube-IDs werden aus den unterstützten Linkformaten gelesen", () => {
  assert.equal(extrahiereYoutubeId("https://youtu.be/abc123?t=10"), "abc123");
  assert.equal(extrahiereYoutubeId("https://www.youtube.com/watch?v=xyz789"), "xyz789");
  assert.equal(extrahiereYoutubeId("https://www.youtube.com/embed/embed42"), "embed42");
  assert.equal(extrahiereYoutubeId("keine-url"), null);
});

test("Freitextstatus bleibt mit alten und neuen Datenformaten kompatibel", () => {
  assert.equal(freitextStatus({ status: "nachbessern" }), "nachbessern");
  assert.equal(freitextStatus({ bewertungsstatus: "richtig" }), "richtig");
  assert.equal(freitextStatus({ nachbesserung_offen: true }), "nachbessern");
  assert.equal(freitextStatus({ korrekt: true }), "richtig");
  assert.equal(freitextStatus({ teilweise: true }), "nachbessern");
  assert.equal(freitextStatus(null), "falsch");
});

test("Schwierigkeit wird wie bisher als fünf Sterne dargestellt", () => {
  assert.equal(schwierigkeitSterne(3), "★★★☆☆");
  assert.equal(schwierigkeitSterne(null), null);
});
