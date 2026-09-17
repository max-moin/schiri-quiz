-- ============================================================
--  v146 - Das Dashboard fuer das Vorstandsmitglied
-- ------------------------------------------------------------
--  Eingespielt am 17.09.2026 unter dem Namen v142 (siehe den
--  Hinweis in v145): die Nummer war hier bereits vergeben.
-- ============================================================
--  v141 hat die Entscheidung moeglich gemacht. Sie war damit aber
--  kontextlos: eine Zeile, ein Preis, zwei Knoepfe. Wer ueber
--  Vereinsgeld entscheidet, will wissen, was diese Person schon
--  bekommen hat, was ihr abgelehnt wurde und warum, und wie viel
--  in dieser Saison insgesamt zusammengekommen ist.
--
--  Alles in EINER Funktion und als jsonb, nicht als sechs
--  Tabellenfunktionen. Der Grund ist nicht Bequemlichkeit: die
--  Seite zeigt EINEN Stand, und sechs getrennte Aufrufe koennen
--  einen Stand zeigen, den es nie gab - die Summe oben passt dann
--  nicht zur Liste darunter, und niemand findet den Fehler.
--
--  Saison = 1. Juli bis 30. Juni, wie im Spielbetrieb. Anfragen
--  aelterer Saisons bleiben in der Personenhistorie sichtbar,
--  zaehlen aber nicht in die Saisonsummen ("in_saison").
-- ============================================================
create or replace function public.freigabe_dashboard(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_verein  uuid;
  v_name    text;
  v_start   date;
  v_ende    date;
  v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  update public.freigabe_links l set zuletzt_genutzt_am = now()
   where l.token_abdruck = encode(extensions.digest(p_token, 'sha256'), 'hex');

  select v.name into v_name from public.vereine v where v.id = v_verein;

  v_start := make_date(
    case when extract(month from current_date) >= 7
         then extract(year from current_date)::int
         else extract(year from current_date)::int - 1 end, 7, 1);
  v_ende := (v_start + interval '1 year' - interval '1 day')::date;

  with anfragen as (
    select a.id, a.schiedsrichter_id, s.name as person, a.kategorie,
           coalesce(pr.bezeichnung, a.kategorie) as bezeichnung,
           a.farbe, a.groesse, a.aermellaenge, a.anmerkung, a.erstellt_am,
           a.freigabe_status, a.freigabe_name, a.freigabe_notiz, a.freigabe_am,
           a.status, a.beschaffungsweg, a.erstattet,
           coalesce(a.preis_final_cent, a.preis_schiri_cent, a.preis_richtwert_cent) as preis_cent,
           case when a.preis_final_cent  is not null then 'obmann'
                when a.preis_schiri_cent is not null then 'schiri'
                when a.preis_richtwert_cent is not null then 'richtwert'
                else 'unbekannt' end as preis_quelle,
           (a.erstellt_am::date between v_start and v_ende) as in_saison
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein and a.typ = 'ausruestung'
  ),
  zeilen as (
    select id, schiedsrichter_id, person, bezeichnung, kategorie, farbe, groesse,
           aermellaenge, anmerkung, preis_cent, preis_quelle, erstellt_am,
           freigabe_status, freigabe_name, freigabe_notiz, freigabe_am,
           status, beschaffungsweg, erstattet, in_saison
      from anfragen
  ),
  je_person as (
    select z.schiedsrichter_id, z.person,
           count(*) filter (where z.in_saison) as angefragt,
           count(*) filter (where z.freigabe_status = 'freigegeben' and z.in_saison) as freigegeben,
           count(*) filter (where z.freigabe_status = 'abgelehnt' and z.in_saison) as abgelehnt,
           count(*) filter (where z.freigabe_status = 'vorgelegt') as offen,
           coalesce(sum(z.preis_cent) filter (where z.freigabe_status = 'freigegeben' and z.in_saison), 0) as freigegeben_cent,
           jsonb_agg(to_jsonb(z) order by z.erstellt_am desc) as anfragen
      from zeilen z group by z.schiedsrichter_id, z.person
  ),
  bestand as (
    select b.schiedsrichter_id,
           jsonb_agg(jsonb_build_object(
             'kategorie', b.kategorie, 'bezeichnung', b.bezeichnung,
             'farbe', b.farbe, 'groesse', b.groesse, 'anzahl', b.anzahl,
             'zustand', b.zustand) order by b.kategorie) as stuecke
      from public.ausruestungsbestand b
      join public.schiedsrichter s on s.id = b.schiedsrichter_id
     where s.verein_id = v_verein
     group by b.schiedsrichter_id
  )
  select jsonb_build_object(
    'verein', v_name,
    'saison', jsonb_build_object(
      'bezeichnung', to_char(v_start, 'YYYY') || '/' || to_char(v_start + interval '1 year', 'YY'),
      'von', v_start, 'bis', v_ende),
    'kennzahlen', (select jsonb_build_object(
        'offen_anzahl',        count(*) filter (where freigabe_status = 'vorgelegt'),
        'offen_cent',          coalesce(sum(preis_cent) filter (where freigabe_status = 'vorgelegt'), 0),
        'offen_ohne_preis',    count(*) filter (where freigabe_status = 'vorgelegt' and preis_cent is null),
        'freigegeben_anzahl',  count(*) filter (where freigabe_status = 'freigegeben' and in_saison),
        'freigegeben_cent',    coalesce(sum(preis_cent) filter (where freigabe_status = 'freigegeben' and in_saison), 0),
        'abgelehnt_anzahl',    count(*) filter (where freigabe_status = 'abgelehnt' and in_saison)
      ) from zeilen),
    'offen', coalesce((select jsonb_agg(to_jsonb(z) order by z.erstellt_am)
                         from zeilen z where z.freigabe_status = 'vorgelegt'), '[]'::jsonb),
    'schiedsrichter', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.schiedsrichter_id, 'name', p.person,
        'angefragt', p.angefragt, 'freigegeben', p.freigegeben,
        'abgelehnt', p.abgelehnt, 'offen', p.offen,
        'freigegeben_cent', p.freigegeben_cent,
        'bestand', coalesce(b.stuecke, '[]'::jsonb),
        'anfragen', p.anfragen) order by p.person)
      from je_person p left join bestand b on b.schiedsrichter_id = p.schiedsrichter_id), '[]'::jsonb),
    'verlauf', coalesce((select jsonb_agg(to_jsonb(z) order by z.freigabe_am desc)
                           from zeilen z
                          where z.freigabe_status in ('freigegeben','abgelehnt')
                            and z.freigabe_am is not null), '[]'::jsonb)
  ) into v_ergebnis;

  return v_ergebnis;
end;
$$;

revoke all on function public.freigabe_dashboard(text) from public;
grant execute on function public.freigabe_dashboard(text) to anon;
