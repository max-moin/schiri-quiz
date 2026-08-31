-- ============================================================
-- v107 - Analysen fuer das Obmann-Dashboard
-- ============================================================
--
-- Das Dashboard zeigte bisher immer nur eine Woche auf einmal: wer hat in
-- der laufenden Runde geantwortet und wie oft richtig. Was fehlte, war der
-- Blick ueber mehrere Wochen hinweg und quer ueber die Regelbereiche. Der
-- Obmann konnte deshalb nicht unterscheiden, ob jemand dauerhaft abhaengt
-- oder nur eine Woche im Urlaub war, und er konnte nicht erkennen, an
-- welchem Thema die Gruppe als Ganzes scheitert.
--
-- Diese Migration ergaenzt vier rein lesende RPCs, die genau diese Luecken
-- schliessen. Sie schreiben nichts und liefern bewusst nur Kennzahlen,
-- niemals Loesungstexte.
--
-- Warum das Kreuzprodukt statt einer Aggregation ueber antworten:
-- Eine Auswertung, die nur ueber die Tabelle antworten gruppiert, kann
-- Luecken gar nicht zeigen - wer nichts abgegeben hat, taucht dort nicht
-- auf. Die Matrix bildet deshalb bewusst zuerst das Kreuzprodukt aus den
-- gelieferten Runden und den aktiven Schiedsrichtern und zaehlt die
-- Antworten erst danach hinzu. Nur so entsteht eine Zeile mit
-- beantwortet = 0 statt einer fehlenden Zelle.
--
-- Warum reihenfolge als eigene Spalte:
-- Die Wochenbezeichnung ist ein freier Text ("27.07.-03.08.2026"). Die App
-- soll die Spalten der Matrix stabil sortieren koennen, ohne diesen Text zu
-- parsen oder ein Datum daraus zu raten. reihenfolge = 0 ist die aelteste
-- der gelieferten Runden, danach aufsteigend.
--
-- Warum p_passwort hinten steht und optional ist:
-- Alle bestehenden obmann_-RPCs leiten den Verein aus dem Passwort ab
-- (obmann_verein). Ohne diese Ableitung wuerden hier die Daten mehrerer
-- Vereine vermischt, denn runden_fragen ist pro Verein gefuellt und
-- dieselbe Frage steckt bei verschiedenen Vereinen in verschiedenen Wochen.
-- Der Parameter steht deshalb am Ende und hat einen Default, damit die mit
-- der App vereinbarte Aufrufform (nur p_wochen bzw. p_schiedsrichter und
-- p_wochen) unveraendert funktioniert; ohne Passwort wird ueber alle
-- Vereine aggregiert.
--
-- Warum falsch = beantwortet - richtig:
-- Freitextantworten koennen im Status "nachbessern" haengen, korrekt ist
-- dann noch null. Wuerde falsch nur korrekt = false zaehlen, ergaeben
-- richtig + falsch + nicht_beantwortet nicht mehr die Gesamtzahl und die
-- gestapelten Balken der App waeren lueckenhaft. Deshalb zaehlt falsch
-- alles, was beantwortet und nicht richtig ist - genau wie in
-- obmann_trend_wochen.
--
-- obmann_szenario_dashboard bekommt bewusst KEIN Recht fuer anon: die
-- Szenario-Kennzahlen sind reine Obmann-Sicht und haben auf der
-- oeffentlichen Spielerseite nichts zu suchen.

-- ------------------------------------------------------------
-- 1. Wochenmatrix: eine Zeile je Runde und Schiedsrichter
-- ------------------------------------------------------------

drop function if exists public.obmann_wochen_matrix(int, text);

create function public.obmann_wochen_matrix(
  p_wochen int default 8,
  p_passwort text default null
)
returns table(
  runde_id uuid,
  runde text,
  woche_label text,
  ist_aktuelle_runde boolean,
  reihenfolge int,
  schiedsrichter text,
  fragen_gesamt int,
  beantwortet int,
  richtig int,
  falsch int,
  nicht_beantwortet int
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 8), 1), 52);
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  return query
  with letzte_runden as (
    -- Nur abgeschlossene und laufende Runden. Kuenftige Wochen sind zwar
    -- schon angelegt, haben aber definitionsgemaess keine Antworten und
    -- wuerden die Matrix mit leeren Spalten aufblaehen.
    select r.id, r.bezeichnung, r.startet_am, r.endet_am
    from runden r
    where r.startet_am <= now()
    order by r.startet_am desc
    limit v_wochen
  ),
  runden_sortiert as (
    select lr.id, lr.bezeichnung, lr.startet_am, lr.endet_am,
           (row_number() over (order by lr.startet_am) - 1)::int as reihenfolge
    from letzte_runden lr
  ),
  wochenfragen as (
    select distinct rf.runde_id, rf.frage_id
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    where rf.runde_id in (select rs.id from runden_sortiert rs)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  fragen_je_runde as (
    select wf.runde_id, count(*)::int as anzahl
    from wochenfragen wf
    group by wf.runde_id
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
  )
  select
    rs.id,
    rs.bezeichnung,
    to_char(rs.startet_am, 'DD.MM.'),
    (now() between rs.startet_am and rs.endet_am),
    rs.reihenfolge,
    p.name,
    coalesce(fjr.anzahl, 0),
    count(a.id)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    greatest(coalesce(fjr.anzahl, 0) - count(a.id)::int, 0)
  from runden_sortiert rs
  cross join personen p
  left join fragen_je_runde fjr on fjr.runde_id = rs.id
  left join wochenfragen wf on wf.runde_id = rs.id
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by rs.id, rs.bezeichnung, rs.startet_am, rs.endet_am,
           rs.reihenfolge, p.id, p.name, fjr.anzahl
  order by rs.reihenfolge, p.name;
end;
$function$;

revoke all on function public.obmann_wochen_matrix(int, text) from public;
grant execute on function public.obmann_wochen_matrix(int, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. Staerken und Schwaechen je Thema bzw. Regelbereich
-- ------------------------------------------------------------

drop function if exists public.obmann_staerken_schwaechen(text, int, text);

create function public.obmann_staerken_schwaechen(
  p_schiedsrichter text default null,
  p_wochen int default 12,
  p_passwort text default null
)
returns table(
  thema text,
  gesamt int,
  richtig int,
  falsch int,
  nicht_beantwortet int
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 12), 1), 52);
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  return query
  with letzte_runden as (
    select r.id, r.startet_am
    from runden r
    where r.startet_am <= now()
    order by r.startet_am desc
    limit v_wochen
  ),
  wochenfragen as (
    -- Das Thema kommt bevorzugt aus der frei gepflegten Kategorie. Fehlt
    -- sie, ist die Regelnummer der beste verfuegbare Regelbereich - sonst
    -- landeten zwei Drittel aller Fragen in einem nutzlosen Sammeltopf.
    select distinct
      rf.frage_id,
      coalesce(
        nullif(btrim(f.kategorie), ''),
        'Regel ' || rg.nummer::text || ' - ' || rg.bezeichnung,
        'Ohne Thema'
      ) as thema
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    left join regeln rg on rg.nummer = f.regel_nummer
    where rf.runde_id in (select lr.id from letzte_runden lr)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
      and (p_schiedsrichter is null or s.name = p_schiedsrichter)
  )
  select
    wf.thema,
    count(*)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    (count(*) - count(a.id))::int
  from wochenfragen wf
  cross join personen p
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by wf.thema
  order by wf.thema;
end;
$function$;

revoke all on function public.obmann_staerken_schwaechen(text, int, text) from public;
grant execute on function public.obmann_staerken_schwaechen(text, int, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Kennzahlen zu den Entscheidungs-Szenarien (nur Obmann-App)
-- ------------------------------------------------------------

drop function if exists public.obmann_szenario_dashboard();

create function public.obmann_szenario_dashboard()
returns table(
  szenarien_gesamt int,
  szenarien_aktiv int,
  versuche_gesamt int,
  versuche_7t int,
  teilnehmer_7t int,
  quote_prozent numeric,
  schwerstes_szenario text
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  with versuche as (
    -- 'komplett' ist der Wert, den szenario_antwort_pruefen fuer einen in
    -- allen Teilfragen richtigen Versuch schreibt. Alles andere gilt hier
    -- als nicht vollstaendig geloest.
    select sa.szenario_id,
           sa.schiedsrichter_id,
           sa.beantwortet_am,
           (sa.bewertung = 'komplett') as komplett
    from szenario_antworten sa
  ),
  je_szenario as (
    select v.szenario_id,
           count(*) as versuche,
           count(*) filter (where v.komplett) as treffer
    from versuche v
    group by v.szenario_id
  ),
  schwerstes as (
    select es.titel
    from je_szenario j
    join entscheidungs_szenarien es on es.id = j.szenario_id
    where j.versuche > 0
    order by (j.treffer::numeric / j.versuche) asc, j.versuche desc, es.titel
    limit 1
  )
  select
    (select count(*)::int from entscheidungs_szenarien),
    (select count(*)::int from entscheidungs_szenarien es2 where es2.aktiv),
    (select count(*)::int from versuche),
    (select count(*)::int from versuche v2
      where v2.beantwortet_am >= now() - interval '7 days'),
    (select count(distinct v3.schiedsrichter_id)::int from versuche v3
      where v3.beantwortet_am >= now() - interval '7 days'),
    case
      when (select count(*) from versuche) = 0 then 0::numeric
      else round(
        100.0 * (select count(*) from versuche v4 where v4.komplett)
              / (select count(*) from versuche), 1)
    end,
    (select sw.titel from schwerstes sw);
end;
$function$;

revoke all on function public.obmann_szenario_dashboard() from public;
grant execute on function public.obmann_szenario_dashboard() to authenticated;

-- ------------------------------------------------------------
-- 4. Datenpunkte je Schiedsrichter fuer das Streudiagramm
-- ------------------------------------------------------------

drop function if exists public.obmann_analyse_punkte(int, text);

create function public.obmann_analyse_punkte(
  p_wochen int default 12,
  p_passwort text default null
)
returns table(
  schiedsrichter text,
  beantwortet int,
  richtig int,
  falsch int,
  nicht_beantwortet int,
  quote_prozent numeric,
  wochen_aktiv int,
  mc_beantwortet int,
  freitext_beantwortet int,
  video_beantwortet int,
  icon_beantwortet int
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 12), 1), 52);
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  return query
  with letzte_runden as (
    select r.id, r.startet_am
    from runden r
    where r.startet_am <= now()
    order by r.startet_am desc
    limit v_wochen
  ),
  wochenfragen as (
    -- runde_id bleibt mit im Schluessel, weil wochen_aktiv zaehlen soll, in
    -- wie vielen Runden ueberhaupt etwas abgegeben wurde.
    select distinct
      rf.runde_id,
      rf.frage_id,
      coalesce(f.medium, 'text') as medium,
      coalesce(f.antworttyp, 'multiple_choice') as antworttyp
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    where rf.runde_id in (select lr.id from letzte_runden lr)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
  )
  select
    p.name,
    count(a.id)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    (count(*) - count(a.id))::int,
    case
      when count(a.id) = 0 then 0::numeric
      else round(100.0 * count(a.id) filter (where a.korrekt is true)
                       / count(a.id), 1)
    end,
    count(distinct wf.runde_id) filter (where a.id is not null)::int,
    -- Die vier Typspalten sind bewusst ueberschneidungsfrei und ergeben in
    -- Summe wieder beantwortet: Icon-Fragen zuerst, dann alles mit Video,
    -- der Rest nach antworttyp.
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium <> 'video'
        and wf.antworttyp = 'multiple_choice')::int,
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium <> 'video'
        and wf.antworttyp = 'freitext')::int,
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium = 'video')::int,
    count(a.id) filter (where wf.antworttyp = 'entscheidung')::int
  from personen p
  cross join wochenfragen wf
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by p.id, p.name
  order by p.name;
end;
$function$;

revoke all on function public.obmann_analyse_punkte(int, text) from public;
grant execute on function public.obmann_analyse_punkte(int, text) to anon, authenticated;
