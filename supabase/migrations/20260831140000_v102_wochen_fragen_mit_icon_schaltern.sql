-- v102_wochen_fragen_mit_icon_schaltern (31.08.2026)
--
-- Nachtrag zu v101. Die Schalter steuern das Formular im Quiz - aber der
-- Browser hat sie gar nicht. entscheidung_kontext_laden liefert sie zwar,
-- wird jedoch ausschliesslich serverseitig aus
-- api/entscheidung-bewerten.js aufgerufen (und liefert nebenbei den
-- richtigen Ort mit, darf also nie in den Browser).
--
-- Deshalb reisen die Schalter mit wochen_fragen mit. Sie verraten nichts:
-- "wird verlangt: ja/nein" ist keine Antwort, sondern die Frage.
--
-- Ohne diese Runde wuerde das Quiz weiterhin alle Felder anzeigen und als
-- Pflicht behandeln - die ganze Konfiguration aus v101 waere unsichtbar,
-- und der Server wiese die Antwort dann als unvollstaendig ab. Genau die
-- Sorte Fehler, die man erst beim ersten echten Durchlauf bemerkt.
--
-- RETURNS TABLE aendert sich, also drop+create statt create or replace -
-- sonst PGRST202 (die Lektion aus v85).

drop function if exists public.wochen_fragen(uuid, text);

create function public.wochen_fragen(p_schiedsrichter_id uuid, p_pin text)
returns table(
  id uuid, frage_text text, option_a text, option_b text, option_c text,
  regel_nummer smallint, regel_bezeichnung text, schwierigkeit smallint,
  "position" integer, typ text, antwort_hinweis text,
  video_url text, video_start_sekunden integer, video_end_sekunden integer,
  video_antworttyp text, video_stumm boolean, frage_nummer integer,
  medium text, antworttyp text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean,
  trikot_heim text, trikot_gast text)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  return query
  select f.id, f.frage_text, f.option_a, f.option_b, f.option_c,
         f.regel_nummer, reg.bezeichnung, f.schwierigkeit,
         rf."position", f.typ, f.antwort_hinweis,
         f.video_url, f.video_start_sekunden, f.video_end_sekunden,
         f.video_antworttyp, f.video_stumm,
         nr.frage_nummer,
         f.medium, f.antworttyp,
         -- Nur bei Icon-Fragen gibt es eine Loesungszeile. Bei allen
         -- anderen bleiben die Schalter NULL - der Browser fragt sie dort
         -- ohnehin nicht ab.
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben,
         l.trikot_heim, l.trikot_gast
  from fragen f
  join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join runden r on r.id = rf.runde_id
  join wochen_frage_nummern nr on nr.verein_id = rf.verein_id and nr.frage_id = rf.frage_id
  left join regeln reg on reg.nummer = f.regel_nummer
  -- WICHTIG: left join. Ein inner join wuerde alle Fragen ohne
  -- Icon-Loesung aus dem Wochenquiz werfen - also praktisch alle.
  left join frage_entscheidungsloesungen l on l.frage_id = f.id
  where now() between r.startet_am and r.endet_am and f.aktiv
  order by nr.frage_nummer nulls last, f.erstellt_am;
end;
$function$;

revoke all on function public.wochen_fragen(uuid, text) from public;
grant execute on function public.wochen_fragen(uuid, text) to anon, authenticated;
