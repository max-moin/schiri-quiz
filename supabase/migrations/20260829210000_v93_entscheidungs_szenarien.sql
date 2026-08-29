-- v93_entscheidungs_szenarien (29.08.2026)
--
-- Das Datenmodell fuer den Entscheidungs-Modus. Max: "dass du halt nur
-- diese gelben Karte- und roten Karte-Buttons hast, dann direkt
-- indirekter Freistoss, sonstiges Spielfortsetzung."
--
-- Zwei Achsen, immer beide: Spielfortsetzung (genau eine von neun) und
-- persoenliche Strafe (keine | gelb | gelb_rot | rot). Die Zeitstrafe
-- ist am 29.08. gestrichen worden - "Das gibt es im Profifussball
-- nicht" - und damit auch die Kopplung an Altersklassen.
--
-- ============================================================
--  Die eine Entwurfsentscheidung, die alles andere traegt
-- ============================================================
--
-- Die richtige Antwort liegt in einer EIGENEN Tabelle
-- (szenario_loesungen), nicht als Spalte am Szenario. Nicht aus
-- Ordnungsliebe: die Spielerseite muss das Szenario samt Bild
-- ausliefern, und wenn Loesung und Bild in derselben Zeile stehen,
-- reicht ein "select *" oder eine vergessene Spalte in einer RETURNS
-- TABLE, und die Antwort steht im Browser. Bei einem Quiz mit vier
-- Knoepfen ist das nicht bloss unschoen - dann ist der Modus wertlos.
-- Getrennte Tabellen machen den Fehler unmoeglich statt
-- unwahrscheinlich: die Spieler-RPCs lesen szenario_loesungen gar nicht.
--
-- Dieselbe Regel gilt fuer die Zusatzfragen: die Optionen stehen
-- oeffentlich in szenario_zusatzfragen, die richtigen Schluessel
-- ausschliesslich in szenario_loesungen.zusatz_antworten. Merksatz:
-- ES GIBT GENAU EINE TABELLE MIT RICHTIGEN ANTWORTEN.

-- ============================================================
--  1. Das Szenario (alles hier darf der Browser sehen)
-- ============================================================

create table if not exists public.entscheidungs_szenarien (
  id               uuid primary key default gen_random_uuid(),
  titel            text not null,
  -- Max' beste Einzelheit des Konzepts: derselbe Text dient dreifach -
  -- als Prompt fuer die Bilderzeugung, als Ersatztext wenn das Bild
  -- nicht laedt, und als Alternativtext fuer Vorleseprogramme.
  -- Deshalb NOT NULL, auch wenn ein Bild da ist.
  beschreibung     text not null,
  bild_base64      text,
  bild_mime        text,
  bild_quelle      text,
  bild_modell      text,
  bild_erzeugt_am  timestamptz,
  -- Pflichtpruefung vor der Veroeffentlichung. Max: "Das muss vor der
  -- Fragenveroeffentlichung noch mal geprueft werden." KI-Bilder sind
  -- unzuverlaessig bei genau den Details, an denen eine
  -- Schiedsrichterfrage haengt (Hand am Ball oder Ball an der Hand).
  bild_geprueft_am timestamptz,
  bild_geprueft_von text,
  -- Trikotfarben gehoeren ans Szenario, nicht fest gelb/blau: sonst
  -- tippt man auf "gelb" und meint das blaue Team.
  trikot_heim      text not null default '#e4032e',
  trikot_gast      text not null default '#1d4ed8',
  regel_nummer     smallint references public.regeln(nummer) on delete set null,
  schwierigkeit    smallint,
  aktiv            boolean not null default false,
  erstellt_am      timestamptz not null default now(),
  geaendert_am     timestamptz not null default now(),

  constraint szenario_schwierigkeit_gueltig
    check (schwierigkeit is null or schwierigkeit between 1 and 5),
  constraint szenario_bild_quelle_gueltig
    check (bild_quelle is null or bild_quelle in ('ki', 'upload')),
  constraint szenario_bild_mime_gueltig
    check (bild_mime is null or bild_mime in ('image/png', 'image/jpeg', 'image/webp')),
  -- Bild, Mime und Quelle sind entweder alle drei da oder alle drei leer.
  constraint szenario_bild_vollstaendig
    check ((bild_base64 is null) = (bild_mime is null)
       and (bild_base64 is null) = (bild_quelle is null)),
  -- Die Freigabesperre steht in der Datenbank, nicht nur in der
  -- Oberflaeche - wie beim Absagegrund in v90. Eine Oberflaeche kann
  -- man umgehen, einen CHECK nicht.
  constraint szenario_aktiv_nur_geprueft
    check (not aktiv or (bild_base64 is not null and bild_geprueft_am is not null))
);

comment on table public.entscheidungs_szenarien is
  'Entscheidungs-Modus: die Szene. Enthaelt bewusst KEINE richtige Antwort - die liegt in szenario_loesungen, damit sie nicht versehentlich mit dem Bild ausgeliefert wird.';
comment on column public.entscheidungs_szenarien.beschreibung is
  'Dreifachnutzung: KI-Prompt, Ersatztext bei fehlendem Bild, Alternativtext fuer Vorleseprogramme.';
comment on column public.entscheidungs_szenarien.bild_geprueft_am is
  'Erst nach dem Setzen darf aktiv=true. Wird beim Austausch des Bildes automatisch wieder geleert (obmann_szenario_bild_setzen).';

create index if not exists idx_szenarien_aktiv
  on public.entscheidungs_szenarien (aktiv) where aktiv;

-- ============================================================
--  2. Die Loesung - verlaesst niemals den Server
-- ============================================================

create table if not exists public.szenario_loesungen (
  szenario_id            uuid primary key
                           references public.entscheidungs_szenarien(id) on delete cascade,
  spielfortsetzung       text not null,
  fortsetzung_fuer       text,
  persoenliche_strafe    text not null,
  strafe_fuer_mannschaft text,
  strafe_fuer_rolle      text,
  strafe_rueckennummer   smallint,
  -- {"<zusatzfrage_id>": "<schluessel>"} - die richtigen Antworten der
  -- Zusatzfragen. Absichtlich hier und nicht in szenario_zusatzfragen.
  zusatz_antworten       jsonb not null default '{}'::jsonb,
  erklaerung             text not null,
  geaendert_am           timestamptz not null default now(),

  constraint szenario_fortsetzung_gueltig check (spielfortsetzung in (
    'weiterspielen', 'direkter_freistoss', 'indirekter_freistoss', 'strafstoss',
    'sr_ball', 'eckstoss', 'abstoss', 'einwurf', 'anstoss')),
  constraint szenario_strafe_gueltig
    check (persoenliche_strafe in ('keine', 'gelb', 'gelb_rot', 'rot')),
  constraint szenario_mannschaft_gueltig
    check (fortsetzung_fuer is null or fortsetzung_fuer in ('heim', 'gast')),
  constraint szenario_strafe_mannschaft_gueltig
    check (strafe_fuer_mannschaft is null or strafe_fuer_mannschaft in ('heim', 'gast')),
  constraint szenario_rolle_gueltig
    check (strafe_fuer_rolle is null or strafe_fuer_rolle in
      ('feldspieler', 'torwart', 'auswechselspieler', 'trainer')),
  -- Weiterspielen und Schiedsrichter-Ball gehoeren keiner Mannschaft.
  -- Alle sieben anderen brauchen eine Richtung, sonst ist die Loesung
  -- unvollstaendig und die Auswertung koennte sie nie pruefen.
  constraint szenario_richtung_konsistent check (
    case when spielfortsetzung in ('weiterspielen', 'sr_ball')
         then fortsetzung_fuer is null
         else fortsetzung_fuer is not null end),
  -- Ohne Strafe gibt es niemanden, den sie trifft; mit Strafe muss die
  -- Mannschaft feststehen (Rolle und Nummer bleiben freiwillig).
  constraint szenario_strafziel_konsistent check (
    case when persoenliche_strafe = 'keine'
         then strafe_fuer_mannschaft is null and strafe_fuer_rolle is null
              and strafe_rueckennummer is null
         else strafe_fuer_mannschaft is not null end)
);

comment on table public.szenario_loesungen is
  'DIE EINZIGE TABELLE MIT RICHTIGEN ANTWORTEN. Kein Spieler-RPC darf sie lesen; die Auswertung passiert serverseitig in szenario_antwort_pruefen.';

-- ============================================================
--  3. Zusatzfragen (Max' Sonderfaelle)
-- ============================================================
--
-- Max: "Vielleicht auch Sonderfaelle." Nicht jede Szene braucht sie -
-- deshalb eine eigene Tabelle statt fester Spalten. Typischer Fall:
-- "Wo wird der Freistoss ausgefuehrt?" oder "Wer fuehrt aus?".

create table if not exists public.szenario_zusatzfragen (
  id          uuid primary key default gen_random_uuid(),
  szenario_id uuid not null references public.entscheidungs_szenarien(id) on delete cascade,
  position    smallint not null default 1,
  frage_text  text not null,
  -- [{"schluessel":"a","label":"..."}, ...] - nur die Auswahl, nie die Loesung.
  optionen    jsonb not null,
  constraint szenario_zusatz_optionen_liste
    check (jsonb_typeof(optionen) = 'array' and jsonb_array_length(optionen) between 2 and 6),
  unique (szenario_id, position)
);

comment on table public.szenario_zusatzfragen is
  'Optionale Rueckfragen je Szenario. Enthaelt bewusst KEINE richtige Antwort - die steht in szenario_loesungen.zusatz_antworten.';

-- ============================================================
--  4. Was jemand geantwortet hat
-- ============================================================
--
-- Der Modus ist freiwillig und wiederholbar, deshalb kein unique je
-- Schiedsrichter und Szenario. versuch_nr macht die Wiederholung
-- sichtbar, statt sie zu verstecken.

create table if not exists public.szenario_antworten (
  id                         uuid primary key default gen_random_uuid(),
  schiedsrichter_id          uuid not null references public.schiedsrichter(id) on delete cascade,
  szenario_id                uuid not null references public.entscheidungs_szenarien(id) on delete cascade,
  gewaehlte_fortsetzung      text not null,
  gewaehlte_fortsetzung_fuer text,
  gewaehlte_strafe           text not null,
  gewaehlte_strafe_fuer      text,
  gewaehlte_zusatz           jsonb not null default '{}'::jsonb,
  bewertung                  text not null,
  punkte                     smallint not null,
  versuch_nr                 smallint not null default 1,
  beantwortet_am             timestamptz not null default now(),

  constraint szenario_antwort_bewertung_gueltig
    check (bewertung in ('komplett', 'teilweise', 'falsch')),
  constraint szenario_antwort_punkte_gueltig
    check (punkte between 0 and 2)
);

create index if not exists idx_szenario_antworten_schiri
  on public.szenario_antworten (schiedsrichter_id, beantwortet_am desc);
create index if not exists idx_szenario_antworten_szenario
  on public.szenario_antworten (szenario_id);

-- ============================================================
--  5. RLS: an, ohne Policies (Hauskonvention)
-- ============================================================
--
-- Zugriff ausschliesslich ueber SECURITY-DEFINER-RPCs. Ohne Policy
-- kommt anon und authenticated an keine Zeile heran - auch nicht an
-- szenario_loesungen, falls jemand die Tabelle doch einmal direkt
-- abfragt.

alter table public.entscheidungs_szenarien enable row level security;
alter table public.szenario_loesungen      enable row level security;
alter table public.szenario_zusatzfragen   enable row level security;
alter table public.szenario_antworten      enable row level security;

revoke all on public.entscheidungs_szenarien from anon, authenticated;
revoke all on public.szenario_loesungen      from anon, authenticated;
revoke all on public.szenario_zusatzfragen   from anon, authenticated;
revoke all on public.szenario_antworten      from anon, authenticated;
