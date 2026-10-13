-- Private App-Ansichten; keine Geburtstage in den Website-Terminen.
create or replace function public.geburtstag_naechster(p_geburtsdatum date,p_heute date)
returns date language sql immutable set search_path='' as $function$
  select min(datum) from (
    select case when extract(month from p_geburtsdatum)=2 and extract(day from p_geburtsdatum)=29
      and extract(day from (make_date(jahr,3,1)-1))<>29 then null
      else make_date(jahr,extract(month from p_geburtsdatum)::int,extract(day from p_geburtsdatum)::int) end datum
    from generate_series(extract(year from p_heute)::int,extract(year from p_heute)::int+8) jahr
  ) kandidaten where datum>=p_heute;
$function$;
revoke all on function public.geburtstag_naechster(date,date) from public,anon,authenticated;

create or replace function public.obmann_geburtstage(p_passwort text)
returns table(schiedsrichter_id uuid,name text,datum date,wird_jahre integer,in_tagen integer)
language plpgsql security definer set search_path='' as $function$
declare v_verein uuid; v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  v_verein:=public.obmann_verein(p_passwort);
  return query select s.id,s.name,d.datum,
    extract(year from d.datum)::int-extract(year from s.geburtsdatum)::int,d.datum-v_heute
  from public.schiedsrichter s
  cross join lateral (select public.geburtstag_naechster(s.geburtsdatum,v_heute) datum) d
  where s.verein_id=v_verein and s.aktiv and not coalesce(s.ist_test,false)
    and s.geburtsdatum is not null and s.geburtsdatum<=v_heute and d.datum is not null
  order by d.datum,s.name,s.id;
end $function$;
revoke all on function public.obmann_geburtstage(text) from public,anon,authenticated;
grant execute on function public.obmann_geburtstage(text) to anon,authenticated,service_role;

-- Keine Endpunkte/Schlüssel im App-Vertrag. Auch Personen ohne Abo sichtbar.
create or replace function public.obmann_push_geraete(p_passwort text)
returns table(schiedsrichter_id uuid,name text,abo_id uuid,geraet text,gueltig_bis timestamptz,
  zuletzt_bestaetigt timestamptz,letzter_test_am timestamptz,empfang_aktiv boolean,
  quiz_neu boolean,quiz_erinnerung boolean,termine boolean,feedback_antwort boolean)
language plpgsql security definer set search_path='' as $function$
declare v_verein uuid;
begin
  v_verein:=public.obmann_verein(p_passwort);
  return query select s.id,s.name,a.id,a.geraet,a.gueltig_bis,a.zuletzt_bestaetigt,a.letzter_test_am,
    coalesce(a.gueltig_bis>now(),false),coalesce(p.quiz_neu,false),coalesce(p.quiz_erinnerung,false),
    coalesce(p.termine,false),coalesce(p.feedback_antwort,false)
  from public.schiedsrichter s
  left join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
  left join public.push_abos a on a.schiedsrichter_id=s.id and a.verein_id=v_verein
  where s.verein_id=v_verein and s.aktiv and not coalesce(s.ist_test,false)
  order by s.name,a.zuletzt_bestaetigt desc nulls last;
end $function$;
revoke all on function public.obmann_push_geraete(text) from public,anon,authenticated;
grant execute on function public.obmann_push_geraete(text) to service_role;

-- Nur der Server bekommt nach Obmann-Prüfung genau ein gültiges Geräteabo.
create or replace function public.obmann_push_test_abo(p_passwort text,p_abo_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path='' as $function$
declare v_verein uuid; v_abo public.push_abos%rowtype;
begin
  v_verein:=public.obmann_verein(p_passwort);
  select a.* into v_abo from public.push_abos a join public.schiedsrichter s on s.id=a.schiedsrichter_id
  where a.id=p_abo_id and a.verein_id=v_verein and s.verein_id=v_verein and s.aktiv
    and not coalesce(s.ist_test,false) and a.gueltig_bis>now()
    and exists(select 1 from public.schiri_push_praeferenzen p where p.schiedsrichter_id=s.id
      and (p.quiz_neu or p.quiz_erinnerung or p.termine or p.feedback_antwort)) for update of a;
  if not found then raise exception 'Gerät ist nicht verfügbar.'; end if;
  if v_abo.letzter_test_am>now()-interval '60 seconds' then
    raise exception 'Bitte warte eine Minute vor dem nächsten Gerätetest.';
  end if;
  update public.push_abos a set letzter_test_am=now() where a.id=p_abo_id;
  return query select v_abo.id,v_abo.endpunkt,v_abo.p256dh,v_abo.auth;
end $function$;
revoke all on function public.obmann_push_test_abo(text,uuid) from public,anon,authenticated;
grant execute on function public.obmann_push_test_abo(text,uuid) to service_role;

-- Keine neue Mail-Infrastruktur: vorhandene Outbox mit jährlichem Schlüssel.
create or replace function public.obmann_geburtstagsmails_einreihen(p_jetzt timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $function$
declare v_lokal timestamp:=p_jetzt at time zone 'Europe/Berlin'; v_heute date:=v_lokal::date;
  v_person record; v_anzahl integer:=0;
begin
  if extract(hour from v_lokal)<>9 then return 0; end if;
  for v_person in select s.id,s.verein_id,s.name from public.schiedsrichter s
    join public.vereine v on v.id=s.verein_id
    where v.oeffentliche_kennung='loebtauer-kickers' and s.aktiv and not coalesce(s.ist_test,false)
      and s.geburtsdatum is not null and s.geburtsdatum<=v_heute
      and extract(month from s.geburtsdatum)=extract(month from v_heute)
      and extract(day from s.geburtsdatum)=extract(day from v_heute)
  loop
    perform public.benachrichtigung_einreihen(v_person.verein_id,'geburtstag.heute','schiedsrichter',v_person.id,
      'geburtstag/'||v_person.id::text||'/'||extract(year from v_heute)::text,
      jsonb_build_object('anzeigename',public.benachrichtigung_kurzname(v_person.name)));
    v_anzahl:=v_anzahl+1;
  end loop;
  return v_anzahl;
end $function$;
revoke all on function public.obmann_geburtstagsmails_einreihen(timestamptz) from public,anon,authenticated;
grant execute on function public.obmann_geburtstagsmails_einreihen(timestamptz) to service_role;

update public.benachrichtigungs_einstellungen set
  aktivierte_typen=array_append(aktivierte_typen,'geburtstag.heute'),aktualisiert_am=now()
where empfaenger_schluessel='max' and not ('geburtstag.heute'=any(aktivierte_typen));

-- UTC 07/08 Uhr deckt Berliner Sommer-/Winterzeit ab; Funktion prüft 09 Uhr.
-- Wiederholungen innerhalb der Stunde sind durch Ereignis/Auftrag dedupliziert.
select cron.schedule('obmann-geburtstage-berlin','*/5 7,8 * * *',
  'select public.obmann_geburtstagsmails_einreihen();');
