-- Ergänzungen bleiben privat; keine Rechte auf Rohdaten, Namen oder Geburtstage.
create table public.frage_herkunft (
  frage_id uuid primary key references public.fragen(id) on delete cascade,
  verein_id uuid not null references public.vereine(id) on delete cascade,
  vorschlag_id uuid unique references public.fragenvorschlaege(id) on delete set null,
  gruppe_zeigen boolean not null default false,
  name_zeigen boolean not null default false,
  freigegebener_name text,
  check (not name_zeigen or (gruppe_zeigen and char_length(btrim(freigegebener_name)) between 1 and 120))
);
create index frage_herkunft_verein on public.frage_herkunft(verein_id);
alter table public.frage_herkunft enable row level security;
revoke all on public.frage_herkunft from public,anon,authenticated;

create function public.obmann_frage_herkunft(p_passwort text,p_frage_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_verein uuid;
begin
  v_verein:=public.obmann_verein(p_passwort);
  return coalesce((select to_jsonb(h) from public.frage_herkunft h
    where h.frage_id=p_frage_id and h.verein_id=v_verein),'{}'::jsonb);
end $$;
revoke all on function public.obmann_frage_herkunft(text,uuid) from public,anon,authenticated;
grant execute on function public.obmann_frage_herkunft(text,uuid) to anon,authenticated;

-- Atomare Hülle um den unveränderten bestehenden Frageneditor.
create function public.obmann_frage_redaktion_speichern(
  p_passwort text,p_frage_id uuid default null,p_basis jsonb default '{}',
  p_inhalt jsonb default '{}',p_entscheidung boolean default false,
  p_loesung jsonb default '{}',p_kurztitel text default '',p_redaktion jsonb default '{}'
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_verein uuid; v_id uuid; v_vorschlag uuid; v_alt public.fragenvorschlaege%rowtype;
  v_gruppe boolean:=coalesce((p_redaktion->>'gruppe_zeigen')::boolean,false);
  v_name boolean:=coalesce((p_redaktion->>'name_zeigen')::boolean,false);
  v_text text:=nullif(btrim(p_redaktion->>'freigegebener_name'),'');
  v_einwilligung jsonb;
begin
  v_verein:=public.obmann_verein(p_passwort);
  v_vorschlag:=nullif(p_redaktion->>'vorschlag_id','')::uuid;
  if p_frage_id is not null then
    if exists(select 1 from public.frage_herkunft where frage_id=p_frage_id and verein_id<>v_verein) then
      raise exception 'Frage gehört zu einem anderen Verein.';
    end if;
    select coalesce(v_vorschlag,h.vorschlag_id) into v_vorschlag
      from (select 1) x left join public.frage_herkunft h on h.frage_id=p_frage_id;
  end if;
  if v_name and not v_gruppe then raise exception 'Namensnennung benötigt die Gruppenkennzeichnung.'; end if;
  if v_vorschlag is not null then
    select * into v_alt from public.fragenvorschlaege
      where id=v_vorschlag and verein_id=v_verein for update;
    if not found or v_alt.status in ('entwurf','abgelehnt','aenderung_erbeten') then
      raise exception 'Vorschlag ist nicht zur Übernahme bereit.';
    end if;
    if v_alt.uebernommene_frage_id is not null and v_alt.uebernommene_frage_id is distinct from p_frage_id then
      raise exception 'Für diesen Vorschlag existiert bereits ein Fragenentwurf. Bitte diesen öffnen.';
    end if;
    if v_alt.uebernommene_frage_id is null and
      (p_redaktion->>'vorschlag_stand')::timestamptz is distinct from v_alt.aktualisiert_am then
      raise exception 'Vorschlag wurde geändert. Bitte erneut öffnen.';
    end if;
    -- Nur eine vom Schiri selbst gespeicherte Version ist eine Einwilligung.
    select z.inhalt into v_einwilligung from public.fragenvorschlag_versionen z
      where z.vorschlag_id=v_vorschlag and z.bearbeiter='schiedsrichter'
      order by z.version desc limit 1;
    if v_gruppe and coalesce(v_einwilligung->>'herkunft_gruppe','false')<>'true' then
      raise exception 'Für die Gruppenkennzeichnung fehlt die Einwilligung.';
    end if;
    if v_name and coalesce(v_einwilligung->>'herkunft_name','false')<>'true' then
      raise exception 'Für die Namensnennung fehlt die Einwilligung.';
    end if;
    select s.name into v_text from public.schiedsrichter s where s.id=v_alt.schiedsrichter_id and s.verein_id=v_verein;
  elsif v_name and not coalesce((p_redaktion->>'einwilligung_bestaetigt')::boolean,false) then
    raise exception 'Bitte die vorhandene Zustimmung zur Namensnennung bestätigen.';
  end if;
  if v_name and (v_text is null or char_length(v_text)>120) then raise exception 'Name fehlt oder ist zu lang.'; end if;
  v_id:=public.obmann_frage_mit_titel_speichern(p_passwort,p_frage_id,p_basis,p_inhalt,p_entscheidung,p_loesung,p_kurztitel);
  insert into public.frage_herkunft(frage_id,verein_id,vorschlag_id,gruppe_zeigen,name_zeigen,freigegebener_name)
    values(v_id,v_verein,v_vorschlag,v_gruppe,v_name,case when v_name then v_text end)
    on conflict(frage_id) do update set gruppe_zeigen=excluded.gruppe_zeigen,name_zeigen=excluded.name_zeigen,
      freigegebener_name=excluded.freigegebener_name,vorschlag_id=excluded.vorschlag_id;
  if v_vorschlag is not null and v_alt.uebernommene_frage_id is null then
    update public.fragen set aktiv=false,sichtbar_gast=false,sichtbar_historie=false where id=v_id;
    update public.fragenvorschlaege set uebernommene_frage_id=v_id,status='angenommen',
      bearbeitet_am=now(),aktualisiert_am=now() where id=v_vorschlag;
  end if;
  return v_id;
end $$;
revoke all on function public.obmann_frage_redaktion_speichern(text,uuid,jsonb,jsonb,boolean,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.obmann_frage_redaktion_speichern(text,uuid,jsonb,jsonb,boolean,jsonb,text,jsonb) to anon,authenticated;

-- Minimale Quiz-Ausgabe: nur freiwillig freigegebener Text, keine Personen-IDs.
create function public.schiri_fragen_herkunft(p_schiedsrichter_id uuid,p_pin text,p_frage_ids uuid[])
returns table(frage_id uuid,herkunft text) language plpgsql security definer set search_path='' as $$
declare v_verein uuid;
begin
  v_verein:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if cardinality(p_frage_ids)>200 then raise exception 'Zu viele Fragen.'; end if;
  return query select h.frage_id,case when h.name_zeigen then 'Frage von '||h.freigegebener_name else 'Aus unserer Schiri-Gruppe' end
    from public.frage_herkunft h
    where h.verein_id=v_verein and h.gruppe_zeigen and h.frage_id=any(p_frage_ids)
      and exists(select 1 from public.wochen_fragen_v2(p_schiedsrichter_id,p_pin) w where w.id=h.frage_id);
end $$;
revoke all on function public.schiri_fragen_herkunft(uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.schiri_fragen_herkunft(uuid,text,uuid[]) to anon,authenticated;

-- Ein Geburtstagsjoker pro Jahr; nur private Serie, nie fachliche Quizpunkte.
create table public.geburtstagsjoker (
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  jahr integer not null,
  erhalten_am date not null,
  gueltig_bis date not null,
  runde_id uuid references public.runden(id) on delete restrict,
  eingeloest_am timestamptz,
  primary key(schiedsrichter_id,jahr),
  unique(schiedsrichter_id,runde_id),
  check ((runde_id is null)=(eingeloest_am is null))
);
create index geburtstagsjoker_runde on public.geburtstagsjoker(runde_id);
alter table public.geburtstagsjoker enable row level security;
revoke all on public.geburtstagsjoker from public,anon,authenticated;

create function public.meine_wochenserie_mit_joker(p_schiedsrichter_id uuid,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_basis jsonb; v_geboren date; v_heute date:=(now() at time zone 'Europe/Berlin')::date;
  v_jahr int:=extract(year from v_heute); v_tag date; v_seit date; v_joker jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select s.geburtsdatum,(s.erstellt_am at time zone 'Europe/Berlin')::date into v_geboren,v_seit
    from public.schiedsrichter s where s.id=p_schiedsrichter_id for update;
  if v_geboren is not null and v_geboren<v_heute then
    -- 29. Februar: Geschenk am 28. Februar in Nicht-Schaltjahren.
    v_tag:=make_date(v_jahr,extract(month from v_geboren)::int,1)+
      (least(extract(day from v_geboren)::int,extract(day from (make_date(v_jahr,extract(month from v_geboren)::int,1)+interval '1 month - 1 day'))::int)-1);
    if v_tag between greatest(v_seit,date '2026-10-16') and v_heute then
      insert into public.geburtstagsjoker(schiedsrichter_id,jahr,erhalten_am,gueltig_bis)
        values(p_schiedsrichter_id,v_jahr,v_tag,(v_tag+interval '1 year')::date)
        on conflict(schiedsrichter_id,jahr) do nothing;
    end if;
  end if;
  v_basis:=public.meine_wochenserie_basis(p_schiedsrichter_id,p_pin);
  select coalesce(jsonb_agg(w.value||jsonb_build_object('joker_gerettet',exists(
    select 1 from public.geburtstagsjoker j where j.schiedsrichter_id=p_schiedsrichter_id and j.runde_id=(w.value->>'runde_id')::uuid))),'[]')
    into v_joker from jsonb_array_elements(v_basis->'wochen') w;
  v_basis:=jsonb_set(v_basis,'{wochen}',v_joker);
  select coalesce(jsonb_agg(jsonb_build_object('jahr',j.jahr,'gueltig_bis',j.gueltig_bis) order by j.gueltig_bis),'[]')
    into v_joker from public.geburtstagsjoker j where j.schiedsrichter_id=p_schiedsrichter_id
      and j.runde_id is null and j.gueltig_bis>v_heute;
  return v_basis||jsonb_build_object('joker',v_joker);
end $$;
revoke all on function public.meine_wochenserie_mit_joker(uuid,text) from public,anon,authenticated;
grant execute on function public.meine_wochenserie_mit_joker(uuid,text) to anon,authenticated;

create function public.geburtstagsjoker_einloesen(p_schiedsrichter_id uuid,p_pin text,p_runde_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_basis jsonb; v_woche jsonb; v_jahr int;
begin
  -- Lädt/prüft den eigenen Stand und sperrt dieselbe Person: kein Doppelverbrauch.
  v_basis:=public.meine_wochenserie_mit_joker(p_schiedsrichter_id,p_pin);
  select w.value into v_woche from jsonb_array_elements(v_basis->'wochen') w where w.value->>'runde_id'=p_runde_id::text;
  if v_woche is null or (v_woche->>'endet_am')::timestamptz>now()
    or (v_woche->>'retten_bis')::timestamptz<=now()
    or (v_woche->>'beantwortet')::int >= (v_woche->>'fragen_gesamt')::int
    or (v_woche->>'fragen_gesamt')::int=0 or (v_woche->>'uebung_richtig')::int>=5
    or (v_woche->>'joker_gerettet')::boolean then
    raise exception 'Diese Woche benötigt keinen Joker oder ist nicht mehr rettbar.';
  end if;
  select j.jahr into v_jahr from public.geburtstagsjoker j where j.schiedsrichter_id=p_schiedsrichter_id
    and j.runde_id is null and j.gueltig_bis>(now() at time zone 'Europe/Berlin')::date
    order by j.gueltig_bis limit 1 for update;
  if v_jahr is null then raise exception 'Kein Geburtstagsjoker verfügbar.'; end if;
  update public.geburtstagsjoker set runde_id=p_runde_id,eingeloest_am=now()
    where schiedsrichter_id=p_schiedsrichter_id and jahr=v_jahr;
  return public.meine_wochenserie_mit_joker(p_schiedsrichter_id,p_pin);
end $$;
revoke all on function public.geburtstagsjoker_einloesen(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.geburtstagsjoker_einloesen(uuid,text,uuid) to anon,authenticated;
