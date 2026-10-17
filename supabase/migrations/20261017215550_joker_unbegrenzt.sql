-- Bestehende Joker bleiben erhalten. gueltig_bis bleibt nur als altes
-- Kompatibilitätsfeld stehen, entscheidet aber nicht mehr über die Einlösung.
-- Keine neuen Geschenke nachtragen und verbrauchte Joker nicht reaktivieren.
do $$
declare a text; b text;
begin
 a:=pg_get_functiondef('public.meine_wochenserie_mit_joker(uuid,text)'::regprocedure);
 b:=replace(a,'and j.runde_id is null and j.gueltig_bis>v_heute;', 'and j.runde_id is null;');
 if b=a then raise exception 'Unerwarteter Stand des Jokerabrufs'; end if;
 execute b;
 a:=pg_get_functiondef('public.geburtstagsjoker_einloesen(uuid,text,uuid)'::regprocedure);
 b:=replace(a,'and j.runde_id is null and j.gueltig_bis>(now() at time zone ''Europe/Berlin'')::date','and j.runde_id is null');
 b:=replace(b,'order by j.gueltig_bis limit 1 for update','order by j.erhalten_am,j.jahr limit 1 for update');
 if b=a then raise exception 'Unerwarteter Stand der Jokereinlösung'; end if;
 execute b;
end $$;
