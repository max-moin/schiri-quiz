import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nachrichtFuer } from "../server/schiri-push.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const sql = lies("supabase/migrations/20260926014903_schiri_push_quiz_und_ifab.sql");
const seite = lies("mitteilungen.html");
const steuerung = lies("src/website/mitteilungen-steuerung.js");
const cron = lies("supabase/functions/obmann-benachrichtigungen/index.ts");
const dispatcher = lies("api/push-auftraege.js");
const runde = "11111111-1111-1111-1111-111111111111";

test("Quiz-Push bleibt getrennt, freiwillig und auf offene Runden begrenzt", () => {
  assert.match(sql, /p_quiz_neu boolean, p_quiz_erinnerung boolean/);
  assert.match(sql, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/);
  assert.match(sql, /not coalesce\(s\.ist_test, false\)/);
  assert.match(sql, /public\.schiri_push_quiz_offen/);
  assert.match(sql, /not exists \(select 1 from public\.antworten/);
  assert.match(sql, /p\.quiz_neu/);
  assert.match(sql, /p\.quiz_erinnerung/);
  assert.match(sql, /on conflict \(schluessel\) do nothing/);
  assert.match(sql, /for update of a skip locked/);
  assert.match(sql, /grant execute on function public\.schiri_push_quiz_einreihen\(\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.schiri_push_quiz_einreihen\(\) to (anon|authenticated)/);
});

test("Montag, Freitag und Sonntag sind explizit Europe/Berlin und nicht nachholend", () => {
  assert.match(sql, /now\(\) at time zone 'Europe\/Berlin'/);
  assert.match(sql, /v_tag = 1 and v_minute between 600 and 609/);
  assert.match(sql, /v_tag = 5 and v_minute between 900 and 909/);
  assert.match(sql, /v_tag = 7 and v_minute between 630 and 639/);
  assert.match(sql, /return 0;/);
  assert.match(cron, /SCHIRI_PUSH_CRON_AKTIV/);
  assert.match(cron, /schiri_push_quiz_einreihen/);
  assert.match(dispatcher, /schiri_push_quiz_auftraege_beanspruchen/);
  assert.match(dispatcher, /schiri_push_quiz_zustellliste/);
});

test("Einstellungen und Push-Inhalt sind sparsam und enthalten keine Quiz-Loesung", () => {
  assert.match(seite, /id="mitteilungen-quiz-neu"/);
  assert.match(seite, /id="mitteilungen-quiz-erinnerung"/);
  assert.match(steuerung, /schiri_push_quiz_setzen/);
  for (const typ of ["quiz.neu", "quiz.erinnerung"]) {
    const nachricht = JSON.parse(nachrichtFuer(typ, runde, `quiz_${runde}`));
    assert.equal(nachricht.ziel, "/modus.html");
    assert.doesNotMatch(JSON.stringify(nachricht), /Antwort|richtig|Max|Schiedsrichter/);
  }
  assert.equal(nachrichtFuer("quiz.neu", "../falsch"), null);
});

test("IFAB ist nur eine Quellenauswahl, keine automatisch uebernommene Frage", () => {
  assert.match(sql, /'ifab'/);
  assert.doesNotMatch(sql, /insert into public\.fragen/);
});
