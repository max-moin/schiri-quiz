-- v85_termin_freigabe_im_dashboard (23.08.2026)
--
-- v82 hat die Spalte "oeffentlich" angelegt, v84 die Lesefunktion fuer
-- die Vereinsseite. Was fehlte: ein Weg, den Schalter ueberhaupt
-- umzulegen. Ohne diese Migration steht jeder Termin auf false und der
-- Terminabschnitt der Startseite bleibt fuer immer leer.
--
-- Alle drei Funktionen werden geloescht und neu angelegt statt ersetzt:
-- bei "liste" aendert sich der Rueckgabetyp, bei den beiden anderen die
-- Signatur. Ein "create or replace" wuerde dort eine zweite Fassung
-- daneben stellen, und PostgREST haette bei jedem Aufruf die Wahl - der
-- Fehler, den dieses Projekt schon mehrfach hatte (v15b, v51b, v59d).
--
-- "p_oeffentlich boolean default false" ist bewusst mit Vorgabewert:
-- Damit funktioniert die App auch dann noch, wenn sie den neuen
-- Parameter noch nicht mitschickt - und ein Termin, bei dem niemand
-- etwas entschieden hat, bleibt intern. Nachgeprueft: Der alte
-- Vier-Argument-Aufruf loest weiterhin auf.

drop function if exists public.obmann_termine_liste(text);

create function public.obmann_termine_liste(p_passwort text)
returns table (id uuid, titel text, datum date, beschreibung text, oeffentlich boolean)
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  return query
  select t.id, t.titel, t.datum, t.beschreibung, t.oeffentlich
  from termine t
  where t.verein_id = v_verein
  order by t.datum asc;
end;
$function$;

drop function if exists public.obmann_termin_hinzufuegen(text, text, date, text);

create function public.obmann_termin_hinzufuegen(
  p_passwort text,
  p_titel text,
  p_datum date,
  p_beschreibung text default null,
  p_oeffentlich boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_neue_id uuid;
begin
  v_verein := obmann_verein(p_passwort);

  insert into termine (verein_id, titel, datum, beschreibung, oeffentlich)
  values (v_verein, p_titel, p_datum, p_beschreibung, coalesce(p_oeffentlich, false))
  returning id into v_neue_id;

  return v_neue_id;
end;
$function$;

drop function if exists public.obmann_termin_bearbeiten(text, uuid, text, date, text);

create function public.obmann_termin_bearbeiten(
  p_passwort text,
  p_termin_id uuid,
  p_titel text,
  p_datum date,
  p_beschreibung text default null,
  p_oeffentlich boolean default null
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  update termine set
    titel = p_titel,
    datum = p_datum,
    beschreibung = p_beschreibung,
    -- null heisst "nicht mitgeschickt, also so lassen wie es war".
    -- Eine aeltere App-Fassung darf die Freigabe nicht versehentlich
    -- zuruecknehmen, nur weil sie das Feld nicht kennt.
    oeffentlich = coalesce(p_oeffentlich, oeffentlich)
  where id = p_termin_id and verein_id = v_verein;

  if not found then
    raise exception 'Termin nicht gefunden';
  end if;
end;
$function$;

-- Rechte: Seit v82_standardrechte bekommen NEUE Funktionen nichts mehr
-- geschenkt. Diese drei laufen aus der Obmann-App heraus mit dem
-- anon-Schluessel und pruefen intern das Passwort ueber obmann_verein().
--
-- Randnotiz vom 23.08.2026: Fast alle aelteren obmann_*-Funktionen
-- haben weiterhin ein EXECUTE fuer PUBLIC, weil v82 nur die Vorgabe
-- fuer kuenftige Funktionen geaendert hat. Ausnutzbar ist das ohne das
-- Obmann-Passwort nicht, aber die Angriffsflaeche ist groesser als
-- gedacht. Steht im Backlog, gehoert in eine eigene Migration.
revoke all on function public.obmann_termine_liste(text) from public;
revoke all on function public.obmann_termin_hinzufuegen(text, text, date, text, boolean) from public;
revoke all on function public.obmann_termin_bearbeiten(text, uuid, text, date, text, boolean) from public;

grant execute on function public.obmann_termine_liste(text) to anon, authenticated;
grant execute on function public.obmann_termin_hinzufuegen(text, text, date, text, boolean) to anon, authenticated;
grant execute on function public.obmann_termin_bearbeiten(text, uuid, text, date, text, boolean) to anon, authenticated;
