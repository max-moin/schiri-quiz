-- Ausschließlich isolierte Testdaten in BEGIN/ROLLBACK. Keine Nachrichten versenden.
do $$
declare c uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid();
 r uuid:=gen_random_uuid(); live_r uuid:=gen_random_uuid(); fr uuid:=gen_random_uuid(); v uuid; v2 uuid; f uuid; f2 uuid; n int; k int;
 p text:='vorschlag-test-'||gen_random_uuid(); heute date:=(now() at time zone 'Europe/Berlin')::date;
 x jsonb:='{"frage_text":"Isolierte Testfrage aus dem Vorschlag","medium":"text","antworttyp":"multiple_choice","loesung":{"optionen":["Ja","Nein","Vielleicht"],"richtig":"A"},"herkunft_gruppe":true,"herkunft_name":false}';
 b jsonb:='{"frage_text":"Isolierter Fragenentwurf","medium":"text","antworttyp":"multiple_choice"}';
 i jsonb:='{"optionen":[{"schluessel":"a","text":"Ja","richtig":true},{"schluessel":"b","text":"Nein","richtig":false}]}';
 meta jsonb; j jsonb; zeit timestamptz;
begin
 insert into public.vereine(id,name) values(c,'Vorschläge-Joker-Rollback'),(c2,'Fremder Rollbackverein');
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,p,c),(n-1,p||'-fremd',c2);
 insert into public.schiedsrichter(id,name,verein_id,pin,erstellt_am,geburtsdatum)
 values(s,'Test Vorschlag '||s,c,'942781',now()-interval '30 days',heute-interval '20 years'),
       (s2,'Test Fremd '||s2,c2,'942782',now()-interval '30 days',null);
 v:=public.schiri_fragenvorschlag_speichern(s,'942781',x,'Ausführliche ungeprüfte Begründung für diesen isolierten Vorschlag.','Isolierter Regelbeleg zum Testen.',null,true);
 perform public.obmann_fragenvorschlag_status_setzen(p,v,'in_pruefung');
 select aktualisiert_am into zeit from public.fragenvorschlaege where id=v;
 meta:=jsonb_build_object('vorschlag_id',v,'vorschlag_stand',zeit,'gruppe_zeigen',true,'name_zeigen',true);
 begin perform public.obmann_frage_redaktion_speichern(p,null,b,i,false,'{}','',meta); raise exception 'TEST: Name ohne Zustimmung';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 meta:=meta||'{"name_zeigen":false}';
 begin perform public.obmann_frage_redaktion_speichern(p||'-fremd',null,b,i,false,'{}','',meta); raise exception 'TEST: Fremdübernahme';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 f:=public.obmann_frage_redaktion_speichern(p,null,b,i,false,'{}','Testentwurf',meta);
 if (select aktiv or sichtbar_gast or sichtbar_historie from public.fragen where id=f) then raise exception 'TEST: automatisch veröffentlicht'; end if;
 if not exists(select 1 from public.fragenvorschlaege where id=v and status='angenommen' and uebernommene_frage_id=f) then raise exception 'TEST: Verknüpfung fehlt'; end if;
 begin perform public.obmann_frage_redaktion_speichern(p,null,b,i,false,'{}','',meta); raise exception 'TEST: Doppelübernahme';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 if exists(select 1 from public.schiri_fragen_herkunft(s,'942781',array[f])) then raise exception 'TEST: Entwurf im Quiz'; end if;
 insert into public.runden(id,bezeichnung,startet_am,endet_am) values
   (r,'Joker-Rollbackwoche',now()-interval '10 days',now()-interval '3 days'),
   (live_r,'Herkunft-Rollbackwoche',now()-interval '1 day',now()+interval '5 days');
 insert into public.fragen(id,frage_text,medium,antworttyp,aktiv,in_bearbeitung)
 values(fr,'Isolierte alte Jokerfrage','text','multiple_choice',false,true);
 insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(c,r,fr,1),(c,live_r,f,1);
 update public.fragen set aktiv=true where id=f;
 if not exists(select 1 from public.schiri_fragen_herkunft(s,'942781',array[f]) where herkunft='Aus unserer Schiri-Gruppe') then raise exception 'TEST: Gruppenbadge fehlt'; end if;
 if exists(select 1 from public.schiri_fragen_herkunft(s2,'942782',array[f])) then raise exception 'TEST: Verein übergreifend'; end if;
 -- Manuelle Bearbeitung kann die Kennzeichnung auch nach Ablehnung abschalten.
 perform public.obmann_fragenvorschlag_status_setzen(p,v,'abgelehnt');
 perform public.obmann_frage_redaktion_speichern(p,f,b,i,false,'{}','',meta||'{"gruppe_zeigen":false}');
 if exists(select 1 from public.schiri_fragen_herkunft(s,'942781',array[f])) then raise exception 'TEST: Widerruf unsichtbar'; end if;
 -- Positive Namensfreigabe; alter Antrag ohne Flag erhält keine Zustimmung.
 v2:=public.schiri_fragenvorschlag_speichern(s,'942781',x||'{"herkunft_name":true}',
 'Eine weitere ausreichend ausführliche Begründung für den isolierten Test.','Isolierter Regelbeleg zum Testen.',null,true);
 select aktualisiert_am into zeit from public.fragenvorschlaege where id=v2;
 f2:=public.obmann_frage_redaktion_speichern(p,null,b,i,false,'{}','',jsonb_build_object('vorschlag_id',v2,'vorschlag_stand',zeit,'gruppe_zeigen',true,'name_zeigen',true));
 if (public.obmann_frage_herkunft(p,f2)->>'freigegebener_name') is distinct from ('Test Vorschlag '||s) then raise exception 'TEST: Namensfreigabe fehlt'; end if;
 -- Gleiche Frage, anderer Verein: unabhängige manuelle Kennzeichnung, keine Übernahme des Namens.
 perform public.obmann_frage_redaktion_speichern(p||'-fremd',f2,b,i,false,'{}','', '{"gruppe_zeigen":true,"name_zeigen":false}');
 if public.obmann_frage_herkunft(p||'-fremd',f2)->>'freigegebener_name' is not null then raise exception 'TEST: Namensübernahme aus anderem Verein'; end if;
 j:=public.meine_wochenserie_mit_joker(s,'942781');
 if jsonb_array_length(j->'joker')<>1 then raise exception 'TEST: Geschenk fehlt'; end if;
 j:=public.meine_wochenserie_mit_joker(s,'942781');
 if (select count(*) from public.geburtstagsjoker where schiedsrichter_id=s)<>1 then raise exception 'TEST: Doppelgeschenk'; end if;
 begin perform public.geburtstagsjoker_einloesen(s,'942781',live_r); raise exception 'TEST: laufende Woche';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 j:=public.geburtstagsjoker_einloesen(s,'942781',r);
 if jsonb_array_length(j->'joker')<>0 then raise exception 'TEST: Joker nicht verbraucht'; end if;
 if not exists(select 1 from jsonb_array_elements(j->'wochen') w where w->>'runde_id'=r::text and w->>'joker_gerettet'='true' and w->>'beantwortet'='0') then raise exception 'TEST: Rettung verändert Antworten'; end if;
 begin perform public.geburtstagsjoker_einloesen(s,'942781',r); raise exception 'TEST: Doppelte Einlösung';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 begin perform public.meine_wochenserie_mit_joker(s,'falsch'); raise exception 'TEST: Falsche PIN';
 exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
 if jsonb_array_length(public.meine_wochenserie_mit_joker(s2,'942782')->'joker')<>0 then raise exception 'TEST: Geburtstag erfunden'; end if;
 if has_table_privilege('anon','public.geburtstagsjoker','SELECT') or has_table_privilege('authenticated','public.frage_herkunft','UPDATE') then raise exception 'TEST: direkte Tabellenrechte'; end if;
end $$;
select 'Vorschläge, Herkunft und Joker: Rollbacktests bestanden' as ergebnis;
