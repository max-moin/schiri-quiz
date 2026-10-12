-- CLI-Datei auf die bestaetigte MCP-Migrationsversion 20261012142034 angeglichen.
-- Rein lesender, PIN-geschuetzter Baustein. Keine neue Tabelle,
-- kein Client-Schreibzugriff und keine Aenderung von Quiz-/Uebungsantworten.
create or replace function public.meine_wochenserie_basis(p_schiedsrichter_id uuid, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_verein uuid; v_seit timestamptz; v_wochen jsonb;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select s.erstellt_am into v_seit from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  with runden as (
    select r.id,r.bezeichnung,r.startet_am,r.endet_am,
      ((r.endet_am at time zone 'Europe/Berlin') + interval '7 days') at time zone 'Europe/Berlin' as retten_bis
    from public.runden r
    where r.startet_am <= now() and r.endet_am > v_seit
      and exists(select 1 from public.runden_fragen rf where rf.runde_id=r.id and rf.verein_id=v_verein)
  ), wochen as (
    select r.id as runde_id,r.bezeichnung,r.startet_am,r.endet_am,r.retten_bis,
      count(rf.frage_id)::int as fragen_gesamt,
      count(a.id) filter (where coalesce(a.bewertungsstatus,'falsch')<>'nachbessern'
        and a.beantwortet_am >= r.startet_am and a.beantwortet_am < r.endet_am)::int as beantwortet
    from runden r join public.runden_fragen rf on rf.runde_id=r.id and rf.verein_id=v_verein
    left join public.antworten a on a.frage_id=rf.frage_id and a.schiedsrichter_id=p_schiedsrichter_id
    group by r.id,r.bezeichnung,r.startet_am,r.endet_am,r.retten_bis
  )
  select coalesce(jsonb_agg(to_jsonb(w) || jsonb_build_object('uebung_richtig',
    (select count(distinct h.frage_id) from public.historie_antworten h
      where h.schiedsrichter_id=p_schiedsrichter_id and h.korrekt is true
        and h.beantwortet_am >= w.endet_am and h.beantwortet_am < w.retten_bis
        and h.beantwortet_am <= now())) order by w.startet_am,w.runde_id),'[]'::jsonb)
  into v_wochen from wochen w;
  return jsonb_build_object('jetzt',now(),'wochen',v_wochen);
end;
$$;
revoke all on function public.meine_wochenserie_basis(uuid,text) from public,anon,authenticated;
grant execute on function public.meine_wochenserie_basis(uuid,text) to anon,authenticated,service_role;
comment on function public.meine_wochenserie_basis(uuid,text) is
  'Nur eigener Zugang. Wochenabschluss inklusive falscher, aber ohne offene Nachbesserungen. Rettung: 5 verschiedene korrekt gespeicherte Uebungsfragen in 7 Berliner Kalendertagen. Keine Aenderung fachlicher Statistiken.';
