begin;
do $$
declare v uuid;s uuid;r uuid;f uuid;
begin
 insert into public.vereine(name) values('Rollback-Dauerjoker-'||gen_random_uuid()) returning id into v;
 insert into public.schiedsrichter(name,pin,verein_id,erstellt_am,ist_test) values('Rollback-Dauerjoker','dauerjoker-test',v,now()-interval '30 days',true) returning id into s;
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Dauerjoker',now()-interval '8 days',now()-interval '1 day') returning id into r;
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Dauerjoker','multiple_choice','text','multiple_choice','a','b','c','a') returning id into f;
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,1);
 insert into public.geburtstagsjoker(schiedsrichter_id,jahr,erhalten_am,gueltig_bis) values(s,2020,'2020-01-01','2021-01-01');
 perform set_config('test.dauerjoker_person',s::text,true);perform set_config('test.dauerjoker_runde',r::text,true);
end $$;
set local role anon;
do $$
declare s uuid:=current_setting('test.dauerjoker_person')::uuid;r uuid:=current_setting('test.dauerjoker_runde')::uuid;x jsonb;
begin
 x:=public.meine_wochenserie_mit_joker(s,'dauerjoker-test');
 if jsonb_array_length(x->'joker')<>1 then raise exception 'Alter unverbrauchter Joker fehlt'; end if;
 begin perform public.geburtstagsjoker_einloesen(s,'falsch',r);raise exception 'Falsche PIN zugelassen';
 exception when others then if sqlerrm='Falsche PIN zugelassen' then raise; end if; end;
 x:=public.geburtstagsjoker_einloesen(s,'dauerjoker-test',r);
 if jsonb_array_length(x->'joker')<>0 or (x#>>'{wochen,0,joker_gerettet}')::boolean is not true then raise exception 'Dauerjoker nicht verbraucht'; end if;
 begin perform public.geburtstagsjoker_einloesen(s,'dauerjoker-test',r);raise exception 'Doppelverbrauch zugelassen';
 exception when others then if sqlerrm='Doppelverbrauch zugelassen' then raise; end if; end;
end $$;
reset role;
select 'Kein Ablaufdatum, einmaliger Verbrauch, unveränderte Wochenfrist und PIN geprüft' as ergebnis;
rollback;
