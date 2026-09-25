-- Schritt 2: persoenlicher Web-Push fuer Antworten auf eigenes Fragenfeedback.
-- Rueckwaertskompatibel: alle Personen und Geraete bleiben standardmaessig AUS.
-- Vorhandene Antworten werden nie nachtraeglich versandt.

create table if not exists public.schiri_push_praeferenzen (
  schiedsrichter_id uuid primary key references public.schiedsrichter(id) on delete cascade,
  feedback_antwort boolean not null default false,
  quiz_neu boolean not null default false,
  quiz_erinnerung boolean not null default false,
  termine boolean not null default false,
  aktualisiert_am timestamptz not null default now()
);
alter table public.schiri_push_praeferenzen enable row level security;
revoke all on table public.schiri_push_praeferenzen from public, anon, authenticated;
grant select, insert, update, delete on table public.schiri_push_praeferenzen to service_role;

alter table public.push_abos
  add column if not exists gueltig_bis timestamptz not null default (now() + interval '30 days'),
  add column if not exists letzter_test_am timestamptz;
create index if not exists push_abos_aktive_person_idx
  on public.push_abos (schiedsrichter_id, gueltig_bis);

-- Nur die eigene PIN berechtigt zur persoenlichen Auswahl und Geraeteliste.
create or replace function public.schiri_push_einstellungen(
  p_schiedsrichter_id uuid, p_pin text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_feedback boolean; v_geraete jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select coalesce(p.feedback_antwort, false) into v_feedback
    from public.schiri_push_praeferenzen p
   where p.schiedsrichter_id = p_schiedsrichter_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'endpunkt', a.endpunkt, 'geraet', a.geraet, 'erstellt_am', a.erstellt_am,
    'zuletzt_bestaetigt', a.zuletzt_bestaetigt,
    'gueltig_bis', a.gueltig_bis) order by a.zuletzt_bestaetigt desc), '[]'::jsonb)
    into v_geraete from public.push_abos a
   where a.schiedsrichter_id = p_schiedsrichter_id and a.gueltig_bis > now();
  return jsonb_build_object('feedback_antwort', coalesce(v_feedback, false), 'geraete', v_geraete);
end $function$;

create or replace function public.schiri_push_feedback_setzen(
  p_schiedsrichter_id uuid, p_pin text, p_aktiv boolean
) returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_aktiv is null then raise exception 'Auswahl fehlt'; end if;
  insert into public.schiri_push_praeferenzen (schiedsrichter_id, feedback_antwort)
  values (p_schiedsrichter_id, p_aktiv)
  on conflict (schiedsrichter_id) do update
    set feedback_antwort = excluded.feedback_antwort, aktualisiert_am = now();
  if not p_aktiv then
    -- Beim Widerruf auch bereits wartende Hinweise verwerfen, statt sie
    -- beim naechsten Einschalten verspätet nachzuschicken.
    update public.benachrichtigungs_auftraege a
       set status = 'aufgegeben', letzter_fehlercode = 'einwilligung_widerrufen',
           gesperrt_bis = null, aktualisiert_am = now()
      from public.benachrichtigungs_ereignisse e
     where e.id = a.ereignis_id and e.typ = 'frage_feedback.antwort'
       and a.empfaenger_schluessel = 's_' || p_schiedsrichter_id::text
       and a.kanal = 'web_push' and a.status in ('offen','fehlgeschlagen');
  end if;
  return jsonb_build_object('feedback_antwort', p_aktiv);
end $function$;

create or replace function public.schiri_push_geraet_entfernen(
  p_schiedsrichter_id uuid, p_pin text, p_abo_id uuid
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_anzahl integer;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  delete from public.push_abos
   where id = p_abo_id and schiedsrichter_id = p_schiedsrichter_id;
  get diagnostics v_anzahl = row_count;
  return jsonb_build_object('entfernt', v_anzahl = 1);
end $function$;

-- Alte Abo-RPCs behalten ihre Signatur. Eine Bestaetigung verlaengert das
-- Abonnement um 30 Tage; abgelaufene Endpunkte sind beim Versand unsichtbar.
create or replace function public.push_abo_speichern(
  p_schiedsrichter_id uuid, p_pin text, p_endpunkt text,
  p_p256dh text, p_auth text, p_geraet text default null
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_verein uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if coalesce(length(p_endpunkt), 0) < 20 or length(p_endpunkt) > 2048
     or p_endpunkt !~ '^https://[^/[:space:]]+/' then
    raise exception 'Ungueltiger Push-Endpunkt';
  end if;
  if coalesce(length(p_p256dh), 0) not between 20 and 200
     or coalesce(length(p_auth), 0) not between 10 and 100 then
    raise exception 'Unvollstaendige Push-Schluessel';
  end if;
  insert into public.push_abos
    (schiedsrichter_id, verein_id, endpunkt, p256dh, auth, geraet, gueltig_bis)
  values (p_schiedsrichter_id, v_verein, p_endpunkt, p_p256dh, p_auth,
    nullif(left(coalesce(p_geraet,''), 60),''), now() + interval '30 days')
  on conflict (endpunkt) do update set
    schiedsrichter_id = excluded.schiedsrichter_id,
    verein_id = excluded.verein_id, p256dh = excluded.p256dh,
    auth = excluded.auth, geraet = excluded.geraet,
    zuletzt_bestaetigt = now(), gueltig_bis = excluded.gueltig_bis;
  return jsonb_build_object('gespeichert', true);
end $function$;

create or replace function public.push_abo_status(
  p_schiedsrichter_id uuid, p_pin text, p_endpunkt text
) returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return jsonb_build_object('angemeldet', exists(
    select 1 from public.push_abos a
     where a.schiedsrichter_id = p_schiedsrichter_id
       and a.endpunkt = p_endpunkt and a.gueltig_bis > now()));
end $function$;

-- Test: nur das eigene aktive Abo, hoechstens einmal pro Minute. Dieser
-- RPC ist NUR fuer den Vercel-Server mit service_role ausfuehrbar; PIN und
-- Endpunkt kommen aus der Browseranfrage, die Schluessel bleiben am Server.
create or replace function public.schiri_push_test_abo(
  p_schiedsrichter_id uuid, p_pin text, p_endpunkt text
) returns table(id uuid, endpunkt text, p256dh text, auth text)
language plpgsql security definer set search_path to '' as $function$
declare v_abo public.push_abos%rowtype;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if not exists(select 1 from public.schiri_push_praeferenzen p
      where p.schiedsrichter_id = p_schiedsrichter_id and p.feedback_antwort) then
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
  return query select v_abo.id, v_abo.endpunkt, v_abo.p256dh, v_abo.auth;
end $function$;

-- EINE fachliche Antwort-Aenderung fuehrt hoechstens zu EINEM Auftrag.
-- Weder Lesen noch Statuswechsel loesen Push aus. Anonyme Meldungen haben
-- keine schiedsrichter_id und werden uebersprungen.
create or replace function public.schiri_push_feedback_trigger()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_person uuid; v_verein uuid; v_ereignis uuid; v_empfaenger text;
begin
  if new.rueckmeldung_am is not distinct from old.rueckmeldung_am then return new; end if;
  select m.schiedsrichter_id, m.verein_id into v_person, v_verein
    from public.frage_meldungen m where m.id = new.meldung_id;
  if v_person is null then return new; end if;
  v_empfaenger := 's_' || v_person::text;
  update public.benachrichtigungs_auftraege a
     set status = 'aufgegeben', letzter_fehlercode = 'antwort_ueberarbeitet',
         gesperrt_bis = null, aktualisiert_am = now()
    from public.benachrichtigungs_ereignisse e
   where e.id = a.ereignis_id and e.typ = 'frage_feedback.antwort'
     and e.referenz_id = new.id and a.empfaenger_schluessel = v_empfaenger
     and a.kanal = 'web_push' and a.status in ('offen','fehlgeschlagen');
  if new.rueckmeldung_obmann is null or new.rueckmeldung_am is null then return new; end if;
  if not exists(select 1 from public.schiri_push_praeferenzen p
      where p.schiedsrichter_id = v_person and p.feedback_antwort) then return new; end if;
  if not exists(select 1 from public.push_abos a
      where a.schiedsrichter_id = v_person and a.gueltig_bis > now()) then return new; end if;
  insert into public.benachrichtigungs_einstellungen(empfaenger_schluessel,email_aktiv)
  values(v_empfaenger,false) on conflict(empfaenger_schluessel) do nothing;
  insert into public.benachrichtigungs_ereignisse
    (verein_id,typ,referenz_art,referenz_id,metadaten,schluessel)
  values(v_verein,'frage_feedback.antwort','frage_feedback_antwort',new.id,
    jsonb_build_object('meldung_id',new.meldung_id,'antwort_am',new.rueckmeldung_am),
    'frage_feedback.antwort:' || new.id::text || ':' || new.rueckmeldung_am::text)
  on conflict(schluessel) do nothing returning id into v_ereignis;
  if v_ereignis is not null then
    insert into public.benachrichtigungs_auftraege
      (ereignis_id,empfaenger_schluessel,kanal)
    values(v_ereignis,v_empfaenger,'web_push')
    on conflict(ereignis_id,empfaenger_schluessel,kanal) do nothing;
  end if;
  return new;
end $function$;
drop trigger if exists schiri_push_feedback_antwort on public.frage_meldung_eintraege;
create trigger schiri_push_feedback_antwort
  after update of rueckmeldung_obmann on public.frage_meldung_eintraege
  for each row execute function public.schiri_push_feedback_trigger();

-- Der vorhandene E-Mail-Dispatcher beansprucht ausschliesslich email.
-- Web-Push erhaelt denselben Lease-/Retry-Status, aber einen eigenen Claim.
create or replace function public.schiri_push_auftraege_beanspruchen(p_limit integer default 10)
returns table(auftrag_id uuid, typ text, meldung_id uuid, schiedsrichter_id uuid,
  gruppe text)
language plpgsql security definer set search_path to '' as $function$
begin
  -- Aeltere Hinweise nicht bei spaeterer Aktivierung nachschicken.
  update public.benachrichtigungs_auftraege a
     set status = 'aufgegeben', letzter_fehlercode = 'push_veraltet',
         gesperrt_bis = null, aktualisiert_am = now()
    from public.benachrichtigungs_ereignisse e
   where e.id = a.ereignis_id and a.kanal = 'web_push'
     and a.status in ('offen','fehlgeschlagen')
     and e.erstellt_am < now() - interval '24 hours';
  return query
  with kandidaten as (
    select a.id from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id = a.ereignis_id
    join public.frage_meldung_eintraege f on f.id = e.referenz_id
    join public.frage_meldungen m on m.id = f.meldung_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id = m.schiedsrichter_id
    where a.kanal = 'web_push' and e.typ = 'frage_feedback.antwort'
      and e.referenz_art = 'frage_feedback_antwort'
      and a.empfaenger_schluessel = 's_' || m.schiedsrichter_id::text
      and p.feedback_antwort and f.rueckmeldung_obmann is not null
      and f.rueckmeldung_am = (e.metadaten->>'antwort_am')::timestamptz
      and a.status in ('offen','fehlgeschlagen','in_arbeit')
      and a.naechster_versuch_am <= now()
      and (a.gesperrt_bis is null or a.gesperrt_bis < now())
      and a.versuche < 5 and e.erstellt_am >= now() - interval '24 hours'
      and exists(select 1 from public.push_abos b
         where b.schiedsrichter_id = m.schiedsrichter_id and b.gueltig_bis > now())
    order by a.erstellt_am for update of a skip locked
    limit greatest(1,least(coalesce(p_limit,10),20))
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a
       set status = 'in_arbeit', versuche = a.versuche + 1,
           gesperrt_bis = now() + interval '5 minutes', aktualisiert_am = now()
      from kandidaten k where a.id = k.id
      returning a.id,a.ereignis_id,a.empfaenger_schluessel
  )
  select b.id,e.typ,m.id,m.schiedsrichter_id,'feedback_' || e.referenz_id::text
    from beansprucht b
    join public.benachrichtigungs_ereignisse e on e.id = b.ereignis_id
    join public.frage_meldung_eintraege f on f.id = e.referenz_id
    join public.frage_meldungen m on m.id = f.meldung_id;
end $function$;

create or replace function public.schiri_push_zustellliste(p_auftrag_id uuid)
returns table(id uuid,endpunkt text,p256dh text,auth text)
language plpgsql security definer set search_path to '' as $function$
begin
  return query select b.id,b.endpunkt,b.p256dh,b.auth
    from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_ereignisse e on e.id = a.ereignis_id
    join public.frage_meldung_eintraege f on f.id = e.referenz_id
    join public.frage_meldungen m on m.id = f.meldung_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id = m.schiedsrichter_id
    join public.push_abos b on b.schiedsrichter_id = m.schiedsrichter_id
   where a.id = p_auftrag_id and a.kanal = 'web_push' and a.status = 'in_arbeit'
     and a.empfaenger_schluessel = 's_' || m.schiedsrichter_id::text
     and e.typ = 'frage_feedback.antwort' and p.feedback_antwort
     and f.rueckmeldung_obmann is not null
     and f.rueckmeldung_am = (e.metadaten->>'antwort_am')::timestamptz
     and b.gueltig_bis > now();
end $function$;

-- Beim Loeschen einer Person keine verwaisten persoenlichen Empfaenger.
create or replace function public.schiri_push_person_entfernen()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  delete from public.benachrichtigungs_auftraege a
   where a.empfaenger_schluessel = 's_' || old.id::text;
  delete from public.benachrichtigungs_einstellungen e
   where e.empfaenger_schluessel = 's_' || old.id::text;
  return old;
end $function$;
drop trigger if exists schiri_push_person_entfernen on public.schiedsrichter;
create trigger schiri_push_person_entfernen
  before delete on public.schiedsrichter
  for each row execute function public.schiri_push_person_entfernen();

revoke all on function public.schiri_push_einstellungen(uuid,text) from public,anon,authenticated;
revoke all on function public.schiri_push_feedback_setzen(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.schiri_push_geraet_entfernen(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.push_abo_speichern(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.push_abo_status(uuid,text,text) from public,anon,authenticated;
revoke all on function public.schiri_push_test_abo(uuid,text,text) from public,anon,authenticated;
revoke all on function public.schiri_push_feedback_trigger() from public,anon,authenticated;
revoke all on function public.schiri_push_auftraege_beanspruchen(integer) from public,anon,authenticated;
revoke all on function public.schiri_push_zustellliste(uuid) from public,anon,authenticated;
revoke all on function public.schiri_push_person_entfernen() from public,anon,authenticated;
grant execute on function public.schiri_push_einstellungen(uuid,text) to anon,authenticated;
grant execute on function public.schiri_push_feedback_setzen(uuid,text,boolean) to anon,authenticated;
grant execute on function public.schiri_push_geraet_entfernen(uuid,text,uuid) to anon,authenticated;
grant execute on function public.push_abo_speichern(uuid,text,text,text,text,text) to anon,authenticated;
grant execute on function public.push_abo_status(uuid,text,text) to anon,authenticated;
grant execute on function public.schiri_push_test_abo(uuid,text,text) to service_role;
grant execute on function public.schiri_push_auftraege_beanspruchen(integer) to service_role;
grant execute on function public.schiri_push_zustellliste(uuid) to service_role;

notify pgrst, 'reload schema';
