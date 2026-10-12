-- Ausschließlich zusammen mit BEGIN/ROLLBACK ausführen. Keine echte Mail/Push.
do $$
declare v_verein uuid; v_fremd uuid; v_person uuid; v_termin uuid; v_andere uuid;
begin
  insert into public.vereine(name) values('Rollback-Push-Test') returning id into v_verein;
  insert into public.vereine(name) values('Rollback-Push-Fremd') returning id into v_fremd;
  insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Schiri','nur-rollback-test',v_verein) returning id into v_person;
  insert into public.termine(verein_id,titel,datum,beginn_zeit,pflicht,erinnerung_modus,sichtbarkeit)
    values(v_verein,'Rollback-Termin',(now() at time zone 'Europe/Berlin')::date+1,'18:00',true,'beide','nur_verein') returning id into v_termin;
  insert into public.termine(verein_id,titel,datum,sichtbarkeit)
    values(v_fremd,'Fremder interner Termin',current_date+1,'nur_verein') returning id into v_andere;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth)
    values(v_person,v_verein,'https://web.push.apple.com/rollback-'||v_person,'test','test');
  perform set_config('test.push_person',v_person::text,true);
  perform set_config('test.push_termin',v_termin::text,true);
  perform set_config('test.push_fremd',v_andere::text,true);
end $$;
set local role anon;
do $$
declare s uuid := current_setting('test.push_person')::uuid;
  t uuid := current_setting('test.push_termin')::uuid;
  f uuid := current_setting('test.push_fremd')::uuid;
  w jsonb;
begin
  w:=public.schiri_push_auswahl_setzen(s,'nur-rollback-test',true,true,false,true);
  if not (w->>'feedback_antwort')::boolean or not (w->>'quiz_neu')::boolean
    or (w->>'quiz_erinnerung')::boolean or not (w->>'termine')::boolean then
    raise exception 'Atomare Auswahl stimmt nicht'; end if;
  begin
    perform public.schiri_push_auswahl_setzen(s,'nur-rollback-test',false,false,null,false);
    raise exception 'Nullwert zugelassen';
  exception when others then
    if sqlerrm='Nullwert zugelassen' then raise; end if;
  end;
  if not (public.schiri_push_einstellungen(s,'nur-rollback-test')->>'feedback_antwort')::boolean then
    raise exception 'Ungültige Auswahl hat Teiländerungen geschrieben'; end if;
  begin
    perform public.schiri_push_termin_setzen(s,'falscher-test-pin',t,false);
    raise exception 'Falsche PIN zugelassen';
  exception when others then
    if sqlerrm='Falsche PIN zugelassen' then raise; end if;
  end;
  begin
    perform public.schiri_push_termin_setzen(s,'nur-rollback-test',f,false);
    raise exception 'Fremder interner Termin zugelassen';
  exception when others then
    if sqlerrm='Fremder interner Termin zugelassen' then raise; end if;
  end;
  w:=public.schiri_push_terminwahl(s,'nur-rollback-test');
  if jsonb_array_length(w->'termine')<>1 then raise exception 'Fremder Termin sichtbar'; end if;
  perform public.schiri_push_termin_setzen(s,'nur-rollback-test',t,false);
  if (public.schiri_push_terminwahl(s,'nur-rollback-test')->'termine'->0->>'ausgewaehlt')::boolean then
    raise exception 'Abwahl nicht gespeichert'; end if;
  begin
    perform * from public.schiri_push_terminausnahmen;
    raise exception 'Direkter Tabellenzugriff erlaubt';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare s uuid := current_setting('test.push_person')::uuid;
  t uuid := current_setting('test.push_termin')::uuid;
  d date := (now() at time zone 'Europe/Berlin')::date+1;
begin
  if public.schiri_push_termin_gueltig(s,t,d,'18:00:00','vortag') then
    raise exception 'Abgewählter Termin versandfähig'; end if;
  perform public.schiri_push_termin_setzen(s,'nur-rollback-test',t,true);
  if not public.schiri_push_termin_gueltig(s,t,d,'18:00:00','vortag') then
    raise exception 'Wieder eingeschalteter Termin ungültig'; end if;
  perform public.schiri_push_auswahl_setzen(s,'nur-rollback-test',true,true,false,false);
  if public.schiri_push_termin_gueltig(s,t,d,'18:00:00','vortag') then
    raise exception 'Globale Abwahl umgangen'; end if;
end $$;
select 'Atomare Auswahl, falsche PIN, Vereinsgrenzen, Tabellenrechte, Abwahl und Wiederaufnahme geprüft' as ergebnis;
