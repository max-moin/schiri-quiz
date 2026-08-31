-- ============================================================
-- v106 - Icon-Antworten im Wochen-/Scoreboard-Detail
-- ============================================================
--
-- v105 schloss den strukturierten Datenpfad fuer die allgemeine
-- Personenansicht. Der wochenbezogene Drill-down benutzt jedoch eine
-- eigene RPC und wuerde Icon-Antworten weiterhin wie leere Multiple-
-- Choice-Antworten darstellen. Beide Ansichten erhalten deshalb denselben
-- Vierer-Vertrag: antworttyp, Antwort-, Loesungs- und Ergebnis-Snapshot.

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
    (a.id is not null),
    coalesce(a.korrekt, false),
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
    a.bewertungsstatus,
    a.zweiter_freitext,
    a.ki_nachfrage,
    a.ki_feedback_final,
    f.frage_nummer,
    f.antworttyp,
    ae.gegebene_antwort,
    ae.loesung_snapshot,
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
  from public.schiedsrichter s
  cross join (
    select
      f2.id,
      f2.frage_text,
      f2.option_a,
      f2.option_b,
      f2.option_c,
      f2.richtige_option,
      f2.typ,
      f2.antworttyp,
      f2.musterantwort,
      f2.erstellt_am,
      nr.frage_nummer
    from public.fragen f2
    join public.runden_fragen rf2
      on rf2.frage_id = f2.id
     and rf2.verein_id = v_verein
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
    on a.frage_id = f.id
   and a.schiedsrichter_id = s.id
  left join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  where s.ist_test = false
    and s.verein_id = v_verein
    and coalesce(s.aktiv, true)
  order by s.name, f.frage_nummer nulls last, f.erstellt_am;
end;
$function$;

revoke all on function public.obmann_wochenauswertung(text, uuid) from public;
grant execute on function public.obmann_wochenauswertung(text, uuid) to anon, authenticated;
