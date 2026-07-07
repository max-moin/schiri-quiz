-- ============================================================
-- Schiri-Quiz: Datenbank-Setup für Supabase
-- ============================================================
-- Diese Datei komplett in den Supabase SQL-Editor kopieren und
-- einmal ausführen ("Run"). Legt alle Tabellen, Sicherheits-
-- regeln und die Auswerte-Funktion an.
-- ============================================================

-- 1) Schiedsrichter (trägst du einmalig selbst ein, siehe unten)
create table if not exists schiedsrichter (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  erstellt_am timestamptz not null default now()
);

-- 2) Fragen (du legst hier wöchentlich neue Fragen an)
create table if not exists fragen (
  id uuid primary key default gen_random_uuid(),
  frage_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  richtige_option text not null check (richtige_option in ('a', 'b', 'c')),
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);

-- 3) Antworten (wird automatisch befüllt, wenn jemand mitmacht)
create table if not exists antworten (
  id uuid primary key default gen_random_uuid(),
  schiedsrichter_id uuid not null references schiedsrichter(id),
  frage_id uuid not null references fragen(id),
  gegebene_option text not null check (gegebene_option in ('a', 'b', 'c')),
  korrekt boolean not null,
  beantwortet_am timestamptz not null default now(),
  unique (schiedsrichter_id, frage_id)  -- jeder beantwortet jede Frage nur einmal
);

-- ============================================================
-- Sicherheit: Row Level Security aktivieren
-- ============================================================
alter table schiedsrichter enable row level security;
alter table fragen enable row level security;
alter table antworten enable row level security;

-- Jeder (auch ohne Login) darf die Namensliste sehen (für das Dropdown)
create policy "Namen sind oeffentlich lesbar"
  on schiedsrichter for select
  using (true);

-- Die rohe "fragen"-Tabelle bleibt für alle gesperrt, damit niemand
-- über die Browser-Konsole an "richtige_option" herankommt.
-- Stattdessen gibt es unten eine "abgespeckte" View ohne diese Spalte.

-- Antworten dürfen nicht direkt eingefügt werden (das übernimmt die
-- Funktion "antwort_abgeben" weiter unten, damit "korrekt" nicht
-- gefälscht werden kann). Lesen ist ebenfalls gesperrt für anon.

-- ============================================================
-- Öffentliche Sicht auf die Fragen OHNE Lösung
-- ============================================================
create or replace view fragen_oeffentlich as
  select id, frage_text, option_a, option_b, option_c, aktiv, erstellt_am
  from fragen
  where aktiv = true;

grant select on fragen_oeffentlich to anon;

-- ============================================================
-- Funktion zum Abgeben einer Antwort (prüft & speichert serverseitig)
-- ============================================================
create or replace function antwort_abgeben(
  p_schiedsrichter_id uuid,
  p_frage_id uuid,
  p_gegebene_option text
)
returns table (korrekt boolean, richtige_option text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_richtige_option text;
  v_korrekt boolean;
begin
  select f.richtige_option into v_richtige_option
  from fragen f
  where f.id = p_frage_id and f.aktiv = true;

  if v_richtige_option is null then
    raise exception 'Frage nicht gefunden oder nicht aktiv';
  end if;

  v_korrekt := (v_richtige_option = p_gegebene_option);

  insert into antworten (schiedsrichter_id, frage_id, gegebene_option, korrekt)
  values (p_schiedsrichter_id, p_frage_id, p_gegebene_option, v_korrekt)
  on conflict (schiedsrichter_id, frage_id) do nothing;

  return query select v_korrekt, v_richtige_option;
end;
$$;

grant execute on function antwort_abgeben(uuid, uuid, text) to anon;

-- ============================================================
-- Auswertung pro Schiedsrichter (für dich als Obmann im Dashboard)
-- ============================================================
create or replace view auswertung_pro_schiedsrichter as
  select
    s.name,
    count(a.id) as beantwortete_fragen,
    count(a.id) filter (where a.korrekt) as richtige_antworten
  from schiedsrichter s
  left join antworten a on a.schiedsrichter_id = s.id
  group by s.name
  order by s.name;

-- ============================================================
-- Beispiel-Daten (kannst du löschen/anpassen)
-- ============================================================
insert into schiedsrichter (name) values
  ('Max Müller')
on conflict (name) do nothing;

insert into fragen (frage_text, option_a, option_b, option_c, richtige_option, aktiv) values
  ('Wie viele Spieler darf eine Mannschaft beim Anstoß mindestens haben?', '7', '6', '8', 'a', true),
  ('Wann gibt es einen indirekten Freistoß bei einer Rückgabe zum Torwart?', 'Wenn der Torwart den Ball mit der Hand aufnimmt', 'Wenn der Ball ins Toraus geht', 'Wenn der Torwart den Ball abwehrt', 'a', true),
  ('Ab welcher Entfernung muss die gegnerische Mannschaft bei einem Freistoß mindestens stehen?', '9,15 m', '5 m', '11 m', 'a', true)
on conflict do nothing;
