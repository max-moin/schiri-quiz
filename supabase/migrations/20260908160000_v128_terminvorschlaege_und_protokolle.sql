-- v128: Terminideen von Vereinsmitgliedern und freigegebene SR-Treff-Protokolle.
-- Die Supabase-CLI ist auf diesem Rechner nicht installiert; daher wurde die
-- Migration mit dem bestehenden Zeitstempel-/Versionsschema angelegt.

create table if not exists public.termin_vorschlaege (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  titel text not null check (char_length(btrim(titel)) between 3 and 120),
  datum date not null,
  beginn_zeit time,
  ort text check (ort is null or char_length(ort) <= 160),
  begruendung text not null check (char_length(btrim(begruendung)) between 10 and 1200),
  status text not null default 'eingereicht' check (status in ('eingereicht','in_pruefung','angenommen','abgelehnt')),
  obmann_rueckmeldung text check (obmann_rueckmeldung is null or char_length(obmann_rueckmeldung) <= 800),
  erstellter_termin_id uuid references public.termine(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz not null default now()
);
alter table public.termin_vorschlaege enable row level security;
revoke all on table public.termin_vorschlaege from public, anon, authenticated;
create index if not exists termin_vorschlaege_pruefung_idx on public.termin_vorschlaege (verein_id,status,erstellt_am desc);

alter table public.termine add column if not exists protokoll_titel text;
alter table public.termine add column if not exists protokoll_inhalt text;
alter table public.termine add column if not exists protokoll_freigegeben boolean not null default false;
alter table public.termine add column if not exists protokoll_aktualisiert_am timestamptz;

create or replace function public.termin_vorschlag_einreichen(p_schiedsrichter_id uuid,p_pin text,p_titel text,p_datum date,p_beginn_zeit time default null,p_ort text default null,p_begruendung text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_verein uuid; v_id uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_datum < current_date then raise exception 'Das Datum liegt in der Vergangenheit'; end if;
  if (select count(*) from termin_vorschlaege where schiedsrichter_id=p_schiedsrichter_id and status in ('eingereicht','in_pruefung')) >= 5 then
    raise exception 'Du hast bereits fünf offene Vorschläge';
  end if;
  insert into termin_vorschlaege(verein_id,schiedsrichter_id,titel,datum,beginn_zeit,ort,begruendung)
  values(v_verein,p_schiedsrichter_id,btrim(p_titel),p_datum,p_beginn_zeit,nullif(btrim(p_ort),''),btrim(p_begruendung)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.meine_termin_vorschlaege(p_schiedsrichter_id uuid,p_pin text)
returns table(id uuid,titel text,datum date,beginn_zeit time,ort text,begruendung text,status text,obmann_rueckmeldung text,erstellt_am timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  return query select v.id,v.titel,v.datum,v.beginn_zeit,v.ort,v.begruendung,v.status,v.obmann_rueckmeldung,v.erstellt_am
  from termin_vorschlaege v where v.schiedsrichter_id=p_schiedsrichter_id order by v.erstellt_am desc limit 20;
end $$;

create or replace function public.obmann_termin_vorschlaege(p_passwort text)
returns table(id uuid,schiedsrichter_id uuid,name text,titel text,datum date,beginn_zeit time,ort text,begruendung text,status text,obmann_rueckmeldung text,erstellter_termin_id uuid,erstellt_am timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare v_verein uuid := public.obmann_verein(p_passwort);
begin
 return query select v.id,v.schiedsrichter_id,s.name,v.titel,v.datum,v.beginn_zeit,v.ort,v.begruendung,v.status,v.obmann_rueckmeldung,v.erstellter_termin_id,v.erstellt_am
 from termin_vorschlaege v join schiedsrichter s on s.id=v.schiedsrichter_id where v.verein_id=v_verein order by case v.status when 'eingereicht' then 0 when 'in_pruefung' then 1 else 2 end,v.erstellt_am desc;
end $$;

create or replace function public.obmann_termin_vorschlag_status(p_passwort text,p_vorschlag_id uuid,p_status text,p_rueckmeldung text default null,p_oeffentlich boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_verein uuid := public.obmann_verein(p_passwort); v termin_vorschlaege%rowtype; v_termin uuid;
begin
 if p_status not in ('in_pruefung','angenommen','abgelehnt') then raise exception 'Ungültiger Status'; end if;
 select * into v from termin_vorschlaege where id=p_vorschlag_id and verein_id=v_verein for update;
 if not found then raise exception 'Vorschlag nicht gefunden'; end if;
 if p_status='angenommen' and v.erstellter_termin_id is null then
   insert into termine(verein_id,titel,datum,beginn_zeit,ort,beschreibung,oeffentlich)
   values(v_verein,v.titel,v.datum,v.beginn_zeit,v.ort,v.begruendung,p_oeffentlich) returning id into v_termin;
 else v_termin:=v.erstellter_termin_id; end if;
 update termin_vorschlaege set status=p_status,obmann_rueckmeldung=nullif(btrim(p_rueckmeldung),''),erstellter_termin_id=v_termin,bearbeitet_am=now() where id=p_vorschlag_id;
 return v_termin;
end $$;

create or replace function public.termin_protokoll_fuer_schiri(p_schiedsrichter_id uuid,p_pin text,p_termin_id uuid)
returns table(titel text,inhalt text,aktualisiert_am timestamptz) language plpgsql stable security definer set search_path=public as $$
declare v_verein uuid := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
begin return query select coalesce(t.protokoll_titel,'Protokoll'),t.protokoll_inhalt,t.protokoll_aktualisiert_am from termine t where t.id=p_termin_id and t.verein_id=v_verein and t.protokoll_freigegeben and nullif(btrim(t.protokoll_inhalt),'') is not null; end $$;

create or replace function public.obmann_termin_protokoll(p_passwort text,p_termin_id uuid)
returns table(titel text,inhalt text,freigegeben boolean,aktualisiert_am timestamptz) language plpgsql stable security definer set search_path=public as $$
declare v_verein uuid := public.obmann_verein(p_passwort);
begin return query select t.protokoll_titel,t.protokoll_inhalt,t.protokoll_freigegeben,t.protokoll_aktualisiert_am from termine t where t.id=p_termin_id and t.verein_id=v_verein; end $$;

create or replace function public.obmann_termin_protokoll_speichern(p_passwort text,p_termin_id uuid,p_titel text,p_inhalt text,p_freigegeben boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_verein uuid := public.obmann_verein(p_passwort);
begin
 update termine set protokoll_titel=nullif(btrim(p_titel),''),protokoll_inhalt=nullif(btrim(p_inhalt),''),protokoll_freigegeben=(p_freigegeben and nullif(btrim(p_inhalt),'') is not null),protokoll_aktualisiert_am=now() where id=p_termin_id and verein_id=v_verein;
 if not found then raise exception 'Termin nicht gefunden'; end if;
end $$;

revoke all on function public.termin_vorschlag_einreichen(uuid,text,text,date,time,text,text) from public;
revoke all on function public.meine_termin_vorschlaege(uuid,text) from public;
revoke all on function public.obmann_termin_vorschlaege(text) from public;
revoke all on function public.obmann_termin_vorschlag_status(text,uuid,text,text,boolean) from public;
revoke all on function public.termin_protokoll_fuer_schiri(uuid,text,uuid) from public;
revoke all on function public.obmann_termin_protokoll(text,uuid) from public;
revoke all on function public.obmann_termin_protokoll_speichern(text,uuid,text,text,boolean) from public;
grant execute on function public.termin_vorschlag_einreichen(uuid,text,text,date,time,text,text) to anon,authenticated;
grant execute on function public.meine_termin_vorschlaege(uuid,text) to anon,authenticated;
grant execute on function public.obmann_termin_vorschlaege(text) to anon,authenticated;
grant execute on function public.obmann_termin_vorschlag_status(text,uuid,text,text,boolean) to anon,authenticated;
grant execute on function public.termin_protokoll_fuer_schiri(uuid,text,uuid) to anon,authenticated;
grant execute on function public.obmann_termin_protokoll(text,uuid) to anon,authenticated;
grant execute on function public.obmann_termin_protokoll_speichern(text,uuid,text,text,boolean) to anon,authenticated;
