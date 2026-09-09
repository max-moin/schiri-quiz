-- v133: Treff-Themen auch in der Detailansicht des Obmann-Eingangs
-- eindeutig beschriften. V132 erweiterte bereits Abgabe, Constraint und
-- Listenansicht; die Detailfunktion besitzt absichtlich eine eigene
-- Beschriftung und muss deshalb separat nachgezogen werden.

do $mig$
declare
  v_def text;
  v_anker text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'obmann_meldung_details'
     and pg_get_function_identity_arguments(p.oid) = 'p_passwort text, p_id uuid';

  if v_def is null then
    raise exception 'obmann_meldung_details mit erwarteter Signatur nicht gefunden';
  end if;

  v_anker := $q$      when 'regelfall' then 'Regelfall'$q$;
  if position(v_anker in v_def) = 0 then
    raise exception 'Meldebogen-Titelanker in obmann_meldung_details nicht gefunden';
  end if;

  v_def := replace(v_def, v_anker,
    $q$      when 'treff'     then 'Thema fuer Schiri-Treff'
      when 'regelfall' then 'Regelfall'$q$);
  execute v_def;
end
$mig$;

revoke all on function public.obmann_meldung_details(text, uuid) from public;
grant execute on function public.obmann_meldung_details(text, uuid) to anon, authenticated;

do $pruef$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'obmann_meldung_details'
      and p.prosrc like '%Thema fuer Schiri-Treff%'
  ) then
    raise exception 'obmann_meldung_details beschriftet Treff-Ideen nicht';
  end if;
end
$pruef$;
