// ============================================================
//  Termine: Ablauf und Fristen (25.09.2026)
// ============================================================
//  Eine einzige Definition von "vorbei" und zwei durchgesetzte Fristen.
//  Die Tests pruefen die Zusagen, die beim Weiterbauen leicht kippen:
//  - alle Listen rechnen "vergangen" ueber termin_ende_zeitpunkt,
//  - die Sichtbarkeitsfilter der oeffentlichen Funktionen bleiben,
//  - Absagen geht nach der Frist weiter, Zusagen nicht,
//  - nach "antwort_bis" gibt es keine Stimmen und keine Knoepfe,
//  - fachliche Server-Saetze kommen auf der Website an, technische nicht.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findungKarte, terminKarte, serverMeldung } from "../src/website/termine.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const sql = lies("supabase/migrations/20260925170000_termin_ablauf_und_fristen.sql").replace(/--[^\n]*/g, "");
const seite = lies("src/website/termine-seite.js");

function rumpf(name) {
  const anfang = sql.indexOf(`function public.${name}(`);
  assert.ok(anfang >= 0, `${name} fehlt`);
  const start = sql.indexOf("$function$", anfang);
  const ende = sql.indexOf("$function$", start + 10);
  return sql.slice(anfang, ende);
}

test("ohne Endzeit endet ein Termin am Ende seines Tages, nicht um Mitternacht davor", () => {
  const r = rumpf("termin_ende_zeitpunkt");
  assert.match(r, /\(\(p_datum \+ 1\)::timestamp\) at time zone 'Europe\/Berlin'/);
  assert.match(r, /\(\(p_datum \+ 1\) \+ p_ende\)/, "Endzeit vor Beginn = naechster Tag");
});

test("alle Terminlisten rechnen 'vorbei' ueber dieselbe Funktion", () => {
  for (const name of ["oeffentliche_termine", "oeffentliche_termine_alle", "termine_fuer_schiri_v2", "obmann_termine_mit_stand"]) {
    assert.match(rumpf(name), /public\.termin_ende_zeitpunkt\(t\.datum, t\.beginn_zeit, t\.ende_zeit\)/, name);
  }
  assert.doesNotMatch(rumpf("oeffentliche_termine_alle"), /t\.datum < \(now\(\)/);
});

test("die oeffentlichen Funktionen behalten ihre Sichtbarkeitsfilter und Grenzen", () => {
  for (const name of ["oeffentliche_termine", "oeffentliche_termine_alle"]) {
    const r = rumpf(name);
    assert.match(r, /security definer/);
    assert.match(r, /where v\.oeffentliche_kennung = p_seitenschluessel/);
    assert.match(r, /and t\.sichtbarkeit = 'oeffentlich'/);
    assert.doesNotMatch(r, /select\s+t\.\*/);
  }
  assert.match(rumpf("oeffentliche_termine"), /limit 4\b/);
  assert.match(rumpf("oeffentliche_termine_alle"), /limit 120\b/);
  const v2 = rumpf("termine_fuer_schiri_v2");
  assert.match(v2, /t\.sichtbarkeit in \('nur_verein', 'oeffentlich'\)/);
  assert.doesNotMatch(v2, /'nur_app'/);
});

test("Schreibwege pruefen die PIN und setzen die Fristen durch", () => {
  const r = rumpf("termin_rueckmeldung_setzen");
  assert.match(r, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/);
  assert.match(r, /now\(\) >= public\.termin_rueckmeldeschluss\(v_datum, v_beginn\)/);
  assert.match(r, /p_status = 'zu'\s+and v_bis is not null/);
  assert.match(r, /v_bisher is distinct from 'zu'/, "bestehende Zusage darf bestaetigt werden");
  assert.doesNotMatch(r, /p_status = 'ab'\s+and v_bis/, "Absage bleibt nach der Frist moeglich");

  const s = rumpf("terminfindung_stimme_setzen");
  assert.match(s, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/);
  assert.match(s, /v_bis < \(now\(\) at time zone 'Europe\/Berlin'\)::date/);
});

test("neu angelegte Funktionen bekommen dieselben Rechte wie vorher, nie public", () => {
  for (const sig of [
    "termine_fuer_schiri_v2\\(uuid, text, text\\)",
    "obmann_termine_mit_stand\\(text\\)",
    "terminfindungen_fuer_schiri\\(uuid, text\\)",
    "obmann_terminfindungen\\(text\\)",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${sig} from public`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${sig} to anon, authenticated`));
  }
  assert.doesNotMatch(sql, /grant execute[^;]*to public\b/i);
  assert.match(sql, /revoke all on function public\.termin_ende_zeitpunkt\(date, time, time\) from public, anon, authenticated/);
});

test("eine geschlossene Abstimmung zeigt keine Knoepfe, sondern einen Satz", () => {
  const basis = { id: "f1", titel: "Treff", status: "offen", antwort_bis: "2026-09-20",
    vorschlaege: [{ id: "v1", datum: "2026-10-01", ja: 1, vielleicht: 0, nein: 0 }] };
  const offen = findungKarte({ ...basis, frist_abgelaufen: false });
  const zu = findungKarte({ ...basis, frist_abgelaufen: true });
  assert.match(offen, /data-antwort="ja"/);
  assert.doesNotMatch(zu, /data-antwort=/);
  assert.match(zu, /Abstimmung geschlossen/);
});

test("die Terminkarte fordert nur zur Antwort auf, wenn eine Antwort moeglich ist", () => {
  const basis = { id: "t1", titel: "Treff", datum: "2026-10-01", rueckmeldung_erforderlich: true, mein_status: null, vergangen: false };
  assert.match(terminKarte(basis), /Noch keine Rückmeldung/);
  assert.doesNotMatch(terminKarte({ ...basis, absage_moeglich: false }), /Noch keine Rückmeldung/);
  assert.match(terminKarte({ ...basis, absage_moeglich: true, zusage_moeglich: false }), /Rückmeldefrist abgelaufen/);
  assert.match(terminKarte({ ...basis, laeuft: true }), /Läuft gerade/);
});

test("fachliche Server-Saetze kommen an, technische Fehler bleiben neutral", async () => {
  const antwort = (status, koerper) => ({ status, text: async () => koerper });
  assert.equal(
    await serverMeldung(antwort(400, JSON.stringify({ code: "P0001", message: "Die Rückmeldefrist ist abgelaufen." }))),
    "Die Rückmeldefrist ist abgelaufen.");
  assert.equal(await serverMeldung(antwort(500, JSON.stringify({ code: "42703", message: "column x does not exist" }))),
    "Server antwortet mit 500");
  assert.equal(await serverMeldung(antwort(502, "<html>")), "Server antwortet mit 502");
});

test("die Einzelansicht sperrt nur eine NEUE Zusage und erklaert es", () => {
  assert.match(seite, /function zusageGesperrt\(termin\)/);
  assert.match(seite, /termin\.mein_status !== "zu"/);
  assert.match(seite, /Absagen geht weiterhin/);
  assert.match(seite, /Der Termin hat bereits begonnen/);
});
