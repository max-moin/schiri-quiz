-- Hotfix: Noch unbeantwortete Fragen duerfen in den strukturierten
-- Antwortoptionen kein JSON-null fuer `ist_gewaehlt` liefern. Swift
-- erwartet hier einen Boolean und verwirft sonst die komplette RPC-Antwort.
--
-- Die beiden Funktionskoerper stammen aus der unmittelbar vorherigen
-- Migration. Der gezielte Austausch erhaelt Signatur, Rechte und die
-- Passwort-/Vereinspruefung unveraendert.

do $migration$
declare
  v_oid oid;
  v_vorher text;
  v_nachher text;
  v_alt constant text := $alt$
        'ist_gewaehlt', case
          when f.antworttyp = 'mehrfachauswahl'
            then q.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
          else q.schluessel = a.gegebene_option
        end)
$alt$;
  v_neu constant text := $neu$
        'ist_gewaehlt', coalesce(case
          when f.antworttyp = 'mehrfachauswahl'
            then q.schluessel = any(coalesce(a.gegebene_auswahl, array[]::text[]))
          else q.schluessel = a.gegebene_option
        end, false))
$neu$;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('obmann_person_verlauf', 'obmann_wochenauswertung')
  loop
    v_vorher := pg_get_functiondef(v_oid);
    v_nachher := replace(v_vorher, v_alt, v_neu);

    if v_nachher = v_vorher then
      raise exception 'Erwartete ist_gewaehlt-Stelle in Funktion % nicht gefunden',
        v_oid::regprocedure;
    end if;

    execute v_nachher;
  end loop;
end;
$migration$;
