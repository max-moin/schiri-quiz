-- Run the entire file in one request. Synthetic data only; always rolled back.
begin;
do $$
declare c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 b uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); n int; x jsonb; y jsonb; p text:='icon-reason-test-'||gen_random_uuid();
 cfg jsonb:='{"spielfortsetzung":"weiterspielen","fordert_fortsetzung":true,"fordert_fortsetzung_fuer":false,"fordert_fortsetzung_ort":false,"fordert_strafe":true,"strafen":[],"fordert_strafe_mannschaft":false,"fordert_strafe_rolle":false,"fordert_strafe_nummer":false,"fordert_begruendung":true,"begruendung_muster":"Der Ball bleibt im Spiel.","begruendung_gewicht":1}';
 a jsonb:='{"spielfortsetzung":"weiterspielen","persoenliche_strafe":"keine","strafen":[],"begruendung":"Erste unpassende Begründung","_begruendung":{"richtig":false,"feedback":"Nicht passend."}}';
begin
 insert into public.vereine(id,name) values(c,'Icon-Begründung-Rollback');
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,p,c);
 insert into public.schiedsrichter(id,name,verein_id,pin,ist_test,erstellt_am) values(s,'Icon-Rollbackperson',c,'942781',false,now()-interval '30 days');
 insert into public.runden(id,bezeichnung,startet_am,endet_am) values(r,'Icon-Rollbackwoche',now()-interval '1 day',now()+interval '5 days');
 insert into public.fragen(id,frage_text,medium,antworttyp,aktiv,in_bearbeitung) values(f,'Isolierte Iconfrage','text','entscheidung',true,false);
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(c,r,f,1);
 perform public.frage_entscheidungsloesung_setzen(f,cfg);
 x:=public.entscheidung_kontext_v3(s,f,'942781',a);
 if x->>'begruendung_muster'<>'Der Ball bleibt im Spiel.' or not (x->>'kern_richtig')::boolean then raise exception 'TEST: API-Kontext fehlt'; end if;
 begin
  perform public.entscheidung_kontext_v3(s,f,'falsch',a);
  raise exception 'TEST: Kontext ohne PIN';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 if not (select fordert_begruendung from public.wochen_fragen_v3(s,'942781') where id=f) then raise exception 'TEST: Opt-in fehlt im Feed'; end if;
 if to_jsonb((select q from public.wochen_fragen_v3(s,'942781') q where id=f)) ? 'begruendung_muster' then raise exception 'TEST: Lösung im Fragenfeed'; end if;
 if has_function_privilege('anon','public.entscheidung_kontext_v3(uuid,uuid,text,jsonb)','execute') then raise exception 'TEST: öffentliche Lösung'; end if;
 if not private.entscheidung_kern_richtig(f,a) then raise exception 'TEST: richtige Icons falsch'; end if;
 if private.entscheidung_kern_richtig(f,a||'{"spielfortsetzung":"einwurf"}') then raise exception 'TEST: falsche Icons richtig'; end if;
 -- Older editors preserve all three new values when they omit the keys.
 perform public.frage_entscheidungsloesung_setzen(f,cfg-'fordert_begruendung'-'begruendung_muster'-'begruendung_gewicht');
 if not (select fordert_begruendung and begruendung_gewicht=1 from public.frage_entscheidungsloesungen where frage_id=f) then raise exception 'TEST: alte App löscht Vorgabe'; end if;
 begin
  perform public.entscheidung_antwort_speichern_v2(s,f,'942781',a-'_begruendung',true,null);
  raise exception 'TEST: fehlende Servernote akzeptiert';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 insert into private.jokerboxen(id,person,quelle,schluessel,geoeffnet_am,typ) values(b,s,'Test','test:'||f,now(),'zweiter-versuch');
 insert into private.jokerbestand(person,box,typ) values(s,b,'zweiter-versuch');
 x:=public.quiz_joker_bewertet(s,'942781',f,'entscheidung',jsonb_build_object('antwort',a,'ort_richtig',true));
 if x is distinct from '{"joker_offen":true}'::jsonb then raise exception 'TEST: Jokerangebot verrät Lösung: %',x; end if;
 if exists(select 1 from public.antworten where schiedsrichter_id=s and frage_id=f) then raise exception 'TEST: vorzeitig endgültige Antwort'; end if;
 perform public.quiz_joker_antwort(s,'942781',f,'joker',null,'{}');
 a:=a||'{"begruendung":"Passende zweite Begründung","_begruendung":{"richtig":true,"feedback":"Passend."}}';
 x:=public.quiz_joker_bewertet(s,'942781',f,'entscheidung',jsonb_build_object('antwort',a,'ort_richtig',true));
 if not coalesce((x->>'korrekt')::boolean,false) or not coalesce((x->>'joker_eingesetzt')::boolean,false) then raise exception 'TEST: Joker zählt nicht voll richtig: %',x; end if;
 if not (select korrekt and bewertungsstatus='richtig' from public.antworten where schiedsrichter_id=s and frage_id=f) then raise exception 'TEST: Statistik nicht grün'; end if;
 if not exists(select 1 from private.quiz_joker_vorgaenge where person=s and frage=f
  and erste_antwort#>>'{antwort,begruendung}'='Erste unpassende Begründung' and letzte_antwort#>>'{antwort,begruendung}'='Passende zweite Begründung') then raise exception 'TEST: Erst-/Jokerantwort fehlt'; end if;
 if not (select entscheidung#>>'{ergebnis,begruendung_richtig}'='true' from public.meine_antworten_v2(s,'942781') where frage_id=f) then raise exception 'TEST: Neuladen verliert vierte Note'; end if;
 if not (select entscheidung_ergebnis->>'begruendung_richtig'='true' from public.obmann_wochenauswertung(p,r) where frage_id=f and schiedsrichter='Icon-Rollbackperson') then raise exception 'TEST: Obmannnote fehlt'; end if;
 -- A duplicate request/config change must not rewrite old snapshots or grades.
 update public.frage_entscheidungsloesungen set begruendung_muster='Spätere andere Musterantwort' where frage_id=f;
 y:=public.entscheidung_antwort_speichern_v2(s,f,'942781',a||'{"_begruendung":{"richtig":false}}',true,null);
 if not (y->>'korrekt')::boolean or y#>>'{loesung,begruendung_muster}'<>'Der Ball bleibt im Spiel.' then raise exception 'TEST: Historie umbewertet'; end if;
 -- A wrong reason alone is sufficient to fail the complete answer.
 y:=public.entscheidung_ergebnis_bauen(a||'{"_begruendung":{"richtig":false}}','{"fordert_begruendung":true}',false,true,true,true,true,true,true,true,null);
 if (y->>'korrekt')::boolean then raise exception 'TEST: falsche Begründung zählt richtig'; end if;
 -- The same opt-in contract must work in the separate duel flow.
 insert into public.duell_sessions(id,code,verein_id,erstellt_von) values(d,upper(substr(replace(d::text,'-',''),1,6)),c,s);
 insert into public.duell_teilnehmer(id,session_id,zugang,schiedsrichter_id,anzeigename) values(t,d,z,s,'Testperson');
 insert into public.duell_fragen(session_id,frage_id,position) values(d,f,1);
 x:=public.duell_frage(z);
 if not (x->>'fordert_begruendung')::boolean or x ? 'begruendung_muster' then raise exception 'TEST: Duell-Feed falsch'; end if;
 x:=public.duell_entscheidung_kontext_v3(z,f,a);
 if not (x->>'kern_richtig')::boolean or x->>'begruendung_muster' is null then raise exception 'TEST: Duell-Kontext fehlt'; end if;
 x:=public.duell_entscheidung_speichern_v2(z,f,a||'{"_begruendung":{"richtig":false}}',true,null);
 if (x->>'korrekt')::boolean or x#>>'{ergebnis,begruendung_richtig}'<>'false' then raise exception 'TEST: Duellgrund falsch bewertet'; end if;
 if (select korrekt from public.duell_antworten where teilnehmer_id=t and frage_id=f) then raise exception 'TEST: Duellstatistik falsch'; end if;
end $$;
rollback;
select 'Icon-Begründung, Jokeraudit, Statistik und Historie: Rollbacktests bestanden' as ergebnis;
