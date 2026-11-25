-- Organisationsabsage: Datensatz, ID, Beschreibung und Antworten bleiben.
alter table public.termine add column abgesagt_am timestamptz;

-- Die alten Teilnehmer- und Erinnerungsendpunkte respektieren auch nach
-- einem späteren Edit im alten Client den endgültigen Absagestatus.
create function private.termin_absage_schutz() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.abgesagt_am is not null then new.abgesagt_am := old.abgesagt_am; end if;
  if new.abgesagt_am is not null then
    new.rueckmeldung_erforderlich := false;
    new.erinnerung_modus := 'aus';
  end if;
  return new;
end $$;
revoke all on function private.termin_absage_schutz() from public,anon,authenticated;
create trigger termin_absage_schutz before update on public.termine
for each row when (old.abgesagt_am is not null or new.abgesagt_am is not null)
execute function private.termin_absage_schutz();

-- Zeilensperre synchronisiert Rückmeldungen von bereits geöffneten Seiten
-- mit der Absage. Keine vorhandene Teilnahme löschen oder umschreiben.
create function private.termin_absage_rueckmeldung_schutz() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_abgesagt timestamptz;
begin
  select t.abgesagt_am into v_abgesagt from public.termine t where t.id=new.termin_id for share;
  if v_abgesagt is not null then
    raise exception 'Dieser Termin wurde abgesagt. Rückmeldungen sind nicht mehr möglich.';
  end if;
  return new;
end $$;
revoke all on function private.termin_absage_rueckmeldung_schutz() from public,anon,authenticated;
create trigger termin_absage_rueckmeldung_schutz before insert or update on public.termin_rueckmeldungen
for each row execute function private.termin_absage_rueckmeldung_schutz();

create function private.website_terminstatus(p_seitenschluessel text,p_absagen uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_verein uuid;
begin
  if auth.uid() is null or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'Redaktionszugriff mit zweitem Faktor erforderlich.' using errcode='42501';
  end if;
  select v.id into v_verein from public.vereine v
    where v.oeffentliche_kennung=p_seitenschluessel and exists(
      select 1 from public.website_redakteure r where r.user_id=auth.uid() and r.seitenschluessel=p_seitenschluessel);
  if v_verein is null then
    raise exception 'Kein Redaktionsrecht für diese Vereinsseite.' using errcode='42501';
  end if;
  if p_absagen is not null then
    update public.termine t set abgesagt_am=now()
      where t.id=p_absagen and t.verein_id=v_verein and t.abgesagt_am is null
        and t.art<>'hausregeltest' and public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit)>now();
    if not found and not exists(
      select 1 from public.termine t where t.id=p_absagen and t.verein_id=v_verein and t.abgesagt_am is not null
    ) then raise exception 'Kein aktueller fester Termin für diesen Verein.' using errcode='22023'; end if;
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.datum,x.beginn_zeit,x.id),'[]'::jsonb)
    from (select t.id,t.titel,t.datum,t.beginn_zeit,t.ende_zeit,t.abgesagt_am
      from public.termine t where t.verein_id=v_verein and t.art<>'hausregeltest'
        and (public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit)>now()
          or (t.abgesagt_am is not null and t.datum>=(now() at time zone 'Europe/Berlin')::date-30))
      order by t.datum,t.beginn_zeit,t.id limit 150) x
  );
end $$;
revoke all on function private.website_terminstatus(text,uuid) from public,anon,authenticated;
grant execute on function private.website_terminstatus(text,uuid) to authenticated;
create function public.website_terminstatus(p_seitenschluessel text,p_absagen uuid default null)
returns jsonb language sql security invoker set search_path='' return private.website_terminstatus(p_seitenschluessel,p_absagen);
revoke all on function public.website_terminstatus(text,uuid) from public,anon,authenticated;
grant execute on function public.website_terminstatus(text,uuid) to authenticated;

-- Bestehende JSON-Sichten: nur ein additives Feld, keine neuen Berechtigungen.
create or replace function public.termine_fuer_schiri_mit_fortbildung(p_schiedsrichter_id uuid,p_pin text,p_seitenschluessel text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('zeitraum_von',t.zeitraum_von,'abgesagt_am',t.abgesagt_am)), '[]'::jsonb)
  from public.termine_fuer_schiri_v2(p_schiedsrichter_id,p_pin,p_seitenschluessel) x join public.termine t on t.id=x.id;
$$;
create or replace function public.oeffentliche_termine_mit_fortbildung(p_seitenschluessel text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('zeitraum_von',t.zeitraum_von,'abgesagt_am',t.abgesagt_am)), '[]'::jsonb)
  from public.oeffentliche_termine_alle(p_seitenschluessel) x join public.termine t on t.id=x.id;
$$;

-- Startseiten-Band: Nur anstehende Termine, keine abgesagten.
create or replace function public.oeffentliche_termine(p_seitenschluessel text)
returns table(id uuid,titel text,datum date,beschreibung text,beginn_zeit time,ende_zeit time,ort text,art text,pflicht boolean)
language sql stable security definer set search_path='' as $$
  select t.id,t.titel,t.datum,t.beschreibung,t.beginn_zeit,t.ende_zeit,t.ort,t.art,t.pflicht
  from public.termine t join public.vereine v on v.id=t.verein_id
  where v.oeffentliche_kennung=p_seitenschluessel and t.sichtbarkeit='oeffentlich'
    and t.abgesagt_am is null
    and public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit)>now()
  order by t.datum,t.beginn_zeit nulls last limit 4;
$$;
