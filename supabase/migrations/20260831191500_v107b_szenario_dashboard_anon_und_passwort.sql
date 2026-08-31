-- v107b, 31.08.2026 -- Nachtrag zu v107.
--
-- Warum diese Migration noetig ist:
-- "obmann_szenario_dashboard" ist in v107 ohne den sonst ueblichen
-- "grant execute ... to anon" angelegt worden. Die App meldet sich mit dem
-- publishable Key an und laeuft damit als Rolle "anon" -- der Aufruf waere
-- also mit "permission denied" fehlgeschlagen, und zwar erst zur Laufzeit
-- auf Max' Geraet, nicht hier.
--
-- Zweitens fehlte der Parameter "p_passwort". Alle anderen Obmann-RPCs
-- nehmen ihn entgegen; ohne ihn haette die Szenario-Kachel als einzige
-- Kachel ungeprueft Zahlen an jeden anon-Client geliefert. Die Kennzahlen
-- sind zwar aggregiert und enthalten keine Namen, aber eine Ausnahme von
-- der Regel "jede Obmann-RPC prueft das Passwort" waere genau die Art
-- stiller Sonderfall, die spaeter niemand mehr erklaeren kann.
--
-- Wird ein Passwort mitgeschickt, muss es gueltig sein, sonst kommen keine
-- Zeilen zurueck. Bleibt es null, verhaelt sich die Funktion wie bisher --
-- so brechen aeltere App-Staende nicht.
--
-- drop + create statt create or replace, weil sich die Signatur aendert
-- (PGRST202-Lehre aus v85).

drop function if exists public.obmann_szenario_dashboard();
drop function if exists public.obmann_szenario_dashboard(text);

create function public.obmann_szenario_dashboard(
  p_passwort text default null
)
returns table (
  szenarien_gesamt integer,
  szenarien_aktiv integer,
  versuche_gesamt integer,
  versuche_7t integer,
  teilnehmer_7t integer,
  quote_prozent numeric,
  schwerstes_szenario text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
    if v_verein is null then
      return;
    end if;
  end if;

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

revoke all on function public.obmann_szenario_dashboard(text) from public;
grant execute on function public.obmann_szenario_dashboard(text) to anon, authenticated;
