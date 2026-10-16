-- Ein bestehender Entwurf muss auch nach späterer Statusänderung bearbeitbar
-- bleiben, insbesondere zum Entfernen einer freiwilligen Namenskennzeichnung.
do $migration$
declare d text;
begin
 select pg_get_functiondef('public.obmann_frage_redaktion_speichern(text,uuid,jsonb,jsonb,boolean,jsonb,text,jsonb)'::regprocedure) into d;
 if position($old$if not found or v_alt.status in ('entwurf','abgelehnt','aenderung_erbeten') then$old$ in d)=0 then raise exception 'Unerwarteter Funktionsstand'; end if;
 d:=replace(d,
  $old$if not found or v_alt.status in ('entwurf','abgelehnt','aenderung_erbeten') then$old$,
  $new$if not found or (v_alt.status in ('entwurf','abgelehnt','aenderung_erbeten') and (p_frage_id is null or v_alt.uebernommene_frage_id is distinct from p_frage_id)) then$new$);
 execute d;
end $migration$;
