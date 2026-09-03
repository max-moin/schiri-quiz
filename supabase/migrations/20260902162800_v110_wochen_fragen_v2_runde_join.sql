-- v110, 02.09.2026 -- derselbe Join-Fehler wie in v109, aber in der Funktion,
-- die den Schiedsrichtern ihre Wochenfragen ausliefert.
--
-- "wochen_fragen_v2" (aus v108, Codex) verbindet "wochen_frage_nummern" nur
-- ueber verein_id und frage_id, obwohl die View auch eine runde_id fuehrt.
-- Solange keine Frage in zwei Runden vorkommt, faellt das nicht auf. Sobald
-- Max eine Frage ein zweites Mal einplant -- also beim ersten Mal, wo der
-- Fragenbestand wiederverwendet wird -- traefe der Join zweimal, und jeder
-- Schiedsrichter bekaeme diese Frage im Wochenquiz doppelt angezeigt. Das ist
-- kein Schoenheitsfehler: doppelte Zeilen wuerden auch die Zaehlung von
-- beantwortet/offen verfaelschen.
--
-- Geprueft am 02.09.2026: Aktuell verwendet noch kein Verein dieselbe Frage in
-- zwei Runden. Der Fehler ist also latent und wartet.
--
-- Warum diese Migration die Funktion nicht neu ausschreibt:
-- Der Rumpf stammt unveraendert aus v108 und ist lang. Ihn hier abzutippen
-- hiesse, ihn versehentlich zu veraendern -- genau das Risiko, das man beim
-- Nachziehen eines Einzeilers nicht eingehen will. Stattdessen wird die
-- bestehende Definition gelesen, exakt eine Stelle ersetzt und wieder
-- eingespielt. Trifft die Ersetzung nicht genau einmal, bricht die Migration
-- mit einem Fehler ab, statt stillschweigend nichts zu tun.
--
-- ACHTUNG, ehrlich dazugesagt: Diese Migration ist NICHT idempotent. Der
-- gesuchte Text ist ein Anfangsstueck des ersetzten Textes; ein zweiter Lauf
-- auf derselben Datenbank haenge die Bedingung ein zweites Mal an. Fachlich
-- waere das folgenlos ("a and a"), sauber ist es nicht. Migrationswerkzeuge
-- fuehren jede Migration genau einmal aus, deshalb bleibt es so -- aber nicht
-- von Hand nachspielen.

do $migration$
declare
  v_def text;
  v_alt text := 'join public.wochen_frage_nummern nr on nr.verein_id=rf.verein_id and nr.frage_id=rf.frage_id';
  v_neu text := 'join public.wochen_frage_nummern nr on nr.verein_id=rf.verein_id and nr.frage_id=rf.frage_id and nr.runde_id=rf.runde_id';
  v_treffer integer;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'wochen_fragen_v2'
    and pg_get_function_identity_arguments(p.oid) = 'p_schiedsrichter_id uuid, p_pin text';

  if v_def is null then
    raise exception 'v110: wochen_fragen_v2(uuid, text) nicht gefunden - Migration passt nicht zum Stand der Datenbank';
  end if;

  v_treffer := (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt);

  if v_treffer <> 1 then
    raise exception 'v110: Join-Zeile % mal gefunden statt genau einmal - Definition hat sich geaendert, bitte von Hand pruefen', v_treffer;
  end if;

  execute replace(v_def, v_alt, v_neu);
end;
$migration$;

-- Nachweis, dass die Aenderung wirklich in der Funktion steht. Schlaegt fehl,
-- wenn das execute oben aus irgendeinem Grund nicht gegriffen hat.
do $pruefung$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'wochen_fragen_v2';

  if position('and nr.runde_id=rf.runde_id' in v_def) = 0 then
    raise exception 'v110: Der runde_id-Join steht nach der Migration nicht in wochen_fragen_v2';
  end if;
end;
$pruefung$;
