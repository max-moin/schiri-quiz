-- Live-Migration 20261011205153; keine Supabase-CLI auf diesem Rechner.
-- Entscheidungsmails an Max erst, wenn alle Positionen entschieden sind.
-- Kleine private Prüfliste statt Warten im Artikel-Trigger: auch zwei
-- parallele Transaktionen werden beim nächsten Versandlauf zusammengeführt.
create table public.benachrichtigung_buendel_pruefungen (
  buendel_id uuid not null references public.ausruestungs_buendel(id) on delete cascade,
  phase text not null check (phase in ('entscheidung','zahlung')),
  erstellt_am timestamptz not null default now(),
  primary key (buendel_id, phase)
);
alter table public.benachrichtigung_buendel_pruefungen enable row level security;
revoke all on public.benachrichtigung_buendel_pruefungen from public,anon,authenticated;
grant all on public.benachrichtigung_buendel_pruefungen to service_role;

create or replace function public.benachrichtigung_ausruestung_trigger()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_typ text; v_name text; v_anzahl integer; v_buendel uuid;
begin
  if new.akteur_rolle = 'schiri' and new.schritt in
      ('eingereicht','beleg_hochgeladen','geld_erhalten') then
    if new.schritt = 'eingereicht' and not new.eingang then return new; end if;
    v_typ := 'ausruestung.' || new.schritt;
  elsif new.akteur_rolle = 'vorstand' and new.schritt in
      ('freigegeben','abgelehnt','zahlung_angewiesen') then
    v_typ := 'ausruestung.' || new.schritt;
  else return new;
  end if;
  select public.benachrichtigung_kurzname(s.name), b.positionen_anzahl, a.buendel_id
    into v_name,v_anzahl,v_buendel
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
    left join public.ausruestungs_buendel b on b.id=a.buendel_id
   where a.id=new.anfrage_id;
  if v_buendel is not null and new.akteur_rolle='vorstand' then
    insert into public.benachrichtigung_buendel_pruefungen(buendel_id,phase)
    values(v_buendel,case when new.schritt='zahlung_angewiesen' then 'zahlung' else 'entscheidung' end)
    on conflict do nothing;
    return new;
  end if;
  perform public.benachrichtigung_einreihen(new.verein_id,v_typ,'ausruestungsanfrage',new.anfrage_id,
    'ausruestung:'||new.schluessel,
    jsonb_strip_nulls(jsonb_build_object('anzeigename',v_name,'anzahl',v_anzahl)));
  return new;
end $function$;

create function public.benachrichtigung_buendel_pruefen()
returns integer language plpgsql security definer set search_path to '' as $function$
declare p record; v_verein uuid; v_name text; v_anzahl integer; v_offen integer;
  v_ja integer; v_nein integer; v_runden text; v_typ text; v_erstellt integer:=0;
begin
  for p in select q.buendel_id,q.phase from public.benachrichtigung_buendel_pruefungen q
    order by q.erstellt_am,q.buendel_id for update skip locked limit 50
  loop
    select s.verein_id,public.benachrichtigung_kurzname(s.name) into v_verein,v_name
      from public.ausruestungs_buendel b join public.schiedsrichter s on s.id=b.schiedsrichter_id
     where b.id=p.buendel_id;
    select count(*),
      count(*) filter(where case when p.phase='entscheidung'
        then a.prozess_status in ('eingereicht','geprueft','vorgelegt')
        else coalesce(a.beschaffungsweg,'weg2_schiri_besorgt')='weg2_schiri_besorgt'
          and a.freigabe_status='freigegeben' and not a.keine_zahlung_faellig
          and a.prozess_status not in ('zahlung_angewiesen','geld_erhalten','abgeschlossen','zurueckgezogen','abgelehnt') end),
      count(*) filter(where a.freigabe_status='freigegeben'),
      count(*) filter(where a.prozess_status='abgelehnt'),
      md5(string_agg(a.id::text||':'||a.prozess_runde::text,',' order by a.id))
      into v_anzahl,v_offen,v_ja,v_nein,v_runden
      from public.ausruestungs_anfragen a where a.buendel_id=p.buendel_id;
    if v_anzahl=0 then
      delete from public.benachrichtigung_buendel_pruefungen q where q.buendel_id=p.buendel_id and q.phase=p.phase;
      continue;
    end if;
    if v_offen>0 then continue; end if;
    v_typ := case when p.phase='zahlung' then 'ausruestung.zahlung_angewiesen'
      when v_ja=0 then 'ausruestung.abgelehnt' else 'ausruestung.freigegeben' end;
    perform public.benachrichtigung_einreihen(v_verein,v_typ,'ausruestungsbuendel',p.buendel_id,
      'ausruestung:buendel:'||p.buendel_id::text||':'||p.phase||':'||v_runden,
      jsonb_build_object('anzeigename',v_name,'anzahl',v_anzahl,'buendel_phase',p.phase,
        'freigegeben',v_ja,'abgelehnt',v_nein));
    delete from public.benachrichtigung_buendel_pruefungen q where q.buendel_id=p.buendel_id and q.phase=p.phase;
    v_erstellt:=v_erstellt+1;
  end loop;
  return v_erstellt;
end $function$;
revoke all on function public.benachrichtigung_buendel_pruefen() from public,anon,authenticated;
grant execute on function public.benachrichtigung_buendel_pruefen() to service_role;

create or replace function public.benachrichtigung_auftraege_v2_beanspruchen(p_limit integer default 10)
returns table(auftrag_id uuid,ereignis_id uuid,typ text,metadaten jsonb,versuch integer,
  idempotenzschluessel text,empfaenger_schluessel text,ziel_email text)
language plpgsql security definer set search_path to '' as $function$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,10),50));
begin
  perform public.benachrichtigung_buendel_pruefen();
  return query with kandidaten as (
    select a.id from public.benachrichtigungs_auftraege a
    join public.benachrichtigungs_einstellungen k on k.empfaenger_schluessel=a.empfaenger_schluessel
    left join public.freigabe_links l on l.id=k.freigabe_link_id
    where k.email_aktiv and a.kanal='email'
      and a.status in ('offen','fehlgeschlagen','in_arbeit') and a.naechster_versuch_am<=now()
      and (a.gesperrt_bis is null or a.gesperrt_bis<now()) and a.versuche<5
      and (k.freigabe_link_id is null or (l.widerrufen_am is null and (l.gueltig_bis is null or l.gueltig_bis>now())))
    order by a.erstellt_am for update of a skip locked limit v_limit
  ),beansprucht as (
    update public.benachrichtigungs_auftraege a set status='in_arbeit',versuche=a.versuche+1,
      gesperrt_bis=now()+interval '5 minutes',aktualisiert_am=now()
    from kandidaten k where a.id=k.id
    returning a.id,a.ereignis_id,a.versuche,a.empfaenger_schluessel
  ) select b.id,e.id,e.typ,e.metadaten,b.versuche,'obmann-email/'||b.id::text,
      b.empfaenger_schluessel,k.email_ziel
    from beansprucht b join public.benachrichtigungs_ereignisse e on e.id=b.ereignis_id
    join public.benachrichtigungs_einstellungen k on k.empfaenger_schluessel=b.empfaenger_schluessel;
end $function$;
-- Keine historischen Mails nachholen, keine bestehenden Aufträge löschen.
notify pgrst,'reload schema';
