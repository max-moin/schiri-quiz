-- Kopfdaten sind Vereinsstammdaten, keine bearbeitbaren Teilnehmerangaben.
-- Ein ergänzter Exportname bleibt ausschließlich im Browser/TXT-Download.
create function private.hrt_stammdaten(p_person uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('name',s.name,
  'verein',case when c.name='Löbtauer Kickers' then 'FV Löbtauer Kickers' else c.name end,
  'einstufung',coalesce(s.liga_einstufung,''))
 from public.schiedsrichter s join public.vereine c on c.id=s.verein_id where s.id=p_person;
$$;
revoke all on function private.hrt_stammdaten(uuid) from public,anon,authenticated;

create or replace function public.hausregeltest_laden(p_schiedsrichter_id uuid,p_pin text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);t private.hausregeltests;r private.hausregeltest_antworten;phase text;
begin
 select * into t from private.hausregeltests where verein_id=v and aktiv order by abgabe_bis desc limit 1;
 if not found then return null;end if;
 select * into r from private.hausregeltest_antworten where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id;
 phase:=private.hrt_phase(t);
 return jsonb_build_object('test',to_jsonb(t)-'verein_id','phase',phase,'serverzeit',now(),'revision',coalesce(r.revision,0),
 'antworten',case when phase='vorbereitung' then coalesce(r.vor_antworten,'[]') else coalesce(r.end_antworten,r.vor_antworten,'[]') end,
 'kopf',private.hrt_stammdaten(p_schiedsrichter_id),
 'vor_antworten',coalesce(r.vor_antworten,'[]'),'bestaetigt',r.bestaetigt);
end $$;

create or replace function public.hausregeltest_speichern(p_schiedsrichter_id uuid,p_pin text,p_test_id uuid,p_revision integer,p_phase text,p_antworten jsonb,p_kopf jsonb,p_bestaetigen boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);t private.hausregeltests;r private.hausregeltest_antworten;phase text;b jsonb;k jsonb;
begin
 select * into t from private.hausregeltests where id=p_test_id and verein_id=v and aktiv for share;
 if not found then raise exception 'Test nicht verfügbar';end if;
 phase:=private.hrt_phase(t);
 if phase not in ('vorbereitung','endfassung') or p_phase is distinct from phase then raise exception 'Die Bearbeitungsphase hat gewechselt. Bitte Eingabe kopieren und neu laden';end if;
 if p_bestaetigen is null or (p_bestaetigen and phase<>'endfassung') then raise exception 'Endfassung erst ab Besprechung bestätigen';end if;
 -- p_kopf bleibt für ältere Clients in der Signatur, wird aber nie gespeichert.
 k:=private.hrt_stammdaten(p_schiedsrichter_id);
 if p_bestaetigen and nullif(btrim(k->>'einstufung'),'') is null then raise exception 'Die Einstufung fehlt noch in deinen Vereinsdaten. Bitte deinen Obmann um Ergänzung bitten';end if;
 perform private.hrt_pruefen(p_antworten,k,jsonb_array_length(t.fragen),p_bestaetigen);
 insert into private.hausregeltest_antworten(test_id,schiedsrichter_id) values(t.id,p_schiedsrichter_id) on conflict do nothing;
 select * into r from private.hausregeltest_antworten where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id for update;
 if p_revision is distinct from r.revision then raise exception 'Auf einem anderen Gerät geändert. Bitte Eingabe kopieren und neu laden';end if;
 if p_bestaetigen then
  b:=jsonb_build_object('kopf',k,'antworten',p_antworten,'bestaetigt_am',now(),'revision',r.revision+1);
 end if;
 update private.hausregeltest_antworten set
  vor_antworten=case when phase='vorbereitung' then p_antworten else vor_antworten end,
  vor_kopf=case when phase='vorbereitung' then k else vor_kopf end,
  end_antworten=case when phase='endfassung' then p_antworten else end_antworten end,
  end_kopf=case when phase='endfassung' then k else end_kopf end,
  bestaetigt=b,revision=revision+1,geaendert_am=now()
 where test_id=t.id and schiedsrichter_id=p_schiedsrichter_id returning * into r;
 if b is not null then insert into private.hausregeltest_fassungen values(t.id,p_schiedsrichter_id,r.revision,b);end if;
 return public.hausregeltest_laden(p_schiedsrichter_id,p_pin);
end $$;

create or replace function public.obmann_hausregeltest_laden(p_passwort text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.obmann_verein(p_passwort);t private.hausregeltests;liste jsonb;
begin
 select * into t from private.hausregeltests where verein_id=v order by abgabe_bis desc limit 1;
 if not found then return jsonb_build_object('test',null,'personen','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'kopf',private.hrt_stammdaten(s.id),'vor_antworten',coalesce(a.vor_antworten,'[]'),
 'vor_kopf',a.vor_kopf,'end_antworten',a.end_antworten,'end_kopf',a.end_kopf,'bestaetigt',a.bestaetigt,'revision',coalesce(a.revision,0)) order by s.name),'[]') into liste
 from public.schiedsrichter s left join private.hausregeltest_antworten a on a.schiedsrichter_id=s.id and a.test_id=t.id where s.verein_id=v and s.aktiv;
 return jsonb_build_object('test',to_jsonb(t)-'verein_id','phase',private.hrt_phase(t),'personen',liste);
end $$;

-- Bestehender eng begrenzter PIN-/Obmann-Zugang, keine neuen Direktrechte.
revoke all on function public.hausregeltest_laden(uuid,text),public.hausregeltest_speichern(uuid,text,uuid,integer,text,jsonb,jsonb,boolean),public.obmann_hausregeltest_laden(text) from public,anon,authenticated;
grant execute on function public.hausregeltest_laden(uuid,text),public.hausregeltest_speichern(uuid,text,uuid,integer,text,jsonb,jsonb,boolean),public.obmann_hausregeltest_laden(text) to anon,authenticated;
