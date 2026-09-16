import assert from "node:assert/strict";
import test from "node:test";

import { baueStatischeErklaerung } from "../api/erklaerung.js";
import {
  baueErstversuchPrompt,
  extrahiereBewertungskriterien,
  leiteKriterienBewertungAb,
} from "../api/freitext-bewerten.js";
import {
  GEMINI_STANDARD_MODELL,
  GeminiAntwortFehler,
  geminiAufrufen,
  istGeminiKontingentErschoepft,
  minimaleGeminiThinkingConfig,
  stelleGeminiErfolgSicher,
} from "../server/api-helpers.js";

test("knappe richtige Entscheidung wird im Prompt ausdrücklich als vollständig akzeptiert", () => {
  const prompt = baueErstversuchPrompt(
    {
      frage_text: "Ein Spieler zieht beim Torjubel sein Trikot aus. Wie reagierst du?",
      musterantwort: "Gelbe Karte wegen unsportlichen Verhaltens.",
      bewertungshinweise: null,
    },
    "Der Spieler bekommt die Gelbe Karte.",
    true
  );

  assert.match(prompt, /ist "Der Spieler bekommt die Gelbe Karte" vollständig RICHTIG/);
  assert.match(prompt, /Kürze allein ist NIEMALS ein Grund/);
  assert.match(prompt, /Eine Begründung ist nur zwingend, wenn die Frage ausdrücklich danach fragt/);
});

test("fragenspezifische Rubrik steuert Grün, Orange, Rot und die Rückfrage", () => {
  const prompt = baueErstversuchPrompt(
    {
      frage_text: "Ein Spieler zieht beim Torjubel sein Trikot aus. Wie reagierst du?",
      musterantwort: "Gelbe Karte wegen unsportlichen Verhaltens.",
      bewertungshinweise: `Zwingende Kernaussagen:
Gelbe Karte / Verwarnung

Anerkannte Formulierungen:
gelb; verwarnen

Orange, wenn:
Nur "eine Karte" genannt wird.

Rot, wenn:
Keine Karte oder Rote Karte.

Adaptive Rückfragen:
Bei unbestimmter Karte: Welche Karte beziehungsweise persönliche Strafe ist erforderlich?`,
    },
    "Es gibt eine Karte.",
    true
  );

  assert.match(prompt, /Nutze diese Abschnitte als fragenspezifische Rubrik/);
  assert.match(prompt, /ein passender "Orange, wenn"-Fall ist "nachbessern"/);
  assert.match(prompt, /Nur "eine Karte" genannt wird/);
  assert.match(prompt, /Welche Karte beziehungsweise persönliche Strafe ist erforderlich/);
});

test("strukturierte Kriterien lassen einen Widerspruch nicht als Orange durch", () => {
  const hinweise = `[[KI-KRITERIEN-JSON]]
[{"id":"karte","bezeichnung":"Persönliche Strafe","erwartung":"Verwarnung / Gelbe Karte","akzeptierte_formulierungen":"gelb; Verwarnung","bei_fehlen":"nachfragen","bei_widerspruch":"falsch","rueckfrage":"Welche persönliche Strafe ist erforderlich?"},{"id":"fortsetzung","bezeichnung":"Spielfortsetzung","erwartung":"Direkter Freistoß","akzeptierte_formulierungen":"DFK","bei_fehlen":"nachfragen","bei_widerspruch":"falsch","rueckfrage":"Wie wird fortgesetzt?"},{"id":"begruendung","bezeichnung":"Begründung","erwartung":"Unerlaubtes Wiedereintreten mit Eingriff","akzeptierte_formulierungen":"","bei_fehlen":"nachfragen","bei_widerspruch":"falsch","rueckfrage":"Wodurch ist die Entscheidung begründet?"}]
[[/KI-KRITERIEN-JSON]]`;

  assert.equal(extrahiereBewertungskriterien(hinweise).length, 3);
  const falsch = leiteKriterienBewertungAb({
    kriterien: [
      { id: "karte", status: "widersprochen" },
      { id: "fortsetzung", status: "erfuellt" },
      { id: "begruendung", status: "fehlt" },
    ],
    feedback: "Die Karte ist nicht richtig.",
  }, hinweise, true);
  assert.equal(falsch.status, "falsch");
  assert.equal(falsch.nachfrage, null);

  const nachbessern = leiteKriterienBewertungAb({
    kriterien: [
      { id: "karte", status: "erfuellt" },
      { id: "fortsetzung", status: "fehlt" },
      { id: "begruendung", status: "fehlt" },
    ],
    feedback: "Es fehlen zwei Punkte.",
  }, hinweise, true);
  assert.equal(nachbessern.status, "nachbessern");
  assert.match(nachbessern.nachfrage, /Wie wird fortgesetzt/);
  assert.match(nachbessern.nachfrage, /Wodurch ist die Entscheidung begründet/);

  const nachZweiterAntwort = leiteKriterienBewertungAb({
    kriterien: [
      { id: "karte", status: "erfuellt" },
      { id: "fortsetzung", status: "fehlt" },
      { id: "begruendung", status: "fehlt" },
    ],
    feedback: "Es fehlen zwei Punkte.",
  }, hinweise, false);
  assert.equal(nachZweiterAntwort.status, "falsch");
});

test("der Grundprompt prüft ausdrückliche falsche Karten vor fehlenden Punkten", () => {
  const prompt = baueErstversuchPrompt(
    { frage_text: "Wie entscheidest du?", musterantwort: "Verwarnung und direkter Freistoß.", bewertungshinweise: null },
    "Rote Karte, direkter Freistoß.",
    true
  );
  assert.match(prompt, /Prüfe WIDERSPRÜCHE vor LÜCKEN/);
  assert.match(prompt, /Rote Karte/);
});

test("Flash-Lite ist das Standardmodell und nutzt kein Thinking-Budget", async () => {
  assert.equal(GEMINI_STANDARD_MODELL, "gemini-3.5-flash-lite");
  assert.deepEqual(minimaleGeminiThinkingConfig(GEMINI_STANDARD_MODELL), {
    thinkingLevel: "minimal",
  });

  const vorherigerFetch = globalThis.fetch;
  let aufgerufeneUrl = "";
  globalThis.fetch = async (url) => {
    aufgerufeneUrl = String(url);
    return new Response("{}", { status: 200 });
  };

  try {
    await geminiAufrufen("test-key", { contents: [] });
    assert.match(aufgerufeneUrl, /models\/gemini-3\.5-flash-lite:generateContent/);
  } finally {
    globalThis.fetch = vorherigerFetch;
  }
});

test("Gemini-429 wird als erschöpftes Kontingent erkannt", async () => {
  await assert.rejects(
    stelleGeminiErfolgSicher(new Response("quota", { status: 429 })),
    (fehler) =>
      fehler instanceof GeminiAntwortFehler &&
      istGeminiKontingentErschoepft(fehler) &&
      fehler.httpStatus === 429
  );
});

test("statische Erklärung hält Warum bei erschöpfter KI nutzbar", () => {
  assert.equal(
    baueStatischeErklaerung({
      typ: "multiple_choice",
      richtige_option: "b",
      option_b: "Der Spieler wird verwarnt",
      korrekt: true,
      erklaerung_zusatzhinweis: "Das Trikotausziehen gilt als unsportliches Verhalten",
    }),
    "Richtig ist B: Der Spieler wird verwarnt. Damit hast du die richtige Regelentscheidung gewählt. Das Trikotausziehen gilt als unsportliches Verhalten."
  );
});
