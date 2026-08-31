-- ============================================================
--  v105 - Icon-Antworten im Verein-Menue sichtbar machen
-- ============================================================
--
-- ------------------------------------------------------------
--  WAS MAX GEMELDET HAT
-- ------------------------------------------------------------
--
-- Max am 31.08.2026: "Wenn man bei Verein auf einen Schiri
-- draufklickt, kommt man in dieses Quizmenue. Da sieht man, ob die
-- Frage richtig beantwortet oder nicht beantwortet wurde, und man kann
-- es bearbeiten. Das geht bei den Icon-Antworttypen noch nicht. Da
-- wird auch nicht angezeigt, ob es richtig oder falsch ist."
--
-- ------------------------------------------------------------
--  WARUM DAS SO WAR
-- ------------------------------------------------------------
--
-- obmann_person_verlauf liefert bis hierhin nur die Multiple-Choice-
-- und die Freitext-Welt: option_a/b/c, richtige_option,
-- gegebene_option, musterantwort. Eine Frage mit antworttyp
-- 'entscheidung' hat davon NICHTS - alle diese Spalten sind bei ihr
-- NULL. Die App konnte deshalb gar nichts anzeigen, egal wie sie
-- gebaut ist: die Daten waren nie in der Antwort der RPC enthalten.
--
-- Die Antwort selbst liegt seit v100 vollstaendig in
-- antwort_entscheidungen (gegebene_antwort, loesung_snapshot und die
-- sieben Teilnoten). Nur gelesen hat sie im Obmann-Bereich niemand.
-- Genau diese Luecke schliesst v105 - es entstehen keine neuen Daten,
-- es werden nur vorhandene endlich mit ausgeliefert.
--
-- ------------------------------------------------------------
--  WARUM DIE TEILNOTEN ALS EIGENES JSON-OBJEKT
-- ------------------------------------------------------------
--
-- Sieben zusaetzliche boolean-Spalten in der Rueckgabetabelle waeren
-- sieben weitere Stellen, an denen ein Decoder in der App stolpern
-- kann, und sie waeren fuer jede andere Frageart leer. Als ein
-- jsonb-Objekt bleibt die Signatur schmal und hat dieselbe Form wie
-- das, was die Website unter 'ergebnis' schon kennt
-- (entscheidung_ergebnis_bauen). Wer die Darstellung einmal versteht,
-- versteht sie an beiden Stellen.
--
-- Wichtig dabei: NULL bei einer Teilnote heisst seit v101 "war nicht
-- gefragt" - nicht "falsch". jsonb_build_object behaelt den Schluessel
-- mit JSON-null, die Unterscheidung bleibt also erhalten. Wuerde man
-- hier zu false zusammenfassen, stuende in der Auswertung ein rotes
-- Kreuz an einem Bestandteil, nach dem die Frage nie gefragt hat.
--
-- Das ganze Objekt ist NULL, wenn es zu dieser Antwort gar keine
-- Entscheidungs-Zeile gibt. Das ist ein echter Unterschied und keine
-- Spitzfindigkeit: Wenn Max eine Icon-Frage von Hand auf richtig oder
-- falsch setzt (obmann_antwort_ueberschreiben), entsteht eine Zeile in
-- antworten ohne Zeile in antwort_entscheidungen. Die App darf dann
-- keine leere Aufloesung zeigen, sondern muss sagen, dass hier von
-- Hand bewertet wurde.
--
-- ------------------------------------------------------------
--  WARUM antworttyp MITKOMMT
-- ------------------------------------------------------------
--
-- Die App hat bisher an fragen.typ entschieden, welchen Zweig sie
-- zeichnet. Seit v92 ist genau das die Spalte mit zwei
-- zusammengefalteten Achsen. Der Zweig fuer Icon-Antworten soll an der
-- Achse haengen, die die Antwortform beschreibt - sonst muesste jede
-- neue Kombination aus Medium und Antwortform hier nachgepflegt
-- werden. typ bleibt zusaetzlich in der Rueckgabe, damit aeltere
-- App-Fassungen unveraendert weiterlaufen.
--
-- ------------------------------------------------------------
--  WARUM DROP UND NEU STATT CREATE OR REPLACE
-- ------------------------------------------------------------
--
-- Der Rueckgabetyp aendert sich (vier Spalten mehr). Postgres lehnt
-- ein create or replace mit geaenderter Rueckgabetabelle ab, und
-- PostgREST wuerde danach mit PGRST202 antworten, weil sein Schema-
-- Cache noch die alte Form kennt. Die Parameterliste bleibt gleich,
-- ein Aufruf aus einer aelteren App-Fassung findet die Funktion also
-- weiterhin und bekommt schlicht vier Spalten mehr, die sie ignoriert.
--
-- Nach dem Neuanlegen fallen die Rechte auf den Standard zurueck -
-- deshalb unten ausdruecklich revoke fuer public und grant fuer anon
-- und authenticated.
-- ============================================================

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
  v_verein := obmann_verein(p_passwort);

  select id into v_schiedsrichter_id
  from schiedsrichter
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
    (a.id is not null),
    case a.gegebene_option
      when 'a' then f.option_a
      when 'b' then f.option_b
      when 'c' then f.option_c
      else null
    end,
    case f.richtige_option
      when 'a' then f.option_a
      when 'b' then f.option_b
      when 'c' then f.option_c
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
    ae.gegebene_antwort,
    ae.loesung_snapshot,
    -- Nur bauen, wenn es die Zeile wirklich gibt. Sonst waere ein
    -- Objekt aus lauter JSON-null nicht von "alles war nicht gefragt"
    -- zu unterscheiden - und genau das ist der Fall "von Hand
    -- bewertet", der anders aussehen muss.
    case
      when ae.antwort_id is null then null
      else jsonb_build_object(
        'fortsetzung_richtig',   ae.fortsetzung_richtig,
        'richtung_richtig',      ae.richtung_richtig,
        'ort_richtig',           ae.ort_richtig,
        'strafe_richtig',        ae.strafe_richtig,
        'strafziel_richtig',     ae.strafziel_richtig,
        'rolle_richtig',         ae.rolle_richtig,
        'rueckennummer_richtig', ae.rueckennummer_richtig,
        'ort_feedback',          ae.ort_feedback)
    end
  from fragen f
  left join runden_fragen rf
    on rf.frage_id = f.id
   and rf.verein_id = v_verein
  left join runden r
    on r.id = rf.runde_id
  left join wochen_frage_nummern nr
    on nr.verein_id = rf.verein_id
   and nr.runde_id = rf.runde_id
   and nr.frage_id = rf.frage_id
  left join antworten a
    on a.frage_id = f.id
   and a.schiedsrichter_id = v_schiedsrichter_id
  -- Haengt an der Antwort, nicht an der Frage: die Aufloesung ist ein
  -- Schnappschuss vom Zeitpunkt des Antwortens. Wird die Loesung der
  -- Frage spaeter geaendert, bleibt hier stehen, wogegen damals
  -- tatsaechlich bewertet wurde.
  left join antwort_entscheidungen ae
    on ae.antwort_id = a.id
  order by
    r.startet_am desc nulls last,
    nr.frage_nummer nulls last,
    f.erstellt_am,
    f.id;
end;
$function$;

revoke all on function public.obmann_person_verlauf(text, text) from public;
grant execute on function public.obmann_person_verlauf(text, text) to anon, authenticated;
