// ============================================================
//  Zahl- und Auswahlantworten: Rundlauf-Fixes (26.09.2026)
// ============================================================
//  Die Fehler, die der Live-Rundlauf gefunden hat, und die man beim
//  Weiterbauen leicht wieder einbaut:
//  - "v_typ <> 'zahl'" laesst eine nicht gefundene Frage (NULL) durch,
//  - im Duell standen ALLE Optionen als "richtig" im Vergleich,
//  - Zahlantworten fehlten in Personendetail, Wochenauswertung, "Warum?"
//    und Duell-Detail.
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const ohneKommentare = (sql) => sql.replace(/--[^\n]*/g, "");
const rundlauf = ohneKommentare(lies("supabase/migrations/20260926100000_zahl_und_auswahl_rundlauf.sql"));
const duell = ohneKommentare(lies("supabase/migrations/20260926110000_duell_details_alle_antworttypen.sql"));

function rumpf(sql, name) {
  const anfang = sql.indexOf(`function public.${name}(`);
  assert.ok(anfang >= 0, `${name} fehlt`);
  const start = sql.indexOf("$function$", anfang);
  const ende = sql.indexOf("$function$", start + 10);
  return sql.slice(anfang, ende);
}

test("die Wochenquiz-Sperre greift auch, wenn die Frage gar nicht gefunden wird", () => {
  const zahl = rumpf(rundlauf, "antwort_zahl_abgeben");
  assert.match(zahl, /if v_typ is distinct from 'zahl' then raise exception/);
  assert.doesNotMatch(zahl, /if v_typ <> 'zahl'/);
  const auswahl = rumpf(rundlauf, "antwort_auswahl_abgeben");
  assert.match(auswahl, /if v_typ is null or v_typ not in \('multiple_choice','mehrfachauswahl'\)/);
  for (const r of [zahl, auswahl]) {
    assert.match(r, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/);
    assert.match(r, /now\(\) between r\.startet_am and r\.endet_am and f\.aktiv/);
    assert.match(r, /rf\.verein_id=v_verein/);
  }
});

test("im Duell zaehlen nur die richtigen Optionen als Loesung", () => {
  const r = rumpf(rundlauf, "duell_antwort_auswahl");
  assert.match(r, /array_agg\(o\.schluessel order by o\.schluessel\) filter \(where o\.ist_richtig\)/);
  assert.match(r, /if v_typ is null or v_typ not in/);
});

test("Zahlantworten erscheinen als Text in App, Wochenauswertung und 'Warum?'", () => {
  assert.match(rundlauf, /public\.obmann_person_verlauf\(text,text\)/);
  assert.match(rundlauf, /public\.obmann_wochenauswertung\(text,uuid\)/);
  assert.match(rundlauf, /when f\.antworttyp = 'zahl' then public\.zahl_antwort_text\(a\.gegebene_zahl, a\.gegebene_einheit\)/);
  assert.match(rundlauf, /when f\.antworttyp = 'zahl' then public\.zahl_loesung_text\(f\.id\)/);
  assert.match(rundlauf, /when f\.antworttyp in \('zahl', 'mehrfachauswahl'\) then 'freitext'/);
  // Der Patch bricht laut ab, wenn die Ankerstelle nicht genau einmal da ist.
  assert.match(rundlauf, /if v_anz <> 1 then raise exception/);
});

test("Zahlen werden deutsch geschrieben und die Helfer sind nicht von aussen aufrufbar", () => {
  assert.match(rumpf(rundlauf, "zahl_als_text"), /replace\(trim_scale\(p_wert\)::text, '\.', ','\)/);
  assert.match(rumpf(rundlauf, "zahl_loesung_text"), /' oder '/);
  for (const sig of ["zahl_als_text\\(numeric\\)", "zahl_antwort_text\\(numeric, text\\)", "zahl_loesung_text\\(uuid\\)", "auswahl_text\\(uuid, text\\[\\], boolean\\)"]) {
    assert.match(rundlauf, new RegExp(`revoke all on function public\\.${sig} from public, anon, authenticated`));
  }
  assert.doesNotMatch(rundlauf, /grant execute[^;]*to public\b/i);
});

test("Duell-Detail liefert Loesung alter Fragen, Zahl-/Icon-Antworten und KI-Rueckmeldung", () => {
  const r = rumpf(duell, "obmann_duell_details");
  assert.match(r, /v_verein := obmann_verein\(p_passwort\)/);
  assert.match(r, /d\.verein_id = v_verein/);
  assert.match(r, /'ist_richtig', alt\.schluessel = v_frage\.richtige_option/);
  assert.match(r, /'antwort_text', case a\.gegebene_details->>'art'/);
  assert.match(r, /'loesung_text', v_loesung/);
  for (const feld of ["'feedback'", "'ki_nachfrage'", "'feedback_final'"]) assert.match(r, new RegExp(feld));
});
