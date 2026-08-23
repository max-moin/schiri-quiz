-- v83_oeffentliche_termine_funktion (22.08.2026)
--
-- Der einzige Weg, auf dem die oeffentliche Startseite an Daten kommt.
--
-- Warum eine Funktion und nicht die Tabelle direkt: auf "termine" ist RLS
-- eingeschaltet und es gibt keine einzige Policy. Die Tabelle ist von
-- aussen also vollstaendig unlesbar - und das soll so bleiben. Die
-- Funktion laeuft als "security definer" und liefert genau drei Spalten
-- von genau den Zeilen, die jemand im Dashboard freigegeben hat.
--
-- Was hier NICHT herauskommt: verein_id, id, angelegt_am, interne
-- Termine, vergangene Termine, mehr als sechs Stueck.
--
-- "set search_path to public" ist Pflicht bei security definer, sonst
-- kann ein Aufrufer mit eigenem Schema die verwendeten Tabellennamen
-- unterschieben.

create or replace function public.oeffentliche_termine(p_kennung text)
returns table (titel text, datum date, beschreibung text)
language sql
stable
security definer
set search_path to public
as $$
  select t.titel, t.datum, t.beschreibung
  from termine t
  join vereine v on v.id = t.verein_id
  where v.kennung = p_kennung
    and t.oeffentlich
    and t.datum >= current_date
  order by t.datum
  limit 6;
$$;

-- Erst alles wegnehmen, dann gezielt geben. Seit v82_standardrechte
-- (11.08.2026) bekommen neue Funktionen ohnehin keine Rechte mehr
-- geschenkt; das "revoke" steht trotzdem da, damit die Datei fuer sich
-- allein gelesen werden kann.
revoke all on function public.oeffentliche_termine(text) from public;
grant execute on function public.oeffentliche_termine(text) to anon, authenticated;

comment on function public.oeffentliche_termine(text) is
  'Liest die naechsten sechs freigegebenen Termine eines Vereins fuer die '
  'oeffentliche Vereinsseite. Einziger Datenweg der Startseite.';
