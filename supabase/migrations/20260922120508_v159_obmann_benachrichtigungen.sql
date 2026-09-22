-- v159: Kanalneutrale Benachrichtigungs-Outbox, zuerst E-Mail an den Obmann.
--
-- Fachliche Tabellen bleiben die Quelle der Wahrheit. Trigger legen nur einen
-- kleinen, datensparsamen Verteilhinweis an. Der externe Versand passiert
-- spaeter ueber eine Edge Function und niemals innerhalb einer Fachtransaktion.
-- Vorhandene Altdaten werden bewusst NICHT nachgetragen: Beim Aktivieren darf
-- kein alter Eingang als Nachrichtenflut auf dem Telefon erscheinen.

create extension if not exists pg_net with schema extensions;

create table if not exists public.benachrichtigungs_einstellungen (
  empfaenger_schluessel text primary key,
  email_aktiv boolean not null default false,
  aktivierte_typen text[] not null default array[
    'quiz.abgeschlossen',
    'frage_feedback.neu',
    'meldung.regelfall', 'meldung.vorfall', 'meldung.gespraech',
    'meldung.website', 'meldung.treff',
    'fragenvorschlag.neu', 'terminvorschlag.neu', 'termin.absage',
    'ausruestung.eingereicht', 'ausruestung.freigegeben',
    'ausruestung.abgelehnt', 'ausruestung.gekauft',
    'ausruestung.beleg_hochgeladen', 'ausruestung.zahlung_angewiesen',
    'ausruestung.geld_erhalten'
  ]::text[],
  aktualisiert_am timestamptz not null default now(),
  constraint benachrichtigung_empfaenger_schluessel_check
    check (empfaenger_schluessel ~ '^[a-z0-9_-]{1,40}$')
);

insert into public.benachrichtigungs_einstellungen
  (empfaenger_schluessel, email_aktiv)
values ('max', false)
on conflict (empfaenger_schluessel) do nothing;

create table if not exists public.benachrichtigungs_ereignisse (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  typ text not null,
  referenz_art text not null,
  referenz_id uuid not null,
  metadaten jsonb not null default '{}'::jsonb,
  schluessel text not null unique,
  erstellt_am timestamptz not null default now(),
  constraint benachrichtigung_typ_check
    check (typ ~ '^[a-z_]+\.[a-z_]+$'),
  constraint benachrichtigung_referenz_art_check
    check (referenz_art ~ '^[a-z_]{1,50}$'),
  constraint benachrichtigung_metadaten_objekt_check
    check (jsonb_typeof(metadaten) = 'object'),
  constraint benachrichtigung_schluessel_laenge_check
    check (char_length(schluessel) between 3 and 240)
);

create index if not exists benachrichtigungs_ereignisse_verein_zeit_idx
  on public.benachrichtigungs_ereignisse (verein_id, erstellt_am desc);

create table if not exists public.benachrichtigungs_auftraege (
  id uuid primary key default gen_random_uuid(),
  ereignis_id uuid not null
    references public.benachrichtigungs_ereignisse(id) on delete cascade,
  empfaenger_schluessel text not null
    references public.benachrichtigungs_einstellungen(empfaenger_schluessel),
  kanal text not null default 'email'
    check (kanal in ('email', 'web_push', 'apns')),
  status text not null default 'offen'
    check (status in ('offen', 'in_arbeit', 'fehlgeschlagen', 'versendet', 'aufgegeben')),
  versuche integer not null default 0 check (versuche between 0 and 20),
  naechster_versuch_am timestamptz not null default now(),
  gesperrt_bis timestamptz,
  provider_id text,
  letzter_fehlercode text,
  erstellt_am timestamptz not null default now(),
  versendet_am timestamptz,
  aktualisiert_am timestamptz not null default now(),
  unique (ereignis_id, empfaenger_schluessel, kanal)
);

create index if not exists benachrichtigungs_auftraege_dispatch_idx
  on public.benachrichtigungs_auftraege
    (naechster_versuch_am, erstellt_am)
  where status in ('offen', 'fehlgeschlagen', 'in_arbeit');

alter table public.benachrichtigungs_einstellungen enable row level security;
alter table public.benachrichtigungs_ereignisse enable row level security;
alter table public.benachrichtigungs_auftraege enable row level security;

revoke all on table public.benachrichtigungs_einstellungen from public, anon, authenticated;
revoke all on table public.benachrichtigungs_ereignisse from public, anon, authenticated;
revoke all on table public.benachrichtigungs_auftraege from public, anon, authenticated;
grant select, insert, update, delete on table public.benachrichtigungs_einstellungen to service_role;
grant select, insert, update, delete on table public.benachrichtigungs_ereignisse to service_role;
grant select, insert, update, delete on table public.benachrichtigungs_auftraege to service_role;

-- Vollstaendige Namen verlassen die Datenbank fuer diesen Kanal nicht. Bereits
-- abgekuerzte Anzeigenamen bleiben erhalten; sonst wird nur der erste Vorname
-- plus Anfangsbuchstabe des letzten Namens verwendet.
create or replace function public.benachrichtigung_kurzname(p_name text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_erstes text;
  v_letztes text;
begin
  if v_name = '' then return null; end if;
  if right(v_name, 1) = '.' then return left(v_name, 60); end if;
  if position(' ' in v_name) = 0 then return left(v_name, 60); end if;
  v_erstes := split_part(v_name, ' ', 1);
  v_letztes := regexp_replace(v_name, '^.*\s', '');
  return left(v_erstes || ' ' || left(v_letztes, 1) || '.', 60);
end;
$function$;

revoke all on function public.benachrichtigung_kurzname(text)
  from public, anon, authenticated;
grant execute on function public.benachrichtigung_kurzname(text) to service_role;

-- Idempotenz besteht auf zwei Ebenen: fachlicher Schluessel am Ereignis und
-- Ereignis/Empfaenger/Kanal am Auftrag. Reload, Doppel-Tap und Retry bleiben
-- deshalb jeweils genau eine Nachricht.
create or replace function public.benachrichtigung_einreihen(
  p_verein_id uuid,
  p_typ text,
  p_referenz_art text,
  p_referenz_id uuid,
  p_schluessel text,
  p_metadaten jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ereignis uuid;
begin
  if p_verein_id is null or p_referenz_id is null then
    raise exception 'Benachrichtigung braucht Verein und Referenz.';
  end if;

  insert into public.benachrichtigungs_ereignisse
    (verein_id, typ, referenz_art, referenz_id, metadaten, schluessel)
  values
    (p_verein_id, p_typ, p_referenz_art, p_referenz_id,
     coalesce(p_metadaten, '{}'::jsonb), p_schluessel)
  on conflict (schluessel) do nothing
  returning id into v_ereignis;

  if v_ereignis is null then
    select e.id into v_ereignis
      from public.benachrichtigungs_ereignisse e
     where e.schluessel = p_schluessel;
  end if;

  insert into public.benachrichtigungs_auftraege
    (ereignis_id, empfaenger_schluessel, kanal)
  select v_ereignis, k.empfaenger_schluessel, 'email'
    from public.benachrichtigungs_einstellungen k
   where k.empfaenger_schluessel = 'max'
     and k.email_aktiv
     and p_typ = any(k.aktivierte_typen)
  on conflict (ereignis_id, empfaenger_schluessel, kanal) do nothing;

  return v_ereignis;
end;
$function$;

revoke all on function public.benachrichtigung_einreihen(uuid,text,text,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.benachrichtigung_einreihen(uuid,text,text,uuid,text,jsonb)
  to service_role;

-- Atomarer Claim mit Lease. Parallele Cron-Laeufe koennen denselben Auftrag
-- nicht doppelt nehmen; eine abgebrochene Function gibt ihn nach 5 Minuten
-- automatisch wieder frei.
create or replace function public.benachrichtigung_auftraege_beanspruchen(
  p_limit integer default 10
)
returns table(
  auftrag_id uuid,
  ereignis_id uuid,
  typ text,
  metadaten jsonb,
  versuch integer,
  idempotenzschluessel text
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  return query
  with kandidaten as (
    select a.id
      from public.benachrichtigungs_auftraege a
      join public.benachrichtigungs_einstellungen k
        on k.empfaenger_schluessel = a.empfaenger_schluessel
     where k.email_aktiv
       and a.kanal = 'email'
       and a.status in ('offen', 'fehlgeschlagen', 'in_arbeit')
       and a.naechster_versuch_am <= now()
       and (a.gesperrt_bis is null or a.gesperrt_bis < now())
       and a.versuche < 5
     order by a.erstellt_am
     for update of a skip locked
     limit v_limit
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a
       set status = 'in_arbeit',
           versuche = a.versuche + 1,
           gesperrt_bis = now() + interval '5 minutes',
           aktualisiert_am = now()
      from kandidaten k
     where a.id = k.id
     returning a.id, a.ereignis_id, a.versuche
  )
  select b.id, e.id, e.typ, e.metadaten, b.versuche,
         'obmann-email/' || b.id::text
    from beansprucht b
    join public.benachrichtigungs_ereignisse e on e.id = b.ereignis_id;
end;
$function$;

create or replace function public.benachrichtigung_auftrag_versendet(
  p_auftrag_id uuid,
  p_provider_id text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.benachrichtigungs_auftraege a
     set status = 'versendet',
         provider_id = left(nullif(btrim(coalesce(p_provider_id, '')), ''), 200),
         letzter_fehlercode = null,
         gesperrt_bis = null,
         versendet_am = now(),
         aktualisiert_am = now()
   where a.id = p_auftrag_id and a.status = 'in_arbeit';
  if not found then raise exception 'Versandauftrag nicht gefunden.'; end if;
end;
$function$;

create or replace function public.benachrichtigung_auftrag_fehlgeschlagen(
  p_auftrag_id uuid,
  p_fehlercode text,
  p_endgueltig boolean default false
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_versuche integer;
begin
  select a.versuche into v_versuche
    from public.benachrichtigungs_auftraege a
   where a.id = p_auftrag_id
   for update;
  if v_versuche is null then raise exception 'Versandauftrag nicht gefunden.'; end if;

  update public.benachrichtigungs_auftraege a
     set status = case when coalesce(p_endgueltig, false) or v_versuche >= 5
                       then 'aufgegeben' else 'fehlgeschlagen' end,
         letzter_fehlercode = left(
           regexp_replace(coalesce(p_fehlercode, 'unbekannt'), '[^a-zA-Z0-9_.:-]', '_', 'g'),
           100),
         naechster_versuch_am = now() + case least(v_versuche, 5)
           when 1 then interval '1 minute'
           when 2 then interval '5 minutes'
           when 3 then interval '15 minutes'
           when 4 then interval '1 hour'
           else interval '6 hours' end,
         gesperrt_bis = null,
         aktualisiert_am = now()
   where a.id = p_auftrag_id;
end;
$function$;

revoke all on function public.benachrichtigung_auftraege_beanspruchen(integer)
  from public, anon, authenticated;
revoke all on function public.benachrichtigung_auftrag_versendet(uuid,text)
  from public, anon, authenticated;
revoke all on function public.benachrichtigung_auftrag_fehlgeschlagen(uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.benachrichtigung_auftraege_beanspruchen(integer)
  to service_role;
grant execute on function public.benachrichtigung_auftrag_versendet(uuid,text)
  to service_role;
grant execute on function public.benachrichtigung_auftrag_fehlgeschlagen(uuid,text,boolean)
  to service_role;

-- -------------------------------------------------------------------
-- Fachliche Ausloeser. Keine Funktion reagiert auf Lesen, Erledigen,
-- Filtern oder Reload. Nur ein neuer fachlicher Zustand erzeugt ein Ereignis.
-- -------------------------------------------------------------------

create or replace function public.benachrichtigung_ausruestung_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_typ text;
  v_name text;
begin
  if new.akteur_rolle = 'schiri' and new.schritt in
      ('eingereicht', 'gekauft', 'beleg_hochgeladen', 'geld_erhalten') then
    v_typ := 'ausruestung.' || new.schritt;
  elsif new.akteur_rolle = 'vorstand' and new.schritt in
      ('freigegeben', 'abgelehnt', 'zahlung_angewiesen') then
    v_typ := 'ausruestung.' || new.schritt;
  else
    return new;
  end if;

  select public.benachrichtigung_kurzname(s.name) into v_name
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = new.anfrage_id;

  perform public.benachrichtigung_einreihen(
    new.verein_id, v_typ, 'ausruestungsanfrage', new.anfrage_id,
    'ausruestung:' || new.schluessel,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_ausruestung_trigger on public.ausruestung_ereignisse;
create trigger benachrichtigung_ausruestung_trigger
  after insert on public.ausruestung_ereignisse
  for each row execute function public.benachrichtigung_ausruestung_trigger();

create or replace function public.benachrichtigung_quiz_pruefen_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_schiri public.schiedsrichter%rowtype;
  v_runde record;
  v_soll integer;
  v_ist integer;
begin
  select * into v_schiri from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  if not found or v_schiri.ist_test then return new; end if;

  for v_runde in
    select distinct rf.runde_id
      from public.runden_fragen rf
     where rf.verein_id = v_schiri.verein_id and rf.frage_id = new.frage_id
  loop
    select count(*)::integer into v_soll
      from public.runden_fragen rf
      join public.fragen f on f.id = rf.frage_id and f.aktiv
     where rf.verein_id = v_schiri.verein_id and rf.runde_id = v_runde.runde_id;

    select count(distinct a.frage_id)::integer into v_ist
      from public.antworten a
      join public.runden_fragen rf
        on rf.frage_id = a.frage_id
       and rf.verein_id = v_schiri.verein_id
       and rf.runde_id = v_runde.runde_id
      join public.fragen f on f.id = a.frage_id and f.aktiv
     where a.schiedsrichter_id = new.schiedsrichter_id;

    if v_soll > 0 and v_ist >= v_soll then
      perform public.benachrichtigung_einreihen(
        v_schiri.verein_id, 'quiz.abgeschlossen', 'quizrunde', v_runde.runde_id,
        'quiz:' || new.schiedsrichter_id::text || ':' || v_runde.runde_id::text,
        jsonb_build_object(
          'anzeigename', public.benachrichtigung_kurzname(v_schiri.name),
          'schiedsrichter_id', new.schiedsrichter_id::text));
    end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_quiz_pruefen_trigger on public.antworten;
create trigger benachrichtigung_quiz_pruefen_trigger
  after insert on public.antworten
  for each row execute function public.benachrichtigung_quiz_pruefen_trigger();

create or replace function public.benachrichtigung_frage_feedback_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein uuid;
  v_name text;
begin
  select m.verein_id, public.benachrichtigung_kurzname(s.name)
    into v_verein, v_name
    from public.frage_meldungen m
    left join public.schiedsrichter s on s.id = m.schiedsrichter_id
   where m.id = new.meldung_id;
  perform public.benachrichtigung_einreihen(
    v_verein, 'frage_feedback.neu', 'frage_feedback', new.id,
    'frage_feedback:' || new.id::text,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_frage_feedback_trigger on public.frage_meldung_eintraege;
create trigger benachrichtigung_frage_feedback_trigger
  after insert on public.frage_meldung_eintraege
  for each row execute function public.benachrichtigung_frage_feedback_trigger();

create or replace function public.benachrichtigung_meldung_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_name text;
begin
  if new.schiedsrichter_id is not null and not new.anonym then
    select public.benachrichtigung_kurzname(s.name) into v_name
      from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  end if;
  perform public.benachrichtigung_einreihen(
    new.verein_id, 'meldung.' || new.art, 'meldung', new.id,
    'meldung:' || new.id::text,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_meldung_trigger on public.meldungen;
create trigger benachrichtigung_meldung_trigger
  after insert on public.meldungen
  for each row execute function public.benachrichtigung_meldung_trigger();

create or replace function public.benachrichtigung_fragenvorschlag_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_name text;
begin
  if new.status <> 'eingereicht' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'eingereicht' then return new; end if;
  select public.benachrichtigung_kurzname(s.name) into v_name
    from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  perform public.benachrichtigung_einreihen(
    new.verein_id, 'fragenvorschlag.neu', 'fragenvorschlag', new.id,
    'fragenvorschlag:' || new.id::text || ':eingereicht',
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_fragenvorschlag_trigger on public.fragenvorschlaege;
create trigger benachrichtigung_fragenvorschlag_trigger
  after insert or update of status on public.fragenvorschlaege
  for each row execute function public.benachrichtigung_fragenvorschlag_trigger();

create or replace function public.benachrichtigung_terminvorschlag_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_name text;
begin
  if new.status <> 'eingereicht' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'eingereicht' then return new; end if;
  select public.benachrichtigung_kurzname(s.name) into v_name
    from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  perform public.benachrichtigung_einreihen(
    new.verein_id, 'terminvorschlag.neu', 'terminvorschlag', new.id,
    'terminvorschlag:' || new.id::text || ':eingereicht',
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_terminvorschlag_trigger on public.termin_vorschlaege;
create trigger benachrichtigung_terminvorschlag_trigger
  after insert or update of status on public.termin_vorschlaege
  for each row execute function public.benachrichtigung_terminvorschlag_trigger();

create or replace function public.benachrichtigung_terminabsage_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein uuid;
  v_name text;
begin
  if new.status <> 'ab' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'ab' then return new; end if;
  select t.verein_id, public.benachrichtigung_kurzname(s.name)
    into v_verein, v_name
    from public.termine t
    join public.schiedsrichter s on s.id = new.schiedsrichter_id
   where t.id = new.termin_id;
  -- Die Mail geht nur an den veranstaltenden Verein. Antworten fremder
  -- Vereine auf oeffentliche Termine werden nicht in Max' Kanal gemischt.
  if not exists (
    select 1 from public.schiedsrichter s
     where s.id = new.schiedsrichter_id and s.verein_id = v_verein
  ) then return new; end if;
  perform public.benachrichtigung_einreihen(
    v_verein, 'termin.absage', 'termin_rueckmeldung', new.id,
    'termin_absage:' || new.id::text || ':' ||
      floor(extract(epoch from new.gemeldet_am) * 1000)::bigint::text,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name)));
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_terminabsage_trigger on public.termin_rueckmeldungen;
create trigger benachrichtigung_terminabsage_trigger
  after insert or update of status on public.termin_rueckmeldungen
  for each row execute function public.benachrichtigung_terminabsage_trigger();

-- Alle Triggerfunktionen sind reine interne Bausteine.
revoke all on function public.benachrichtigung_ausruestung_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_quiz_pruefen_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_frage_feedback_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_meldung_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_fragenvorschlag_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_terminvorschlag_trigger() from public, anon, authenticated;
revoke all on function public.benachrichtigung_terminabsage_trigger() from public, anon, authenticated;

comment on table public.benachrichtigungs_ereignisse is
  'Datensparsames Ereignisbrett. Keine Meldungstexte, Gruende, Betraege, Bilder oder PINs.';
comment on table public.benachrichtigungs_auftraege is
  'Idempotente Versand-Outbox. Provider-Zugangsdaten liegen ausschliesslich als Edge-Function-Secrets vor.';
