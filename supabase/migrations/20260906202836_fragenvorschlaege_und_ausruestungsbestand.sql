-- v123: Schiedsrichter koennen vollstaendige Fragenentwuerfe einreichen und
-- ihren persoenlichen Ausruestungsbestand pflegen. Beide Tabellen sind fuer
-- die Data API deny-all; Zugriff erfolgt ausschliesslich ueber die unten
-- explizit freigegebenen, identitaetspruefenden RPCs.

create table public.fragenvorschlaege (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  inhalt jsonb not null,
  begruendung text not null,
  beleg text not null,
  status text not null default 'entwurf'
    check (status in ('entwurf','eingereicht','in_pruefung','aenderung_erbeten','angenommen','abgelehnt')),
  rueckmeldung_obmann text,
  uebernommene_frage_id uuid references public.fragen(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  eingereicht_am timestamptz,
  bearbeitet_am timestamptz,
  constraint fragenvorschlag_begruendung_ausfuehrlich
    check (char_length(btrim(begruendung)) between 40 and 4000),
  constraint fragenvorschlag_beleg_ausfuehrlich
    check (char_length(btrim(beleg)) between 20 and 2000),
  constraint fragenvorschlag_inhalt_form
    check (
      jsonb_typeof(inhalt) = 'object'
      and char_length(btrim(coalesce(inhalt->>'frage_text',''))) between 10 and 2000
      and coalesce(inhalt->>'medium','') in ('text','video','bild')
      and coalesce(inhalt->>'antworttyp','') in
        ('multiple_choice','mehrfachauswahl','freitext','zahl','entscheidung')
      and jsonb_typeof(coalesce(inhalt->'loesung','{}'::jsonb)) = 'object'
    )
);

create index fragenvorschlaege_verein_status_aktualisiert
  on public.fragenvorschlaege(verein_id, status, aktualisiert_am desc);
create index fragenvorschlaege_schiri_aktualisiert
  on public.fragenvorschlaege(schiedsrichter_id, aktualisiert_am desc);

create table public.fragenvorschlag_versionen (
  id uuid primary key default gen_random_uuid(),
  vorschlag_id uuid not null references public.fragenvorschlaege(id) on delete cascade,
  version integer not null,
  bearbeiter text not null check (bearbeiter in ('schiedsrichter','obmann')),
  inhalt jsonb not null,
  begruendung text not null,
  beleg text not null,
  rueckmeldung text,
  erstellt_am timestamptz not null default now(),
  unique (vorschlag_id, version)
);
create index fragenvorschlag_versionen_vorschlag
  on public.fragenvorschlag_versionen(vorschlag_id, version desc);

create table public.ausruestungsbestand (
  id uuid primary key default gen_random_uuid(),
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  kategorie text not null
    check (kategorie in ('trikot','hose','stutzen','schuhe','sonstiges')),
  bezeichnung text,
  farbe text,
  groesse text,
  aermellaenge text check (aermellaenge is null or aermellaenge in ('kurz','lang')),
  anzahl smallint not null default 1 check (anzahl between 1 and 20),
  zustand text not null default 'einsatzbereit'
    check (zustand in ('einsatzbereit','ersatz','verschlissen','fehlt')),
  anmerkung text,
  aktualisiert_am timestamptz not null default now(),
  constraint ausruestungsbestand_sonstiges_benannt
    check (kategorie <> 'sonstiges' or char_length(btrim(coalesce(bezeichnung,''))) between 2 and 80)
);
create index ausruestungsbestand_schiri on public.ausruestungsbestand(schiedsrichter_id);

alter table public.fragenvorschlaege enable row level security;
alter table public.fragenvorschlag_versionen enable row level security;
alter table public.ausruestungsbestand enable row level security;
revoke all on public.fragenvorschlaege from public, anon, authenticated;
revoke all on public.fragenvorschlag_versionen from public, anon, authenticated;
revoke all on public.ausruestungsbestand from public, anon, authenticated;

create or replace function public.fragenvorschlag_inhalt_pruefen(p_inhalt jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_inhalt) is distinct from 'object'
     or char_length(btrim(coalesce(p_inhalt->>'frage_text',''))) not between 10 and 2000
     or coalesce(p_inhalt->>'medium','') not in ('text','video','bild')
     or coalesce(p_inhalt->>'antworttyp','') not in
        ('multiple_choice','mehrfachauswahl','freitext','zahl','entscheidung')
     or jsonb_typeof(coalesce(p_inhalt->'loesung','{}'::jsonb)) is distinct from 'object' then
    raise exception 'Der Fragenvorschlag ist unvollstaendig oder ungueltig.';
  end if;
end;
$$;

create or replace function public.schiri_fragenvorschlag_speichern(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_inhalt jsonb,
  p_begruendung text,
  p_beleg text,
  p_vorschlag_id uuid default null,
  p_einreichen boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_verein uuid;
  v_id uuid;
  v_status text;
  v_version integer;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  perform public.fragenvorschlag_inhalt_pruefen(p_inhalt);
  if char_length(btrim(coalesce(p_begruendung,''))) not between 40 and 4000
     or char_length(btrim(coalesce(p_beleg,''))) not between 20 and 2000 then
    raise exception 'Begruendung und Beleg muessen ausfuehrlich ausgefuellt sein.';
  end if;

  if p_vorschlag_id is null then
    insert into public.fragenvorschlaege(
      verein_id, schiedsrichter_id, inhalt, begruendung, beleg, status, eingereicht_am
    ) values (
      v_verein, p_schiedsrichter_id, p_inhalt, btrim(p_begruendung), btrim(p_beleg),
      case when p_einreichen then 'eingereicht' else 'entwurf' end,
      case when p_einreichen then now() else null end
    ) returning id into v_id;
    v_version := 1;
  else
    select f.status into v_status
      from public.fragenvorschlaege f
     where f.id = p_vorschlag_id
       and f.schiedsrichter_id = p_schiedsrichter_id
       and f.verein_id = v_verein
     for update;
    if not found then raise exception 'Fragenvorschlag nicht gefunden.'; end if;
    if v_status not in ('entwurf','aenderung_erbeten') then
      raise exception 'Dieser Vorschlag kann aktuell nicht bearbeitet werden.';
    end if;
    v_id := p_vorschlag_id;
    update public.fragenvorschlaege set
      inhalt = p_inhalt,
      begruendung = btrim(p_begruendung),
      beleg = btrim(p_beleg),
      status = case when p_einreichen then 'eingereicht' else status end,
      eingereicht_am = case when p_einreichen then now() else eingereicht_am end,
      aktualisiert_am = now()
    where id = v_id;
    select coalesce(max(version),0) + 1 into v_version
      from public.fragenvorschlag_versionen where vorschlag_id = v_id;
  end if;

  insert into public.fragenvorschlag_versionen(
    vorschlag_id, version, bearbeiter, inhalt, begruendung, beleg
  ) values (v_id, v_version, 'schiedsrichter', p_inhalt, btrim(p_begruendung), btrim(p_beleg));
  return v_id;
end;
$$;

create or replace function public.schiri_fragenvorschlaege_liste(
  p_schiedsrichter_id uuid, p_pin text
) returns table(
  id uuid, status text, frage_text text, medium text, antworttyp text,
  begruendung text, beleg text, rueckmeldung_obmann text,
  uebernommene_frage_id uuid, erstellt_am timestamptz, aktualisiert_am timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query select f.id, f.status, f.inhalt->>'frage_text', f.inhalt->>'medium',
    f.inhalt->>'antworttyp', f.begruendung, f.beleg, f.rueckmeldung_obmann,
    f.uebernommene_frage_id, f.erstellt_am, f.aktualisiert_am
  from public.fragenvorschlaege f
  where f.schiedsrichter_id = p_schiedsrichter_id
  order by f.aktualisiert_am desc;
end;
$$;

create or replace function public.schiri_fragenvorschlag_details(
  p_schiedsrichter_id uuid, p_pin text, p_vorschlag_id uuid
) returns table(
  id uuid, status text, inhalt jsonb, begruendung text, beleg text,
  rueckmeldung_obmann text, uebernommene_frage_id uuid,
  erstellt_am timestamptz, aktualisiert_am timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query select f.id, f.status, f.inhalt, f.begruendung, f.beleg,
    f.rueckmeldung_obmann, f.uebernommene_frage_id, f.erstellt_am, f.aktualisiert_am
  from public.fragenvorschlaege f
  where f.id = p_vorschlag_id and f.schiedsrichter_id = p_schiedsrichter_id;
end;
$$;

create or replace function public.schiri_fragenvorschlag_versionen(
  p_schiedsrichter_id uuid, p_pin text, p_vorschlag_id uuid
) returns table(
  id uuid, version integer, bearbeiter text, inhalt jsonb,
  begruendung text, beleg text, rueckmeldung text, erstellt_am timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if not exists(select 1 from public.fragenvorschlaege f
                where f.id=p_vorschlag_id and f.schiedsrichter_id=p_schiedsrichter_id) then
    raise exception 'Fragenvorschlag nicht gefunden.';
  end if;
  return query select v.id, v.version, v.bearbeiter, v.inhalt, v.begruendung,
    v.beleg, v.rueckmeldung, v.erstellt_am
  from public.fragenvorschlag_versionen v where v.vorschlag_id=p_vorschlag_id
  order by v.version desc;
end;
$$;

create or replace function public.obmann_fragenvorschlaege_liste(
  p_passwort text, p_nur_offen boolean default true
) returns table(
  id uuid, status text, frage_text text, medium text, antworttyp text,
  person text, begruendung text, beleg text, rueckmeldung_obmann text,
  uebernommene_frage_id uuid, erstellt_am timestamptz, aktualisiert_am timestamptz
) language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select f.id, f.status, f.inhalt->>'frage_text', f.inhalt->>'medium',
    f.inhalt->>'antworttyp', s.name, f.begruendung, f.beleg, f.rueckmeldung_obmann,
    f.uebernommene_frage_id, f.erstellt_am, f.aktualisiert_am
  from public.fragenvorschlaege f join public.schiedsrichter s on s.id=f.schiedsrichter_id
  where f.verein_id=v_verein
    and (not coalesce(p_nur_offen,true) or f.status in ('eingereicht','in_pruefung','aenderung_erbeten'))
  order by f.aktualisiert_am desc;
end;
$$;

create or replace function public.obmann_fragenvorschlag_details(
  p_passwort text, p_vorschlag_id uuid
) returns table(
  id uuid, status text, schiedsrichter_id uuid, person text, inhalt jsonb,
  begruendung text, beleg text, rueckmeldung_obmann text,
  uebernommene_frage_id uuid, erstellt_am timestamptz, aktualisiert_am timestamptz
) language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select f.id, f.status, f.schiedsrichter_id, s.name, f.inhalt,
    f.begruendung, f.beleg, f.rueckmeldung_obmann, f.uebernommene_frage_id,
    f.erstellt_am, f.aktualisiert_am
  from public.fragenvorschlaege f join public.schiedsrichter s on s.id=f.schiedsrichter_id
  where f.id=p_vorschlag_id and f.verein_id=v_verein;
end;
$$;

create or replace function public.obmann_fragenvorschlag_status_setzen(
  p_passwort text, p_vorschlag_id uuid, p_status text,
  p_rueckmeldung text default null, p_inhalt jsonb default null,
  p_begruendung text default null, p_beleg text default null,
  p_uebernommene_frage_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_alt public.fragenvorschlaege%rowtype; v_version integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  if p_status not in ('eingereicht','in_pruefung','aenderung_erbeten','angenommen','abgelehnt') then
    raise exception 'Ungueltiger Status.';
  end if;
  select * into v_alt from public.fragenvorschlaege
   where id=p_vorschlag_id and verein_id=v_verein for update;
  if not found then raise exception 'Fragenvorschlag nicht gefunden.'; end if;
  if p_inhalt is not null then perform public.fragenvorschlag_inhalt_pruefen(p_inhalt); end if;
  if p_uebernommene_frage_id is not null and not exists(
    select 1 from public.fragen f where f.id=p_uebernommene_frage_id
  ) then raise exception 'Uebernommene Frage nicht gefunden.'; end if;

  update public.fragenvorschlaege set
    inhalt=coalesce(p_inhalt,inhalt), begruendung=coalesce(p_begruendung,begruendung),
    beleg=coalesce(p_beleg,beleg), status=p_status,
    rueckmeldung_obmann=nullif(btrim(coalesce(p_rueckmeldung,'')),''),
    uebernommene_frage_id=coalesce(p_uebernommene_frage_id,uebernommene_frage_id),
    bearbeitet_am=now(), aktualisiert_am=now()
  where id=p_vorschlag_id;

  if p_inhalt is not null or p_begruendung is not null or p_beleg is not null then
    select coalesce(max(version),0)+1 into v_version from public.fragenvorschlag_versionen
      where vorschlag_id=p_vorschlag_id;
    insert into public.fragenvorschlag_versionen(
      vorschlag_id,version,bearbeiter,inhalt,begruendung,beleg,rueckmeldung
    ) select id,v_version,'obmann',inhalt,begruendung,beleg,rueckmeldung_obmann
      from public.fragenvorschlaege where id=p_vorschlag_id;
  end if;
end;
$$;

create or replace function public.obmann_fragenvorschlag_versionen(
  p_passwort text, p_vorschlag_id uuid
) returns table(
  id uuid, version integer, bearbeiter text, inhalt jsonb,
  begruendung text, beleg text, rueckmeldung text, erstellt_am timestamptz
) language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  if not exists(select 1 from public.fragenvorschlaege f
    where f.id=p_vorschlag_id and f.verein_id=v_verein) then
    raise exception 'Fragenvorschlag nicht gefunden.';
  end if;
  return query select v.id,v.version,v.bearbeiter,v.inhalt,v.begruendung,
    v.beleg,v.rueckmeldung,v.erstellt_am from public.fragenvorschlag_versionen v
  where v.vorschlag_id=p_vorschlag_id order by v.version desc;
end;
$$;

create or replace function public.schiri_ausruestungsbestand_liste(
  p_schiedsrichter_id uuid, p_pin text
) returns setof public.ausruestungsbestand language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  return query select b.* from public.ausruestungsbestand b
    where b.schiedsrichter_id=p_schiedsrichter_id order by b.kategorie,b.bezeichnung,b.id;
end;
$$;

create or replace function public.schiri_ausruestungsbestand_speichern(
  p_schiedsrichter_id uuid, p_pin text, p_kategorie text,
  p_bezeichnung text default null, p_farbe text default null,
  p_groesse text default null, p_aermellaenge text default null,
  p_anzahl smallint default 1, p_zustand text default 'einsatzbereit',
  p_anmerkung text default null, p_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_kategorie not in ('trikot','hose','stutzen','schuhe','sonstiges')
     or coalesce(p_anzahl,0) not between 1 and 20
     or p_zustand not in ('einsatzbereit','ersatz','verschlissen','fehlt')
     or (p_aermellaenge is not null and p_aermellaenge not in ('kurz','lang')) then
    raise exception 'Ungueltige Bestandsangabe.';
  end if;
  if p_id is null then
    insert into public.ausruestungsbestand(
      schiedsrichter_id,kategorie,bezeichnung,farbe,groesse,aermellaenge,anzahl,zustand,anmerkung
    ) values (p_schiedsrichter_id,p_kategorie,nullif(btrim(p_bezeichnung),''),
      nullif(btrim(p_farbe),''),nullif(btrim(p_groesse),''),p_aermellaenge,p_anzahl,
      p_zustand,nullif(btrim(p_anmerkung),'')) returning id into v_id;
  else
    update public.ausruestungsbestand set kategorie=p_kategorie,
      bezeichnung=nullif(btrim(p_bezeichnung),''),farbe=nullif(btrim(p_farbe),''),
      groesse=nullif(btrim(p_groesse),''),aermellaenge=p_aermellaenge,
      anzahl=p_anzahl,zustand=p_zustand,anmerkung=nullif(btrim(p_anmerkung),''),
      aktualisiert_am=now()
    where id=p_id and schiedsrichter_id=p_schiedsrichter_id returning id into v_id;
    if v_id is null then raise exception 'Bestandseintrag nicht gefunden.'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.schiri_ausruestungsbestand_loeschen(
  p_schiedsrichter_id uuid, p_pin text, p_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  delete from public.ausruestungsbestand where id=p_id and schiedsrichter_id=p_schiedsrichter_id;
  if not found then raise exception 'Bestandseintrag nicht gefunden.'; end if;
end;
$$;

create or replace function public.obmann_ausruestungsbestand_liste(p_passwort text)
returns table(
  id uuid, schiedsrichter_id uuid, person text, kategorie text, bezeichnung text,
  farbe text, groesse text, aermellaenge text, anzahl smallint, zustand text,
  anmerkung text, aktualisiert_am timestamptz
) language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select b.id,b.schiedsrichter_id,s.name,b.kategorie,b.bezeichnung,b.farbe,
    b.groesse,b.aermellaenge,b.anzahl,b.zustand,b.anmerkung,b.aktualisiert_am
  from public.ausruestungsbestand b join public.schiedsrichter s on s.id=b.schiedsrichter_id
  where s.verein_id=v_verein order by s.name,b.kategorie,b.bezeichnung;
end;
$$;

-- Funktionen sind standardmaessig fuer PUBLIC ausfuehrbar. Erst alles
-- schliessen, dann nur die benoetigten Browser-/App-Endpunkte freigeben.
revoke execute on function public.fragenvorschlag_inhalt_pruefen(jsonb) from public, anon, authenticated;
revoke execute on function public.schiri_fragenvorschlag_speichern(uuid,text,jsonb,text,text,uuid,boolean) from public, anon, authenticated;
revoke execute on function public.schiri_fragenvorschlaege_liste(uuid,text) from public, anon, authenticated;
revoke execute on function public.schiri_fragenvorschlag_details(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.schiri_fragenvorschlag_versionen(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.obmann_fragenvorschlaege_liste(text,boolean) from public, anon, authenticated;
revoke execute on function public.obmann_fragenvorschlag_details(text,uuid) from public, anon, authenticated;
revoke execute on function public.obmann_fragenvorschlag_status_setzen(text,uuid,text,text,jsonb,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.obmann_fragenvorschlag_versionen(text,uuid) from public, anon, authenticated;
revoke execute on function public.schiri_ausruestungsbestand_liste(uuid,text) from public, anon, authenticated;
revoke execute on function public.schiri_ausruestungsbestand_speichern(uuid,text,text,text,text,text,text,smallint,text,text,uuid) from public, anon, authenticated;
revoke execute on function public.schiri_ausruestungsbestand_loeschen(uuid,text,uuid) from public, anon, authenticated;
revoke execute on function public.obmann_ausruestungsbestand_liste(text) from public, anon, authenticated;

grant execute on function public.schiri_fragenvorschlag_speichern(uuid,text,jsonb,text,text,uuid,boolean) to anon, authenticated;
grant execute on function public.schiri_fragenvorschlaege_liste(uuid,text) to anon, authenticated;
grant execute on function public.schiri_fragenvorschlag_details(uuid,text,uuid) to anon, authenticated;
grant execute on function public.schiri_fragenvorschlag_versionen(uuid,text,uuid) to anon, authenticated;
grant execute on function public.obmann_fragenvorschlaege_liste(text,boolean) to anon, authenticated;
grant execute on function public.obmann_fragenvorschlag_details(text,uuid) to anon, authenticated;
grant execute on function public.obmann_fragenvorschlag_status_setzen(text,uuid,text,text,jsonb,text,text,uuid) to anon, authenticated;
grant execute on function public.obmann_fragenvorschlag_versionen(text,uuid) to anon, authenticated;
grant execute on function public.schiri_ausruestungsbestand_liste(uuid,text) to anon, authenticated;
grant execute on function public.schiri_ausruestungsbestand_speichern(uuid,text,text,text,text,text,text,smallint,text,text,uuid) to anon, authenticated;
grant execute on function public.schiri_ausruestungsbestand_loeschen(uuid,text,uuid) to anon, authenticated;
grant execute on function public.obmann_ausruestungsbestand_liste(text) to anon, authenticated;

comment on table public.fragenvorschlaege is
  'Vereinsgebundene Fragenentwuerfe von Schiedsrichtern; nur ueber identitaetspruefende RPCs.';
comment on table public.fragenvorschlag_versionen is
  'Unveraenderliche Versionen eines Fragenvorschlags fuer nachvollziehbare Aenderungen.';
comment on table public.ausruestungsbestand is
  'Persoenlicher Ausruestungsbestand; getrennt von Beschaffungsanfragen.';
