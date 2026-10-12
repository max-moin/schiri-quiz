-- Rollback-Regression: keine Testanfragen oder E-Mails bleiben bestehen.
begin;
do $test$
declare s uuid; v uuid; b uuid; a uuid; c uuid; n integer;
begin
  select id,verein_id into s,v from public.schiedsrichter order by id limit 1;
  if s is null then raise exception 'Test benötigt einen vorhandenen Schiri'; end if;
  insert into public.ausruestungs_buendel(schiedsrichter_id,absende_id,beschaffungsweg,positionen_anzahl,inhalt_abdruck)
  values(s,gen_random_uuid(),'weg2_schiri_besorgt',2,'rollback-test') returning id into b;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status,vorlage_am,vorlage_preis_cent)
  values(s,'trikot',b,1,'vorgelegt','vorgelegt',now(),3500) returning id into a;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status,vorlage_am,vorlage_preis_cent)
  values(s,'hose',b,2,'vorgelegt','vorgelegt',now(),2000) returning id into c;
  perform public.ausruestung_uebergang(a,'freigegeben','vorstand','Rollback Test');
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id=b;
  if n<>0 then raise exception 'Teilentscheidung erzeugt eine Mail'; end if;
  perform public.ausruestung_uebergang(c,'abgelehnt','vorstand','Rollback Test','Nicht erforderlich');
  perform public.benachrichtigung_buendel_pruefen();
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse
   where referenz_id=b and metadaten->>'buendel_phase'='entscheidung'
     and metadaten->>'freigegeben'='1' and metadaten->>'abgelehnt'='1';
  if n<>1 then raise exception 'Gemischtes Bündel braucht genau ein Ereignis, gefunden %',n; end if;
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id in(a,c)
    and typ in('ausruestung.freigegeben','ausruestung.abgelehnt');
  if n<>0 then raise exception 'Artikelmails wurden zusätzlich erzeugt'; end if;
  -- Derselbe Abschluss wird erneut geprüft: identischer Schlüssel statt Duplikat.
  insert into public.benachrichtigung_buendel_pruefungen(buendel_id,phase) values(b,'entscheidung');
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id=b;
  if n<>1 then raise exception 'Wiederholung erzeugt Duplikat'; end if;
  -- Zwei bewilligte Selbstkaufpositionen: auch Zahlungen einzeln bearbeitbar,
  -- aber erst nach der letzten Zahlung eine gemeinsame Obmann-Mitteilung.
  insert into public.ausruestungs_buendel(schiedsrichter_id,absende_id,beschaffungsweg,positionen_anzahl,inhalt_abdruck)
  values(s,gen_random_uuid(),'weg2_schiri_besorgt',2,'rollback-zahlung') returning id into b;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status,beschaffungsweg,vorlage_preis_cent)
  values(s,'trikot',b,1,'zahlung_beauftragt','freigegeben','weg2_schiri_besorgt',3500) returning id into a;
  insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status,beschaffungsweg,vorlage_preis_cent)
  values(s,'hose',b,2,'zahlung_beauftragt','freigegeben','weg2_schiri_besorgt',2000) returning id into c;
  perform public.ausruestung_uebergang(a,'zahlung_angewiesen','vorstand','Rollback Test');
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id=b;
  if n<>0 then raise exception 'Teilzahlung erzeugt eine Mail'; end if;
  perform public.ausruestung_uebergang(c,'zahlung_angewiesen','vorstand','Rollback Test');
  perform public.benachrichtigung_buendel_pruefen();
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse
   where referenz_id=b and typ='ausruestung.zahlung_angewiesen' and metadaten->>'anzahl'='2';
  if n<>1 then raise exception 'Sammelzahlung braucht genau ein Ereignis'; end if;
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id in(a,c) and typ='ausruestung.zahlung_angewiesen';
  if n<>0 then raise exception 'Artikel-Zahlungsmails wurden zusätzlich erzeugt'; end if;
  if has_function_privilege('anon','public.benachrichtigung_buendel_pruefen()','EXECUTE')
    or has_function_privilege('authenticated','public.benachrichtigung_buendel_pruefen()','EXECUTE')
    or has_table_privilege('anon','public.benachrichtigung_buendel_pruefungen','SELECT') then
    raise exception 'Interner Versand ist öffentlich erreichbar';
  end if;
end $test$;
-- Viele alte unvollständige Bündel dürfen ein später fertiges nicht blockieren.
do $fairness$
declare s uuid; b uuid; fertig uuid; i integer; n integer;
begin
  select id into s from public.schiedsrichter order by id limit 1;
  for i in 1..51 loop
    insert into public.ausruestungs_buendel(schiedsrichter_id,absende_id,beschaffungsweg,positionen_anzahl,inhalt_abdruck)
    values(s,gen_random_uuid(),'weg2_schiri_besorgt',1,'rollback-fairness') returning id into b;
    insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,buendel_id,buendel_position,prozess_status,freigabe_status)
    values(s,'trikot',b,1,case when i=51 then 'abgelehnt' else 'vorgelegt' end,case when i=51 then 'abgelehnt' else 'vorgelegt' end);
    insert into public.benachrichtigung_buendel_pruefungen(buendel_id,phase,erstellt_am)
    values(b,'entscheidung',now()-make_interval(mins=>52-i));
    if i=51 then fertig:=b; end if;
  end loop;
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id=fertig;
  if n<>0 then raise exception 'Batch-Grenze im Test nicht erreicht'; end if;
  perform public.benachrichtigung_buendel_pruefen();
  select count(*) into n from public.benachrichtigungs_ereignisse where referenz_id=fertig;
  if n<>1 then raise exception 'Alte offene Bündel blockieren späteren Abschluss'; end if;
end $fairness$;
rollback;
