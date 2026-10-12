-- Dateinummer entspricht der bestätigten Remote-Migrationshistorie.
-- Persönliche Termin-Ausnahmen und atomare Themenauswahl. Keine bestehenden
-- Einwilligungen werden eingeschaltet, keine Bestandsdaten zurückgesetzt.
create table public.schiri_push_terminausnahmen (
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  termin_id uuid not null references public.termine(id) on delete cascade,
  aktualisiert_am timestamptz not null default now(),
  primary key (schiedsrichter_id, termin_id)
);
alter table public.schiri_push_terminausnahmen enable row level security;
revoke all on public.schiri_push_terminausnahmen from public, anon, authenticated;

create function public.schiri_push_auswahl_setzen(
  p_schiedsrichter_id uuid, p_pin text, p_feedback_antwort boolean,
  p_quiz_neu boolean, p_quiz_erinnerung boolean, p_termine boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_feedback_antwort is null or p_quiz_neu is null
    or p_quiz_erinnerung is null or p_termine is null then
    raise exception 'Auswahl unvollstaendig';
  end if;
  -- Bestehende Widerruf-/Warteschlangenregeln bleiben an EINER Stelle.
  perform public.schiri_push_feedback_setzen(p_schiedsrichter_id,p_pin,p_feedback_antwort);
  perform public.schiri_push_quiz_setzen(p_schiedsrichter_id,p_pin,p_quiz_neu,p_quiz_erinnerung);
  perform public.schiri_push_termine_setzen(p_schiedsrichter_id,p_pin,p_termine);
  return public.schiri_push_einstellungen(p_schiedsrichter_id,p_pin);
end $$;

create function public.schiri_push_terminwahl(p_schiedsrichter_id uuid,p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_termine jsonb; v_global boolean;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select coalesce(p.termine,false) into v_global from public.schiri_push_praeferenzen p
    where p.schiedsrichter_id=p_schiedsrichter_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'titel',t.titel,'datum',t.datum,'beginn',t.beginn_zeit,
    'ausgewaehlt',x.termin_id is null,'erinnerung_modus',t.erinnerung_modus,
    'berechtigt',(t.pflicht and t.verein_id=v_verein) or r.status='zu'
  ) order by t.datum,t.beginn_zeit nulls last,t.titel),'[]'::jsonb) into v_termine
  from public.termine t
  left join public.schiri_push_terminausnahmen x
    on x.termin_id=t.id and x.schiedsrichter_id=p_schiedsrichter_id
  left join public.termin_rueckmeldungen r
    on r.termin_id=t.id and r.schiedsrichter_id=p_schiedsrichter_id
  where t.sichtbarkeit<>'nur_app'
    and (t.sichtbarkeit='oeffentlich' or t.verein_id=v_verein)
    and public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit)>now();
  return jsonb_build_object('termine_aktiv',coalesce(v_global,false),'termine',v_termine);
end $$;

create function public.schiri_push_termin_setzen(
  p_schiedsrichter_id uuid,p_pin text,p_termin_id uuid,p_aktiv boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_aktiv is null then raise exception 'Auswahl fehlt'; end if;
  if not exists(select 1 from public.termine t where t.id=p_termin_id
    and t.sichtbarkeit<>'nur_app'
    and (t.sichtbarkeit='oeffentlich' or t.verein_id=v_verein)) then
    raise exception 'Termin nicht verfuegbar';
  end if;
  if p_aktiv then
    delete from public.schiri_push_terminausnahmen
      where schiedsrichter_id=p_schiedsrichter_id and termin_id=p_termin_id;
  else
    insert into public.schiri_push_terminausnahmen(schiedsrichter_id,termin_id)
      values(p_schiedsrichter_id,p_termin_id)
      on conflict(schiedsrichter_id,termin_id) do update set aktualisiert_am=now();
    update public.benachrichtigungs_auftraege a
      set status='aufgegeben',letzter_fehlercode='termin_abgewaehlt',
        gesperrt_bis=null,aktualisiert_am=now()
      from public.benachrichtigungs_ereignisse e
      where e.id=a.ereignis_id and e.typ='termin.erinnerung' and e.referenz_id=p_termin_id
        and a.empfaenger_schluessel='s_'||p_schiedsrichter_id::text
        and a.kanal='web_push' and a.status in ('offen','fehlgeschlagen');
  end if;
  return jsonb_build_object('termin_id',p_termin_id,'ausgewaehlt',p_aktiv);
end $$;

create or replace function public.schiri_push_termin_gueltig(
  p_person_id uuid,p_termin_id uuid,p_datum date,p_beginn text,p_phase text
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.termine t
    join public.schiedsrichter s on s.id=p_person_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
    where t.id=p_termin_id and t.datum=p_datum
      and coalesce(t.beginn_zeit::text,'')=p_beginn
      and t.sichtbarkeit<>'nur_app'
      and s.aktiv and not coalesce(s.ist_test,false) and p.termine
      and not exists(select 1 from public.schiri_push_terminausnahmen x
        where x.schiedsrichter_id=s.id and x.termin_id=t.id)
      and ((p_phase='vortag' and t.erinnerung_modus in ('vortag','beide'))
        or (p_phase='tag' and t.erinnerung_modus in ('tag','beide') and t.beginn_zeit>time '09:00'))
      and (t.sichtbarkeit='oeffentlich' or s.verein_id=t.verein_id)
      and ((t.pflicht and s.verein_id=t.verein_id)
        or exists(select 1 from public.termin_rueckmeldungen r
          where r.termin_id=t.id and r.schiedsrichter_id=s.id and r.status='zu'))
      and (t.datum>(now() at time zone 'Europe/Berlin')::date
        or (t.datum=(now() at time zone 'Europe/Berlin')::date
          and t.beginn_zeit>(now() at time zone 'Europe/Berlin')::time))
      and exists(select 1 from public.push_abos b
        where b.schiedsrichter_id=s.id and b.gueltig_bis>now())
  );
$$;

revoke all on function public.schiri_push_auswahl_setzen(uuid,text,boolean,boolean,boolean,boolean) from public,anon,authenticated;
revoke all on function public.schiri_push_terminwahl(uuid,text) from public,anon,authenticated;
revoke all on function public.schiri_push_termin_setzen(uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.schiri_push_auswahl_setzen(uuid,text,boolean,boolean,boolean,boolean) to anon,authenticated;
grant execute on function public.schiri_push_terminwahl(uuid,text) to anon,authenticated;
grant execute on function public.schiri_push_termin_setzen(uuid,text,uuid,boolean) to anon,authenticated;
revoke all on function public.schiri_push_termin_gueltig(uuid,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.schiri_push_termin_gueltig(uuid,uuid,date,text,text) to service_role;
notify pgrst,'reload schema';
