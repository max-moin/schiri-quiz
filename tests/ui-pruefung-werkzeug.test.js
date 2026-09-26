// ============================================================
//  UI-Pruefwerkzeug + Befunde der ersten Laeufe (26.09.2026)
// ============================================================
//  werkzeuge/ui-pruefung darf die echte Datenbank nie erreichen, und die
//  zwei Befunde des ersten Laufs sollen nicht zurueckkommen.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

test("das Pruefwerkzeug faengt Supabase ab und sperrt alles Fremde", () => {
  const py = lies("werkzeuge/ui-pruefung/pruefen.py");
  assert.match(py, /"\/rest\/v1\/rpc\/" in u/);
  assert.match(py, /return await route\.abort\(\)/);
  assert.match(py, /Object\.defineProperty\(window, "supabase"/);
  assert.match(lies("werkzeuge/ui-pruefung/.gitignore"), /^ergebnis\/$/m);
});

test("gesperrte Seiten behalten ihren Inhalt versteckt (kein TypeError)", () => {
  const js = lies("seite.js");
  assert.match(js, /versteckt\.hidden = true/);
  assert.match(js, /inhalt\.append\(kicker, titel, text, zurueck, versteckt\)/);
});

test("Freitextfelder haben einen Namen, nicht nur einen Platzhalter", () => {
  const js = lies("src/features/freetext-answers.js");
  assert.match(js, /setAttribute\("aria-label", "Deine Antwort"\)/);
  assert.match(js, /setAttribute\("aria-label", "Deine Ergänzung"\)/);
});
