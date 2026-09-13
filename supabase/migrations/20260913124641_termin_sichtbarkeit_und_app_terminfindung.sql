-- Termin-Sichtbarkeit und Verwaltung der Terminsuchen in der Obmann-App
--
-- Drei fachlich eindeutige Stufen ersetzen den bisherigen Bool:
--   nur_app       nur im geschuetzten Obmann-Dashboard
--   nur_verein    nach PIN-Anmeldung fuer Mitglieder des Termin-Vereins
--   oeffentlich   auf der Vereinsseite sichtbar; abstimmen darf weiterhin
--                 ausschliesslich der zugeordnete Verein
--
-- `oeffentlich` bleibt vorerst als Kompatibilitaetsspalte erhalten. Ein
-- Trigger haelt beide Werte synchron, damit alte Clients nicht ploetzlich
-- falsche Sichtbarkeiten schreiben. Neue Clients verwenden `sichtbarkeit`.

alter table public.termine
  add column if not exists sichtbarkeit text;

update public.termine
set sichtbarkeit = case when oeffentlich then 'oeffentlich' else 'nur_verein' end
where sichtbarkeit is null;

alter table public.termine
  alter column sichtbarkeit set default 'nur_verein',
  alter column sichtbarkeit set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.termine'::regclass
      and conname = 'termine_sichtbarkeit_check'
  ) then
    alter table public.termine
      add constraint termine_sichtbarkeit_check
      check (sichtbarkeit in ('nur_app', 'nur_verein', 'oeffentlich'));
  end if;
end $$;

comment on column public.termine.sichtbarkeit is
  'nur_app = nur Obmann-App; nur_verein = nur angemeldete Mitglieder des Termin-Vereins; oeffentlich = auf der Vereinsseite sichtbar. Rueckmeldungen bleiben immer auf den Termin-Verein begrenzt.';

create or replace function public.termin_sichtbarkeit_spiegeln()
returns trigger
language plpgsql
set search_path to public
as $function$
begin
  if tg_op = 'INSERT' then
    -- Ein alter Client kennt nur `oeffentlich`. TRUE muss deshalb auch bei
    -- dem neuen Spalten-Default weiterhin eine oeffentliche Zeile anlegen.
    if coalesce(new.oeffentlich, false) then
      new.sichtbarkeit := 'oeffentlich';
    else
      new.sichtbarkeit := coalesce(new.sichtbarkeit, 'nur_verein');
      new.oeffentlich := new.sichtbarkeit = 'oeffentlich';
    end if;
  elsif new.sichtbarkeit is distinct from old.sichtbarkeit then
    -- Der neue Vertrag gewinnt, wenn er bewusst geaendert wurde.
    new.oeffentlich := new.sichtbarkeit = 'oeffentlich';
  elsif new.oeffentlich is distinct from old.oeffentlich then
    -- Alte Clients koennen nur zwischen oeffentlich und dem bisherigen
    -- internen Zustand unterscheiden. FALSE bedeutet deshalb nur_verein,
    -- niemals nur_app.
    new.sichtbarkeit := case when new.oeffentlich then 'oeffentlich' else 'nur_verein' end;
  else
    new.oeffentlich := new.sichtbarkeit = 'oeffentlich';
  end if;
  return new;
end;
$function$;

drop trigger if exists termine_sichtbarkeit_spiegeln_trigger on public.termine;
create trigger termine_sichtbarkeit_spiegeln_trigger
before insert or update of sichtbarkeit, oeffentlich on public.termine
for each row execute function public.termin_sichtbarkeit_spiegeln();

revoke all on function public.termin_sichtbarkeit_spiegeln() from public, anon, authenticated;

-- Die zwei konkret genannten Vereinsveranstaltungen sind ab dieser
-- Migration vereinsintern. Die UUIDs verhindern, dass gleichnamige Termine
-- anderer Vereine oder spaetere neue Termine versehentlich mitgeandert werden.
update public.termine
set sichtbarkeit = 'nur_verein'
where id in (
  '25f0d05e-efd0-4fc7-98d8-0fbe0b6b1a12'::uuid, -- SR-Treff 14.09.2026
  '21ae7f16-5f55-4ae0-8f4f-449713294ae3'::uuid  -- Soccer-Golf 17.10.2026
);

-- -------------------------------------------------------------------------
-- Oeffentliche Website: ausschliesslich `oeffentlich`.
-- -------------------------------------------------------------------------

drop function if exists public.oeffentliche_termine(text);
create function public.oeffentliche_termine(p_seitenschluessel text)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean
)
language sql
stable
security definer
set search_path to public
as $function$
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.sichtbarkeit = 'oeffentlich'
    and t.datum >= (now() at time zone 'Europe/Berlin')::date
  order by t.datum, t.beginn_zeit nulls last
  limit 4;
$function$;

drop function if exists public.oeffentliche_termine_alle(text);
create function public.oeffentliche_termine_alle(p_seitenschluessel text)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, vergangen boolean
)
language sql
stable
security definer
set search_path to public
as $function$
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis,
         t.datum < (now() at time zone 'Europe/Berlin')::date as vergangen
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.sichtbarkeit = 'oeffentlich'
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
$function$;

-- -------------------------------------------------------------------------
-- Mitgliedersicht: nur Termine des eigenen Vereins, aber kein `nur_app`.
-- Die Termin-ID allein verschafft weiterhin keinerlei Stimmrecht.
-- -------------------------------------------------------------------------

drop function if exists public.termine_fuer_schiri(uuid, text);
create function public.termine_fuer_schiri(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, vergangen boolean,
  mein_status text, mein_grund text, mein_kommentar text,
  zusagen integer, absagen integer
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
         t.rueckmeldung_bis,
         t.datum < (now() at time zone 'Europe/Berlin')::date as vergangen,
         r.status, r.grund, r.kommentar,
         (select count(*)::integer from termin_rueckmeldungen x
           where x.termin_id = t.id and x.status = 'zu'),
         (select count(*)::integer from termin_rueckmeldungen x
           where x.termin_id = t.id and x.status = 'ab')
  from termine t
  left join termin_rueckmeldungen r
    on r.termin_id = t.id and r.schiedsrichter_id = p_schiedsrichter_id
  where t.verein_id = v_verein
    and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
end;
$function$;

drop function if exists public.termin_zusagen(uuid, text, uuid);
create function public.termin_zusagen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_termin_id uuid
)
returns table (name text)
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

  if not exists (
    select 1 from termine t
    where t.id = p_termin_id
      and t.verein_id = v_verein
      and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
  ) then
    raise exception 'Termin nicht gefunden';
  end if;

  return query
  select s.name
  from termin_rueckmeldungen r
  join schiedsrichter s on s.id = r.schiedsrichter_id
  where r.termin_id = p_termin_id and r.status = 'zu'
  order by s.name;
end;
$function$;

drop function if exists public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text);
create function public.termin_rueckmeldung_setzen(
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
    and t.verein_id = v_verein
    and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
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

-- -------------------------------------------------------------------------
-- Obmann-App: neuer Speichervertrag und Sichtbarkeit in der Liste.
-- `p_oeffentlich` bleibt fuer alte App-Versionen Pflichtparameter.
-- -------------------------------------------------------------------------

drop function if exists public.obmann_termin_speichern(
  text, text, date, boolean, text, boolean, boolean, text,
  uuid, text, time, time, text, date, text
);

create function public.obmann_termin_speichern(
  p_passwort text,
  p_titel text,
  p_datum date,
  p_oeffentlich boolean,
  p_art text,
  p_pflicht boolean,
  p_rueckmeldung_erforderlich boolean,
  p_veranstalter text,
  p_sichtbarkeit text default null,
  p_termin_id uuid default null,
  p_beschreibung text default null,
  p_beginn_zeit time default null,
  p_ende_zeit time default null,
  p_ort text default null,
  p_rueckmeldung_bis date default null,
  p_notiz_obmann text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_id uuid;
  v_sichtbarkeit text;
begin
  v_verein := public.obmann_verein(p_passwort);
  v_sichtbarkeit := coalesce(
    p_sichtbarkeit,
    case when coalesce(p_oeffentlich, false) then 'oeffentlich' else 'nur_verein' end
  );

  if v_sichtbarkeit not in ('nur_app', 'nur_verein', 'oeffentlich') then
    raise exception 'Ungueltige Terminsichtbarkeit';
  end if;
  if nullif(btrim(p_titel), '') is null then
    raise exception 'Der Termin braucht einen Titel';
  end if;
  if p_ende_zeit is not null and (p_beginn_zeit is null or p_ende_zeit <= p_beginn_zeit) then
    raise exception 'Die Endzeit muss nach der Beginnzeit liegen';
  end if;
  if p_rueckmeldung_erforderlich and p_rueckmeldung_bis is not null and p_rueckmeldung_bis > p_datum then
    raise exception 'Die Rueckmeldefrist darf nicht nach dem Termin liegen';
  end if;

  if p_termin_id is null then
    insert into termine (
      verein_id, titel, datum, beschreibung, oeffentlich, sichtbarkeit,
      beginn_zeit, ende_zeit, ort, art, pflicht,
      rueckmeldung_bis, veranstalter, rueckmeldung_erforderlich, notiz_obmann
    ) values (
      v_verein, btrim(p_titel), p_datum, nullif(btrim(p_beschreibung), ''),
      v_sichtbarkeit = 'oeffentlich', v_sichtbarkeit,
      p_beginn_zeit, p_ende_zeit, nullif(btrim(p_ort), ''), p_art,
      coalesce(p_pflicht, false),
      case when p_rueckmeldung_erforderlich then p_rueckmeldung_bis else null end,
      p_veranstalter, coalesce(p_rueckmeldung_erforderlich, true),
      nullif(btrim(p_notiz_obmann), '')
    ) returning id into v_id;
  else
    update termine set
      titel = btrim(p_titel),
      datum = p_datum,
      beschreibung = nullif(btrim(p_beschreibung), ''),
      sichtbarkeit = v_sichtbarkeit,
      oeffentlich = v_sichtbarkeit = 'oeffentlich',
      beginn_zeit = p_beginn_zeit,
      ende_zeit = p_ende_zeit,
      ort = nullif(btrim(p_ort), ''),
      art = p_art,
      pflicht = coalesce(p_pflicht, false),
      rueckmeldung_bis = case when p_rueckmeldung_erforderlich then p_rueckmeldung_bis else null end,
      veranstalter = p_veranstalter,
      rueckmeldung_erforderlich = coalesce(p_rueckmeldung_erforderlich, true),
      notiz_obmann = nullif(btrim(p_notiz_obmann), '')
    where id = p_termin_id and verein_id = v_verein
    returning id into v_id;

    if v_id is null then
      raise exception 'Termin nicht gefunden';
    end if;
  end if;
  return v_id;
end;
$function$;

drop function if exists public.obmann_termine_mit_stand(text);
create function public.obmann_termine_mit_stand(p_passwort text)
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
    select r.termin_id,
           count(*) filter (where r.status = 'zu')::integer as zu,
           count(*) filter (where r.status = 'ab')::integer as ab
    from termin_rueckmeldungen r
    group by r.termin_id
  ) z on z.termin_id = t.id
  where t.verein_id = v_verein
  order by t.datum asc, t.beginn_zeit asc nulls last;
end;
$function$;

-- -------------------------------------------------------------------------
-- Aus Terminvorschlag/Terminsuche erzeugte Termine bekommen dieselbe
-- Sichtbarkeitswahl. Alte Aufrufer mit Bool bleiben kompatibel.
-- -------------------------------------------------------------------------

drop function if exists public.obmann_termin_vorschlag_status(text, uuid, text, text, boolean);
create function public.obmann_termin_vorschlag_status(
  p_passwort text,
  p_vorschlag_id uuid,
  p_status text,
  p_rueckmeldung text default null,
  p_oeffentlich boolean default false,
  p_sichtbarkeit text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid := public.obmann_verein(p_passwort);
  v termin_vorschlaege%rowtype;
  v_termin uuid;
  v_sichtbarkeit text := coalesce(
    p_sichtbarkeit,
    case when coalesce(p_oeffentlich, false) then 'oeffentlich' else 'nur_verein' end
  );
begin
  if p_status not in ('in_pruefung', 'angenommen', 'abgelehnt') then
    raise exception 'Ungueltiger Status';
  end if;
  if v_sichtbarkeit not in ('nur_app', 'nur_verein', 'oeffentlich') then
    raise exception 'Ungueltige Terminsichtbarkeit';
  end if;

  select * into v from termin_vorschlaege
  where id = p_vorschlag_id and verein_id = v_verein
  for update;
  if not found then raise exception 'Vorschlag nicht gefunden'; end if;

  if p_status = 'angenommen' and v.erstellter_termin_id is null then
    insert into termine(
      verein_id, titel, datum, beginn_zeit, ort, beschreibung,
      oeffentlich, sichtbarkeit
    ) values (
      v_verein, v.titel, v.datum, v.beginn_zeit, v.ort, v.begruendung,
      v_sichtbarkeit = 'oeffentlich', v_sichtbarkeit
    ) returning id into v_termin;
  else
    v_termin := v.erstellter_termin_id;
  end if;

  update termin_vorschlaege set
    status = p_status,
    obmann_rueckmeldung = nullif(btrim(p_rueckmeldung), ''),
    erstellter_termin_id = v_termin,
    bearbeitet_am = now()
  where id = p_vorschlag_id;
  return v_termin;
end;
$function$;

drop function if exists public.obmann_terminfindung_entscheiden(text, uuid, uuid, boolean, text, boolean);
create function public.obmann_terminfindung_entscheiden(
  p_passwort text,
  p_findung_id uuid,
  p_vorschlag_id uuid,
  p_oeffentlich boolean default false,
  p_art text default 'event',
  p_pflicht boolean default false,
  p_sichtbarkeit text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_titel text;
  v_beschreibung text;
  v_status text;
  v_datum date;
  v_zeit time;
  v_ort text;
  v_termin uuid;
  v_sichtbarkeit text := coalesce(
    p_sichtbarkeit,
    case when coalesce(p_oeffentlich, false) then 'oeffentlich' else 'nur_verein' end
  );
begin
  v_verein := public.obmann_verein(p_passwort);
  if v_sichtbarkeit not in ('nur_app', 'nur_verein', 'oeffentlich') then
    raise exception 'Ungueltige Terminsichtbarkeit';
  end if;

  select f.titel, f.beschreibung, f.status
  into v_titel, v_beschreibung, v_status
  from terminfindungen f
  where f.id = p_findung_id and f.verein_id = v_verein;
  if v_titel is null then raise exception 'Terminsuche nicht gefunden'; end if;
  if v_status <> 'offen' then raise exception 'Diese Terminsuche ist bereits abgeschlossen'; end if;

  select v.datum, v.beginn_zeit, v.ort into v_datum, v_zeit, v_ort
  from terminfindung_vorschlaege v
  where v.id = p_vorschlag_id and v.findung_id = p_findung_id;
  if v_datum is null then raise exception 'Vorschlag gehoert nicht zu dieser Terminsuche'; end if;

  insert into termine (
    verein_id, titel, datum, beschreibung, oeffentlich, sichtbarkeit,
    beginn_zeit, ort, art, pflicht
  ) values (
    v_verein, v_titel, v_datum, v_beschreibung,
    v_sichtbarkeit = 'oeffentlich', v_sichtbarkeit,
    v_zeit, v_ort, coalesce(p_art, 'event'), coalesce(p_pflicht, false)
  ) returning id into v_termin;

  update terminfindungen set
    status = 'entschieden',
    gewaehlter_vorschlag = p_vorschlag_id,
    erstellter_termin = v_termin
  where id = p_findung_id;

  insert into termin_rueckmeldungen (termin_id, schiedsrichter_id, status)
  select v_termin, st.schiedsrichter_id, 'zu'
  from terminfindung_stimmen st
  where st.vorschlag_id = p_vorschlag_id and st.antwort = 'ja'
  on conflict do nothing;

  return v_termin;
end;
$function$;

-- -------------------------------------------------------------------------
-- Rechte: SECURITY DEFINER bleibt absichtlich bestehen, weil die Clients
-- nur ueber eng validierende RPCs auf RLS-gesperrte Tabellen zugreifen.
-- Jede Mitgliedsfunktion prueft Person+PIN, jede Obmannfunktion das Passwort.
-- -------------------------------------------------------------------------

revoke all on function public.oeffentliche_termine(text) from public;
revoke all on function public.oeffentliche_termine_alle(text) from public;
revoke all on function public.termine_fuer_schiri(uuid, text) from public;
revoke all on function public.termin_zusagen(uuid, text, uuid) from public;
revoke all on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) from public;
revoke all on function public.obmann_termin_speichern(text, text, date, boolean, text, boolean, boolean, text, text, uuid, text, time, time, text, date, text) from public;
revoke all on function public.obmann_termine_mit_stand(text) from public;
revoke all on function public.obmann_termin_vorschlag_status(text, uuid, text, text, boolean, text) from public;
revoke all on function public.obmann_terminfindung_entscheiden(text, uuid, uuid, boolean, text, boolean, text) from public;

grant execute on function public.oeffentliche_termine(text) to anon, authenticated;
grant execute on function public.oeffentliche_termine_alle(text) to anon, authenticated;
grant execute on function public.termine_fuer_schiri(uuid, text) to anon, authenticated;
grant execute on function public.termin_zusagen(uuid, text, uuid) to anon, authenticated;
grant execute on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.obmann_termin_speichern(text, text, date, boolean, text, boolean, boolean, text, text, uuid, text, time, time, text, date, text) to anon, authenticated;
grant execute on function public.obmann_termine_mit_stand(text) to anon, authenticated;
grant execute on function public.obmann_termin_vorschlag_status(text, uuid, text, text, boolean, text) to anon, authenticated;
grant execute on function public.obmann_terminfindung_entscheiden(text, uuid, uuid, boolean, text, boolean, text) to anon, authenticated;

comment on function public.termine_fuer_schiri(uuid, text) is
  'Liefert nur_verein und oeffentlich fuer den per PIN geprueften eigenen Verein. nur_app bleibt ausschliesslich in der Obmann-App.';
comment on function public.obmann_termin_speichern(text, text, date, boolean, text, boolean, boolean, text, text, uuid, text, time, time, text, date, text) is
  'Drei Sichtbarkeiten. p_oeffentlich bleibt fuer alte Clients; neue Clients setzen p_sichtbarkeit.';
