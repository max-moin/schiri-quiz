-- Nur künstliche, inaktive Frage. Keine Teilnehmerantwort/Benachrichtigung.
begin;
do $$
declare
  f uuid := gen_random_uuid();
  cfg jsonb := '{"fordert_fortsetzung":false,"fordert_strafe":true,"fordert_strafe_mannschaft":false,"fordert_strafe_rolle":false,"fordert_strafe_nummer":false,"strafen":[{"strafe":"gelb"}]}';
  liste jsonb;
  note jsonb;
begin
  insert into public.fragen(id,frage_text,medium,antworttyp,aktiv)
    values(f,'Icon-Mannschaft-Rollbackfixture','text','entscheidung',false);
  perform public.frage_entscheidungsloesung_setzen(f,cfg);
  if not exists(select 1 from public.frage_entscheidungsloesungen
      where frage_id=f and not fordert_strafe_mannschaft and strafe_fuer_mannschaft is null)
    then raise exception 'TEST Mannschaft wurde trotz Abschaltung verlangt'; end if;
  liste := public.entscheidung_strafen_liste(f);
  if jsonb_array_length(liste)<>1 or liste#>>'{0,fuer_mannschaft}' is not null
    then raise exception 'TEST Versteckte Heim-Vorgabe'; end if;
  note := public.entscheidung_strafen_vergleich('[{"strafe":"gelb"}]',liste,false,false,false);
  if note->>'strafe_richtig'<>'true' or note->>'strafziel_richtig' is not null
    then raise exception 'TEST Antwort ohne Mannschaft nicht korrekt'; end if;
  note := public.entscheidung_strafen_vergleich('[{"strafe":"rot"}]',liste,false,false,false);
  if note->>'strafe_richtig'<>'false'
    then raise exception 'TEST Falsche Karte wurde akzeptiert'; end if;
  cfg := jsonb_set(cfg,'{fordert_strafe_mannschaft}','true');
  cfg := jsonb_set(cfg,'{strafen,0,fuer_mannschaft}','"gast"');
  perform public.frage_entscheidungsloesung_setzen(f,cfg);
  liste := public.entscheidung_strafen_liste(f);
  note := public.entscheidung_strafen_vergleich('[{"strafe":"gelb"}]',liste,true,false,false);
  if note->>'strafziel_richtig'<>'false'
    then raise exception 'TEST Aktivierte Mannschaft nicht verlangt'; end if;
  cfg := jsonb_set(cfg,'{fordert_strafe_mannschaft}','false');
  perform public.frage_entscheidungsloesung_setzen(f,cfg);
  if exists(select 1 from public.frage_entscheidung_strafen where frage_id=f and fuer_mannschaft is not null)
    then raise exception 'TEST Alte Mannschaft beim Abschalten behalten'; end if;
  raise notice 'PASS: Speichern, Auswertung und Umschalten ohne versteckte Mannschaft';
end $$;
rollback;
