-- Ausschließlich synthetisch und vollständig zurückrollen.
begin;
do $$
declare v uuid; s uuid; fremd uuid; r uuid; f uuid; f2 uuid; rollen text[]:=array['feldspieler','torwart','auswechselspieler','einwechselspieler','trainer_einzeln','betreuer']; a text; b text;
begin
  foreach a in array rollen loop
    foreach b in array rollen loop
      if public.entscheidung_teilnote_rolle(a,array[b]) is distinct from (a=b) then raise exception 'Rollen nicht getrennt: %/%',a,b; end if;
    end loop;
  end loop;
  if not public.entscheidung_teilnote_rolle('trainer_einzeln',array['trainer'])
    or not public.entscheidung_teilnote_rolle('betreuer',array['trainer'])
    or public.entscheidung_teilnote_rolle('trainer',array['trainer_einzeln'])
    or public.entscheidung_teilnote_rolle('einwechselspieler',array['auswechselspieler']) then raise exception 'Altrollen-Kompatibilität falsch'; end if;
  if public.entscheidung_anzeige('{"persoenliche_strafe":"rot","strafe_fuer_rolle":"betreuer"}') not like '%Betreuer%' then raise exception 'Rollentext fehlt'; end if;
  insert into public.vereine(name) values('Rollback-Sammlung-'||gen_random_uuid()) returning id into v;
  insert into public.schiedsrichter(name,pin,verein_id,erstellt_am,ist_test)
    values('Rollback-Sammlung','nur-sammlung-rollback',v,now()-interval '30 days',true) returning id into s;
  insert into public.schiedsrichter(name,pin,verein_id,ist_test)
    values('Andere Testperson','fremd-sammlung',v,true) returning id into fremd;
  insert into public.runden(bezeichnung,startet_am,endet_am) values('Rollback-Sammlung',now()-interval '7 days',now()-interval '1 day') returning id into r;
  insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option,regel_nummer)
    values('Rollback-Sammelfrage','multiple_choice','text','multiple_choice','a','b','c','a',3) returning id into f;
  insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option,regel_nummer)
    values('Rollback-Sammelfrage-zwei','multiple_choice','text','multiple_choice','a','b','c','a',11) returning id into f2;
  insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,1),(v,r,f2,2);
  insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,bewertungsstatus,beantwortet_am)
    values(s,f,'a',true,'richtig',now()-interval '2 days'),(s,f2,'b',false,'falsch',now()-interval '2 days'),(fremd,f2,'a',true,'richtig',now()-interval '2 days');
  insert into public.historie_antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt) values(s,f,'a',true),(s,f,'a',true),(s,f2,'a',true);
  foreach a in array rollen loop
    perform public.frage_entscheidungsloesung_setzen(f,jsonb_build_object('fordert_fortsetzung',false,'fordert_strafe',true,'persoenliche_strafe','rot','fordert_strafe_mannschaft',false,'fordert_strafe_rolle',true,'fordert_strafe_nummer',false,'strafe_fuer_rolle',a,'strafe_rollen_gueltig',jsonb_build_array(a),'strafen',jsonb_build_array(jsonb_build_object('strafe','rot','strafe_fuer_rolle',a,'rollen_gueltig',jsonb_build_array(a)))));
    if public.entscheidung_strafen_liste(f)#>>'{0,strafe_fuer_rolle}' is distinct from a then raise exception 'Neue Rolle nicht gespeichert: %',a; end if;
  end loop;
  perform set_config('test.sammel_person',s::text,true);perform set_config('test.sammel_fremd',fremd::text,true);perform set_config('test.sammel_runde',r::text,true);
end $$;
set local role anon;
do $$
declare s uuid:=current_setting('test.sammel_person')::uuid; x jsonb;
begin
  x:=public.meine_sammelstatistik(s,'nur-sammlung-rollback');
  if (x->>'treffer')::int<>2 or x#>>'{regeln,3}'<>'1' or x#>>'{regeln,11}'<>'1' then raise exception 'Doppel-/Fremdtreffer mitgezählt: %',x; end if;
  if x#>>array['wochen_richtig',current_setting('test.sammel_runde')]<>'1' then raise exception 'Übung als perfekte Woche gezählt'; end if;
  begin perform public.meine_sammelstatistik(current_setting('test.sammel_fremd')::uuid,'nur-sammlung-rollback');raise exception 'Fremde PIN zugelassen';
  exception when others then if sqlerrm='Fremde PIN zugelassen' then raise; end if; end;
  begin perform public.meine_sammelstatistik(s,null);raise exception 'Leere PIN zugelassen';
  exception when others then if sqlerrm='Leere PIN zugelassen' then raise; end if; end;
end $$;
reset role;
select 'Rollenmatrix, Altrollen, Schreiben/Lesen, private Aggregate und PIN-Grenzen bestanden' as ergebnis;
rollback;
