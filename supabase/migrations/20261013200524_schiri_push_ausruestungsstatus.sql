-- Freiwillige fünfte Kategorie; kein historischer Versand beim Einschalten.
alter table public.schiri_push_praeferenzen
  add column ausruestung_status boolean not null default false,
  add column ausruestung_aktiviert_am timestamptz;

create or replace function public.schiri_push_einstellungen(p_schiedsrichter_id uuid,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_wahl public.schiri_push_praeferenzen%rowtype; v_geraete jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select * into v_wahl from public.schiri_push_praeferenzen p where p.schiedsrichter_id=p_schiedsrichter_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'endpunkt',a.endpunkt,'geraet',a.geraet,
    'erstellt_am',a.erstellt_am,'zuletzt_bestaetigt',a.zuletzt_bestaetigt,'gueltig_bis',a.gueltig_bis)
    order by a.zuletzt_bestaetigt desc),'[]'::jsonb) into v_geraete
    from public.push_abos a where a.schiedsrichter_id=p_schiedsrichter_id and a.gueltig_bis>now();
  return jsonb_build_object('feedback_antwort',coalesce(v_wahl.feedback_antwort,false),
    'quiz_neu',coalesce(v_wahl.quiz_neu,false),'quiz_erinnerung',coalesce(v_wahl.quiz_erinnerung,false),
    'termine',coalesce(v_wahl.termine,false),'ausruestung_status',coalesce(v_wahl.ausruestung_status,false),'geraete',v_geraete);
end $function$;

-- Neuer Name statt überladener RPC: alte Webseiten speichern weiterhin vier Werte.
create function public.schiri_push_auswahl_v2_setzen(p_schiedsrichter_id uuid,p_pin text,
  p_feedback_antwort boolean,p_quiz_neu boolean,p_quiz_erinnerung boolean,p_termine boolean,p_ausruestung_status boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_ausruestung_status is null then raise exception 'Auswahl fehlt'; end if;
  perform public.schiri_push_auswahl_setzen(p_schiedsrichter_id,p_pin,p_feedback_antwort,p_quiz_neu,p_quiz_erinnerung,p_termine);
  update public.schiri_push_praeferenzen p set ausruestung_status=p_ausruestung_status,
    ausruestung_aktiviert_am=case when p_ausruestung_status and not p.ausruestung_status then clock_timestamp()
      when not p_ausruestung_status then null else p.ausruestung_aktiviert_am end,aktualisiert_am=now()
    where p.schiedsrichter_id=p_schiedsrichter_id;
  if not p_ausruestung_status then
    update public.benachrichtigungs_auftraege a set status='aufgegeben',letzter_fehlercode='einwilligung_widerrufen',
      gesperrt_bis=null,aktualisiert_am=now() from public.benachrichtigungs_ereignisse e
      where e.id=a.ereignis_id and e.typ='ausruestung.status' and a.kanal='web_push'
        and a.empfaenger_schluessel='s_'||p_schiedsrichter_id::text and a.status in ('offen','fehlgeschlagen','in_arbeit');
  end if;
  return public.schiri_push_einstellungen(p_schiedsrichter_id,p_pin);
end $function$;

-- Aktueller fachlicher Fremd-Update-Stand pro Anfrage/Bündel, keine eigenen
-- Schiri-Aktionen, Notizen oder Geldbeträge. 30 Sekunden sammeln schnelle Schritte.
create function public.schiri_push_ausruestung_kandidaten()
returns table(quelle_id uuid,anfrage_id uuid,person_id uuid,verein_id uuid,ziel_id uuid)
language sql stable security invoker set search_path='' as $function$
  with neueste as (
    select distinct on (coalesce(a.buendel_id,a.id)) e.id quelle_id,e.anfrage_id,s.id person_id,s.verein_id,
      coalesce(a.buendel_id,a.id) ziel_id,a.buendel_id,e.schritt,e.erstellt_am
    from public.ausruestung_ereignisse e
    join public.ausruestungs_anfragen a on a.id=e.anfrage_id
    join public.schiedsrichter s on s.id=a.schiedsrichter_id and s.verein_id=e.verein_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
    where s.aktiv and not coalesce(s.ist_test,false) and coalesce(a.typ,'ausruestung')<>'anliegen'
      and e.runde=a.prozess_runde and e.schritt=a.prozess_status
      and p.ausruestung_status and e.erstellt_am>=p.ausruestung_aktiviert_am
      and e.erstellt_am>=now()-interval '24 hours' and e.akteur_rolle in ('obmann','vorstand')
      and exists(select 1 from public.push_abos b where b.schiedsrichter_id=s.id
        and b.verein_id=s.verein_id and b.gueltig_bis>now())
      and not exists(select 1 from public.ausruestungs_anfragen x join public.schiedsrichter sx on sx.id=x.schiedsrichter_id
        where a.buendel_id is not null and x.buendel_id=a.buendel_id
          and (x.schiedsrichter_id<>s.id or sx.verein_id<>s.verein_id or x.typ='anliegen'))
    order by coalesce(a.buendel_id,a.id),e.erstellt_am desc,e.id desc
  )
  select n.quelle_id,n.anfrage_id,n.person_id,n.verein_id,n.ziel_id from neueste n
  where n.erstellt_am<=now()-interval '30 seconds'
    and not (n.buendel_id is not null and n.schritt in ('freigegeben','abgelehnt') and exists(
      select 1 from public.ausruestungs_anfragen x where x.buendel_id=n.buendel_id
        and x.prozess_status in ('eingereicht','geprueft','vorgelegt')))
    and not (n.buendel_id is not null and n.schritt='zahlung_angewiesen' and exists(
      select 1 from public.ausruestungs_anfragen x where x.buendel_id=n.buendel_id
        and coalesce(x.beschaffungsweg,'weg2_schiri_besorgt')='weg2_schiri_besorgt'
        and x.freigabe_status='freigegeben' and not x.keine_zahlung_faellig
        and x.prozess_status not in ('zahlung_angewiesen','geld_erhalten','abgeschlossen','zurueckgezogen','abgelehnt')));
$function$;

create function public.schiri_push_ausruestung_einreihen()
returns integer language plpgsql security definer set search_path='' as $function$
declare c record; v_id uuid; v_n integer:=0;
begin
  for c in select * from public.schiri_push_ausruestung_kandidaten() loop
    insert into public.benachrichtigungs_einstellungen(empfaenger_schluessel,email_aktiv)
      values('s_'||c.person_id::text,false) on conflict(empfaenger_schluessel) do nothing;
    insert into public.benachrichtigungs_ereignisse(verein_id,typ,referenz_art,referenz_id,metadaten,schluessel)
      values(c.verein_id,'ausruestung.status','ausruestungsanfrage',c.anfrage_id,
        jsonb_build_object('quelle_id',c.quelle_id,'ziel_id',c.ziel_id), 'ausruestung.push:'||c.quelle_id::text)
      on conflict(schluessel) do nothing returning id into v_id;
    if v_id is not null then
      insert into public.benachrichtigungs_auftraege(ereignis_id,empfaenger_schluessel,kanal)
        values(v_id,'s_'||c.person_id::text,'web_push') on conflict do nothing;
      v_n:=v_n+1;
    end if;
    v_id:=null;
  end loop;
  return v_n;
end $function$;

create function public.schiri_push_ausruestung_auftraege_beanspruchen(p_limit integer default 10)
returns table(auftrag_id uuid,typ text,meldung_id uuid,schiedsrichter_id uuid,gruppe text)
language plpgsql security definer set search_path='' as $function$
begin
  perform public.schiri_push_ausruestung_einreihen();
  -- Überholte/widerrufene/abgelaufene Aufträge nicht später nachschicken.
  update public.benachrichtigungs_auftraege a set status='aufgegeben',letzter_fehlercode='ausruestung_nicht_mehr_aktuell',
    gesperrt_bis=null,aktualisiert_am=now() from public.benachrichtigungs_ereignisse e
    where e.id=a.ereignis_id and e.typ='ausruestung.status' and a.kanal='web_push'
      and a.status in ('offen','fehlgeschlagen','in_arbeit') and (a.gesperrt_bis is null or a.gesperrt_bis<now())
      and not exists(select 1 from public.schiri_push_ausruestung_kandidaten() c
        where c.quelle_id=(e.metadaten->>'quelle_id')::uuid and c.anfrage_id=e.referenz_id
          and c.verein_id=e.verein_id and a.empfaenger_schluessel='s_'||c.person_id::text);
  return query with gueltig as materialized(select * from public.schiri_push_ausruestung_kandidaten()),
  kandidaten as (
    select a.id from public.benachrichtigungs_auftraege a join public.benachrichtigungs_ereignisse e on e.id=a.ereignis_id
    join gueltig c on c.quelle_id=(e.metadaten->>'quelle_id')::uuid and c.anfrage_id=e.referenz_id and c.verein_id=e.verein_id
    where e.typ='ausruestung.status' and a.kanal='web_push' and a.empfaenger_schluessel='s_'||c.person_id::text
      and a.status in ('offen','fehlgeschlagen','in_arbeit') and a.naechster_versuch_am<=now()
      and (a.gesperrt_bis is null or a.gesperrt_bis<now()) and a.versuche<5
    order by a.erstellt_am,a.id for update of a skip locked limit greatest(1,least(coalesce(p_limit,10),20))
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a set status='in_arbeit',versuche=a.versuche+1,
      gesperrt_bis=now()+interval '5 minutes',aktualisiert_am=now() from kandidaten k where a.id=k.id
      returning a.id,a.ereignis_id
  ) select b.id,e.typ,c.ziel_id,c.person_id,'ausruestung_'||c.ziel_id::text from beansprucht b
    join public.benachrichtigungs_ereignisse e on e.id=b.ereignis_id
    join gueltig c on c.quelle_id=(e.metadaten->>'quelle_id')::uuid;
end $function$;

create function public.schiri_push_ausruestung_zustellliste(p_auftrag_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $function$
begin
  return query select b.id,b.endpunkt,b.p256dh,b.auth from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id=a.ereignis_id
    join public.schiri_push_ausruestung_kandidaten() c on c.quelle_id=(e.metadaten->>'quelle_id')::uuid
      and c.anfrage_id=e.referenz_id and c.verein_id=e.verein_id
    join public.push_abos b on b.schiedsrichter_id=c.person_id and b.verein_id=c.verein_id and b.gueltig_bis>now()
    where a.id=p_auftrag_id and a.kanal='web_push' and a.status='in_arbeit' and a.gesperrt_bis>now()
      and e.typ='ausruestung.status' and a.empfaenger_schluessel='s_'||c.person_id::text;
end $function$;

create function public.obmann_push_geraete_v2(p_passwort text)
returns table(schiedsrichter_id uuid,name text,abo_id uuid,geraet text,gueltig_bis timestamptz,
  zuletzt_bestaetigt timestamptz,letzter_test_am timestamptz,empfang_aktiv boolean,
  quiz_neu boolean,quiz_erinnerung boolean,termine boolean,feedback_antwort boolean,ausruestung_status boolean)
language plpgsql security definer set search_path='' as $function$
begin
  return query select g.*,coalesce(p.ausruestung_status,false) from public.obmann_push_geraete(p_passwort) g
    left join public.schiri_push_praeferenzen p on p.schiedsrichter_id=g.schiedsrichter_id;
end $function$;

revoke all on function public.schiri_push_einstellungen(uuid,text) from public,anon,authenticated;
grant execute on function public.schiri_push_einstellungen(uuid,text) to anon,authenticated,service_role;
revoke all on function public.schiri_push_auswahl_v2_setzen(uuid,text,boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.schiri_push_auswahl_v2_setzen(uuid,text,boolean,boolean,boolean,boolean,boolean) to anon,authenticated;
revoke all on function public.schiri_push_ausruestung_kandidaten() from public,anon,authenticated;
revoke all on function public.schiri_push_ausruestung_einreihen() from public,anon,authenticated;
revoke all on function public.schiri_push_ausruestung_auftraege_beanspruchen(integer) from public,anon,authenticated;
revoke all on function public.schiri_push_ausruestung_zustellliste(uuid) from public,anon,authenticated;
revoke all on function public.obmann_push_geraete_v2(text) from public,anon,authenticated;
grant execute on function public.schiri_push_ausruestung_kandidaten() to service_role;
grant execute on function public.schiri_push_ausruestung_einreihen() to service_role;
grant execute on function public.schiri_push_ausruestung_auftraege_beanspruchen(integer) to service_role;
grant execute on function public.schiri_push_ausruestung_zustellliste(uuid) to service_role;
grant execute on function public.obmann_push_geraete_v2(text) to service_role;

create or replace function public.schiri_push_test_abo(p_schiedsrichter_id uuid,p_pin text,p_endpunkt text)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $function$
declare v_abo public.push_abos%rowtype;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if not exists(select 1 from public.schiri_push_praeferenzen p where p.schiedsrichter_id=p_schiedsrichter_id
    and (p.feedback_antwort or p.quiz_neu or p.quiz_erinnerung or p.termine or p.ausruestung_status)) then
    raise exception 'Mitteilungen sind nicht eingeschaltet'; end if;
  select a.* into v_abo from public.push_abos a where a.schiedsrichter_id=p_schiedsrichter_id
    and a.endpunkt=p_endpunkt and a.gueltig_bis>now() for update;
  if not found then raise exception 'Geraet nicht angemeldet'; end if;
  if v_abo.letzter_test_am>now()-interval '1 minute' then raise exception 'Bitte eine Minute warten'; end if;
  update public.push_abos a set letzter_test_am=now() where a.id=v_abo.id;
  return query select v_abo.id,v_abo.endpunkt,v_abo.p256dh,v_abo.auth;
end $function$;

create or replace function public.obmann_push_test_abo(p_passwort text,p_abo_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $function$
declare v_verein uuid; v_abo public.push_abos%rowtype;
begin
  v_verein:=public.obmann_verein(p_passwort);
  select a.* into v_abo from public.push_abos a join public.schiedsrichter s on s.id=a.schiedsrichter_id
    where a.id=p_abo_id and a.verein_id=v_verein and s.verein_id=v_verein and s.aktiv and not coalesce(s.ist_test,false)
      and a.gueltig_bis>now() and exists(select 1 from public.schiri_push_praeferenzen p where p.schiedsrichter_id=s.id
        and (p.quiz_neu or p.quiz_erinnerung or p.termine or p.feedback_antwort or p.ausruestung_status)) for update of a;
  if not found then raise exception 'Gerät ist nicht verfügbar.'; end if;
  if v_abo.letzter_test_am>now()-interval '60 seconds' then raise exception 'Bitte warte eine Minute vor dem nächsten Gerätetest.'; end if;
  update public.push_abos a set letzter_test_am=now() where a.id=p_abo_id;
  return query select v_abo.id,v_abo.endpunkt,v_abo.p256dh,v_abo.auth;
end $function$;
revoke all on function public.schiri_push_test_abo(uuid,text,text) from public,anon,authenticated;
grant execute on function public.schiri_push_test_abo(uuid,text,text) to service_role;
revoke all on function public.obmann_push_test_abo(text,uuid) from public,anon,authenticated;
grant execute on function public.obmann_push_test_abo(text,uuid) to service_role;
