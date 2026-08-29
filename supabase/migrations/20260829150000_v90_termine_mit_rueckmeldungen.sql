-- v90_termine_mit_rueckmeldungen (29.08.2026)
--
-- Max will, dass Schiedsrichter auf der Vereinsseite zu einem Termin
-- zu- oder absagen koennen, bei einer Absage mit Grund. Dafuer fehlt
-- bisher alles: die Termin-Tabelle kennt weder Uhrzeit noch Ort, die
-- oeffentliche Abfrage gibt nicht einmal eine ID heraus (man koennte
-- also gar nicht auf einen einzelnen Termin verweisen), und eine
-- Tabelle fuer Rueckmeldungen gibt es nicht.
--
-- Aufgabenteilung bleibt wie am 25.08.2026 festgehalten: Anlegen,
-- Aendern und Freigeben von Terminen geschieht ALLEIN in der Swift-App.
-- Die Website bekommt nur Ansehen und Zu-/Absagen - also genau das, was
-- die Schiedsrichter tun und was in der App gar nicht geht. Keine
-- Funktion in beiden Oberflaechen.
--
-- Die neuen Spalten sind bewusst alle nullbar beziehungsweise mit
-- Vorgabewert: die Swift-App kennt sie noch nicht und schickt sie nicht
-- mit. Sie muss deshalb nicht am selben Tag nachziehen, und kein
-- bestehender Aufruf bricht.
--
-- Uhrzeit und Ort als eigene Spalten sind kein Schoenheitsthema. Heute
-- steht bei den echten Terminen "Sportpark Ostra · 19:00 Uhr" als
-- Fliesstext in der Beschreibung. Derselbe Befund steht seit dem
-- 26.08.2026 im Backlog beim Kalenderabo: "Terminmodell zuerst um
-- Beginn, Ende und Ort erweitern; Beschreibung nicht als Ersatz fuer
-- strukturierte Uhrzeiten auslesen."

-- ============================================================
--  1. Termine um die fehlenden Angaben erweitern
-- ============================================================

alter table public.termine
  add column if not exists beginn_zeit      time,
  add column if not exists ende_zeit        time,
  add column if not exists ort              text,
  add column if not exists art              text not null default 'sonstiges',
  add column if not exists pflicht          boolean not null default false,
  add column if not exists rueckmeldung_bis date;

-- Die Art steuert nur die Wortmarke in der Anzeige. Eine feste Liste
-- statt freiem Text, damit die Anzeige nicht raten muss - und damit ein
-- Tippfehler in der App laut scheitert statt still eine neue Kategorie
-- zu erfinden.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'termine_art_gueltig'
  ) then
    alter table public.termine
      add constraint termine_art_gueltig
      check (art in ('lehrabend', 'lehrgang', 'treff', 'event', 'sonstiges'));
  end if;
end $$;

comment on column public.termine.beginn_zeit is
  'Beginn als echte Uhrzeit. NULL heisst "keine Zeit hinterlegt" - dann zeigt die Website nur das Datum.';
comment on column public.termine.pflicht is
  'Pflichttermin. Steuert nur die Darstellung und den Nachdruck der Erinnerung, erzwingt nichts.';
comment on column public.termine.rueckmeldung_bis is
  'Letzter Tag fuer eine Zu-/Absage. NULL heisst: bis zum Termin selbst.';

-- ============================================================
--  2. Tabelle fuer die Rueckmeldungen
-- ============================================================

create table if not exists public.termin_rueckmeldungen (
  termin_id         uuid        not null references public.termine(id) on delete cascade,
  schiedsrichter_id uuid        not null references public.schiedsrichter(id) on delete cascade,
  status            text        not null,
  grund             text,
  kommentar         text,
  gemeldet_am       timestamptz not null default now(),
  primary key (termin_id, schiedsrichter_id),

  constraint rueckmeldung_status_gueltig
    check (status in ('zu', 'ab')),

  -- Feste Liste statt Freitext. Max am 29.08.2026: aus "dreimal eigene
  -- Ansetzung" kann er etwas ableiten, aus "dreimal keine Zeit" nicht.
  constraint rueckmeldung_grund_gueltig
    check (grund is null or grund in
      ('arbeit', 'eigenes_spiel', 'urlaub', 'krank', 'familie', 'sonstiges')),

  -- Max' Entscheidung vom 29.08.2026: eine Absage braucht einen Grund,
  -- der freie Text bleibt freiwillig. Die Regel steht hier und nicht nur
  -- in der Oberflaeche - sonst koennte ein direkter Aufruf sie umgehen
  -- und es entstuenden stille Absagen ohne Grund, die in der Auswertung
  -- als Luecke auftauchen statt als Fehler.
  constraint absage_braucht_grund
    check (status = 'zu' or grund is not null)
);

comment on table public.termin_rueckmeldungen is
  'Zu- und Absagen der Schiedsrichter zu einem Termin. Ein Eintrag je Person und Termin; erneutes Melden ueberschreibt.';

-- RLS an, absichtlich OHNE Policy - genau wie bei "termine". Von aussen
-- ist die Tabelle damit weder les- noch schreibbar; jeder Zugriff laeuft
-- ueber die SECURITY-DEFINER-Funktionen weiter unten, die vorher PIN
-- beziehungsweise Obmann-Passwort pruefen.
alter table public.termin_rueckmeldungen enable row level security;

create index if not exists termin_rueckmeldungen_termin_idx
  on public.termin_rueckmeldungen (termin_id);

-- ============================================================
--  3. Oeffentliche Anzeige (ohne Anmeldung)
-- ============================================================
--
-- "oeffentliche_termine" wird geloescht und neu angelegt, nicht ersetzt:
-- der Rueckgabetyp aendert sich. Ein "create or replace" wuerde eine
-- zweite Fassung daneben stellen und PostgREST haette bei jedem Aufruf
-- die Wahl - der Fehler, den dieses Projekt schon mehrfach hatte
-- (v15b, v51b, v59d, zuletzt beschrieben in v85).
--
-- Neu ist vor allem die ID: ohne sie gibt es nichts, worauf ein
-- Terminlink zeigen koennte.
--
-- Die drei Bedingungen bleiben unveraendert und sind der eigentliche
-- Schutz: nur freigegebene, nur kuenftige, nur die dieses Vereins.
-- Die Obergrenze steht jetzt bei 4 statt 6, weil die Startseite laut
-- Max' Entscheidung die naechsten vier zeigt.

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
    and t.oeffentlich
    -- Ortszeit statt UTC: current_date waere zwischen 00:00 und 02:00
    -- deutscher Zeit noch der Vortag, ein gestriger Termin bliebe stehen.
    and t.datum >= (now() at time zone 'Europe/Berlin')::date
  order by t.datum
  limit 4;
$function$;

-- Die vollstaendige Liste fuer die eigene Terminseite. Anders als oben
-- auch vergangene Termine, damit man nachschlagen kann, wann etwas war -
-- aber weiterhin nur freigegebene dieses Vereins. Die Obergrenze
-- verhindert, dass die Seite nach Jahren unbemerkt riesig wird.
create or replace function public.oeffentliche_termine_alle(p_seitenschluessel text)
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
    and t.oeffentlich
  order by t.datum desc
  limit 120;
$function$;

-- ============================================================
--  4. Angemeldete Sicht und Rueckmeldung
-- ============================================================
--
-- Ab hier wird die PIN geprueft - nach demselben Muster wie alle
-- anderen schiri_*-Funktionen. Der Termin muss ausserdem zum Verein der
-- Person gehoeren; sonst koennte man mit einer gueltigen PIN in einem
-- Verein zu Terminen eines anderen Vereins zusagen.

create or replace function public.termine_fuer_schiri(
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
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN ungueltig';
  end if;

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
  -- Angemeldete Mitglieder sehen auch Termine, die nicht oeffentlich
  -- freigegeben sind - das ist der Sinn der Anmeldung. Die
  -- Datenschutz-Auflage ("keine vereinsinternen Termine auf der
  -- OEFFENTLICHEN Seite", Backlog) bleibt gewahrt: die Funktionen
  -- oben ohne PIN filtern weiterhin auf t.oeffentlich.
  where t.verein_id = v_verein
  order by t.datum desc
  limit 120;
end;
$function$;

-- Wer hat zugesagt. Max' Entscheidung vom 29.08.2026: Namen der
-- Zusagen sehen die anderen, Absagegruende nur er. Deshalb gibt diese
-- Funktion ausschliesslich Zusagen heraus und ist zusaetzlich hinter der
-- PIN - fuer nicht angemeldete Besucher der Seite sind die Namen der
-- Vereinsmitglieder nichts.
create or replace function public.termin_zusagen(
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
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN ungueltig';
  end if;

  if not exists (
    select 1 from termine t where t.id = p_termin_id and t.verein_id = v_verein
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
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
  v_datum date;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN ungueltig';
  end if;

  select t.datum into v_datum
  from termine t where t.id = p_termin_id and t.verein_id = v_verein;
  if v_datum is null then
    raise exception 'Termin nicht gefunden';
  end if;

  -- Fuer einen vergangenen Termin nachtraeglich zuzusagen ergibt keinen
  -- Sinn und wuerde die Auswertung verfaelschen.
  if v_datum < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Termin liegt in der Vergangenheit';
  end if;

  if p_status not in ('zu', 'ab') then
    raise exception 'Ungueltiger Status: %', p_status;
  end if;

  -- Bei einer Zusage wird ein mitgeschickter Grund bewusst verworfen
  -- statt gespeichert: sonst bliebe der Grund einer frueheren Absage
  -- stehen, wenn jemand seine Meinung aendert, und stuende danach als
  -- "zugesagt wegen Krankheit" in deiner Uebersicht.
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

-- ============================================================
--  5. Fuer die Swift-App
-- ============================================================
--
-- Bewusst NEUE Funktionen statt Aenderungen an obmann_termine_liste,
-- obmann_termin_hinzufuegen und obmann_termin_bearbeiten. Wuerde ich
-- deren Signatur anfassen, muesste die App am selben Tag nachziehen -
-- und bis dahin liessen sich Termine gar nicht mehr bearbeiten
-- (PGRST202, siehe v85). So bleibt die App lauffaehig und kann die
-- neuen Funktionen uebernehmen, wann es passt.

create or replace function public.obmann_termin_zusatzfelder_setzen(
  p_passwort text,
  p_termin_id uuid,
  p_beginn_zeit time default null,
  p_ende_zeit time default null,
  p_ort text default null,
  p_art text default null,
  p_pflicht boolean default null,
  p_rueckmeldung_bis date default null
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

  update termine set
    -- null heisst durchgehend "nicht mitgeschickt, also so lassen".
    -- Dieselbe Regel wie bei oeffentlich in v85, und aus demselben
    -- Grund: eine aeltere App-Fassung darf nichts stillschweigend
    -- zuruecksetzen, nur weil sie ein Feld nicht kennt.
    beginn_zeit      = coalesce(p_beginn_zeit, beginn_zeit),
    ende_zeit        = coalesce(p_ende_zeit, ende_zeit),
    ort              = coalesce(p_ort, ort),
    art              = coalesce(p_art, art),
    pflicht          = coalesce(p_pflicht, pflicht),
    rueckmeldung_bis = coalesce(p_rueckmeldung_bis, rueckmeldung_bis)
  where id = p_termin_id and verein_id = v_verein;

  if not found then
    raise exception 'Termin nicht gefunden';
  end if;
end;
$function$;

-- Die Auswertung fuer das Dashboard: wer hat was gemeldet, und warum.
-- Hier - und nur hier - kommen die Absagegruende heraus.
create or replace function public.obmann_termin_rueckmeldungen(
  p_passwort text,
  p_termin_id uuid
)
returns table (
  schiedsrichter_id uuid, name text, status text,
  grund text, kommentar text, gemeldet_am timestamptz
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  if not exists (
    select 1 from termine t where t.id = p_termin_id and t.verein_id = v_verein
  ) then
    raise exception 'Termin nicht gefunden';
  end if;

  -- Von den aktiven Schiedsrichtern ausgehen, nicht von den
  -- Rueckmeldungen: sonst fehlen genau die Leute in der Liste, die noch
  -- gar nicht geantwortet haben - und das ist die Gruppe, wegen der man
  -- die Uebersicht ueberhaupt aufmacht.
  return query
  select s.id, s.name,
         coalesce(r.status, 'offen'), r.grund, r.kommentar, r.gemeldet_am
  from schiedsrichter s
  left join termin_rueckmeldungen r
    on r.schiedsrichter_id = s.id and r.termin_id = p_termin_id
  where s.verein_id = v_verein and s.aktiv and not s.ist_test
  order by
    case coalesce(r.status, 'offen') when 'offen' then 0 when 'ab' then 1 else 2 end,
    s.name;
end;
$function$;

-- Zaehlstand je Termin fuer die Uebersicht im Dashboard.
create or replace function public.obmann_termine_mit_stand(p_passwort text)
returns table (
  id uuid, titel text, datum date, beschreibung text, oeffentlich boolean,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date,
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
         t.rueckmeldung_bis,
         coalesce(z.zu, 0), coalesce(z.ab, 0),
         greatest(v_aktive - coalesce(z.zu, 0) - coalesce(z.ab, 0), 0)
  from termine t
  left join (
    select r.termin_id,
           count(*) filter (where r.status = 'zu')::integer as zu,
           count(*) filter (where r.status = 'ab')::integer as ab
    from termin_rueckmeldungen r
    group by r.termin_id
  ) z on z.termin_id = t.id
  where t.verein_id = v_verein
  order by t.datum asc;
end;
$function$;

-- ============================================================
--  6. Rechte
-- ============================================================
--
-- Seit v82_standardrechte bekommen neue Funktionen nichts geschenkt.
-- Erst alles wegnehmen, dann gezielt geben - und niemals an public.

revoke all on function public.oeffentliche_termine(text) from public;
revoke all on function public.oeffentliche_termine_alle(text) from public;
revoke all on function public.termine_fuer_schiri(uuid, text) from public;
revoke all on function public.termin_zusagen(uuid, text, uuid) from public;
revoke all on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) from public;
revoke all on function public.obmann_termin_zusatzfelder_setzen(text, uuid, time, time, text, text, boolean, date) from public;
revoke all on function public.obmann_termin_rueckmeldungen(text, uuid) from public;
revoke all on function public.obmann_termine_mit_stand(text) from public;

grant execute on function public.oeffentliche_termine(text) to anon, authenticated;
grant execute on function public.oeffentliche_termine_alle(text) to anon, authenticated;
grant execute on function public.termine_fuer_schiri(uuid, text) to anon, authenticated;
grant execute on function public.termin_zusagen(uuid, text, uuid) to anon, authenticated;
grant execute on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.obmann_termin_zusatzfelder_setzen(text, uuid, time, time, text, text, boolean, date) to anon, authenticated;
grant execute on function public.obmann_termin_rueckmeldungen(text, uuid) to anon, authenticated;
grant execute on function public.obmann_termine_mit_stand(text) to anon, authenticated;
