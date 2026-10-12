begin;
do $$
declare v uuid; s uuid; r uuid; f uuid; i uuid;
begin
insert into public.vereine(name) values ('Rollback-Quiz-'||gen_random_uuid()) returning id into v;
insert into public.schiedsrichter(name,pin,verein_id) values ('Rollback-Quiz','nur-rollback-test',v) returning id into s;
insert into public.runden(bezeichnung,startet_am,endet_am) values ('Rollback-Quiz-'||gen_random_uuid(),now()-interval '1 hour',now()+interval '1 hour') returning id into r;
insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option)
values ('Künstlicher Abgabetest','multiple_choice','text','multiple_choice','Richtig','Falsch','Falsch','a') returning id into f;
insert into public.fragen(frage_text,typ,medium,antworttyp)
values ('Künstlicher Icon-Abgabetest','szenario','text','entscheidung') returning id into i;
insert into public.frage_entscheidungsloesungen(frage_id,spielfortsetzung,spielfortsetzungen_gueltig,fordert_fortsetzung,fordert_fortsetzung_fuer,fordert_fortsetzung_ort,fordert_strafe,fordert_strafe_mannschaft,fordert_strafe_rolle,fordert_strafe_nummer)
values (i,'einwurf',array['einwurf','weiterspielen'],true,false,false,false,false,false,false);
insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,1),(v,r,i,2);
perform set_config('test.quiz_person',s::text,true);
perform set_config('test.quiz_mc',f::text,true);
perform set_config('test.quiz_icon',i::text,true);
end $$;
set local role anon;
do $$
declare s uuid:=current_setting('test.quiz_person')::uuid; f uuid:=current_setting('test.quiz_mc')::uuid;
i uuid:=current_setting('test.quiz_icon')::uuid; a record; n int;
begin
select * into a from public.antwort_auswahl_abgeben(s,f,array['a'],'nur-rollback-test');
if a.korrekt is distinct from true or a.bereits_beantwortet is distinct from false then raise exception 'MC-Erstabgabe falsch'; end if;
select * into a from public.antwort_auswahl_abgeben(s,f,array['a'],'nur-rollback-test');
if a.korrekt is distinct from true or a.bereits_beantwortet is distinct from true then raise exception 'MC-Doppelschutz fehlt'; end if;
select count(*) into n from public.entscheidung_kontext_laden(s,i,'nur-rollback-test');
if n<>1 then raise exception 'Icon-Kontext fehlt'; end if;
begin
perform * from public.entscheidung_kontext_laden(s,i,'falscher-test-pin');
raise exception 'Falsche PIN erlaubt';
exception when others then if sqlerrm='Falsche PIN erlaubt' then raise; end if; end;
end $$;
reset role;
do $$
declare s uuid:=current_setting('test.quiz_person')::uuid; i uuid:=current_setting('test.quiz_icon')::uuid; w jsonb;
begin
w:=public.entscheidung_antwort_speichern_v2(s,i,'nur-rollback-test','{"spielfortsetzung":"einwurf"}'::jsonb,null,null);
if (w->>'korrekt')::boolean is distinct from true then raise exception 'Icon-Abgabe nicht richtig: %',w; end if;
if (select count(*) from public.antworten a where a.schiedsrichter_id=s)<>2 then raise exception 'Falsche Zahl Antworten'; end if;
end $$;
select 'MC-Abgabe, Doppelschutz, Icon-Kontext, falsche PIN und Icon-Speicherung erfolgreich; alle Daten zurückgerollt' as ergebnis;
rollback;
