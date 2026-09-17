-- =====================================================================
-- v153 - Die Prozessliste fuer den Schiedsrichter
-- =====================================================================
--
-- Nachtrag zu v150. Dort gibt es "obmann_prozess_liste" fuer die
-- Obmann-App und "schiri_anfrage_prozess" fuer einen einzelnen Vorgang.
-- Beide Seiten des Schiedsrichters - die Ausruestungsseite und "Meine
-- Anliegen" - zeigen aber eine LISTE. Ohne diese Funktion muessten sie
-- je Zeile einen eigenen Aufruf machen.
--
-- Wichtig ist nicht die Ersparnis, sondern die Quelle: beide Seiten
-- zeichnen damit dieselbe serverseitige Schrittliste wie die Obmann-App
-- und die Vorstandsseite. Vorher hat jede Seite ihre eigene Kette aus
-- Status und Booleans gebaut - und genau deshalb stand auf der
-- Ausruestungsseite etwas anderes als unter "Meine Anliegen".
--
-- Sicht 'schiri': eigene Vorgaenge vollstaendig, aber ohne die internen
-- Notizen des Obmanns. Eine Ablehnungsbegruendung ist ausdruecklich
-- keine interne Notiz - die gehoert dem Schiedsrichter.
-- =====================================================================

create or replace function public.schiri_prozess_liste(
  p_schiedsrichter_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_liste jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  select coalesce(jsonb_agg(x.p order by x.erstellt_am desc), '[]'::jsonb)
    into v_liste
    from (
      select public.ausruestung_prozess_jsonb(a.id, 'schiri') as p,
             a.erstellt_am
        from public.ausruestungs_anfragen a
       where a.schiedsrichter_id = p_schiedsrichter_id
         and a.typ = 'ausruestung'
    ) x;

  return v_liste;
end;
$$;

revoke all on function public.schiri_prozess_liste(uuid, text) from public;
grant execute on function public.schiri_prozess_liste(uuid, text) to anon;
