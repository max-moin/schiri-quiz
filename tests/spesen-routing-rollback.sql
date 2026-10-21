begin;
do $$
declare c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); i integer;
begin
 insert into public.vereine(id,name) values(c,'Routing-Rollback');
 insert into public.schiedsrichter(id,name,verein_id,pin,ist_test) values(s,'Routing-Rollback',c,'942781',true);
 if has_function_privilege('anon','public.spesen_routing_erlauben(uuid,text,integer)','execute') then raise exception 'TEST: öffentliche Quota'; end if;
 begin
  perform public.spesen_routing_erlauben(s,'falsch',1);raise exception 'TEST: falscher PIN akzeptiert';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise;end if;end;
 for i in 1..10 loop if not public.spesen_routing_erlauben(s,'942781',2) then raise exception 'TEST: Kontingent zu klein';end if;end loop;
 if public.spesen_routing_erlauben(s,'942781',1) then raise exception 'TEST: Stundenlimit umgangen';end if;
 if (select tag_einheiten from private.spesen_routing_kontingent where schluessel=s::text)<>20 then raise exception 'TEST: überbucht';end if;
 if exists(select 1 from information_schema.columns where table_schema='private' and table_name='spesen_routing_kontingent' and column_name similar to '%(adresse|start|ziel|route|koordinat)%') then raise exception 'TEST: Ortsdaten gespeichert';end if;
end $$;
rollback;
select 'Routing-Limit, PIN, Privilegien, keine Ortsdaten: bestanden' as ergebnis;
