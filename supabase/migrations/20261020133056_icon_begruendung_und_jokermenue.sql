-- Opt-in only: no existing question, response or Joker inventory is changed.
alter table public.frage_entscheidungsloesungen
  add column fordert_begruendung boolean not null default false,
  add column begruendung_muster text,
  add column begruendung_gewicht smallint not null default 3,
  add constraint entscheidung_begruendung_config check (
    begruendung_gewicht between 0 and 5
    and coalesce(length(begruendung_muster),0)<=2000
    and (not fordert_begruendung or coalesce(length(btrim(begruendung_muster)),0) between 1 and 2000));

-- All fixed fields are compared inside the database; no AI call needed.
create function private.entscheidung_kern_richtig(p_frage uuid,p_antwort jsonb)
returns boolean language plpgsql stable set search_path='' as $function$
declare l public.frage_entscheidungsloesungen; n jsonb; g jsonb;
begin
 select * into l from public.frage_entscheidungsloesungen where frage_id=p_frage;
 if not found then return false; end if;
 if l.fordert_fortsetzung and not coalesce(p_antwort->>'spielfortsetzung'=any(l.spielfortsetzungen_gueltig),false) then return false; end if;
 if l.fordert_fortsetzung and l.fordert_fortsetzung_fuer
   and p_antwort->>'spielfortsetzung' not in ('weiterspielen','sr_ball')
   and p_antwort->>'fortsetzung_fuer' is distinct from l.fortsetzung_fuer then return false; end if;
 if l.fordert_strafe then
  g:=case when jsonb_typeof(p_antwort->'strafen')='array' then p_antwort->'strafen'
    when coalesce(p_antwort->>'persoenliche_strafe','keine')='keine' then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('strafe',p_antwort->>'persoenliche_strafe',
      'fuer_mannschaft',p_antwort->>'strafe_fuer_mannschaft','strafe_fuer_rolle',p_antwort->>'strafe_fuer_rolle',
      'rueckennummer',p_antwort->>'strafe_rueckennummer')) end;
  n:=public.entscheidung_strafen_vergleich(g,public.entscheidung_strafen_liste(p_frage),
    l.fordert_strafe_mannschaft,l.fordert_strafe_rolle,l.fordert_strafe_nummer);
  if false in (select (value#>>'{}')::boolean from jsonb_each(n)) then return false; end if;
 end if;
 return true;
end; $function$;

create function public.entscheidung_kontext_v3(p_schiedsrichter_id uuid,p_frage_id uuid,p_pin text,p_antwort jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare c jsonb;
begin
 -- Reuse the complete PIN/club/current-round/active-question checks.
 select to_jsonb(x) into c from public.entscheidung_kontext_laden(p_schiedsrichter_id,p_frage_id,p_pin) x;
 return c || (select jsonb_build_object('fordert_begruendung',l.fordert_begruendung,
   'begruendung_muster',l.begruendung_muster,'begruendung_gewicht',l.begruendung_gewicht,
   'kern_richtig',private.entscheidung_kern_richtig(p_frage_id,p_antwort))
   from public.frage_entscheidungsloesungen l where l.frage_id=p_frage_id);
end; $function$;

create function public.duell_entscheidung_kontext_v3(p_zugang uuid,p_frage_id uuid,p_antwort jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
 return public.duell_entscheidung_kontext(p_zugang,p_frage_id)
   || jsonb_build_object('kern_richtig',private.entscheidung_kern_richtig(p_frage_id,p_antwort));
end; $function$;

CREATE OR REPLACE FUNCTION public.frage_entscheidungsloesung_setzen(p_frage_id uuid, p_loesung jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_will_fortsetzung boolean; v_will_richtung boolean; v_will_ort boolean;
  v_will_strafe boolean; v_will_mannschaft boolean; v_will_rolle boolean;
  v_will_nummer boolean;
  v_strafen jsonb; v_eintrag jsonb; v_pos smallint := 0;
  v_erste jsonb; v_rollen text[]; v_rolle text;
begin
  v_will_fortsetzung := coalesce((p_loesung->>'fordert_fortsetzung')::boolean, true);
  v_will_strafe      := coalesce((p_loesung->>'fordert_strafe')::boolean, true);

  -- Strafenliste: neu "strafen", sonst aus den Einzelfeldern gebaut.
  if p_loesung ? 'strafen' and jsonb_typeof(p_loesung->'strafen') = 'array' then
    v_strafen := p_loesung->'strafen';
  elsif coalesce(nullif(p_loesung->>'persoenliche_strafe', ''), 'keine') <> 'keine' then
    v_strafen := jsonb_build_array(jsonb_build_object(
      'strafe', p_loesung->>'persoenliche_strafe',
      'fuer_mannschaft', nullif(p_loesung->>'strafe_fuer_mannschaft', ''),
      'strafe_fuer_rolle', nullif(p_loesung->>'strafe_fuer_rolle', ''),
      'rollen_gueltig', p_loesung->'strafe_rollen_gueltig',
      'rueckennummer', nullif(p_loesung->>'strafe_rueckennummer', '')));
  else
    v_strafen := '[]'::jsonb;
  end if;

  if not v_will_strafe or jsonb_array_length(v_strafen) = 0 then
    v_strafen := '[]'::jsonb;
    v_will_strafe := v_will_strafe;  -- "keine Strafe" bleibt eine Antwort
  end if;

  v_will_richtung   := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_fuer')::boolean, true)
    and coalesce(p_loesung->>'spielfortsetzung', '') not in ('weiterspielen', 'sr_ball');
  v_will_ort        := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_ort')::boolean, true);
  v_will_mannschaft := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_mannschaft')::boolean, true);
  v_will_rolle      := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_rolle')::boolean, true);
  v_will_nummer     := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_nummer')::boolean, false);

  if not (v_will_fortsetzung or v_will_strafe) then
    raise exception 'Die Frage verlangt weder Spielfortsetzung noch persoenliche Strafe';
  end if;

  v_erste := v_strafen->0;

  -- Elternsatz: spiegelt die erste Strafe fuer aeltere Leser.
  if v_erste is not null then
    v_rollen := case when v_will_rolle then (
      select coalesce(nullif(array(select jsonb_array_elements_text(
               coalesce(v_erste->'rollen_gueltig', '[]'::jsonb))), '{}'),
             array[nullif(v_erste->>'strafe_fuer_rolle', '')])) end;
    v_rolle := case when v_will_rolle then
      coalesce(nullif(v_erste->>'strafe_fuer_rolle', ''), v_rollen[1]) end;
    if v_will_rolle and (v_rolle is null or not (v_rolle = any(v_rollen))) then
      v_rolle := v_rollen[1];
    end if;
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
    case when v_will_strafe then coalesce(v_erste->>'strafe', 'keine') end,
    case when v_will_mannschaft then nullif(v_erste->>'fuer_mannschaft', '') end,
    v_rolle, v_rollen,
    case when v_will_nummer then nullif(v_erste->>'rueckennummer', '')::smallint end,
    coalesce(nullif(p_loesung->>'trikot_heim', ''), '#e4032e'),
    coalesce(nullif(p_loesung->>'trikot_gast', ''), '#1d4ed8'),
    v_will_fortsetzung, v_will_richtung, v_will_ort,
    v_will_strafe, v_will_mannschaft, v_will_rolle, v_will_nummer,
    coalesce((p_loesung->>'zeigt_trikotfarben')::boolean, true),
    now()
  )
  on conflict (frage_id) do update set
    spielfortsetzung = excluded.spielfortsetzung,
    fortsetzung_fuer = excluded.fortsetzung_fuer,
    fortsetzung_ort = excluded.fortsetzung_ort,
    persoenliche_strafe = excluded.persoenliche_strafe,
    strafe_fuer_mannschaft = excluded.strafe_fuer_mannschaft,
    strafe_fuer_rolle = excluded.strafe_fuer_rolle,
    strafe_rollen_gueltig = excluded.strafe_rollen_gueltig,
    strafe_rueckennummer = excluded.strafe_rueckennummer,
    trikot_heim = excluded.trikot_heim, trikot_gast = excluded.trikot_gast,
    fordert_fortsetzung = excluded.fordert_fortsetzung,
    fordert_fortsetzung_fuer = excluded.fordert_fortsetzung_fuer,
    fordert_fortsetzung_ort = excluded.fordert_fortsetzung_ort,
    fordert_strafe = excluded.fordert_strafe,
    fordert_strafe_mannschaft = excluded.fordert_strafe_mannschaft,
    fordert_strafe_rolle = excluded.fordert_strafe_rolle,
    fordert_strafe_nummer = excluded.fordert_strafe_nummer,
    zeigt_trikotfarben = excluded.zeigt_trikotfarben,
    geaendert_am = now();

  -- Alte App-Versionen ohne diese Schlüssel dürfen die neue Konfiguration nicht löschen.
  update public.frage_entscheidungsloesungen set
    fordert_begruendung = case when p_loesung ? 'fordert_begruendung' then (p_loesung->>'fordert_begruendung')::boolean else fordert_begruendung end,
    begruendung_muster = case when p_loesung ? 'begruendung_muster' then nullif(btrim(p_loesung->>'begruendung_muster'),'') else begruendung_muster end,
    begruendung_gewicht = case when p_loesung ? 'begruendung_gewicht' then (p_loesung->>'begruendung_gewicht')::smallint else begruendung_gewicht end
  where frage_id=p_frage_id;

  -- Die Liste wird immer komplett neu geschrieben. Einzelne Zeilen zu
  -- aktualisieren hiesse, geloeschte Strafen zu uebersehen.
  delete from public.frage_entscheidung_strafen where frage_id = p_frage_id;

  for v_eintrag in select * from jsonb_array_elements(v_strafen) loop
    v_pos := v_pos + 1;
    v_rollen := case when v_will_rolle then (
      select coalesce(nullif(array(select jsonb_array_elements_text(
               coalesce(v_eintrag->'rollen_gueltig', '[]'::jsonb))), '{}'),
             array[nullif(v_eintrag->>'strafe_fuer_rolle', '')])) end;
    v_rolle := case when v_will_rolle then
      coalesce(nullif(v_eintrag->>'strafe_fuer_rolle', ''), v_rollen[1]) end;
    if v_will_rolle and (v_rolle is null or not (v_rolle = any(v_rollen))) then
      v_rolle := v_rollen[1];
    end if;

    insert into public.frage_entscheidung_strafen (
      frage_id, position, strafe, fuer_mannschaft, rolle_anzeige,
      rollen_gueltig, rueckennummer)
    values (p_frage_id, v_pos, v_eintrag->>'strafe',
      case when v_will_mannschaft then nullif(v_eintrag->>'fuer_mannschaft', '') end,
      v_rolle, v_rollen,
      case when v_will_nummer then nullif(v_eintrag->>'rueckennummer', '')::smallint end);
  end loop;
end;
$function$;
CREATE OR REPLACE FUNCTION public.entscheidung_ergebnis_bauen(p_antwort jsonb, p_loesung jsonb, p_bereits_beantwortet boolean, p_fortsetzung_ok boolean, p_richtung_ok boolean, p_ort_ok boolean, p_strafe_ok boolean, p_strafziel_ok boolean, p_rolle_ok boolean, p_nummer_ok boolean, p_ort_feedback text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'korrekt', coalesce(p_fortsetzung_ok, true) and coalesce(p_richtung_ok, true)
           and coalesce(p_ort_ok, true) and coalesce(p_strafe_ok, true)
           and coalesce(p_strafziel_ok, true) and coalesce(p_rolle_ok, true)
           and coalesce(p_nummer_ok, true)
           and (not coalesce((p_loesung->>'fordert_begruendung')::boolean,false)
                or coalesce((p_antwort#>>'{_begruendung,richtig}')::boolean,false)),
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
      'begruendung_richtig', case when coalesce((p_loesung->>'fordert_begruendung')::boolean,false) then coalesce((p_antwort#>>'{_begruendung,richtig}')::boolean,false) end,
      'begruendung_feedback', p_antwort#>>'{_begruendung,feedback}',
      'ort_feedback',          p_ort_feedback));
$function$;
CREATE OR REPLACE FUNCTION public.entscheidung_antwort_speichern(p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb, p_ort_richtig boolean, p_ort_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pin text; v_aktiv boolean; v_ist_test boolean; v_verein uuid;
  v_loesung public.frage_entscheidungsloesungen%rowtype;
  v_loesung_json jsonb; v_antwort_id uuid;
  v_alt public.antwort_entscheidungen%rowtype;
  v_fortsetzung_ok boolean; v_richtung_ok boolean; v_ort_ok boolean;
  v_strafe_ok boolean; v_strafziel_ok boolean; v_rolle_ok boolean;
  v_nummer_ok boolean; v_korrekt boolean;
  v_schalter jsonb; v_strafen_l jsonb; v_strafen_g jsonb; v_noten jsonb;
begin
  select s.pin, s.aktiv, s.ist_test, s.verein_id into v_pin, v_aktiv, v_ist_test, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if jsonb_typeof(p_antwort) <> 'object' then raise exception 'Antwort ungueltig'; end if;

  select l.* into v_loesung
  from public.frage_entscheidungsloesungen l
  join public.fragen f on f.id = l.frage_id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;

  if v_loesung.fordert_fortsetzung then
    if p_antwort->>'spielfortsetzung' is null
       or p_antwort->>'spielfortsetzung' not in ('weiterspielen','direkter_freistoss',
          'indirekter_freistoss','strafstoss','sr_ball','eckstoss','abstoss','einwurf','anstoss') then
      raise exception 'Spielfortsetzung ungueltig';
    end if;
  end if;

  -- Gegebene Strafen: neue Liste, sonst aus den Einzelfeldern. So laeuft
  -- die heute ausgelieferte Website weiter.
  if p_antwort ? 'strafen' and jsonb_typeof(p_antwort->'strafen') = 'array' then
    v_strafen_g := p_antwort->'strafen';
  elsif coalesce(nullif(p_antwort->>'persoenliche_strafe', ''), 'keine') <> 'keine' then
    v_strafen_g := jsonb_build_array(jsonb_build_object(
      'strafe', p_antwort->>'persoenliche_strafe',
      'fuer_mannschaft', nullif(p_antwort->>'strafe_fuer_mannschaft', ''),
      'strafe_fuer_rolle', nullif(p_antwort->>'strafe_fuer_rolle', ''),
      'rueckennummer', nullif(p_antwort->>'strafe_rueckennummer', '')));
  else
    v_strafen_g := '[]'::jsonb;
  end if;

  if v_loesung.fordert_strafe then
    if not (p_antwort ? 'strafen')
       and (p_antwort->>'persoenliche_strafe' is null
            or p_antwort->>'persoenliche_strafe' not in ('keine','gelb','gelb_rot','rot')) then
      raise exception 'Persoenliche Strafe ungueltig';
    end if;
    if exists (select 1 from jsonb_array_elements(v_strafen_g) e
               where e->>'strafe' not in ('gelb','gelb_rot','rot')) then
      raise exception 'Persoenliche Strafe ungueltig';
    end if;
  end if;

  v_strafen_l := public.entscheidung_strafen_liste(p_frage_id);

  v_schalter := jsonb_build_object(
    'fordert_fortsetzung', v_loesung.fordert_fortsetzung,
    'fordert_fortsetzung_fuer', v_loesung.fordert_fortsetzung_fuer,
    'fordert_fortsetzung_ort', v_loesung.fordert_fortsetzung_ort,
    'fordert_strafe', v_loesung.fordert_strafe,
    'fordert_strafe_mannschaft', v_loesung.fordert_strafe_mannschaft,
    'fordert_strafe_rolle', v_loesung.fordert_strafe_rolle,
    'fordert_strafe_nummer', v_loesung.fordert_strafe_nummer,
    'zeigt_trikotfarben', v_loesung.zeigt_trikotfarben,
    'fordert_begruendung', v_loesung.fordert_begruendung,
    'begruendung_muster', v_loesung.begruendung_muster);

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

  if v_loesung.fordert_begruendung and (length(btrim(coalesce(p_antwort->>'begruendung',''))) not between 1 and 600
     or jsonb_typeof(p_antwort#>'{_begruendung,richtig}') is distinct from 'boolean') then
    raise exception 'Begründungsprüfung fehlt. Bitte Quiz neu laden';
  end if;
  v_loesung_json := jsonb_build_object(
    'spielfortsetzung', v_loesung.spielfortsetzung,
    'fortsetzung_fuer', v_loesung.fortsetzung_fuer,
    'fortsetzung_ort', v_loesung.fortsetzung_ort,
    'persoenliche_strafe', v_loesung.persoenliche_strafe,
    'strafe_fuer_mannschaft', v_loesung.strafe_fuer_mannschaft,
    'strafe_fuer_rolle', v_loesung.strafe_fuer_rolle,
    'strafe_rollen_gueltig', to_jsonb(v_loesung.strafe_rollen_gueltig),
    'strafe_rueckennummer', v_loesung.strafe_rueckennummer,
    'strafen', v_strafen_l,
    'trikot_heim', v_loesung.trikot_heim,
    'trikot_gast', v_loesung.trikot_gast) || v_schalter;

  v_fortsetzung_ok := case when v_loesung.fordert_fortsetzung
    then p_antwort->>'spielfortsetzung' = v_loesung.spielfortsetzung end;
  v_richtung_ok := case when v_loesung.fordert_fortsetzung_fuer
    then coalesce(nullif(p_antwort->>'fortsetzung_fuer', ''), '')
         = coalesce(v_loesung.fortsetzung_fuer, '') end;
  v_ort_ok := case when v_loesung.fordert_fortsetzung_ort
    then coalesce(p_ort_richtig, false) end;

  if v_loesung.fordert_strafe then
    v_noten := public.entscheidung_strafen_vergleich(
      v_strafen_g, v_strafen_l,
      v_loesung.fordert_strafe_mannschaft,
      v_loesung.fordert_strafe_rolle,
      v_loesung.fordert_strafe_nummer);
    v_strafe_ok    := (v_noten->>'strafe_richtig')::boolean;
    v_strafziel_ok := (v_noten->>'strafziel_richtig')::boolean;
    v_rolle_ok     := (v_noten->>'rolle_richtig')::boolean;
    v_nummer_ok    := (v_noten->>'rueckennummer_richtig')::boolean;
  end if;

  v_korrekt := coalesce(v_fortsetzung_ok, true) and coalesce(v_richtung_ok, true)
    and coalesce(v_ort_ok, true) and coalesce(v_strafe_ok, true)
    and coalesce(v_strafziel_ok, true) and coalesce(v_rolle_ok, true)
    and coalesce(v_nummer_ok, true)
    and (not v_loesung.fordert_begruendung or coalesce((p_antwort#>>'{_begruendung,richtig}')::boolean,false));

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
CREATE OR REPLACE FUNCTION public.entscheidung_antwort_speichern_v2(p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb, p_ort_richtig boolean, p_ort_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_basis jsonb; v_antwort jsonb; v_loesung jsonb;
  v_fortsetzungen text[]; v_fordert_fortsetzung boolean; v_fordert_richtung boolean;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean;
  v_ziel boolean; v_rolle boolean; v_nummer boolean; v_korrekt boolean;
  v_bereits boolean; v_antwort_id uuid; v_ort_text text;
begin
  select l.spielfortsetzungen_gueltig, l.fordert_fortsetzung, l.fordert_fortsetzung_fuer
  into v_fortsetzungen, v_fordert_fortsetzung, v_fordert_richtung
  from public.frage_entscheidungsloesungen l where l.frage_id = p_frage_id;

  v_basis := public.entscheidung_antwort_speichern(
    p_schiedsrichter_id, p_frage_id, p_pin, p_antwort,
    p_ort_richtig, p_ort_feedback);

  -- Wiederholte Requests ändern keine historische Bewertung/Snapshots.
  if coalesce((v_basis->>'bereits_beantwortet')::boolean,false) then return v_basis; end if;
  v_antwort := coalesce(v_basis->'antwort', p_antwort);
  v_loesung := coalesce(v_basis->'loesung', '{}'::jsonb)
    || jsonb_build_object('spielfortsetzungen_gueltig', to_jsonb(v_fortsetzungen));
  v_bereits := coalesce((v_basis->>'bereits_beantwortet')::boolean, false);
  v_fort := case when v_fordert_fortsetzung
    then v_antwort->>'spielfortsetzung' = any(v_fortsetzungen) end;
  v_richtung := (v_basis #>> '{ergebnis,richtung_richtig}')::boolean;
  if v_fordert_richtung
     and coalesce(v_antwort->>'spielfortsetzung', '') in ('weiterspielen', 'sr_ball') then
    v_richtung := null;
  end if;
  v_ort := (v_basis #>> '{ergebnis,ort_richtig}')::boolean;
  v_strafe := (v_basis #>> '{ergebnis,strafe_richtig}')::boolean;
  v_ziel := (v_basis #>> '{ergebnis,strafziel_richtig}')::boolean;
  v_rolle := (v_basis #>> '{ergebnis,rolle_richtig}')::boolean;
  v_nummer := (v_basis #>> '{ergebnis,rueckennummer_richtig}')::boolean;
  v_ort_text := v_basis #>> '{ergebnis,ort_feedback}';
  v_korrekt := coalesce(v_fort, true) and coalesce(v_richtung, true)
    and coalesce(v_ort, true) and coalesce(v_strafe, true)
    and coalesce(v_ziel, true) and coalesce(v_rolle, true)
    and coalesce(v_nummer, true)
    and (not coalesce((v_loesung->>'fordert_begruendung')::boolean,false)
         or coalesce((v_antwort#>>'{_begruendung,richtig}')::boolean,false));

  select a.id into v_antwort_id from public.antworten a
  where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
  if v_antwort_id is not null then
    update public.antwort_entscheidungen set
      loesung_snapshot = v_loesung,
      fortsetzung_richtig = v_fort,
      richtung_richtig = v_richtung
    where antwort_id = v_antwort_id;
    update public.antworten set
      korrekt = v_korrekt,
      bewertungsstatus = case when v_korrekt then 'richtig' else 'falsch' end
    where id = v_antwort_id;
  end if;

  return public.entscheidung_ergebnis_bauen(
    v_antwort, v_loesung, v_bereits,
    v_fort, v_richtung, v_ort, v_strafe, v_ziel, v_rolle, v_nummer, v_ort_text);
end;
$function$;
CREATE OR REPLACE FUNCTION public.duell_entscheidung_speichern_v2(p_zugang uuid, p_frage_id uuid, p_antwort jsonb, p_ort_richtig boolean, p_ort_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_basis jsonb; v_antwort jsonb; v_loesung jsonb; v_rueckgabe jsonb;
  v_fortsetzungen text[]; v_fordert_fortsetzung boolean; v_fordert_richtung boolean;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean;
  v_ziel boolean; v_rolle boolean; v_nummer boolean; v_korrekt boolean;
  v_tid uuid; v_ort_text text;
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Nicht erlaubt'; end if;
  select l.spielfortsetzungen_gueltig, l.fordert_fortsetzung, l.fordert_fortsetzung_fuer
  into v_fortsetzungen, v_fordert_fortsetzung, v_fordert_richtung
  from public.frage_entscheidungsloesungen l where l.frage_id = p_frage_id;

  v_basis := public.duell_entscheidung_speichern(
    p_zugang, p_frage_id, p_antwort, p_ort_richtig, p_ort_feedback);
  v_antwort := coalesce(v_basis->'antwort', p_antwort);
  v_loesung := coalesce(v_basis->'loesung', '{}'::jsonb)
    || jsonb_build_object('spielfortsetzungen_gueltig', to_jsonb(v_fortsetzungen));
  v_fort := case when v_fordert_fortsetzung
    then v_antwort->>'spielfortsetzung' = any(v_fortsetzungen) end;
  v_richtung := (v_basis #>> '{ergebnis,richtung_richtig}')::boolean;
  if v_fordert_richtung
     and coalesce(v_antwort->>'spielfortsetzung', '') in ('weiterspielen', 'sr_ball') then
    v_richtung := null;
  end if;
  v_ort := (v_basis #>> '{ergebnis,ort_richtig}')::boolean;
  v_strafe := (v_basis #>> '{ergebnis,strafe_richtig}')::boolean;
  v_ziel := (v_basis #>> '{ergebnis,strafziel_richtig}')::boolean;
  v_rolle := (v_basis #>> '{ergebnis,rolle_richtig}')::boolean;
  v_nummer := (v_basis #>> '{ergebnis,rueckennummer_richtig}')::boolean;
  v_ort_text := v_basis #>> '{ergebnis,ort_feedback}';
  v_korrekt := coalesce(v_fort, true) and coalesce(v_richtung, true)
    and coalesce(v_ort, true) and coalesce(v_strafe, true)
    and coalesce(v_ziel, true) and coalesce(v_rolle, true)
    and coalesce(v_nummer, true)
    and (not coalesce((v_loesung->>'fordert_begruendung')::boolean,false)
         or coalesce((v_antwort#>>'{_begruendung,richtig}')::boolean,false));

  v_rueckgabe := public.entscheidung_ergebnis_bauen(
    v_antwort, v_loesung, false,
    v_fort, v_richtung, v_ort, v_strafe, v_ziel, v_rolle, v_nummer, v_ort_text);

  select t.id into v_tid from public.duell_teilnehmer t where t.zugang = p_zugang;
  update public.duell_antworten set
    korrekt = v_korrekt,
    bewertungsstatus = case when v_korrekt then 'richtig' else 'falsch' end,
    gegebene_details = jsonb_set(
      jsonb_set(gegebene_details, '{loesung}', v_loesung, true),
      '{ergebnis}', v_rueckgabe->'ergebnis', true)
  where teilnehmer_id = v_tid and frage_id = p_frage_id;

  return v_rueckgabe;
end;
$function$;
CREATE OR REPLACE FUNCTION public.duell_entscheidung_speichern(p_zugang uuid, p_frage_id uuid, p_antwort jsonb, p_ort_richtig boolean, p_ort_feedback text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tid uuid; v_l public.frage_entscheidungsloesungen%rowtype;
  v_strafen_l jsonb; v_strafen_g jsonb; v_loesung jsonb; v_noten jsonb; v_ergebnis jsonb;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean; v_ziel boolean; v_rolle boolean; v_nummer boolean; v_ok boolean;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  if jsonb_typeof(p_antwort)<>'object' then raise exception 'Antwort ungueltig'; end if;
  select t.id into v_tid from public.duell_teilnehmer t
    join public.duell_fragen df on df.session_id=t.session_id and df.frage_id=p_frage_id
    join public.duell_sessions d on d.id=t.session_id and d.status='offen'
    where t.zugang=p_zugang;
  if v_tid is null then raise exception 'Frage nicht verfuegbar'; end if;
  if exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id)
    then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  select l.* into v_l from public.frage_entscheidungsloesungen l
    join public.fragen f on f.id=l.frage_id
    where l.frage_id=p_frage_id and f.aktiv and f.antworttyp='entscheidung';
  if not found then raise exception 'Frage nicht verfuegbar'; end if;

  if v_l.fordert_begruendung and (length(btrim(coalesce(p_antwort->>'begruendung',''))) not between 1 and 600
     or jsonb_typeof(p_antwort#>'{_begruendung,richtig}') is distinct from 'boolean') then
    raise exception 'Begründungsprüfung fehlt. Bitte Quiz neu laden';
  end if;
  if p_antwort ? 'strafen' and jsonb_typeof(p_antwort->'strafen')='array' then
    v_strafen_g:=p_antwort->'strafen';
  elsif coalesce(nullif(p_antwort->>'persoenliche_strafe',''),'keine')<>'keine' then
    v_strafen_g:=jsonb_build_array(jsonb_build_object(
      'strafe',p_antwort->>'persoenliche_strafe','fuer_mannschaft',nullif(p_antwort->>'strafe_fuer_mannschaft',''),
      'strafe_fuer_rolle',nullif(p_antwort->>'strafe_fuer_rolle',''),'rueckennummer',nullif(p_antwort->>'strafe_rueckennummer','')));
  else v_strafen_g:='[]'::jsonb; end if;
  v_strafen_l:=public.entscheidung_strafen_liste(p_frage_id);
  v_loesung:=jsonb_build_object(
    'spielfortsetzung',v_l.spielfortsetzung,'fortsetzung_fuer',v_l.fortsetzung_fuer,
    'fortsetzung_ort',v_l.fortsetzung_ort,'persoenliche_strafe',v_l.persoenliche_strafe,
    'strafe_fuer_mannschaft',v_l.strafe_fuer_mannschaft,'strafe_fuer_rolle',v_l.strafe_fuer_rolle,
    'strafe_rollen_gueltig',to_jsonb(v_l.strafe_rollen_gueltig),'strafe_rueckennummer',v_l.strafe_rueckennummer,
    'strafen',v_strafen_l,'trikot_heim',v_l.trikot_heim,'trikot_gast',v_l.trikot_gast,
    'fordert_fortsetzung',v_l.fordert_fortsetzung,'fordert_fortsetzung_fuer',v_l.fordert_fortsetzung_fuer,
    'fordert_fortsetzung_ort',v_l.fordert_fortsetzung_ort,'fordert_strafe',v_l.fordert_strafe,
    'fordert_strafe_mannschaft',v_l.fordert_strafe_mannschaft,'fordert_strafe_rolle',v_l.fordert_strafe_rolle,
    'fordert_strafe_nummer',v_l.fordert_strafe_nummer,'zeigt_trikotfarben',v_l.zeigt_trikotfarben,
    'fordert_begruendung',v_l.fordert_begruendung,'begruendung_muster',v_l.begruendung_muster);
  v_fort:=case when v_l.fordert_fortsetzung then p_antwort->>'spielfortsetzung'=v_l.spielfortsetzung end;
  v_richtung:=case when v_l.fordert_fortsetzung_fuer then coalesce(nullif(p_antwort->>'fortsetzung_fuer',''),'')=coalesce(v_l.fortsetzung_fuer,'') end;
  v_ort:=case when v_l.fordert_fortsetzung_ort then coalesce(p_ort_richtig,false) end;
  if v_l.fordert_strafe then
    v_noten:=public.entscheidung_strafen_vergleich(v_strafen_g,v_strafen_l,v_l.fordert_strafe_mannschaft,v_l.fordert_strafe_rolle,v_l.fordert_strafe_nummer);
    v_strafe:=(v_noten->>'strafe_richtig')::boolean; v_ziel:=(v_noten->>'strafziel_richtig')::boolean;
    v_rolle:=(v_noten->>'rolle_richtig')::boolean; v_nummer:=(v_noten->>'rueckennummer_richtig')::boolean;
  end if;
  v_ok:=coalesce(v_fort,true) and coalesce(v_richtung,true) and coalesce(v_ort,true)
    and coalesce(v_strafe,true) and coalesce(v_ziel,true) and coalesce(v_rolle,true) and coalesce(v_nummer,true)
    and (not v_l.fordert_begruendung or coalesce((p_antwort#>>'{_begruendung,richtig}')::boolean,false));
  v_ergebnis:=public.entscheidung_ergebnis_bauen(p_antwort,v_loesung,false,v_fort,v_richtung,v_ort,v_strafe,v_ziel,v_rolle,v_nummer,nullif(btrim(p_ort_feedback),''));
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_details,korrekt,bewertungsstatus,feedback)
    values(v_tid,p_frage_id,jsonb_build_object('art','entscheidung','antwort',p_antwort,'loesung',v_loesung,'ergebnis',v_ergebnis->'ergebnis'),
      v_ok,case when v_ok then 'richtig' else 'falsch' end,nullif(btrim(p_ort_feedback),''));
  return v_ergebnis;
end; $function$;
CREATE OR REPLACE FUNCTION public.meine_antworten_v2(p_schiedsrichter_id uuid, p_pin text)
 RETURNS TABLE(frage_id uuid, beantwortet boolean, gegebene_option text, korrekt boolean, richtige_option text, gegebener_freitext text, ki_feedback text, musterantwort text, bewertungsstatus text, nachbesserung_offen boolean, zweiter_freitext text, ki_nachfrage text, entscheidung jsonb, gegebene_auswahl text[], richtige_auswahl text[], gegebene_zahl numeric, gegebene_einheit text, richtige_zahlen jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pin text; v_verein uuid;
begin
  select s.pin,s.verein_id into v_pin,v_verein from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
  select f.id,(a.id is not null),a.gegebene_option,a.korrekt,
    case when a.id is not null and a.bewertungsstatus<>'nachbessern' then f.richtige_option end,
    a.gegebener_freitext,coalesce(a.ki_feedback_final,a.ki_feedback),
    case when a.id is not null and a.bewertungsstatus<>'nachbessern' then f.musterantwort end,
    a.bewertungsstatus,(a.bewertungsstatus='nachbessern'),a.zweiter_freitext,a.ki_nachfrage,
    case when ae.antwort_id is not null then jsonb_build_object('antwort',ae.gegebene_antwort,'loesung',ae.loesung_snapshot,'ergebnis',jsonb_build_object('fortsetzung_richtig',ae.fortsetzung_richtig,'richtung_richtig',ae.richtung_richtig,'ort_richtig',ae.ort_richtig,'strafe_richtig',ae.strafe_richtig,'strafziel_richtig',ae.strafziel_richtig,'rolle_richtig',ae.rolle_richtig,'rueckennummer_richtig',ae.rueckennummer_richtig,'ort_feedback',ae.ort_feedback,
      'begruendung_richtig',case when coalesce((ae.loesung_snapshot->>'fordert_begruendung')::boolean,false) then coalesce((ae.gegebene_antwort#>>'{_begruendung,richtig}')::boolean,false) end,
      'begruendung_feedback',ae.gegebene_antwort#>>'{_begruendung,feedback}')) end,
    a.gegebene_auswahl,
    case when a.id is not null then (select array_agg(o.schluessel order by o.schluessel) from public.frage_antwortoptionen o where o.frage_id=f.id and o.ist_richtig) end,
    a.gegebene_zahl,a.gegebene_einheit,
    case when a.id is not null then (select jsonb_agg(jsonb_build_object('wert',z.wert,'einheit',z.einheit) order by z.position) from public.frage_zahl_loesungen z where z.frage_id=f.id) end
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  left join public.antworten a on a.frage_id=f.id and a.schiedsrichter_id=p_schiedsrichter_id
  left join public.antwort_entscheidungen ae on ae.antwort_id=a.id
  where now() between r.startet_am and r.endet_am and f.aktiv;
end;
$function$;
CREATE OR REPLACE FUNCTION public.wochen_fragen_v3(p_schiedsrichter_id uuid, p_pin text)
 RETURNS TABLE(id uuid, frage_text text, option_a text, option_b text, option_c text, regel_nummer smallint, regel_bezeichnung text, schwierigkeit smallint, "position" integer, typ text, antwort_hinweis text, video_url text, video_start_sekunden integer, video_end_sekunden integer, video_antworttyp text, video_stumm boolean, frage_nummer integer, medium text, antworttyp text, fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean, fordert_fortsetzung_ort boolean, fordert_strafe boolean, fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean, fordert_strafe_nummer boolean, zeigt_trikotfarben boolean, trikot_heim text, trikot_gast text, antwortoptionen jsonb, zahl_einheiten jsonb, bild_base64 text, bild_mime text, bild_alt text, fordert_begruendung boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_pin text; v_aktiv boolean; v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  return query
  select f.id, f.frage_text, f.option_a, f.option_b, f.option_c,
         f.regel_nummer, reg.bezeichnung, f.schwierigkeit, rf.position,
         f.typ, f.antwort_hinweis, f.video_url, f.video_start_sekunden,
         f.video_end_sekunden, f.video_antworttyp, f.video_stumm,
         nr.frage_nummer, f.medium, f.antworttyp,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben,
         l.trikot_heim, l.trikot_gast,
         case when f.antworttyp in ('multiple_choice','mehrfachauswahl') then
           coalesce((select jsonb_agg(jsonb_build_object('schluessel', o.schluessel, 'text', o.text) order by o.position)
                     from public.frage_antwortoptionen o where o.frage_id = f.id),
                    jsonb_strip_nulls(jsonb_build_array(
                      jsonb_build_object('schluessel','a','text',f.option_a),
                      jsonb_build_object('schluessel','b','text',f.option_b),
                      jsonb_build_object('schluessel','c','text',f.option_c))))
           else null end,
         case when f.antworttyp = 'zahl' then
           (select jsonb_agg(jsonb_build_object('einheit', q.einheit) order by q.erste_position)
            from (select z.einheit, min(z.position) erste_position from public.frage_zahl_loesungen z where z.frage_id=f.id group by z.einheit) q)
           else null end,
         f.bild_base64, f.bild_mime, f.bild_alt, coalesce(l.fordert_begruendung,false)
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  join public.wochen_frage_nummern nr on nr.verein_id=rf.verein_id and nr.frage_id=rf.frage_id and nr.runde_id=rf.runde_id
  left join public.regeln reg on reg.nummer=f.regel_nummer
  left join public.frage_entscheidungsloesungen l on l.frage_id=f.id
  where now() between r.startet_am and r.endet_am and f.aktiv
  order by nr.frage_nummer nulls last, f.erstellt_am;
end;
$function$;
CREATE OR REPLACE FUNCTION public.obmann_frage_entscheidungsloesung_details_v3(p_passwort text, p_frage_id uuid)
 RETURNS TABLE(frage_id uuid, spielfortsetzung text, spielfortsetzungen_gueltig text[], fortsetzung_fuer text, fortsetzung_ort text, persoenliche_strafe text, strafe_fuer_mannschaft text, strafe_fuer_rolle text, strafe_rollen_gueltig text[], strafe_rueckennummer smallint, strafen jsonb, trikot_heim text, trikot_gast text, fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean, fordert_fortsetzung_ort boolean, fordert_strafe boolean, fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean, fordert_strafe_nummer boolean, zeigt_trikotfarben boolean, fordert_begruendung boolean, begruendung_muster text, begruendung_gewicht smallint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.obmann_verein(p_passwort);
  return query
  select l.frage_id, l.spielfortsetzung, l.spielfortsetzungen_gueltig,
         l.fortsetzung_fuer, l.fortsetzung_ort,
         l.persoenliche_strafe, l.strafe_fuer_mannschaft, l.strafe_fuer_rolle,
         l.strafe_rollen_gueltig, l.strafe_rueckennummer,
         public.entscheidung_strafen_liste(l.frage_id),
         l.trikot_heim, l.trikot_gast,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben, l.fordert_begruendung, l.begruendung_muster, l.begruendung_gewicht
  from public.frage_entscheidungsloesungen l
  where l.frage_id = p_frage_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.entscheidung_anzeige(p_wert jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select concat_ws(
    ' · ',
    case when nullif(btrim(p_wert->>'begruendung'),'') is not null then 'Begründung: '||(p_wert->>'begruendung') end,
    case p_wert->>'spielfortsetzung'
      when 'weiterspielen' then 'Weiterspielen'
      when 'direkter_freistoss' then 'Direkter Freistoss'
      when 'indirekter_freistoss' then 'Indirekter Freistoss'
      when 'strafstoss' then 'Strafstoss'
      when 'sr_ball' then 'Schiedsrichter-Ball'
      when 'eckstoss' then 'Eckstoss'
      when 'abstoss' then 'Abstoss'
      when 'einwurf' then 'Einwurf'
      when 'anstoss' then 'Anstoss'
      else coalesce(p_wert->>'spielfortsetzung', 'Keine Spielfortsetzung')
    end || case when nullif(p_wert->>'fortsetzung_fuer', '') is not null
      then ' fuer ' || case p_wert->>'fortsetzung_fuer'
        when 'heim' then 'Heim' when 'gast' then 'Gast' else p_wert->>'fortsetzung_fuer' end
      else '' end,
    case when nullif(p_wert->>'fortsetzung_ort', '') is not null
       and p_wert->>'spielfortsetzung' <> 'weiterspielen'
      then 'Ort: ' || (p_wert->>'fortsetzung_ort') else null end,
    case p_wert->>'persoenliche_strafe'
      when 'keine' then 'Keine persoenliche Strafe'
      when 'gelb' then 'Gelbe Karte'
      when 'gelb_rot' then 'Gelb-Rote Karte'
      when 'rot' then 'Rote Karte'
      else coalesce(p_wert->>'persoenliche_strafe', 'Keine Strafangabe')
    end || case when nullif(p_wert->>'strafe_fuer_mannschaft', '') is not null
      then ' fuer ' || case p_wert->>'strafe_fuer_mannschaft'
        when 'heim' then 'Heim' when 'gast' then 'Gast' else p_wert->>'strafe_fuer_mannschaft' end
      else '' end
      || case when nullif(p_wert->>'strafe_fuer_rolle', '') is not null
        then ' (' || case p_wert->>'strafe_fuer_rolle'
          when 'feldspieler' then 'Feldspieler'
          when 'torwart' then 'Torwart'
          when 'auswechselspieler' then 'Auswechselspieler'
          when 'einwechselspieler' then 'Einwechselspieler'
          when 'trainer_einzeln' then 'Trainer'
          when 'betreuer' then 'Betreuer'
          when 'trainer' then 'Trainer/Betreuer'
          else p_wert->>'strafe_fuer_rolle' end
        || case when nullif(p_wert->>'strafe_rueckennummer', '') is not null
          then ', Nr. ' || (p_wert->>'strafe_rueckennummer') else '' end || ')'
        else '' end
  );
$function$;
CREATE OR REPLACE FUNCTION public.duell_frage(p_zugang uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_t public.duell_teilnehmer%rowtype; v_f public.fragen%rowtype; v_pos int; v_opts jsonb; v_zahl jsonb; v_icon jsonb; v_regel text;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  select f.* into v_f from public.duell_fragen df
    join public.fragen f on f.id=df.frage_id
    join public.duell_sessions d on d.id=df.session_id and d.status='offen'
    where df.session_id=v_t.session_id
      and not exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_t.id and a.frage_id=df.frage_id)
    order by df.position limit 1;
  if not found then return jsonb_build_object('fertig',true); end if;
  select position into v_pos from public.duell_fragen where session_id=v_t.session_id and frage_id=v_f.id;
  select r.bezeichnung into v_regel from public.regeln r where r.nummer=v_f.regel_nummer;
  select coalesce(jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
    jsonb_strip_nulls(jsonb_build_array(
      jsonb_build_object('schluessel','a','text',v_f.option_a),
      jsonb_build_object('schluessel','b','text',v_f.option_b),
      jsonb_build_object('schluessel','c','text',v_f.option_c))))
    into v_opts from public.frage_antwortoptionen o where o.frage_id=v_f.id;
  select jsonb_agg(jsonb_build_object('einheit',q.einheit) order by q.erste_position)
    into v_zahl from (
      select z.einheit,min(z.position) erste_position from public.frage_zahl_loesungen z
      where z.frage_id=v_f.id group by z.einheit
    ) q;
  select jsonb_build_object(
      'fordert_fortsetzung',l.fordert_fortsetzung,
      'fordert_fortsetzung_fuer',l.fordert_fortsetzung_fuer,
      'fordert_fortsetzung_ort',l.fordert_fortsetzung_ort,
      'fordert_strafe',l.fordert_strafe,
      'fordert_strafe_mannschaft',l.fordert_strafe_mannschaft,
      'fordert_strafe_rolle',l.fordert_strafe_rolle,
      'fordert_strafe_nummer',l.fordert_strafe_nummer,
      'zeigt_trikotfarben',l.zeigt_trikotfarben,'fordert_begruendung',l.fordert_begruendung,
      'trikot_heim',l.trikot_heim,'trikot_gast',l.trikot_gast)
    into v_icon from public.frage_entscheidungsloesungen l where l.frage_id=v_f.id;
  return jsonb_strip_nulls(jsonb_build_object(
    'fertig',false,'id',v_f.id,'position',v_pos,'gesamt',5,
    'frage_text',v_f.frage_text,'medium',v_f.medium,'antworttyp',v_f.antworttyp,
    'antwortoptionen',v_opts,'zahl_einheiten',v_zahl,
    'antwort_hinweis',v_f.antwort_hinweis,'regel_nummer',v_f.regel_nummer,
    'regel_bezeichnung',v_regel,'schwierigkeit',v_f.schwierigkeit,
    'video_url',v_f.video_url,'video_start_sekunden',v_f.video_start_sekunden,
    'video_end_sekunden',v_f.video_end_sekunden,'video_stumm',v_f.video_stumm,
    'bild_base64',v_f.bild_base64,'bild_mime',v_f.bild_mime,'bild_alt',v_f.bild_alt
  ) || coalesce(v_icon,'{}'::jsonb));
end; $function$

;
CREATE OR REPLACE FUNCTION public.obmann_person_verlauf(p_passwort text, p_schiedsrichter text)
 RETURNS TABLE(runde text, runde_id uuid, runde_start timestamp with time zone, ist_aktuelle_runde boolean, ist_letzte_3_monate boolean, frage_id uuid, frage_text text, kategorie text, typ text, beantwortet boolean, gegebene_antwort text, richtige_antwort text, gegebener_freitext text, musterantwort text, ki_feedback text, korrekt boolean, beantwortet_am timestamp with time zone, manuell_korrigiert boolean, option_a text, option_b text, option_c text, richtige_option text, gegebene_option text, bewertungsstatus text, zweiter_freitext text, ki_nachfrage text, ki_feedback_final text, versuch_anzahl smallint, frage_nummer integer, antworttyp text, antwortoptionen jsonb, entscheidung_antwort jsonb, entscheidung_loesung jsonb, entscheidung_ergebnis jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
  v_schiedsrichter_id uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  select id into v_schiedsrichter_id
  from public.schiedsrichter
  where name = p_schiedsrichter
    and verein_id = v_verein;

  if v_schiedsrichter_id is null then
    return;
  end if;

  return query
  select
    r.bezeichnung,
    r.id,
    r.startet_am,
    coalesce(now() between r.startet_am and r.endet_am, false),
    coalesce(r.startet_am >= now() - interval '3 months', false),
    f.id,
    f.frage_text,
    f.kategorie,
    f.typ,
    a.id is not null,
    case
      when f.antworttyp = 'zahl' then public.zahl_antwort_text(a.gegebene_zahl, a.gegebene_einheit)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )
      else coalesce(
        (select o.text from public.frage_antwortoptionen o
         where o.frage_id = f.id and o.schluessel = a.gegebene_option),
        case a.gegebene_option
          when 'a' then f.option_a when 'b' then f.option_b when 'c' then f.option_c
          else null end)
    end,
    case
      when f.antworttyp = 'zahl' then public.zahl_loesung_text(f.id)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )
      else coalesce(
        (select o.text from public.frage_antwortoptionen o
         where o.frage_id = f.id and o.ist_richtig
         order by o.position limit 1),
        case f.richtige_option
          when 'a' then f.option_a when 'b' then f.option_b when 'c' then f.option_c
          else null end)
    end,
    a.gegebener_freitext,
    f.musterantwort,
    a.ki_feedback,
    coalesce(a.korrekt, false),
    a.beantwortet_am,
    coalesce(a.manuell_korrigiert, false),
    f.option_a,
    f.option_b,
    f.option_c,
    f.richtige_option,
    a.gegebene_option,
    a.bewertungsstatus,
    a.zweiter_freitext,
    a.ki_nachfrage,
    a.ki_feedback_final,
    a.versuch_anzahl,
    nr.frage_nummer,
    f.antworttyp,
    optionen.werte,
    ae.gegebene_antwort,
    ae.loesung_snapshot,
    case
      when ae.antwort_id is null then null
      else jsonb_build_object(
        'fortsetzung_richtig', ae.fortsetzung_richtig,
        'richtung_richtig', ae.richtung_richtig,
        'ort_richtig', ae.ort_richtig,
        'strafe_richtig', ae.strafe_richtig,
        'strafziel_richtig', ae.strafziel_richtig,
        'rolle_richtig', ae.rolle_richtig,
        'rueckennummer_richtig', ae.rueckennummer_richtig,
        'ort_feedback', ae.ort_feedback,
        'begruendung_richtig',case when coalesce((ae.loesung_snapshot->>'fordert_begruendung')::boolean,false) then coalesce((ae.gegebene_antwort#>>'{_begruendung,richtig}')::boolean,false) end,
        'begruendung_feedback',ae.gegebene_antwort#>>'{_begruendung,feedback}')
    end
  from public.fragen f
  left join public.runden_fragen rf
    on rf.frage_id = f.id and rf.verein_id = v_verein
  left join public.runden r on r.id = rf.runde_id
  left join public.wochen_frage_nummern nr
    on nr.verein_id = rf.verein_id
   and nr.runde_id = rf.runde_id
   and nr.frage_id = rf.frage_id
  left join public.antworten a
    on a.frage_id = f.id and a.schiedsrichter_id = v_schiedsrichter_id
  left join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'schluessel', q.schluessel,
        'text', q.text,
        'ist_richtig', q.ist_richtig,
        'ist_gewaehlt', coalesce(case
          when f.antworttyp = 'mehrfachauswahl'
            then q.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
          else q.schluessel = a.gegebene_option
        end, false))
      order by q.position
    ) as werte
    from (
      select o.schluessel, o.position::integer, o.text, o.ist_richtig
      from public.frage_antwortoptionen o
      where o.frage_id = f.id

      union all

      select alt.schluessel, alt.position, alt.text,
             alt.schluessel = f.richtige_option
      from (values
        ('a', 1, f.option_a),
        ('b', 2, f.option_b),
        ('c', 3, f.option_c)
      ) as alt(schluessel, position, text)
      where alt.text is not null
        and not exists (
          select 1 from public.frage_antwortoptionen vorhanden
          where vorhanden.frage_id = f.id)
    ) q
  ) optionen on true
  order by r.startet_am desc nulls last,
           nr.frage_nummer nulls last,
           f.erstellt_am,
           f.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.obmann_wochenauswertung(p_passwort text, p_runde_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(schiedsrichter text, frage_id uuid, frage_text text, typ text, beantwortet boolean, korrekt boolean, gegebene_antwort text, richtige_antwort text, gegebener_freitext text, musterantwort text, ki_feedback text, bewertungsstatus text, zweiter_freitext text, ki_nachfrage text, ki_feedback_final text, frage_nummer integer, antworttyp text, antwortoptionen jsonb, entscheidung_antwort jsonb, entscheidung_loesung jsonb, entscheidung_ergebnis jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  return query
  select
    s.name,
    f.id,
    f.frage_text,
    f.typ,
    a.id is not null,
    coalesce(a.korrekt, false),
    case
      when f.antworttyp = 'zahl' then public.zahl_antwort_text(a.gegebene_zahl, a.gegebene_einheit)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )
      else coalesce(
        (select o.text from public.frage_antwortoptionen o
         where o.frage_id = f.id and o.schluessel = a.gegebene_option),
        case a.gegebene_option
          when 'a' then f.option_a when 'b' then f.option_b when 'c' then f.option_c
          else null end)
    end,
    case
      when f.antworttyp = 'zahl' then public.zahl_loesung_text(f.id)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )
      else coalesce(
        (select o.text from public.frage_antwortoptionen o
         where o.frage_id = f.id and o.ist_richtig
         order by o.position limit 1),
        case f.richtige_option
          when 'a' then f.option_a when 'b' then f.option_b when 'c' then f.option_c
          else null end)
    end,
    a.gegebener_freitext,
    f.musterantwort,
    a.ki_feedback,
    a.bewertungsstatus,
    a.zweiter_freitext,
    a.ki_nachfrage,
    a.ki_feedback_final,
    f.frage_nummer,
    f.antworttyp,
    optionen.werte,
    ae.gegebene_antwort,
    ae.loesung_snapshot,
    case
      when ae.antwort_id is null then null
      else jsonb_build_object(
        'fortsetzung_richtig', ae.fortsetzung_richtig,
        'richtung_richtig', ae.richtung_richtig,
        'ort_richtig', ae.ort_richtig,
        'strafe_richtig', ae.strafe_richtig,
        'strafziel_richtig', ae.strafziel_richtig,
        'rolle_richtig', ae.rolle_richtig,
        'rueckennummer_richtig', ae.rueckennummer_richtig,
        'ort_feedback', ae.ort_feedback,
        'begruendung_richtig',case when coalesce((ae.loesung_snapshot->>'fordert_begruendung')::boolean,false) then coalesce((ae.gegebene_antwort#>>'{_begruendung,richtig}')::boolean,false) end,
        'begruendung_feedback',ae.gegebene_antwort#>>'{_begruendung,feedback}')
    end
  from public.schiedsrichter s
  cross join (
    select f2.id, f2.frage_text, f2.option_a, f2.option_b, f2.option_c,
           f2.richtige_option, f2.typ, f2.antworttyp, f2.musterantwort,
           f2.erstellt_am, nr.frage_nummer
    from public.fragen f2
    join public.runden_fragen rf2
      on rf2.frage_id = f2.id and rf2.verein_id = v_verein
    join public.runden r2 on r2.id = rf2.runde_id
    join public.wochen_frage_nummern nr
      on nr.verein_id = rf2.verein_id
     and nr.runde_id = rf2.runde_id
     and nr.frage_id = rf2.frage_id
    where f2.aktiv
      and ((p_runde_id is null and now() between r2.startet_am and r2.endet_am)
        or (p_runde_id is not null and r2.id = p_runde_id))
  ) f
  left join public.antworten a
    on a.frage_id = f.id and a.schiedsrichter_id = s.id
  left join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'schluessel', q.schluessel,
        'text', q.text,
        'ist_richtig', q.ist_richtig,
        'ist_gewaehlt', coalesce(case
          when f.antworttyp = 'mehrfachauswahl'
            then q.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
          else q.schluessel = a.gegebene_option
        end, false))
      order by q.position
    ) as werte
    from (
      select o.schluessel, o.position::integer, o.text, o.ist_richtig
      from public.frage_antwortoptionen o
      where o.frage_id = f.id

      union all

      select alt.schluessel, alt.position, alt.text,
             alt.schluessel = f.richtige_option
      from (values
        ('a', 1, f.option_a),
        ('b', 2, f.option_b),
        ('c', 3, f.option_c)
      ) as alt(schluessel, position, text)
      where alt.text is not null
        and not exists (
          select 1 from public.frage_antwortoptionen vorhanden
          where vorhanden.frage_id = f.id)
    ) q
  ) optionen on true
  where s.ist_test = false
    and s.verein_id = v_verein
    and coalesce(s.aktiv, true)
  order by s.name, f.frage_nummer nulls last, f.erstellt_am;
end;
$function$

;

revoke all on function public.entscheidung_kontext_v3(uuid,uuid,text,jsonb), public.duell_entscheidung_kontext_v3(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.entscheidung_kontext_v3(uuid,uuid,text,jsonb), public.duell_entscheidung_kontext_v3(uuid,uuid,jsonb) to service_role;
revoke all on function public.wochen_fragen_v3(uuid,text),public.obmann_frage_entscheidungsloesung_details_v3(text,uuid) from public;
grant execute on function public.wochen_fragen_v3(uuid,text),public.obmann_frage_entscheidungsloesung_details_v3(text,uuid) to anon,authenticated,service_role;
revoke all on function private.entscheidung_kern_richtig(uuid,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
