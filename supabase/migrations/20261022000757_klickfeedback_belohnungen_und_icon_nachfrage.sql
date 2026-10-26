-- Applied as 20261022000757. No real stock, answers, results or probabilities changed.
alter table private.jokerboxen add column manuell_widerrufen boolean not null default false;
alter table private.jokerboxen drop constraint jokerboxen_typ_check;
alter table private.jokerboxen add constraint jokerboxen_typ_check check(typ in ('serienjoker','halbhalb','zweiter-versuch','denkanstoss','fehlerlupe','zufallsbaustein','schluesselbaustein'));
alter table private.jokerbestand drop constraint jokerbestand_typ_check;
alter table private.jokerbestand add constraint jokerbestand_typ_check check(typ in ('serienjoker','halbhalb','zweiter-versuch','denkanstoss','fehlerlupe','zufallsbaustein','schluesselbaustein'));

create table private.belohnung_audit (
 id uuid primary key default gen_random_uuid(), verein uuid not null references public.vereine(id),
 person uuid not null references public.schiedsrichter(id) on delete cascade,
 anfrage uuid not null, aktion text not null, typ text, anzahl integer not null,
 grund text not null check(length(btrim(grund)) between 3 and 300), ziel uuid,
 erstellt_am timestamptz not null default now(), unique(verein,anfrage)
);
create index belohnung_audit_person on private.belohnung_audit(person,erstellt_am);
create table private.frage_joker_hinweise (
 verein uuid not null references public.vereine(id), frage uuid not null references public.fragen(id) on delete cascade,
 hinweis text not null check(length(btrim(hinweis)) between 1 and 400),
 aktualisiert_am timestamptz not null default now(), primary key(verein,frage)
);
create table private.quiz_hinweis_einsaetze (
 person uuid not null references public.schiedsrichter(id) on delete cascade,
 frage uuid not null references public.fragen(id) on delete cascade,
 typ text not null, joker uuid not null references private.jokerbestand(id),
 hinweis text not null, erstellt_am timestamptz not null default now(),
 primary key(person,frage,typ)
);
create index quiz_hinweis_joker on private.quiz_hinweis_einsaetze(joker);
create table private.icon_nachfragen (
 person uuid not null references public.schiedsrichter(id) on delete cascade,
 frage uuid not null references public.fragen(id) on delete cascade,
 erste_antwort jsonb not null, frage_text text not null,
 ergaenzung text, ergebnis jsonb, erstellt_am timestamptz not null default now(),
 primary key(person,frage)
);
alter table private.belohnung_audit enable row level security;
alter table private.frage_joker_hinweise enable row level security;
alter table private.quiz_hinweis_einsaetze enable row level security;
alter table private.icon_nachfragen enable row level security;
revoke all on private.belohnung_audit,private.frage_joker_hinweise,private.quiz_hinweis_einsaetze,private.icon_nachfragen from public,anon,authenticated;

create function public.obmann_belohnungen(p_passwort text,p_schiedsrichter text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid; s uuid; b jsonb; j jsonb; a jsonb;
begin
 v:=public.obmann_verein(p_passwort);
 select id into s from public.schiedsrichter where name=p_schiedsrichter and verein_id=v;
 if s is null then raise exception 'Person nicht im eigenen Verein'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'typ',typ,'quelle',quelle,'widerrufen',widerrufen,'geoeffnet',geoeffnet_am is not null) order by verdient_am desc),'[]') into b from private.jokerboxen where person=s;
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'typ',j.typ,'quelle',b.quelle,'widerrufen',b.widerrufen,'verbraucht',j.verbraucht_am is not null) order by j.erhalten_am desc),'[]') into j from private.jokerbestand j join private.jokerboxen b on b.id=j.box where j.person=s;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'aktion',aktion,'typ',typ,'anzahl',anzahl,'grund',grund,'erstellt_am',erstellt_am) order by erstellt_am desc),'[]') into a from private.belohnung_audit where person=s;
 return jsonb_build_object('boxen',b,'joker',j,'verlauf',a);
end $$;

create function public.obmann_belohnung_aendern(p_passwort text,p_schiedsrichter text,p_anfrage uuid,p_aktion text,p_typ text,p_anzahl integer,p_grund text,p_ziel uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid; s uuid; bid uuid; i integer; alt private.belohnung_audit; b private.jokerboxen; j private.jokerbestand;
begin
 v:=public.obmann_verein(p_passwort);
 select id into s from public.schiedsrichter where name=p_schiedsrichter and verein_id=v for update;
 if s is null then raise exception 'Person nicht im eigenen Verein'; end if;
 if p_anfrage is null or length(btrim(coalesce(p_grund,''))) not between 3 and 300 then raise exception 'Kurzen Grund angeben (3 bis 300 Zeichen)'; end if;
 select * into alt from private.belohnung_audit where verein=v and anfrage=p_anfrage;
 if found then
  if alt.person<>s or alt.aktion<>p_aktion or alt.typ is distinct from p_typ or alt.anzahl is distinct from p_anzahl or alt.ziel is distinct from p_ziel or alt.grund<>btrim(p_grund) then raise exception 'Anfragekennung bereits anders verwendet'; end if;
  return public.obmann_belohnungen(p_passwort,p_schiedsrichter);
 end if;
 if p_aktion in ('box_vergeben','joker_vergeben') then
  if p_anzahl is null or p_anzahl not between 1 and 5 or p_ziel is not null then raise exception '1 bis 5 auswählen'; end if;
  if p_aktion='box_vergeben' and p_typ is not null then raise exception 'Boxtyp wird erst beim Öffnen ausgelost'; end if;
  if p_aktion='joker_vergeben' and (p_typ is null or p_typ not in ('serienjoker','halbhalb','zweiter-versuch','denkanstoss','fehlerlupe','zufallsbaustein','schluesselbaustein')) then raise exception 'Jokertyp ungültig'; end if;
  for i in 1..p_anzahl loop
   insert into private.jokerboxen(person,quelle,schluessel,geoeffnet_am,typ)
   values(s,'Durch Obmann vergeben','obmann:'||p_anfrage||':'||i,case when p_typ is not null then now() end,p_typ) returning id into bid;
   if p_typ is not null then insert into private.jokerbestand(person,box,typ) values(s,bid,p_typ); end if;
  end loop;
 elsif p_aktion in ('box_entziehen','joker_entziehen') then
  if p_anzahl is distinct from 1 or p_ziel is null or p_typ is not null then raise exception 'Genau einen Bestand auswählen'; end if;
  if p_aktion='joker_entziehen' then
   select * into j from private.jokerbestand where id=p_ziel and person=s for update;
   if j.id is null or j.verbraucht_am is not null then raise exception 'Nur unbenutzte Joker zurücknehmen'; end if;
   bid:=j.box;
  else bid:=p_ziel; end if;
  select * into b from private.jokerboxen where id=bid and person=s for update;
  if b.id is null or b.widerrufen or (p_aktion='box_entziehen' and b.geoeffnet_am is not null) then raise exception 'Dieser Bestand kann nicht zurückgenommen werden'; end if;
  update private.jokerboxen set widerrufen=true,manuell_widerrufen=true where id=bid;
 else raise exception 'Aktion ungültig'; end if;
 insert into private.belohnung_audit(verein,person,anfrage,aktion,typ,anzahl,grund,ziel) values(v,s,p_anfrage,p_aktion,p_typ,p_anzahl,btrim(p_grund),p_ziel);
 return public.obmann_belohnungen(p_passwort,p_schiedsrichter);
end $$;

create function public.obmann_frage_jokerhinweis(p_passwort text,p_frage uuid,p_hinweis text default null,p_speichern boolean default false) returns text
language plpgsql security definer set search_path='' as $$
declare v uuid; t text;
begin
 v:=public.obmann_verein(p_passwort);
 if not exists(select 1 from public.fragen where id=p_frage) then raise exception 'Frage nicht gefunden'; end if;
 if p_speichern then
  if length(coalesce(p_hinweis,''))>400 then raise exception 'Maximal 400 Zeichen'; end if;
  if nullif(btrim(p_hinweis),'') is null then delete from private.frage_joker_hinweise where frage=p_frage and verein=v;
  else insert into private.frage_joker_hinweise(verein,frage,hinweis) values(v,p_frage,btrim(p_hinweis)) on conflict(verein,frage) do update set hinweis=excluded.hinweis,aktualisiert_am=now(); end if;
 end if;
 select hinweis into t from private.frage_joker_hinweise where frage=p_frage and verein=v;
 return coalesce(t,'');
end $$;

create function public.quiz_hinweisjoker(p_schiedsrichter_id uuid,p_pin text,p_frage_id uuid,p_typ text,p_antwort jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid; r uuid; l public.frage_entscheidungsloesungen; h text; teile jsonb:='[]'; teil jsonb; j uuid; a private.quiz_hinweis_einsaetze;
begin
 v:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 perform 1 from public.schiedsrichter where id=p_schiedsrichter_id for update;
 select rf.runde_id into r from public.runden_fragen rf join public.runden rd on rd.id=rf.runde_id join public.fragen f on f.id=rf.frage_id where rf.verein_id=v and rf.frage_id=p_frage_id and f.aktiv and now() between rd.startet_am and rd.endet_am;
 if r is null then raise exception 'Nicht im aktuellen Wochenquiz'; end if;
 if exists(select 1 from public.antworten where schiedsrichter_id=p_schiedsrichter_id and frage_id=p_frage_id) or exists(select 1 from private.quiz_joker_vorgaenge where person=p_schiedsrichter_id and frage=p_frage_id and status<>'offen') then raise exception 'Nur vor der ersten Antwort'; end if;
 select * into a from private.quiz_hinweis_einsaetze where person=p_schiedsrichter_id and frage=p_frage_id and typ=p_typ;
 if found then return jsonb_build_object('hinweis',a.hinweis,'typ',p_typ); end if;
 if p_typ='denkanstoss' then select hinweis into h from private.frage_joker_hinweise where frage=p_frage_id and verein=v;
 elsif p_typ in ('fehlerlupe','zufallsbaustein','schluesselbaustein') then
  select * into l from public.frage_entscheidungsloesungen where frage_id=p_frage_id;
  if not found then raise exception 'Dieser Joker passt nur zu Icon-Fragen'; end if;
  if l.fordert_fortsetzung then teile:=teile||jsonb_build_array(jsonb_build_object('feld','fortsetzung','text','Spielfortsetzung: '||case l.spielfortsetzung when 'weiterspielen' then 'Weiterspielen' when 'direkter_freistoss' then 'Direkter Freistoß' when 'indirekter_freistoss' then 'Indirekter Freistoß' when 'strafstoss' then 'Strafstoß' when 'sr_ball' then 'Schiedsrichter-Ball' when 'eckstoss' then 'Eckstoß' when 'abstoss' then 'Abstoß' when 'einwurf' then 'Einwurf' when 'anstoss' then 'Anstoß' end)); end if;
  if l.fordert_fortsetzung_ort and nullif(l.fortsetzung_ort,'') is not null then teile:=teile||jsonb_build_array(jsonb_build_object('feld','ort','text','Ausführungsort: '||l.fortsetzung_ort)); end if;
  if l.fordert_strafe then teile:=teile||jsonb_build_array(jsonb_build_object('feld','strafe','text',public.entscheidung_anzeige(jsonb_build_object('persoenliche_strafe',l.persoenliche_strafe,'strafe_fuer_mannschaft',l.strafe_fuer_mannschaft,'strafe_fuer_rolle',l.strafe_fuer_rolle,'strafe_rueckennummer',l.strafe_rueckennummer)))); end if;
  if jsonb_array_length(teile)=0 then raise exception 'Kein geeigneter Antwortbaustein'; end if;
  if p_typ='zufallsbaustein' then select value into teil from jsonb_array_elements(teile) order by random() limit 1;
  else
   select value into teil from jsonb_array_elements(teile) order by case
    when value->>'feld'='fortsetzung' and not coalesce(p_antwort->>'spielfortsetzung'=any(l.spielfortsetzungen_gueltig),false) then 0
    when value->>'feld'='strafe' and not private.entscheidung_kern_richtig(p_frage_id,p_antwort) then 1 else 2 end limit 1;
  end if;
  h:=case when p_typ='fehlerlupe' then 'Schau besonders auf '||case teil->>'feld' when 'fortsetzung' then 'die Spielfortsetzung.' when 'ort' then 'den Ausführungsort.' else 'die persönliche Strafe.' end||' Das bestätigt noch keine deiner Antworten.' else teil->>'text' end;
 else raise exception 'Jokertyp ungültig'; end if;
 if nullif(h,'') is null then raise exception 'Für diese Frage ist noch kein Hinweis hinterlegt'; end if;
 j:=private.joker_verbrauchen(p_schiedsrichter_id,p_typ,p_frage_id,r);
 insert into private.quiz_hinweis_einsaetze(person,frage,typ,joker,hinweis) values(p_schiedsrichter_id,p_frage_id,p_typ,j,h);
 return jsonb_build_object('hinweis',h,'typ',p_typ);
end $$;

revoke all on function public.obmann_belohnungen(text,text),public.obmann_belohnung_aendern(text,text,uuid,text,text,integer,text,uuid),public.obmann_frage_jokerhinweis(text,uuid,text,boolean),public.quiz_hinweisjoker(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.obmann_belohnungen(text,text),public.obmann_belohnung_aendern(text,text,uuid,text,text,integer,text,uuid),public.obmann_frage_jokerhinweis(text,uuid,text,boolean),public.quiz_hinweisjoker(uuid,text,uuid,text,jsonb) to anon,authenticated;

-- Service-only clarification. Production API opt-in remains closed until the
-- provider/contract route is clarified; existing AI operations are untouched.
create function public.entscheidung_nachfrage_kontext(p_schiedsrichter_id uuid,p_frage_id uuid,p_pin text,p_antwort jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare x jsonb; n private.icon_nachfragen;
begin
 x:=public.entscheidung_kontext_v3(p_schiedsrichter_id,p_frage_id,p_pin,p_antwort);
 select * into n from private.icon_nachfragen where person=p_schiedsrichter_id and frage=p_frage_id;
 if found then x:=x||jsonb_build_object('nachfrage_offen',n.ergebnis is null,'erste_antwort',n.erste_antwort,'nachfrage',n.frage_text,'finales_ergebnis',n.ergebnis,'kern_richtig',private.entscheidung_kern_richtig(p_frage_id,n.erste_antwort)); end if;
 return x;
end $$;

create function public.entscheidung_mit_nachfrage_speichern(p_schiedsrichter_id uuid,p_frage_id uuid,p_pin text,p_antwort jsonb,p_ort_richtig boolean,p_ort_feedback text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; n private.icon_nachfragen; x jsonb; aid uuid; a jsonb; note jsonb; testkonto boolean;
begin
 perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 select s.ist_test into testkonto from public.schiedsrichter s where s.id=p_schiedsrichter_id for update;
 c:=public.entscheidung_kontext_v3(p_schiedsrichter_id,p_frage_id,p_pin,p_antwort);
 select * into n from private.icon_nachfragen where person=p_schiedsrichter_id and frage=p_frage_id for update;
 if n.ergebnis is not null then return n.ergebnis; end if;
 if n.person is not null then
  if exists(select 1 from public.antworten where schiedsrichter_id=p_schiedsrichter_id and frage_id=p_frage_id and (bewertungsstatus<>'nachbessern' or manuell_korrigiert)) then raise exception 'Antwort wurde inzwischen abschließend bewertet. Bitte neu laden'; end if;
  -- Only the requested reasoning can change, never the original decisions.
  if (p_antwort-'begruendung'-'_begruendung') is distinct from (n.erste_antwort-'begruendung'-'_begruendung') then raise exception 'Nur die Begründung ergänzen'; end if;
  delete from public.antworten where schiedsrichter_id=p_schiedsrichter_id and frage_id=p_frage_id and bewertungsstatus='nachbessern';
  a:=p_antwort;
  if a#>>'{_begruendung,status}'='nachbessern' then a:=jsonb_set(a,'{_begruendung,richtig}','false'); end if;
  x:=public.entscheidung_antwort_speichern_v2(p_schiedsrichter_id,p_frage_id,p_pin,a,p_ort_richtig,p_ort_feedback);
  update public.antworten set gegebener_freitext=public.entscheidung_anzeige(n.erste_antwort),zweiter_freitext=p_antwort->>'begruendung',ki_nachfrage=n.frage_text,ki_feedback_final=p_antwort#>>'{_begruendung,feedback}',versuch_anzahl=2 where schiedsrichter_id=p_schiedsrichter_id and frage_id=p_frage_id;
  update private.icon_nachfragen set ergaenzung=p_antwort->>'begruendung',ergebnis=x where person=p_schiedsrichter_id and frage=p_frage_id;
  return x;
 end if;
 if exists(select 1 from public.antworten where schiedsrichter_id=p_schiedsrichter_id and frage_id=p_frage_id) then
  return public.entscheidung_antwort_speichern_v2(p_schiedsrichter_id,p_frage_id,p_pin,p_antwort,p_ort_richtig,p_ort_feedback);
 end if;
 if p_antwort#>>'{_begruendung,status}'='nachbessern' and (c->>'fordert_begruendung')::boolean
    and (c->>'kern_richtig')::boolean and p_ort_richtig
    and not exists(select 1 from private.quiz_joker_vorgaenge where person=p_schiedsrichter_id and frage=p_frage_id and status in ('angebot','zweiter','fertig')) then
  if length(btrim(coalesce(p_antwort#>>'{_begruendung,nachfrage}',''))) not between 8 and 240 then raise exception 'Nachfrage fehlt'; end if;
  insert into private.icon_nachfragen(person,frage,erste_antwort,frage_text) values(p_schiedsrichter_id,p_frage_id,p_antwort,p_antwort#>>'{_begruendung,nachfrage}');
  if not testkonto then
   insert into public.antworten(schiedsrichter_id,frage_id,korrekt,gegebener_freitext,bewertungsstatus,ki_nachfrage,versuch_anzahl)
   values(p_schiedsrichter_id,p_frage_id,false,public.entscheidung_anzeige(p_antwort),'nachbessern',p_antwort#>>'{_begruendung,nachfrage}',1);
  end if;
  return jsonb_build_object('nachbesserung_offen',true,'bewertungsstatus','nachbessern','ki_nachfrage',p_antwort#>>'{_begruendung,nachfrage}','antwort',p_antwort-'_begruendung');
 end if;
 return public.quiz_joker_bewertet(p_schiedsrichter_id,p_pin,p_frage_id,'entscheidung',jsonb_build_object('antwort',p_antwort,'ort_richtig',p_ort_richtig,'ort_feedback',p_ort_feedback));
end $$;
revoke all on function public.entscheidung_nachfrage_kontext(uuid,uuid,text,jsonb),public.entscheidung_mit_nachfrage_speichern(uuid,uuid,text,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.entscheidung_nachfrage_kontext(uuid,uuid,text,jsonb),public.entscheidung_mit_nachfrage_speichern(uuid,uuid,text,jsonb,boolean,text) to service_role;

do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.meine_antworten_v2(uuid,text)'::regprocedure);
 if position('case when ae.antwort_id is not null then' in d)=0 then raise exception 'Unexpected answer projection'; end if;
 d:=replace(d,'case when ae.antwort_id is not null then',
  'case when n.person is not null and n.ergebnis is null then jsonb_build_object(''antwort'',n.erste_antwort-''_begruendung'',''nachbesserung_offen'',true,''ki_nachfrage'',n.frage_text) when ae.antwort_id is not null then');
 d:=replace(d,'left join public.antwort_entscheidungen ae on ae.antwort_id=a.id',
  'left join public.antwort_entscheidungen ae on ae.antwort_id=a.id left join private.icon_nachfragen n on n.person=p_schiedsrichter_id and n.frage=f.id');
 if position('left join private.icon_nachfragen n' in d)=0 then raise exception 'Unexpected answer join'; end if;
 execute d;
end $migration$;
create or replace function private.joker_belohnungen_sync(p_person uuid) returns void
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
 where b.person=p_person and not b.manuell_widerrufen and b.schluessel like 'teilnahme:%';
 basis:=public.meine_wochenserie_basis(p_person,s.pin);
 for w in select value from jsonb_array_elements(basis->'wochen') loop
  if (w->>'startet_am')::timestamptz>=timestamptz '2026-10-18 00:00:00 Europe/Berlin'
   and (w->>'fragen_gesamt')::int>0 and (w->>'beantwortet')::int>=(w->>'fragen_gesamt')::int then anzahl:=anzahl+1; end if;
 end loop;
 for i in 1..(anzahl/4) loop
  insert into private.jokerboxen(person,quelle,schluessel) values(p_person,'Vier vollständige Quizwochen','vier-wochen:'||i) on conflict do nothing;
 end loop;
end $$;
create or replace function public.mein_jokerbestand(p_schiedsrichter_id uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bestand jsonb; boxen jsonb; vorgaenge jsonb;
begin
 perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 perform private.joker_belohnungen_sync(p_schiedsrichter_id);
 select jsonb_build_object('serienjoker',
  (select count(*) from public.geburtstagsjoker where schiedsrichter_id=p_schiedsrichter_id and runde_id is null)
  +count(*) filter(where j.typ='serienjoker'),
  'halbhalb',count(*) filter(where j.typ='halbhalb'),'zweiter-versuch',count(*) filter(where j.typ='zweiter-versuch'),'denkanstoss',count(*) filter(where j.typ='denkanstoss'),'fehlerlupe',count(*) filter(where j.typ='fehlerlupe'),'zufallsbaustein',count(*) filter(where j.typ='zufallsbaustein'),'schluesselbaustein',count(*) filter(where j.typ='schluesselbaustein'))
 into bestand from private.jokerbestand j join private.jokerboxen b on b.id=j.box
 where j.person=p_schiedsrichter_id and j.verbraucht_am is null and not b.widerrufen;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'quelle',quelle,'verdient_am',verdient_am) order by verdient_am,id),'[]')
 into boxen from private.jokerboxen where person=p_schiedsrichter_id and geoeffnet_am is null and not widerrufen;
 select coalesce(jsonb_agg(jsonb_build_object('frage_id',v.frage,'status',v.status,'kandidaten',v.kandidaten,
  'joker_eingesetzt',v.halbhalb is not null or v.zweiter is not null,
  'halbhalb',v.halbhalb is not null,'zweiter',v.zweiter is not null)),'[]') into vorgaenge
 from private.quiz_joker_vorgaenge v join public.runden r on r.id=v.runde
 where v.person=p_schiedsrichter_id and now()>=r.startet_am and now()<r.endet_am;
 return jsonb_build_object('bestand',bestand,'boxen',boxen,'vorgaenge',vorgaenge,'hinweise',coalesce((select jsonb_agg(jsonb_build_object('frage_id',rf.frage_id,
 'denkanstoss',exists(select 1 from private.frage_joker_hinweise h where h.frage=rf.frage_id and h.verein=rf.verein_id),
 'icon',exists(select 1 from public.frage_entscheidungsloesungen l where l.frage_id=rf.frage_id),
 'einsaetze',coalesce((select jsonb_agg(jsonb_build_object('typ',e.typ,'hinweis',e.hinweis)) from private.quiz_hinweis_einsaetze e where e.person=p_schiedsrichter_id and e.frage=rf.frage_id),'[]')))
 from public.runden_fragen rf join public.runden r on r.id=rf.runde_id where rf.verein_id=(select verein_id from public.schiedsrichter where id=p_schiedsrichter_id) and now() between r.startet_am and r.endet_am),'[]'));
end $$;
