-- v143: Terminantworten richten sich nach Sichtbarkeit und dem separaten
-- Rueckmeldeschalter. Oeffentliche Termine duerfen von jedem angemeldeten
-- Schiedsrichter beantwortet werden; interne Termine nur vom eigenen Verein.
-- Die Obmann-Auswertung trennt fremde Antworten nach Verein und rechnet sie
-- nicht in den Rueckmeldestand des veranstaltenden Vereins hinein.

-- Der oeffentliche Vertrag hatte `rueckmeldung_erforderlich` bisher nicht
-- geliefert. Im Browser war das Feld deshalb `undefined` und jeder Termin
-- sah wie ein reiner Informationstermin aus.
drop function if exists public.oeffentliche_termine_alle(text);
create function public.oeffentliche_termine_alle(p_seitenschluessel text)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, rueckmeldung_erforderlich boolean,
  vergangen boolean
)
language sql
stable
security definer
set search_path to public
as $function$
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.rueckmeldung_erforderlich,
         t.datum < (now() at time zone 'Europe/Berlin')::date as vergangen
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.sichtbarkeit = 'oeffentlich'
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
$function$;

revoke all on function public.oeffentliche_termine_alle(text) from public, anon, authenticated;
grant execute on function public.oeffentliche_termine_alle(text) to anon, authenticated;

-- Personalisierte Website-Sicht. Sie vereint
--   * Web-Termine des eigenen Vereins und
--   * oeffentliche Termine der gerade besuchten Vereinsseite.
-- Dadurch kann ein angemeldeter Schiedsrichter auch bei einem oeffentlichen
-- Termin eines anderen Vereins seinen eigenen Stand sehen und antworten,
-- ohne interne Termine oder Teilnehmerlisten des fremden Vereins zu erhalten.
create or replace function public.termine_fuer_schiri_v2(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_seitenschluessel text
)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, rueckmeldung_erforderlich boolean,
  vergangen boolean,
  mein_status text, mein_grund text, mein_kommentar text,
  zusagen integer, absagen integer,
  eigener_verein boolean, termin_verein_id uuid, termin_verein_name text
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  return query
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.rueckmeldung_erforderlich,
         t.datum < (now() at time zone 'Europe/Berlin')::date as vergangen,
         r.status, r.grund, r.kommentar,
         (select count(*)::integer
            from termin_rueckmeldungen x
            join schiedsrichter xs on xs.id = x.schiedsrichter_id
           where x.termin_id = t.id and x.status = 'zu'
             and xs.verein_id = v_verein),
         (select count(*)::integer
            from termin_rueckmeldungen x
            join schiedsrichter xs on xs.id = x.schiedsrichter_id
           where x.termin_id = t.id and x.status = 'ab'
             and xs.verein_id = v_verein),
         t.verein_id = v_verein,
         t.verein_id,
         tv.name
  from termine t
  join vereine tv on tv.id = t.verein_id
  left join termin_rueckmeldungen r
    on r.termin_id = t.id and r.schiedsrichter_id = p_schiedsrichter_id
  where (
      t.verein_id = v_verein
      and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
    ) or (
      tv.oeffentliche_kennung = p_seitenschluessel
      and t.sichtbarkeit = 'oeffentlich'
    )
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
end;
$function$;

revoke all on function public.termine_fuer_schiri_v2(uuid, text, text) from public, anon, authenticated;
grant execute on function public.termine_fuer_schiri_v2(uuid, text, text) to anon, authenticated;

-- Sichtbarkeit und Rueckmeldepflicht sind zwei unabhaengige Entscheidungen:
-- intern -> nur eigener Verein; oeffentlich -> jeder gueltig angemeldete SR.
create or replace function public.termin_rueckmeldung_setzen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_termin_id uuid,
  p_status text,
  p_grund text default null,
  p_kommentar text default null
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_datum date;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  select t.datum into v_datum
  from termine t
  where t.id = p_termin_id
    and (
      (t.sichtbarkeit = 'nur_verein' and t.verein_id = v_verein)
      or t.sichtbarkeit = 'oeffentlich'
    )
    and t.rueckmeldung_erforderlich;

  if v_datum is null then
    raise exception 'Termin nicht gefunden oder keine Rueckmeldung vorgesehen';
  end if;
  if v_datum < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Termin liegt in der Vergangenheit';
  end if;
  if p_status not in ('zu', 'ab') then
    raise exception 'Ungueltiger Status: %', p_status;
  end if;
  if p_status = 'ab' and p_grund is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  insert into termin_rueckmeldungen as r
    (termin_id, schiedsrichter_id, status, grund, kommentar, gemeldet_am)
  values (
    p_termin_id, p_schiedsrichter_id, p_status,
    case when p_status = 'ab' then p_grund else null end,
    case when p_status = 'ab' then nullif(trim(coalesce(p_kommentar, '')), '') else null end,
    now()
  )
  on conflict (termin_id, schiedsrichter_id) do update set
    status = excluded.status,
    grund = excluded.grund,
    kommentar = excluded.kommentar,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

revoke all on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) to anon, authenticated;

-- Der Rueckmeldestand der Terminliste bleibt der Stand des veranstaltenden
-- Vereins. Antworten fremder Vereine werden dort nicht hineingerechnet.
create or replace function public.obmann_termine_mit_stand(p_passwort text)
returns table (
  id uuid, titel text, datum date, beschreibung text, oeffentlich boolean,
  sichtbarkeit text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, veranstalter text,
  rueckmeldung_erforderlich boolean, notiz_obmann text,
  zusagen integer, absagen integer, offen integer
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_aktive integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  select count(*)::integer into v_aktive
  from schiedsrichter s
  where s.verein_id = v_verein and s.aktiv and not s.ist_test;

  return query
  select t.id, t.titel, t.datum, t.beschreibung, t.oeffentlich,
         t.sichtbarkeit,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.veranstalter,
         t.rueckmeldung_erforderlich, t.notiz_obmann,
         case when t.rueckmeldung_erforderlich then coalesce(z.zu, 0) else 0 end,
         case when t.rueckmeldung_erforderlich then coalesce(z.ab, 0) else 0 end,
         case when t.rueckmeldung_erforderlich
              then greatest(v_aktive - coalesce(z.zu, 0) - coalesce(z.ab, 0), 0)
              else 0 end
  from termine t
  left join (
    select r.termin_id, s.verein_id,
           count(*) filter (where r.status = 'zu')::integer as zu,
           count(*) filter (where r.status = 'ab')::integer as ab
    from termin_rueckmeldungen r
    join schiedsrichter s on s.id = r.schiedsrichter_id
    group by r.termin_id, s.verein_id
  ) z on z.termin_id = t.id and z.verein_id = v_verein
  where t.verein_id = v_verein
  order by t.datum asc, t.beginn_zeit asc nulls last;
end;
$function$;

revoke all on function public.obmann_termine_mit_stand(text) from public, anon, authenticated;
grant execute on function public.obmann_termine_mit_stand(text) to anon, authenticated;

-- Eigene Vereinsmitglieder erscheinen vollstaendig (auch offen). Von anderen
-- Vereinen erscheinen nur Personen, die bei diesem oeffentlichen Termin
-- tatsaechlich geantwortet haben. So bleiben Gruppen getrennt und es werden
-- keine fremden Mitgliederlisten offengelegt.
drop function if exists public.obmann_termin_rueckmeldungen(text, uuid);
create function public.obmann_termin_rueckmeldungen(
  p_passwort text,
  p_termin_id uuid
)
returns table (
  schiedsrichter_id uuid, name text, status text,
  grund text, kommentar text, gemeldet_am timestamptz,
  verein_id uuid, verein_name text, ist_eigener_verein boolean
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  if not exists (
    select 1 from termine t
    where t.id = p_termin_id and t.verein_id = v_verein
  ) then
    raise exception 'Termin nicht gefunden';
  end if;

  return query
  with rueckmeldungen as (
    select s.id as schiedsrichter_id, s.name,
           coalesce(r.status, 'offen') as status,
           r.grund, r.kommentar, r.gemeldet_am,
           s.verein_id, v.name as verein_name, true as ist_eigener_verein
    from schiedsrichter s
    join vereine v on v.id = s.verein_id
    left join termin_rueckmeldungen r
      on r.schiedsrichter_id = s.id and r.termin_id = p_termin_id
    where s.verein_id = v_verein and s.aktiv and not s.ist_test

    union all

    select s.id, s.name, r.status, r.grund, r.kommentar, r.gemeldet_am,
           s.verein_id, v.name, false
    from termin_rueckmeldungen r
    join schiedsrichter s on s.id = r.schiedsrichter_id
    join vereine v on v.id = s.verein_id
    where r.termin_id = p_termin_id
      and s.verein_id <> v_verein
  )
  select r.schiedsrichter_id, r.name, r.status,
         r.grund, r.kommentar, r.gemeldet_am,
         r.verein_id, r.verein_name, r.ist_eigener_verein
  from rueckmeldungen r
  order by r.ist_eigener_verein desc, r.verein_name,
    case r.status when 'offen' then 0 when 'ab' then 1 else 2 end,
    r.name;
end;
$function$;

revoke all on function public.obmann_termin_rueckmeldungen(text, uuid) from public, anon, authenticated;
grant execute on function public.obmann_termin_rueckmeldungen(text, uuid) to anon, authenticated;

comment on function public.termine_fuer_schiri_v2(uuid, text, text) is
  'Personalisierte Webtermine: eigener Verein plus oeffentliche Termine der besuchten Vereinsseite.';
comment on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) is
  'Antwort auf internen Termin des eigenen Vereins oder jeden oeffentlichen Termin; nur bei aktivierter Rueckmeldepflicht.';
comment on function public.obmann_termin_rueckmeldungen(text, uuid) is
  'Eigener Verein vollstaendig, tatsaechliche fremde Antworten getrennt mit Vereinsangabe.';
