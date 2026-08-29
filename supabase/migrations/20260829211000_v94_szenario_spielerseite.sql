-- v94_szenario_spielerseite (29.08.2026)
--
-- Die drei RPCs, die der Entscheidungs-Modus auf der Website braucht.
--
-- ============================================================
--  Warum der Modus hinter der PIN liegt
-- ============================================================
--
-- Das Wochenquiz hat einen Gastweg (gast_antwort_pruefen, fragen.
-- sichtbar_gast). Fuer den Entscheidungs-Modus bewusst nicht:
--   - Jedes Szenario kostet ein erzeugtes Bild. Anonym abrufbar heisst
--     absaugbar.
--   - Ohne Schiedsrichter gibt es keine Serie und keine Statistik -
--     also genau das, was den Modus zum Spiel macht.
-- Gaeste sehen die Kachel in der Modus-Auswahl gesperrt mit dem Hinweis,
-- dass es dafuer eine Vereinskennung braucht. Das ist ein Koeder, kein
-- Verlust. Falls Max das spaeter anders will: eine Spalte
-- sichtbar_gast am Szenario und zwei RPC-Zwillinge, wie beim Quiz.
--
-- ============================================================
--  Die Auswertung passiert hier, nicht im Browser
-- ============================================================
--
-- szenario_antwort_pruefen bekommt die Wahl und gibt das Ergebnis
-- zurueck. Die richtige Antwort geht erst mit dem Ergebnis raus - im
-- selben Aufruf, aber nach dem Speichern. Der Browser kann sie also
-- nicht vorher sehen, und ein zweiter Versuch steht als eigener
-- Datensatz in der Tabelle.
--
-- ACHTUNG: szenario_antwort_pruefen und szenario_statistik werden in
-- v96 neu geschrieben (Serie). Massgeblich ist dort die spaetere Fassung.

-- ============================================================
--  1. Naechstes Szenario ausliefern (ohne Loesung)
-- ============================================================

drop function if exists public.szenario_naechstes(uuid, text, uuid);

create function public.szenario_naechstes(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_ausschluss_szenario_id uuid default null
)
returns table (
  id uuid,
  titel text,
  beschreibung text,
  bild_base64 text,
  bild_mime text,
  bild_quelle text,
  trikot_heim text,
  trikot_gast text,
  regel_nummer smallint,
  regel_bezeichnung text,
  schwierigkeit smallint,
  zusatzfragen jsonb,
  schon_gespielt boolean,
  offen_gesamt integer
)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text;
  v_aktiv boolean;
begin
  select s.pin, s.aktiv into v_pin, v_aktiv
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  return query
  with gespielt as (
    select a.szenario_id, max(a.beantwortet_am) as zuletzt
    from szenario_antworten a
    where a.schiedsrichter_id = p_schiedsrichter_id
    group by a.szenario_id
  )
  select sz.id, sz.titel, sz.beschreibung,
         sz.bild_base64, sz.bild_mime, sz.bild_quelle,
         sz.trikot_heim, sz.trikot_gast,
         sz.regel_nummer, reg.bezeichnung, sz.schwierigkeit,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', z.id, 'position', z.position,
                    'frage_text', z.frage_text, 'optionen', z.optionen)
                  order by z.position)
           from szenario_zusatzfragen z where z.szenario_id = sz.id
         ), '[]'::jsonb),
         g.szenario_id is not null,
         (select count(*)::int from entscheidungs_szenarien s2
           where s2.aktiv and s2.id not in (select szenario_id from gespielt))
  from entscheidungs_szenarien sz
  left join regeln reg on reg.nummer = sz.regel_nummer
  left join gespielt g on g.szenario_id = sz.id
  where sz.aktiv
    and (p_ausschluss_szenario_id is null or sz.id <> p_ausschluss_szenario_id)
  -- Ungespielte zuerst, danach das am laengsten zurueckliegende.
  -- random() nur als Gleichstand-Entscheid, damit die Reihenfolge nicht
  -- jede Woche dieselbe ist.
  order by (g.szenario_id is not null), g.zuletzt nulls first, random()
  limit 1;
end;
$function$;

-- ============================================================
--  2. Antwort pruefen und speichern
-- ============================================================

drop function if exists public.szenario_antwort_pruefen(uuid, text, uuid, text, text, text, text, jsonb);

create function public.szenario_antwort_pruefen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_szenario_id uuid,
  p_fortsetzung text,
  p_strafe text,
  p_fortsetzung_fuer text default null,
  p_strafe_fuer text default null,
  p_zusatz jsonb default '{}'::jsonb
)
returns table (
  bewertung text,
  punkte smallint,
  fortsetzung_richtig boolean,
  richtung_richtig boolean,
  strafe_richtig boolean,
  strafe_ziel_richtig boolean,
  zusatz_ergebnis jsonb,
  loesung jsonb,
  erklaerung text,
  versuch_nr smallint,
  serie integer
)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text;
  v_aktiv boolean;
  l record;
  v_fuer text;
  v_strafe_fuer text;
  v_fortsetzung_ok boolean;
  v_richtung_ok boolean;
  v_strafe_ok boolean;
  v_strafziel_ok boolean;
  v_zusatz jsonb := '[]'::jsonb;
  v_zusatz_alle_ok boolean := true;
  v_punkte smallint;
  v_bewertung text;
  v_versuch smallint;
  v_serie integer := 0;
  z record;
begin
  select s.pin, s.aktiv into v_pin, v_aktiv
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  select * into l from szenario_loesungen where szenario_id = p_szenario_id;
  if not found then
    raise exception 'Szenario ohne Loesung';
  end if;
  if not exists (select 1 from entscheidungs_szenarien s where s.id = p_szenario_id and s.aktiv) then
    raise exception 'Szenario nicht freigegeben';
  end if;

  -- Eingaben auf die Form bringen, in der auch die Loesung steht.
  -- Weiterspielen und Schiedsrichter-Ball haben keine Richtung, "keine
  -- Strafe" hat keinen Betroffenen. Ohne diese Normalisierung waere ein
  -- vom Browser mitgeschicktes Restfeld ein falsches Ergebnis, obwohl
  -- der Tipp stimmt.
  v_fuer := case when p_fortsetzung in ('weiterspielen', 'sr_ball')
                 then null else nullif(p_fortsetzung_fuer, '') end;
  v_strafe_fuer := case when p_strafe = 'keine'
                        then null else nullif(p_strafe_fuer, '') end;

  v_fortsetzung_ok := p_fortsetzung = l.spielfortsetzung;
  v_richtung_ok    := v_fuer is not distinct from l.fortsetzung_fuer;
  v_strafe_ok      := p_strafe = l.persoenliche_strafe;
  v_strafziel_ok   := v_strafe_fuer is not distinct from l.strafe_fuer_mannschaft;

  for z in
    select zf.id, zf.frage_text,
           p_zusatz ->> zf.id::text            as gewaehlt,
           l.zusatz_antworten ->> zf.id::text  as richtig
    from szenario_zusatzfragen zf
    where zf.szenario_id = p_szenario_id
    order by zf.position
  loop
    v_zusatz := v_zusatz || jsonb_build_object(
      'id', z.id, 'frage_text', z.frage_text,
      'gewaehlt', z.gewaehlt, 'richtig', z.richtig,
      'ok', z.gewaehlt is not distinct from z.richtig);
    if z.gewaehlt is distinct from z.richtig then
      v_zusatz_alle_ok := false;
    end if;
  end loop;

  -- Zwei Achsen, zwei Punkte. Die Richtung gehoert zur Fortsetzung und
  -- der Betroffene zur Strafe - "Freistoss fuer die falsche Mannschaft"
  -- ist keine halbe richtige Entscheidung.
  v_punkte := (case when v_fortsetzung_ok and v_richtung_ok then 1 else 0 end)
            + (case when v_strafe_ok and v_strafziel_ok then 1 else 0 end);

  v_bewertung := case
    when v_punkte = 2 and v_zusatz_alle_ok then 'komplett'
    when v_punkte = 0 then 'falsch'
    else 'teilweise' end;

  select coalesce(max(a.versuch_nr), 0)::smallint + 1 into v_versuch
  from szenario_antworten a
  where a.schiedsrichter_id = p_schiedsrichter_id and a.szenario_id = p_szenario_id;

  insert into szenario_antworten (
    schiedsrichter_id, szenario_id,
    gewaehlte_fortsetzung, gewaehlte_fortsetzung_fuer,
    gewaehlte_strafe, gewaehlte_strafe_fuer,
    gewaehlte_zusatz, bewertung, punkte, versuch_nr)
  values (
    p_schiedsrichter_id, p_szenario_id,
    p_fortsetzung, v_fuer, p_strafe, v_strafe_fuer,
    coalesce(p_zusatz, '{}'::jsonb), v_bewertung, v_punkte, v_versuch);

  -- Serie: wie viele der zuletzt gespielten Szenarien hintereinander
  -- komplett richtig waren. Bricht beim ersten Fehler ab.
  -- (In v96 durch public.szenario_serie() ersetzt - die Sortierung nach
  -- beantwortet_am war nicht eindeutig.)
  select count(*)::int into v_serie
  from (
    select a.bewertung,
           row_number() over (order by a.beantwortet_am desc) as rn,
           sum(case when a.bewertung = 'komplett' then 0 else 1 end)
             over (order by a.beantwortet_am desc rows between unbounded preceding and current row) as fehler
    from szenario_antworten a
    where a.schiedsrichter_id = p_schiedsrichter_id
  ) t
  where t.fehler = 0;

  return query select
    v_bewertung, v_punkte,
    v_fortsetzung_ok, v_richtung_ok, v_strafe_ok, v_strafziel_ok,
    v_zusatz,
    jsonb_build_object(
      'spielfortsetzung', l.spielfortsetzung,
      'fortsetzung_fuer', l.fortsetzung_fuer,
      'persoenliche_strafe', l.persoenliche_strafe,
      'strafe_fuer_mannschaft', l.strafe_fuer_mannschaft,
      'strafe_fuer_rolle', l.strafe_fuer_rolle,
      'strafe_rueckennummer', l.strafe_rueckennummer),
    l.erklaerung, v_versuch, v_serie;
end;
$function$;

-- ============================================================
--  3. Statistik fuer die Modus-Auswahl
-- ============================================================

drop function if exists public.szenario_statistik(uuid, text);

create function public.szenario_statistik(p_schiedsrichter_id uuid, p_pin text)
returns table (
  szenarien_gesamt integer,
  gespielt integer,
  offen integer,
  komplett integer,
  quote numeric,
  serie integer
)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text;
  v_aktiv boolean;
begin
  select s.pin, s.aktiv into v_pin, v_aktiv
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  return query
  with aktiv as (select count(*)::int as n from entscheidungs_szenarien where aktiv),
  meine as (
    select a.szenario_id, count(*) filter (where a.bewertung = 'komplett') as k
    from szenario_antworten a
    join entscheidungs_szenarien s on s.id = a.szenario_id and s.aktiv
    where a.schiedsrichter_id = p_schiedsrichter_id
    group by a.szenario_id
  ),
  serie as (
    select count(*)::int as n from (
      select sum(case when a.bewertung = 'komplett' then 0 else 1 end)
               over (order by a.beantwortet_am desc rows between unbounded preceding and current row) as fehler
      from szenario_antworten a
      where a.schiedsrichter_id = p_schiedsrichter_id
    ) t where t.fehler = 0
  )
  select aktiv.n,
         (select count(*)::int from meine),
         aktiv.n - (select count(*)::int from meine),
         (select count(*)::int from meine where k > 0),
         case when (select count(*) from meine) = 0 then 0::numeric
              else round(100.0 * (select count(*) from meine where k > 0)
                               / (select count(*) from meine), 0) end,
         serie.n
  from aktiv, serie;
end;
$function$;

-- ============================================================
--  4. Rechte
-- ============================================================

revoke all on function public.szenario_naechstes(uuid, text, uuid) from public;
revoke all on function public.szenario_antwort_pruefen(uuid, text, uuid, text, text, text, text, jsonb) from public;
revoke all on function public.szenario_statistik(uuid, text) from public;

grant execute on function public.szenario_naechstes(uuid, text, uuid) to anon, authenticated;
grant execute on function public.szenario_antwort_pruefen(uuid, text, uuid, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.szenario_statistik(uuid, text) to anon, authenticated;
