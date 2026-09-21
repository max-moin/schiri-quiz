-- =====================================================================
-- Ausruestungsbestand im persoenlichen Vorstandszugang
-- ---------------------------------------------------------------------
-- Tom braucht fuer die Budgetentscheidung den vorhandenen Bestand, aber
-- keine PIN, Kontaktdaten oder Quizdaten. Diese Funktion gibt deshalb
-- ausschliesslich aktive echte Schiedsrichter desselben Vereins und ihre
-- selbst gepflegten Bestandsfelder aus. Der Vereinsbezug stammt immer
-- aus dem bei jedem Aufruf neu geprueften Freigabe-Token.
-- =====================================================================

create or replace function public.freigabe_bestand(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
  v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);

  perform 1 from public.freigabe_links l
   where l.id = v_link
     and l.zugangsart = 'dauerhaft'
     and char_length(btrim(coalesce(l.verantwortlicher_name, ''))) >= 2;
  if not found then
    raise exception 'Die Bestandsuebersicht gehoert nur zu einem persoenlichen Dauerzugang.';
  end if;

  -- Nutzung ist auch dann sichtbar, wenn gerade keine Anfrage im Stapel
  -- liegt. Das hilft beim gezielten Widerruf verwaister Dauerzugänge.
  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  with personen as (
    select s.id, s.name,
           coalesce(b.anzahl, 0) as anzahl,
           coalesce(b.bestand, '[]'::jsonb) as bestand
      from public.schiedsrichter s
      left join lateral (
        select sum(x.anzahl)::integer as anzahl,
               jsonb_agg(jsonb_build_object(
                 'id', x.id,
                 'kategorie', x.kategorie,
                 'bezeichnung', x.bezeichnung,
                 'farbe', x.farbe,
                 'groesse', x.groesse,
                 'aermellaenge', x.aermellaenge,
                 'anzahl', x.anzahl,
                 'zustand', x.zustand,
                 'anmerkung', x.anmerkung,
                 'aktualisiert_am', x.aktualisiert_am)
                 order by x.kategorie, x.bezeichnung nulls first,
                          x.aktualisiert_am desc) as bestand
          from public.ausruestungsbestand x
         where x.schiedsrichter_id = s.id
      ) b on true
     where s.verein_id = v_verein
       and coalesce(s.aktiv, true)
       and not coalesce(s.ist_test, false)
  )
  select jsonb_build_object(
           'personen', coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id,
             'name', p.name,
             'anzahl', p.anzahl,
             'bestand', p.bestand)
             order by p.name), '[]'::jsonb))
    into v_ergebnis
    from personen p;

  return v_ergebnis;
end;
$$;

revoke all on function public.freigabe_bestand(text) from public;
grant execute on function public.freigabe_bestand(text) to anon;
