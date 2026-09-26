-- ============================================================
--  Fragenkatalog der App: Antworttyp in den Kennzeichnungen
-- ============================================================
--  WARUM (26.09.2026, Max): Der Filter "Fragetyp" in Planung und
--  Fragenkatalog mischte zwei Achsen (Medium und Antworttyp) in einer
--  Liste aus dem alten "typ"-Feld - "Mehrfachauswahl", "Zahl" und
--  "Icon-Antwort" liessen sich gar nicht filtern. Die App filtert jetzt
--  getrennt nach Medium (Text/Bild/Video) und Antworttyp, jeweils mit
--  Mehrfachwahl. Das Medium kam schon ueber diese Funktion, der
--  Antworttyp fehlte.
--
--  Neue Spalte am Ende -> Rueckgabetyp aendert sich -> drop + create.
--  Aeltere App-Fassungen ignorieren das zusaetzliche Feld beim Dekodieren.
-- ============================================================

drop function if exists public.obmann_fragen_kennzeichnungen(text);

create function public.obmann_fragen_kennzeichnungen(p_passwort text)
returns table(frage_id uuid, kurztitel text, medium text, kontext text, antworttyp text)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform public.obmann_verein(p_passwort);
  return query
    select f.id, r.kurztitel, f.medium::text,
      case when f.medium = 'video' then nullif(left(btrim(f.antwort_hinweis), 180), '')
           when f.medium = 'bild' then nullif(left(btrim(f.bild_alt), 180), '') end,
      f.antworttyp::text
    from public.fragen f left join public.frage_redaktion r on r.frage_id = f.id;
end;
$function$;

revoke all on function public.obmann_fragen_kennzeichnungen(text) from public;
grant execute on function public.obmann_fragen_kennzeichnungen(text) to anon, authenticated;
