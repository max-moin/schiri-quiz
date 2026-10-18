-- Applied as 20261018222050. A repeated phase gets its own cycle.
do $migration$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='ausruestung_uebergang';
 if position('v_status text;' in d)=0 or position('perform public.ausruestung_ereignis_schreiben(' in d)=0
  or position('where anfrage_id=p_anfrage and schritt=p_nach and runde=a.prozess_runde' in d)=0 then
  raise exception 'Unexpected transition definition for provenance repair';end if;
 d:=replace(d,'v_status text;',E'v_status text;\n  v_ereignis uuid;');
 d:=replace(d,'perform public.ausruestung_ereignis_schreiben(', 'v_ereignis := public.ausruestung_ereignis_schreiben(');
 d:=replace(d,'where anfrage_id=p_anfrage and schritt=p_nach and runde=a.prozess_runde', 'where id=v_ereignis');
 d:=replace(d,'t.prozess_status in (''freigegeben'',''abgelehnt'')','t.prozess_status in (''vorgelegt'',''freigegeben'',''abgelehnt'')');
 execute d;
end $migration$;
