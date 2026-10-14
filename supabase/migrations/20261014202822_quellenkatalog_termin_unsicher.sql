-- Live-Migrationskennung nach MCP-Anwendung: 20261014202822.
-- Nichtpersonenbezogene Metadaten der bereits gemeinsamen Fragenbibliothek.
-- Umbenennen ändert nie den stabilen Fremdschlüssel einer Frage.
create table public.fragen_quellenkatalog (
 typ text primary key check(typ ~ '^[a-z0-9_]{2,80}$'),
 titel text not null check(length(btrim(titel)) between 1 and 80 and titel !~ '[[:cntrl:]]'),
 untergliederung boolean not null default false,
 detail_label text not null default 'Ausgabe' check(length(btrim(detail_label)) between 1 and 60),
 vorschlaege jsonb not null default '[]' check(jsonb_typeof(vorschlaege)='array' and octet_length(vorschlaege::text)<=12000),
 revision integer not null default 1,
 sortierung integer not null default 100
);
alter table public.fragen_quellenkatalog enable row level security;
create unique index fragen_quellenkatalog_titel_eindeutig on public.fragen_quellenkatalog(lower(btrim(titel)));
revoke all on public.fragen_quellenkatalog from public,anon,authenticated;
grant select on public.fragen_quellenkatalog to anon,authenticated;
create policy "Quellenmetadaten lesen" on public.fragen_quellenkatalog for select to anon,authenticated using(true);
insert into public.fragen_quellenkatalog(typ,titel,untergliederung,detail_label,sortierung) values
 ('dfb_schiri_zeitung','DFB-Schiri-Zeitung',true,'Ausgabe',10),('ifab','IFAB',false,'Kapitel',20),
 ('hausregeltest','Hausregeltest',true,'Ausgabe',30),('oss_app','OSS-App',false,'Weitere Angabe',40),
 ('eigene_idee','Eigene Idee',false,'Weitere Angabe',50),('sonstige','Sonstige',true,'Beschreibung',60);
alter table public.fragen drop constraint fragen_quelle_typ_check;
alter table public.fragen add constraint fragen_quelle_typ_katalog_fk foreign key(quelle_typ) references public.fragen_quellenkatalog(typ);

create function public.obmann_fragenquelle_speichern(p_passwort text,p_typ text,p_titel text,
 p_untergliederung boolean,p_detail_label text,p_vorschlaege jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fragen_quellenkatalog; e jsonb;
begin
 perform public.obmann_verein(p_passwort);
 if p_typ is null or p_typ !~ '^[a-z0-9_]{2,80}$' or p_titel is null or length(btrim(p_titel)) not between 1 and 80
 or p_titel ~ '[[:cntrl:]]' or p_detail_label is null or length(btrim(p_detail_label)) not between 1 and 60
 or p_detail_label ~ '[[:cntrl:]]' or p_untergliederung is null
 or jsonb_typeof(p_vorschlaege) is distinct from 'array' or octet_length(p_vorschlaege::text)>12000
 then raise exception 'Bitte gültigen Namen und Untergliederung eintragen.'; end if;
 if jsonb_array_length(p_vorschlaege)>40 then raise exception 'Höchstens 40 Vorschläge möglich.'; end if;
 for e in select value from jsonb_array_elements(p_vorschlaege) loop
  if jsonb_typeof(e) is distinct from 'string' or length(btrim(e#>>'{}')) not between 1 and 120
  or (e#>>'{}') ~ '[[:cntrl:]]' then raise exception 'Jeder Vorschlag braucht 1 bis 120 Zeichen.'; end if;
 end loop;
 if exists(select 1 from public.fragen_quellenkatalog where lower(btrim(titel))=lower(btrim(p_titel)) and typ<>p_typ) then
   raise exception 'Eine Quellenart mit diesem Namen gibt es bereits.';
 end if;
 if not exists(select 1 from public.fragen_quellenkatalog where typ=p_typ) and p_typ !~ '^custom_[a-f0-9]{32}$' then
   raise exception 'Neue Quellenarten brauchen eine neue unveränderliche Kennung.';
 end if;
 insert into public.fragen_quellenkatalog(typ,titel,untergliederung,detail_label,vorschlaege,revision,sortierung)
 values(p_typ,btrim(p_titel),p_untergliederung,btrim(p_detail_label),p_vorschlaege,0,
   (select coalesce(max(sortierung),0)+10 from public.fragen_quellenkatalog)) on conflict do nothing;
 select * into r from public.fragen_quellenkatalog where typ=p_typ for update;
 if r.revision is distinct from p_revision then raise exception 'Die Quelle wurde inzwischen geändert. Bitte zurückgehen und den Quellenkatalog neu laden.' using errcode='40001'; end if;
 update public.fragen_quellenkatalog set titel=btrim(p_titel),untergliederung=p_untergliederung,
 detail_label=btrim(p_detail_label),vorschlaege=p_vorschlaege,revision=revision+1 where typ=p_typ returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.obmann_fragenquelle_speichern(text,text,text,boolean,text,jsonb,integer) from public;
grant execute on function public.obmann_fragenquelle_speichern(text,text,text,boolean,text,jsonb,integer) to anon,authenticated;

-- Unsicher ist eine begründete Rückmeldung, keine Zusage und keine Absage.
alter table public.termin_rueckmeldungen drop constraint rueckmeldung_status_gueltig;
alter table public.termin_rueckmeldungen add constraint rueckmeldung_status_gueltig check(status in ('zu','ab','unsicher'));
alter table public.termin_rueckmeldungen add constraint unsicher_braucht_begruendung
 check(status<>'unsicher' or (grund='sonstiges' and nullif(btrim(kommentar),'') is not null and length(kommentar)<=300));

-- Zusätzlicher JSON-Zähler, ohne ältere Tabellen-RPC-Signaturen zu ändern.
-- "offen" bleibt für alte Clients kompatibel; neue ziehen "unsicher" ab.
create or replace function public.obmann_termine_mit_fortbildung(p_passwort text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_verein uuid;
begin
 v_verein:=public.obmann_verein(p_passwort);
 return coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object(
 'punkte_saison',t.punkte_saison,'punkte_art',t.punkte_art,'zeitraum_von',t.zeitraum_von,
 'unsicher',case when t.rueckmeldung_erforderlich then u.anzahl else 0 end) order by x.datum,x.beginn_zeit)
 from public.obmann_termine_mit_stand(p_passwort) x join public.termine t on t.id=x.id and t.verein_id=v_verein
 left join lateral(select count(*) as anzahl from public.termin_rueckmeldungen r
 join public.schiedsrichter s on s.id=r.schiedsrichter_id
 where r.termin_id=t.id and r.status='unsicher' and s.verein_id=v_verein and s.aktiv and not s.ist_test) u on true),'[]'::jsonb);
end $$;

CREATE OR REPLACE FUNCTION public.obmann_termin_rueckmeldung_setzen(p_passwort text, p_termin_id uuid, p_schiedsrichter_id uuid, p_status text, p_grund text DEFAULT NULL::text, p_kommentar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  if not exists (
    select 1 from termine t
    where t.id = p_termin_id and t.verein_id = v_verein
      and t.rueckmeldung_erforderlich
  ) then
    raise exception 'Termin nicht gefunden oder keine Rueckmeldung vorgesehen';
  end if;
  if not exists (
    select 1 from schiedsrichter s
    where s.id = p_schiedsrichter_id and s.verein_id = v_verein
      and s.aktiv and not s.ist_test
  ) then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;
  if p_status not in ('zu', 'ab', 'unsicher', 'offen') then
    raise exception 'Ungueltiger Rueckmeldestatus';
  end if;

  if p_status = 'offen' then
    delete from termin_rueckmeldungen
    where termin_id = p_termin_id and schiedsrichter_id = p_schiedsrichter_id;
    return;
  end if;

  if p_status = 'unsicher' and (p_grund is distinct from 'sonstiges' or nullif(btrim(p_kommentar),'') is null or length(p_kommentar)>300) then
    raise exception 'Bitte begründe kurz, warum du noch unsicher bist (maximal 300 Zeichen).';
  end if;
  if p_status = 'ab' and p_grund is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  insert into termin_rueckmeldungen (
    termin_id, schiedsrichter_id, status, grund, kommentar, gemeldet_am
  ) values (
    p_termin_id, p_schiedsrichter_id, p_status,
    case when p_status in ('ab', 'unsicher') then p_grund else null end,
    nullif(btrim(p_kommentar), ''), now()
  )
  on conflict (termin_id, schiedsrichter_id) do update set
    status = excluded.status,
    grund = excluded.grund,
    kommentar = excluded.kommentar,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

CREATE OR REPLACE FUNCTION public.termin_rueckmeldung_setzen(p_schiedsrichter_id uuid, p_pin text, p_termin_id uuid, p_status text, p_grund text DEFAULT NULL::text, p_kommentar text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
  v_datum date;
  v_beginn time;
  v_bis date;
  v_bisher text;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  select t.datum, t.beginn_zeit, t.rueckmeldung_bis into v_datum, v_beginn, v_bis
  from termine t
  where t.id = p_termin_id
    and (
      (t.sichtbarkeit = 'nur_verein' and t.verein_id = v_verein)
      or t.sichtbarkeit = 'oeffentlich'
    )
    and t.rueckmeldung_erforderlich;

  if v_datum is null then
    raise exception 'Termin nicht gefunden oder keine Rueckmeldung vorgesehen';
  end if;
  if p_status not in ('zu', 'ab', 'unsicher') then
    raise exception 'Ungueltiger Status: %', p_status;
  end if;
  if now() >= public.termin_rueckmeldeschluss(v_datum, v_beginn) then
    raise exception 'Der Termin hat bereits begonnen. Eine Rückmeldung ist nicht mehr möglich.';
  end if;

  select r.status into v_bisher
  from termin_rueckmeldungen r
  where r.termin_id = p_termin_id and r.schiedsrichter_id = p_schiedsrichter_id;

  if p_status = 'zu'
     and v_bis is not null
     and v_bis < (now() at time zone 'Europe/Berlin')::date
     and v_bisher is distinct from 'zu' then
    raise exception 'Die Rückmeldefrist ist abgelaufen. Absagen geht weiterhin; für eine Zusage sprich bitte direkt den Obmann an.';
  end if;
  if p_status = 'unsicher' and (p_grund is distinct from 'sonstiges' or nullif(btrim(p_kommentar),'') is null or length(p_kommentar)>300) then
    raise exception 'Bitte begründe kurz, warum du noch unsicher bist (maximal 300 Zeichen).';
  end if;
  if p_status = 'ab' and p_grund is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  insert into termin_rueckmeldungen as r
    (termin_id, schiedsrichter_id, status, grund, kommentar, gemeldet_am)
  values (
    p_termin_id, p_schiedsrichter_id, p_status,
    case when p_status in ('ab', 'unsicher') then p_grund else null end,
    case when p_status in ('ab', 'unsicher') then nullif(trim(coalesce(p_kommentar, '')), '') else null end,
    now()
  )
  on conflict (termin_id, schiedsrichter_id) do update set
    status = excluded.status,
    grund = excluded.grund,
    kommentar = excluded.kommentar,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

