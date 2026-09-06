-- v125: Ein Fragenvorschlag gilt nur mit einer zum Antworttyp passenden,
-- ausgefuellten Loesung als vollstaendig. Die Pruefung liegt serverseitig,
-- damit sie nicht durch manipulierte Browserdaten umgangen werden kann.

create or replace function public.fragenvorschlag_inhalt_pruefen(p_inhalt jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_medium text;
  v_typ text;
  v_loesung jsonb;
begin
  if jsonb_typeof(p_inhalt) is distinct from 'object'
     or char_length(btrim(coalesce(p_inhalt->>'frage_text',''))) not between 10 and 2000
     or coalesce(p_inhalt->>'medium','') not in ('text','video','bild')
     or coalesce(p_inhalt->>'antworttyp','') not in
        ('multiple_choice','mehrfachauswahl','freitext','zahl','entscheidung')
     or jsonb_typeof(coalesce(p_inhalt->'loesung','{}'::jsonb)) is distinct from 'object' then
    raise exception 'Der Fragenvorschlag ist unvollstaendig oder ungueltig.';
  end if;

  v_medium := p_inhalt->>'medium';
  v_typ := p_inhalt->>'antworttyp';
  v_loesung := p_inhalt->'loesung';

  if v_medium <> 'text'
     and char_length(btrim(coalesce(p_inhalt->>'medium_url',''))) < 5 then
    raise exception 'Fuer eine Bild- oder Videofrage fehlt das Medium.';
  end if;

  if v_typ in ('multiple_choice','mehrfachauswahl') then
    if jsonb_typeof(v_loesung->'optionen') is distinct from 'array'
       or jsonb_array_length(v_loesung->'optionen') < 2
       or char_length(btrim(coalesce(v_loesung->>'richtig',''))) < 1 then
      raise exception 'Auswahlfragen brauchen mindestens zwei Antworten und die richtige Auswahl.';
    end if;
  elsif v_typ = 'freitext' then
    if char_length(btrim(coalesce(v_loesung->>'musterantwort',''))) < 5
       or char_length(btrim(coalesce(v_loesung->>'bewertungshinweise',''))) < 10 then
      raise exception 'Freitextfragen brauchen Musterantwort und Bewertungshinweise.';
    end if;
  elsif v_typ = 'zahl' then
    if char_length(btrim(coalesce(v_loesung->>'wert',''))) < 1 then
      raise exception 'Bei einer Zahlenfrage fehlt der richtige Wert.';
    end if;
  elsif v_typ = 'entscheidung' then
    if char_length(btrim(concat_ws(' ',
         v_loesung->>'entscheidung', v_loesung->>'strafe', v_loesung->>'ort_und_fuer_wen'
       ))) < 2 then
      raise exception 'Bei der Entscheidungsfrage fehlt die vorgesehene Entscheidung.';
    end if;
  end if;
end;
$$;

revoke execute on function public.fragenvorschlag_inhalt_pruefen(jsonb)
  from public, anon, authenticated;

