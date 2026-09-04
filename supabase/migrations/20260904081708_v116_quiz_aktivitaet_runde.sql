-- Stable deep link from an inbox quiz-completion event to its round.
-- Uses the same event identity as obmann_eingang; titles/dates are not parsed.
create or replace function public.obmann_quiz_aktivitaet_runde(
  p_passwort text, p_ereignis_id uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_verein uuid := public.obmann_verein(p_passwort);
  v_runde uuid;
begin
  select rf.runde_id into v_runde
  from public.antworten a
  join public.schiedsrichter s on s.id = a.schiedsrichter_id
  join public.runden_fragen rf on rf.frage_id = a.frage_id and rf.verein_id = s.verein_id
  where s.verein_id = v_verein
    and md5(s.id::text || rf.runde_id::text)::uuid = p_ereignis_id
  limit 1;
  if v_runde is null then
    raise exception 'Quiz-Aktivität in diesem Verein nicht mehr vorhanden';
  end if;
  return v_runde;
end;
$$;
revoke all on function public.obmann_quiz_aktivitaet_runde(text, uuid) from public;
grant execute on function public.obmann_quiz_aktivitaet_runde(text, uuid) to anon, authenticated, service_role;
