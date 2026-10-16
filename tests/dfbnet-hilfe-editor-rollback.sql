-- Nur innerhalb BEGIN/ROLLBACK ausführen. Keine echten Vereinsinhalte.
-- Im Integrationstest wird das Standard-Payload durch die echten drei Guides ersetzt.
do $$
declare u uuid:=gen_random_uuid(); k text:='dfbnet-hilfe-test-'||gen_random_uuid()::text; p text; s jsonb; r jsonb;
 daten jsonb:='{}'::jsonb;
begin
 insert into auth.users(id,email) values(u,'hilfe-'||u::text||'@example.invalid');
 insert into public.website_redakteure(user_id,seitenschluessel) values(u,k);
 foreach p in array array['sperrtermine','schiri-beobachtung','spielersperren'] loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal2','role','authenticated')::text,true);
  s:=coalesce(daten->p,jsonb_build_object('version',1,'vorlage',p||'-v1','bloecke',jsonb_build_array(jsonb_build_object('id','test','typ','absatz','layout','normal','text','Isolierter Test'))));
  r:=public.website_blockseite_speichern(k,p,s,0,false);
  if r->>'revision'<>'1' or r->'veroeffentlicht'<>'null'::jsonb then raise exception 'Entwurf wurde veröffentlicht'; end if;
  begin perform public.website_blockseite_speichern(k,p,s,0,true); raise exception 'Konflikt fehlt'; exception when serialization_failure then null; end;
  r:=public.website_blockseite_speichern(k,p,s,1,true);
  if r->'veroeffentlicht' is distinct from s then raise exception 'Publikation fehlt'; end if;
  r:=public.website_blockseite_speichern(k,p,s,2,true);
  if jsonb_array_length(r->'versionen')<>1 then raise exception 'Historie fehlt'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal1','role','authenticated')::text,true);
  begin perform public.website_blockseite_redaktion(k,p); raise exception 'AAL1 zugelassen'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'aal','aal2','role','authenticated')::text,true);
  begin perform public.website_blockseite_redaktion(k,p); raise exception 'Fremdzugriff zugelassen'; exception when insufficient_privilege then null; end;
 end loop;
 if has_column_privilege('anon','public.website_blockseiten','entwurf','select')
 or has_column_privilege('authenticated','public.website_blockseiten','entwurf','select')
 or has_function_privilege('anon','public.website_blockseite_speichern(text,text,jsonb,bigint,boolean)','execute')
 then raise exception 'Private Redaktion öffentlich'; end if;
end $$;
