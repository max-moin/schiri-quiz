-- v129: persoenlicher Website-Bereich
-- Fragetext und sichtbare Obmann-Antwort fuer eigenes Quiz-Feedback,
-- editierbarer eigener Hinweis sowie eine PIN-geschuetzte Wochenstatistik.

alter table public.frage_meldung_eintraege
  add column if not exists rueckmeldung_obmann text;

alter table public.frage_meldung_eintraege
  drop constraint if exists frage_meldung_eintraege_rueckmeldung_laenge;
alter table public.frage_meldung_eintraege
  add constraint frage_meldung_eintraege_rueckmeldung_laenge
  check (rueckmeldung_obmann is null or length(rueckmeldung_obmann) <= 1000);

drop function if exists public.obmann_feedback_aktion(text, uuid, uuid, text, boolean);
drop function if exists public.obmann_feedback_aktion(text, uuid, uuid, text, boolean, text);

create function public.obmann_feedback_aktion(
  p_passwort text,
  p_meldung_id uuid,
  p_eintrag_id uuid default null,
  p_status text default null,
  p_loeschen boolean default false,
  p_rueckmeldung text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verein uuid;
  v_status text;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.frage_meldungen
   where id = p_meldung_id and verein_id = v_verein for update;
  if not found then raise exception 'Rückmeldung nicht gefunden oder nicht zugänglich'; end if;

  if p_eintrag_id is not null then
    perform 1 from public.frage_meldung_eintraege
     where id = p_eintrag_id and meldung_id = p_meldung_id;
    if not found then raise exception 'Hinweis gehört nicht zu dieser Rückmeldung'; end if;
  end if;

  if p_loeschen is true then
    if p_eintrag_id is null then
      delete from public.frage_meldungen where id = p_meldung_id;
      return;
    end if;
    delete from public.frage_meldung_eintraege
     where id = p_eintrag_id and meldung_id = p_meldung_id;
    if not exists(select 1 from public.frage_meldung_eintraege where meldung_id = p_meldung_id) then
      delete from public.frage_meldungen where id = p_meldung_id;
      return;
    end if;
  else
    if p_status is not null and p_status not in ('offen','gelesen','in_arbeit','erledigt','abgelehnt') then
      raise exception 'Ungültiger Feedbackstatus';
    end if;
    if p_rueckmeldung is not null and length(btrim(p_rueckmeldung)) > 1000 then
      raise exception 'Rückmeldung ist zu lang';
    end if;
    update public.frage_meldung_eintraege
       set status = coalesce(p_status, status),
           rueckmeldung_obmann = case
             when p_rueckmeldung is null then rueckmeldung_obmann
             else nullif(btrim(p_rueckmeldung), '')
           end
     where meldung_id = p_meldung_id
       and (p_eintrag_id is null or id = p_eintrag_id);
  end if;

  select case
    when bool_and(status = 'abgelehnt') then 'abgelehnt'
    when bool_and(erledigt) then 'erledigt'
    when bool_or(status = 'in_arbeit') then 'in_arbeit'
    when bool_or(status = 'gelesen') then 'gelesen'
    else 'offen' end
    into v_status
    from public.frage_meldung_eintraege where meldung_id = p_meldung_id;
  update public.frage_meldungen
     set status = v_status, aktualisiert_am = now()
   where id = p_meldung_id;
end;
$$;

revoke all on function public.obmann_feedback_aktion(text,uuid,uuid,text,boolean,text) from public, anon, authenticated;
grant execute on function public.obmann_feedback_aktion(text,uuid,uuid,text,boolean,text) to anon, authenticated;

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
      'status',e.status,'erledigt',e.erledigt,'erledigt_am',e.erledigt_am,
      'rueckmeldung_obmann',e.rueckmeldung_obmann,'erstellt_am',e.erstellt_am)
      order by e.erstellt_am,e.id) from public.frage_meldung_eintraege e where e.meldung_id=fm.id),'[]'::jsonb)
    from public.frage_meldungen fm join public.fragen f on f.id=fm.frage_id
    left join public.schiedsrichter s on s.id=fm.schiedsrichter_id
    left join public.runden r on r.id=fm.runde_id
    left join public.wochen_frage_nummern nr on nr.verein_id=fm.verein_id and nr.frage_id=fm.frage_id and nr.runde_id=fm.runde_id
    where fm.verein_id=v_verein and (p_frage_id is null or fm.frage_id=p_frage_id)
    order by (fm.status not in ('erledigt','abgelehnt')) desc,fm.aktualisiert_am desc;
end $$;

drop function if exists public.meine_frage_meldungen(uuid, text);

create function public.meine_frage_meldungen(p_schiedsrichter_id uuid, p_pin text)
returns table(
  meldung_id uuid, frage_id uuid, frage_nummer integer, frage_text text,
  runde_bezeichnung text, status text, anzahl_eintraege integer,
  erstellt_am timestamptz, aktualisiert_am timestamptz, eintraege jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
  select fm.id, fm.frage_id, nr.frage_nummer, f.frage_text, r.bezeichnung,
         fm.status,
         (select count(*)::integer from public.frage_meldung_eintraege e where e.meldung_id = fm.id),
         fm.erstellt_am, fm.aktualisiert_am,
         coalesce((select jsonb_agg(jsonb_build_object(
           'id', e.id, 'kategorie', e.kategorie, 'text', e.text,
           'status', e.status, 'erledigt', e.erledigt,
           'rueckmeldung_obmann', e.rueckmeldung_obmann,
           'erstellt_am', e.erstellt_am) order by e.erstellt_am, e.id)
           from public.frage_meldung_eintraege e where e.meldung_id = fm.id), '[]'::jsonb)
    from public.frage_meldungen fm
    join public.fragen f on f.id = fm.frage_id
    left join public.runden r on r.id = fm.runde_id
    left join public.wochen_frage_nummern nr
      on nr.verein_id = fm.verein_id and nr.frage_id = fm.frage_id and nr.runde_id = fm.runde_id
   where fm.schiedsrichter_id = p_schiedsrichter_id
   order by fm.aktualisiert_am desc, fm.erstellt_am desc;
end;
$$;

revoke all on function public.meine_frage_meldungen(uuid,text) from public, anon, authenticated;
grant execute on function public.meine_frage_meldungen(uuid,text) to anon, authenticated;

create or replace function public.meine_frage_meldung_bearbeiten(
  p_schiedsrichter_id uuid, p_pin text, p_meldung_id uuid, p_eintrag_id uuid, p_text text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if length(btrim(coalesce(p_text, ''))) not between 1 and 1000 then
    raise exception 'Hinweis muss zwischen 1 und 1000 Zeichen lang sein';
  end if;
  update public.frage_meldung_eintraege e
     set text = btrim(p_text), status = 'offen'
    from public.frage_meldungen fm
   where e.id = p_eintrag_id and e.meldung_id = p_meldung_id
     and fm.id = e.meldung_id and fm.schiedsrichter_id = p_schiedsrichter_id
     and e.status in ('offen', 'gelesen');
  if not found then raise exception 'Hinweis ist nicht mehr bearbeitbar'; end if;
  update public.frage_meldungen set status = 'offen', aktualisiert_am = now()
   where id = p_meldung_id and schiedsrichter_id = p_schiedsrichter_id;
end;
$$;

revoke all on function public.meine_frage_meldung_bearbeiten(uuid,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.meine_frage_meldung_bearbeiten(uuid,text,uuid,uuid,text) to anon, authenticated;

create or replace function public.meine_quiz_statistik(
  p_schiedsrichter_id uuid, p_pin text, p_wochen integer default 26
)
returns table(
  runde_id uuid, bezeichnung text, startet_am timestamptz, endet_am timestamptz,
  ist_aktuelle_runde boolean, fragen_gesamt integer, beantwortet integer,
  richtig integer, nachbessern integer, falsch integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verein uuid;
  v_wochen integer := least(greatest(coalesce(p_wochen, 26), 1), 52);
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
  with letzte_runden as (
    select r.id, r.bezeichnung, r.startet_am, r.endet_am
      from public.runden r
     where r.startet_am <= now()
       and exists(select 1 from public.runden_fragen rf where rf.runde_id = r.id and rf.verein_id = v_verein)
     order by r.startet_am desc limit v_wochen
  ), wochenfragen as (
    select distinct rf.runde_id, rf.frage_id
      from public.runden_fragen rf
     where rf.verein_id = v_verein and rf.runde_id in (select id from letzte_runden)
  )
  select lr.id, lr.bezeichnung, lr.startet_am, lr.endet_am,
         now() between lr.startet_am and lr.endet_am,
         count(wf.frage_id)::integer,
         count(a.id)::integer,
         count(a.id) filter (where a.korrekt is true or a.bewertungsstatus = 'richtig')::integer,
         count(a.id) filter (where a.bewertungsstatus = 'nachbessern')::integer,
         count(a.id) filter (where a.korrekt is false and a.bewertungsstatus <> 'nachbessern')::integer
    from letzte_runden lr
    left join wochenfragen wf on wf.runde_id = lr.id
    left join public.antworten a on a.frage_id = wf.frage_id and a.schiedsrichter_id = p_schiedsrichter_id
   group by lr.id, lr.bezeichnung, lr.startet_am, lr.endet_am
   order by lr.startet_am desc;
end;
$$;

revoke all on function public.meine_quiz_statistik(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.meine_quiz_statistik(uuid,text,integer) to anon, authenticated;

comment on function public.meine_quiz_statistik(uuid,text,integer) is
'PIN-geschuetzter eigener Wochenverlauf. Liefert ausschliesslich Werte der angemeldeten Person; Wochen ohne Teilnahme bleiben sichtbar.';
