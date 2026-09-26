-- ============================================================
--  Gastmodus: Loesung nur fuer Fragen, die Gaeste auch sehen
-- ============================================================
--  WARUM (Sicherheitspruefung 26.09.2026, Plan C):
--  gast_antwort_pruefen(p_frage_id, p_option) ist ohne Anmeldung
--  aufrufbar und lieferte "richtige_option" fuer JEDE aktive
--  Multiple-Choice-Frage - auch fuer die Fragen der laufenden und der
--  kommenden Woche. Wer die Frage-ID kennt (jeder angemeldete Schiri
--  bekommt sie mit wochen_fragen_v2), konnte sich so die Loesung holen,
--  BEVOR er selbst antwortet. Live gemessen: 23 von 84 MC-Fragen waren
--  betroffen.
--
--  Jetzt gilt dieselbe Sichtbarkeitsregel wie in gast_fragen_liste():
--  nur Fragen, die der Gastmodus selbst anzeigt, werden ausgewertet.
--  Fuer alle anderen kommt eine leere Antwort (kein Fehlertext, der
--  verraet, dass es die Frage gibt). Rueckgabetyp unveraendert.
--
--  Nebenbei: Zwei Trigger-Funktionen waren fuer anon/authenticated
--  ausfuehrbar. Direkt aufrufen laesst Postgres sie ohnehin nicht, das
--  Recht ist aber ueberfluessig und taucht in jedem Sicherheitsbericht
--  auf.
-- ============================================================

create or replace function public.gast_antwort_pruefen(p_frage_id uuid, p_option text)
returns table(korrekt boolean, richtige_option text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
begin
  select id into v_verein from vereine where gastzugang_erlaubt order by created_at limit 1;

  return query
  select (f.richtige_option = p_option), f.richtige_option
  from fragen f
  left join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  where f.id = p_frage_id
    and f.aktiv = true
    and f.typ = 'multiple_choice'
    and frage_ist_sichtbar(f.sichtbar_gast, rf.runde_id, f.nie_in_rotation)
  limit 1;
end;
$function$;

revoke all on function public.gast_antwort_pruefen(uuid, text) from public;
grant execute on function public.gast_antwort_pruefen(uuid, text) to anon, authenticated;

revoke execute on function public.ausruestung_anfrage_eroeffnen() from public, anon, authenticated;
revoke execute on function public.ausruestung_richtwert_setzen() from public, anon, authenticated;
