-- v91_terminfindung (29.08.2026)
--
-- Max' zweiter Umfrage-Fall, aus seinen eigenen Notizen: "Event-Planung:
-- Saison-Einstiegsfeier (Soccer-Golf) - Termin unter drei Wochenenden
-- finden." Anders als die Zu-/Absage aus v90 steht der Termin hier noch
-- nicht fest; gesucht wird der Vorschlag, an dem die meisten koennen.
--
-- Bewusst getrennt von "termine" und nicht als dessen Sonderfall:
--
--   * Ein Vorschlag ist kein Termin. Er hat keine Freigabe, keine
--     Pflicht, keine Rueckmeldefrist, und er verschwindet wieder.
--     Waere er eine Zeile in "termine", muesste jede bestehende Abfrage
--     ihn kuenftig ausschliessen - und die eine, die es vergisst, stellt
--     Vorschlaege als echte Termine auf die Vereinsseite.
--   * Die Antworten sind dreiwertig (ja / vielleicht / nein), nicht
--     zweiwertig wie bei v90. "Vielleicht" ist bei der Terminsuche die
--     wichtigste Antwort ueberhaupt: sie unterscheidet einen Vorschlag,
--     an dem niemand kann, von einem, an dem es knapp wird.
--
-- Am Ende entscheidet der Obmann. Aus der Entscheidung entsteht ein
-- echter Termin in "termine" - damit landet das Ergebnis in genau dem
-- Ablauf, den es schon gibt, statt in einem zweiten daneben.

-- ============================================================
--  1. Tabellen
-- ============================================================

create table if not exists public.terminfindungen (
  id           uuid        primary key default gen_random_uuid(),
  verein_id    uuid        not null references public.vereine(id) on delete cascade,
  titel        text        not null,
  beschreibung text,
  antwort_bis  date,
  status       text        not null default 'offen',
  -- Auf welchen Vorschlag die Wahl gefallen ist. Bleibt leer, solange
  -- nicht entschieden ist. Der Fremdschluessel wird weiter unten
  -- ergaenzt, weil die Vorschlagstabelle erst danach existiert.
  gewaehlter_vorschlag uuid,
  erstellter_termin    uuid references public.termine(id) on delete set null,
  erstellt_am  timestamptz not null default now(),

  constraint terminfindung_status_gueltig
    check (status in ('offen', 'entschieden', 'abgebrochen')),

  -- Eine entschiedene Findung ohne gewaehlten Vorschlag waere ein
  -- Zustand, den keine Oberflaeche sinnvoll anzeigen kann.
  constraint entschieden_braucht_vorschlag
    check (status <> 'entschieden' or gewaehlter_vorschlag is not null)
);

create table if not exists public.terminfindung_vorschlaege (
  id          uuid    primary key default gen_random_uuid(),
  findung_id  uuid    not null references public.terminfindungen(id) on delete cascade,
  datum       date    not null,
  beginn_zeit time,
  ort         text,
  position    integer not null default 0,

  -- Derselbe Tag zweimal zur Wahl zu stellen ist immer ein Versehen.
  constraint vorschlag_datum_einmalig unique (findung_id, datum, beginn_zeit)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'terminfindung_gewaehlter_vorschlag_fkey') then
    alter table public.terminfindungen
      add constraint terminfindung_gewaehlter_vorschlag_fkey
      foreign key (gewaehlter_vorschlag)
      references public.terminfindung_vorschlaege(id) on delete set null;
  end if;
end $$;

create table if not exists public.terminfindung_stimmen (
  vorschlag_id      uuid        not null references public.terminfindung_vorschlaege(id) on delete cascade,
  schiedsrichter_id uuid        not null references public.schiedsrichter(id) on delete cascade,
  antwort           text        not null,
  gemeldet_am       timestamptz not null default now(),
  primary key (vorschlag_id, schiedsrichter_id),

  constraint stimme_antwort_gueltig
    check (antwort in ('ja', 'vielleicht', 'nein'))
);

comment on table public.terminfindungen is
  'Terminsuche unter mehreren Vorschlaegen. Wird nach der Entscheidung zu einem echten Termin.';
comment on column public.terminfindung_stimmen.antwort is
  'ja | vielleicht | nein. "vielleicht" trennt "geht knapp" von "geht gar nicht" - der eigentliche Sinn der Abstimmung.';

-- RLS an, keine Policy - wie bei termine und termin_rueckmeldungen.
-- Jeder Zugriff laeuft ueber die geprueften Funktionen unten.
alter table public.terminfindungen           enable row level security;
alter table public.terminfindung_vorschlaege enable row level security;
alter table public.terminfindung_stimmen     enable row level security;

create index if not exists terminfindung_vorschlaege_findung_idx
  on public.terminfindung_vorschlaege (findung_id);
create index if not exists terminfindung_stimmen_vorschlag_idx
  on public.terminfindung_stimmen (vorschlag_id);

-- ============================================================
--  2. Mitgliedersicht
-- ============================================================
--
-- Terminfindungen sind IMMER intern: sie stehen nie auf der
-- oeffentlichen Seite, es gibt also bewusst keine Funktion ohne PIN.
-- Wer noch nicht angemeldet ist, sieht sie gar nicht.

create or replace function public.terminfindungen_fuer_schiri(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns table (
  id uuid, titel text, beschreibung text, antwort_bis date, status text,
  gewaehlter_vorschlag uuid, erstellt_am timestamptz,
  vorschlaege jsonb
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
  select f.id, f.titel, f.beschreibung, f.antwort_bis, f.status,
         f.gewaehlter_vorschlag, f.erstellt_am,
         -- Die Vorschlaege als ein Feld statt als zweite Abfrage: sonst
         -- muesste die Oberflaeche je Findung noch einmal nachladen.
         coalesce((
           select jsonb_agg(x order by x->>'position', x->>'datum')
           from (
             select jsonb_build_object(
               'id', v.id,
               'datum', v.datum,
               'beginn_zeit', v.beginn_zeit,
               'ort', v.ort,
               'position', v.position,
               'meine_antwort', (
                 select st.antwort from terminfindung_stimmen st
                 where st.vorschlag_id = v.id and st.schiedsrichter_id = p_schiedsrichter_id
               ),
               'ja', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'ja'),
               'vielleicht', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'vielleicht'),
               'nein', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'nein')
             ) as x
             from terminfindung_vorschlaege v
             where v.findung_id = f.id
           ) t
         ), '[]'::jsonb)
  from terminfindungen f
  where f.verein_id = v_verein and f.status <> 'abgebrochen'
  order by case f.status when 'offen' then 0 else 1 end, f.erstellt_am desc
  limit 40;
end;
$function$;

create or replace function public.terminfindung_stimme_setzen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_vorschlag_id uuid,
  p_antwort text
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
  v_status text;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN ungueltig';
  end if;

  if p_antwort not in ('ja', 'vielleicht', 'nein') then
    raise exception 'Ungueltige Antwort: %', p_antwort;
  end if;

  -- Verein UND Status in einem Schritt pruefen. Ohne die Vereinspruefung
  -- koennte man mit einer gueltigen PIN in einem Verein bei der
  -- Terminsuche eines anderen mitstimmen.
  select f.status into v_status
  from terminfindung_vorschlaege v
  join terminfindungen f on f.id = v.findung_id
  where v.id = p_vorschlag_id and f.verein_id = v_verein;

  if v_status is null then
    raise exception 'Vorschlag nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist abgeschlossen';
  end if;

  insert into terminfindung_stimmen (vorschlag_id, schiedsrichter_id, antwort, gemeldet_am)
  values (p_vorschlag_id, p_schiedsrichter_id, p_antwort, now())
  on conflict (vorschlag_id, schiedsrichter_id) do update set
    antwort = excluded.antwort,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

-- ============================================================
--  3. Obmann-Seite
-- ============================================================

create or replace function public.obmann_terminfindung_anlegen(
  p_passwort text,
  p_titel text,
  p_vorschlaege jsonb,
  p_beschreibung text default null,
  p_antwort_bis date default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_id uuid;
  v_eintrag jsonb;
  v_anzahl integer;
  v_pos integer := 0;
begin
  v_verein := obmann_verein(p_passwort);

  if coalesce(trim(p_titel), '') = '' then
    raise exception 'Titel fehlt';
  end if;

  v_anzahl := jsonb_array_length(coalesce(p_vorschlaege, '[]'::jsonb));
  -- Eine Abstimmung mit einem einzigen Vorschlag ist keine Abstimmung,
  -- sondern ein Termin - dafuer gibt es v90.
  if v_anzahl < 2 then
    raise exception 'Mindestens zwei Vorschlaege noetig';
  end if;
  if v_anzahl > 8 then
    raise exception 'Hoechstens acht Vorschlaege';
  end if;

  insert into terminfindungen (verein_id, titel, beschreibung, antwort_bis)
  values (v_verein, trim(p_titel), nullif(trim(coalesce(p_beschreibung, '')), ''), p_antwort_bis)
  returning id into v_id;

  for v_eintrag in select * from jsonb_array_elements(p_vorschlaege) loop
    insert into terminfindung_vorschlaege (findung_id, datum, beginn_zeit, ort, position)
    values (
      v_id,
      (v_eintrag->>'datum')::date,
      nullif(v_eintrag->>'beginn_zeit', '')::time,
      nullif(trim(coalesce(v_eintrag->>'ort', '')), ''),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$function$;

create or replace function public.obmann_terminfindungen(p_passwort text)
returns table (
  id uuid, titel text, beschreibung text, antwort_bis date, status text,
  gewaehlter_vorschlag uuid, erstellter_termin uuid, erstellt_am timestamptz,
  offen integer, vorschlaege jsonb
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
  select f.id, f.titel, f.beschreibung, f.antwort_bis, f.status,
         f.gewaehlter_vorschlag, f.erstellter_termin, f.erstellt_am,
         -- Wie viele haben ueberhaupt noch nicht abgestimmt. Zaehlt
         -- Personen, nicht Stimmen: wer bei einem von drei Vorschlaegen
         -- geantwortet hat, hat geantwortet.
         greatest(v_aktive - (
           select count(distinct st.schiedsrichter_id)
           from terminfindung_stimmen st
           join terminfindung_vorschlaege v on v.id = st.vorschlag_id
           where v.findung_id = f.id
         ), 0)::integer,
         coalesce((
           select jsonb_agg(x order by x->>'position', x->>'datum')
           from (
             select jsonb_build_object(
               'id', v.id, 'datum', v.datum, 'beginn_zeit', v.beginn_zeit,
               'ort', v.ort, 'position', v.position,
               'ja', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'ja'),
               'vielleicht', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'vielleicht'),
               'nein', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'nein'),
               'namen_ja', coalesce((
                 select jsonb_agg(s.name order by s.name)
                 from terminfindung_stimmen st
                 join schiedsrichter s on s.id = st.schiedsrichter_id
                 where st.vorschlag_id = v.id and st.antwort = 'ja'), '[]'::jsonb)
             ) as x
             from terminfindung_vorschlaege v
             where v.findung_id = f.id
           ) t
         ), '[]'::jsonb)
  from terminfindungen f
  where f.verein_id = v_verein
  order by case f.status when 'offen' then 0 else 1 end, f.erstellt_am desc;
end;
$function$;

-- Aus der Entscheidung entsteht ein echter Termin. Damit landet das
-- Ergebnis in dem Ablauf, den es schon gibt (Freigabe, Zu-/Absage,
-- spaeter Kalenderabo) statt in einem zweiten daneben.
create or replace function public.obmann_terminfindung_entscheiden(
  p_passwort text,
  p_findung_id uuid,
  p_vorschlag_id uuid,
  p_oeffentlich boolean default false,
  p_art text default 'event',
  p_pflicht boolean default false
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
begin
  v_verein := obmann_verein(p_passwort);

  select f.titel, f.beschreibung, f.status into v_titel, v_beschreibung, v_status
  from terminfindungen f
  where f.id = p_findung_id and f.verein_id = v_verein;
  if v_titel is null then
    raise exception 'Terminsuche nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist bereits abgeschlossen';
  end if;

  select v.datum, v.beginn_zeit, v.ort into v_datum, v_zeit, v_ort
  from terminfindung_vorschlaege v
  where v.id = p_vorschlag_id and v.findung_id = p_findung_id;
  if v_datum is null then
    raise exception 'Vorschlag gehoert nicht zu dieser Terminsuche';
  end if;

  insert into termine (verein_id, titel, datum, beschreibung, oeffentlich,
                       beginn_zeit, ort, art, pflicht)
  values (v_verein, v_titel, v_datum, v_beschreibung, coalesce(p_oeffentlich, false),
          v_zeit, v_ort, coalesce(p_art, 'event'), coalesce(p_pflicht, false))
  returning id into v_termin;

  update terminfindungen set
    status = 'entschieden',
    gewaehlter_vorschlag = p_vorschlag_id,
    erstellter_termin = v_termin
  where id = p_findung_id;

  -- Wer beim gewaehlten Vorschlag "ja" gesagt hat, bekommt die Zusage
  -- zum neuen Termin gleich uebertragen. Sonst muesste dieselbe Person
  -- dieselbe Frage zweimal beantworten. "vielleicht" wird bewusst NICHT
  -- uebertragen - das waere eine Behauptung, die niemand aufgestellt hat.
  insert into termin_rueckmeldungen (termin_id, schiedsrichter_id, status)
  select v_termin, st.schiedsrichter_id, 'zu'
  from terminfindung_stimmen st
  where st.vorschlag_id = p_vorschlag_id and st.antwort = 'ja'
  on conflict do nothing;

  return v_termin;
end;
$function$;

create or replace function public.obmann_terminfindung_abbrechen(
  p_passwort text,
  p_findung_id uuid
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
  update terminfindungen set status = 'abgebrochen'
  where id = p_findung_id and verein_id = v_verein and status = 'offen';
  if not found then
    raise exception 'Terminsuche nicht gefunden oder schon abgeschlossen';
  end if;
end;
$function$;

-- ============================================================
--  4. Rechte
-- ============================================================

revoke all on function public.terminfindungen_fuer_schiri(uuid, text) from public;
revoke all on function public.terminfindung_stimme_setzen(uuid, text, uuid, text) from public;
revoke all on function public.obmann_terminfindung_anlegen(text, text, jsonb, text, date) from public;
revoke all on function public.obmann_terminfindungen(text) from public;
revoke all on function public.obmann_terminfindung_entscheiden(text, uuid, uuid, boolean, text, boolean) from public;
revoke all on function public.obmann_terminfindung_abbrechen(text, uuid) from public;

grant execute on function public.terminfindungen_fuer_schiri(uuid, text) to anon, authenticated;
grant execute on function public.terminfindung_stimme_setzen(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.obmann_terminfindung_anlegen(text, text, jsonb, text, date) to anon, authenticated;
grant execute on function public.obmann_terminfindungen(text) to anon, authenticated;
grant execute on function public.obmann_terminfindung_entscheiden(text, uuid, uuid, boolean, text, boolean) to anon, authenticated;
grant execute on function public.obmann_terminfindung_abbrechen(text, uuid) to anon, authenticated;
