-- Nur innerhalb BEGIN/ROLLBACK ausführen. Keine echten Nutzer, Mails oder Pushes.
do $$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); p text:='test-'||gen_random_uuid()::text;
  t text; l uuid; s jsonb; v jsonb; n integer;
begin
 insert into auth.users(id,email) values(u,'blockeditor-'||u::text||'@example.invalid');
 insert into public.website_redakteure(user_id,seitenschluessel) values(u,'test-blockeditor-rollback');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal2','role','authenticated')::text,true);
 s:='{"version":1,"bloecke":[{"id":"test","typ":"absatz","layout":"normal","text":"Privater Testentwurf"}]}'::jsonb;
 v:=public.website_blockseite_speichern('test-blockeditor-rollback','dfbnet',s,0,false);
 if v->>'revision'<>'1' or v->'veroeffentlicht'<>'null'::jsonb then raise exception 'Entwurf wurde veröffentlicht'; end if;
 begin
   perform public.website_blockseite_speichern('test-blockeditor-rollback','dfbnet',s,0,true);
   raise exception 'Konfliktprüfung fehlt';
 exception when serialization_failure then null; end;
 v:=public.website_blockseite_speichern('test-blockeditor-rollback','dfbnet',s,1,true);
 if v->'veroeffentlicht' is distinct from s then raise exception 'Veröffentlichen fehlgeschlagen'; end if;
 v:=public.website_blockseite_speichern('test-blockeditor-rollback','dfbnet',s,2,true);
 if jsonb_array_length(v->'versionen')<>1 then raise exception 'Versionierung fehlt'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal1','role','authenticated')::text,true);
 begin perform public.website_blockseite_redaktion('test-blockeditor-rollback','dfbnet'); raise exception 'AAL1 erlaubt'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'aal','aal2','role','authenticated')::text,true);
 begin perform public.website_blockseite_redaktion('test-blockeditor-rollback','dfbnet'); raise exception 'Fremdverein erlaubt'; exception when insufficient_privilege then null; end;
 if has_column_privilege('anon','public.website_blockseiten','entwurf','SELECT')
 or has_column_privilege('authenticated','public.website_blockseiten','entwurf','SELECT') then raise exception 'Entwurfsspalte öffentlich'; end if;
 if has_function_privilege('anon','public.website_blockseite_speichern(text,text,jsonb,bigint,boolean)','execute') then raise exception 'Anonymes Speichern möglich'; end if;
 if has_table_privilege('anon','private.freigabe_link_geheimnisse','select')
 or has_table_privilege('authenticated','private.freigabe_link_geheimnisse','select') then raise exception 'Tokenzuordnung öffentlich'; end if;
 if private.block_url_ok('javascript:alert(1)') or private.block_url_ok('//fremd.example')
 or private.block_url_ok('https://name:pass@example.org') or private.block_url_ok('https://a'||chr(10)||'.example') then raise exception 'Unsichere URL zugelassen'; end if;
 begin perform private.blockinhalt_pruefen('{"version":1,"bloecke":[]}'::jsonb); raise exception 'Leere Seite akzeptiert'; exception when raise_exception then if SQLERRM='Leere Seite akzeptiert' then raise; end if; end;

 insert into public.vereine(id,name) values(c,'Isolierter Link-Test');
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,p,c);
 t:=public.obmann_freigabe_link_erstellen(p,1,'Test');
 select id into l from public.freigabe_links where verein_id=c;
 if public.obmann_freigabe_link_abrufen(p,l) is distinct from t then raise exception 'Link konnte nicht erneut geöffnet werden'; end if;
 update public.freigabe_links set gueltig_bis=now()-interval '1 second' where id=l;
 begin perform public.obmann_freigabe_link_abrufen(p,l); raise exception 'Abgelaufener Link abrufbar'; exception when raise_exception then if SQLERRM='Abgelaufener Link abrufbar' then raise; end if; end;
 update public.freigabe_links set gueltig_bis=now()+interval '1 day' where id=l;
 insert into public.vereine(name) values('Zweiter isolierter Link-Test') returning id into c;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n-1,p||'-fremd',c);
 begin perform public.obmann_freigabe_link_abrufen(p||'-fremd',l); raise exception 'Fremder Verein kann Link öffnen'; exception when raise_exception then if SQLERRM='Fremder Verein kann Link öffnen' then raise; end if; end;
 if exists(select 1 from vault.secrets vs join private.freigabe_link_geheimnisse g on g.geheimnis_id=vs.id where g.link_id=l and vs.secret=t) then raise exception 'Token liegt unverschlüsselt vor'; end if;
 begin perform public.obmann_freigabe_link_abrufen('kein-passwort',l); raise exception 'Falsches Passwort akzeptiert'; exception when raise_exception then if SQLERRM='Falsches Passwort akzeptiert' then raise; end if; end;
 update public.freigabe_links set widerrufen_am=now() where id=l;
 begin perform public.obmann_freigabe_link_abrufen(p,l); raise exception 'Widerrufener Link abrufbar'; exception when raise_exception then if SQLERRM='Widerrufener Link abrufbar' then raise; end if; end;
 t:=public.obmann_verantwortlichen_zugang_erstellen(p,'Testperson','Vorstand');
 select id into l from public.freigabe_links where verein_id=public.obmann_verein(p) and zugangsart='dauerhaft';
 if public.obmann_freigabe_link_abrufen(p,l) is distinct from t then raise exception 'Dauerlink nicht erneut abrufbar'; end if;
 insert into public.freigabe_links(verein_id,token_abdruck,beschriftung,gueltig_bis)
 values(public.obmann_verein(p),encode(extensions.digest('isolierter-alttoken','sha256'),'hex'),'Alter Hashlink',now()+interval '1 day') returning id into l;
 begin perform public.obmann_freigabe_link_abrufen(p,l); raise exception 'Alttoken erfunden'; exception when raise_exception then if SQLERRM='Alttoken erfunden' then raise; end if; end;
end $$;
select 'Blockeditor- und Link-Rollbacktests erfolgreich' as ergebnis;
