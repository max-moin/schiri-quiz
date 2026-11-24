-- Additive rollout: no pilot rows or pilot credentials are migrated.
create table private.szenencheck_v2_runden (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  titel text not null check (length(btrim(titel)) between 1 and 140),
  typ text not null check (typ in ('aktuell','reserve')),
  szenen jsonb not null check (jsonb_typeof(szenen)='array' and jsonb_array_length(szenen) between 1 and 30),
  tester uuid[] not null default '{}' check (cardinality(tester)<=30),
  testverein uuid references public.vereine(id) on delete set null,
  vorschau timestamptz,
  beginn timestamptz not null,
  schluss timestamptz not null,
  aufloesung timestamptz,
  freigegeben boolean not null default false,
  pausiert boolean not null default false,
  zurueckgezogen boolean not null default false,
  einordnungen jsonb not null default '{}' check (jsonb_typeof(einordnungen)='object'),
  erstellt timestamptz not null default now(),
  check (schluss>beginn and (aufloesung is null or aufloesung>=schluss))
);
create index szenencheck_v2_verein_idx on private.szenencheck_v2_runden(verein_id,beginn desc);
create index szenencheck_v2_testverein_idx on private.szenencheck_v2_runden(testverein) where testverein is not null;
create index szenencheck_v2_tester_idx on private.szenencheck_v2_runden using gin(tester);
create table private.szenencheck_v2_stimmen (
  runde uuid not null references private.szenencheck_v2_runden(id) on delete cascade,
  szene uuid not null,
  person uuid not null references public.schiedsrichter(id) on delete cascade,
  test boolean not null,
  antwort jsonb not null,
  primary key(runde,test,szene,person)
);
create index szenencheck_v2_stimmen_person_idx on private.szenencheck_v2_stimmen(person);
alter table private.szenencheck_v2_runden enable row level security;
alter table private.szenencheck_v2_stimmen enable row level security;
revoke all on private.szenencheck_v2_runden,private.szenencheck_v2_stimmen from public,anon,authenticated,service_role;

-- Both planners take the same per-club lock, in the same transaction as the write.
create function private.szenencheck_v2_kollision(v uuid, von timestamptz, bis timestamptz, ohne uuid)
returns boolean language sql set search_path='' as $$
  select exists(select 1 from private.szenencheck_v2_runden q where q.verein_id=v
    and q.freigegeben and not q.zurueckgezogen and q.id is distinct from ohne
    and q.beginn<bis and q.schluss>von)
    or exists(select 1 from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen
    and q.beginn<bis and q.schluss>von);
$$;
create function private.szenencheck_pilot_kollision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.verein_id::text,21404));
  if exists(select 1 from private.szenencheck_v2_runden q where q.verein_id=new.verein_id
    and q.freigegeben and not q.zurueckgezogen and q.beginn<new.schluss and q.schluss>new.beginn)
    then raise exception using message='szenencheck overlap',errcode='23P01'; end if;
  return new;
end;
$$;
create trigger szenencheck_pilot_kollision before insert on private.szenencheck_runden
for each row execute function private.szenencheck_pilot_kollision();
revoke all on function private.szenencheck_v2_kollision(uuid,timestamptz,timestamptz,uuid),
  private.szenencheck_pilot_kollision() from public,anon,authenticated,service_role;

-- Exposed RPC is a service-only invoker. The private worker authenticates each action.
create function private.szenencheck_v2(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  a text:=p->>'aktion'; v uuid; testv uuid; m uuid; r private.szenencheck_v2_runden;
  f private.szenencheck_versuche; t timestamptz; von timestamptz; bis timestamptz; loesung timestamptz;
  testmodus boolean:=false; automatisch boolean; ids uuid[];
  sz jsonb; antwort jsonb:=p->'antwort'; daten jsonb; stimmen jsonb; recap jsonb; archiv jsonb; vorschauen jsonb;
  phase text; explizit boolean:=p ? 'runde'; angefragt uuid:=(p->>'runde')::uuid;
  deny constant jsonb:='{"fehler":"zugang"}';
begin
  if a in ('v2-planen','v2-verwaltung','v2-upload','v2-freigeben','v2-pause','v2-einordnen','v2-zurueckziehen') then
    begin v:=public.obmann_verein(p->>'passwort'); exception when raise_exception then return deny; end;
    if v is null then return deny; end if;
    if a in ('v2-verwaltung','v2-planen') and p ? 'testpasswort' then
      begin testv:=public.obmann_verein(p->>'testpasswort'); exception when raise_exception then return deny; end;
      if testv is null then return deny; end if;
      if testv=v then testv:=null; end if;
    end if;
    if a='v2-upload' then return jsonb_build_object('verein',v); end if;
    if a='v2-verwaltung' then
      select jsonb_agg(to_jsonb(x) order by x.erstellt desc) into daten from (
        select id,titel,beginn,schluss,aufloesung,freigegeben,pausiert,typ,erstellt,
          (select jsonb_agg(jsonb_build_object('id',e->>'id','titel',e->>'titel',
             'text',coalesce(q.einordnungen->(e->>'id')->>'text',e->>'feld',''),
             'quelle',q.einordnungen->(e->>'id')->>'quelle') order by ord)
           from jsonb_array_elements(q.szenen) with ordinality as s(e,ord)) as einordnungen
        from private.szenencheck_v2_runden q where q.verein_id=v and not q.zurueckgezogen
        order by q.erstellt desc limit 60
      ) x;
      return jsonb_build_object('runden',coalesce(daten,'[]'::jsonb),'tester',
        coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'extern',s.verein_id<>v) order by s.verein_id<>v,s.name)
          from public.schiedsrichter s where s.aktiv and s.verein_id in (v,testv)),'[]'::jsonb));
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v::text,21404));
    t:=clock_timestamp();
    if a='v2-planen' then
      von:=(p->>'beginn')::timestamptz; bis:=(p->>'schluss')::timestamptz;
      loesung:=(p->>'aufloesung')::timestamptz;
      automatisch:=coalesce((p->>'freigabe')::boolean,false);
      if automatisch then von:=greatest(von,t); end if;
      if bis<=greatest(von,t) or (loesung is not null and loesung<bis)
        or ((p->>'vorschau')::timestamptz>von) then return '{"fehler":"zeit"}'; end if;
      select coalesce(array_agg(distinct id),'{}') into ids from
        (select value::uuid id from jsonb_array_elements_text(coalesce(p->'tester','[]'))) x;
      -- Foreign testers need a second, separately authenticated organizer context.
      if exists(select 1 from unnest(ids) i(id) where not exists(select 1 from public.schiedsrichter s
        where s.id=i.id and s.aktiv and s.verein_id in (v,testv))) then return '{"fehler":"tester"}'; end if;
      if automatisch and private.szenencheck_v2_kollision(v,von,bis,null) then return '{"fehler":"ueberschneidung"}'; end if;
      for sz in select value from jsonb_array_elements(p->'szenen') loop
        if sz ? 'datei' and (sz->>'datei' not like v::text || '/%' or not exists(
          select 1 from storage.objects o where o.bucket_id='szenencheck-clips' and o.name=sz->>'datei'))
          then return '{"fehler":"clip"}'; end if;
      end loop;
      insert into private.szenencheck_v2_runden(verein_id,titel,typ,szenen,tester,testverein,vorschau,beginn,schluss,aufloesung,freigegeben)
        values(v,p->>'titel',p->>'typ',p->'szenen',ids,testv,(p->>'vorschau')::timestamptz,von,bis,loesung,automatisch)
        returning * into r;
      return jsonb_build_object('id',r.id);
    end if;
    select * into r from private.szenencheck_v2_runden q where q.id=angefragt and q.verein_id=v
      and not q.zurueckgezogen for update;
    if not found then return '{"fehler":"runde"}'; end if;
    if a='v2-freigeben' then
      if r.freigegeben then return '{"fehler":"fest"}'; end if;
      von:=case when (p->>'sofort')::boolean then t else greatest(t,coalesce((p->>'beginn')::timestamptz,r.beginn)) end;
      bis:=coalesce((p->>'schluss')::timestamptz,r.schluss);
      loesung:=case when p ? 'schluss' then (p->>'aufloesung')::timestamptz else r.aufloesung end;
      if bis<=von or loesung<bis or r.vorschau>von then return '{"fehler":"zeit"}'; end if;
      if private.szenencheck_v2_kollision(v,von,bis,r.id) then return '{"fehler":"ueberschneidung"}'; end if;
      update private.szenencheck_v2_runden set freigegeben=true,beginn=von,schluss=bis,aufloesung=loesung where id=r.id;
    elsif a='v2-pause' then
      if t>=r.schluss then return '{"fehler":"geschlossen"}'; end if;
      update private.szenencheck_v2_runden set pausiert=(p->>'pausiert')::boolean where id=r.id;
    elsif a='v2-zurueckziehen' then
      update private.szenencheck_v2_runden set zurueckgezogen=true where id=r.id;
    elsif a='v2-einordnen' then
      if not r.freigegeben or t<r.schluss then return '{"fehler":"noch_offen"}'; end if;
      if r.aufloesung is not null and r.aufloesung<=t then return '{"fehler":"fest"}'; end if;
      if exists(select 1 from jsonb_object_keys(p->'einordnungen') k
        where not exists(select 1 from jsonb_array_elements(r.szenen) e where e->>'id'=k))
        then return '{"fehler":"runde"}'; end if;
      update private.szenencheck_v2_runden set einordnungen=p->'einordnungen',
        aufloesung=case when (p->>'sofort')::boolean then t else aufloesung end where id=r.id;
    end if;
    return '{"ok":true}';
  end if;

  if a not in ('v2-laden','v2-stimme','v2-video') then return '{"fehler":"anfrage"}'; end if;
  m:=(p->>'person')::uuid;
  if not exists(select 1 from public.schiedsrichter s where s.id=m and s.aktiv) then return deny; end if;
  insert into private.szenencheck_versuche(person) values(m) on conflict do nothing;
  select * into f from private.szenencheck_versuche where person=m for update;
  t:=clock_timestamp();
  if f.seit<=t-interval '15 minutes' then f.seit:=t; f.anzahl:=0; end if;
  if f.anzahl>=5 then return '{"fehler":"warte"}'; end if;
  begin v:=public.schiri_pin_pruefen(m,p->>'pin'); exception when raise_exception then v:=null; end;
  if v is null or not exists(select 1 from public.schiedsrichter s where s.id=m and s.aktiv and s.verein_id=v)
    then update private.szenencheck_versuche set seit=f.seit,anzahl=f.anzahl+1 where person=m; return deny; end if;
  update private.szenencheck_versuche set seit=t,anzahl=0 where person=m and anzahl<>0;

  if a='v2-laden' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.beginn),'[]'::jsonb) into vorschauen from (
      select id,titel,beginn from private.szenencheck_v2_runden q where v in (q.verein_id,q.testverein) and not q.zurueckgezogen
        and q.tester @> array[m] and q.vorschau<=t and q.schluss>t and (not q.freigegeben or q.beginn>t)
        order by q.beginn limit 12
    ) x;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.beginn desc),'[]'::jsonb) into archiv from (
      select id,titel,beginn from private.szenencheck_v2_runden where verein_id=v and freigegeben
        and not zurueckgezogen and aufloesung<=t order by beginn desc limit 12
    ) x;
  end if;
  if a='v2-laden' and not explizit then
    select * into r from private.szenencheck_v2_runden q where q.verein_id=v and q.freigegeben and not q.zurueckgezogen
      and q.beginn<=t and q.schluss>t order by q.beginn desc limit 1;
    if not found and jsonb_array_length(vorschauen)=0 and exists(select 1 from private.szenencheck_runden q where q.verein_id=v
      and not q.zurueckgezogen and q.beginn<=t and q.schluss>t) then return '{"phase":"pilot"}'; end if;
    if r.id is null then
      select * into r from private.szenencheck_v2_runden q where v in (q.verein_id,q.testverein) and not q.zurueckgezogen
        and q.tester @> array[m] and q.vorschau<=t and q.schluss>t and (not q.freigegeben or q.beginn>t)
        order by q.vorschau desc limit 1;
    end if;
    if r.id is null then
      select * into r from private.szenencheck_v2_runden q where q.verein_id=v and q.freigegeben and not q.zurueckgezogen
        order by (q.beginn<=t) desc,
          case when q.beginn>t then q.beginn end asc, q.beginn desc limit 1;
    end if;
    if r.id is null then
      if exists(select 1 from private.szenencheck_runden q where q.verein_id=v and not q.zurueckgezogen)
        then return '{"phase":"pilot"}'; end if;
      return '{"phase":"leer"}';
    end if;
  else
    select * into r from private.szenencheck_v2_runden q where q.id=angefragt and not q.zurueckgezogen
      and (q.verein_id=v or (q.testverein=v and q.tester @> array[m] and (not q.freigegeben or q.beginn>t)))
      for share;
    if not found then return '{"fehler":"runde"}'; end if;
    t:=clock_timestamp();
  end if;
  testmodus:=not (r.freigegeben and r.beginn<=t);
  if r.verein_id<>v and not testmodus then return '{"fehler":"runde"}'; end if;
  if testmodus and not coalesce(r.tester @> array[m] and r.vorschau<=t and r.schluss>t,false) then
    if a='v2-laden' and not explizit and r.freigegeben
      then return jsonb_build_object('phase','geplant','beginn',r.beginn,'archiv',archiv,'vorschauen',vorschauen); end if;
    return '{"fehler":"runde"}';
  end if;
  phase:=case when r.pausiert and t<r.schluss then 'pausiert' when testmodus then 'test'
    when t<r.schluss then 'offen' when r.aufloesung<=t then 'recap' else 'geschlossen' end;
  if phase='pausiert' or phase='geschlossen' then
    if a='v2-laden' then
      return jsonb_build_object('phase',phase,'id',r.id,'schluss',r.schluss,'aufloesung',r.aufloesung,'archiv',archiv,'vorschauen',vorschauen);
    end if;
    return '{"fehler":"geschlossen"}';
  end if;
  if a='v2-laden' then
    select jsonb_agg((e-'datei'-'feld') || jsonb_build_object('privat',e ? 'datei') ||
      case when phase='recap' then jsonb_build_object('feld',coalesce(r.einordnungen->(e->>'id')->>'text',e->>'feld'),
        'quelle',r.einordnungen->(e->>'id')->>'quelle') else '{}'::jsonb end order by ord)
      into daten from jsonb_array_elements(r.szenen) with ordinality as s(e,ord);
    select jsonb_object_agg(s.szene,s.antwort) into stimmen from private.szenencheck_v2_stimmen s
      where s.runde=r.id and s.person=m and s.test=testmodus;
    if phase='recap' then
      select jsonb_object_agg(q.szene,q.werte) into recap from (
        select s.szene,jsonb_agg(jsonb_build_object('antwort',s.wert,'anzahl',s.n) order by s.n desc,s.wert) werte
        from (select z.szene,z.antwort-'text' wert,count(*) n from private.szenencheck_v2_stimmen z
          where z.runde=r.id and not z.test group by 1,2) s group by s.szene) q;
    end if;
    return jsonb_build_object('phase',phase,'id',r.id,'titel',r.titel,'typ',r.typ,'schluss',r.schluss,
      'szenen',daten,'stimmen',coalesce(stimmen,'{}'::jsonb),'recap',coalesce(recap,'{}'::jsonb),'archiv',archiv,'vorschauen',vorschauen);
  end if;
  select e into sz from jsonb_array_elements(r.szenen) s(e) where e->>'id'=p->>'szene';
  if not found then return '{"fehler":"runde"}'; end if;
  if a='v2-video' then
    if not (sz ? 'datei') then return '{"fehler":"clip"}'; end if;
    return jsonb_build_object('pfad',sz->>'datei');
  end if;
  if phase not in ('test','offen') then return '{"fehler":"geschlossen"}'; end if;
  -- A stale preview form must never become an official ballot, or vice versa.
  if (p->>'test')::boolean is distinct from testmodus then return '{"fehler":"phase"}'; end if;
  if not coalesce(antwort='{"enthaltung":true}'::jsonb or (case sz->>'art'
    when 'pfiff' then antwort->>'pfiff' in ('foul','weiterspielen') and antwort=jsonb_build_object('pfiff',antwort->>'pfiff')
    when 'karte' then antwort->>'karte' in ('keine','gelb','gelb_rot','rot') and antwort=jsonb_build_object('karte',antwort->>'karte')
    when 'detail' then antwort->>'pfiff' in ('foul','weiterspielen') and antwort->>'karte' in ('keine','gelb','gelb_rot','rot')
      and antwort=jsonb_build_object('pfiff',antwort->>'pfiff','karte',antwort->>'karte')
    when 'multipleChoice' then (sz->'optionen') ? (antwort->>'wahl') and antwort=jsonb_build_object('wahl',antwort->>'wahl')
    when 'freitext' then length(btrim(antwort->>'text')) between 1 and 1200 and antwort=jsonb_build_object('text',antwort->>'text')
    else false end),false) then return '{"fehler":"antwort"}'; end if;
  insert into private.szenencheck_v2_stimmen(runde,test,szene,person,antwort) values(r.id,testmodus,(p->>'szene')::uuid,m,antwort)
    on conflict(runde,test,szene,person) do update set antwort=excluded.antwort;
  return '{"ok":true}';
end;
$$;
revoke all on function private.szenencheck_v2(jsonb) from public,anon,authenticated,service_role;
grant execute on function private.szenencheck_v2(jsonb) to service_role;
create function public.szenencheck_gateway_v2(p jsonb) returns jsonb language sql
security invoker set search_path='' return private.szenencheck_v2(p);
revoke all on function public.szenencheck_gateway_v2(jsonb) from public,anon,authenticated;
grant execute on function public.szenencheck_gateway_v2(jsonb) to service_role;
