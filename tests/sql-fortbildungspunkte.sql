-- Run only via the database test connection. All fixtures are rolled back.
-- Credentials are read inside the transaction, never printed or committed.
begin;
do $$
declare
  v_pass text; v_verein uuid; v_person uuid; v_fremd uuid; v_pin text;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_jahr int; v_saison text; v_id uuid; v_zukunft uuid; v_stand jsonb;
  v_abgewiesen boolean;
begin
  select z.passwort,z.verein_id into v_pass,v_verein from public.obmann_zugang z
    join public.schiedsrichter s on s.verein_id=z.verein_id
    where s.aktiv and not s.ist_test limit 1;
  select s.id,s.pin into v_person,v_pin from public.schiedsrichter s
    where s.verein_id=v_verein and s.aktiv and not s.ist_test limit 1;
  select s.id into v_fremd from public.schiedsrichter s where s.verein_id<>v_verein and not s.ist_test limit 1;
  assert v_pass is not null and v_person is not null and v_fremd is not null, 'Missing test participants';
  v_jahr:=extract(year from v_heute)::int-case when extract(month from v_heute)<7 then 1 else 0 end;
  v_saison:=v_jahr||'/'||right((v_jahr+1)::text,2);
  v_id:=public.obmann_termin_mit_punkten_speichern(v_pass,'ROLLBACK HRT',v_heute,false,'hausregeltest',false,true,'verein','beide',
    p_sichtbarkeit=>'nur_verein',p_punkte_saison=>v_saison,p_punkte_art=>'hrt',p_zeitraum_von=>greatest(v_heute-9,make_date(v_jahr,7,1)));
  assert (select not rueckmeldung_erforderlich and beginn_zeit is null and erinnerung_modus='aus' from public.termine where id=v_id);
  -- No automatic credit simply because the event exists.
  v_stand:=public.meine_fortbildungspunkte(v_person,v_pin,v_saison);
  assert exists(select 1 from jsonb_array_elements(v_stand->'termine') t where t->>'id'=v_id::text and t->>'gewertet'='false');
  -- Mixed-tenant bulk input is rejected atomically, including earlier entries.
  v_abgewiesen:=false;
  begin
    perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(
      jsonb_build_object('id',v_person,'gewertet',true,'version',0),jsonb_build_object('id',v_fremd,'gewertet',true,'version',0)));
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  assert not exists(select 1 from public.fortbildung_nachweise where termin_id=v_id);
  perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',true,'version',0)));
  perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',true,'version',1)));
  assert (select count(*)=1 from public.fortbildung_korrekturen where termin_id=v_id);
  -- Date and period can change together without the legacy intermediate update breaking them.
  perform public.obmann_termin_mit_punkten_speichern(v_pass,'ROLLBACK HRT edited',greatest(v_heute-2,make_date(v_jahr,7,1)),false,'hausregeltest',false,false,'verein','aus',
    p_sichtbarkeit=>'nur_app',p_termin_id=>v_id,p_punkte_saison=>v_saison,p_punkte_art=>'hrt',p_zeitraum_von=>greatest(v_heute-4,make_date(v_jahr,7,1)));
  assert (select datum=greatest(v_heute-2,make_date(v_jahr,7,1)) from public.termine where id=v_id);
  v_stand:=public.meine_fortbildungspunkte(v_person,v_pin,v_saison);
  assert exists(select 1 from jsonb_array_elements(v_stand->'termine') t where t->>'id'=v_id::text and t->>'termin_sichtbar'='false' and t->>'gewertet'='true');
  v_abgewiesen:=false;
  begin perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',false,'version',0)),'Stale');
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  v_abgewiesen:=false;
  begin perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',false,'version',1)));
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  perform public.obmann_fortbildung_bestaetigen(v_pass,v_id,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',false,'version',1)),'DFBnet-Korrektur');
  assert (select version=2 and not gewertet from public.fortbildung_nachweise where termin_id=v_id and schiedsrichter_id=v_person);
  v_abgewiesen:=false;
  begin perform public.meine_fortbildungspunkte(v_person,v_pin||'-invalid-test',v_saison);
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  v_abgewiesen:=false;
  begin perform public.obmann_fortbildung_termin(v_pass||'-invalid-test',v_id);
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  v_abgewiesen:=false;
  begin perform public.obmann_termin_mit_punkten_speichern(v_pass,'ROLLBACK invalid period',v_heute,false,'hausregeltest',false,false,'verein','aus',
    p_sichtbarkeit=>'nur_app',p_punkte_saison=>v_saison,p_punkte_art=>'hrt',p_zeitraum_von=>make_date(v_jahr,6,30));
  exception when others then v_abgewiesen:=true; end;
  assert v_abgewiesen;
  if v_heute+1<make_date(v_jahr+1,7,1) then
    v_zukunft:=public.obmann_termin_mit_punkten_speichern(v_pass,'ROLLBACK future RLA',v_heute+1,false,'lehrabend',false,false,'verein','aus',
      p_sichtbarkeit=>'nur_app',p_punkte_saison=>v_saison,p_punkte_art=>'rla');
    v_abgewiesen:=false;
    begin perform public.obmann_fortbildung_bestaetigen(v_pass,v_zukunft,jsonb_build_array(jsonb_build_object('id',v_person,'gewertet',true,'version',0)));
    exception when others then v_abgewiesen:=true; end;
    assert v_abgewiesen;
    v_stand:=public.meine_fortbildungspunkte(v_person,v_pin,v_saison);
    assert not exists(select 1 from jsonb_array_elements(v_stand->'termine') t where t->>'id'=v_zukunft::text), 'Unpublished offers must stay out of personal website calendar';
  end if;
  assert not has_function_privilege('anon','public.fortbildung_person_stand(uuid,text)','EXECUTE');
  assert not has_table_privilege('anon','public.fortbildung_nachweise','SELECT');
  assert not has_table_privilege('authenticated','public.fortbildung_korrekturen','SELECT');
  assert has_function_privilege('anon','public.meine_fortbildungspunkte(uuid,text,text)','EXECUTE');
  assert has_function_privilege('authenticated','public.obmann_fortbildung_bestaetigen(text,uuid,jsonb,text)','EXECUTE');
end $$;
rollback;
