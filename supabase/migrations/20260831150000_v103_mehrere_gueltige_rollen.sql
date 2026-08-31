-- v103_mehrere_gueltige_rollen (31.08.2026)
--
-- Max an einem echten Fall: "Das war jetzt ein Sonderfall - da war jemand
-- Trainer, also Trainer und Auswechselspieler. Dann kann man natuerlich
-- Trainer und Auswechselspieler anklicken. Beides muss dann auch richtig
-- zaehlen, sodass man auf der Webseite nur eins anklicken kann, aber dass
-- man, wenn man die Frage hinzufuegt, mehr selektieren kann."
--
-- Der Fall ist nicht selten: der Spielertrainer, der als
-- Auswechselspieler auf der Bank sitzt, ist beides zugleich. Bisher
-- musste sich der Obmann fuer eine Rolle entscheiden - und wer die
-- andere, ebenso richtige, ankreuzte, bekam ein Kreuz.
--
-- ============================================================
--  Warum eine Spalte dazukommt und die alte bleibt
-- ============================================================
--
-- strafe_fuer_rolle bleibt die EINE Rolle, die in der Aufloesung genannt
-- wird ("richtig: Trainer"). Daneben steht strafe_rollen_gueltig: alle
-- Rollen, die als richtig zaehlen. Die genannte ist immer eine davon -
-- das erzwingt eine Pruefregel, sonst zeigte die Aufloesung eine
-- Antwort, die die Bewertung selbst ablehnt.
--
-- Die Alternative waere gewesen, strafe_fuer_rolle durch ein Array zu
-- ersetzen. Dagegen spricht, dass dann jede Anzeige eine Liste
-- formatieren muesste, obwohl fast immer genau eine Rolle gemeint ist -
-- und dass alle bestehenden Antworten samt Schnappschuessen
-- umgeschrieben werden muessten.
--
-- Hinweis: in der Live-Datenbank in zwei Schritten angewandt (v103 und
-- v103b). v103 legte Spalte und Hilfsfunktion an, benutzte sie in der
-- Bewertung aber noch nicht - genau die Haelfte, die man beim Aufteilen
-- einer Aenderung vergisst. Diese Datei ist der Endstand.

alter table public.frage_entscheidungsloesungen
  add column if not exists strafe_rollen_gueltig text[];

update public.frage_entscheidungsloesungen
   set strafe_rollen_gueltig = array[strafe_fuer_rolle]
 where strafe_fuer_rolle is not null and strafe_rollen_gueltig is null;

alter table public.frage_entscheidungsloesungen
  add constraint frage_entscheidung_rollen_gueltig_werte
    check (strafe_rollen_gueltig is null or (
      array_length(strafe_rollen_gueltig, 1) between 1 and 4
      and strafe_rollen_gueltig <@ array['feldspieler','torwart','auswechselspieler','trainer']::text[])),

  add constraint frage_entscheidung_rollen_passt_zum_schalter
    check ((strafe_rollen_gueltig is not null) = fordert_strafe_rolle),

  -- Die angezeigte Rolle muss unter den gueltigen sein.
  add constraint frage_entscheidung_rolle_ist_gueltig
    check (strafe_fuer_rolle is null
           or strafe_fuer_rolle = any(strafe_rollen_gueltig));

comment on column public.frage_entscheidungsloesungen.strafe_rollen_gueltig is
  'Alle Rollen, die als richtig zaehlen - z.B. {trainer,auswechselspieler} beim Spielertrainer auf der Bank. strafe_fuer_rolle ist die davon, die in der Aufloesung genannt wird.';

create or replace function public.entscheidung_teilnote_rolle(
  p_gewaehlt text, p_gueltige text[])
returns boolean
language sql
immutable
set search_path to public
as $function$
  select coalesce(nullif(p_gewaehlt, ''), '') = any(coalesce(p_gueltige, array['']::text[]));
$function$;

comment on function public.entscheidung_teilnote_rolle(text, text[]) is
  'true, wenn die gewaehlte Rolle unter den hinterlegten gueltigen steht. Beim Spielertrainer auf der Bank zaehlen Trainer UND Auswechselspieler (v103).';

revoke all on function public.entscheidung_teilnote_rolle(text, text[]) from public;

-- ============================================================
--  Schreiben: Rollenliste mit fuehren
-- ============================================================

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
  v_rollen           text[];
  v_rolle            text;
begin
  -- Fehlt ein Schalter im Aufruf, gilt der bisherige Zustand: alles
  -- verlangt. So schreibt eine aeltere App-Fassung weiterhin gueltige
  -- Zeilen (die Lektion aus v51b).
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

  -- Rollen: entweder die neue Liste oder - fuer aeltere App-Fassungen,
  -- die sie nicht kennt - die eine bisherige Rolle als einelementige
  -- Liste.
  v_rolle := nullif(p_loesung->>'strafe_fuer_rolle', '');
  if v_will_rolle then
    if p_loesung ? 'strafe_rollen_gueltig'
       and jsonb_typeof(p_loesung->'strafe_rollen_gueltig') = 'array'
       and jsonb_array_length(p_loesung->'strafe_rollen_gueltig') > 0 then
      select array_agg(distinct wert) into v_rollen
      from jsonb_array_elements_text(p_loesung->'strafe_rollen_gueltig') as t(wert);
    else
      v_rollen := array[v_rolle];
    end if;
    -- Die genannte Rolle muss in der Liste stehen. Fehlt sie, ist die
    -- Liste massgeblich - besser als eine Aufloesung, die sich selbst
    -- widerspricht.
    if v_rolle is null or not (v_rolle = any(v_rollen)) then
      v_rolle := v_rollen[1];
    end if;
  else
    v_rollen := null;
    v_rolle  := null;
  end if;

  insert into public.frage_entscheidungsloesungen (
    frage_id, spielfortsetzung, fortsetzung_fuer, fortsetzung_ort,
    persoenliche_strafe, strafe_fuer_mannschaft, strafe_fuer_rolle,
    strafe_rollen_gueltig, strafe_rueckennummer, trikot_heim, trikot_gast,
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
    v_rolle,
    v_rollen,
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
    strafe_rollen_gueltig     = excluded.strafe_rollen_gueltig,
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
--  Bewerten: jede hinterlegte Rolle zaehlt
-- ============================================================
--
-- Gegenueber v101 aendert sich genau eine Zuweisung (v_rolle_ok) und ein
-- Eintrag im Schnappschuss. Der Rest ist wortgleich - plpgsql kennt kein
-- Ersetzen einzelner Zeilen, deshalb steht die Funktion hier vollstaendig.

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

  -- Pflichtpruefung nach Konfiguration, nicht pauschal (v101).
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
    'strafe_fuer_rolle', v_loesung.strafe_fuer_rolle,
    -- Gehoert in den Schnappschuss: sonst zeigt die Historie spaeter ein
    -- Kreuz bei einer Rolle, die zum Zeitpunkt der Antwort richtig war.
    'strafe_rollen_gueltig', to_jsonb(v_loesung.strafe_rollen_gueltig),
    'strafe_fuer_mannschaft', v_loesung.strafe_fuer_mannschaft,
    'strafe_rueckennummer', v_loesung.strafe_rueckennummer,
    'trikot_heim', v_loesung.trikot_heim,
    'trikot_gast', v_loesung.trikot_gast)
    || v_schalter;

  -- null heisst "war nicht gefragt" (v101).
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
  -- v103: jede hinterlegte Rolle zaehlt, nicht nur die angezeigte.
  v_rolle_ok := case when v_loesung.fordert_strafe_rolle
    then public.entscheidung_teilnote_rolle(
           p_antwort->>'strafe_fuer_rolle', v_loesung.strafe_rollen_gueltig) end;
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

-- ============================================================
--  Die App braucht die Liste fuer den Editor
-- ============================================================

drop function if exists public.obmann_frage_entscheidungsloesung_details(text, uuid);

create function public.obmann_frage_entscheidungsloesung_details(
  p_passwort text, p_frage_id uuid)
returns table(
  frage_id uuid, spielfortsetzung text, fortsetzung_fuer text,
  fortsetzung_ort text, persoenliche_strafe text,
  strafe_fuer_mannschaft text, strafe_fuer_rolle text,
  strafe_rollen_gueltig text[],
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
         l.strafe_rollen_gueltig,
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
