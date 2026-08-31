import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import handler, { normalisiereOrt, vergleicheOrtLokal } from "../api/entscheidung-bewerten.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const migration = lies("supabase/migrations/20260831120000_v100_wochenquiz_icon_antworten.sql");

function funktionsRumpf(sql, name) {
  const start = sql.indexOf(`function public.${name}(`);
  assert.ok(start >= 0, `${name} fehlt`);
  const ende = sql.indexOf("$function$;", start);
  assert.ok(ende > start, `${name} ist unvollständig`);
  return sql.slice(start, ende);
}

test("gängige Ortsformulierungen werden ohne KI robust normalisiert", () => {
  assert.equal(normalisiereOrt("  Strafstoßmarke! "), "strafstossmarke");
  assert.equal(vergleicheOrtLokal("dort, wo das Foul passiert ist", "Ort des Vergehens"), true);
  assert.equal(vergleicheOrtLokal("am Elfmeterpunkt", "Strafstoßmarke"), true);
  assert.equal(vergleicheOrtLokal("wo der Ball zuletzt gespielt wurde", "Ort des Vergehens"), false);
  assert.equal(vergleicheOrtLokal("auf Höhe des zweiten Pfostens", "Ort des Vergehens"), null);
});

test("die richtige Icon-Lösung gelangt vor dem Antworten nicht in den Fragen-Feed", () => {
  const rumpf = funktionsRumpf(migration, "wochen_fragen");
  assert.match(rumpf, /entscheidung_darstellung jsonb/);
  assert.match(rumpf, /'trikot_heim'/);
  assert.match(rumpf, /'trikot_gast'/);
  assert.doesNotMatch(rumpf, /'fortsetzung_ort'/);
  assert.doesNotMatch(rumpf, /'spielfortsetzung'/);
  assert.doesNotMatch(rumpf, /'persoenliche_strafe'/);
});

test("Kontext und Speichern der Icon-Antwort sind nur serverseitig ausführbar", () => {
  for (const signatur of [
    "entscheidung_kontext_laden\\(uuid, uuid, text\\)",
    "entscheidung_antwort_speichern\\(uuid, uuid, text, jsonb, boolean, text\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signatur} from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signatur} to service_role`));
  }
});

test("das Wochenquiz lädt die Icon-Antwort als eigenen Antwortweg", () => {
  const html = lies("quiz.html");
  const app = lies("app.js");
  const quiz = lies("src/features/weekly-quiz.js");
  const modul = lies("src/features/decision-answers.js");
  assert.match(html, /src\/features\/decision-answers\.js/);
  assert.match(html, /stil\/wochen-entscheidung\.css/);
  assert.match(app, /SchiriQuizDecisionAnswers/);
  assert.match(quiz, /frage\.antworttyp === "entscheidung"/);
  assert.match(modul, /\/api\/entscheidung-bewerten/);
  assert.match(modul, /Anderer Ort oder eigene Formulierung/);
});

test("die Icon-Bewertungs-API akzeptiert nur POST", async () => {
  const res = {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: "GET" }, res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, { fehler: "Nur POST erlaubt" });
  assert.equal(res.headers["cache-control"], "no-store");
});
