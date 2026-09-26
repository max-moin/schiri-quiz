-- Schritt 3: Opt-in fuer neue Wochenrunden und Erinnerungen. Der vorhandene
-- Web-Push-Dispatcher bleibt bis zur ausdruecklichen Pilotfreigabe AUS.
-- Die IFAB-Fragen sind eine Quellenkategorie, keine automatisch importierten
-- oder fachlich ungeprueften Quizfragen.

alter table public.fragen drop constraint if exists fragen_quelle_typ_check;
alter table public.fragen add constraint fragen_quelle_typ_check
  check (quelle_typ = any (array[
    'hausregeltest', 'dfb_schiri_zeitung', 'ifab',
    'oss_app', 'eigene_idee', 'sonstige'
  ]::text[]));

create or replace function public.schiri_push_einstellungen(
  p_schiedsrichter_id uuid, p_pin text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_wahl public.schiri_push_praeferenzen%rowtype; v_geraete jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select * into v_wahl from public.schiri_push_praeferenzen p
   where p.schiedsrichter_id = p_schiedsrichter_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'endpunkt', a.endpunkt, 'geraet', a.geraet,
    'erstellt_am', a.erstellt_am, 'zuletzt_bestaetigt', a.zuletzt_bestaetigt,
    'gueltig_bis', a.gueltig_bis) order by a.zuletzt_bestaetigt desc), '[]'::jsonb)
    into v_geraete from public.push_abos a
   where a.schiedsrichter_id = p_schiedsrichter_id and a.gueltig_bis > now();
  return jsonb_build_object(
    'feedback_antwort', coalesce(v_wahl.feedback_antwort, false),
    'quiz_neu', coalesce(v_wahl.quiz_neu, false),
    'quiz_erinnerung', coalesce(v_wahl.quiz_erinnerung, false),
    'geraete', v_geraete);
end $function$;

create or replace function public.schiri_push_quiz_setzen(
  p_schiedsrichter_id uuid, p_pin text,
  p_quiz_neu boolean, p_quiz_erinnerung boolean
) returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_quiz_neu is null or p_quiz_erinnerung is null then
    raise exception 'Auswahl fehlt';
  end if;
  insert into public.schiri_push_praeferenzen
    (schiedsrichter_id, quiz_neu, quiz_erinnerung)
  values (p_schiedsrichter_id, p_quiz_neu, p_quiz_erinnerung)
  on conflict (schiedsrichter_id) do update set
    quiz_neu = excluded.quiz_neu,
    quiz_erinnerung = excluded.quiz_erinnerung,
    aktualisiert_am = now();
  -- Ein Widerruf beseitigt ausstehende Auftraege sofort. Bereits versandte
  -- Benachrichtigungen koennen technisch nicht zurueckgerufen werden.
  update public.benachrichtigungs_auftraege a
     set status = 'aufgegeben', letzter_fehlercode = 'einwilligung_widerrufen',
         gesperrt_bis = null, aktualisiert_am = now()
    from public.benachrichtigungs_ereignisse e
   where e.id = a.ereignis_id and a.kanal = 'web_push'
     and a.empfaenger_schluessel = 's_' || p_schiedsrichter_id::text
     and a.status in ('offen', 'fehlgeschlagen')
     and ((e.typ = 'quiz.neu' and not p_quiz_neu)
       or (e.typ = 'quiz.erinnerung' and not p_quiz_erinnerung));
  return jsonb_build_object('quiz_neu', p_quiz_neu,
                            'quiz_erinnerung', p_quiz_erinnerung);
end $function$;

-- Quizabschluss ist pro Runde die Anzahl aktiver Fragen im eigenen Verein.
-- Die Fachlogik entspricht dem bestehenden quiz.abgeschlossen-Trigger.
create or replace function public.schiri_push_quiz_offen(
  p_schiedsrichter_id uuid, p_verein_id uuid, p_runde_id uuid
) returns boolean language sql stable security invoker set search_path to '' as $function$
  select exists (
    select 1 from public.runden r
    where r.id = p_runde_id and now() >= r.startet_am and now() < r.endet_am
      and exists (select 1 from public.runden_fragen rf
        join public.fragen f on f.id = rf.frage_id and f.aktiv
        where rf.verein_id = p_verein_id and rf.runde_id = r.id)
      and exists (select 1 from public.runden_fragen rf
        join public.fragen f on f.id = rf.frage_id and f.aktiv
        where rf.verein_id = p_verein_id and rf.runde_id = r.id
          and not exists (select 1 from public.antworten a
            where a.schiedsrichter_id = p_schiedsrichter_id
              and a.frage_id = rf.frage_id
              and a.bewertungsstatus is distinct from 'nachbessern'))
  );
$function$;

-- Alle zwei Minuten vom vorhandenen, authentifizierten Versand-Cron aufgerufen.
-- Ein 10-Minuten-Fenster federt kurze Scheduler-Verzoegerungen ab; eindeutige
-- Ereignisschluessel verhindern Duplikate. Ausfall >10 Minuten wird bewusst
-- nicht nachgeholt. Zeit und Wochenzuordnung sind immer Europe/Berlin (DST).
create or replace function public.schiri_push_quiz_einreihen()
returns integer language plpgsql security definer set search_path to '' as $function$
declare
  v_lokal timestamp := now() at time zone 'Europe/Berlin';
  v_tag integer; v_minute integer; v_phase text; v_typ text;
  v_zeile record; v_schluessel text; v_ereignis uuid;
  v_anzahl integer := 0;
begin
  v_tag := extract(isodow from v_lokal);
  v_minute := extract(hour from v_lokal)::integer * 60
              + extract(minute from v_lokal)::integer;
  if v_tag = 1 and v_minute between 600 and 609 then
    v_phase := 'montag'; v_typ := 'quiz.neu';
  elsif v_tag = 5 and v_minute between 900 and 909 then
    v_phase := 'freitag'; v_typ := 'quiz.erinnerung';
  elsif v_tag = 7 and v_minute between 630 and 639 then
    v_phase := 'sonntag'; v_typ := 'quiz.erinnerung';
  else
    return 0;
  end if;

  for v_zeile in
    select distinct s.id as person_id, s.verein_id, r.id as runde_id
      from public.runden r
      join public.runden_fragen rf on rf.runde_id = r.id
      join public.fragen f on f.id = rf.frage_id and f.aktiv
      join public.schiedsrichter s on s.verein_id = rf.verein_id
      join public.schiri_push_praeferenzen p on p.schiedsrichter_id = s.id
     where s.aktiv and not coalesce(s.ist_test, false)
       and ((v_typ = 'quiz.neu' and p.quiz_neu)
         or (v_typ = 'quiz.erinnerung' and p.quiz_erinnerung))
       and r.startet_am <= now() and r.endet_am > now()
       and date_trunc('week', r.startet_am at time zone 'Europe/Berlin')
           = date_trunc('week', v_lokal)
       and exists (select 1 from public.push_abos b
         where b.schiedsrichter_id = s.id and b.gueltig_bis > now())
       and public.schiri_push_quiz_offen(s.id, s.verein_id, r.id)
  loop
    v_schluessel := 'quiz.push:' || v_zeile.runde_id::text || ':'
      || v_zeile.person_id::text || ':' || v_phase;
    insert into public.benachrichtigungs_ereignisse
      (verein_id, typ, referenz_art, referenz_id, metadaten, schluessel)
    values (v_zeile.verein_id, v_typ, 'quizrunde', v_zeile.runde_id,
      jsonb_build_object('schiedsrichter_id', v_zeile.person_id,
                         'phase', v_phase), v_schluessel)
    on conflict (schluessel) do nothing returning id into v_ereignis;
    if v_ereignis is null then continue; end if;
    insert into public.benachrichtigungs_einstellungen
      (empfaenger_schluessel, email_aktiv)
    values ('s_' || v_zeile.person_id::text, false)
    on conflict (empfaenger_schluessel) do nothing;
    insert into public.benachrichtigungs_auftraege
      (ereignis_id, empfaenger_schluessel, kanal)
    values (v_ereignis, 's_' || v_zeile.person_id::text, 'web_push');
    v_anzahl := v_anzahl + 1;
  end loop;
  return v_anzahl;
end $function$;

create or replace function public.schiri_push_quiz_auftraege_beanspruchen(
  p_limit integer default 10
) returns table(auftrag_id uuid, typ text, meldung_id uuid,
                schiedsrichter_id uuid, gruppe text)
language plpgsql security definer set search_path to '' as $function$
begin
  -- Nach dem Rundenende oder Widerruf wird nichts nachgeschickt.
  update public.benachrichtigungs_auftraege a
     set status = 'aufgegeben', letzter_fehlercode = 'quiz_nicht_mehr_offen',
         gesperrt_bis = null, aktualisiert_am = now()
    from public.benachrichtigungs_ereignisse e
    join public.schiedsrichter s
      on s.id = (e.metadaten->>'schiedsrichter_id')::uuid
   where e.id = a.ereignis_id and a.kanal = 'web_push'
     and e.typ in ('quiz.neu', 'quiz.erinnerung')
     and a.status in ('offen','fehlgeschlagen')
     and (not public.schiri_push_quiz_offen(s.id, s.verein_id, e.referenz_id)
       or not exists (select 1 from public.schiri_push_praeferenzen p
         where p.schiedsrichter_id = s.id
           and ((e.typ = 'quiz.neu' and p.quiz_neu)
             or (e.typ = 'quiz.erinnerung' and p.quiz_erinnerung))));
  return query
  with kandidaten as (
    select a.id from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id = a.ereignis_id
    join public.schiedsrichter s
      on s.id = (e.metadaten->>'schiedsrichter_id')::uuid
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id = s.id
    where a.kanal = 'web_push' and e.typ in ('quiz.neu','quiz.erinnerung')
      and e.referenz_art = 'quizrunde'
      and a.empfaenger_schluessel = 's_' || s.id::text
      and s.aktiv and not coalesce(s.ist_test, false)
      and ((e.typ = 'quiz.neu' and p.quiz_neu)
        or (e.typ = 'quiz.erinnerung' and p.quiz_erinnerung))
      and public.schiri_push_quiz_offen(s.id, s.verein_id, e.referenz_id)
      and e.erstellt_am >= now() - interval '24 hours'
      and a.status in ('offen','fehlgeschlagen','in_arbeit')
      and a.naechster_versuch_am <= now()
      and (a.gesperrt_bis is null or a.gesperrt_bis < now())
      and a.versuche < 5
      and exists (select 1 from public.push_abos b
        where b.schiedsrichter_id = s.id and b.gueltig_bis > now())
    order by a.erstellt_am for update of a skip locked
    limit greatest(1,least(coalesce(p_limit,10),20))
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a
       set status='in_arbeit', versuche=a.versuche+1,
           gesperrt_bis=now()+interval '5 minutes', aktualisiert_am=now()
      from kandidaten k where a.id=k.id
      returning a.id,a.ereignis_id
  )
  select b.id,e.typ,e.referenz_id,s.id,
    'quiz_' || e.referenz_id::text || '_' || (e.metadaten->>'phase')
  from beansprucht b
  join public.benachrichtigungs_ereignisse e on e.id=b.ereignis_id
  join public.schiedsrichter s
    on s.id=(e.metadaten->>'schiedsrichter_id')::uuid;
end $function$;

create or replace function public.schiri_push_quiz_zustellliste(p_auftrag_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path to '' as $function$
begin
  return query select b.id,b.endpunkt,b.p256dh,b.auth
    from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id=a.ereignis_id
    join public.schiedsrichter s
      on s.id=(e.metadaten->>'schiedsrichter_id')::uuid
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
    join public.push_abos b on b.schiedsrichter_id=s.id
   where a.id=p_auftrag_id and a.kanal='web_push' and a.status='in_arbeit'
     and a.empfaenger_schluessel='s_' || s.id::text
     and s.aktiv and not coalesce(s.ist_test,false)
     and e.typ in ('quiz.neu','quiz.erinnerung')
     and ((e.typ='quiz.neu' and p.quiz_neu)
       or (e.typ='quiz.erinnerung' and p.quiz_erinnerung))
     and public.schiri_push_quiz_offen(s.id,s.verein_id,e.referenz_id)
     and b.gueltig_bis > now();
end $function$;

-- Auch die Testmitteilung darf nach jeder ausdruecklichen Opt-in-Kategorie
-- angefordert werden, nicht nur nach Feedback-Antworten.
create or replace function public.schiri_push_test_abo(
  p_schiedsrichter_id uuid, p_pin text, p_endpunkt text
) returns table(id uuid, endpunkt text, p256dh text, auth text)
language plpgsql security definer set search_path to '' as $function$
declare v_abo public.push_abos%rowtype;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if not exists(select 1 from public.schiri_push_praeferenzen p
      where p.schiedsrichter_id = p_schiedsrichter_id
        and (p.feedback_antwort or p.quiz_neu or p.quiz_erinnerung)) then
    raise exception 'Mitteilungen sind nicht eingeschaltet';
  end if;
  select a.* into v_abo from public.push_abos a
   where a.schiedsrichter_id = p_schiedsrichter_id and a.endpunkt = p_endpunkt
     and a.gueltig_bis > now() for update;
  if not found then raise exception 'Geraet nicht angemeldet'; end if;
  if v_abo.letzter_test_am > now() - interval '1 minute' then
    raise exception 'Bitte eine Minute warten';
  end if;
  update public.push_abos a set letzter_test_am = now() where a.id = v_abo.id;
  return query select v_abo.id,v_abo.endpunkt,v_abo.p256dh,v_abo.auth;
end $function$;

revoke all on function public.schiri_push_quiz_setzen(uuid,text,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.schiri_push_quiz_setzen(uuid,text,boolean,boolean)
  to anon,authenticated;
revoke all on function public.schiri_push_quiz_offen(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.schiri_push_quiz_einreihen()
  from public,anon,authenticated;
revoke all on function public.schiri_push_quiz_auftraege_beanspruchen(integer)
  from public,anon,authenticated;
revoke all on function public.schiri_push_quiz_zustellliste(uuid)
  from public,anon,authenticated;
grant execute on function public.schiri_push_quiz_einreihen() to service_role;
grant execute on function public.schiri_push_quiz_auftraege_beanspruchen(integer) to service_role;
grant execute on function public.schiri_push_quiz_zustellliste(uuid) to service_role;
notify pgrst, 'reload schema';
