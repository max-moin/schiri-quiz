-- Asynchrones Quizduell: fünf bereits veröffentlichte Wochenfragen, ohne
-- Einfluss auf Antworten/Scoreboard. Tabellen sind nur über enge RPCs erreichbar.
create table public.duell_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  erstellt_von uuid not null references public.schiedsrichter(id) on delete cascade,
  status text not null default 'offen' check (status in ('offen','geschlossen')),
  erstellt_am timestamptz not null default now(),
  geschlossen_am timestamptz,
  check ((status='offen' and geschlossen_am is null) or (status='geschlossen' and geschlossen_am is not null))
);
create index duell_sessions_ersteller_offen_idx on public.duell_sessions(erstellt_von,status);
create index duell_sessions_aufraeumen_idx on public.duell_sessions(geschlossen_am) where status='geschlossen';

create table public.duell_fragen (
  session_id uuid not null references public.duell_sessions(id) on delete cascade,
  frage_id uuid not null references public.fragen(id) on delete restrict,
  position smallint not null check (position between 1 and 5),
  primary key(session_id,frage_id), unique(session_id,position)
);
create index duell_fragen_frage_idx on public.duell_fragen(frage_id);

create table public.duell_teilnehmer (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.duell_sessions(id) on delete cascade,
  zugang uuid not null unique default gen_random_uuid(),
  schiedsrichter_id uuid references public.schiedsrichter(id) on delete set null,
  anzeigename text not null check (char_length(btrim(anzeigename)) between 2 and 30),
  beigetreten_am timestamptz not null default now(),
  unique(session_id,schiedsrichter_id)
);
create unique index duell_teilnehmer_name_idx on public.duell_teilnehmer(session_id,lower(anzeigename));
create index duell_teilnehmer_session_idx on public.duell_teilnehmer(session_id);

create table public.duell_antworten (
  teilnehmer_id uuid not null references public.duell_teilnehmer(id) on delete cascade,
  frage_id uuid not null references public.fragen(id) on delete restrict,
  gegebene_auswahl text[],
  gegebener_freitext text,
  korrekt boolean not null,
  feedback text,
  beantwortet_am timestamptz not null default now(),
  primary key(teilnehmer_id,frage_id),
  check ((gegebene_auswahl is not null)::integer + (gegebener_freitext is not null)::integer = 1)
);
create index duell_antworten_frage_idx on public.duell_antworten(frage_id);

create table public.duell_reaktionen (
  teilnehmer_id uuid not null references public.duell_teilnehmer(id) on delete cascade,
  frage_id uuid not null references public.fragen(id) on delete cascade,
  emoji text not null check (emoji in ('⚽','👏','😮','😂')),
  erstellt_am timestamptz not null default now(),
  primary key(teilnehmer_id,frage_id)
);

alter table public.duell_sessions enable row level security;
alter table public.duell_fragen enable row level security;
alter table public.duell_teilnehmer enable row level security;
alter table public.duell_antworten enable row level security;
alter table public.duell_reaktionen enable row level security;
revoke all on public.duell_sessions,public.duell_fragen,public.duell_teilnehmer,public.duell_antworten,public.duell_reaktionen from public,anon,authenticated;

create or replace function public.duell_aufraeumen() returns void
language sql security definer set search_path='' as $$
  delete from public.duell_sessions
  where (status='geschlossen' and geschlossen_am < now()-interval '30 days')
     or (status='offen' and erstellt_am < now()-interval '14 days');
$$;
revoke all on function public.duell_aufraeumen() from public,anon,authenticated;

create or replace function public.duell_erstellen(p_schiedsrichter_id uuid,p_pin text)
returns table(code text,zugang uuid)
language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_name text; v_session uuid; v_code text; v_zugang uuid; v_anzahl int;
begin
  perform public.duell_aufraeumen();
  select s.verein_id,s.name into v_verein,v_name from public.schiedsrichter s
   where s.id=p_schiedsrichter_id and s.pin=p_pin and coalesce(s.aktiv,false);
  if v_verein is null then raise exception 'Anmeldung ungültig'; end if;
  if (select count(*) from public.duell_sessions d where d.erstellt_von=p_schiedsrichter_id and d.status='offen')>=3 then
    raise exception 'Du kannst höchstens drei offene Duelle haben.';
  end if;
  select count(distinct f.id) into v_anzahl from public.fragen f
    join public.runden_fragen rf on rf.frage_id=f.id
    join public.runden r on r.id=rf.runde_id
    where r.startet_am<=now() and f.aktiv and f.antworttyp in ('multiple_choice','mehrfachauswahl','freitext');
  if v_anzahl<5 then raise exception 'Noch nicht genügend gespielte Fragen vorhanden.'; end if;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.duell_sessions d where d.code=v_code);
  end loop;
  insert into public.duell_sessions(code,verein_id,erstellt_von) values(v_code,v_verein,p_schiedsrichter_id)
    returning id into v_session;
  insert into public.duell_fragen(session_id,frage_id,position)
    select v_session,q.id,row_number() over(order by md5(q.id::text||v_session::text))::smallint
    from (select distinct f.id from public.fragen f join public.runden_fragen rf on rf.frage_id=f.id
          join public.runden r on r.id=rf.runde_id where r.startet_am<=now() and f.aktiv
          and f.antworttyp in ('multiple_choice','mehrfachauswahl','freitext')) q
    order by md5(q.id::text||v_session::text) limit 5;
  insert into public.duell_teilnehmer(session_id,schiedsrichter_id,anzeigename)
    values(v_session,p_schiedsrichter_id,v_name) returning duell_teilnehmer.zugang into v_zugang;
  return query select v_code,v_zugang;
end; $$;

create or replace function public.duell_beitreten(p_code text,p_anzeigename text,p_schiedsrichter_id uuid default null,p_pin text default null)
returns table(code text,zugang uuid)
language plpgsql security definer set search_path='' as $$
declare v_session uuid; v_name text:=btrim(p_anzeigename); v_zugang uuid;
begin
  perform public.duell_aufraeumen();
  select d.id into v_session from public.duell_sessions d where d.code=upper(btrim(p_code)) and d.status='offen';
  if v_session is null then raise exception 'Duell nicht gefunden oder geschlossen.'; end if;
  if p_schiedsrichter_id is not null then
    select s.name into v_name from public.schiedsrichter s where s.id=p_schiedsrichter_id and s.pin=p_pin and coalesce(s.aktiv,false);
    if v_name is null then raise exception 'Anmeldung ungültig'; end if;
  end if;
  if char_length(v_name) not between 2 and 30 then raise exception 'Bitte gib einen Namen mit 2 bis 30 Zeichen ein.'; end if;
  begin
    insert into public.duell_teilnehmer(session_id,schiedsrichter_id,anzeigename)
      values(v_session,p_schiedsrichter_id,v_name) returning duell_teilnehmer.zugang into v_zugang;
  exception when unique_violation then raise exception 'Dieser Name oder Teilnehmer ist bereits im Duell.';
  end;
  return query select upper(btrim(p_code)),v_zugang;
end; $$;

create or replace function public.duell_frage(p_zugang uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_f public.fragen%rowtype; v_pos int; v_opts jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungültig'; end if;
  select f.* into v_f from public.duell_fragen df join public.fragen f on f.id=df.frage_id
    join public.duell_sessions d on d.id=df.session_id and d.status='offen'
    where df.session_id=v_t.session_id and not exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_t.id and a.frage_id=df.frage_id)
    order by df.position limit 1;
  if not found then return jsonb_build_object('fertig',true); end if;
  select position into v_pos from public.duell_fragen where session_id=v_t.session_id and frage_id=v_f.id;
  select coalesce(jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
    jsonb_strip_nulls(jsonb_build_array(jsonb_build_object('schluessel','a','text',v_f.option_a),jsonb_build_object('schluessel','b','text',v_f.option_b),jsonb_build_object('schluessel','c','text',v_f.option_c))))
    into v_opts from public.frage_antwortoptionen o where o.frage_id=v_f.id;
  return jsonb_strip_nulls(jsonb_build_object('fertig',false,'id',v_f.id,'position',v_pos,'gesamt',5,
    'frage_text',v_f.frage_text,'medium',v_f.medium,'antworttyp',v_f.antworttyp,'antwortoptionen',v_opts,
    'video_url',v_f.video_url,'video_start_sekunden',v_f.video_start_sekunden,'video_end_sekunden',v_f.video_end_sekunden,
    'video_stumm',v_f.video_stumm,'bild_base64',v_f.bild_base64,'bild_mime',v_f.bild_mime,'bild_alt',v_f.bild_alt));
end; $$;

create or replace function public.duell_reaktionen_fuer_frage(p_zugang uuid,p_frage_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  select id into v_tid from public.duell_teilnehmer where zugang=p_zugang;
  if v_tid is null or not exists(select 1 from public.duell_antworten where teilnehmer_id=v_tid and frage_id=p_frage_id)
    then raise exception 'Erst antworten, dann Reaktionen ansehen.'; end if;
  return (select coalesce(jsonb_object_agg(x.emoji,x.anzahl),'{}'::jsonb)
    from (select emoji,count(*) anzahl from public.duell_reaktionen where frage_id=p_frage_id group by emoji)x);
end; $$;

create or replace function public.duell_antwort_auswahl(p_zugang uuid,p_frage_id uuid,p_auswahl text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_typ text; v_richtig text[]; v_gegeben text[]; v_ok boolean; v_text jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungültig'; end if;
  select f.antworttyp into v_typ from public.duell_fragen df join public.fragen f on f.id=df.frage_id
   join public.duell_sessions d on d.id=df.session_id where df.session_id=v_t.session_id and df.frage_id=p_frage_id and d.status='offen';
  if v_typ not in ('multiple_choice','mehrfachauswahl') then raise exception 'Falscher Antworttyp'; end if;
  select array_agg(distinct lower(x) order by lower(x)) into v_gegeben from unnest(p_auswahl)x;
  if v_gegeben is null or not v_gegeben<@array['a','b','c','d','e','f','g','h']::text[] then raise exception 'Ungültige Auswahl'; end if;
  select array_agg(o.schluessel order by o.schluessel),jsonb_agg(o.text order by o.position) filter(where o.ist_richtig)
    into v_richtig,v_text from public.frage_antwortoptionen o where o.frage_id=p_frage_id;
  if v_richtig is null then select array[f.richtige_option],jsonb_build_array(case f.richtige_option when 'a' then f.option_a when 'b' then f.option_b else f.option_c end) into v_richtig,v_text from public.fragen f where f.id=p_frage_id; end if;
  v_ok:=v_gegeben=v_richtig;
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_auswahl,korrekt) values(v_t.id,p_frage_id,v_gegeben,v_ok)
   on conflict(teilnehmer_id,frage_id) do nothing;
  if not found then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  return jsonb_build_object('korrekt',v_ok,'richtige_auswahl',v_richtig,'richtige_texte',v_text);
end; $$;

create or replace function public.duell_freitext_kontext(p_zugang uuid,p_frage_id uuid)
returns table(frage_text text,musterantwort text,bewertungshinweise text)
language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t join public.duell_fragen df on df.session_id=t.session_id
   join public.duell_sessions d on d.id=t.session_id where t.zugang=p_zugang and df.frage_id=p_frage_id and d.status='offen';
  if v_tid is null or exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id) then raise exception 'Frage nicht verfügbar'; end if;
  return query select f.frage_text,f.musterantwort,f.bewertungshinweise from public.fragen f where f.id=p_frage_id and f.antworttyp='freitext';
end; $$;

create or replace function public.duell_freitext_speichern(p_zugang uuid,p_frage_id uuid,p_text text,p_korrekt boolean,p_feedback text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; v_loesung text; begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t join public.duell_fragen df on df.session_id=t.session_id
   join public.duell_sessions d on d.id=t.session_id where t.zugang=p_zugang and df.frage_id=p_frage_id and d.status='offen';
  if v_tid is null then raise exception 'Frage nicht verfügbar'; end if;
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebener_freitext,korrekt,feedback)
   values(v_tid,p_frage_id,left(btrim(p_text),400),p_korrekt,left(p_feedback,300));
  select musterantwort into v_loesung from public.fragen where id=p_frage_id;
  return jsonb_build_object('korrekt',p_korrekt,'feedback',p_feedback,'musterantwort',v_loesung);
end; $$;

create or replace function public.duell_reaktion_setzen(p_zugang uuid,p_frage_id uuid,p_emoji text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  select t.id into v_tid from public.duell_teilnehmer t where t.zugang=p_zugang;
  if v_tid is null or not exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id) then raise exception 'Erst antworten, dann reagieren.'; end if;
  if p_emoji not in ('⚽','👏','😮','😂') then raise exception 'Unbekannte Reaktion'; end if;
  insert into public.duell_reaktionen(teilnehmer_id,frage_id,emoji) values(v_tid,p_frage_id,p_emoji)
   on conflict(teilnehmer_id,frage_id) do update set emoji=excluded.emoji,erstellt_am=now();
  return (select coalesce(jsonb_object_agg(x.emoji,x.anzahl),'{}') from (select emoji,count(*) anzahl from public.duell_reaktionen where frage_id=p_frage_id group by emoji)x);
end; $$;

create or replace function public.duell_stand(p_zugang uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_s public.duell_sessions%rowtype; begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang; if not found then raise exception 'Duell-Zugang ungültig'; end if;
  select * into v_s from public.duell_sessions where id=v_t.session_id;
  return jsonb_build_object('code',v_s.code,'status',v_s.status,'ich',v_t.anzeigename,
   'teilnehmer',(select jsonb_agg(jsonb_build_object('name',t.anzeigename,'richtig',coalesce(a.richtig,0),'beantwortet',coalesce(a.beantwortet,0)) order by coalesce(a.richtig,0) desc,coalesce(a.beantwortet,0) desc,t.beigetreten_am)
    from public.duell_teilnehmer t left join lateral(select count(*) beantwortet,count(*) filter(where korrekt) richtig from public.duell_antworten where teilnehmer_id=t.id)a on true where t.session_id=v_t.session_id));
end; $$;

create or replace function public.obmann_duelle(p_passwort text,p_archiv boolean default false)
returns table(id uuid,code text,status text,ersteller text,teilnehmer integer,fertig integer,erstellt_am timestamptz,geschlossen_am timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_verein uuid; begin v_verein:=public.obmann_verein(p_passwort); perform public.duell_aufraeumen();
 return query select d.id,d.code,d.status,s.name,count(distinct t.id)::int,count(distinct t.id) filter(where coalesce(a.n,0)=5)::int,d.erstellt_am,d.geschlossen_am
 from public.duell_sessions d join public.schiedsrichter s on s.id=d.erstellt_von left join public.duell_teilnehmer t on t.session_id=d.id
 left join lateral(select count(*) n from public.duell_antworten where teilnehmer_id=t.id)a on true
 where d.verein_id=v_verein and ((not p_archiv and d.status='offen') or (p_archiv and d.status='geschlossen'))
 group by d.id,s.name order by d.erstellt_am desc; end; $$;

create or replace function public.obmann_duell_schliessen(p_passwort text,p_session_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_verein uuid; begin v_verein:=public.obmann_verein(p_passwort);
 update public.duell_sessions set status='geschlossen',geschlossen_am=now() where id=p_session_id and verein_id=v_verein and status='offen'; return found; end; $$;

do $$ declare f record; begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'duell_%' or p.proname like 'obmann_duell%') loop execute format('revoke all on function %s from public,anon,authenticated',f.sig); end loop; end $$;
grant execute on function public.duell_erstellen(uuid,text),public.duell_beitreten(text,text,uuid,text),public.duell_frage(uuid),public.duell_antwort_auswahl(uuid,uuid,text[]),public.duell_reaktion_setzen(uuid,uuid,text),public.duell_reaktionen_fuer_frage(uuid,uuid),public.duell_stand(uuid) to anon;
grant execute on function public.duell_freitext_kontext(uuid,uuid),public.duell_freitext_speichern(uuid,uuid,text,boolean,text) to service_role;
grant execute on function public.obmann_duelle(text,boolean),public.obmann_duell_schliessen(text,uuid) to anon;
