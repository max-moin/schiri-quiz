begin;
do $test$
declare t uuid; v uuid; fremd uuid; eigen uuid; gast uuid; n integer; gesperrt boolean:=false;
begin
  select id,verein_id into t,v from public.termine where protokoll_pdf_pfad is not null limit 1;
  if t is null then raise exception 'Für die Regression fehlt ein PDF-Termin'; end if;
  select id into fremd from public.vereine where id<>v limit 1;
  if fremd is null then raise exception 'Für die Vereinsgrenze fehlt ein zweiter Verein'; end if;
  insert into public.schiedsrichter(name,pin,ist_test,verein_id) values('PDF Rollback eigen','9327',true,v) returning id into eigen;
  insert into public.schiedsrichter(name,pin,ist_test,verein_id) values('PDF Rollback fremd','9327',true,fremd) returning id into gast;
  update public.termine set protokoll_freigegeben=true where id=t;
  select count(*) into n from public.termin_protokoll_pdf_fuer_schiri(eigen,'9327',t);
  if n<>1 then raise exception 'Eigener Verein kann freigegebenes PDF nicht lesen'; end if;
  select count(*) into n from public.termin_protokoll_pdf_fuer_schiri(gast,'9327',t);
  if n<>0 then raise exception 'Fremder Verein erhält PDF'; end if;
  begin perform public.termin_protokoll_pdf_fuer_schiri(eigen,'falsch',t);
  exception when others then gesperrt:=true; end;
  if not gesperrt then raise exception 'Falsche PIN wurde akzeptiert'; end if;
  update public.termine set protokoll_freigegeben=false where id=t;
  select count(*) into n from public.termin_protokoll_pdf_fuer_schiri(eigen,'9327',t);
  if n<>0 then raise exception 'Unveröffentlichtes Protokoll ist lesbar'; end if;
  if (select public from storage.buckets where id='sr-protokolle')
    or has_function_privilege('anon','public.termin_protokoll_pdf_fuer_schiri(uuid,text,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.termin_protokoll_pdf_fuer_schiri(uuid,text,uuid)','EXECUTE') then
    raise exception 'PDF-Speicher oder serverinterner Linkweg ist öffentlich';
  end if;
end $test$;
rollback;
