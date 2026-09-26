// ============================================================
//  Gastmodus verraet keine Loesungen der laufenden Woche (26.09.2026)
// ============================================================
//  gast_antwort_pruefen lieferte die richtige Option fuer JEDE aktive
//  MC-Frage. Die Migration begrenzt das auf Fragen, die der Gastmodus
//  selbst anzeigt - mit derselben Regel wie gast_fragen_liste().
// ============================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260926120000_gast_antwort_nur_gastfragen.sql", import.meta.url), "utf8");

test("gast_antwort_pruefen prueft dieselbe Sichtbarkeit wie die Gastliste", () => {
  const funktion = sql.slice(sql.indexOf("create or replace function public.gast_antwort_pruefen"), sql.indexOf("$function$;"));
  assert.match(funktion, /frage_ist_sichtbar\(f\.sichtbar_gast, rf\.runde_id, f\.nie_in_rotation\)/);
  assert.match(funktion, /where gastzugang_erlaubt/);
  assert.match(funktion, /returns table\(korrekt boolean, richtige_option text\)/, "Rueckgabetyp bleibt gleich");
});

test("Rechte: anon darf pruefen, Trigger-Funktionen nicht mehr", () => {
  assert.match(sql, /grant execute on function public\.gast_antwort_pruefen\(uuid, text\) to anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.ausruestung_anfrage_eroeffnen\(\) from public, anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.ausruestung_richtwert_setzen\(\) from public, anon, authenticated/);
});
