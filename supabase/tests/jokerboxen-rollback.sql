-- Synthetic fixtures only; no real answers, rewards or notifications.
begin;
do $$
#variable_conflict use_variable
declare verein uuid; fremd uuid; person uuid; andere uuid; runde uuid; frage uuid; f2 uuid; f3 uuid; fr uuid; box uuid; b uuid; x jsonb; y jsonb; n int; pw text:='boxen-'||gen_random_uuid(); k int; heute date:=(now() at time zone 'Europe/Berlin')::date; t uuid;
begin
 insert into public.vereine(name) values('Rollback-Boxen-'||gen_random_uuid()) returning id into verein;
 insert into public.vereine(name) values('Rollback-Boxen-Fremd-'||gen_random_uuid()) returning id into fremd;
 insert into public.schiedsrichter(name,pin,verein_id,erstellt_am,geburtsdatum) values('Rollback-Boxen-Person','box-test',verein,now()-interval '30 days',heute-interval '20 years') returning id into person;
 insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Boxen-Fremd','box-fremd',fremd) returning id into andere;
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,pw,verein),(n-1,pw||'-fremd',fremd);
 x:=public.mein_jokerbestand(person,'box-test');
 if jsonb_array_length(x->'boxen')<>1 then raise exception 'Geburtstagsbox fehlt'; end if;
 if jsonb_array_length(public.mein_jokerbestand(person,'box-test')->'boxen')<>1 then raise exception 'Doppelte Geburtstagsbox'; end if;
 box:=(x#>>'{boxen,0,id}')::uuid;
 begin perform public.jokerbox_oeffnen(andere,'box-fremd',box);raise exception 'TEST: Fremdöffnung';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 x:=public.jokerbox_oeffnen(person,'box-test',box);y:=public.jokerbox_oeffnen(person,'box-test',box);
 if x->>'typ' is distinct from y->>'typ' then raise exception 'Neuauslosung beim Doppelöffnen';end if;
 if (select count(*) from private.jokerbestand j where j.box=box)<>1 then raise exception 'Doppelte Vergabe'; end if;
 -- Controlled private fixtures guarantee every Joker branch is exercised.
 insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(person,'Test','test-zweiter',now(),'zweiter-versuch') returning id into b;
 insert into private.jokerbestand(person,box,typ) values(person,b,'zweiter-versuch');
 insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(person,'Test','test-halbe',now(),'halbhalb') returning id into b;
 insert into private.jokerbestand(person,box,typ) values(person,b,'halbhalb');
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Boxen-Live',now()-interval '1 minute',now()+interval '1 hour') returning id into runde;
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Boxen-Frage','multiple_choice','text','multiple_choice','Richtig','Falsch','Auch falsch','a') returning id into frage;
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Boxen-Decline','multiple_choice','text','multiple_choice','Richtig','Falsch','Auch falsch','a') returning id into f2;
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Boxen-Half','multiple_choice','text','multiple_choice','Richtig','Falsch','Auch falsch','a') returning id into f3;
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(verein,runde,frage,1),(verein,runde,f2,2),(verein,runde,f3,3);
 x:=public.quiz_joker_antwort(person,'box-test',frage,'antwort','auswahl','{"auswahl":["b"]}');
 if x is distinct from '{"joker_offen":true}'::jsonb then raise exception 'Lösung oder Feedback vor Jokerentscheidung: %',x;end if;
 if exists(select 1 from public.antworten a where a.schiedsrichter_id=person and a.frage_id=frage) then raise exception 'Erstantwort voreilig final';end if;
 if exists(select 1 from public.meine_antworten_v2(person,'box-test') a where a.frage_id=frage and (a.beantwortet or a.richtige_option is not null or a.richtige_auswahl is not null)) then raise exception 'Lösungsleck beim Neuladen';end if;
 x:=public.mein_jokerbestand(person,'box-test');if not exists(select 1 from jsonb_array_elements(x->'vorgaenge') v where v->>'frage_id'=frage::text and v->>'status'='angebot') then raise exception 'Angebot nicht reloadfest';end if;
 perform public.quiz_joker_antwort(person,'box-test',frage,'joker');perform public.quiz_joker_antwort(person,'box-test',frage,'joker');
 x:=public.quiz_joker_antwort(person,'box-test',frage,'antwort','auswahl','{"auswahl":["a"]}');
 if x->>'korrekt'<>'true' or x->>'joker_eingesetzt'<>'true' then raise exception 'Jokererfolg nicht voll richtig';end if;
 if not exists(select 1 from public.antworten a where a.schiedsrichter_id=person and a.frage_id=frage and a.korrekt and a.bewertungsstatus='richtig') then raise exception 'Statistikantwort fehlt';end if;
 x:=public.obmann_joker_verlauf(pw,'Rollback-Boxen-Person');
 if not exists(select 1 from jsonb_array_elements(x) v where v->>'frage_id'=frage::text and v->>'erstantwort_text'='Falsch' and v->>'jokerantwort_text'='Richtig') then raise exception 'Obmann-Audit fehlt: %',x;end if;
 if public.obmann_joker_verlauf(pw||'-fremd','Rollback-Boxen-Person')<>'[]' then raise exception 'Fremdverein im Audit';end if;
 -- More retries cannot change the final result or consume again.
 y:=public.quiz_joker_antwort(person,'box-test',frage,'antwort','auswahl','{"auswahl":["b"]}');if y->>'korrekt'<>'true' then raise exception 'Finaler Versuch überschrieben';end if;
 insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(person,'Test','test-decline',now(),'zweiter-versuch') returning id into b;
 insert into private.jokerbestand(person,box,typ) values(person,b,'zweiter-versuch');
 perform public.quiz_joker_antwort(person,'box-test',f2,'antwort','auswahl','{"auswahl":["b"]}');
 x:=public.quiz_joker_antwort(person,'box-test',f2,'aufloesen');if x->>'korrekt'<>'false' or x->'richtige_auswahl' is null then raise exception 'Auflösung nach Ablehnen fehlt';end if;
 x:=public.quiz_joker_antwort(person,'box-test',f3,'halbhalb');y:=public.quiz_joker_antwort(person,'box-test',f3,'halbhalb');
 if x<>y or jsonb_array_length(x->'kandidaten')<>2 or not (x->'kandidaten'?'a') then raise exception '50/50-Kandidaten falsch';end if;
 if has_function_privilege('anon','public.quiz_joker_bewertet(uuid,text,uuid,text,jsonb)','EXECUTE') or has_function_privilege('anon','private.quiz_joker_aktion(uuid,text,uuid,text,text,jsonb)','EXECUTE') or has_table_privilege('anon','private.jokerboxen','SELECT') then raise exception 'Private Daten/KI-Schreibweg öffentlich';end if;
 -- Attendance is confirmed, not inferred from RSVP; corrections are reversible.
 insert into public.termine(verein_id,titel,datum,art) values(verein,'Rollback-Boxen-Lehrabend',heute,'lehrabend') returning id into t;
 insert into public.fortbildung_nachweise(termin_id,schiedsrichter_id,gewertet) values(t,person,true);
 perform public.mein_jokerbestand(person,'box-test');perform public.mein_jokerbestand(person,'box-test');
 if (select count(*) from private.jokerboxen b where b.person=person and b.schluessel='teilnahme:'||t)<>1 then raise exception 'Teilnahme nicht genau einmal belohnt';end if;
 update public.fortbildung_nachweise set gewertet=false where termin_id=t and schiedsrichter_id=person;
 perform public.mein_jokerbestand(person,'box-test');if not exists(select 1 from private.jokerboxen b where b.person=person and b.schluessel='teilnahme:'||t and b.widerrufen) then raise exception 'Widerruf fehlt';end if;
 -- Four completed synthetic rounds after rollout; no rescued/practice answers.
 for k in 1..4 loop
  insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Boxen-Vier-'||k,now()-interval '30 seconds',now()-interval '1 second') returning id into fr;
  insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Boxen-Vierfrage-'||k,'multiple_choice','text','multiple_choice','Richtig','Falsch','Auch falsch','a') returning id into f2;
  insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(verein,fr,f2,1);
  insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,bewertungsstatus,beantwortet_am) values(person,f2,'b',false,'falsch',now()-interval '5 seconds');
 end loop;
 perform public.mein_jokerbestand(person,'box-test');perform public.mein_jokerbestand(person,'box-test');
 if (select count(*) from private.jokerboxen b where b.person=person and b.schluessel='vier-wochen:1')<>1 then raise exception 'Vier-Wochen-Box fehlt/doppelt';end if;
 perform set_config('test.box_person',person::text,true);perform set_config('test.box_frage',frage::text,true);
 -- Existing administrator reset also clears the workflow, without refunding stock.
 perform public.obmann_antwort_ueberschreiben(pw,'Rollback-Boxen-Person',frage,'zuruecksetzen',null);
 if exists(select 1 from private.quiz_joker_vorgaenge v where v.person=person and v.frage=frage) then raise exception 'Reset lässt alten Jokervorgang stehen';end if;
end $$;
set local role anon;
do $$
declare s uuid:=current_setting('test.box_person')::uuid; f uuid:=current_setting('test.box_frage')::uuid;
begin
 begin perform public.mein_jokerbestand(s,'falsch');raise exception 'TEST: Falsche PIN';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.quiz_joker_antwort(s,'box-test',f,'antwort','freitext','{"korrekt":true,"status":"richtig"}');raise exception 'TEST: Gefälschte KI-Bewertung';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.quiz_joker_bewertet(s,'box-test',f,'freitext','{}');raise exception 'TEST: KI-RPC als anon';exception when insufficient_privilege then null;end;
 perform public.mein_jokerbestand(s,'box-test');
end $$;
reset role;
select 'Boxen/Idempotenz, PIN-Grenzen, 50/50, zurückgehaltene Lösung, Joker-Vollwertung, Obmann-Audit, Teilnahme/Widerruf und Vier-Wochen-Bonus geprüft' as ergebnis;
rollback;
