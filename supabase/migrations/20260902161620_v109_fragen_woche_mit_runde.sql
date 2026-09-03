-- v109, 02.09.2026 -- "obmann_fragen_woche" kann jetzt eine bestimmte Runde
-- auswerten statt immer nur die gerade laufende.
--
-- Nummer-Hinweis: Diese Migration hiess zunaechst v108. Die Nummer war
-- aber schon von "v108_flexible_fragen" (01.09.2026, Codex) belegt -- zwei
-- verschiedene Migrationen mit derselben Nummer haetten die Reihenfolge
-- unlesbar gemacht. Umbenannt auf v109, auch im Eintrag in
-- supabase_migrations.schema_migrations (Version 20260902161620).
--
-- Anlass: Max moechte im Dashboard die Woche wechseln koennen ("zeig mir das
-- Dashboard von letzter Woche"). "obmann_dashboard_woche" und
-- "obmann_wochenauswertung" nehmen dafuer laengst ein p_runde_id entgegen,
-- diese Funktion als einzige nicht -- die Fragen-Auswertung waere also beim
-- Zurueckblaettern auf der aktuellen Woche stehen geblieben, ohne dass man es
-- gesehen haette. Genau die Art stiller Falschanzeige, die man erst bemerkt,
-- wenn man einer Zahl schon geglaubt hat.
--
-- Zwei Dinge werden hier zusaetzlich geradegezogen:
--
-- 1) Der Join auf "wochen_frage_nummern" lief bisher nur ueber verein_id und
--    frage_id, obwohl die View auch eine runde_id fuehrt. Solange der
--    Datumsfilter ohnehin genau eine Runde uebrig liess, fiel das nicht auf.
--    Sobald aber eine Frage in zwei Runden vorkommt -- was beim Zurueckblaettern
--    der Normalfall ist, weil Fragen wiederverwendet werden -- haette derselbe
--    Datensatz mehrfach getroffen und die Zeile vervielfacht. Der Join bekommt
--    deshalb "and nr.runde_id = rf.runde_id".
--    Geprueft am 02.09.2026: Aktuell verwendet noch kein Verein dieselbe Frage
--    in zwei Runden, der Fehler war also latent und nicht sichtbar. Er waere
--    beim ersten wiederverwendeten Fragebestand aufgetreten.
--
-- 2) Der Nenner fuer "nicht beantwortet" zaehlt die heute aktiven
--    Schiedsrichter. Fuer die laufende Woche ist das richtig und bleibt
--    unveraendert. Fuer eine vergangene Woche waere es falsch: Wer seitdem
--    dazugekommen ist, haette damals gar nicht antworten koennen. Bei einer
--    ausdruecklich angefragten Runde wird deshalb gezaehlt, wer bis zum Ende
--    jener Runde schon angelegt war.
--    Ehrlich dazugesagt: Ob jemand DAMALS aktiv war, laesst sich nicht
--    rekonstruieren -- ein "aktiv"-Verlauf wird nicht gefuehrt. Deshalb wird
--    fuer vergangene Runden bewusst NICHT auf das heutige aktiv-Kennzeichen
--    gefiltert. Sonst faellt jemand, der inzwischen ausgetreten ist, aus dem
--    Nenner heraus und eine alte Woche saehe rueckwirkend besser aus, als sie
--    war. Lieber eine Zahl, die stabil bleibt, als eine, die sich schmeichelt.
--
-- Die "f.aktiv"-Bedingung bleibt in beiden Faellen bestehen: Die View
-- "wochen_frage_nummern" vergibt Nummern nur an aktive Fragen. Wuerde man
-- inaktive mitnehmen, haetten sie keine Nummer und die Nummerierung der
-- uebrigen passte nicht mehr zum Planungsmenue -- genau der Fehler, der in
-- v75 schon einmal behoben wurde.
--
-- drop + create statt create or replace, weil sich die Signatur aendert
-- (PGRST202-Lehre aus v85). Der Parameter ist optional, damit aeltere
-- App-Staende, die nur p_passwort schicken, unveraendert weiterlaufen.

drop function if exists public.obmann_fragen_woche(text);
drop function if exists public.obmann_fragen_woche(text, uuid);

create function public.obmann_fragen_woche(
  p_passwort text,
  p_runde_id uuid default null
)
returns table (
  frage_id uuid,
  frage_text text,
  richtig integer,
  falsch integer,
  nicht_beantwortet integer,
  frage_nummer integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_gesamt_schiedsrichter integer;
  v_runde_ende timestamptz;
begin
  v_verein := obmann_verein(p_passwort);

  if p_runde_id is null then
    -- Unveraenderte Zaehlung der laufenden Woche. Zaehlte vorher ALLE
    -- Personen des Vereins, auch Testkonten und Ehemalige. Dadurch stand bei
    -- "nicht beantwortet" immer eine zu hohe Zahl, die sich nie auf null
    -- bringen liess.
    select count(*) into v_gesamt_schiedsrichter
    from schiedsrichter
    where verein_id = v_verein and ist_test = false and coalesce(aktiv, true);
  else
    select r.endet_am into v_runde_ende from runden r where r.id = p_runde_id;

    select count(*) into v_gesamt_schiedsrichter
    from schiedsrichter s
    where s.verein_id = v_verein
      and s.ist_test = false
      and (v_runde_ende is null or s.erstellt_am <= v_runde_ende);
  end if;

  return query
  select
    f.id,
    f.frage_text,
    count(a.id) filter (where a.korrekt = true)::integer,
    count(a.id) filter (where a.korrekt = false)::integer,
    (v_gesamt_schiedsrichter - count(a.id))::integer,
    nr.frage_nummer
  from fragen f
  join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join runden r on r.id = rf.runde_id
  join wochen_frage_nummern nr
    on nr.verein_id = rf.verein_id
   and nr.frage_id = rf.frage_id
   and nr.runde_id = rf.runde_id
  left join antworten a
    on a.frage_id = f.id
   and exists (select 1 from schiedsrichter s
               where s.id = a.schiedsrichter_id
                 and s.verein_id = v_verein
                 and s.ist_test = false
                 and coalesce(s.aktiv, true))
  where (
          case
            when p_runde_id is null then now() between r.startet_am and r.endet_am
            else r.id = p_runde_id
          end
        )
    and f.aktiv
  group by f.id, f.frage_text, nr.frage_nummer
  order by nr.frage_nummer nulls last;
end;
$function$;

revoke all on function public.obmann_fragen_woche(text, uuid) from public;
grant execute on function public.obmann_fragen_woche(text, uuid) to anon, authenticated;

comment on function public.obmann_fragen_woche(text, uuid) is
'Auswertung je Frage einer Woche. p_runde_id null = laufende Runde (unveraendertes Verhalten). Mit p_runde_id wird jene Runde ausgewertet; der Nenner fuer nicht_beantwortet zaehlt dann, wer bis zum Ende jener Runde angelegt war, ohne Filter auf das heutige aktiv-Kennzeichen (ein aktiv-Verlauf wird nicht gefuehrt). Siehe v108.';
