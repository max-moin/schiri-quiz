-- v84_oeffentlicher_seitenschluessel (22.08.2026)
--
-- Korrektur an v83. Dort nahm oeffentliche_termine() die VEREINSKENNUNG
-- als Nachschlage-Schluessel. Damit haette die Kennung im Quelltext der
-- oeffentlichen Startseite gestanden - und die Kennung ist im Quiz ein
-- Geheimnis: app.js verdeckt das Eingabefeld absichtlich, und
-- schiri_liste(p_kennung) gibt allein mit der Kennung, ohne PIN, die
-- Namen aller Schiedsrichter des Vereins heraus. Bei einem
-- Einstiegsalter von 12 Jahren sind darunter Minderjaehrige.
--
-- Deshalb bekommt jeder Verein einen zweiten, ausdruecklich
-- oeffentlichen Schluessel. Er oeffnet nichts ausser den freigegebenen
-- Terminen und darf im Klartext auf der Seite stehen.
--
-- Hinweis zur Nummerierung: In diesem Projekt gibt es seit dem
-- 12.08.2026 mehrere v-Nummern doppelt (v76 bis v82). Verbindlich ist
-- allein der Zeitstempel im Dateinamen.

alter table public.vereine
  add column if not exists oeffentliche_kennung text;

comment on column public.vereine.oeffentliche_kennung is
  'Nicht geheimer Schluessel fuer die oeffentliche Vereinsseite. '
  'NIEMALS mit vereine.kennung gleichsetzen - die ist ein Zugangsgeheimnis.';

-- Teil-Index: null bleibt beliebig oft erlaubt, ein gesetzter Schluessel
-- muss eindeutig sein.
create unique index if not exists vereine_oeffentliche_kennung_unique
  on public.vereine (oeffentliche_kennung)
  where oeffentliche_kennung is not null;

update public.vereine
   set oeffentliche_kennung = 'loebtauer-kickers'
 where kennung = '456789'
   and oeffentliche_kennung is null;

-- Der Parametername aendert sich, deshalb loeschen statt ersetzen.
drop function if exists public.oeffentliche_termine(text);

create function public.oeffentliche_termine(p_seitenschluessel text)
returns table (titel text, datum date, beschreibung text)
language sql
stable
security definer
set search_path to public
as $$
  select t.titel, t.datum, t.beschreibung
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.oeffentlich
    -- Ortszeit statt UTC: current_date waere zwischen 00:00 und 02:00
    -- deutscher Zeit noch der Vortag, ein gestriger Termin bliebe stehen.
    and t.datum >= (now() at time zone 'Europe/Berlin')::date
  order by t.datum
  limit 6;
$$;

revoke all on function public.oeffentliche_termine(text) from public;
grant execute on function public.oeffentliche_termine(text) to anon, authenticated;

comment on function public.oeffentliche_termine(text) is
  'Liest die naechsten sechs freigegebenen Termine eines Vereins fuer die '
  'oeffentliche Vereinsseite. Nimmt den oeffentlichen Seitenschluessel, '
  'nicht die Vereinskennung.';
