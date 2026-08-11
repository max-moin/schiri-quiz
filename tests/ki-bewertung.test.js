import assert from "node:assert/strict";
import test from "node:test";

import { baueStatischeErklaerung } from "../api/erklaerung.js";
import { baueErstversuchPrompt } from "../api/freitext-bewerten.js";
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

test("Flash-Lite ist das Standardmodell und nutzt kein Thinking-Budget", async () => {
  assert.equal(GEMINI_STANDARD_MODELL, "gemini-2.5-flash-lite");
  assert.deepEqual(minimaleGeminiThinkingConfig(GEMINI_STANDARD_MODELL), {
    thinkingBudget: 0,
  });

  const vorherigerFetch = globalThis.fetch;
  let aufgerufeneUrl = "";
  globalThis.fetch = async (url) => {
    aufgerufeneUrl = String(url);
    return new Response("{}", { status: 200 });
  };

  try {
    await geminiAufrufen("test-key", { contents: [] });
    assert.match(aufgerufeneUrl, /models\/gemini-2\.5-flash-lite:generateContent/);
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
