begin;
do $$
declare v uuid;s uuid;r uuid;f uuid;ft uuid;ic uuid;b uuid;typ text;x jsonb;n int;past uuid;pf uuid;
begin
 insert into public.vereine(name) values('Rollback-Jokertypen-'||gen_random_uuid()) returning id into v;
 insert into public.schiedsrichter(name,pin,verein_id,erstellt_am) values('Rollback-Jokertypen','typen-test',v,now()-interval '30 days') returning id into s;
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Jokertypen-Live',now()-interval '1 minute',now()+interval '1 hour') returning id into r;
 for n in 1..3 loop
  insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(s,'Test','typ:'||n,now(),'zweiter-versuch') returning id into b;
  insert into private.jokerbestand(person,box,typ) values(s,b,'zweiter-versuch');
 end loop;
 insert into public.fragen(frage_text,typ,medium,antworttyp) values('Rollback-Jokertypen-Zahl','multiple_choice','text','zahl') returning id into f;
 insert into public.frage_zahl_loesungen(frage_id,wert,einheit,toleranz,position) values(f,9.15,'Meter',0.01,1);
 insert into public.fragen(frage_text,typ,medium,antworttyp,musterantwort) values('Rollback-Jokertypen-Freitext','freitext','text','freitext','Richtige Lösung') returning id into ft;
 insert into public.fragen(frage_text,typ,medium,antworttyp) values('Rollback-Jokertypen-Icon','szenario','text','entscheidung') returning id into ic;
 insert into public.frage_entscheidungsloesungen(frage_id,spielfortsetzung,spielfortsetzungen_gueltig,fordert_fortsetzung,fordert_fortsetzung_fuer,fordert_fortsetzung_ort,fordert_strafe,fordert_strafe_mannschaft,fordert_strafe_rolle,fordert_strafe_nummer)
 values(ic,'einwurf',array['einwurf'],true,false,false,false,false,false,false);
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,1),(v,r,ft,2),(v,r,ic,3);
 x:=public.quiz_joker_antwort(s,'typen-test',f,'antwort','zahl','{"wert":1,"einheit":"Meter"}');
 if x<>'{"joker_offen":true}' then raise exception 'Zahllösung zu früh';end if;
 perform public.quiz_joker_antwort(s,'typen-test',f,'joker');
 x:=public.quiz_joker_antwort(s,'typen-test',f,'antwort','zahl','{"wert":9.15,"einheit":"Meter"}');
 if x->>'korrekt'<>'true' or x->>'joker_eingesetzt'<>'true' then raise exception 'Zahljoker falsch';end if;
 x:=public.quiz_joker_bewertet(s,'typen-test',ft,'freitext','{"freitext":"Falsch","korrekt":false,"status":"falsch","feedback":"Geheime Lösung"}');
 if x<>'{"joker_offen":true}' then raise exception 'KI-Feedback/Muster zu früh';end if;
 perform public.quiz_joker_antwort(s,'typen-test',ft,'joker');
 x:=public.quiz_joker_bewertet(s,'typen-test',ft,'freitext','{"freitext":"Richtige Lösung","korrekt":true,"status":"richtig","feedback":"Passt"}');
 if x->>'korrekt'<>'true' or x->>'musterantwort'<>'Richtige Lösung' then raise exception 'Freitextjoker falsch: %',x;end if;
 x:=public.quiz_joker_bewertet(s,'typen-test',ic,'entscheidung','{"antwort":{"spielfortsetzung":"weiterspielen","strafen":[]},"ort_richtig":null}');
 if x<>'{"joker_offen":true}' then raise exception 'Icon-Lösung zu früh';end if;
 perform public.quiz_joker_antwort(s,'typen-test',ic,'joker');
 x:=public.quiz_joker_bewertet(s,'typen-test',ic,'entscheidung','{"antwort":{"spielfortsetzung":"einwurf","strafen":[]},"ort_richtig":null}');
 if x->>'korrekt'<>'true' or x->>'joker_eingesetzt'<>'true' then raise exception 'Iconjoker falsch: %',x;end if;
 if not exists(select 1 from public.meine_quiz_statistik(s,'typen-test',12) q where q.runde_id=r and q.richtig=3 and q.beantwortet=3) then raise exception 'Statistik zählt nicht dreimal voll richtig';end if;
 if (select count(*) from public.meine_antworten_v2(s,'typen-test') a where a.korrekt)<>3 then raise exception 'Antwortfeed nicht voll grün';end if;
 -- A new boxed series Joker uses the same rescue eligibility as a legacy Joker.
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Jokertypen-Rettung',now()-interval '8 days',now()-interval '1 day') returning id into past;
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option) values('Rollback-Jokertypen-Rettfrage','multiple_choice','text','multiple_choice','A','B','C','a') returning id into pf;
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,past,pf,1);
 insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(s,'Test','typ:serie',now(),'serienjoker') returning id into b;
 insert into private.jokerbestand(person,box,typ) values(s,b,'serienjoker');
 x:=public.geburtstagsjoker_einloesen(s,'typen-test',past);
 if not exists(select 1 from jsonb_array_elements(x->'wochen') w where w->>'runde_id'=past::text and w->>'joker_gerettet'='true' and w->>'beantwortet'='0') then raise exception 'Box-Serienjoker rettet nicht';end if;
end $$;
select 'Zahl, Freitext und Icon: Lösung zurückgehalten, Retry voll richtig, Statistik/Antwortfeed grün; Box-Serienjoker geprüft' as ergebnis;
rollback;
