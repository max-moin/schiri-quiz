-- Feedback bearbeiten/entfernen berührt niemals Fragen oder Quizantworten.
alter table public.frage_meldung_eintraege add column status text not null default 'offen'
  check (status in ('offen','gelesen','in_arbeit','erledigt','abgelehnt'));
update public.frage_meldung_eintraege set status = 'erledigt' where erledigt;

create function public.feedback_status_kompatibel() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status then
    new.erledigt := new.status in ('erledigt','abgelehnt');
  elsif TG_OP = 'UPDATE' and new.erledigt is distinct from old.erledigt then
    new.status := case when new.erledigt then 'erledigt' else 'offen' end;
  elsif TG_OP = 'INSERT' then
    if new.erledigt and new.status = 'offen' then new.status := 'erledigt'; end if;
    new.erledigt := new.status in ('erledigt','abgelehnt');
  end if;
  new.erledigt_am := case when new.erledigt then coalesce(new.erledigt_am, now()) else null end;
  return new;
end $$;
revoke all on function public.feedback_status_kompatibel() from public, anon, authenticated;
create trigger feedback_status_kompatibel before insert or update on public.frage_meldung_eintraege
for each row execute function public.feedback_status_kompatibel();

create function public.obmann_feedback_aktion(p_passwort text, p_meldung_id uuid,
  p_eintrag_id uuid default null, p_status text default null, p_loeschen boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_status text;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.frage_meldungen where id=p_meldung_id and verein_id=v_verein for update;
  if not found then raise exception 'Rückmeldung nicht gefunden oder nicht zugänglich'; end if;
  if p_eintrag_id is not null then
    perform 1 from public.frage_meldung_eintraege where id=p_eintrag_id and meldung_id=p_meldung_id;
    if not found then raise exception 'Hinweis gehört nicht zu dieser Rückmeldung'; end if;
  end if;
  if p_loeschen is true then
    if p_eintrag_id is null then
      delete from public.frage_meldungen where id=p_meldung_id;
      return;
    end if;
    delete from public.frage_meldung_eintraege where id=p_eintrag_id and meldung_id=p_meldung_id;
    if not exists(select 1 from public.frage_meldung_eintraege where meldung_id=p_meldung_id) then
      delete from public.frage_meldungen where id=p_meldung_id;
      return;
    end if;
  else
    if p_status is null or p_status not in ('offen','gelesen','in_arbeit','erledigt','abgelehnt') then
      raise exception 'Ungültiger Feedbackstatus';
    end if;
    update public.frage_meldung_eintraege set status=p_status
      where meldung_id=p_meldung_id and (p_eintrag_id is null or id=p_eintrag_id);
  end if;
  select case when bool_and(status='abgelehnt') then 'abgelehnt'
    when bool_and(erledigt) then 'erledigt'
    when bool_or(status='in_arbeit') then 'in_arbeit'
    when bool_or(status='gelesen') then 'gelesen' else 'offen' end
  into v_status from public.frage_meldung_eintraege where meldung_id=p_meldung_id;
  update public.frage_meldungen set status=v_status, aktualisiert_am=now() where id=p_meldung_id;
end $$;
revoke all on function public.obmann_feedback_aktion(text,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.obmann_feedback_aktion(text,uuid,uuid,text,boolean) to anon, authenticated;

create or replace function public.obmann_frage_meldungen(p_passwort text,p_frage_id uuid default null)
returns table(meldung_id uuid,frage_id uuid,frage_nummer integer,frage_text text,
schiedsrichter_id uuid,person text,status text,runde_id uuid,runde_bezeichnung text,
gegebene_antwort text,loesung_snapshot jsonb,erstellt_am timestamptz,aktualisiert_am timestamptz,
anzahl_eintraege integer,eintraege jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select fm.id,fm.frage_id,nr.frage_nummer,f.frage_text,fm.schiedsrichter_id,
    coalesce(s.name,'Unbekannt'),fm.status,fm.runde_id,r.bezeichnung,fm.gegebene_antwort,
    fm.loesung_snapshot,fm.erstellt_am,fm.aktualisiert_am,
    (select count(*)::integer from public.frage_meldung_eintraege e where e.meldung_id=fm.id),
    coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kategorie',e.kategorie,'text',e.text,
      'status',e.status,'erledigt',e.erledigt,'erledigt_am',e.erledigt_am,'erstellt_am',e.erstellt_am)
      order by e.erstellt_am,e.id) from public.frage_meldung_eintraege e where e.meldung_id=fm.id),'[]'::jsonb)
    from public.frage_meldungen fm join public.fragen f on f.id=fm.frage_id
    left join public.schiedsrichter s on s.id=fm.schiedsrichter_id
    left join public.runden r on r.id=fm.runde_id
    left join public.wochen_frage_nummern nr on nr.verein_id=fm.verein_id and nr.frage_id=fm.frage_id and nr.runde_id=fm.runde_id
    where fm.verein_id=v_verein and (p_frage_id is null or fm.frage_id=p_frage_id)
    order by (fm.status not in ('erledigt','abgelehnt')) desc,fm.aktualisiert_am desc;
end $$;

-- Historische anonyme Gesprächswünsche bleiben unverändert. Nur neue prüfen.
create function public.gespraech_braucht_absender() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.art='gespraech' and (new.anonym or new.schiedsrichter_id is null) then
    raise exception 'Für einen Gesprächswunsch ist eine Anmeldung mit Namen nötig';
  end if;
  return new;
end $$;
revoke all on function public.gespraech_braucht_absender() from public, anon, authenticated;
create trigger gespraech_braucht_absender before insert on public.meldungen
for each row execute function public.gespraech_braucht_absender();

-- Nur der Vercel-Server darf Gäste einliefern. Keine frei nutzbare anon-RPC.
create table public.website_feedback_limit (
  schluessel text primary key, fenster timestamptz not null, anzahl integer not null
);
alter table public.website_feedback_limit enable row level security;
revoke all on table public.website_feedback_limit from public, anon, authenticated;
create function public.website_feedback_gast(p_seite text,p_text text,p_limit_schluessel text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_anzahl integer;
begin
  if length(btrim(coalesce(p_text,''))) not between 1 and 4000
     or coalesce(p_limit_schluessel,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'Ungültige Eingabe';
  end if;
  select id into v_verein from public.vereine where oeffentliche_kennung=p_seite;
  if v_verein is null then raise exception 'Unbekannte Website'; end if;
  delete from public.website_feedback_limit where fenster < now()-interval '1 day';
  insert into public.website_feedback_limit as l values(p_limit_schluessel,now(),1)
  on conflict(schluessel) do update set
    anzahl=case when l.fenster < now()-interval '15 minutes' then 1 else least(l.anzahl+1,6) end,
    fenster=case when l.fenster < now()-interval '15 minutes' then now() else l.fenster end
  returning anzahl into v_anzahl;
  if v_anzahl > 5 then return jsonb_build_object('ok',false,'limit',true); end if;
  insert into public.meldungen(verein_id,art,anonym,schiedsrichter_id,situation,status)
    values(v_verein,'website',true,null,btrim(p_text),'offen');
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.website_feedback_gast(text,text,text) from public, anon, authenticated;
grant execute on function public.website_feedback_gast(text,text,text) to service_role;
