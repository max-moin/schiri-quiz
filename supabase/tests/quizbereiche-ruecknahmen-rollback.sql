-- Synthetic fixtures, always rolled back. No real responses, rewards or messages.
begin;
do $test$
declare v uuid; fremd uuid; s uuid; s2 uuid; r uuid; z uuid; f uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid;
 a uuid; a2 uuid; box uuid; x jsonb; y jsonb; n int; k int; d text;
begin
 insert into public.vereine(name) values('Rollback-Quizbereiche-'||gen_random_uuid()) returning id into v;
 insert into public.vereine(name) values('Rollback-Quizbereiche-Fremd-'||gen_random_uuid()) returning id into fremd;
 insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Quizbereiche-Person','qr-test',v) returning id into s;
 insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Quizbereiche-Fremd','qr-fremd',fremd) returning id into s2;
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Quizbereiche-Woche',now()-interval '1 hour',now()+interval '1 hour') returning id into r;
 insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Quizbereiche-Zukunft',now()+interval '1 day',now()+interval '8 days') returning id into z;
 insert into public.fragen(frage_text,medium,antworttyp,option_a,option_b,option_c,richtige_option,musterantwort) values
  ('Sichere öffentliche Frage','text','multiple_choice','Geheime Option A','Geheime Option B','Geheime Option C','a','Geheime Musterlösung') returning id into f;
 insert into public.fragen(frage_text,medium,antworttyp,video_url,musterantwort) values
  ('Interner Video-Spielername darf hier nicht erscheinen','video','freitext','https://staige.tv/video/566569','Geheime Videolösung') returning id into f2;
 insert into public.fragen(frage_text,medium,antworttyp,option_a,option_b,option_c,richtige_option) values
  ('Eine falsche Frage','text','multiple_choice','A','B','C','a') returning id into f3;
 insert into public.fragen(frage_text,medium,antworttyp,option_a,option_b,option_c,richtige_option) values
  ('Noch nicht beantwortet','text','multiple_choice','A','B','C','a') returning id into f4;
 insert into public.fragen(frage_text,medium,antworttyp,option_a,option_b,option_c,richtige_option) values
  ('Künftige Frage','text','multiple_choice','A','B','C','a') returning id into f5;
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,1),(v,r,f2,2),(v,r,f3,3),(v,r,f4,4),(v,z,f5,1);
 insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,bewertungsstatus) values(s,f,'a',true,'richtig'),(s,f3,'b',false,null);
 insert into public.antworten(schiedsrichter_id,frage_id,gegebener_freitext,korrekt,bewertungsstatus) values(s,f2,'Geheime eigene Antwort',false,'nachbessern');
 select jsonb_agg(to_jsonb(q) order by q.position) into x from public.meine_quizwochen_fragen(s,'qr-test',r) q;
 if jsonb_array_length(x)<>4 or x#>>'{0,status}'<>'richtig' or x#>>'{1,status}'<>'nachbessern' or x#>>'{2,status}'<>'falsch' or x#>>'{3,status}'<>'offen' then raise exception 'Statusliste falsch: %',x;end if;
 if x#>>'{1,frage_text}'<>'Video-Frage' or x::text ilike '%Geheim%' or x::text ilike '%Spielername%' or x::text ilike '%staige%' then raise exception 'Lösungs-/Medien-/Titelleck';end if;
 select to_jsonb(q) into y from public.meine_quiz_statistik(s,'qr-test',26) q where q.runde_id=r;
 if y->>'richtig'<>'1' or y->>'nachbessern'<>'1' or y->>'falsch'<>'1' then raise exception 'Summen inkonsistent: %',y;end if;
 begin perform public.meine_quizwochen_fragen(s,'falsch',r);raise exception 'TEST: PIN akzeptiert';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.meine_quizwochen_fragen(s2,'qr-fremd',r);raise exception 'TEST: Fremdwoche akzeptiert';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.meine_quizwochen_fragen(s,'qr-test',z);raise exception 'TEST: Zukunft akzeptiert';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 d:=pg_get_functiondef('public.jokerbox_oeffnen(uuid,text,uuid)'::regprocedure);
 if position('random() < 0.1' in d)=0 or position('floor(random()*3)' in d)>0 then raise exception 'Gewichtung nicht 90/10';end if;
 for k in 1..10 loop
  insert into private.jokerboxen(person,quelle,schluessel) values(s,'Rollback','qr-'||k) returning id into box;
  x:=public.jokerbox_oeffnen(s,'qr-test',box);y:=public.jokerbox_oeffnen(s,'qr-test',box);
  if x->>'typ' not in ('serienjoker','zweiter-versuch') or x->>'typ' is distinct from y->>'typ' then raise exception 'Neue Ziehung / Wiederholung falsch';end if;
 end loop;
 insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ) values(s,'Rollback','qr-alt',now(),'halbhalb') returning id into box;
 insert into private.jokerbestand(person,box,typ) values(s,box,'halbhalb');
 x:=public.jokerbox_oeffnen(s,'qr-test',box);if x->>'typ'<>'halbhalb' then raise exception 'Alter Joker verändert';end if;
 insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,prozess_status) values(s,'trikot','eingereicht') returning id into a;
 perform public.ausruestung_uebergang(a,'geprueft','obmann','Rollback-Admin');
 perform public.schiri_anfrage_schritt(s,'qr-test',a,'zurueckgezogen');
 x:=public.ausruestung_prozess_jsonb(a,'obmann');
 if x#>>'{ruecknahme,rolle}'<>'schiri' or x#>>'{ruecknahme,vorheriger_status}'<>'geprueft' then raise exception 'Rücknahmeherkunft fehlt: %',x;end if;
 if not exists(select 1 from jsonb_array_elements(x->'schritte') t where t->>'schluessel'='geprueft' and t->>'stand'='gestoppt') then raise exception 'Rücknahme verlor letzten Schritt';end if;
 if not exists(select 1 from public.ausruestung_ereignisse e where e.anfrage_id=a and e.schritt='zurueckgezogen' and e.eingang) then raise exception 'Kein Eingang zur Rücknahme';end if;
 insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,prozess_status) values(s,'hose','eingereicht') returning id into a2;
 perform public.ausruestung_uebergang(a2,'geprueft','obmann','Rollback-Admin');
 perform public.ausruestung_uebergang(a2,'vorgelegt','obmann','Rollback-Admin');
 perform public.ausruestung_uebergang(a2,'geprueft','obmann','Rollback-Admin');
 x:=public.ausruestung_prozess_jsonb(a2,'obmann');
 if x#>>'{rueckgabe,vorheriger_status}'<>'vorgelegt' or x->'ruecknahme'<>'null'::jsonb then raise exception 'Rückgabe und Rücknahme vermischt';end if;
 if (x->>'runde')::int<>2 then raise exception 'Rückgabe nicht in eigenem Durchlauf';end if;
 if (select count(*) from public.ausruestung_ereignisse where anfrage_id=a2 and schritt='geprueft')<>2 then raise exception 'Rückgabe überschrieb Erstprüfung';end if;
 perform public.schiri_anfrage_schritt(s,'qr-test',a2,'zurueckgezogen');
 x:=public.ausruestung_prozess_jsonb(a2,'obmann');
 if x#>>'{ruecknahme,vorheriger_status}'<>'geprueft' then raise exception 'Rücknahme nach Rückgabe ohne Herkunft';end if;
 perform set_config('test.qr_person',s::text,true);perform set_config('test.qr_runde',r::text,true);
end $test$;
set local role anon;
select count(*) as erlaubte_eigene_fragen from public.meine_quizwochen_fragen(current_setting('test.qr_person')::uuid,'qr-test',current_setting('test.qr_runde')::uuid);
reset role;
select 'Quizbereiche, keine Lösungsdaten, 90/10, Altbestand, PIN/Verein/Zukunft, Rücknahme/Rückgabe: geprüft' as ergebnis;
rollback;
