-- ============================================================
--  v148 - Die App sieht Preis und Freigabe
-- ============================================================
--  Bis hierher kannte die SwiftUI-App die Felder aus v145 gar
--  nicht - im Anfragen-Reiter hatte sich deshalb sichtbar nichts
--  geaendert, obwohl der ganze Freigabeweg dahinter schon stand.
--
--  Neue Spalten ans ENDE, damit bestehende Decodable-Typen weiter
--  funktionieren: Swift ignoriert unbekannte Schluessel, aber eine
--  umsortierte Spaltenliste waere fuer Code, der sich auf die
--  Reihenfolge verlaesst, eine stille Aenderung.
--
--  drop+create statt create or replace: bei geaenderter
--  RETURNS-TABLE-Signatur laesst Postgres das Ersetzen nicht zu.
--
--  Rechte an BEIDE Rollen - siehe den Merksatz in v147.
-- ============================================================
drop function if exists public.obmann_anfragen_liste(text);

create function public.obmann_anfragen_liste(p_passwort text)
returns table(id uuid, schiedsrichter_id uuid, schiri_name text, typ text,
              kategorie text, farbe text, groesse text, aermellaenge text,
              anmerkung text, status text, beschaffungsweg text, notiz_obmann text,
              erstellt_am timestamptz, rechnung_bild_base64 text, rechnung_mime text,
              rechnung_hochgeladen_am timestamptz, abholung_bestaetigt boolean,
              keine_zahlung_faellig boolean, erstattet boolean, obmann_gesehen boolean,
              selbstkauf_bestaetigt boolean, selbstkauf_bestaetigt_am timestamptz,
              -- ab hier neu (v148)
              preis_richtwert_cent integer, preis_schiri_cent integer,
              preis_final_cent integer, preis_cent integer, preis_quelle text,
              freigabe_status text, freigabe_name text, freigabe_notiz text,
              freigabe_am timestamptz, entschieden_am timestamptz, abgeholt_am timestamptz)
language plpgsql security definer set search_path to '' as $$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  return query
  select a.id, a.schiedsrichter_id, s.name, a.typ, a.kategorie, a.farbe,
         a.groesse, a.aermellaenge, a.anmerkung, a.status,
         a.beschaffungsweg, a.notiz_obmann, a.erstellt_am,
         a.rechnung_bild_base64, a.rechnung_mime, a.rechnung_hochgeladen_am,
         a.abholung_bestaetigt, a.keine_zahlung_faellig, a.erstattet,
         a.obmann_gesehen, a.selbstkauf_bestaetigt, a.selbstkauf_bestaetigt_am,
         a.preis_richtwert_cent, a.preis_schiri_cent, a.preis_final_cent,
         coalesce(a.preis_final_cent, a.preis_schiri_cent, a.preis_richtwert_cent),
         case when a.preis_final_cent  is not null then 'obmann'
              when a.preis_schiri_cent is not null then 'schiri'
              when a.preis_richtwert_cent is not null then 'richtwert'
              else 'unbekannt' end,
         a.freigabe_status, a.freigabe_name, a.freigabe_notiz, a.freigabe_am,
         a.entschieden_am, a.abgeholt_am
  from public.ausruestungs_anfragen a
  join public.schiedsrichter s
    on s.id = a.schiedsrichter_id and s.verein_id = v_verein
  order by a.erstellt_am desc;
end;
$$;

revoke all on function public.obmann_anfragen_liste(text) from public;
grant execute on function public.obmann_anfragen_liste(text) to anon;
grant execute on function public.obmann_anfragen_liste(text) to authenticated;
