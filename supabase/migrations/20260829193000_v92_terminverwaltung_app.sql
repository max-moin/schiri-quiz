-- v92_terminverwaltung_app (29.08.2026)
--
-- Erweitert das in v90 begonnene Terminmodell fuer die Obmann-App, ohne
-- daneben eine zweite Terminverwaltung aufzubauen. Feste Termine bleiben in
-- public.termine; Terminfindungen aus v91 werden weiterhin erst nach der
-- Entscheidung in einen festen Termin ueberfuehrt.

alter table public.termine
  add column if not exists veranstalter text not null default 'verein',
  add column if not exists rueckmeldung_erforderlich boolean not null default true,
  add column if not exists notiz_obmann text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'termine_veranstalter_gueltig'
  ) then
    alter table public.termine
      add constraint termine_veranstalter_gueltig
      check (veranstalter in ('verein', 'stadtverband', 'landesverband', 'extern'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'termine_zeitspanne_gueltig'
  ) then
    alter table public.termine
      add constraint termine_zeitspanne_gueltig
      check (ende_zeit is null or (beginn_zeit is not null and ende_zeit > beginn_zeit));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'termine_rueckmeldefrist_gueltig'
  ) then
    alter table public.termine
      add constraint termine_rueckmeldefrist_gueltig
      check (rueckmeldung_bis is null or rueckmeldung_bis <= datum);
  end if;
end $$;

comment on column public.termine.veranstalter is
  'Organisatorische Herkunft: eigener Verein, Stadtverband, Landesverband oder extern.';
comment on column public.termine.rueckmeldung_erforderlich is
  'Steuert, ob die Schiedsrichter zu- oder absagen sollen. Pflicht ist davon getrennt.';
comment on column public.termine.notiz_obmann is
  'Nur fuer die Obmann-App; darf von keiner oeffentlichen oder Schiedsrichter-RPC ausgegeben werden.';

-- Eine ausdrueckliche Speicherfunktion fuer Neu und Bearbeiten. Anders als
-- obmann_termin_zusatzfelder_setzen aus v90 bedeutet NULL hier wirklich
-- "Feld leeren". Dadurch kann die App Ort, Zeiten, Frist und interne Notiz
-- zuverlaessig entfernen, ohne COALESCE-Schattenwerte zu hinterlassen.
create or replace function public.obmann_termin_speichern(
  p_passwort text,
  p_titel text,
  p_datum date,
  p_oeffentlich boolean,
  p_art text,
  p_pflicht boolean,
  p_rueckmeldung_erforderlich boolean,
  p_veranstalter text,
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
begin
  v_verein := obmann_verein(p_passwort);

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
      verein_id, titel, datum, beschreibung, oeffentlich,
      beginn_zeit, ende_zeit, ort, art, pflicht,
      rueckmeldung_bis, veranstalter, rueckmeldung_erforderlich,
      notiz_obmann
    ) values (
      v_verein, btrim(p_titel), p_datum, nullif(btrim(p_beschreibung), ''),
      coalesce(p_oeffentlich, false), p_beginn_zeit, p_ende_zeit,
      nullif(btrim(p_ort), ''), p_art, coalesce(p_pflicht, false),
      case when p_rueckmeldung_erforderlich then p_rueckmeldung_bis else null end,
      p_veranstalter, coalesce(p_rueckmeldung_erforderlich, true),
      nullif(btrim(p_notiz_obmann), '')
    ) returning id into v_id;
  else
    update termine set
      titel = btrim(p_titel),
      datum = p_datum,
      beschreibung = nullif(btrim(p_beschreibung), ''),
      oeffentlich = coalesce(p_oeffentlich, false),
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

-- Der Obmann kann eine Rueckmeldung stellvertretend korrigieren. "offen"
-- entfernt den bestehenden Eintrag; es wird kein dritter Status in der
-- Rueckmeldungstabelle erfunden.
create or replace function public.obmann_termin_rueckmeldung_setzen(
  p_passwort text,
  p_termin_id uuid,
  p_schiedsrichter_id uuid,
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
begin
  v_verein := obmann_verein(p_passwort);

  if not exists (
    select 1 from termine t
    where t.id = p_termin_id and t.verein_id = v_verein
      and t.rueckmeldung_erforderlich
  ) then
    raise exception 'Termin nicht gefunden oder keine Rueckmeldung vorgesehen';
  end if;
  if not exists (
    select 1 from schiedsrichter s
    where s.id = p_schiedsrichter_id and s.verein_id = v_verein
      and s.aktiv and not s.ist_test
  ) then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;
  if p_status not in ('zu', 'ab', 'offen') then
    raise exception 'Ungueltiger Rueckmeldestatus';
  end if;

  if p_status = 'offen' then
    delete from termin_rueckmeldungen
    where termin_id = p_termin_id and schiedsrichter_id = p_schiedsrichter_id;
    return;
  end if;

  if p_status = 'ab' and p_grund is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  insert into termin_rueckmeldungen (
    termin_id, schiedsrichter_id, status, grund, kommentar, gemeldet_am
  ) values (
    p_termin_id, p_schiedsrichter_id, p_status,
    case when p_status = 'ab' then p_grund else null end,
    nullif(btrim(p_kommentar), ''), now()
  )
  on conflict (termin_id, schiedsrichter_id) do update set
    status = excluded.status,
    grund = excluded.grund,
    kommentar = excluded.kommentar,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

-- Rueckgabetyp erweitert, daher vorher loeschen. Alte App-Versionen
-- ignorieren die neuen JSON-Felder; die neue App kann sie optional dekodieren.
drop function if exists public.obmann_termine_mit_stand(text);

create function public.obmann_termine_mit_stand(p_passwort text)
returns table (
  id uuid, titel text, datum date, beschreibung text, oeffentlich boolean,
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
  v_verein := obmann_verein(p_passwort);

  select count(*)::integer into v_aktive
  from schiedsrichter s
  where s.verein_id = v_verein and s.aktiv and not s.ist_test;

  return query
  select t.id, t.titel, t.datum, t.beschreibung, t.oeffentlich,
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

revoke all on function public.obmann_termin_speichern(text, text, date, boolean, text, boolean, boolean, text, uuid, text, time, time, text, date, text) from public;
revoke all on function public.obmann_termin_rueckmeldung_setzen(text, uuid, uuid, text, text, text) from public;
revoke all on function public.obmann_termine_mit_stand(text) from public;

grant execute on function public.obmann_termin_speichern(text, text, date, boolean, text, boolean, boolean, text, uuid, text, time, time, text, date, text) to anon, authenticated;
grant execute on function public.obmann_termin_rueckmeldung_setzen(text, uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.obmann_termine_mit_stand(text) to anon, authenticated;
