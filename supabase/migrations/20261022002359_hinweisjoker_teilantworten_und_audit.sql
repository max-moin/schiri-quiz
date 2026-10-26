-- Applied as 20261022002359.
alter table private.quiz_hinweis_einsaetze add column antwort_vorher jsonb not null default '{}';
create function private.hinweis_strafentext(p_frage uuid) returns text
language plpgsql stable set search_path='' as $$
declare l public.frage_entscheidungsloesungen; e jsonb; teile text[]:='{}'; t text;
begin
 select * into l from public.frage_entscheidungsloesungen where frage_id=p_frage;
 for e in select value from jsonb_array_elements(public.entscheidung_strafen_liste(p_frage)) loop
  t:=case e->>'strafe' when 'gelb' then 'Gelbe Karte' when 'gelb_rot' then 'Gelb-Rote Karte' when 'rot' then 'Rote Karte' else 'Keine persönliche Strafe' end;
  if l.fordert_strafe_mannschaft and e->>'fuer_mannschaft' is not null then t:=t||' für '||case e->>'fuer_mannschaft' when 'heim' then 'Heim' else 'Gast' end; end if;
  if l.fordert_strafe_rolle and e->>'strafe_fuer_rolle' is not null then t:=t||' ('||case e->>'strafe_fuer_rolle' when 'feldspieler' then 'Feldspieler' when 'torwart' then 'Torwart' when 'trainer' then 'Trainer/Betreuer' when 'auswechselspieler' then 'Auswechselspieler' else e->>'strafe_fuer_rolle' end||')'; end if;
  if l.fordert_strafe_nummer and e->>'rueckennummer' is not null then t:=t||' Nr. '||(e->>'rueckennummer'); end if;
  teile:=array_append(teile,t);
 end loop;
 return 'Persönliche Strafe: '||coalesce(array_to_string(teile,'; '),'Keine persönliche Strafe');
end $$;
revoke all on function private.hinweis_strafentext(uuid) from public,anon,authenticated;
do $migration$
declare d text; alter_text text;
begin
 d:=pg_get_functiondef('public.quiz_hinweisjoker(uuid,text,uuid,text,jsonb)'::regprocedure);
 d:=replace(d,'v:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);',
  'v:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin); if jsonb_typeof(p_antwort) is distinct from ''object'' or length(p_antwort::text)>4000 then raise exception ''Ungültiger Antwortstand''; end if;');
 alter_text:='public.entscheidung_anzeige(jsonb_build_object(''persoenliche_strafe'',l.persoenliche_strafe,''strafe_fuer_mannschaft'',l.strafe_fuer_mannschaft,''strafe_fuer_rolle'',l.strafe_fuer_rolle,''strafe_rueckennummer'',l.strafe_rueckennummer))';
 if position(alter_text in d)=0 then raise exception 'Unexpected card hint'; end if;
 d:=replace(d,alter_text,'private.hinweis_strafentext(p_frage_id)');
 d:=replace(d,'insert into private.quiz_hinweis_einsaetze(person,frage,typ,joker,hinweis) values(p_schiedsrichter_id,p_frage_id,p_typ,j,h);',
  'insert into private.quiz_hinweis_einsaetze(person,frage,typ,joker,hinweis,antwort_vorher) values(p_schiedsrichter_id,p_frage_id,p_typ,j,h,coalesce((select jsonb_object_agg(key,value) from jsonb_each(p_antwort) where key in (''spielfortsetzung'',''fortsetzung_fuer'',''fortsetzung_ort'',''persoenliche_strafe'',''strafe_fuer_mannschaft'',''strafe_fuer_rolle'',''strafe_rueckennummer'',''strafen'',''begruendung'',''freitext'')),''{}''));');
 if position('antwort_vorher)' in d)=0 then raise exception 'Unexpected hint insert'; end if;
 execute d;
 d:=pg_get_functiondef('public.obmann_joker_verlauf(text,text)'::regprocedure);
 d:=replace(d,'''hinweis'',h.hinweis)',
  '''hinweis'',h.hinweis,''antwort_vorher_text'',case when h.antwort_vorher=''{}''::jsonb then null when h.antwort_vorher ? ''freitext'' then h.antwort_vorher->>''freitext'' else public.entscheidung_anzeige(h.antwort_vorher) end)');
 if position('antwort_vorher_text' in d)=0 then raise exception 'Unexpected hint audit'; end if;
 execute d;
end $migration$;
notify pgrst,'reload schema';
