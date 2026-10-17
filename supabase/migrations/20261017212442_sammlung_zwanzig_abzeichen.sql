-- Nur private Aggregate, keine neue Vergabe-/Punkte-/Antworttabelle.
-- Der bestehende PIN-Pfad und der bisherige Joker-Endpunkt bleiben erhalten.
create or replace function public.meine_sammelstatistik(p_schiedsrichter_id uuid,p_pin text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_verein uuid; v_wochen jsonb; v_regeln jsonb; v_treffer int; v_vorschlaege int;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  with wochen as (
    select r.id,
      count(a.id) filter(where a.korrekt is true and coalesce(a.bewertungsstatus,'falsch')='richtig'
        and a.beantwortet_am>=r.startet_am and a.beantwortet_am<r.endet_am)::int as richtig
    from public.runden r
    join public.runden_fragen rf on rf.runde_id=r.id and rf.verein_id=v_verein
    left join public.antworten a on a.frage_id=rf.frage_id and a.schiedsrichter_id=p_schiedsrichter_id
    where r.startet_am<=now()
    group by r.id
  ) select coalesce(jsonb_object_agg(id::text,richtig),'{}'::jsonb) into v_wochen from wochen;

  -- Verschiedene Frage-IDs: Wiederholungen und Wochen-/Übungsdoppelungen
  -- erhöhen den Zähler nicht. Gast und Duell sind keine Quellen.
  with eigene as (
    select a.frage_id from public.antworten a where a.schiedsrichter_id=p_schiedsrichter_id
      and a.korrekt is true and a.bewertungsstatus='richtig' and a.beantwortet_am<=now()
    union
    select h.frage_id from public.historie_antworten h where h.schiedsrichter_id=p_schiedsrichter_id
      and h.korrekt is true and h.beantwortet_am<=now()
  ), regeln as (
    select f.regel_nummer,count(*)::int as anzahl from eigene e join public.fragen f on f.id=e.frage_id
    where f.regel_nummer between 1 and 17 group by f.regel_nummer
  ) select (select count(*)::int from eigene),
    coalesce((select jsonb_object_agg(regel_nummer::text,anzahl) from regeln),'{}'::jsonb)
    into v_treffer,v_regeln;
  select count(*)::int into v_vorschlaege from public.fragenvorschlaege v
    where v.schiedsrichter_id=p_schiedsrichter_id and v.verein_id=v_verein
      and v.status='angenommen' and v.uebernommene_frage_id is not null;
  return jsonb_build_object('version',1,'wochen_richtig',v_wochen,'regeln',v_regeln,
    'treffer',v_treffer,'vorschlaege',v_vorschlaege);
end $$;
revoke all on function public.meine_sammelstatistik(uuid,text) from public,anon,authenticated;
grant execute on function public.meine_sammelstatistik(uuid,text) to anon,authenticated,service_role;
comment on function public.meine_sammelstatistik(uuid,text) is
 'Eigene PIN-geprüfte Sammelaggregate ohne Lösungen/Personenlisten. Korrekturen wirken bei erneutem Abruf. Kein Jokerbonus und keine Punkteänderung.';
