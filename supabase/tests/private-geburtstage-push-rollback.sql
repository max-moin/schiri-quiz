begin;
do $$
declare v uuid; fremd uuid; s uuid; inactive uuid; t uuid; fremder uuid; a uuid; fa uuid;
  geheim text:='rollback-geburtstag-'||gen_random_uuid(); n int; d date;
begin
  if public.geburtstag_naechster('2000-10-15','2026-10-13')<>'2026-10-15' then raise exception 'Datum falsch'; end if;
  if public.geburtstag_naechster('2000-01-01','2026-12-31')<>'2027-01-01' then raise exception 'Jahreswechsel falsch'; end if;
  if public.geburtstag_naechster('2000-02-29','2026-01-01')<>'2028-02-29' then raise exception 'Schalttag erfunden'; end if;
  insert into public.vereine(name) values('Rollback-Geburtstage-'||gen_random_uuid()) returning id into v;
  insert into public.vereine(name) values('Rollback-Geburtstage-Fremd-'||gen_random_uuid()) returning id into fremd;
  insert into public.obmann_zugang(id,passwort,verein_id)
    select coalesce(max(id),0)+1,geheim,v from public.obmann_zugang;
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum) values('Rollback-Aktiv','test',v,'2000-10-15') returning id into s;
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum,aktiv) values('Rollback-Inaktiv','test',v,'2000-10-15',false) returning id into inactive;
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum,ist_test) values('Rollback-Test','test',v,'2000-10-15',true) returning id into t;
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum) values('Rollback-Fremd','test',fremd,'2000-10-15') returning id into fremder;
  select count(*) into n from public.obmann_geburtstage(geheim);
  if n<>1 then raise exception 'Geburtstagsfilter falsch'; end if;
  begin
    perform * from public.obmann_geburtstage('ungueltiger-rollback-zugang');
    raise exception 'Falscher Zugang akzeptiert';
  exception when others then if sqlerrm='Falscher Zugang akzeptiert' then raise; end if; end;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth,geraet,gueltig_bis)
    values(s,v,'https://web.push.apple.com/rollback-'||gen_random_uuid(),'nur-synthetisch','nur-synthetisch','Testgerät',now()+interval '1 day') returning id into a;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth,geraet,gueltig_bis)
    values(fremder,fremd,'https://web.push.apple.com/rollback-'||gen_random_uuid(),'nur-synthetisch','nur-synthetisch','Fremdes Testgerät',now()+interval '1 day') returning id into fa;
  select count(*) into n from public.obmann_push_geraete(geheim);
  if n<>1 then raise exception 'Fremde Geräte sichtbar'; end if;
  begin
    perform * from public.obmann_push_test_abo(geheim,fa); raise exception 'Fremdes Gerät erlaubt';
  exception when others then if sqlerrm='Fremdes Gerät erlaubt' then raise; end if; end;
  begin
    perform * from public.obmann_push_test_abo(geheim,a); raise exception 'Test ohne Themenwahl erlaubt';
  exception when others then if sqlerrm='Test ohne Themenwahl erlaubt' then raise; end if; end;
  insert into public.schiri_push_praeferenzen(schiedsrichter_id,quiz_neu) values(s,true);
  select count(*) into n from public.obmann_push_test_abo(geheim,a);
  if n<>1 then raise exception 'Gezieltes Gerät nicht gefunden'; end if;
  begin
    perform * from public.obmann_push_test_abo(geheim,a); raise exception 'Rate Limit fehlt';
  exception when others then if sqlerrm='Rate Limit fehlt' then raise; end if; end;
  if has_function_privilege('anon','public.obmann_push_test_abo(text,uuid)','execute')
    or has_function_privilege('anon','public.obmann_push_geraete(text)','execute')
    or has_function_privilege('anon','public.obmann_geburtstagsmails_einreihen(timestamptz)','execute') then raise exception 'Private RPC öffentlich'; end if;
  if not has_function_privilege('service_role','public.obmann_push_test_abo(text,uuid)','execute') then raise exception 'Serverrecht fehlt'; end if;
end $$;
-- Mailplanung ausschließlich innerhalb der Rollback-Transaktion; kein Netzversand.
do $$
declare v uuid; s uuid; sommer uuid; e uuid; n int;
begin
  select id into v from public.vereine where oeffentliche_kennung='loebtauer-kickers';
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum)
    values('Rollback-Geburtstagsmail-'||gen_random_uuid(),'synthetisch',v,'1900-11-17') returning id into s;
  insert into public.schiedsrichter(name,pin,verein_id,geburtsdatum)
    values('Rollback-Geburtstagsmail-Sommer-'||gen_random_uuid(),'synthetisch',v,'1900-07-17') returning id into sommer;
  perform public.obmann_geburtstagsmails_einreihen('2027-11-17 07:59:00+00');
  if exists(select 1 from public.benachrichtigungs_ereignisse where referenz_id=s) then raise exception 'Zu früh verschickt'; end if;
  perform public.obmann_geburtstagsmails_einreihen('2027-11-17 08:00:00+00');
  perform public.obmann_geburtstagsmails_einreihen('2027-11-17 08:05:00+00');
  select id into e from public.benachrichtigungs_ereignisse where referenz_id=s and typ='geburtstag.heute';
  if e is null then raise exception 'Winterzeit fehlt'; end if;
  select count(*) into n from public.benachrichtigungs_auftraege where ereignis_id=e;
  if n<>1 then raise exception 'Mail nicht genau einmal'; end if;
  perform public.obmann_geburtstagsmails_einreihen('2027-07-17 07:00:00+00');
  if not exists(select 1 from public.benachrichtigungs_ereignisse where referenz_id=sommer and typ='geburtstag.heute') then raise exception 'Sommerzeit fehlt'; end if;
end $$;
select 'Kalender, aktive/eigene Personen, Auth, Geräte-Opt-in, Rate Limit, Rechte, Berlin 09 Uhr und Mail-Deduplizierung geprüft' as ergebnis;
rollback;
