-- Eine Version, ein Verein. Absichtlich keine Konfiguration oder Daten bei Migration.
create schema if not exists private;
create table private.kickers_umfrage (
  einmalig boolean primary key default true check (einmalig),
  verein uuid not null references public.vereine(id),
  schluessel_hash bytea not null check (octet_length(schluessel_hash)=32),
  stand text not null default 'entwurf' check (stand in ('entwurf','offen','geschlossen')),
  schliesst_am timestamptz
);
create table private.kickers_umfrage_teilnahme (
  person uuid primary key references public.schiedsrichter(id) on delete cascade,
  antwort jsonb check (antwort is null or jsonb_typeof(antwort)='object'),
  abgegeben timestamptz,
  check ((antwort is null) = (abgegeben is null))
);
create table private.kickers_umfrage_versuche (
  person uuid primary key references private.kickers_umfrage_teilnahme(person) on delete cascade,
  seit timestamptz not null default clock_timestamp(),
  anzahl integer not null default 0
);
alter table private.kickers_umfrage enable row level security;
alter table private.kickers_umfrage_teilnahme enable row level security;
alter table private.kickers_umfrage_versuche enable row level security;
revoke all on private.kickers_umfrage, private.kickers_umfrage_teilnahme, private.kickers_umfrage_versuche from public, anon, authenticated;

create function private.kickers_stimmungsbild(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  a text := p->>'aktion'; v uuid; m uuid;
  u private.kickers_umfrage%rowtype; f private.kickers_umfrage_versuche%rowtype;
  t timestamptz;
begin
  -- Einziger Aufrufer ist der service-only Gateway hinter dem serverseitigen Handler.
  if a in ('obmann-stand','obmann-oeffnen','obmann-schliessen') then
    select * into u from private.kickers_umfrage where einmalig;
    if not found or u.schluessel_hash is distinct from sha256(convert_to(p->>'schluessel','UTF8'))
      then return '{"fehler":"zugang"}'; end if;
    if a='obmann-oeffnen' then
      update private.kickers_umfrage set stand='offen'
      where einmalig and stand='entwurf' and (u.schliesst_am is null or u.schliesst_am>clock_timestamp()) and exists (
        select 1 from private.kickers_umfrage_teilnahme k join public.schiedsrichter s on s.id=k.person
        where s.verein_id=u.verein and s.aktiv);
    elsif a='obmann-schliessen' then
      update private.kickers_umfrage set stand='geschlossen' where einmalig and stand='offen';
    end if;
    return jsonb_build_object('stand',(select case
      when stand='offen' and schliesst_am<=clock_timestamp() then 'geschlossen'
      else stand end from private.kickers_umfrage where einmalig),
      'personen', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'antwort',k.antwort) order by s.name,s.id)
        from private.kickers_umfrage_teilnahme k join public.schiedsrichter s on s.id=k.person
        where s.verein_id=u.verein and (s.aktiv or k.antwort is not null)),'[]'::jsonb));
  end if;

  if a is null or a not in ('status','abgeben') then return '{"fehler":"eingabe"}'; end if;
  m := (p->>'person')::uuid;
  -- Gemeinsame Sperre: Ende und Abgabe sind geordnet; kein Schreiben nach Schluss.
  select * into u from private.kickers_umfrage where einmalig for share;
  if not found or not exists (select 1 from private.kickers_umfrage_teilnahme k
      join public.schiedsrichter s on s.id=k.person
      where s.id=m and s.aktiv and s.verein_id=u.verein) then return '{"stand":"zu"}'; end if;
  insert into private.kickers_umfrage_versuche(person) values(m) on conflict do nothing;
  select * into f from private.kickers_umfrage_versuche where person=m for update;
  t:=clock_timestamp();
  if f.seit<=t-interval '15 minutes' then f.seit:=t; f.anzahl:=0; end if;
  if f.anzahl>=5 then return '{"fehler":"warte"}'; end if;
  begin v:=public.schiri_pin_pruefen(m,p->>'pin'); exception when raise_exception then v:=null; end;
  if v is distinct from u.verein then
    update private.kickers_umfrage_versuche set seit=f.seit,anzahl=f.anzahl+1 where person=m;
    return '{"stand":"zu"}';
  end if;
  update private.kickers_umfrage_versuche set seit=t,anzahl=0 where person=m and anzahl<>0;
  if exists(select 1 from private.kickers_umfrage_teilnahme where person=m and antwort is not null) then
    return '{"stand":"fertig"}';
  end if;
  t:=clock_timestamp();
  if u.stand<>'offen' or u.schliesst_am<=t then return '{"stand":"zu"}'; end if;
  if a='status' then return '{"stand":"offen"}'; end if;
  if jsonb_typeof(p->'antwort') is distinct from 'object' or octet_length((p->'antwort')::text)>22000 then
    return '{"fehler":"eingabe"}';
  end if;
  update private.kickers_umfrage_teilnahme set antwort=p->'antwort', abgegeben=t
  where person=m and antwort is null;
  return '{"stand":"fertig"}';
end;
$$;
revoke all on function private.kickers_stimmungsbild(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.kickers_stimmungsbild(jsonb) to service_role;
create function public.kickers_stimmungsbild_gateway(p jsonb) returns jsonb
language sql security invoker set search_path='' return private.kickers_stimmungsbild(p);
revoke all on function public.kickers_stimmungsbild_gateway(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.kickers_stimmungsbild_gateway(jsonb) to service_role;
