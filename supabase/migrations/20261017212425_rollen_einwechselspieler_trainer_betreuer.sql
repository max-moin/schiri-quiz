-- 'trainer' bleibt der alte kombinierte Bestandswert. Neue Fragen verwenden
-- trainer_einzeln/betreuer; keine historischen Antworten oder Lösungen ändern.
alter table public.szenario_loesungen drop constraint szenario_rolle_gueltig,
  add constraint szenario_rolle_gueltig check (strafe_fuer_rolle is null or
    strafe_fuer_rolle in ('feldspieler','torwart','auswechselspieler','einwechselspieler','trainer','trainer_einzeln','betreuer'));
alter table public.frage_entscheidungsloesungen
  drop constraint frage_entscheidung_rolle_gueltig,
  drop constraint frage_entscheidung_rollen_gueltig_werte,
  add constraint frage_entscheidung_rolle_gueltig check (strafe_fuer_rolle is null or
    strafe_fuer_rolle in ('feldspieler','torwart','auswechselspieler','einwechselspieler','trainer','trainer_einzeln','betreuer')),
  add constraint frage_entscheidung_rollen_gueltig_werte check (strafe_rollen_gueltig is null or (
    cardinality(strafe_rollen_gueltig) between 1 and 7 and
    strafe_rollen_gueltig <@ array['feldspieler','torwart','auswechselspieler','einwechselspieler','trainer','trainer_einzeln','betreuer']::text[]));
alter table public.frage_entscheidung_strafen
  drop constraint strafe_rollen_gueltig_werte,
  add constraint strafe_rollen_gueltig_werte check (rollen_gueltig is null or (
    cardinality(rollen_gueltig) between 1 and 7 and
    rollen_gueltig <@ array['feldspieler','torwart','auswechselspieler','einwechselspieler','trainer','trainer_einzeln','betreuer']::text[]));

create or replace function public.entscheidung_teilnote_rolle(p_gewaehlt text,p_gueltige text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(nullif(p_gewaehlt,''),'') = any(coalesce(p_gueltige,array['']::text[]))
    or (coalesce(p_gewaehlt,'') in ('trainer_einzeln','betreuer') and
      'trainer' = any(coalesce(p_gueltige,'{}'::text[])));
$$;
-- Interner Helfer bleibt intern; keine neue anonym aufrufbare Funktion.
revoke all on function public.entscheidung_teilnote_rolle(text,text[]) from public,anon,authenticated;

-- Bestehende ausführliche Formatierung beibehalten; exakt nur Rollennamen
-- ergänzen. Der Guard verhindert eine unbemerkte Anpassung am falschen Stand.
do $$
declare v_alt text; v_neu text;
begin
  v_alt := pg_get_functiondef('public.entscheidung_anzeige(jsonb)'::regprocedure);
  v_neu := replace(v_alt, 'when ''trainer'' then ''Trainer/Betreuer''',
    'when ''einwechselspieler'' then ''Einwechselspieler''
          when ''trainer_einzeln'' then ''Trainer''
          when ''betreuer'' then ''Betreuer''
          when ''trainer'' then ''Trainer/Betreuer''');
  if v_alt=v_neu then raise exception 'Unerwarteter Stand von entscheidung_anzeige'; end if;
  execute v_neu;
end $$;
