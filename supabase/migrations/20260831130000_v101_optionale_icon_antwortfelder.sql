-- v101_optionale_icon_antwortfelder (31.08.2026)
--
-- Max: "Okay, wo ist gar nicht gefordert, das braucht man nicht angeben,
-- kann man ausschalten - oder auch Spielfortsetzung ist nicht gefragt, es
-- ist nur gefragt, welche persoenliche Strafe es da gibt. Dass man das
-- alles selektieren kann und sagen kann: die Antwortoptionen, die musst
-- du nicht mit angeben."
--
-- Bis v100 verlangte jede Icon-Frage ALLE Bestandteile: Spielfortsetzung,
-- Richtung, Ort, Strafe, Mannschaft, Rolle. Fuer eine Frage wie "Welche
-- persoenliche Strafe gibt es hier?" ist das schlicht falsch - der
-- Schiedsrichter muss dann eine Spielfortsetzung raten, nach der nie
-- gefragt wurde, und liegt daneben.
--
-- ============================================================
--  Konfiguration statt Sonderfaelle
-- ============================================================
--
-- Sieben Schalter sagen, was verlangt wird, plus einer fuer die
-- Darstellung. Dieselben Schalter steuern danach ALLES: welche Felder
-- das Formular zeigt, was Pflicht ist, und was in die Bewertung eingeht.
--
-- Das ist der Punkt. Wuerden die Schalter nur das Formular steuern,
-- koennte ein direkter Aufruf an der Oberflaeche vorbei trotzdem auf
-- einem nicht gestellten Feld bewertet werden - und ein nicht gefragtes
-- Feld darf niemals als "falsch" zaehlen. Deshalb liegen Schalter und
-- Bewertung in derselben Tabelle und derselben Funktion.
--
-- Trikotfarben sind KEINE Antwort, sondern Darstellung. Max: "Wenn in
-- der Fragestellung keine Trikotfarbe gegeben ist - bei Video oder Bild
-- sieht man sie ja, aber bei Text nicht - dass man sagen kann:
-- Trikotfarbe an oder aus, und dass man einfach nur Heim und Gast
-- macht." Deshalb ein eigener Schalter, der nichts bewertet.
--
-- ============================================================
--  HINWEIS ZUR HISTORIE
-- ============================================================
--
-- Diese Datei ist der Endstand. In der Live-Datenbank wurde sie in zwei
-- Schritten angewandt (v101 und v101b), weil der erste Anlauf die
-- Hilfsfunktion entscheidung_ergebnis_bauen() aufrief, ohne sie
-- anzulegen, und die Teilnoten in antwort_entscheidungen noch NOT NULL
-- waren.
--
-- **plpgsql loest Funktionsaufrufe erst zur LAUFZEIT auf.** "create
-- function" lief deshalb anstandslos durch; der Fehler waere erst beim
-- ersten Beantworten einer Icon-Frage aufgetreten. Merksatz fuer
-- spaeter: bei plpgsql beweist ein erfolgreiches Anlegen gar nichts -
-- nur ein Aufruf beweist etwas.

-- ============================================================
--  1. Die Schalter
-- ============================================================

alter table public.frage_entscheidungsloesungen
  add column if not exists fordert_fortsetzung        boolean not null default true,
  add column if not exists fordert_fortsetzung_fuer   boolean not null default true,
  add column if not exists fordert_fortsetzung_ort    boolean not null default true,
  add column if not exists fordert_strafe             boolean not null default true,
  add column if not exists fordert_strafe_mannschaft  boolean not null default true,
  add column if not exists fordert_strafe_rolle       boolean not null default true,
  add column if not exists fordert_strafe_nummer      boolean not null default false,
  add column if not exists zeigt_trikotfarben         boolean not null default true;

comment on column public.frage_entscheidungsloesungen.zeigt_trikotfarben is
  'Reiner Darstellungsschalter, geht NICHT in die Bewertung ein. Aus bei Textfragen, die keine Trikotfarben nennen - dann zeigt das Formular nur "Heim" und "Gast".';

-- ============================================================
--  2. Bestand ehrlich machen, bevor die Regeln greifen
-- ============================================================
--
-- Die vorhandenen Zeilen stammen aus v99/v100, wo alles Pflicht war. Die
-- Vorgabewerte bilden das ab - nur die Unterschalter muessen der
-- Wirklichkeit angeglichen werden, sonst scheitern die neuen Regeln an
-- genau den Daten, die sie schuetzen sollen.

update public.frage_entscheidungsloesungen set
  fordert_fortsetzung_fuer  = (fortsetzung_fuer is not null),
  fordert_fortsetzung_ort   = (coalesce(btrim(fortsetzung_ort), '') <> ''),
  fordert_strafe_mannschaft = (strafe_fuer_mannschaft is not null),
  fordert_strafe_rolle      = (strafe_fuer_rolle is not null),
  fordert_strafe_nummer     = (strafe_rueckennummer is not null);

alter table public.frage_entscheidungsloesungen
  alter column spielfortsetzung    drop not null,
  alter column persoenliche_strafe drop not null,
  alter column fortsetzung_ort     drop not null;

-- Der Ort war NOT NULL, konnte aber leer sein. Leer heisst ab jetzt NULL -
-- "nicht verlangt" und "verlangt, aber leer" duerfen nicht dasselbe sein.
update public.frage_entscheidungsloesungen
  set fortsetzung_ort = null
  where coalesce(btrim(fortsetzung_ort), '') = '';

-- ============================================================
--  3. Schalterbewusste Pruefregeln
-- ============================================================

alter table public.frage_entscheidungsloesungen
  drop constraint if exists frage_entscheidung_richtung_konsistent,
  drop constraint if exists frage_entscheidung_strafziel_konsistent,
  drop constraint if exists frage_entscheidung_ort_nicht_leer;

alter table public.frage_entscheidungsloesungen
  -- Die Frage muss ueberhaupt etwas fragen.
  add constraint frage_entscheidung_hat_hauptteil
    check (fordert_fortsetzung or fordert_strafe),

  -- Unterschalter haengen an ihrem Hauptbestandteil. "Fuer welche
  -- Mannschaft?" ohne Spielfortsetzung ergibt nichts.
  add constraint frage_entscheidung_unterschalter_haengen
    check (
      (not fordert_fortsetzung_fuer  or fordert_fortsetzung) and
      (not fordert_fortsetzung_ort   or fordert_fortsetzung) and
      (not fordert_strafe_mannschaft or fordert_strafe) and
      (not fordert_strafe_rolle      or fordert_strafe) and
      (not fordert_strafe_nummer     or fordert_strafe)),

  -- Wert genau dann, wenn verlangt. Ein verwaister Loesungswert zu einer
  -- Frage, die ihn nicht stellt, waere spaeter nicht als Altlast zu
  -- erkennen.
  add constraint frage_entscheidung_werte_passen_zu_schaltern
    check (
      (spielfortsetzung       is not null) = fordert_fortsetzung and
      (fortsetzung_fuer       is not null) = fordert_fortsetzung_fuer and
      (fortsetzung_ort        is not null) = fordert_fortsetzung_ort and
      (persoenliche_strafe    is not null) = fordert_strafe and
      (strafe_fuer_mannschaft is not null) = fordert_strafe_mannschaft and
      (strafe_fuer_rolle      is not null) = fordert_strafe_rolle and
      (strafe_rueckennummer   is not null) = fordert_strafe_nummer),

  add constraint frage_entscheidung_ort_nicht_leer
    check (fortsetzung_ort is null or btrim(fortsetzung_ort) <> ''),

  -- Weiterspielen und Schiedsrichter-Ball gehoeren keiner Mannschaft -
  -- danach zu fragen waere eine Fangfrage ohne Antwort.
  add constraint frage_entscheidung_richtung_zulaessig
    check (not (fordert_fortsetzung_fuer
                and spielfortsetzung in ('weiterspielen', 'sr_ball'))),

  -- Ohne Strafe gibt es niemanden zu benennen.
  add constraint frage_entscheidung_strafziel_zulaessig
    check (not ((fordert_strafe_mannschaft or fordert_strafe_rolle
                 or fordert_strafe_nummer)
                and coalesce(persoenliche_strafe, 'keine') = 'keine'));

-- ============================================================
--  4. Teilnoten duerfen leer sein
-- ============================================================
--
-- "War nicht gefragt" ist NULL, und das ist der ganze Sinn der Runde.
-- Ohne diese Aenderung scheitert jede Antwort auf eine Frage mit
-- abgeschalteten Bestandteilen an einer NOT-NULL-Verletzung.

alter table public.antwort_entscheidungen
  alter column fortsetzung_richtig   drop not null,
  alter column richtung_richtig      drop not null,
  alter column ort_richtig           drop not null,
  alter column strafe_richtig        drop not null,
  alter column strafziel_richtig     drop not null,
  alter column rolle_richtig         drop not null,
  alter column rueckennummer_richtig drop not null;

comment on column public.antwort_entscheidungen.fortsetzung_richtig is
  'true/false = gefragt und bewertet. NULL = dieser Bestandteil wurde von der Frage gar nicht verlangt (seit v101). Gilt sinngemaess fuer alle sieben Teilnoten.';

-- ============================================================
--  5. Schreiben: Schalter und Werte in einem Zug
-- ============================================================
--
-- Nicht verlangte Werte werden ausdruecklich auf NULL gesetzt, nicht
-- bloss nicht geschrieben. Sonst bliebe beim Umkonfigurieren einer
-- bestehenden Frage der alte Wert stehen - und die Pruefregel wuerde ihn
-- ablehnen, mit einer Meldung, die niemand einer vergessenen Zeile
-- zuordnen kann.

create or replace function public.frage_entscheidungsloesung_setzen(
  p_frage_id uuid, p_loesung jsonb)
returns void
language plpgsql
set search_path to public
as $function$
declare
  v_will_fortsetzung boolean;
  v_will_richtung    boolean;
  v_will_ort         boolean;
  v_will_strafe      boolean;
  v_will_mannschaft  boolean;
  v_will_rolle       boolean;
  v_will_nummer      boolean;
  v_strafe           text;
begin
  -- Fehlt ein Schalter im Aufruf, gilt der bisherige Zustand: alles
  -- verlangt. So schreibt eine aeltere App-Fassung, die die Schalter
  -- nicht kennt, weiterhin gueltige Zeilen (die Lektion aus v51b).
  v_will_fortsetzung := coalesce((p_loesung->>'fordert_fortsetzung')::boolean, true);
  v_will_strafe      := coalesce((p_loesung->>'fordert_strafe')::boolean, true);
  v_strafe           := nullif(p_loesung->>'persoenliche_strafe', '');

  v_will_richtung   := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_fuer')::boolean, true)
    and coalesce(p_loesung->>'spielfortsetzung', '') not in ('weiterspielen', 'sr_ball');
  v_will_ort        := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_ort')::boolean, true);
  v_will_mannschaft := v_will_strafe and coalesce(v_strafe, 'keine') <> 'keine'
    and coalesce((p_loesung->>'fordert_strafe_mannschaft')::boolean, true);
  v_will_rolle      := v_will_strafe and coalesce(v_strafe, 'keine') <> 'keine'
    and coalesce((p_loesung->>'fordert_strafe_rolle')::boolean, true);
  v_will_nummer     := v_will_strafe and coalesce(v_strafe, 'keine') <> 'keine'
    and coalesce((p_loesung->>'fordert_strafe_nummer')::boolean, false)
    and nullif(p_loesung->>'strafe_rueckennummer', '') is not null;

  if not (v_will_fortsetzung or v_will_strafe) then
    raise exception 'Die Frage verlangt weder Spielfortsetzung noch persoenliche Strafe';
  end if;

  insert into public.frage_entscheidungsloesungen (
    frage_id, spielfortsetzung, fortsetzung_fuer, fortsetzung_ort,
    persoenliche_strafe, strafe_fuer_mannschaft, strafe_fuer_rolle,
    strafe_rueckennummer, trikot_heim, trikot_gast,
    fordert_fortsetzung, fordert_fortsetzung_fuer, fordert_fortsetzung_ort,
    fordert_strafe, fordert_strafe_mannschaft, fordert_strafe_rolle,
    fordert_strafe_nummer, zeigt_trikotfarben, geaendert_am
  ) values (
    p_frage_id,
    case when v_will_fortsetzung then p_loesung->>'spielfortsetzung' end,
    case when v_will_richtung   then nullif(p_loesung->>'fortsetzung_fuer', '') end,
    case when v_will_ort        then nullif(btrim(p_loesung->>'fortsetzung_ort'), '') end,
    case when v_will_strafe     then v_strafe end,
    case when v_will_mannschaft then nullif(p_loesung->>'strafe_fuer_mannschaft', '') end,
    case when v_will_rolle      then nullif(p_loesung->>'strafe_fuer_rolle', '') end,
    case when v_will_nummer     then nullif(p_loesung->>'strafe_rueckennummer', '')::smallint end,
    coalesce(nullif(p_loesung->>'trikot_heim', ''), '#e4032e'),
    coalesce(nullif(p_loesung->>'trikot_gast', ''), '#1d4ed8'),
    v_will_fortsetzung, v_will_richtung, v_will_ort,
    v_will_strafe, v_will_mannschaft, v_will_rolle, v_will_nummer,
    coalesce((p_loesung->>'zeigt_trikotfarben')::boolean, true),
    now()
  )
  on conflict (frage_id) do update set
    spielfortsetzung          = excluded.spielfortsetzung,
    fortsetzung_fuer          = excluded.fortsetzung_fuer,
    fortsetzung_ort           = excluded.fortsetzung_ort,
    persoenliche_strafe       = excluded.persoenliche_strafe,
    strafe_fuer_mannschaft    = excluded.strafe_fuer_mannschaft,
    strafe_fuer_rolle         = excluded.strafe_fuer_rolle,
    strafe_rueckennummer      = excluded.strafe_rueckennummer,
    trikot_heim               = excluded.trikot_heim,
    trikot_gast               = excluded.trikot_gast,
    fordert_fortsetzung       = excluded.fordert_fortsetzung,
    fordert_fortsetzung_fuer  = excluded.fordert_fortsetzung_fuer,
    fordert_fortsetzung_ort   = excluded.fordert_fortsetzung_ort,
    fordert_strafe            = excluded.fordert_strafe,
    fordert_strafe_mannschaft = excluded.fordert_strafe_mannschaft,
    fordert_strafe_rolle      = excluded.fordert_strafe_rolle,
    fordert_strafe_nummer     = excluded.fordert_strafe_nummer,
    zeigt_trikotfarben        = excluded.zeigt_trikotfarben,
    geaendert_am              = now();
end;
$function$;

-- ============================================================
--  6. Die Ergebnisform, an genau einer Stelle
-- ============================================================
--
-- Vorher stand dasselbe jsonb_build_object dreimal woertlich in
-- entscheidung_antwort_speichern - einmal je Rueckgabeweg. Drei Kopien
-- sind der sicherste Weg, eine Aenderung nur zu zwei Dritteln zu machen.

create or replace function public.entscheidung_ergebnis_bauen(
  p_antwort jsonb, p_loesung jsonb, p_bereits_beantwortet boolean,
  p_fortsetzung_ok boolean, p_richtung_ok boolean, p_ort_ok boolean,
  p_strafe_ok boolean, p_strafziel_ok boolean, p_rolle_ok boolean,
  p_nummer_ok boolean, p_ort_feedback text)
returns jsonb
language sql
immutable
set search_path to public
as $function$
  select jsonb_build_object(
    'korrekt', coalesce(p_fortsetzung_ok, true) and coalesce(p_richtung_ok, true)
           and coalesce(p_ort_ok, true) and coalesce(p_strafe_ok, true)
           and coalesce(p_strafziel_ok, true) and coalesce(p_rolle_ok, true)
           and coalesce(p_nummer_ok, true),
    'bereits_beantwortet', p_bereits_beantwortet,
    'antwort', p_antwort,
    'loesung', p_loesung,
    'ergebnis', jsonb_build_object(
      'fortsetzung_richtig',   p_fortsetzung_ok,
      'richtung_richtig',      p_richtung_ok,
      'ort_richtig',           p_ort_ok,
      'strafe_richtig',        p_strafe_ok,
      'strafziel_richtig',     p_strafziel_ok,
      'rolle_richtig',         p_rolle_ok,
      'rueckennummer_richtig', p_nummer_ok,
      'ort_feedback',          p_ort_feedback));
$function$;

revoke all on function public.entscheidung_ergebnis_bauen(
  jsonb, jsonb, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text) from public;

-- ============================================================
--  7. Lesen fuer die App
-- ============================================================

drop function if exists public.obmann_frage_entscheidungsloesung_details(text, uuid);

create function public.obmann_frage_entscheidungsloesung_details(
  p_passwort text, p_frage_id uuid)
returns table(
  frage_id uuid, spielfortsetzung text, fortsetzung_fuer text,
  fortsetzung_ort text, persoenliche_strafe text,
  strafe_fuer_mannschaft text, strafe_fuer_rolle text,
  strafe_rueckennummer smallint, trikot_heim text, trikot_gast text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean)
language plpgsql
security definer
set search_path to public
as $function$
begin
  perform public.obmann_verein(p_passwort);

  return query
  select l.frage_id, l.spielfortsetzung, l.fortsetzung_fuer,
         l.fortsetzung_ort, l.persoenliche_strafe,
         l.strafe_fuer_mannschaft, l.strafe_fuer_rolle,
         l.strafe_rueckennummer, l.trikot_heim, l.trikot_gast,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben
  from public.frage_entscheidungsloesungen l
  where l.frage_id = p_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_entscheidungsloesung_details(text, uuid) from public;
grant execute on function public.obmann_frage_entscheidungsloesung_details(text, uuid) to anon, authenticated;

-- ============================================================
--  8. Lesen fuer das Quiz
-- ============================================================
--
-- Der Browser muss wissen, welche Felder er zeigen darf. Die
-- Loesungswerte bleiben draussen - nur "wird verlangt: ja/nein" geht
-- raus, das verraet nichts.
--
-- ACHTUNG, bestehende Schwachstelle (nicht von dieser Migration
-- eingefuehrt, hier nur festgehalten): fortsetzung_ort ist die RICHTIGE
-- Antwort und wird mit ausgeliefert, weil api/entscheidung-bewerten.js
-- sie fuer die KI-Bewertung braucht. Die Funktion ist an anon vergeben -
-- wer eine gueltige PIN hat, kann den Ort auslesen. Gehoert in eine
-- eigene Runde (Dienstschluessel oder Einmal-Nonce fuer den Serveraufruf).

drop function if exists public.entscheidung_kontext_laden(uuid, uuid, text);

create function public.entscheidung_kontext_laden(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text)
returns table(
  frage_text text, fortsetzung_ort text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean,
  trikot_heim text, trikot_gast text)
language plpgsql
security definer
set search_path to public
as $function$
declare v_pin text; v_aktiv boolean; v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  return query
  select f.frage_text, l.fortsetzung_ort,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben,
         l.trikot_heim, l.trikot_gast
  from public.fragen f
  join public.frage_entscheidungsloesungen l on l.frage_id = f.id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;
end;
$function$;

revoke all on function public.entscheidung_kontext_laden(uuid, uuid, text) from public;
grant execute on function public.entscheidung_kontext_laden(uuid, uuid, text) to anon, authenticated;

-- ============================================================
--  9. Bewerten: nur, was gefragt war
-- ============================================================
--
-- Ein nicht verlangter Bestandteil ergibt "null", nicht "false" - er
-- zaehlt weder als richtig noch als falsch, und die Oberflaeche kann ihn
-- im Ergebnis weglassen, statt einen Haken oder ein Kreuz zu zeigen, wo
-- nie eine Frage stand.
--
-- Die Schalter wandern in den loesung_snapshot. Wird eine Frage spaeter
-- umkonfiguriert, bleibt eine alte Antwort lesbar wie am Tag der Abgabe -
-- sonst zeigte die Historie ein Kreuz bei einem Feld, das es zum
-- Zeitpunkt der Antwort gar nicht gab.

create or replace function public.entscheidung_antwort_speichern(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb,
  p_ort_richtig boolean, p_ort_feedback text default null)
returns jsonb
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text; v_aktiv boolean; v_ist_test boolean; v_verein uuid;
  v_loesung public.frage_entscheidungsloesungen%rowtype;
  v_loesung_json jsonb; v_antwort_id uuid;
  v_alt public.antwort_entscheidungen%rowtype;
  v_fortsetzung_ok boolean; v_richtung_ok boolean; v_ort_ok boolean;
  v_strafe_ok boolean; v_strafziel_ok boolean; v_rolle_ok boolean;
  v_nummer_ok boolean; v_korrekt boolean;
  v_schalter jsonb;
begin
  select s.pin, s.aktiv, s.ist_test, s.verein_id
  into v_pin, v_aktiv, v_ist_test, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;
  if jsonb_typeof(p_antwort) <> 'object' then raise exception 'Antwort ungueltig'; end if;

  select l.* into v_loesung
  from public.frage_entscheidungsloesungen l
  join public.fragen f on f.id = l.frage_id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;

  -- Pflichtpruefung nach Konfiguration, nicht pauschal. Vorher war
  -- Spielfortsetzung IMMER Pflicht - bei einer reinen Strafenfrage haette
  -- der Aufrufer also etwas mitschicken muessen, wonach nie gefragt wurde.
  if v_loesung.fordert_fortsetzung then
    if p_antwort->>'spielfortsetzung' is null
       or p_antwort->>'spielfortsetzung' not in ('weiterspielen','direkter_freistoss',
          'indirekter_freistoss','strafstoss','sr_ball','eckstoss','abstoss','einwurf','anstoss') then
      raise exception 'Spielfortsetzung ungueltig';
    end if;
  end if;
  if v_loesung.fordert_strafe then
    if p_antwort->>'persoenliche_strafe' is null
       or p_antwort->>'persoenliche_strafe' not in ('keine','gelb','gelb_rot','rot') then
      raise exception 'Persoenliche Strafe ungueltig';
    end if;
  end if;

  v_schalter := jsonb_build_object(
    'fordert_fortsetzung',       v_loesung.fordert_fortsetzung,
    'fordert_fortsetzung_fuer',  v_loesung.fordert_fortsetzung_fuer,
    'fordert_fortsetzung_ort',   v_loesung.fordert_fortsetzung_ort,
    'fordert_strafe',            v_loesung.fordert_strafe,
    'fordert_strafe_mannschaft', v_loesung.fordert_strafe_mannschaft,
    'fordert_strafe_rolle',      v_loesung.fordert_strafe_rolle,
    'fordert_strafe_nummer',     v_loesung.fordert_strafe_nummer,
    'zeigt_trikotfarben',        v_loesung.zeigt_trikotfarben);

  select ae.* into v_alt from public.antworten a
  join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
  if found then
    return public.entscheidung_ergebnis_bauen(
      v_alt.gegebene_antwort, v_alt.loesung_snapshot, true,
      v_alt.fortsetzung_richtig, v_alt.richtung_richtig, v_alt.ort_richtig,
      v_alt.strafe_richtig, v_alt.strafziel_richtig, v_alt.rolle_richtig,
      v_alt.rueckennummer_richtig, v_alt.ort_feedback);
  end if;

  v_loesung_json := jsonb_build_object(
    'spielfortsetzung', v_loesung.spielfortsetzung,
    'fortsetzung_fuer', v_loesung.fortsetzung_fuer,
    'fortsetzung_ort', v_loesung.fortsetzung_ort,
    'persoenliche_strafe', v_loesung.persoenliche_strafe,
    'strafe_fuer_mannschaft', v_loesung.strafe_fuer_mannschaft,
    'strafe_fuer_rolle', v_loesung.strafe_fuer_rolle,
    'strafe_rueckennummer', v_loesung.strafe_rueckennummer,
    'trikot_heim', v_loesung.trikot_heim,
    'trikot_gast', v_loesung.trikot_gast)
    || v_schalter;

  -- null heisst "war nicht gefragt". Genau dieser Unterschied ist der
  -- Grund fuer die ganze Migration.
  v_fortsetzung_ok := case when v_loesung.fordert_fortsetzung
    then p_antwort->>'spielfortsetzung' = v_loesung.spielfortsetzung end;
  v_richtung_ok := case when v_loesung.fordert_fortsetzung_fuer
    then coalesce(nullif(p_antwort->>'fortsetzung_fuer', ''), '')
         = coalesce(v_loesung.fortsetzung_fuer, '') end;
  v_ort_ok := case when v_loesung.fordert_fortsetzung_ort
    then coalesce(p_ort_richtig, false) end;
  v_strafe_ok := case when v_loesung.fordert_strafe
    then p_antwort->>'persoenliche_strafe' = v_loesung.persoenliche_strafe end;
  v_strafziel_ok := case when v_loesung.fordert_strafe_mannschaft
    then coalesce(nullif(p_antwort->>'strafe_fuer_mannschaft', ''), '')
         = coalesce(v_loesung.strafe_fuer_mannschaft, '') end;
  v_rolle_ok := case when v_loesung.fordert_strafe_rolle
    then coalesce(nullif(p_antwort->>'strafe_fuer_rolle', ''), '')
         = coalesce(v_loesung.strafe_fuer_rolle, '') end;
  v_nummer_ok := case when v_loesung.fordert_strafe_nummer
    then nullif(p_antwort->>'strafe_rueckennummer', '')::smallint
         is not distinct from v_loesung.strafe_rueckennummer end;

  -- coalesce(..., true): ein nicht gefragter Bestandteil darf das
  -- Gesamtergebnis nicht kippen.
  v_korrekt := coalesce(v_fortsetzung_ok, true) and coalesce(v_richtung_ok, true)
    and coalesce(v_ort_ok, true) and coalesce(v_strafe_ok, true)
    and coalesce(v_strafziel_ok, true) and coalesce(v_rolle_ok, true)
    and coalesce(v_nummer_ok, true);

  if not v_ist_test then
    insert into public.antworten (schiedsrichter_id, frage_id, gegebene_option,
      korrekt, gegebener_freitext, ki_feedback, bewertungsstatus, versuch_anzahl)
    values (p_schiedsrichter_id, p_frage_id, null, v_korrekt,
      public.entscheidung_anzeige(p_antwort), nullif(btrim(p_ort_feedback), ''),
      case when v_korrekt then 'richtig' else 'falsch' end, 1)
    on conflict (schiedsrichter_id, frage_id) do nothing returning id into v_antwort_id;

    if v_antwort_id is null then
      select ae.* into v_alt from public.antworten a
      join public.antwort_entscheidungen ae on ae.antwort_id = a.id
      where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
      if found then
        return public.entscheidung_ergebnis_bauen(
          v_alt.gegebene_antwort, v_alt.loesung_snapshot, true,
          v_alt.fortsetzung_richtig, v_alt.richtung_richtig, v_alt.ort_richtig,
          v_alt.strafe_richtig, v_alt.strafziel_richtig, v_alt.rolle_richtig,
          v_alt.rueckennummer_richtig, v_alt.ort_feedback);
      end if;
      raise exception 'Antwort konnte nicht gespeichert werden';
    end if;

    insert into public.antwort_entscheidungen (antwort_id, gegebene_antwort,
      loesung_snapshot, fortsetzung_richtig, richtung_richtig, ort_richtig,
      strafe_richtig, strafziel_richtig, rolle_richtig, rueckennummer_richtig, ort_feedback)
    values (v_antwort_id, p_antwort, v_loesung_json,
      v_fortsetzung_ok, v_richtung_ok, v_ort_ok, v_strafe_ok,
      v_strafziel_ok, v_rolle_ok, v_nummer_ok, nullif(btrim(p_ort_feedback), ''));
  end if;

  return public.entscheidung_ergebnis_bauen(
    p_antwort, v_loesung_json, false,
    v_fortsetzung_ok, v_richtung_ok, v_ort_ok, v_strafe_ok,
    v_strafziel_ok, v_rolle_ok, v_nummer_ok, nullif(btrim(p_ort_feedback), ''));
end;
$function$;
