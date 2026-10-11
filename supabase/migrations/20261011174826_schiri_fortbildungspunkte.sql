-- Confirmed DFBnet credits are separate from RSVP. No attendance is inferred.
-- Filename matches the live MCP migration version 20261011174826.
create table public.fortbildung_saisons (
  verein_id uuid not null references public.vereine(id) on delete cascade,
  saison text not null check (saison ~ '^20[0-9]{2}/[0-9]{2}$'),
  ziel integer not null default 5 check (ziel between 1 and 30),
  gelegenheiten integer not null default 8 check (gelegenheiten between 1 and 30),
  primary key (verein_id,saison), check (ziel <= gelegenheiten)
);
alter table public.termine add column punkte_saison text;
alter table public.termine add column punkte_art text check (punkte_art in ('rla','hrt','jhv','u18'));
alter table public.termine add column zeitraum_von date;
alter table public.termine add constraint termine_punkte_saison_fk foreign key (verein_id,punkte_saison)
  references public.fortbildung_saisons(verein_id,saison);
create index termine_punkte_saison_idx on public.termine(verein_id,punkte_saison);
alter table public.termine drop constraint termine_art_gueltig;
alter table public.termine add constraint termine_art_gueltig check (art in ('lehrabend','lehrgang','treff','event','sonstiges','hausregeltest'));
create table public.fortbildung_nachweise (
  termin_id uuid not null references public.termine(id) on delete restrict,
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  gewertet boolean not null,
  bestaetigt_am timestamptz not null default now(),
  notiz text not null default '' check (length(notiz)<=1000),
  version integer not null default 1,
  primary key(termin_id,schiedsrichter_id)
);
create index fortbildung_nachweise_person_idx on public.fortbildung_nachweise(schiedsrichter_id);
create table public.fortbildung_korrekturen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  termin_id uuid not null references public.termine(id) on delete restrict,
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  vorher boolean, nachher boolean not null, notiz text not null,
  erstellt_am timestamptz not null default now(), quelle text not null default 'Obmann / DFBnet-Abgleich'
);
create index fortbildung_korrekturen_verein_idx on public.fortbildung_korrekturen(verein_id);
create index fortbildung_korrekturen_termin_idx on public.fortbildung_korrekturen(termin_id);
create index fortbildung_korrekturen_person_idx on public.fortbildung_korrekturen(schiedsrichter_id);
alter table public.fortbildung_saisons enable row level security;
alter table public.fortbildung_nachweise enable row level security;
alter table public.fortbildung_korrekturen enable row level security;
revoke all on public.fortbildung_saisons,public.fortbildung_nachweise,public.fortbildung_korrekturen from public,anon,authenticated;

-- Existing writers are constrained too; old app builds cannot turn HRT into RSVP.
create function public.fortbildung_termin_pruefen() returns trigger language plpgsql
set search_path='' as $$
declare v_jahr integer;
begin
  if (new.punkte_saison is null) <> (new.punkte_art is null) then
    raise exception 'Saison und Punkteart gemeinsam angeben';
  end if;
  if new.punkte_saison is not null then
    v_jahr := left(new.punkte_saison,4)::integer;
    if right(new.punkte_saison,2) <> right((v_jahr+1)::text,2)
       or new.datum < make_date(v_jahr,7,1) or new.datum >= make_date(v_jahr+1,7,1) then
      raise exception 'Termin liegt nicht in der gewählten Saison';
    end if;
  end if;
  if new.art='hausregeltest' then
    if new.punkte_art is distinct from 'hrt' or new.zeitraum_von is null or new.zeitraum_von>new.datum then
      raise exception 'Hausregeltest braucht Saison, Punkteart und einen Zeitraum bis zur Abgabe';
    end if;
    new.rueckmeldung_erforderlich:=false; new.rueckmeldung_bis:=null;
    new.beginn_zeit:=null; new.ende_zeit:=null; new.erinnerung_modus:='aus';
  elsif new.zeitraum_von is not null or new.punkte_art='hrt' then
    raise exception 'Bearbeitungszeitraum ist nur für Hausregeltests vorgesehen';
  end if;
  if tg_op='UPDATE' and (old.punkte_saison is distinct from new.punkte_saison or old.punkte_art is distinct from new.punkte_art)
     and exists(select 1 from public.fortbildung_nachweise n where n.termin_id=old.id) then
    raise exception 'Erfasste Nachweise zuerst berichtigen; Saison oder Punkteart darf nicht verändert werden';
  end if;
  return new;
end $$;
create trigger fortbildung_termin_pruefen before insert or update on public.termine
for each row execute function public.fortbildung_termin_pruefen();
revoke all on function public.fortbildung_termin_pruefen() from public,anon,authenticated;

-- One transaction for the original save and the new fields. Trigger validation
-- is deferred to the final update by saving HRT initially as sonstiges.
create function public.obmann_termin_mit_punkten_speichern(
  p_passwort text,p_titel text,p_datum date,p_oeffentlich boolean,p_art text,p_pflicht boolean,
  p_rueckmeldung_erforderlich boolean,p_veranstalter text,p_erinnerung_modus text,
  p_sichtbarkeit text default null,p_termin_id uuid default null,p_beschreibung text default null,
  p_beginn_zeit time default null,p_ende_zeit time default null,p_ort text default null,
  p_rueckmeldung_bis date default null,p_notiz_obmann text default null,
  p_punkte_saison text default null,p_punkte_art text default null,p_zeitraum_von date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_id uuid; v_art text;
begin
  v_verein:=public.obmann_verein(p_passwort);
  if p_punkte_saison is not null then
    insert into public.fortbildung_saisons(verein_id,saison) values(v_verein,p_punkte_saison) on conflict do nothing;
  end if;
  -- Keep existing HRT metadata valid during the legacy save.
  select t.art into v_art from public.termine t where t.id=p_termin_id and t.verein_id=v_verein;
  v_id:=public.obmann_termin_speichern_mit_erinnerung(p_passwort,p_titel,p_datum,p_oeffentlich,
    case when p_art='hausregeltest' then coalesce(v_art,'sonstiges') else p_art end,
    p_pflicht,case when p_art='hausregeltest' then false else p_rueckmeldung_erforderlich end,
    p_veranstalter,case when p_art='hausregeltest' then 'aus' else p_erinnerung_modus end,
    p_sichtbarkeit,p_termin_id,p_beschreibung,
    case when p_art='hausregeltest' then null else p_beginn_zeit end,
    case when p_art='hausregeltest' then null else p_ende_zeit end,p_ort,p_rueckmeldung_bis,p_notiz_obmann);
  update public.termine set art=p_art,punkte_saison=p_punkte_saison,punkte_art=p_punkte_art,zeitraum_von=p_zeitraum_von where id=v_id;
  return v_id;
end $$;

create function public.obmann_termine_mit_fortbildung(p_passwort text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_verein uuid;
begin
  v_verein:=public.obmann_verein(p_passwort);
  return coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('punkte_saison',t.punkte_saison,'punkte_art',t.punkte_art,'zeitraum_von',t.zeitraum_von) order by x.datum,x.beginn_zeit)
    from public.obmann_termine_mit_stand(p_passwort) x join public.termine t on t.id=x.id and t.verein_id=v_verein),'[]'::jsonb);
end $$;

create function public.fortbildung_person_stand(p_person uuid,p_saison text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('saison',p_saison,'ziel',coalesce(c.ziel,5),'gelegenheiten',coalesce(c.gelegenheiten,8),
    'termine',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'titel',t.titel,'datum',t.datum,'zeitraum_von',t.zeitraum_von,
       'punkte_art',t.punkte_art,'gewertet',coalesce(n.gewertet,false),'erfasst',n.termin_id is not null,
       'bestaetigt_am',n.bestaetigt_am,'notiz',coalesce(n.notiz,''),
       'verlauf',coalesce((select jsonb_agg(jsonb_build_object('vorher',k.vorher,'nachher',k.nachher,'notiz',k.notiz,'erstellt_am',k.erstellt_am) order by k.erstellt_am)
         from public.fortbildung_korrekturen k where k.termin_id=t.id and k.schiedsrichter_id=p_person),'[]'::jsonb)) order by t.datum,t.id)
      from public.termine t left join public.fortbildung_nachweise n on n.termin_id=t.id and n.schiedsrichter_id=p_person
      where t.verein_id=s.verein_id and t.punkte_saison=p_saison),'[]'::jsonb))
  from public.schiedsrichter s left join public.fortbildung_saisons c on c.verein_id=s.verein_id and c.saison=p_saison where s.id=p_person;
$$;
revoke all on function public.fortbildung_person_stand(uuid,text) from public,anon,authenticated;

create function public.meine_fortbildungspunkte(p_schiedsrichter_id uuid,p_pin text,p_saison text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  return public.fortbildung_person_stand(p_schiedsrichter_id,p_saison);
end $$;
create function public.obmann_fortbildung_person(p_passwort text,p_schiedsrichter text,p_saison text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid; v_verein uuid;
begin
  v_verein:=public.obmann_verein(p_passwort);
  select s.id into v_id from public.schiedsrichter s where s.verein_id=v_verein and s.name=p_schiedsrichter;
  if v_id is null then raise exception 'Person nicht gefunden'; end if;
  return public.fortbildung_person_stand(v_id,p_saison);
end $$;
create function public.obmann_fortbildung_termin(p_passwort text,p_termin_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_verein uuid;
begin
  v_verein:=public.obmann_verein(p_passwort);
  if not exists(select 1 from public.termine t where t.id=p_termin_id and t.verein_id=v_verein and t.punkte_saison is not null) then raise exception 'Kein Fortbildungstermin'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'gewertet',coalesce(n.gewertet,false),'version',coalesce(n.version,0),
     'bestaetigt_am',n.bestaetigt_am,'notiz',coalesce(n.notiz,''),'zusagestatus',r.status) order by s.name)
    from public.schiedsrichter s left join public.fortbildung_nachweise n on n.schiedsrichter_id=s.id and n.termin_id=p_termin_id
    left join public.termin_rueckmeldungen r on r.schiedsrichter_id=s.id and r.termin_id=p_termin_id
    where s.verein_id=v_verein and not s.ist_test and (s.aktiv or n.termin_id is not null)),'[]'::jsonb);
end $$;
create function public.obmann_fortbildung_bestaetigen(p_passwort text,p_termin_id uuid,p_nachweise jsonb,p_notiz text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_t public.termine; v_n public.fortbildung_nachweise; v_e jsonb; v_id uuid; v_wert boolean; v_version integer;
begin
  v_verein:=public.obmann_verein(p_passwort);
  select * into v_t from public.termine t where t.id=p_termin_id and t.verein_id=v_verein for update;
  if v_t.id is null or v_t.punkte_saison is null then raise exception 'Kein Fortbildungstermin'; end if;
  if jsonb_typeof(p_nachweise) is distinct from 'array' or jsonb_array_length(p_nachweise)>200 or length(coalesce(p_notiz,''))>1000 then raise exception 'Ungültige Nachweise'; end if;
  if (select count(*) from jsonb_array_elements(p_nachweise)) <> (select count(distinct e->>'id') from jsonb_array_elements(p_nachweise) e) then raise exception 'Doppelte Person'; end if;
  for v_e in select value from jsonb_array_elements(p_nachweise) loop
    v_id:=(v_e->>'id')::uuid; v_wert:=(v_e->>'gewertet')::boolean; v_version:=(v_e->>'version')::integer;
    if v_wert is null or v_version is null or not exists(select 1 from public.schiedsrichter s where s.id=v_id and s.verein_id=v_verein and not s.ist_test) then raise exception 'Person oder Nachweis ungültig'; end if;
    select * into v_n from public.fortbildung_nachweise n where n.termin_id=p_termin_id and n.schiedsrichter_id=v_id for update;
    if coalesce(v_n.version,0)<>v_version then raise exception 'Stand inzwischen geändert. Bitte neu laden'; end if;
    if v_n.termin_id is null and not v_wert then continue; end if;
    if v_n.termin_id is not null and v_n.gewertet=v_wert then continue; end if;
    if v_wert and coalesce(v_t.zeitraum_von,v_t.datum)>(now() at time zone 'Europe/Berlin')::date then raise exception 'Noch nicht stattgefunden oder begonnen'; end if;
    if v_n.termin_id is not null and nullif(btrim(p_notiz),'') is null then raise exception 'Eine Korrektur braucht eine Notiz'; end if;
    insert into public.fortbildung_korrekturen(verein_id,termin_id,schiedsrichter_id,vorher,nachher,notiz)
      values(v_verein,p_termin_id,v_id,v_n.gewertet,v_wert,btrim(coalesce(p_notiz,'')));
    insert into public.fortbildung_nachweise(termin_id,schiedsrichter_id,gewertet,notiz) values(p_termin_id,v_id,v_wert,btrim(coalesce(p_notiz,'')))
      on conflict(termin_id,schiedsrichter_id) do update set gewertet=excluded.gewertet,notiz=excluded.notiz,bestaetigt_am=now(),version=public.fortbildung_nachweise.version+1;
  end loop;
end $$;

-- RPC wrappers retain the original visibility checks and add only time-window metadata.
create function public.termine_fuer_schiri_mit_fortbildung(p_schiedsrichter_id uuid,p_pin text,p_seitenschluessel text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('zeitraum_von',t.zeitraum_von)), '[]'::jsonb)
  from public.termine_fuer_schiri_v2(p_schiedsrichter_id,p_pin,p_seitenschluessel) x join public.termine t on t.id=x.id;
$$;
create function public.oeffentliche_termine_mit_fortbildung(p_seitenschluessel text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('zeitraum_von',t.zeitraum_von)), '[]'::jsonb)
  from public.oeffentliche_termine_alle(p_seitenschluessel) x join public.termine t on t.id=x.id;
$$;
do $$ declare r record; begin
  for r in select p.oid::regprocedure sig from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
    ('obmann_termin_mit_punkten_speichern','obmann_termine_mit_fortbildung','meine_fortbildungspunkte','obmann_fortbildung_person','obmann_fortbildung_termin','obmann_fortbildung_bestaetigen','termine_fuer_schiri_mit_fortbildung','oeffentliche_termine_mit_fortbildung') loop
    execute format('revoke all on function %s from public,anon,authenticated',r.sig);
    execute format('grant execute on function %s to anon,authenticated,service_role',r.sig);
  end loop;
end $$;
