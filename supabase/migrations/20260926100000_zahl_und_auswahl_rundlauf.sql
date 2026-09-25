-- ============================================================
--  Zahl- und Auswahlantworten: Rundlauf-Fixes (26.09.2026)
-- ============================================================
--  Backlog: "Zahlenantworten: Funktion ist vorhanden, aber mit mindestens
--  einer echten Frage in App, Wochenquiz, Aufloesung, Personendetail und
--  Duell testen." Das ist jetzt passiert - als Transaktion mit Rollback
--  gegen die Live-Datenbank (Verein "Familie & Freunde"). Gefunden:
--
--  1. SICHERHEIT/FAIRNESS: antwort_zahl_abgeben und antwort_auswahl_abgeben
--     pruefen "if v_typ <> 'zahl'" bzw. "not in (...)". Ist die Frage NICHT
--     in der laufenden Woche des eigenen Vereins, bleibt v_typ NULL - und
--     NULL <> 'zahl' ist NULL, nicht TRUE. Die Sperre griff nie: Mit gueltiger
--     PIN liess sich jede Frage beantworten (auch fremde oder kommende
--     Wochen), die Antwort wurde gespeichert und die Loesung ausgeliefert.
--     Live nachgestellt: "ANGENOMMEN: [{wert: 1, einheit: m}]".
--     Dasselbe Muster in duell_antwort_auswahl.
--
--  2. FALSCHE BEWERTUNG IM DUELL: duell_antwort_auswahl sammelte als
--     "richtige" Schluessel ALLE Optionen einer Frage (der Filter
--     "ist_richtig" stand nur am Text, nicht am Schluessel). Bei Fragen mit
--     eigener Optionsliste (4-8 Antworten) war damit nur "alles
--     angekreuzt" richtig. Bisher unbemerkt, weil in Duellen nur alte
--     A-C-Fragen vorkamen, die den Rueckfallweg nehmen.
--
--  3. OBMANN-APP: Im Personendetail stand bei einer beantworteten
--     Zahlenfrage "Nicht beantwortet" - obmann_person_verlauf und
--     obmann_wochenauswertung lieferten fuer Zahlen weder gegebene noch
--     richtige Antwort. Jetzt als Text "11 m" / "11 m oder 12 Yards".
--
--  4. "WARUM?": erklaerung_kontext_laden gab eine Zahlenfrage als
--     Multiple Choice mit leeren Optionen an die KI. Zahl- und
--     Mehrfachauswahl-Antworten gehen jetzt als Text mit hinterlegter
--     Loesung hinein - so, wie die Erklaerfunktion Freitext behandelt.
--
--  Die drei langen Lesefunktionen (3, 4) werden nicht abgeschrieben,
--  sondern gezielt an je einer Stelle ergaenzt: Der Block am Ende liest die
--  aktuelle Fassung, prueft, dass die Ankerstelle GENAU EINMAL vorkommt,
--  und legt sie mit der Ergaenzung neu an. Faellt ein Anker weg (weil jemand
--  die Funktion inzwischen geaendert hat), bricht die Migration laut ab,
--  statt still eine alte Fassung zurueckzuschreiben.
-- ============================================================

-- ------------------------------------------------------------
-- Zahlen als deutscher Text: 9.15 -> "9,15", 11.0 -> "11"
-- ------------------------------------------------------------
create or replace function public.zahl_als_text(p_wert numeric)
returns text language sql immutable set search_path to '' as $function$
  select case when p_wert is null then null
              else replace(trim_scale(p_wert)::text, '.', ',') end;
$function$;

create or replace function public.zahl_antwort_text(p_wert numeric, p_einheit text)
returns text language sql immutable set search_path to '' as $function$
  select case when p_wert is null then null
              else public.zahl_als_text(p_wert) || coalesce(' ' || nullif(btrim(p_einheit), ''), '') end;
$function$;

create or replace function public.zahl_loesung_text(p_frage_id uuid)
returns text language sql stable set search_path to '' as $function$
  select string_agg(
           public.zahl_als_text(z.wert) || ' ' || z.einheit
           || case when z.toleranz > 0 then ' (± ' || public.zahl_als_text(z.toleranz) || ')' else '' end,
           ' oder ' order by z.position)
    from public.frage_zahl_loesungen z
   where z.frage_id = p_frage_id;
$function$;

create or replace function public.auswahl_text(p_frage_id uuid, p_schluessel text[], p_nur_richtige boolean)
returns text language sql stable set search_path to '' as $function$
  select string_agg(o.text, ', ' order by o.position)
    from public.frage_antwortoptionen o
   where o.frage_id = p_frage_id
     and (case when p_nur_richtige then o.ist_richtig
               else o.schluessel = any(coalesce(p_schluessel, array[]::text[])) end);
$function$;

revoke all on function public.zahl_als_text(numeric) from public, anon, authenticated;
revoke all on function public.zahl_antwort_text(numeric, text) from public, anon, authenticated;
revoke all on function public.zahl_loesung_text(uuid) from public, anon, authenticated;
revoke all on function public.auswahl_text(uuid, text[], boolean) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 1. Zahlenantwort im Wochenquiz: Sperre, die auch bei NULL greift
-- ------------------------------------------------------------
create or replace function public.antwort_zahl_abgeben(p_schiedsrichter_id uuid, p_frage_id uuid,
  p_wert numeric, p_einheit text, p_pin text)
returns table(korrekt boolean, richtige_antworten jsonb, bereits_beantwortet boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pin text; v_ist_test boolean; v_aktiv boolean; v_verein uuid; v_typ text;
  v_loesungen jsonb; v_vorhanden public.antworten%rowtype; v_korrekt boolean;
begin
  select s.pin,s.ist_test,s.aktiv,s.verein_id into v_pin,v_ist_test,v_aktiv,v_verein
  from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_wert is null or nullif(btrim(p_einheit),'') is null then raise exception 'Zahl und Einheit fehlen'; end if;

  select f.antworttyp into v_typ
  from public.fragen f join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  where f.id=p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv;
  -- "is distinct from": auch eine nicht gefundene Frage (NULL) wird abgewiesen.
  if v_typ is distinct from 'zahl' then raise exception 'Frage nicht gefunden oder falscher Antworttyp'; end if;

  select coalesce(bool_or(z.einheit=btrim(p_einheit) and abs(z.wert-p_wert)<=z.toleranz),false),
         jsonb_agg(jsonb_build_object('wert',z.wert,'einheit',z.einheit) order by z.position)
    into v_korrekt,v_loesungen
  from public.frage_zahl_loesungen z where z.frage_id=p_frage_id;

  select * into v_vorhanden from public.antworten a
  where a.schiedsrichter_id=p_schiedsrichter_id and a.frage_id=p_frage_id;
  if found then return query select v_vorhanden.korrekt,v_loesungen,true; return; end if;
  if not v_ist_test then
    insert into public.antworten(schiedsrichter_id,frage_id,gegebene_zahl,gegebene_einheit,korrekt,bewertungsstatus)
    values(p_schiedsrichter_id,p_frage_id,p_wert,btrim(p_einheit),v_korrekt,case when v_korrekt then 'richtig' else 'falsch' end);
  end if;
  return query select v_korrekt,v_loesungen,false;
end;
$function$;

-- ------------------------------------------------------------
-- 1. Auswahlantwort im Wochenquiz: dieselbe Sperre
-- ------------------------------------------------------------
create or replace function public.antwort_auswahl_abgeben(p_schiedsrichter_id uuid, p_frage_id uuid,
  p_auswahl text[], p_pin text)
returns table(korrekt boolean, richtige_auswahl text[], bereits_beantwortet boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pin text; v_ist_test boolean; v_aktiv boolean; v_verein uuid; v_typ text;
  v_gegeben text[]; v_richtig text[]; v_vorhanden public.antworten%rowtype; v_korrekt boolean;
begin
  select s.pin,s.ist_test,s.aktiv,s.verein_id into v_pin,v_ist_test,v_aktiv,v_verein
  from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  select f.antworttyp into v_typ
  from public.fragen f join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  where f.id=p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv;
  if v_typ is null or v_typ not in ('multiple_choice','mehrfachauswahl') then
    raise exception 'Frage nicht gefunden oder falscher Antworttyp';
  end if;

  select array_agg(distinct lower(x) order by lower(x)) into v_gegeben from unnest(p_auswahl) x;
  if v_gegeben is null or cardinality(v_gegeben)=0 then raise exception 'Keine Antwort ausgewählt'; end if;
  if not v_gegeben <@ array['a','b','c','d','e','f','g','h']::text[] then raise exception 'Ungültige Antwort'; end if;
  if v_typ='multiple_choice' and cardinality(v_gegeben)<>1 then raise exception 'Bitte genau eine Antwort auswählen'; end if;

  select array_agg(o.schluessel order by o.schluessel) into v_richtig
  from public.frage_antwortoptionen o where o.frage_id=p_frage_id and o.ist_richtig;
  if v_richtig is null then
    select array[f.richtige_option] into v_richtig from public.fragen f where f.id=p_frage_id;
  end if;
  v_korrekt := v_gegeben = v_richtig;

  select * into v_vorhanden from public.antworten a
  where a.schiedsrichter_id=p_schiedsrichter_id and a.frage_id=p_frage_id;
  if found then return query select v_vorhanden.korrekt,v_richtig,true; return; end if;
  if not v_ist_test then
    insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,gegebene_auswahl,korrekt,bewertungsstatus)
    values(p_schiedsrichter_id,p_frage_id,case when cardinality(v_gegeben)=1 then v_gegeben[1] else null end,v_gegeben,v_korrekt,case when v_korrekt then 'richtig' else 'falsch' end);
  end if;
  return query select v_korrekt,v_richtig,false;
end;
$function$;

-- ------------------------------------------------------------
-- 1. + 2. Auswahlantwort im Duell: Sperre und richtige Schluessel
-- ------------------------------------------------------------
create or replace function public.duell_antwort_auswahl(p_zugang uuid, p_frage_id uuid, p_auswahl text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_t public.duell_teilnehmer%rowtype; v_typ text; v_richtig text[]; v_gegeben text[]; v_ok boolean; v_text jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungültig'; end if;
  select f.antworttyp into v_typ from public.duell_fragen df join public.fragen f on f.id=df.frage_id
   join public.duell_sessions d on d.id=df.session_id where df.session_id=v_t.session_id and df.frage_id=p_frage_id and d.status='offen';
  if v_typ is null or v_typ not in ('multiple_choice','mehrfachauswahl') then raise exception 'Falscher Antworttyp'; end if;
  select array_agg(distinct lower(x) order by lower(x)) into v_gegeben from unnest(p_auswahl)x;
  if v_gegeben is null or not v_gegeben<@array['a','b','c','d','e','f','g','h']::text[] then raise exception 'Ungültige Auswahl'; end if;
  -- Nur die richtigen Schluessel - vorher standen hier alle Optionen.
  select array_agg(o.schluessel order by o.schluessel) filter (where o.ist_richtig),
         jsonb_agg(o.text order by o.position) filter (where o.ist_richtig)
    into v_richtig,v_text from public.frage_antwortoptionen o where o.frage_id=p_frage_id;
  if v_richtig is null then select array[f.richtige_option],jsonb_build_array(case f.richtige_option when 'a' then f.option_a when 'b' then f.option_b else f.option_c end) into v_richtig,v_text from public.fragen f where f.id=p_frage_id; end if;
  v_ok:=v_gegeben=v_richtig;
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_auswahl,korrekt,bewertungsstatus)
    values(v_t.id,p_frage_id,v_gegeben,v_ok,case when v_ok then 'richtig' else 'falsch' end)
   on conflict(teilnehmer_id,frage_id) do nothing;
  if not found then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  return jsonb_build_object('korrekt',v_ok,'richtige_auswahl',v_richtig,'richtige_texte',v_text);
end; $function$;

-- ------------------------------------------------------------
-- 3. + 4. Lesefunktionen gezielt ergaenzen (siehe Kopfkommentar)
-- ------------------------------------------------------------
do $block$
declare
  v_def text;
  v_anz integer;
  procedure_patch record;
begin
  for procedure_patch in
    select * from (values
      ('public.obmann_person_verlauf(text,text)'),
      ('public.obmann_wochenauswertung(text,uuid)')
    ) as t(sig)
  loop
    v_def := pg_get_functiondef(procedure_patch.sig::regprocedure);
    -- gegebene Antwort
    v_anz := (length(v_def) - length(replace(v_def,
      $a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )$a$, ''))) / length($a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )$a$);
    if v_anz <> 1 then raise exception 'Anker "gegebene Antwort" in % gefunden: % mal', procedure_patch.sig, v_anz; end if;
    v_def := replace(v_def,
      $a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )$a$,
      $a$when f.antworttyp = 'zahl' then public.zahl_antwort_text(a.gegebene_zahl, a.gegebene_einheit)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id
          and o.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
      )$a$);
    -- richtige Antwort
    v_anz := (length(v_def) - length(replace(v_def,
      $a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )$a$, ''))) / length($a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )$a$);
    if v_anz <> 1 then raise exception 'Anker "richtige Antwort" in % gefunden: % mal', procedure_patch.sig, v_anz; end if;
    v_def := replace(v_def,
      $a$when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )$a$,
      $a$when f.antworttyp = 'zahl' then public.zahl_loesung_text(f.id)
      when f.antworttyp = 'mehrfachauswahl' then (
        select string_agg(o.text, ', ' order by o.position)
        from public.frage_antwortoptionen o
        where o.frage_id = f.id and o.ist_richtig
      )$a$);
    execute v_def;
  end loop;

  -- "Warum?": Zahl- und Mehrfachauswahl-Antworten als Text mit Loesung
  v_def := pg_get_functiondef('public.erklaerung_kontext_laden(uuid,uuid,text,boolean)'::regprocedure);
  v_anz := (length(v_def) - length(replace(v_def,
    $a$return query select f.frage_text, case when f.antworttyp = 'entscheidung' then 'entscheidung' else f.typ end, f.option_a, f.option_b, f.option_c, f.richtige_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.loesung_snapshot) else f.musterantwort end,
      f.bewertungshinweise, a.gegebene_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.gegebene_antwort) else a.gegebener_freitext end,$a$, ''))) / length(
    $a$return query select f.frage_text, case when f.antworttyp = 'entscheidung' then 'entscheidung' else f.typ end, f.option_a, f.option_b, f.option_c, f.richtige_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.loesung_snapshot) else f.musterantwort end,
      f.bewertungshinweise, a.gegebene_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.gegebene_antwort) else a.gegebener_freitext end,$a$);
  if v_anz <> 1 then raise exception 'Anker in erklaerung_kontext_laden gefunden: % mal', v_anz; end if;
  v_def := replace(v_def,
    $a$return query select f.frage_text, case when f.antworttyp = 'entscheidung' then 'entscheidung' else f.typ end, f.option_a, f.option_b, f.option_c, f.richtige_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.loesung_snapshot) else f.musterantwort end,
      f.bewertungshinweise, a.gegebene_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.gegebene_antwort) else a.gegebener_freitext end,$a$,
    $a$return query select f.frage_text,
      case when f.antworttyp = 'entscheidung' then 'entscheidung'
           when f.antworttyp in ('zahl', 'mehrfachauswahl') then 'freitext'
           else f.typ end,
      f.option_a, f.option_b, f.option_c, f.richtige_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.loesung_snapshot)
           when f.antworttyp = 'zahl' then 'Richtig ist: ' || public.zahl_loesung_text(f.id)
           when f.antworttyp = 'mehrfachauswahl' then 'Richtig sind genau diese Antworten: ' || public.auswahl_text(f.id, null, true)
           else f.musterantwort end,
      f.bewertungshinweise, a.gegebene_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.gegebene_antwort)
           when f.antworttyp = 'zahl' then public.zahl_antwort_text(a.gegebene_zahl, a.gegebene_einheit)
           when f.antworttyp = 'mehrfachauswahl' then public.auswahl_text(f.id, a.gegebene_auswahl, false)
           else a.gegebener_freitext end,$a$);
  execute v_def;
end;
$block$;
