-- Ausschließlich mit BEGIN/ROLLBACK ausführen. Keine echten Vereinsinhalte.
do $$
declare u uuid:=gen_random_uuid(); k text:='guide-test-'||gen_random_uuid()::text; s jsonb; r jsonb;
begin
 insert into auth.users(id,email) values(u,'guide-'||u::text||'@example.invalid');
 insert into public.website_redakteure(user_id,seitenschluessel) values(u,k);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal2','role','authenticated')::text,true);
 s:='{"version":1,"vorlage":"rote-karte-v1","bloecke":[{"id":"test","typ":"absatz","layout":"normal","text":"Isolierter Editor-Test"}]}'::jsonb;
 r:=public.website_blockseite_speichern(k,'rote-karte',s,0,false);
 if r->>'revision'<>'1' or r->'veroeffentlicht'<>'null'::jsonb then raise exception 'Entwurf wurde veröffentlicht'; end if;
 begin perform public.website_blockseite_speichern(k,'rote-karte',s,0,true); raise exception 'Konflikt fehlt';
 exception when serialization_failure then null; end;
 r:=public.website_blockseite_speichern(k,'rote-karte',s,1,true);
 if r->'veroeffentlicht' is distinct from s then raise exception 'Publikation fehlt'; end if;
 r:=public.website_blockseite_speichern(k,'rote-karte',s,2,true);
 if jsonb_array_length(r->'versionen')<>1 then raise exception 'Historie fehlt'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal1','role','authenticated')::text,true);
 begin perform public.website_blockseite_redaktion(k,'rote-karte'); raise exception 'AAL1 zugelassen'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'aal','aal2','role','authenticated')::text,true);
 begin perform public.website_blockseite_redaktion(k,'rote-karte'); raise exception 'Fremdzugriff zugelassen'; exception when insufficient_privilege then null; end;
 if has_column_privilege('anon','public.website_blockseiten','entwurf','select')
 or has_column_privilege('authenticated','public.website_blockseiten','entwurf','select')
 or has_function_privilege('anon','public.website_blockseite_speichern(text,text,jsonb,bigint,boolean)','execute')
 then raise exception 'Private Redaktion öffentlich'; end if;
end $$;
