-- Live migration version 20261017223628. Private rewards: no direct Data API grants, no paid boxes, no expiry.
create table private.jokerboxen (
 id uuid primary key default gen_random_uuid(), person uuid not null references public.schiedsrichter(id) on delete cascade,
 quelle text not null, schluessel text not null, verdient_am timestamptz not null default now(),
 geoeffnet_am timestamptz, typ text check(typ in ('serienjoker','halbhalb','zweiter-versuch')),
 widerrufen boolean not null default false, unique(person,schluessel),
 check((geoeffnet_am is null)=(typ is null))
);
create table private.jokerbestand (
 id uuid primary key default gen_random_uuid(), person uuid not null references public.schiedsrichter(id) on delete cascade,
 box uuid not null unique references private.jokerboxen(id) on delete cascade,
 typ text not null check(typ in ('serienjoker','halbhalb','zweiter-versuch')), erhalten_am timestamptz not null default now(),
 verbraucht_am timestamptz, frage uuid references public.fragen(id) on delete set null, runde uuid references public.runden(id) on delete set null
);
create index jokerbestand_person on private.jokerbestand(person,typ) where verbraucht_am is null;
create index jokerbestand_frage on private.jokerbestand(frage);
create index jokerbestand_runde on private.jokerbestand(runde);
create table private.quiz_joker_vorgaenge (
 person uuid not null references public.schiedsrichter(id) on delete cascade,
 frage uuid not null references public.fragen(id) on delete cascade,
 runde uuid not null references public.runden(id) on delete cascade,
 art text, erste_antwort jsonb, erstes_ergebnis jsonb, letzte_antwort jsonb, letztes_ergebnis jsonb,
 status text not null default 'offen' check(status in ('offen','angebot','zweiter','fertig')),
 halbhalb uuid references private.jokerbestand(id), zweiter uuid references private.jokerbestand(id),
 kandidaten text[], erstellt_am timestamptz not null default now(), abgeschlossen_am timestamptz,
 primary key(person,frage)
);
create index quiz_joker_runde on private.quiz_joker_vorgaenge(runde);
create index quiz_joker_frage on private.quiz_joker_vorgaenge(frage);
create index quiz_joker_halbhalb on private.quiz_joker_vorgaenge(halbhalb);
create index quiz_joker_zweiter on private.quiz_joker_vorgaenge(zweiter);
alter table private.jokerboxen enable row level security;
alter table private.jokerbestand enable row level security;
alter table private.quiz_joker_vorgaenge enable row level security;
revoke all on private.jokerboxen,private.jokerbestand,private.quiz_joker_vorgaenge from public,anon,authenticated;

create function private.joker_belohnungen_sync(p_person uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.schiedsrichter; heute date:=(now() at time zone 'Europe/Berlin')::date;
v_jahr int; tag date; basis jsonb; w jsonb; anzahl int:=0; i int;
begin
 select * into s from public.schiedsrichter where id=p_person for update;
 if not s.aktiv or s.ist_test then return; end if;
 if s.geburtsdatum is not null and s.geburtsdatum<heute then
  for v_jahr in 2026..extract(year from heute)::int loop
   tag:=make_date(v_jahr,extract(month from s.geburtsdatum)::int,1);
   tag:=tag+least(extract(day from s.geburtsdatum)::int,extract(day from tag+interval '1 month - 1 day')::int)-1;
   if tag>=greatest(date '2026-10-18',(s.erstellt_am at time zone 'Europe/Berlin')::date) and tag<=heute
     and not exists(select 1 from public.geburtstagsjoker j where j.schiedsrichter_id=p_person and j.jahr=v_jahr) then
    insert into private.jokerboxen(person,quelle,schluessel,verdient_am) values(p_person,'Geburtstag','geburtstag:'||v_jahr,tag::timestamp at time zone 'Europe/Berlin') on conflict do nothing;
   end if;
  end loop;
 end if;
 insert into private.jokerboxen(person,quelle,schluessel,verdient_am)
 select p_person,'Bestätigte Teilnahme: '||t.titel,'teilnahme:'||t.id,n.bestaetigt_am
 from public.fortbildung_nachweise n join public.termine t on t.id=n.termin_id
 where n.schiedsrichter_id=p_person and n.gewertet and t.verein_id=s.verein_id
  and (t.art in ('lehrabend','hausregeltest') or t.punkte_art in ('rla','hrt'))
  and t.datum>=date '2026-10-18' and t.datum<=heute
  and n.bestaetigt_am>=timestamptz '2026-10-18 00:00:00 Europe/Berlin'
 on conflict do nothing;
 -- Corrections do not mint duplicates. Unused gifts are unavailable while a
 -- confirmed attendance has been revoked; consumed gifts remain auditable.
 update private.jokerboxen b set widerrufen=not exists(
  select 1 from public.fortbildung_nachweise n where n.schiedsrichter_id=p_person
   and 'teilnahme:'||n.termin_id=b.schluessel and n.gewertet)
 where b.person=p_person and b.schluessel like 'teilnahme:%';
 basis:=public.meine_wochenserie_basis(p_person,s.pin);
 for w in select value from jsonb_array_elements(basis->'wochen') loop
  if (w->>'startet_am')::timestamptz>=timestamptz '2026-10-18 00:00:00 Europe/Berlin'
   and (w->>'fragen_gesamt')::int>0 and (w->>'beantwortet')::int>=(w->>'fragen_gesamt')::int then anzahl:=anzahl+1; end if;
 end loop;
 for i in 1..(anzahl/4) loop
  insert into private.jokerboxen(person,quelle,schluessel) values(p_person,'Vier vollständige Quizwochen','vier-wochen:'||i) on conflict do nothing;
 end loop;
end $$;

create function public.mein_jokerbestand(p_schiedsrichter_id uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bestand jsonb; boxen jsonb; vorgaenge jsonb;
begin
 perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 perform private.joker_belohnungen_sync(p_schiedsrichter_id);
 select jsonb_build_object('serienjoker',
  (select count(*) from public.geburtstagsjoker where schiedsrichter_id=p_schiedsrichter_id and runde_id is null)
  +count(*) filter(where j.typ='serienjoker'),
  'halbhalb',count(*) filter(where j.typ='halbhalb'),'zweiter-versuch',count(*) filter(where j.typ='zweiter-versuch'))
 into bestand from private.jokerbestand j join private.jokerboxen b on b.id=j.box
 where j.person=p_schiedsrichter_id and j.verbraucht_am is null and not b.widerrufen;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'quelle',quelle,'verdient_am',verdient_am) order by verdient_am,id),'[]')
 into boxen from private.jokerboxen where person=p_schiedsrichter_id and geoeffnet_am is null and not widerrufen;
 select coalesce(jsonb_agg(jsonb_build_object('frage_id',v.frage,'status',v.status,'kandidaten',v.kandidaten,
  'joker_eingesetzt',v.halbhalb is not null or v.zweiter is not null,
  'halbhalb',v.halbhalb is not null,'zweiter',v.zweiter is not null)),'[]') into vorgaenge
 from private.quiz_joker_vorgaenge v join public.runden r on r.id=v.runde
 where v.person=p_schiedsrichter_id and now()>=r.startet_am and now()<r.endet_am;
 return jsonb_build_object('bestand',bestand,'boxen',boxen,'vorgaenge',vorgaenge);
end $$;

create function public.jokerbox_oeffnen(p_schiedsrichter_id uuid,p_pin text,p_box_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b private.jokerboxen; v_typ text;
begin
 perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 perform private.joker_belohnungen_sync(p_schiedsrichter_id);
 select * into b from private.jokerboxen where id=p_box_id and person=p_schiedsrichter_id for update;
 if b.id is null or b.widerrufen then raise exception 'Diese Box ist nicht verfügbar'; end if;
 if b.geoeffnet_am is null then
  -- Equal chances, drawn exactly once in this locked transaction.
  v_typ:=(array['serienjoker','halbhalb','zweiter-versuch'])[1+floor(random()*3)::int];
  update private.jokerboxen set geoeffnet_am=now(),typ=v_typ where id=b.id;
  insert into private.jokerbestand(person,box,typ) values(p_schiedsrichter_id,b.id,v_typ);
 else v_typ:=b.typ; end if;
 return jsonb_build_object('typ',v_typ,'stand',public.mein_jokerbestand(p_schiedsrichter_id,p_pin));
end $$;

create function private.joker_verbrauchen(p_person uuid,p_typ text,p_frage uuid,p_runde uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 select j.id into v_id from private.jokerbestand j join private.jokerboxen b on b.id=j.box
 where j.person=p_person and j.typ=p_typ and j.verbraucht_am is null and not b.widerrufen
 order by j.erhalten_am,j.id limit 1 for update of j;
 if v_id is null then raise exception 'Kein passender Joker im Vorrat'; end if;
 update private.jokerbestand set verbraucht_am=now(),frage=p_frage,runde=p_runde where id=v_id;
 return v_id;
end $$;

-- All original validators remain authoritative. A failed first evaluation is
-- rolled back in a subtransaction, so neither solution nor final answer leaks
-- before choosing the Joker. Only private state retains the first attempt.
create function private.quiz_joker_speichern(p_person uuid,p_pin text,p_frage uuid,p_art text,p_antwort jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare x jsonb;
begin
 case p_art
 when 'option' then select to_jsonb(t) into x from public.antwort_abgeben(p_person,p_frage,p_antwort->>'option',p_pin) t;
 when 'auswahl' then select to_jsonb(t) into x from public.antwort_auswahl_abgeben(p_person,p_frage,array(select jsonb_array_elements_text(p_antwort->'auswahl')),p_pin) t;
 when 'zahl' then select to_jsonb(t) into x from public.antwort_zahl_abgeben(p_person,p_frage,(p_antwort->>'wert')::numeric,p_antwort->>'einheit',p_pin) t;
 when 'entscheidung' then x:=public.entscheidung_antwort_speichern_v2(p_person,p_frage,p_pin,p_antwort->'antwort',(p_antwort->>'ort_richtig')::boolean,p_antwort->>'ort_feedback');
 when 'freitext' then
  select to_jsonb(t) into x from public.freitext_antwort_speichern(p_person,p_frage,p_pin,p_antwort->>'freitext',(p_antwort->>'korrekt')::boolean,p_antwort->>'feedback',p_antwort->>'status',p_antwort->>'nachfrage') t;
  if x->>'bewertungsstatus'<>'nachbessern' then x:=x||jsonb_build_object('musterantwort',(select f.musterantwort from public.fragen f where f.id=p_frage)); end if;
 else raise exception 'Antworttyp ungültig';
 end case;
 return x;
end $$;

create function private.quiz_joker_aktion(p_person uuid,p_pin text,p_frage uuid,p_aktion text,p_art text,p_antwort jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_runde uuid; v private.quiz_joker_vorgaenge; x jsonb; j uuid; keys text[]; richtig text; falsch text; ist_test boolean; hat_antwort boolean;
begin
 v_verein:=public.schiri_pin_pruefen(p_person,p_pin);
 select s.ist_test into ist_test from public.schiedsrichter s where s.id=p_person for update;
 select r.id into v_runde from public.runden r join public.runden_fragen rf on rf.runde_id=r.id
 join public.fragen f on f.id=rf.frage_id where rf.verein_id=v_verein and rf.frage_id=p_frage and f.aktiv
 and now()>=r.startet_am and now()<r.endet_am order by r.startet_am desc limit 1;
 if v_runde is null then raise exception 'Nicht im aktuellen Wochenquiz'; end if;
 select * into v from private.quiz_joker_vorgaenge where person=p_person and frage=p_frage for update;
 if v.person is not null and v.runde<>v_runde then raise exception 'Alter Jokervorgang: bitte Obmann kontaktieren'; end if;
 select exists(select 1 from public.antworten a where a.schiedsrichter_id=p_person and a.frage_id=p_frage) into hat_antwort;
 if v.status='fertig' then return v.letztes_ergebnis||jsonb_build_object('joker_eingesetzt',v.halbhalb is not null or v.zweiter is not null); end if;
 if hat_antwort and p_aktion<>'antwort' then raise exception 'Diese Frage ist bereits aufgelöst'; end if;
 if p_aktion='halbhalb' then
  if v.erste_antwort is not null or hat_antwort then raise exception '50/50 nur vor der ersten Antwort'; end if;
  if v.kandidaten is not null then return jsonb_build_object('kandidaten',v.kandidaten); end if;
  if not exists(select 1 from public.fragen f where f.id=p_frage and f.antworttyp='multiple_choice') then raise exception '50/50 nur bei Einfachauswahl'; end if;
  select array_agg(o.schluessel),min(o.schluessel) filter(where o.ist_richtig)
   into keys,richtig from public.frage_antwortoptionen o where o.frage_id=p_frage;
  if keys is null then select array['a','b','c'],f.richtige_option into keys,richtig from public.fragen f where f.id=p_frage; end if;
  if cardinality(keys)<3 or richtig is null or (select count(*) from public.frage_antwortoptionen o where o.frage_id=p_frage and o.ist_richtig)>1 then raise exception 'Für diese Frage ist 50/50 nicht möglich'; end if;
  select k into falsch from unnest(keys) k where k<>richtig order by random() limit 1;
  j:=private.joker_verbrauchen(p_person,'halbhalb',p_frage,v_runde);
  keys:=array(select k from unnest(array[richtig,falsch]) k order by k);
  insert into private.quiz_joker_vorgaenge(person,frage,runde,halbhalb,kandidaten) values(p_person,p_frage,v_runde,j,keys)
   on conflict(person,frage) do update set halbhalb=excluded.halbhalb,kandidaten=excluded.kandidaten;
  return jsonb_build_object('kandidaten',keys);
 elsif p_aktion='joker' then
  if v.status='zweiter' then return jsonb_build_object('joker_wiederholen',true); end if;
  if v.status is distinct from 'angebot' then raise exception 'Kein zweiter Versuch angeboten'; end if;
  j:=private.joker_verbrauchen(p_person,'zweiter-versuch',p_frage,v_runde);
  update private.quiz_joker_vorgaenge set status='zweiter',zweiter=j where person=p_person and frage=p_frage;
  return jsonb_build_object('joker_wiederholen',true);
 elsif p_aktion='aufloesen' then
  if v.status is distinct from 'angebot' then raise exception 'Keine offene Auflösung'; end if;
  x:=private.quiz_joker_speichern(p_person,p_pin,p_frage,v.art,v.erste_antwort);
  update private.quiz_joker_vorgaenge set status='fertig',letzte_antwort=v.erste_antwort,letztes_ergebnis=x,abgeschlossen_am=now() where person=p_person and frage=p_frage;
  return x||jsonb_build_object('joker_eingesetzt',v.halbhalb is not null);
 elsif p_aktion<>'antwort' then raise exception 'Aktion ungültig'; end if;
 if v.status='angebot' then return jsonb_build_object('joker_offen',true); end if;
 if v.status='zweiter' and p_art is distinct from v.art then raise exception 'Antworttyp geändert'; end if;
 if v.status='zweiter' and p_art='freitext' and p_antwort->>'status'='nachbessern' then
  p_antwort:=p_antwort||jsonb_build_object('status','falsch','korrekt',false,'nachfrage',null);
 end if;
 if v.kandidaten is not null and ((p_art='option' and not (p_antwort->>'option'=any(v.kandidaten)))
  or (p_art='auswahl' and not array(select jsonb_array_elements_text(p_antwort->'auswahl'))<@v.kandidaten)) then raise exception 'Bitte eine der verbliebenen Optionen wählen'; end if;
 begin
  x:=private.quiz_joker_speichern(p_person,p_pin,p_frage,p_art,p_antwort);
  if not hat_antwort and not ist_test and v.status is distinct from 'zweiter'
   and not coalesce((x->>'korrekt')::boolean,false) and x->>'bewertungsstatus' is distinct from 'nachbessern'
   and exists(select 1 from private.jokerbestand j join private.jokerboxen b on b.id=j.box where j.person=p_person and j.typ='zweiter-versuch' and j.verbraucht_am is null and not b.widerrufen)
  then raise exception using errcode='J0001',message='Jokerangebot'; end if;
 exception when sqlstate 'J0001' then
  insert into private.quiz_joker_vorgaenge(person,frage,runde,art,erste_antwort,erstes_ergebnis,status)
  values(p_person,p_frage,v_runde,p_art,p_antwort,x,'angebot')
  on conflict(person,frage) do update set art=excluded.art,erste_antwort=excluded.erste_antwort,erstes_ergebnis=excluded.erstes_ergebnis,status='angebot';
  return jsonb_build_object('joker_offen',true);
 end;
 -- Final answer is stored normally: all existing statistics see full correctness.
 if v.person is null then return x||jsonb_build_object('joker_eingesetzt',false); end if;
 insert into private.quiz_joker_vorgaenge(person,frage,runde,art,erste_antwort,erstes_ergebnis,letzte_antwort,letztes_ergebnis,status,abgeschlossen_am)
 values(p_person,p_frage,v_runde,p_art,p_antwort,x,p_antwort,x,'fertig',now())
 on conflict(person,frage) do update set art=coalesce(private.quiz_joker_vorgaenge.art,excluded.art),
 erste_antwort=coalesce(private.quiz_joker_vorgaenge.erste_antwort,excluded.erste_antwort),erstes_ergebnis=coalesce(private.quiz_joker_vorgaenge.erstes_ergebnis,excluded.erstes_ergebnis),
 letzte_antwort=excluded.letzte_antwort,letztes_ergebnis=excluded.letztes_ergebnis,status='fertig',abgeschlossen_am=now();
 return x||jsonb_build_object('joker_eingesetzt',v.halbhalb is not null or v.zweiter is not null);
end $$;

-- Browser may submit only objectively checked payloads; AI judgments are service-only.
create function public.quiz_joker_antwort(p_schiedsrichter_id uuid,p_pin text,p_frage_id uuid,p_aktion text,p_art text default null,p_antwort jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if p_aktion='antwort' and (p_art is null or p_art not in ('option','auswahl','zahl')) then raise exception 'Serverbewertung erforderlich'; end if;
 return private.quiz_joker_aktion(p_schiedsrichter_id,p_pin,p_frage_id,p_aktion,p_art,p_antwort);
end $$;
create function public.quiz_joker_bewertet(p_schiedsrichter_id uuid,p_pin text,p_frage_id uuid,p_art text,p_antwort jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if p_art not in ('freitext','entscheidung') then raise exception 'Bewertungstyp ungültig'; end if;
 return private.quiz_joker_aktion(p_schiedsrichter_id,p_pin,p_frage_id,'antwort',p_art,p_antwort);
end $$;

create function private.quiz_joker_antworttext(p_art text,p_antwort jsonb,p_frage uuid) returns text
language sql stable set search_path='' as $$
 select case p_art when 'freitext' then p_antwort->>'freitext'
 when 'zahl' then (p_antwort->>'wert')||' '||(p_antwort->>'einheit')
 when 'entscheidung' then public.entscheidung_anzeige(p_antwort->'antwort')
 else (select string_agg(coalesce(o.text,case k when 'a' then f.option_a when 'b' then f.option_b when 'c' then f.option_c end,k),'; ' order by k)
  from jsonb_array_elements_text(case when p_art='option' then jsonb_build_array(p_antwort->>'option') else coalesce(p_antwort->'auswahl','[]') end) k
  cross join public.fragen f left join public.frage_antwortoptionen o on o.frage_id=f.id and o.schluessel=k where f.id=p_frage) end;
$$;
revoke all on function private.quiz_joker_antworttext(text,jsonb,uuid) from public,anon,authenticated;

create function public.obmann_joker_verlauf(p_passwort text,p_schiedsrichter text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare verein uuid;
begin
 verein:=public.obmann_verein(p_passwort);
 return coalesce((select jsonb_agg(jsonb_build_object('frage_id',v.frage,'runde_id',v.runde,
  'halbhalb',v.halbhalb is not null,'zweiter',v.zweiter is not null,'status',v.status,
  'erstantwort',v.erste_antwort,'jokerantwort',case when v.zweiter is not null then v.letzte_antwort end,
  'erstantwort_text',private.quiz_joker_antworttext(v.art,v.erste_antwort,v.frage),
  'jokerantwort_text',case when v.zweiter is not null then private.quiz_joker_antworttext(v.art,v.letzte_antwort,v.frage) end,
  'korrekt',(v.letztes_ergebnis->>'korrekt')::boolean,'eingesetzt_am',coalesce(j.verbraucht_am,h.verbraucht_am)) order by v.erstellt_am)
 from private.quiz_joker_vorgaenge v join public.schiedsrichter s on s.id=v.person
 left join private.jokerbestand j on j.id=v.zweiter left join private.jokerbestand h on h.id=v.halbhalb
 where s.verein_id=verein and s.name=p_schiedsrichter and (v.halbhalb is not null or v.zweiter is not null)),'[]');
end $$;

revoke all on function private.joker_belohnungen_sync(uuid),private.joker_verbrauchen(uuid,text,uuid,uuid),private.quiz_joker_speichern(uuid,text,uuid,text,jsonb),private.quiz_joker_aktion(uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.mein_jokerbestand(uuid,text),public.jokerbox_oeffnen(uuid,text,uuid),public.quiz_joker_antwort(uuid,text,uuid,text,text,jsonb),public.quiz_joker_bewertet(uuid,text,uuid,text,jsonb),public.obmann_joker_verlauf(text,text) from public,anon,authenticated;
grant execute on function public.mein_jokerbestand(uuid,text),public.jokerbox_oeffnen(uuid,text,uuid),public.quiz_joker_antwort(uuid,text,uuid,text,text,jsonb),public.obmann_joker_verlauf(text,text) to anon,authenticated;
grant execute on function public.quiz_joker_bewertet(uuid,text,uuid,text,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.meine_wochenserie_mit_joker(p_schiedsrichter_id uuid, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_basis jsonb; v_geboren date; v_heute date:=(now() at time zone 'Europe/Berlin')::date;
  v_jahr int:=extract(year from v_heute); v_tag date; v_seit date; v_joker jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  select s.geburtsdatum,(s.erstellt_am at time zone 'Europe/Berlin')::date into v_geboren,v_seit
    from public.schiedsrichter s where s.id=p_schiedsrichter_id for update;
  perform private.joker_belohnungen_sync(p_schiedsrichter_id);
  v_basis:=public.meine_wochenserie_basis(p_schiedsrichter_id,p_pin);
  select coalesce(jsonb_agg(w.value||jsonb_build_object('joker_gerettet',exists(
    select 1 from public.geburtstagsjoker j where j.schiedsrichter_id=p_schiedsrichter_id and j.runde_id=(w.value->>'runde_id')::uuid) or exists(select 1 from private.jokerbestand j where j.person=p_schiedsrichter_id and j.typ='serienjoker' and j.verbraucht_am is not null and j.runde=(w.value->>'runde_id')::uuid))),'[]')
    into v_joker from jsonb_array_elements(v_basis->'wochen') w;
  v_basis:=jsonb_set(v_basis,'{wochen}',v_joker);
  select coalesce(jsonb_agg(jsonb_build_object('jahr',j.jahr,'gueltig_bis',j.gueltig_bis) order by j.gueltig_bis),'[]')
    into v_joker from public.geburtstagsjoker j where j.schiedsrichter_id=p_schiedsrichter_id
      and j.runde_id is null;
  select v_joker||coalesce(jsonb_agg(jsonb_build_object('id',j.id)),'[]') into v_joker from private.jokerbestand j join private.jokerboxen b on b.id=j.box where j.person=p_schiedsrichter_id and j.typ='serienjoker' and j.verbraucht_am is null and not b.widerrufen;
  return v_basis||jsonb_build_object('joker',v_joker,'belohnungen',public.mein_jokerbestand(p_schiedsrichter_id,p_pin));
end $function$;

-- Explicit administrative resets clear the pending/final Joker workflow too.
-- Consumed inventory is never silently refunded.
CREATE OR REPLACE FUNCTION public.obmann_antwort_ueberschreiben(p_passwort text, p_schiedsrichter text, p_frage_id uuid, p_aktion text, p_option text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
  v_schiedsrichter_id uuid;
  v_antworttyp text;
  v_auswahl text[];
begin
  v_verein := public.obmann_verein(p_passwort);

  if p_aktion not in ('richtig', 'falsch', 'zuruecksetzen') then
    raise exception 'Ungueltige Aktion';
  end if;

  select id into v_schiedsrichter_id
  from public.schiedsrichter
  where name = p_schiedsrichter and verein_id = v_verein;

  if v_schiedsrichter_id is null then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;

  select coalesce(nullif(antworttyp, ''), 'multiple_choice')
  into v_antworttyp
  from public.fragen
  where id = p_frage_id;

  if v_antworttyp is null then
    raise exception 'Frage nicht gefunden';
  end if;

  if p_aktion = 'zuruecksetzen' then
    delete from private.quiz_joker_vorgaenge where person=v_schiedsrichter_id and frage=p_frage_id;
    delete from public.antworten
    where schiedsrichter_id = v_schiedsrichter_id and frage_id = p_frage_id;
    return;
  end if;

  if p_option is not null then
    if v_antworttyp = 'mehrfachauswahl' then
      v_auswahl := regexp_split_to_array(lower(regexp_replace(p_option, '\s+', '', 'g')), ',');

      if cardinality(v_auswahl) = 0
         or cardinality(v_auswahl) <> (select count(distinct wert) from unnest(v_auswahl) wert)
         or exists (
           select 1 from unnest(v_auswahl) wert
           where wert !~ '^[a-h]$'
              or not exists (
                select 1 from public.frage_antwortoptionen o
                where o.frage_id = p_frage_id and o.schluessel = wert)) then
        raise exception 'Ungueltige Antwortauswahl';
      end if;
    else
      if p_option !~ '^[a-h]$' or not exists (
        select 1
        from public.fragen f
        where f.id = p_frage_id
          and (
            exists (
              select 1 from public.frage_antwortoptionen o
              where o.frage_id = f.id and o.schluessel = p_option)
            or (
              not exists (
                select 1 from public.frage_antwortoptionen o2
                where o2.frage_id = f.id)
              and ((p_option = 'a' and f.option_a is not null)
                or (p_option = 'b' and f.option_b is not null)
                or (p_option = 'c' and f.option_c is not null))))) then
        raise exception 'Ungueltige Option';
      end if;
    end if;
  end if;

  insert into public.antworten (
    schiedsrichter_id, frage_id, gegebene_option, gegebene_auswahl,
    korrekt, bewertungsstatus, manuell_korrigiert, beantwortet_am
  )
  values (
    v_schiedsrichter_id,
    p_frage_id,
    case when v_antworttyp <> 'mehrfachauswahl' then p_option else null end,
    case when v_antworttyp = 'mehrfachauswahl' then v_auswahl else null end,
    p_aktion = 'richtig',
    case when p_aktion = 'richtig' then 'richtig' else 'falsch' end,
    true,
    now()
  )
  on conflict (schiedsrichter_id, frage_id) do update
    set gegebene_option = case
          when p_option is null then antworten.gegebene_option
          else excluded.gegebene_option
        end,
        gegebene_auswahl = case
          when p_option is null then antworten.gegebene_auswahl
          else excluded.gegebene_auswahl
        end,
        korrekt = excluded.korrekt,
        bewertungsstatus = excluded.bewertungsstatus,
        manuell_korrigiert = true,
        beantwortet_am = now();
end;
$function$;
CREATE OR REPLACE FUNCTION public.obmann_antworten_zuruecksetzen(p_passwort text, p_schiedsrichter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
  v_schiedsrichter_id uuid;
  v_antworten integer := 0;
  v_hist_antworten integer := 0;
  v_hist_fortschritt integer := 0;
begin
  v_verein := obmann_verein(p_passwort);

  if p_schiedsrichter is null then
    delete from private.quiz_joker_vorgaenge where person in (select id from public.schiedsrichter where verein_id=v_verein);
    delete from antworten
    where schiedsrichter_id in (select id from schiedsrichter where verein_id = v_verein);
    get diagnostics v_antworten = row_count;

    delete from historie_antworten
    where schiedsrichter_id in (select id from schiedsrichter where verein_id = v_verein);
    get diagnostics v_hist_antworten = row_count;

    delete from historie_fortschritt
    where schiedsrichter_id in (select id from schiedsrichter where verein_id = v_verein);
    get diagnostics v_hist_fortschritt = row_count;
  else
    select id into v_schiedsrichter_id
    from schiedsrichter where name = p_schiedsrichter and verein_id = v_verein;
    if v_schiedsrichter_id is null then
      raise exception 'Schiedsrichter nicht gefunden';
    end if;

    delete from private.quiz_joker_vorgaenge where person=v_schiedsrichter_id;
    delete from antworten where schiedsrichter_id = v_schiedsrichter_id;
    get diagnostics v_antworten = row_count;
    delete from historie_antworten where schiedsrichter_id = v_schiedsrichter_id;
    get diagnostics v_hist_antworten = row_count;
    delete from historie_fortschritt where schiedsrichter_id = v_schiedsrichter_id;
    get diagnostics v_hist_fortschritt = row_count;
  end if;

  return json_build_object(
    'antworten', v_antworten,
    'historie_antworten', v_hist_antworten,
    'historie_fortschritt', v_hist_fortschritt
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.obmann_woche_antworten_zuruecksetzen(p_passwort text, p_schiedsrichter text, p_runde_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_verein uuid;
  v_schiedsrichter_id uuid;
  v_anzahl integer;
begin
  v_verein := obmann_verein(p_passwort);

  select id into v_schiedsrichter_id
  from schiedsrichter
  where name = p_schiedsrichter and verein_id = v_verein;

  if v_schiedsrichter_id is null then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;

  delete from private.quiz_joker_vorgaenge v where v.person=v_schiedsrichter_id
    and v.frage in (select rf.frage_id from public.runden_fragen rf where rf.runde_id=p_runde_id and rf.verein_id=v_verein);
  delete from antworten
  where schiedsrichter_id = v_schiedsrichter_id
    and frage_id in (
      select rf.frage_id from runden_fragen rf
      where rf.runde_id = p_runde_id and rf.verein_id = v_verein);
  get diagnostics v_anzahl = row_count;

  return v_anzahl;
end;
$function$;
CREATE OR REPLACE FUNCTION public.geburtstagsjoker_einloesen(p_schiedsrichter_id uuid, p_pin text, p_runde_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and j.runde_id is null
    order by j.erhalten_am,j.jahr limit 1 for update;
  if v_jahr is null then
    perform private.joker_verbrauchen(p_schiedsrichter_id,'serienjoker',null,p_runde_id);
  else
  update public.geburtstagsjoker set runde_id=p_runde_id,eingeloest_am=now()
    where schiedsrichter_id=p_schiedsrichter_id and jahr=v_jahr;
  end if;
  return public.meine_wochenserie_mit_joker(p_schiedsrichter_id,p_pin);
end $function$;

