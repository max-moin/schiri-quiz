// ============================================================
//  Antwort des Obmanns auf Quiz-Feedback (25.09.2026)
// ============================================================
//  Geprueft werden die Zusagen, an denen die Funktion haengt und die man
//  beim Weiterbauen leicht kippt:
//  - der Zeitstempel kommt aus EINEM Trigger, nicht aus einer RPC,
//  - eine geaenderte Antwort ist wieder "neu",
//  - die eigene Sicht und der Zaehler pruefen die PIN,
//  - das Lesedatum selbst verlaesst die Datenbank nur in der Obmann-Sicht,
//  - die Website zeigt "Neue Antwort" als Wort und quittiert erst NACH
//    dem Anzeigen.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const ohneKommentare = (sql) => sql.replace(/--[^\n]*/g, "");
const sql = ohneKommentare(lies("supabase/migrations/20260925160000_feedback_antwort_datiert_und_gelesen.sql"));
const seite = lies("src/website/meine-anliegen-seite.js");
const punkt = lies("src/features/profile-requests.js");
const css = lies("stil/meine-anliegen.css");

function rumpf(name) {
  const anfang = sql.indexOf(`function public.${name}(`);
  assert.ok(anfang >= 0, `${name} fehlt`);
  const start = sql.indexOf("$function$", anfang);
  const ende = sql.indexOf("$function$", start + 10);
  return sql.slice(anfang, ende);
}

test("Zeitstempel und Lesestand setzt ein einziger Trigger", () => {
  const t = rumpf("feedback_antwort_stempeln");
  assert.match(t, /new\.rueckmeldung_obmann is not distinct from old\.rueckmeldung_obmann/);
  assert.match(t, /new\.rueckmeldung_am := now\(\)/);
  assert.match(t, /new\.rueckmeldung_gelesen_am := null/, "geaenderte Antwort muss wieder neu sein");
  assert.match(sql, /before update of rueckmeldung_obmann on public\.frage_meldung_eintraege/);
  // Der Trigger muss VOR feedback_status_kompatibel feuern (alphabetisch).
  assert.ok("feedback_antwort_stempeln" < "feedback_status_kompatibel");
});

test("eine Antwort verlaengert die Aufbewahrung, statt sie zu verkuerzen", () => {
  const t = rumpf("feedback_antwort_stempeln");
  assert.match(t, /greatest\(/);
  assert.match(t, /\+ 14\)/);
});

test("eigene Sicht, Zaehler und Quittung pruefen die PIN und bleiben bei der Person", () => {
  for (const name of ["meine_frage_meldungen", "meine_neuen_antworten", "meine_antworten_gelesen"]) {
    const r = rumpf(name);
    assert.match(r, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/, name);
    assert.match(r, /fm\.schiedsrichter_id = p_schiedsrichter_id/, name);
    assert.match(r, /security definer/, name);
    assert.match(r, /set search_path to ''/, name);
  }
  assert.doesNotMatch(rumpf("meine_frage_meldungen"), /rueckmeldung_gelesen_am'/,
    "das Lesedatum geht nicht an die Person hinaus, nur 'neu'");
  assert.match(rumpf("meine_frage_meldungen"), /'rueckmeldung_neu'/);
  assert.match(rumpf("obmann_frage_meldungen"), /'rueckmeldung_gelesen_am'/);
  assert.match(rumpf("obmann_frage_meldungen"), /public\.obmann_verein\(p_passwort\)/);
});

test("Rechte: erst wegnehmen, dann gezielt geben, nie an public", () => {
  for (const sig of ["meine_neuen_antworten(uuid,text)", "meine_antworten_gelesen(uuid,text)"]) {
    const name = sig.replace(/[()]/g, "\\$&");
    assert.match(sql, new RegExp(`revoke all on function public\\.${name} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name} to anon, authenticated`));
  }
  assert.doesNotMatch(sql, /grant execute[^;]*to public\b/i);
  assert.match(sql, /revoke all on function public\.feedback_antwort_stempeln\(\) from public, anon, authenticated/);
});

test("Meine Anliegen zeigt Datum und 'Neue Antwort' als Wort und quittiert danach", () => {
  assert.match(seite, /zeit: e\.rueckmeldung_am/);
  assert.match(seite, /neuMarke\("Neue Antwort"\)/);
  assert.match(seite, /details\.open = true/);
  const zeichnen = seite.indexOf("zeichneVorgaenge();", seite.indexOf("async function ladeVorgaenge"));
  const quittung = seite.indexOf('"meine_antworten_gelesen"');
  assert.ok(zeichnen > 0 && quittung > zeichnen, "erst anzeigen, dann als gelesen markieren");
  assert.match(css, /\.meine-neue-antwort \{/);
});

test("der blaue Kontopunkt beruecksichtigt ungelesene Antworten", () => {
  assert.match(punkt, /"meine_neuen_antworten"/);
  assert.match(punkt, /anfragenNeu \|\| antwortenNeu/);
});
