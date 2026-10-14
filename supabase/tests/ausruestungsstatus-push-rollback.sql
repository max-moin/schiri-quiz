begin;
do $$
declare v uuid; f uuid; s uuid; andere uuid; b uuid; a uuid; a2 uuid; e uuid; e2 uuid; alt uuid;
  auftrag uuid; geraet uuid; n int; pin text:='rollback-push-'||gen_random_uuid();
begin
  if exists(select 1 from public.schiri_push_praeferenzen where ausruestung_status) then
    raise exception 'Echte Opt-ins vorhanden: globalen Claimtest nicht ausführen'; end if;
  insert into public.vereine(name) values('Rollback-Ausrüstung-'||gen_random_uuid()) returning id into v;
  insert into public.vereine(name) values('Rollback-Ausrüstung-Fremd-'||gen_random_uuid()) returning id into f;
  insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Push-Privat',pin,v) returning id into s;
  insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Push-Fremd',pin,f) returning id into andere;
  perform public.schiri_push_auswahl_v2_setzen(s,pin,false,false,false,false,true);
  if not (public.schiri_push_einstellungen(s,pin)->>'ausruestung_status')::boolean then raise exception 'Opt-in fehlt'; end if;
  begin perform public.schiri_push_auswahl_v2_setzen(s,'falsch',false,false,false,false,true);
    raise exception 'Falsche PIN akzeptiert';
  exception when others then if sqlerrm='Falsche PIN akzeptiert' then raise; end if; end;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth,geraet,gueltig_bis)
    values(s,v,'https://web.push.apple.com/rollback-'||gen_random_uuid(),'synthetischer-schluessel','synthetischer-schluessel','Rollback-Gerät',now()+interval '1 day') returning id into geraet;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth,geraet,gueltig_bis)
    values(andere,f,'https://web.push.apple.com/rollback-'||gen_random_uuid(),'synthetischer-schluessel','synthetischer-schluessel','Fremdes Gerät',now()+interval '1 day');
  -- Realistische Freigabezeit simulieren, ohne 30 Sekunden zu warten.
  update public.schiri_push_praeferenzen set ausruestung_aktiviert_am=now()-interval '1 hour' where schiedsrichter_id=s;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,prozess_status)
    values(s,'trikot','geprueft') returning id into a;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a,v,'geprueft','obmann','rollback-'||gen_random_uuid(),now()-interval '2 minutes') returning id into e;
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>1 then raise exception 'Eigener Kandidat fehlt'; end if;
  perform public.schiri_push_ausruestung_einreihen(); perform public.schiri_push_ausruestung_einreihen();
  select count(*) into n from public.benachrichtigungs_ereignisse where schluessel='ausruestung.push:'||e::text;
  if n<>1 then raise exception 'Doppeltes Ereignis'; end if;
  select q.auftrag_id into auftrag from public.schiri_push_ausruestung_auftraege_beanspruchen(10) q;
  if auftrag is null then raise exception 'Claim fehlt'; end if;
  select count(*) into n from public.schiri_push_ausruestung_zustellliste(auftrag); if n<>1 then raise exception 'Fremdes Gerät im Versand'; end if;
  -- Späterer Stand macht selbst einen bereits beanspruchten Auftrag ungültig.
  update public.ausruestungs_anfragen set prozess_status='vorgelegt' where id=a;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a,v,'vorgelegt','obmann','rollback-'||gen_random_uuid(),now()-interval '1 minute') returning id into e2;
  select count(*) into n from public.schiri_push_ausruestung_zustellliste(auftrag); if n<>0 then raise exception 'Veralteter Stand zugestellt'; end if;
  perform public.schiri_push_ausruestung_einreihen();
  perform public.schiri_push_auswahl_v2_setzen(s,pin,false,false,false,false,false);
  select count(*) into n from public.benachrichtigungs_auftraege q join public.benachrichtigungs_ereignisse x on x.id=q.ereignis_id
    where x.typ='ausruestung.status' and q.empfaenger_schluessel='s_'||s::text and q.status<>'aufgegeben';
  if n<>0 then raise exception 'Widerruf nicht vollständig'; end if;
  perform public.schiri_push_auswahl_v2_setzen(s,pin,false,false,false,false,true);
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>0 then raise exception 'Alte Updates nach Einschalten'; end if;
  -- Bündel: eine Freigabe + eine Ablehnung erst nach vollständigem Entscheid.
  update public.schiri_push_praeferenzen set ausruestung_aktiviert_am=now()-interval '1 hour' where schiedsrichter_id=s;
  delete from public.ausruestungs_anfragen where id=a;
  insert into public.ausruestungs_buendel(schiedsrichter_id,absende_id,beschaffungsweg,positionen_anzahl,inhalt_abdruck)
    values(s,gen_random_uuid(),'weg2_schiri_besorgt',2,'rollback') returning id into b;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status)
    values(s,'trikot',b,1,'freigegeben','freigegeben') returning id into a;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status)
    values(s,'trikot',b,2,'vorgelegt') returning id into a2;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a,v,'freigegeben','vorstand','rollback-'||gen_random_uuid(),now()-interval '2 minutes') returning id into e;
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>0 then raise exception 'Teilentscheidung als Bündel fertig'; end if;
  update public.ausruestungs_anfragen set prozess_status='abgelehnt',freigabe_status='abgelehnt' where id=a2;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a2,v,'abgelehnt','vorstand','rollback-'||gen_random_uuid(),now()-interval '1 minute') returning id into e2;
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>1 then raise exception 'Gemischtes Bündel nicht genau einmal'; end if;
  select q.auftrag_id into auftrag from public.schiri_push_ausruestung_auftraege_beanspruchen(10) q;
  if auftrag is null then raise exception 'Bündelclaim fehlt'; end if;
  select count(*) into n from public.schiri_push_ausruestung_zustellliste(auftrag); if n<>1 then raise exception 'Bündelversand falsch'; end if;
  update public.schiedsrichter set aktiv=false where id=s;
  select count(*) into n from public.schiri_push_ausruestung_zustellliste(auftrag); if n<>0 then raise exception 'Inaktive Person erhält Push'; end if;
  update public.schiedsrichter set aktiv=true where id=s;
  -- Zahlung für ein Bündel erst vollständig, keine eigene Empfangsaktion als Push.
  update public.ausruestungs_anfragen set prozess_status='freigegeben',freigabe_status='freigegeben' where id=a2;
  update public.ausruestungs_anfragen set prozess_status='zahlung_angewiesen' where id=a;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a,v,'zahlung_angewiesen','vorstand','rollback-'||gen_random_uuid(),now()-interval '55 seconds');
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>0 then raise exception 'Teilzahlung als vollständig'; end if;
  update public.ausruestungs_anfragen set prozess_status='zahlung_angewiesen' where id=a2;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a2,v,'zahlung_angewiesen','vorstand','rollback-'||gen_random_uuid(),now()-interval '45 seconds');
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>1 then raise exception 'Bündelzahlung fehlt'; end if;
  update public.ausruestungs_anfragen set prozess_status='geld_erhalten' where id=a2;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a2,v,'geld_erhalten','schiri','rollback-'||gen_random_uuid(),now()-interval '35 seconds');
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>0 then raise exception 'Eigene Aktion holt alte Fremdaktion hervor'; end if;
  -- Kurze Updates warten den Sammelpuffer ab.
  update public.ausruestungs_anfragen set prozess_status='abgeschlossen' where id=a2;
  insert into public.ausruestung_ereignisse(anfrage_id,verein_id,schritt,akteur_rolle,schluessel,erstellt_am)
    values(a2,v,'abgeschlossen','obmann','rollback-'||gen_random_uuid(),now()-interval '10 seconds');
  select count(*) into n from public.schiri_push_ausruestung_kandidaten(); if n<>0 then raise exception 'Sammelpuffer fehlt'; end if;
  if has_function_privilege('anon','public.schiri_push_ausruestung_zustellliste(uuid)','execute')
    or has_function_privilege('anon','public.schiri_push_ausruestung_auftraege_beanspruchen(integer)','execute')
    or has_function_privilege('anon','public.obmann_push_geraete_v2(text)','execute') then raise exception 'Serverfunktion öffentlich'; end if;
end $$;
select 'Opt-in/PIN, eigener Empfänger, Idempotenz, aktueller Stand, Widerruf, kein Nachsenden, gemischtes Bündel, vollständige Zahlung, keine Eigenaktion, Sammelpuffer, Inaktivfilter und Rechte geprüft' as ergebnis;
rollback;
