-- A separate, ungraded mode. No changes to the weekly quiz or HRT.
create table private.szenencheck_code (
  verein_id uuid primary key references public.vereine(id) on delete cascade,
  hash text not null
);
create table private.szenencheck_versuche (
  person uuid primary key references public.schiedsrichter(id) on delete cascade,
  anzahl int not null default 0, seit timestamptz not null default now()
);
create table private.szenencheck_runden (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  titel text not null, beginn timestamptz not null, schluss timestamptz not null,
  szenen jsonb not null, zurueckgezogen boolean not null default false,
  check (schluss > beginn),
  check (jsonb_typeof(szenen) = 'array' and jsonb_array_length(szenen) between 1 and 30)
);
create index szenencheck_runden_verein_idx on private.szenencheck_runden(verein_id, beginn desc);
create table private.szenencheck_stimmen (
  runde uuid not null references private.szenencheck_runden(id) on delete cascade,
  szene uuid not null,
  person uuid not null references public.schiedsrichter(id) on delete cascade,
  antwort jsonb not null,
  primary key (runde, szene, person)
);
create index szenencheck_stimmen_person_idx on private.szenencheck_stimmen(person);

alter table private.szenencheck_code enable row level security;
alter table private.szenencheck_versuche enable row level security;
alter table private.szenencheck_runden enable row level security;
alter table private.szenencheck_stimmen enable row level security;
revoke all on private.szenencheck_code, private.szenencheck_versuche,
  private.szenencheck_runden, private.szenencheck_stimmen from public, anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('szenencheck-clips', 'szenencheck-clips', false, 50000000, array['video/mp4']);

-- Only the Edge Function may call this entry point. It validates the shape and
-- limits of input first. Membership is rechecked for every protected request.
create function public.szenencheck_gateway(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  aktion text := p->>'aktion';
  v uuid; mitglied uuid; r private.szenencheck_runden;
  fehl private.szenencheck_versuche; codehash text;
  sz jsonb; a jsonb := p->'antwort'; szenen jsonb; stimmen jsonb; recap jsonb; archiv jsonb;
  startzeit timestamptz; endzeit timestamptz; phase text;
  verweigert constant jsonb := '{"fehler":"zugang"}';
begin
  if aktion in ('planen','upload','verwaltung','zurueckziehen') then
    begin
      v := public.obmann_verein(p->>'passwort');
    exception when raise_exception then return verweigert;
    end;
    if v is null or not exists(select 1 from private.szenencheck_code c where c.verein_id=v)
      then return verweigert; end if;
    if aktion='upload' then return jsonb_build_object('verein',v); end if;
    if aktion='verwaltung' then
      select jsonb_agg(to_jsonb(q) order by q.beginn desc) into szenen from (
        select id,titel,beginn,schluss from private.szenencheck_runden
          where verein_id=v and not zurueckgezogen order by beginn desc limit 30
      ) q;
      return jsonb_build_object('runden',coalesce(szenen,'[]'::jsonb));
    end if;
    if aktion='zurueckziehen' then
      update private.szenencheck_runden set zurueckgezogen=true where verein_id=v and id=(p->>'runde')::uuid;
      if not found then return '{"fehler":"runde"}'; end if;
      return '{"ok":true}';
    end if;

    startzeit := (p->>'beginn')::timestamptz;
    endzeit := (p->>'schluss')::timestamptz;
    -- Small clock allowance for a round starting now, never back-date visibility.
    if startzeit < now()-interval '5 minutes' or endzeit <= greatest(startzeit,now())
      then return '{"fehler":"zeit"}'; end if;
    startzeit := greatest(startzeit, now());
    szenen := p->'szenen';
    perform pg_advisory_xact_lock(hashtextextended(v::text, 21404));
    if exists(select 1 from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen
      and q.beginn<endzeit and q.schluss>startzeit) then return '{"fehler":"ueberschneidung"}'; end if;
    for sz in select value from jsonb_array_elements(szenen) loop
      if sz ? 'datei' and (sz->>'datei' not like v::text || '/%'
        or not exists(select 1 from storage.objects o
          where o.bucket_id='szenencheck-clips' and o.name=sz->>'datei'))
        then return '{"fehler":"clip"}'; end if;
    end loop;
    insert into private.szenencheck_runden(verein_id,titel,beginn,schluss,szenen)
      values(v,p->>'titel',startzeit,endzeit,szenen) returning * into r;
    return jsonb_build_object('id',r.id,'beginn',r.beginn);
  end if;

  if aktion not in ('laden','stimme','video') then return '{"fehler":"anfrage"}'; end if;
  mitglied := (p->>'person')::uuid;
  if not exists(select 1 from public.schiedsrichter s where s.id=mitglied and s.aktiv)
    then return verweigert; end if;
  insert into private.szenencheck_versuche(person) values(mitglied) on conflict do nothing;
  select * into fehl from private.szenencheck_versuche f where f.person=mitglied for update;
  if fehl.seit<=now()-interval '15 minutes' then fehl.seit:=now(); fehl.anzahl:=0; end if;
  if fehl.anzahl>=5 then return '{"fehler":"warte"}'; end if;
  begin
    v:=public.schiri_pin_pruefen(mitglied,p->>'pin');
  exception when raise_exception then v:=null;
  end;
  select c.hash into codehash from private.szenencheck_code c where c.verein_id=v;
  if codehash is null or extensions.crypt(p->>'code',codehash) is distinct from codehash then
    update private.szenencheck_versuche set anzahl=fehl.anzahl+1, seit=fehl.seit where person=mitglied;
    return verweigert;
  end if;
  if fehl.anzahl<>0 then
    update private.szenencheck_versuche set anzahl=0, seit=now() where person=mitglied;
  end if;

  if aktion='laden' then
    if p ? 'runde' then
      select * into r from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen
        and q.schluss<=now() and q.id=(p->>'runde')::uuid;
      if not found then return '{"fehler":"runde"}'; end if;
    else
      select * into r from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen and q.beginn<=now()
        order by q.beginn desc limit 1;
    end if;
    if not found then
      select * into r from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen and q.beginn>now()
        order by q.beginn limit 1;
      if not found then return '{"phase":"leer"}'; end if;
      return jsonb_build_object('phase','geplant','beginn',r.beginn);
    end if;
    phase := case when now()<r.schluss then 'offen' else 'recap' end;
    select jsonb_agg(to_jsonb(q) order by q.beginn desc) into archiv from (
      select id,titel,beginn from private.szenencheck_runden where verein_id=v
        and not zurueckgezogen and schluss<=now() order by beginn desc limit 8
    ) q;
    select jsonb_agg(e - 'datei' - 'feld' || jsonb_build_object('privat',e ? 'datei')
      || case when phase='recap' and e ? 'feld' then jsonb_build_object('feld',e->>'feld') else '{}'::jsonb end
      order by pos)
      into szenen from jsonb_array_elements(r.szenen) with ordinality t(e,pos);
    select jsonb_object_agg(s.szene,s.antwort) into stimmen from private.szenencheck_stimmen s
      where s.runde=r.id and s.person=mitglied;
    if phase='recap' then
      select jsonb_object_agg(g.szene,g.werte) into recap from (
        select x.szene, jsonb_agg(jsonb_build_object('antwort',x.antwort,'anzahl',x.anzahl)) werte
        from (select s.szene,s.antwort-'text' antwort,count(*) anzahl
          from private.szenencheck_stimmen s where s.runde=r.id group by 1,2) x group by x.szene
      ) g;
    end if;
    return jsonb_build_object('phase',phase,'id',r.id,'titel',r.titel,'schluss',r.schluss,
      'szenen',szenen,'stimmen',coalesce(stimmen,'{}'::jsonb),'recap',coalesce(recap,'{}'::jsonb),
      'archiv',coalesce(archiv,'[]'::jsonb));
  end if;

  select * into r from private.szenencheck_runden q
    where q.verein_id=v and q.id=(p->>'runde')::uuid and not q.zurueckgezogen and q.beginn<=now() for share;
  if not found then return '{"fehler":"runde"}'; end if;
  select e into sz from jsonb_array_elements(r.szenen) t(e) where e->>'id'=p->>'szene';
  if not found then return '{"fehler":"runde"}'; end if;
  if aktion='video' then
    if not (sz ? 'datei') then return '{"fehler":"clip"}'; end if;
    return jsonb_build_object('pfad',sz->>'datei');
  end if;
  if clock_timestamp()>=r.schluss then return '{"fehler":"geschlossen"}'; end if;
  if a='{"enthaltung":true}'::jsonb then null;
  elsif (case sz->>'art'
    when 'pfiff' then (a->>'pfiff') in ('foul','weiterspielen') and a=jsonb_build_object('pfiff',a->>'pfiff')
    when 'karte' then (a->>'karte') in ('keine','gelb','gelb_rot','rot') and a=jsonb_build_object('karte',a->>'karte')
    when 'detail' then (a->>'pfiff') in ('foul','weiterspielen') and (a->>'karte') in ('keine','gelb','gelb_rot','rot')
      and a=jsonb_build_object('pfiff',a->>'pfiff','karte',a->>'karte')
    when 'multipleChoice' then (sz->'optionen') ? (a->>'wahl') and a=jsonb_build_object('wahl',a->>'wahl')
    when 'freitext' then length(btrim(a->>'text')) between 1 and 1200 and a=jsonb_build_object('text',a->>'text')
    else false end) then null;
  else return '{"fehler":"antwort"}'; end if;
  insert into private.szenencheck_stimmen(runde,szene,person,antwort)
    values(r.id,(p->>'szene')::uuid,mitglied,a)
    on conflict(runde,szene,person) do update set antwort=excluded.antwort;
  return '{"ok":true}';
end;
$$;
revoke all on function public.szenencheck_gateway(jsonb) from public, anon, authenticated;
grant execute on function public.szenencheck_gateway(jsonb) to service_role;
