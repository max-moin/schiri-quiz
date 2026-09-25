-- ============================================================
--  Duell-Detail in der Obmann-App: alle Antworttypen lesbar (26.09.2026)
-- ============================================================
--  Backlog P3 "Duell-App-Darstellung nachziehen: Freitext im App-
--  Duellverlauf korrekt darstellen; bei Multiple Choice die gewaehlte und
--  die richtige Option klar markieren."
--
--  Was obmann_duell_details bisher auslieferte und was fehlte:
--  * Alte A-C-Fragen kamen OHNE "ist_richtig" - die App konnte dort keine
--    Loesung markieren (und tat es bewusst nicht). Jetzt aus richtige_option.
--  * Zahl- und Icon-Antworten liegen in duell_antworten.gegebene_details
--    (jsonb) und kamen gar nicht mit - die App zeigte "keine Antwort
--    abgegeben", obwohl geantwortet wurde. Jetzt als fertiger Text
--    ("antwort_text") plus die Loesung je Frage ("loesung_text").
--  * Bei Freitext fehlten Rueckmeldung und Rueckfrage der KI. Ohne die
--    ist ein orange "nachbessern" nicht nachvollziehbar.
--
--  Signatur und Rueckgabetyp (jsonb) bleiben gleich; die App ignoriert
--  Felder, die sie nicht kennt. Nur fuer den Obmann (Passwort + Verein).
-- ============================================================

create or replace function public.obmann_duell_details(p_passwort text, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_s public.duell_sessions%rowtype;
  v_fragen jsonb := '[]'::jsonb;
  v_frage record;
  v_opts jsonb;
  v_teilnehmer jsonb;
  v_loesung text;
begin
  v_verein := obmann_verein(p_passwort);

  select * into v_s from duell_sessions d
   where d.id = p_session_id and d.verein_id = v_verein;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;

  for v_frage in
    select df.position, f.id as frage_id, f.frage_text, f.medium, f.antworttyp,
           f.musterantwort, f.option_a, f.option_b, f.option_c, f.richtige_option
      from duell_fragen df join fragen f on f.id = df.frage_id
     where df.session_id = v_s.id
     order by df.position
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'schluessel', o.schluessel, 'text', o.text, 'ist_richtig', o.ist_richtig)
             order by o.position),
           -- Altbestand A-C: Loesung aus richtige_option, leere Optionen raus.
           (select coalesce(jsonb_agg(jsonb_build_object(
                     'schluessel', alt.schluessel, 'text', alt.text,
                     'ist_richtig', alt.schluessel = v_frage.richtige_option)
                     order by alt.schluessel), '[]'::jsonb)
              from (values ('a', v_frage.option_a), ('b', v_frage.option_b), ('c', v_frage.option_c))
                   as alt(schluessel, text)
             where nullif(btrim(alt.text), '') is not null))
      into v_opts
      from frage_antwortoptionen o where o.frage_id = v_frage.frage_id;

    v_loesung := case
      when v_frage.antworttyp = 'zahl' then public.zahl_loesung_text(v_frage.frage_id)
      when v_frage.antworttyp = 'entscheidung' then (
        select public.entscheidung_anzeige(a.gegebene_details->'loesung')
          from duell_antworten a join duell_teilnehmer t on t.id = a.teilnehmer_id
         where t.session_id = v_s.id and a.frage_id = v_frage.frage_id
           and a.gegebene_details ? 'loesung'
         limit 1)
      else null end;

    select jsonb_agg(jsonb_build_object(
             'name', t.anzeigename,
             'beantwortet', (a.teilnehmer_id is not null),
             'korrekt', a.korrekt,
             'status', a.bewertungsstatus,
             'auswahl', a.gegebene_auswahl,
             'freitext', a.gegebener_freitext,
             'zweiter_freitext', a.zweiter_freitext,
             'antwort_text', case a.gegebene_details->>'art'
                when 'zahl' then public.zahl_antwort_text((a.gegebene_details->>'wert')::numeric, a.gegebene_details->>'einheit')
                when 'entscheidung' then public.entscheidung_anzeige(a.gegebene_details->'antwort')
                else null end,
             'feedback', a.feedback,
             'ki_nachfrage', a.ki_nachfrage,
             'feedback_final', a.feedback_final,
             'beantwortet_am', a.beantwortet_am)
             order by t.beigetreten_am)
      into v_teilnehmer
      from duell_teilnehmer t
      left join duell_antworten a
        on a.teilnehmer_id = t.id and a.frage_id = v_frage.frage_id
     where t.session_id = v_s.id;

    v_fragen := v_fragen || jsonb_build_array(jsonb_build_object(
      'position', v_frage.position,
      'frage_id', v_frage.frage_id,
      'frage_text', v_frage.frage_text,
      'medium', v_frage.medium,
      'antworttyp', v_frage.antworttyp,
      'musterantwort', v_frage.musterantwort,
      'loesung_text', v_loesung,
      'antwortoptionen', v_opts,
      'teilnehmer', v_teilnehmer));
  end loop;

  return jsonb_build_object(
    'id', v_s.id,
    'code', v_s.code,
    'status', v_s.status,
    'erstellt_am', v_s.erstellt_am,
    'geschlossen_am', v_s.geschlossen_am,
    'ersteller', (select s.name from schiedsrichter s where s.id = v_s.erstellt_von),
    'teilnehmer', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.anzeigename,
        'ist_mitglied', (t.schiedsrichter_id is not null),
        'beigetreten_am', t.beigetreten_am,
        'beantwortet', coalesce(x.beantwortet, 0),
        'richtig', coalesce(x.richtig, 0))
        order by coalesce(x.richtig,0) desc, coalesce(x.beantwortet,0) desc, t.beigetreten_am)
      from duell_teilnehmer t
      left join lateral (
        select count(*)::int as beantwortet,
               count(*) filter (where korrekt)::int as richtig
          from duell_antworten where teilnehmer_id = t.id) x on true
      where t.session_id = v_s.id), '[]'::jsonb),
    'fragen', v_fragen);
end;
$function$;
