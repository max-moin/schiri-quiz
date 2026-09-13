-- Die persönliche Duellliste liefert jetzt genug Daten für getrennte
-- Handlungen: Beteiligte ansehen, Lobby öffnen, Zwischenstand ansehen und
-- teilen. Der Ersteller darf außerdem ausschließlich sein eigenes Duell
-- über seinen vorhandenen, zufälligen Teilnehmer-Zugang schließen.

create or replace function public.duell_meine_liste(
  p_schiedsrichter_id uuid, p_pin text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ergebnis jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', d.code,
    'status', d.status,
    'zugang', t.zugang,
    'ist_ersteller', d.erstellt_von = p_schiedsrichter_id,
    'ich_richtig', coalesce(eigen.richtig, 0),
    'ich_beantwortet', coalesce(eigen.beantwortet, 0),
    'teilnehmer', coalesce(alle.teilnehmer, '[]'::jsonb),
    'erstellt_am', d.erstellt_am
  ) order by d.erstellt_am desc), '[]'::jsonb)
  into v_ergebnis
  from public.duell_teilnehmer t
  join public.duell_sessions d on d.id = t.session_id
  left join lateral (
    select count(*)::int beantwortet,
           count(*) filter (where a.korrekt)::int richtig
    from public.duell_antworten a where a.teilnehmer_id = t.id
  ) eigen on true
  left join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', x.anzeigename,
      'richtig', x.richtig,
      'beantwortet', x.beantwortet
    ) order by x.beigetreten_am), '[]'::jsonb) teilnehmer
    from (
      select p.anzeigename, p.beigetreten_am,
             count(a.frage_id)::int beantwortet,
             count(a.frage_id) filter (where a.korrekt)::int richtig
      from public.duell_teilnehmer p
      left join public.duell_antworten a on a.teilnehmer_id = p.id
      where p.session_id = d.id
      group by p.id, p.anzeigename, p.beigetreten_am
    ) x
  ) alle on true
  where t.schiedsrichter_id = p_schiedsrichter_id;

  return v_ergebnis;
end;
$$;

create or replace function public.duell_eigenes_schliessen(p_zugang uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.duell_sessions d
     set status = 'geschlossen', geschlossen_am = now()
   where d.status = 'offen'
     and exists (
       select 1
       from public.duell_teilnehmer t
       where t.session_id = d.id
         and t.zugang = p_zugang
         and t.schiedsrichter_id is not null
         and t.schiedsrichter_id = d.erstellt_von
     );
  return found;
end;
$$;

comment on function public.duell_eigenes_schliessen(uuid) is
  'Schließt ein offenes Duell nur über den Zugang seines angemeldeten Erstellers. Gäste und andere Teilnehmer bleiben ohne Schreibrecht.';

revoke all on function public.duell_meine_liste(uuid, text) from public, anon, authenticated;
revoke all on function public.duell_eigenes_schliessen(uuid) from public, anon, authenticated;
grant execute on function public.duell_meine_liste(uuid, text) to anon;
grant execute on function public.duell_eigenes_schliessen(uuid) to anon;
