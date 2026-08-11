drop function if exists public.obmann_person_verlauf(text, text);

create function public.obmann_person_verlauf(
  p_passwort text,
  p_schiedsrichter text
)
returns table(
  runde text,
  runde_id uuid,
  runde_start timestamptz,
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
  beantwortet_am timestamptz,
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
  frage_nummer integer
)
language plpgsql
security definer
set search_path = public
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
    nr.frage_nummer
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
  order by
    r.startet_am desc nulls last,
    nr.frage_nummer nulls last,
    f.erstellt_am,
    f.id;
end;
$function$;

grant execute on function public.obmann_person_verlauf(text, text)
  to anon, authenticated, service_role;
