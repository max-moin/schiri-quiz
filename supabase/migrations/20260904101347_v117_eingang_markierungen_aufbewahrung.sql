-- v117: sparsame Quiz-Markierung, Löschung offener Meldungen und
-- bestätigte 30-Tage-Aufbewahrung. Kein bestehender Inhalt wird jetzt gelöscht.
create or replace function public.frage_melde_markierungen(p_schiedsrichter_id uuid, p_pin text)
returns table(frage_id uuid, status text)
language plpgsql stable security definer set search_path = public as $$
declare v_verein uuid;
begin
  v_verein := schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
  select distinct fm.frage_id, 'offen'::text
  from frage_meldungen fm
  join runden_fragen rf on rf.frage_id = fm.frage_id and rf.verein_id = v_verein
  join runden r on r.id = rf.runde_id
  where fm.verein_id = v_verein and fm.status not in ('erledigt', 'abgelehnt')
    and r.startet_am <= now() and r.endet_am > now()
    and exists (
      select 1 from frage_meldung_eintraege e
      where e.meldung_id = fm.id and not e.erledigt
        and (e.kategorie = 'video_technik'
          or (fm.schiedsrichter_id = p_schiedsrichter_id and e.erstellt_am >= r.startet_am))
    );
end;
$$;
revoke all on function public.frage_melde_markierungen(uuid,text) from public;
grant execute on function public.frage_melde_markierungen(uuid,text) to anon, authenticated;

create or replace function public.obmann_eingang_loeschen(p_passwort text, p_art text, p_id uuid)
returns table(art text, geloescht boolean, kind_eintraege integer)
language plpgsql security definer set search_path = public as $$
declare v_verein uuid; v_kinder integer := 0; v_treffer integer;
begin
  v_verein := obmann_verein(p_passwort);
  if p_art = 'meldung' then
    delete from meldungen m where m.id = p_id and m.verein_id = v_verein;
  elsif p_art = 'frage_meldung' then
    select count(*)::integer into v_kinder from frage_meldung_eintraege e
      join frage_meldungen fm on fm.id = e.meldung_id
      where fm.id = p_id and fm.verein_id = v_verein;
    delete from frage_meldungen fm where fm.id = p_id and fm.verein_id = v_verein;
  else
    raise exception 'Nur Meldeboegen und Fragefeedback werden hier geloescht';
  end if;
  get diagnostics v_treffer = row_count;
  if v_treffer = 0 then raise exception 'Kein passender Eintrag in diesem Verein gefunden'; end if;
  return query select p_art, true, v_kinder;
end;
$$;
revoke all on function public.obmann_eingang_loeschen(text,text,uuid) from public;
grant execute on function public.obmann_eingang_loeschen(text,text,uuid) to anon, authenticated;

-- Ausschließlich Meldebögen und Fragefeedback, keine Quiz-/Termindaten.
create table public.eingang_einstellungen (
  verein_id uuid primary key references public.vereine(id) on delete cascade,
  tage integer not null default 30 check (tage between 1 and 730),
  automatisch boolean not null default true
);
alter table public.eingang_einstellungen enable row level security;
revoke all on public.eingang_einstellungen from public, anon, authenticated;
comment on table public.eingang_einstellungen is 'Vereinsinterne Aufbewahrung für Meldebögen und Fragefeedback; ausschließlich über Obmann-RPCs. Standard 30 Tage, täglich automatisch.';

alter table public.frage_meldungen add column aufbewahren_bis date;
create index frage_meldungen_aufbewahren_idx on public.frage_meldungen(verein_id,aufbewahren_bis);

-- Max hat den Umfang ausdrücklich bestätigt: alle bestehenden Meldungen
-- erhalten 30 Tage AB UMSTELLUNG, niemals rückwirkend ab Erstelldatum.
insert into public.eingang_einstellungen(verein_id,tage,automatisch)
  select id,30,true from public.vereine;
update public.meldungen set aufbewahren_bis = (now() at time zone 'Europe/Berlin')::date + 30;
update public.frage_meldungen set aufbewahren_bis = (now() at time zone 'Europe/Berlin')::date + 30;

create function public.eingang_frist_neuer_eintrag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into eingang_einstellungen(verein_id) values(new.verein_id) on conflict do nothing;
  new.aufbewahren_bis := (now() at time zone 'Europe/Berlin')::date
    + coalesce((select e.tage from eingang_einstellungen e where e.verein_id = new.verein_id), 30);
  return new;
end;
$$;
revoke all on function public.eingang_frist_neuer_eintrag() from public,anon,authenticated;
create trigger meldungen_standardfrist before insert on public.meldungen
  for each row execute function public.eingang_frist_neuer_eintrag();
create trigger frage_meldungen_standardfrist before insert on public.frage_meldungen
  for each row execute function public.eingang_frist_neuer_eintrag();

create function public.obmann_eingang_einstellungen(p_passwort text, p_tage integer default null, p_automatisch boolean default null)
returns table(tage integer, automatisch boolean)
language plpgsql security definer set search_path = public as $$
declare v_verein uuid; v_war_aktiv boolean; v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  v_verein := obmann_verein(p_passwort);
  if (p_tage is null) <> (p_automatisch is null) then raise exception 'Beide Einstellungen erforderlich'; end if;
  if p_tage is not null then
    if p_tage not between 1 and 730 then raise exception 'Frist muss 1 bis 730 Tage betragen'; end if;
    -- Serialisiert parallele Änderungen desselben Vereins.
    insert into eingang_einstellungen(verein_id) values(v_verein) on conflict do nothing;
    select e.automatisch into v_war_aktiv from eingang_einstellungen e where e.verein_id = v_verein for update;
    if p_automatisch and not v_war_aktiv then
      -- Aktivierung löscht niemals sofort alte Inhalte. Längere bereits
      -- hinterlegte Fristen bleiben erhalten; andere erhalten den vollen Puffer.
      update meldungen m set aufbewahren_bis = greatest(m.aufbewahren_bis, v_heute + p_tage) where m.verein_id = v_verein;
      update frage_meldungen fm set aufbewahren_bis = greatest(fm.aufbewahren_bis, v_heute + p_tage) where fm.verein_id = v_verein;
    end if;
    update eingang_einstellungen e set tage = p_tage, automatisch = p_automatisch where e.verein_id = v_verein;
  end if;
  return query select coalesce(e.tage,30), coalesce(e.automatisch,true)
    from (select 1) basis left join eingang_einstellungen e on e.verein_id = v_verein;
end;
$$;
revoke all on function public.obmann_eingang_einstellungen(text,integer,boolean) from public;
grant execute on function public.obmann_eingang_einstellungen(text,integer,boolean) to anon,authenticated;

create function public.obmann_eingang_frist(p_passwort text, p_art text, p_id uuid, p_bis date default null)
returns table(aufbewahren_bis date, automatisch boolean)
language plpgsql security definer set search_path = public as $$
declare v_verein uuid; v_bis date; v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  v_verein := obmann_verein(p_passwort);
  if p_bis is not null and p_bis <= v_heute then raise exception 'Frist muss in der Zukunft liegen'; end if;
  if p_art = 'meldung' then
    select m.aufbewahren_bis into v_bis from meldungen m where m.id = p_id and m.verein_id = v_verein;
    if not found then raise exception 'Eintrag nicht gefunden'; end if;
    if p_bis is not null then update meldungen m set aufbewahren_bis = p_bis where m.id = p_id and m.verein_id = v_verein; end if;
  elsif p_art = 'frage_meldung' then
    select fm.aufbewahren_bis into v_bis from frage_meldungen fm where fm.id = p_id and fm.verein_id = v_verein;
    if not found then raise exception 'Eintrag nicht gefunden'; end if;
    if p_bis is not null then update frage_meldungen fm set aufbewahren_bis = p_bis where fm.id = p_id and fm.verein_id = v_verein; end if;
  else raise exception 'Frist nur fuer Meldeboegen und Fragefeedback'; end if;
  return query select coalesce(p_bis,v_bis), coalesce((select e.automatisch from eingang_einstellungen e where e.verein_id = v_verein),false);
end;
$$;
revoke all on function public.obmann_eingang_frist(text,text,uuid,date) from public;
grant execute on function public.obmann_eingang_frist(text,text,uuid,date) to anon,authenticated;

-- Der tägliche Lauf bleibt ohne aktivierten Verein wirkungslos.
create function public.eingang_abgelaufen_loeschen()
returns void language plpgsql security definer set search_path = public as $$
declare v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  delete from meldungen m using eingang_einstellungen e
    where e.verein_id=m.verein_id and e.automatisch and m.aufbewahren_bis <= v_heute;
  delete from frage_meldungen fm using eingang_einstellungen e
    where e.verein_id=fm.verein_id and e.automatisch and fm.aufbewahren_bis <= v_heute;
end;
$$;
revoke all on function public.eingang_abgelaufen_loeschen() from public,anon,authenticated;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('eingang-aufbewahrung', '30 3 * * *', 'select public.eingang_abgelaufen_loeschen()');
