-- Schritt 4: freiwillige Terminerinnerungen. Bestehende Termine bleiben AUS,
-- damit eine Aktivierung des Versandkanals keine Altlasten nachschickt.
alter table public.termine add column if not exists erinnerung_modus text not null default 'aus';
alter table public.termine drop constraint if exists termine_erinnerung_modus_check;
alter table public.termine add constraint termine_erinnerung_modus_check
  check (erinnerung_modus in ('aus','vortag','tag','beide'));

create index if not exists termine_push_datum_idx on public.termine(datum)
  where erinnerung_modus <> 'aus' and sichtbarkeit <> 'nur_app';

-- Neuer atomarer Speichervertrag. Der alte bleibt fuer installierte App-Versionen
-- erhalten und setzt den Erinnerungsmodus beim Bearbeiten nicht zurueck.
create or replace function public.obmann_termin_speichern_mit_erinnerung(
  p_passwort text, p_titel text, p_datum date, p_oeffentlich boolean,
  p_art text, p_pflicht boolean, p_rueckmeldung_erforderlich boolean,
  p_veranstalter text, p_erinnerung_modus text,
  p_sichtbarkeit text default null, p_termin_id uuid default null,
  p_beschreibung text default null, p_beginn_zeit time default null,
  p_ende_zeit time default null, p_ort text default null,
  p_rueckmeldung_bis date default null, p_notiz_obmann text default null
) returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if p_erinnerung_modus not in ('aus','vortag','tag','beide') then
    raise exception 'Ungueltige Terminerinnerung';
  end if;
  v_id := public.obmann_termin_speichern(
    p_passwort => p_passwort, p_titel => p_titel, p_datum => p_datum,
    p_oeffentlich => p_oeffentlich, p_art => p_art, p_pflicht => p_pflicht,
    p_rueckmeldung_erforderlich => p_rueckmeldung_erforderlich,
    p_veranstalter => p_veranstalter, p_sichtbarkeit => p_sichtbarkeit,
    p_termin_id => p_termin_id, p_beschreibung => p_beschreibung,
    p_beginn_zeit => p_beginn_zeit, p_ende_zeit => p_ende_zeit,
    p_ort => p_ort, p_rueckmeldung_bis => p_rueckmeldung_bis,
    p_notiz_obmann => p_notiz_obmann);
  update public.termine set erinnerung_modus = p_erinnerung_modus where id = v_id;
  return v_id;
end $function$;

-- Liste behält alle bisherigen Felder und ergänzt nur die letzte Spalte.
drop function if exists public.obmann_termine_mit_stand(text);
create function public.obmann_termine_mit_stand(p_passwort text)
returns table(id uuid, titel text, datum date, beschreibung text, oeffentlich boolean,
  sichtbarkeit text, beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, veranstalter text, rueckmeldung_erforderlich boolean,
  notiz_obmann text, zusagen integer, absagen integer, offen integer,
  vorbei boolean, laeuft boolean, rueckmeldefrist_abgelaufen boolean,
  hat_protokoll boolean, erinnerung_modus text)
language plpgsql stable security definer set search_path to '' as $function$
declare v_verein uuid; v_aktive integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  select count(*)::integer into v_aktive from public.schiedsrichter s
    where s.verein_id = v_verein and s.aktiv and not s.ist_test;
  return query
  select t.id, t.titel, t.datum, t.beschreibung, t.oeffentlich,
         t.sichtbarkeit, t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.veranstalter, t.rueckmeldung_erforderlich,
         t.notiz_obmann,
         case when t.rueckmeldung_erforderlich then coalesce(z.zu, 0) else 0 end,
         case when t.rueckmeldung_erforderlich then coalesce(z.ab, 0) else 0 end,
         case when t.rueckmeldung_erforderlich
           then greatest(v_aktive - coalesce(z.zu, 0) - coalesce(z.ab, 0), 0) else 0 end,
         public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit) <= now(),
         coalesce(public.termin_beginn_zeitpunkt(t.datum,t.beginn_zeit) <= now(),false)
           and public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit) > now(),
         t.rueckmeldung_bis is not null
           and t.rueckmeldung_bis < (now() at time zone 'Europe/Berlin')::date,
         (nullif(btrim(coalesce(t.protokoll_inhalt,'')),'') is not null
           or t.protokoll_pdf_pfad is not null),
         t.erinnerung_modus
  from public.termine t
  left join (
    select r.termin_id, s.verein_id,
      count(*) filter (where r.status='zu')::integer as zu,
      count(*) filter (where r.status='ab')::integer as ab
    from public.termin_rueckmeldungen r
    join public.schiedsrichter s on s.id=r.schiedsrichter_id
    group by r.termin_id,s.verein_id
  ) z on z.termin_id=t.id and z.verein_id=v_verein
  where t.verein_id=v_verein
  order by t.datum,t.beginn_zeit nulls last;
end $function$;

create or replace function public.schiri_push_einstellungen(
  p_schiedsrichter_id uuid, p_pin text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_wahl public.schiri_push_praeferenzen%rowtype; v_geraete jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select * into v_wahl from public.schiri_push_praeferenzen p
    where p.schiedsrichter_id=p_schiedsrichter_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'endpunkt',a.endpunkt,'geraet',a.geraet,
    'erstellt_am',a.erstellt_am,'zuletzt_bestaetigt',a.zuletzt_bestaetigt,
    'gueltig_bis',a.gueltig_bis) order by a.zuletzt_bestaetigt desc),'[]'::jsonb)
    into v_geraete from public.push_abos a
    where a.schiedsrichter_id=p_schiedsrichter_id and a.gueltig_bis>now();
  return jsonb_build_object(
    'feedback_antwort',coalesce(v_wahl.feedback_antwort,false),
    'quiz_neu',coalesce(v_wahl.quiz_neu,false),
    'quiz_erinnerung',coalesce(v_wahl.quiz_erinnerung,false),
    'termine',coalesce(v_wahl.termine,false),'geraete',v_geraete);
end $function$;

create or replace function public.schiri_push_termine_setzen(
  p_schiedsrichter_id uuid,p_pin text,p_aktiv boolean
) returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_aktiv is null then raise exception 'Auswahl fehlt'; end if;
  insert into public.schiri_push_praeferenzen(schiedsrichter_id,termine)
    values(p_schiedsrichter_id,p_aktiv)
  on conflict(schiedsrichter_id) do update set
    termine=excluded.termine,aktualisiert_am=now();
  if not p_aktiv then
    update public.benachrichtigungs_auftraege a
      set status='aufgegeben',letzter_fehlercode='einwilligung_widerrufen',
          gesperrt_bis=null,aktualisiert_am=now()
      from public.benachrichtigungs_ereignisse e
      where e.id=a.ereignis_id and e.typ='termin.erinnerung'
        and a.empfaenger_schluessel='s_'||p_schiedsrichter_id::text
        and a.kanal='web_push' and a.status in ('offen','fehlgeschlagen');
  end if;
  return jsonb_build_object('termine',p_aktiv);
end $function$;

-- Ein einzelner Gültigkeitscheck gilt bei Einreihung, Claim und unmittelbar
-- vor dem Senden. So werden Umplanung, Absage, Sichtbarkeitswechsel,
-- geänderte Zusage und widerrufene Einwilligung berücksichtigt.
create or replace function public.schiri_push_termin_gueltig(
  p_person_id uuid,p_termin_id uuid,p_datum date,p_beginn text,p_phase text
) returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1 from public.termine t
    join public.schiedsrichter s on s.id=p_person_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
    where t.id=p_termin_id and t.datum=p_datum
      and coalesce(t.beginn_zeit::text,'')=p_beginn
      and t.sichtbarkeit<>'nur_app'
      and s.aktiv and not coalesce(s.ist_test,false) and p.termine
      and ((p_phase='vortag' and t.erinnerung_modus in ('vortag','beide'))
        or (p_phase='tag' and t.erinnerung_modus in ('tag','beide')
          and t.beginn_zeit>time '09:00'))
      and (t.sichtbarkeit='oeffentlich' or s.verein_id=t.verein_id)
      and ((t.pflicht and s.verein_id=t.verein_id)
        or exists(select 1 from public.termin_rueckmeldungen r
          where r.termin_id=t.id and r.schiedsrichter_id=s.id and r.status='zu'))
      and (t.datum>(now() at time zone 'Europe/Berlin')::date
        or (t.datum=(now() at time zone 'Europe/Berlin')::date
          and t.beginn_zeit>(now() at time zone 'Europe/Berlin')::time))
      and exists(select 1 from public.push_abos b
        where b.schiedsrichter_id=s.id and b.gueltig_bis>now())
  );
$function$;

-- 18:00 Uhr am Vortag bzw. 09:00 Uhr am Termintag; 10-Minuten-Fenster.
-- Vor 09:00 Uhr beginnende oder zeitlich unklare Termine erhalten am
-- Termintag keine verspaetete Erinnerung. Alles in Europe/Berlin.
create or replace function public.schiri_push_termine_einreihen()
returns integer language plpgsql security definer set search_path to '' as $function$
declare
  v_lokal timestamp := now() at time zone 'Europe/Berlin';
  v_minute integer; v_phase text; v_tag date;
  v_zeile record; v_ereignis uuid; v_anzahl integer:=0;
begin
  v_minute:=extract(hour from v_lokal)::integer*60+extract(minute from v_lokal)::integer;
  if v_minute between 1080 and 1089 then
    v_phase:='vortag'; v_tag:=v_lokal::date+1;
  elsif v_minute between 540 and 549 then
    v_phase:='tag'; v_tag:=v_lokal::date;
  else return 0; end if;
  for v_zeile in
    select t.id as termin_id,t.verein_id,t.datum,t.beginn_zeit,s.id as person_id
    from public.termine t
    join public.schiedsrichter s
      on (s.verein_id=t.verein_id or t.sichtbarkeit='oeffentlich')
    where t.datum=v_tag and t.erinnerung_modus<>'aus'
      and public.schiri_push_termin_gueltig(s.id,t.id,t.datum,
        coalesce(t.beginn_zeit::text,''),v_phase)
  loop
    insert into public.benachrichtigungs_ereignisse
      (verein_id,typ,referenz_art,referenz_id,metadaten,schluessel)
    values(v_zeile.verein_id,'termin.erinnerung','termin',v_zeile.termin_id,
      jsonb_build_object('schiedsrichter_id',v_zeile.person_id,
        'datum',v_zeile.datum,'beginn',coalesce(v_zeile.beginn_zeit::text,''),
        'phase',v_phase),
      'termin.push:'||v_zeile.termin_id::text||':'||v_zeile.person_id::text||':'||
        v_zeile.datum::text||':'||coalesce(v_zeile.beginn_zeit::text,'')||':'||v_phase)
    on conflict(schluessel) do nothing returning id into v_ereignis;
    if v_ereignis is null then continue; end if;
    insert into public.benachrichtigungs_einstellungen(empfaenger_schluessel,email_aktiv)
      values('s_'||v_zeile.person_id::text,false)
      on conflict(empfaenger_schluessel) do nothing;
    insert into public.benachrichtigungs_auftraege
      (ereignis_id,empfaenger_schluessel,kanal)
      values(v_ereignis,'s_'||v_zeile.person_id::text,'web_push');
    v_anzahl:=v_anzahl+1;
  end loop;
  return v_anzahl;
end $function$;

create or replace function public.schiri_push_termin_auftraege_beanspruchen(p_limit integer default 10)
returns table(auftrag_id uuid,typ text,meldung_id uuid,schiedsrichter_id uuid,gruppe text)
language plpgsql security definer set search_path to '' as $function$
begin
  update public.benachrichtigungs_auftraege a
    set status='aufgegeben',letzter_fehlercode='termin_nicht_mehr_gueltig',
        gesperrt_bis=null,aktualisiert_am=now()
    from public.benachrichtigungs_ereignisse e
    where e.id=a.ereignis_id and e.typ='termin.erinnerung'
      and a.kanal='web_push' and a.status in ('offen','fehlgeschlagen')
      and (e.erstellt_am<now()-interval '1 hour'
        or not public.schiri_push_termin_gueltig(
          (e.metadaten->>'schiedsrichter_id')::uuid,e.referenz_id,
          (e.metadaten->>'datum')::date,e.metadaten->>'beginn',
          e.metadaten->>'phase'));
  return query
  with kandidaten as (
    select a.id from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id=a.ereignis_id
    where e.typ='termin.erinnerung' and e.referenz_art='termin'
      and a.kanal='web_push' and a.status in ('offen','fehlgeschlagen','in_arbeit')
      and a.naechster_versuch_am<=now()
      and (a.gesperrt_bis is null or a.gesperrt_bis<now())
      and a.versuche<5 and e.erstellt_am>=now()-interval '1 hour'
      and a.empfaenger_schluessel='s_'||(e.metadaten->>'schiedsrichter_id')
      and public.schiri_push_termin_gueltig(
        (e.metadaten->>'schiedsrichter_id')::uuid,e.referenz_id,
        (e.metadaten->>'datum')::date,e.metadaten->>'beginn',e.metadaten->>'phase')
    order by a.erstellt_am for update of a skip locked
    limit greatest(1,least(coalesce(p_limit,10),20))
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a
      set status='in_arbeit',versuche=a.versuche+1,
          gesperrt_bis=now()+interval '5 minutes',aktualisiert_am=now()
    from kandidaten k where a.id=k.id returning a.id,a.ereignis_id
  )
  select b.id,e.typ,e.referenz_id,(e.metadaten->>'schiedsrichter_id')::uuid,
    'termin_'||e.referenz_id::text||'_'||(e.metadaten->>'phase')
  from beansprucht b
  join public.benachrichtigungs_ereignisse e on e.id=b.ereignis_id;
end $function$;

create or replace function public.schiri_push_termin_zustellliste(p_auftrag_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path to '' as $function$
begin
  return query
    select b.id,b.endpunkt,b.p256dh,b.auth
    from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id=a.ereignis_id
    join public.push_abos b
      on b.schiedsrichter_id=(e.metadaten->>'schiedsrichter_id')::uuid
    where a.id=p_auftrag_id and a.kanal='web_push' and a.status='in_arbeit'
      and e.typ='termin.erinnerung' and e.referenz_art='termin'
      and a.empfaenger_schluessel='s_'||(e.metadaten->>'schiedsrichter_id')
      and b.gueltig_bis>now()
      and public.schiri_push_termin_gueltig(
        (e.metadaten->>'schiedsrichter_id')::uuid,e.referenz_id,
        (e.metadaten->>'datum')::date,e.metadaten->>'beginn',e.metadaten->>'phase');
end $function$;

-- Testschaltfläche funktioniert auch bei ausschließlich aktivierten Terminen.
create or replace function public.schiri_push_test_abo(
  p_schiedsrichter_id uuid,p_pin text,p_endpunkt text
) returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path to '' as $function$
declare v_abo public.push_abos%rowtype;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if not exists(select 1 from public.schiri_push_praeferenzen p
    where p.schiedsrichter_id=p_schiedsrichter_id
      and (p.feedback_antwort or p.quiz_neu or p.quiz_erinnerung or p.termine)) then
    raise exception 'Mitteilungen sind nicht eingeschaltet';
  end if;
  select a.* into v_abo from public.push_abos a
    where a.schiedsrichter_id=p_schiedsrichter_id and a.endpunkt=p_endpunkt
      and a.gueltig_bis>now() for update;
  if not found then raise exception 'Geraet nicht angemeldet'; end if;
  if v_abo.letzter_test_am>now()-interval '1 minute' then
    raise exception 'Bitte eine Minute warten';
  end if;
  update public.push_abos a set letzter_test_am=now() where a.id=v_abo.id;
  return query select v_abo.id,v_abo.endpunkt,v_abo.p256dh,v_abo.auth;
end $function$;

revoke all on function public.obmann_termin_speichern_mit_erinnerung(text,text,date,boolean,text,boolean,boolean,text,text,text,uuid,text,time,time,text,date,text) from public,anon,authenticated;
grant execute on function public.obmann_termin_speichern_mit_erinnerung(text,text,date,boolean,text,boolean,boolean,text,text,text,uuid,text,time,time,text,date,text) to anon,authenticated;
revoke all on function public.obmann_termine_mit_stand(text) from public,anon,authenticated;
grant execute on function public.obmann_termine_mit_stand(text) to anon,authenticated;
revoke all on function public.schiri_push_termine_setzen(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.schiri_push_termine_setzen(uuid,text,boolean) to anon,authenticated;
revoke all on function public.schiri_push_termin_gueltig(uuid,uuid,date,text,text) from public,anon,authenticated;
revoke all on function public.schiri_push_termine_einreihen() from public,anon,authenticated;
revoke all on function public.schiri_push_termin_auftraege_beanspruchen(integer) from public,anon,authenticated;
revoke all on function public.schiri_push_termin_zustellliste(uuid) from public,anon,authenticated;
grant execute on function public.schiri_push_termin_gueltig(uuid,uuid,date,text,text) to service_role;
grant execute on function public.schiri_push_termine_einreihen() to service_role;
grant execute on function public.schiri_push_termin_auftraege_beanspruchen(integer) to service_role;
grant execute on function public.schiri_push_termin_zustellliste(uuid) to service_role;
notify pgrst,'reload schema';
