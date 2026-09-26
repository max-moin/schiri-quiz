-- ============================================================
--  Hinweis fuer die alte Quizseite (26.09.2026)
-- ============================================================
--  WARUM: Maximilian H. hat am 26.09. ueber die alte Adresse
--  schiri-quiz.vercel.app (Branch "main", seit dem Start der
--  Vereinsseite nicht mehr aktualisiert) gespielt. Die alte Seite kennt
--  keine Icon-Antworten und schickt auch Entscheidungsfragen ueber
--  antwort_abgeben - dort gab es nur "Frage nicht gefunden oder aktuell
--  nicht aktiv". Er konnte die Woche so nie abschliessen.
--
--  Diese Fassung aendert NUR die Fehlermeldung: steht die Frage in der
--  laufenden Woche des eigenen Vereins, ist aber keine Auswahlfrage,
--  sagt der Server jetzt, wo es weitergeht. Bewertung und Speichern
--  bleiben unveraendert.
-- ============================================================

create or replace function public.antwort_abgeben(p_schiedsrichter_id uuid, p_frage_id uuid, p_gegebene_option text, p_pin text)
 returns table(korrekt boolean, richtige_option text, bereits_beantwortet boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_pin text;
  v_ist_test boolean;
  v_aktiv boolean;
  v_verein uuid;
  v_richtige_option text;
  v_vorhanden antworten%rowtype;
  v_korrekt boolean;
begin
  select s.pin, s.ist_test, s.aktiv, s.verein_id
    into v_pin, v_ist_test, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  -- Die laufende Woche ergibt sich aus der Zuordnung des eigenen Vereins.
  select f.richtige_option into v_richtige_option
  from fragen f
  join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join runden r on r.id = rf.runde_id
  where f.id = p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv;

  if v_richtige_option is null then
    if exists (
      select 1 from fragen f
      join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
      join runden r on r.id = rf.runde_id
      where f.id = p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv
    ) then
      raise exception 'Diese Frage funktioniert nur auf der neuen Seite: www.schiri-loebtauer-kickers.com – bitte dort weitermachen.';
    end if;
    raise exception 'Frage nicht gefunden oder aktuell nicht aktiv';
  end if;

  v_korrekt := (v_richtige_option = p_gegebene_option);

  if v_ist_test then
    return query select v_korrekt, v_richtige_option, false;
    return;
  end if;

  select * into v_vorhanden from antworten
  where schiedsrichter_id = p_schiedsrichter_id and frage_id = p_frage_id;

  if found then
    return query select v_vorhanden.korrekt, v_richtige_option, true;
    return;
  end if;

  insert into antworten (schiedsrichter_id, frage_id, gegebene_option, korrekt)
  values (p_schiedsrichter_id, p_frage_id, p_gegebene_option, v_korrekt);

  return query select v_korrekt, v_richtige_option, false;
end;
$function$;
