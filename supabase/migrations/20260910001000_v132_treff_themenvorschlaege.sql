-- v132: Themen und Fragen fuer den naechsten vereinsinternen Schiri-Treff.
--
-- Ein kurzer Treff-Vorschlag ist ein weiterer Meldebogen-Typ, kein zweites
-- Nachrichtensystem. Dadurch erscheinen Vorschlaege im vorhandenen Eingang
-- des Obmanns und verwenden dessen Status-, Frist- und Loeschfunktionen.
-- Ausfuehrlich ausgearbeitete Quizfragen bleiben dagegen in der bereits
-- vorhandenen Tabelle fragenvorschlaege.
--
-- Die bestehende PIN-pruefende SECURITY-DEFINER-Funktion wird nicht als
-- vollstaendige Kopie weitergefuehrt. Wir ergaenzen ihre aktuelle Definition
-- an kontrollierten Ankern; fehlt ein Anker, bricht die Migration ab.

alter table public.meldungen
  drop constraint if exists meldungen_art_gueltig;

alter table public.meldungen
  add constraint meldungen_art_gueltig
  check (art in ('treff','regelfall','vorfall','gespraech','website'));

do $mig$
declare
  v_def text;
  v_anker text;
begin
  ------------------------------------------------------------------
  -- 1) Abgabe: den neuen Typ serverseitig zulassen
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'meldebogen_abgeben'
     and pg_get_function_identity_arguments(p.oid) =
       'p_schiedsrichter_id uuid, p_pin text, p_art text, p_situation text, p_anonym boolean, p_spielklasse text, p_eigene_entscheidung text, p_unsicher_warum text, p_beteiligte text, p_sonderbericht_geschrieben boolean, p_veroeffentlichung_erlaubt boolean';

  if v_def is null then
    raise exception 'meldebogen_abgeben mit erwarteter Signatur nicht gefunden';
  end if;

  v_anker := $q$p_art not in ('regelfall','vorfall','gespraech','website')$q$;
  if position(v_anker in v_def) = 0 then
    raise exception 'Meldungsarten-Anker in meldebogen_abgeben nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    $q$p_art not in ('treff','regelfall','vorfall','gespraech','website')$q$);
  execute v_def;

  ------------------------------------------------------------------
  -- 2) Eingang: Treff-Ideen eindeutig beschriften
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'obmann_eingang'
     and pg_get_function_identity_arguments(p.oid) =
       'p_passwort text, p_art text, p_limit integer, p_nur_offen boolean';

  if v_def is null then
    raise exception 'obmann_eingang mit erwarteter Signatur nicht gefunden';
  end if;

  v_anker := $q$        when 'regelfall' then 'Regelfall'$q$;
  if position(v_anker in v_def) = 0 then
    raise exception 'Meldebogen-Titelanker in obmann_eingang nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    $q$        when 'treff'     then 'Thema fuer Schiri-Treff'
        when 'regelfall' then 'Regelfall'$q$);
  execute v_def;
end
$mig$;

-- CREATE OR REPLACE darf die Rechte nicht versehentlich erweitern. Die
-- Funktion bleibt ausschliesslich ueber die vorhandene, intern pruefende
-- PIN-Schnittstelle erreichbar.
revoke all on function public.meldebogen_abgeben(
  uuid, text, text, text, boolean, text, text, text, text, boolean, boolean
) from public;
grant execute on function public.meldebogen_abgeben(
  uuid, text, text, text, boolean, text, text, text, text, boolean, boolean
) to anon, authenticated;

-- Gegenprobe: Constraint, Abgabe und Obmann-Eingang muessen den neuen Typ
-- gemeinsam kennen. So kann das Formular nicht erfolgreich wirken, waehrend
-- die Datenbank den Vorschlag ablehnt oder der Eingang namenlos bleibt.
do $pruef$
declare
  v_constraint text;
begin
  select pg_get_constraintdef(c.oid) into v_constraint
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'meldungen'
     and c.conname = 'meldungen_art_gueltig';

  if v_constraint is null or position('treff' in v_constraint) = 0 then
    raise exception 'meldungen_art_gueltig kennt treff nicht';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'meldebogen_abgeben'
       and p.prosrc like '%''treff'',''regelfall''%'
  ) then
    raise exception 'meldebogen_abgeben kennt treff nicht';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'obmann_eingang'
       and p.prosrc like '%Thema fuer Schiri-Treff%'
  ) then
    raise exception 'obmann_eingang beschriftet Treff-Ideen nicht';
  end if;
end
$pruef$;

comment on constraint meldungen_art_gueltig on public.meldungen is
  'Zulaessige Wege im Bereich Ideen und Feedback, inklusive Themen fuer den vereinsinternen Schiri-Treff.';
