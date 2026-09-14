-- Auswahlantworten im Obmann-Dashboard strukturiert ausgeben und bearbeiten.
-- Unterstützt Mehrfachauswahl sowie Multiple Choice mit bis zu acht Optionen.

drop function if exists public.obmann_person_verlauf(text, text);

create function public.obmann_person_verlauf(p_passwort text, p_schiedsrichter text)
returns table(
  runde text,
  runde_id uuid,
  runde_start timestamp with time zone,
  ist_aktuelle_runde boolean,
  ist_letzte_3_monate boolean,
  frage_id uuid,
  frage_text text,
  kategorie text,
  typ text,
  beantwortet boolean,
  gegebene_antwort text,
  richtige_antwort text,
  gegebener_freitext text,
  musterantwort text,
  ki_feedback text,
  korrekt boolean,
  beantwortet_am timestamp with time zone,
  manuell_korrigiert boolean,
  option_a text,
  option_b text,
  option_c text,
  richtige_option text,
  gegebene_option text,
  bewertungsstatus text,
  zweiter_freitext text,
  ki_nachfrage text,
  ki_feedback_final text,
  versuch_anzahl smallint,
  frage_nummer integer,
  antworttyp text,
  antwortoptionen jsonb,
  entscheidung_antwort jsonb,
  entscheidung_loesung jsonb,
  entscheidung_ergebnis jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        'ort_feedback', ae.ort_feedback)
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
$function$;

revoke all on function public.obmann_person_verlauf(text, text) from public;
grant execute on function public.obmann_person_verlauf(text, text) to anon, authenticated;


drop function if exists public.obmann_wochenauswertung(text, uuid);

create function public.obmann_wochenauswertung(
  p_passwort text,
  p_runde_id uuid default null
)
returns table(
  schiedsrichter text,
  frage_id uuid,
  frage_text text,
  typ text,
  beantwortet boolean,
  korrekt boolean,
  gegebene_antwort text,
  richtige_antwort text,
  gegebener_freitext text,
  musterantwort text,
  ki_feedback text,
  bewertungsstatus text,
  zweiter_freitext text,
  ki_nachfrage text,
  ki_feedback_final text,
  frage_nummer integer,
  antworttyp text,
  antwortoptionen jsonb,
  entscheidung_antwort jsonb,
  entscheidung_loesung jsonb,
  entscheidung_ergebnis jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        'ort_feedback', ae.ort_feedback)
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
$function$;

revoke all on function public.obmann_wochenauswertung(text, uuid) from public;
grant execute on function public.obmann_wochenauswertung(text, uuid) to anon, authenticated;


create or replace function public.obmann_antwort_ueberschreiben(
  p_passwort text,
  p_schiedsrichter text,
  p_frage_id uuid,
  p_aktion text,
  p_option text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_schiedsrichter_id uuid;
  v_antworttyp text;
  v_auswahl text[];
begin
  v_verein := public.obmann_verein(p_passwort);

  if p_aktion not in ('richtig', 'falsch', 'zuruecksetzen') then
    raise exception 'Ungueltige Aktion';
  end if;

  select id into v_schiedsrichter_id
  from public.schiedsrichter
  where name = p_schiedsrichter and verein_id = v_verein;

  if v_schiedsrichter_id is null then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;

  select coalesce(nullif(antworttyp, ''), 'multiple_choice')
  into v_antworttyp
  from public.fragen
  where id = p_frage_id;

  if v_antworttyp is null then
    raise exception 'Frage nicht gefunden';
  end if;

  if p_aktion = 'zuruecksetzen' then
    delete from public.antworten
    where schiedsrichter_id = v_schiedsrichter_id and frage_id = p_frage_id;
    return;
  end if;

  if p_option is not null then
    if v_antworttyp = 'mehrfachauswahl' then
      v_auswahl := regexp_split_to_array(lower(regexp_replace(p_option, '\s+', '', 'g')), ',');

      if cardinality(v_auswahl) = 0
         or cardinality(v_auswahl) <> (select count(distinct wert) from unnest(v_auswahl) wert)
         or exists (
           select 1 from unnest(v_auswahl) wert
           where wert !~ '^[a-h]$'
              or not exists (
                select 1 from public.frage_antwortoptionen o
                where o.frage_id = p_frage_id and o.schluessel = wert)) then
        raise exception 'Ungueltige Antwortauswahl';
      end if;
    else
      if p_option !~ '^[a-h]$' or not exists (
        select 1
        from public.fragen f
        where f.id = p_frage_id
          and (
            exists (
              select 1 from public.frage_antwortoptionen o
              where o.frage_id = f.id and o.schluessel = p_option)
            or (
              not exists (
                select 1 from public.frage_antwortoptionen o2
                where o2.frage_id = f.id)
              and ((p_option = 'a' and f.option_a is not null)
                or (p_option = 'b' and f.option_b is not null)
                or (p_option = 'c' and f.option_c is not null))))) then
        raise exception 'Ungueltige Option';
      end if;
    end if;
  end if;

  insert into public.antworten (
    schiedsrichter_id, frage_id, gegebene_option, gegebene_auswahl,
    korrekt, bewertungsstatus, manuell_korrigiert, beantwortet_am
  )
  values (
    v_schiedsrichter_id,
    p_frage_id,
    case when v_antworttyp <> 'mehrfachauswahl' then p_option else null end,
    case when v_antworttyp = 'mehrfachauswahl' then v_auswahl else null end,
    p_aktion = 'richtig',
    case when p_aktion = 'richtig' then 'richtig' else 'falsch' end,
    true,
    now()
  )
  on conflict (schiedsrichter_id, frage_id) do update
    set gegebene_option = case
          when p_option is null then antworten.gegebene_option
          else excluded.gegebene_option
        end,
        gegebene_auswahl = case
          when p_option is null then antworten.gegebene_auswahl
          else excluded.gegebene_auswahl
        end,
        korrekt = excluded.korrekt,
        bewertungsstatus = excluded.bewertungsstatus,
        manuell_korrigiert = true,
        beantwortet_am = now();
end;
$function$;

revoke all on function public.obmann_antwort_ueberschreiben(text, text, uuid, text, text) from public;
grant execute on function public.obmann_antwort_ueberschreiben(text, text, uuid, text, text) to anon, authenticated;
