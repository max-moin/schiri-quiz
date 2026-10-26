-- Getrennt vom bewerteten Quiz; keine Antworten, Joker oder Mails in Altpfaden.
create table private.hausregeltests (
 id uuid primary key default gen_random_uuid(),
 verein_id uuid not null references public.vereine(id) on delete cascade,
 kennung text not null,
 titel text not null,
 fragen jsonb not null,
 vorbereitung_bis timestamptz not null,
 endfassung_ab timestamptz not null,
 abgabe_bis timestamptz not null,
 aktiv boolean not null default false,
 unique(verein_id,kennung),
 check (vorbereitung_bis<=endfassung_ab and endfassung_ab<abgabe_bis)
);
create table private.hausregeltest_antworten (
 test_id uuid not null references private.hausregeltests(id) on delete cascade,
 schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
 vor_antworten jsonb not null default '[]',
 vor_kopf jsonb not null default '{}',
 end_antworten jsonb,
 end_kopf jsonb,
 bestaetigt jsonb,
 revision integer not null default 0,
 geaendert_am timestamptz not null default now(),
 primary key(test_id,schiedsrichter_id)
);
create index hausregeltest_person_idx on private.hausregeltest_antworten(schiedsrichter_id);
create table private.hausregeltest_fassungen (
 test_id uuid not null,
 schiedsrichter_id uuid not null,
 revision integer not null,
 fassung jsonb not null,
 primary key(test_id,schiedsrichter_id,revision),
 foreign key(test_id,schiedsrichter_id) references private.hausregeltest_antworten(test_id,schiedsrichter_id) on delete cascade
);
alter table private.hausregeltests enable row level security;
alter table private.hausregeltest_antworten enable row level security;
alter table private.hausregeltest_fassungen enable row level security;
revoke all on private.hausregeltests,private.hausregeltest_antworten,private.hausregeltest_fassungen from public,anon,authenticated;

create function private.hrt_phase(t private.hausregeltests) returns text
language sql stable set search_path='' as $$
 select case when now()<(t).vorbereitung_bis then 'vorbereitung'
 when now()<(t).endfassung_ab then 'pause'
 when now()<(t).abgabe_bis then 'endfassung' else 'beendet' end;
$$;
create function private.hrt_pruefen(a jsonb,k jsonb,n integer,final boolean) returns void
language plpgsql set search_path='' as $$
declare x jsonb; feld text;
begin
 if jsonb_typeof(a) is distinct from 'array' or jsonb_typeof(k) is distinct from 'object' then raise exception 'Antworten oder Kopfdaten fehlen';end if;
 if jsonb_array_length(a)<>n or octet_length(a::text)>100000 then raise exception 'Antwortenzahl passt nicht';end if;
 for x in select value from jsonb_array_elements(a) loop
  if jsonb_typeof(x) is distinct from 'string' or length(x#>>'{}')>5000 or position(chr(0+1) in (x#>>'{}'))>0 then raise exception 'Antworten: Text bis 5000 Zeichen';end if;
  if final and btrim(x#>>'{}')='' then raise exception 'Bitte alle Fragen beantworten';end if;
 end loop;
 foreach feld in array array['name','verein','einstufung'] loop
  if jsonb_typeof(k->feld) is distinct from 'string' or length(k->>feld)>150 or (k->>feld)~'[\r\n]' then raise exception 'Bitte Name, Verein und Einstufung einzeilig ausfüllen';end if;
  if final and btrim(k->>feld)='' then raise exception 'Name, Verein und Einstufung fehlen';end if;
 end loop;
end $$;

create function public.hausregeltest_laden(p_schiedsrichter_id uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);t private.hausregeltests;r private.hausregeltest_antworten;k jsonb;phase text;
begin
 select * into t from private.hausregeltests where verein_id=v and aktiv order by abgabe_bis desc limit 1;
 if not found then return null;end if;
 select * into r from private.hausregeltest_antworten where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id;
 select jsonb_build_object('name',s.name,'verein',c.name,'einstufung',coalesce(s.liga_einstufung,'')) into k from public.schiedsrichter s join public.vereine c on c.id=s.verein_id where s.id=p_schiedsrichter_id;
 phase:=private.hrt_phase(t);
 return jsonb_build_object('test',to_jsonb(t)-'verein_id','phase',phase,'serverzeit',now(),'revision',coalesce(r.revision,0),
 'antworten',case when phase='vorbereitung' then coalesce(r.vor_antworten,'[]') else coalesce(r.end_antworten,r.vor_antworten,'[]') end,
 'kopf',case when phase='vorbereitung' then coalesce(r.vor_kopf,k) else coalesce(r.end_kopf,r.vor_kopf,k) end,
 'vor_antworten',coalesce(r.vor_antworten,'[]'),'bestaetigt',r.bestaetigt);
end $$;

create function public.hausregeltest_speichern(p_schiedsrichter_id uuid,p_pin text,p_test_id uuid,p_revision integer,p_phase text,p_antworten jsonb,p_kopf jsonb,p_bestaetigen boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);t private.hausregeltests;r private.hausregeltest_antworten;phase text;b jsonb;
begin
 select * into t from private.hausregeltests where id=p_test_id and verein_id=v and aktiv for share;
 if not found then raise exception 'Test nicht verfügbar';end if;
 phase:=private.hrt_phase(t);
 if phase not in ('vorbereitung','endfassung') or p_phase is distinct from phase then raise exception 'Die Bearbeitungsphase hat gewechselt. Bitte Eingabe kopieren und neu laden';end if;
 if p_bestaetigen is null or (p_bestaetigen and phase<>'endfassung') then raise exception 'Endfassung erst ab Besprechung bestätigen';end if;
 perform private.hrt_pruefen(p_antworten,p_kopf,jsonb_array_length(t.fragen),p_bestaetigen);
 insert into private.hausregeltest_antworten(test_id,schiedsrichter_id) values(t.id,p_schiedsrichter_id) on conflict do nothing;
 select * into r from private.hausregeltest_antworten where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id for update;
 if p_revision is distinct from r.revision then raise exception 'Auf einem anderen Gerät geändert. Bitte Eingabe kopieren und neu laden';end if;
 if p_bestaetigen then
  b:=jsonb_build_object('kopf',jsonb_build_object('name',p_kopf->>'name','verein',p_kopf->>'verein','einstufung',p_kopf->>'einstufung'),'antworten',p_antworten,'bestaetigt_am',now(),'revision',r.revision+1);
 end if;
 update private.hausregeltest_antworten set
  vor_antworten=case when phase='vorbereitung' then p_antworten else vor_antworten end,
  vor_kopf=case when phase='vorbereitung' then p_kopf else vor_kopf end,
  end_antworten=case when phase='endfassung' then p_antworten else end_antworten end,
  end_kopf=case when phase='endfassung' then p_kopf else end_kopf end,
  bestaetigt=b,revision=revision+1,geaendert_am=now()
 where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id returning * into r;
 if b is not null then insert into private.hausregeltest_fassungen values(t.id,p_schiedsrichter_id,r.revision,b);end if;
 return public.hausregeltest_laden(p_schiedsrichter_id,p_pin);
end $$;

create function public.obmann_hausregeltest_laden(p_passwort text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.obmann_verein(p_passwort);t private.hausregeltests;liste jsonb;
begin
 select * into t from private.hausregeltests where verein_id=v order by abgabe_bis desc limit 1;
 if not found then return jsonb_build_object('test',null,'personen','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'vor_antworten',coalesce(a.vor_antworten,'[]'),
 'vor_kopf',a.vor_kopf,'end_antworten',a.end_antworten,'end_kopf',a.end_kopf,'bestaetigt',a.bestaetigt,'revision',coalesce(a.revision,0)) order by s.name),'[]') into liste
 from public.schiedsrichter s left join private.hausregeltest_antworten a on a.schiedsrichter_id=s.id and a.test_id=t.id where s.verein_id=v and s.aktiv;
 return jsonb_build_object('test',to_jsonb(t)-'verein_id','phase',private.hrt_phase(t),'personen',liste);
end $$;

create function public.obmann_hausregeltest_bereitstellen(p_passwort text,p_titel text,p_fragen jsonb,p_vorbereitung_bis timestamptz,p_endfassung_ab timestamptz,p_abgabe_bis timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.obmann_verein(p_passwort);t private.hausregeltests;f jsonb;
begin
 if p_titel is null or length(p_titel)>100 or btrim(p_titel)='' or jsonb_typeof(p_fragen) is distinct from 'array' then raise exception 'Testdaten fehlen';end if;
 if jsonb_array_length(p_fragen)<>10 then raise exception 'Dieser Test hat zehn Fragen';end if;
 for f in select value from jsonb_array_elements(p_fragen) loop
  if jsonb_typeof(f) is distinct from 'string' or length(f#>>'{}') not between 10 and 3000 then raise exception 'Fragetext fehlt';end if;
 end loop;
 if p_vorbereitung_bis is null or p_endfassung_ab is null or p_abgabe_bis is null or p_vorbereitung_bis>p_endfassung_ab or p_endfassung_ab>=p_abgabe_bis then raise exception 'Zeitplan ungültig';end if;
 -- Einmalige Bereitstellung: spätere erneute Klicks überschreiben keine laufenden Daten.
 insert into private.hausregeltests(verein_id,kennung,titel,fragen,vorbereitung_bis,endfassung_ab,abgabe_bis,aktiv)
 values(v,'hrt-1-2026-27',p_titel,p_fragen,p_vorbereitung_bis,p_endfassung_ab,p_abgabe_bis,true) on conflict(verein_id,kennung) do nothing;
 return public.obmann_hausregeltest_laden(p_passwort);
end $$;

revoke all on function private.hrt_phase(private.hausregeltests),private.hrt_pruefen(jsonb,jsonb,integer,boolean) from public,anon,authenticated;
revoke all on function public.hausregeltest_laden(uuid,text),public.hausregeltest_speichern(uuid,text,uuid,integer,text,jsonb,jsonb,boolean),public.obmann_hausregeltest_laden(text),public.obmann_hausregeltest_bereitstellen(text,text,jsonb,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;
-- Vorhandenes Vereins-PIN-/Obmann-Passwortmodell; Prüfung immer vor Datenzugriff.
grant execute on function public.hausregeltest_laden(uuid,text),public.hausregeltest_speichern(uuid,text,uuid,integer,text,jsonb,jsonb,boolean),public.obmann_hausregeltest_laden(text),public.obmann_hausregeltest_bereitstellen(text,text,jsonb,timestamptz,timestamptz,timestamptz) to anon,authenticated;
