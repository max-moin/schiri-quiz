-- Applied as 20261018221606. Only unopened boxes use the new draw weights.
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.jokerbox_oeffnen(uuid,text,uuid)'::regprocedure);
 if position('(array[''serienjoker'',''halbhalb'',''zweiter-versuch''])[1+floor(random()*3)::int]' in d)=0 then
  raise exception 'Unexpected Joker draw definition; review before migrating';
 end if;
 d:=replace(d,'(array[''serienjoker'',''halbhalb'',''zweiter-versuch''])[1+floor(random()*3)::int]',
  'case when random() < 0.1 then ''serienjoker'' else ''zweiter-versuch'' end');
 d:=replace(d,'Equal chances, drawn exactly once in this locked transaction.',
  '90% second attempt / 10% series rescue; drawn exactly once under row lock.');
 execute d;
end $migration$;

-- Older MC answers can have a null assessment status; wrong remains wrong.
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.meine_quiz_statistik(uuid,text,integer)'::regprocedure);
 d:=replace(d,'a.korrekt is false and a.bewertungsstatus <> ''nachbessern''',
   'a.korrekt is false and coalesce(a.bewertungsstatus,''falsch'') not in (''nachbessern'',''richtig'')');
 execute d;
end $migration$;

-- Only question wording + own outcome, never answers, hints, media URLs or internal titles.
create function public.meine_quizwochen_fragen(p_schiedsrichter_id uuid,p_pin text,p_runde_id uuid)
returns table(frage_id uuid,"position" integer,medium text,frage_text text,status text)
language plpgsql security definer set search_path='' as $function$
declare v_verein uuid;
begin
 v_verein:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
 if not exists(select 1 from public.runden r join public.runden_fragen rf on rf.runde_id=r.id
  where r.id=p_runde_id and r.startet_am<=now() and rf.verein_id=v_verein) then
  raise exception 'Diese Quizwoche ist nicht verfügbar.';
 end if;
 return query
 select f.id,min(rf.position)::integer,f.medium,
  case when f.medium='video' then 'Video-Frage' when f.medium='bild' then 'Bild-Frage' else f.frage_text end,
  case when a.korrekt is true or a.bewertungsstatus='richtig' then 'richtig'
   when a.bewertungsstatus='nachbessern' then 'nachbessern'
   when a.id is not null and (a.korrekt is false or a.bewertungsstatus='falsch') then 'falsch'
   else 'offen' end
 from public.runden_fragen rf join public.fragen f on f.id=rf.frage_id
 left join public.antworten a on a.frage_id=f.id and a.schiedsrichter_id=p_schiedsrichter_id
 where rf.runde_id=p_runde_id and rf.verein_id=v_verein
 group by f.id,a.id order by min(rf.position),f.id;
end $function$;
revoke all on function public.meine_quizwochen_fragen(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.meine_quizwochen_fragen(uuid,text,uuid) to anon,authenticated;

-- Preserve the real previous phase on future transitions; do not invent old history.
alter table public.ausruestung_ereignisse add column if not exists vorheriger_status text;
comment on column public.ausruestung_ereignisse.vorheriger_status is
 'Exact previous phase captured atomically from 19 October 2026; null on older events.';
do $migration$
declare d text; marker text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='ausruestung_uebergang';
 marker:='    p_nach in (''eingereicht'',''freigegeben'',''abgelehnt'',''gekauft'',''beleg_hochgeladen'',''geld_erhalten''));';
 if position(marker in d)=0 then raise exception 'Unexpected process transition definition';end if;
 d:=replace(d,marker,marker||E'\n  update public.ausruestung_ereignisse set vorheriger_status=a.prozess_status\n   where anfrage_id=p_anfrage and schritt=p_nach and runde=a.prozess_runde\n     and vorheriger_status is null;');
 -- A Schiri withdrawal is a new inbox event, not a deletion.
 d:=replace(d,'''eingereicht'',''freigegeben'',''abgelehnt'',''gekauft'',''beleg_hochgeladen'',''geld_erhalten''',
  '''eingereicht'',''freigegeben'',''abgelehnt'',''gekauft'',''beleg_hochgeladen'',''geld_erhalten'',''zurueckgezogen''');
 execute d;

 d:=pg_get_functiondef('public.ausruestung_prozess_jsonb(uuid,text)'::regprocedure);
 if position('v_letzte := case' in d)=0 or position('when ''zurueckgezogen''     then 1' in d)=0 then
  raise exception 'Unexpected process renderer definition';end if;
 d:=replace(d,'v_letzte := case',
  E'select jsonb_build_object(''rolle'',e.akteur_rolle,''name'',e.akteur_name,\n    ''zeit'',e.erstellt_am,''vorheriger_status'',e.vorheriger_status,\n    ''vorheriger_titel'',case when e.vorheriger_status is not null then public.ausruestung_schritt_titel(e.vorheriger_status) else null end)\n    into v_ruecknahme from public.ausruestung_ereignisse e\n    where e.anfrage_id=p_anfrage and e.schritt=''zurueckgezogen'' and e.runde=a.prozess_runde\n    order by e.erstellt_am desc,e.id desc limit 1;\n  select jsonb_build_object(''rolle'',e.akteur_rolle,''name'',e.akteur_name,\n    ''zeit'',e.erstellt_am,''vorheriger_status'',e.vorheriger_status,\n    ''vorheriger_titel'',public.ausruestung_schritt_titel(e.vorheriger_status))\n    into v_rueckgabe from public.ausruestung_ereignisse e\n    where e.anfrage_id=p_anfrage and e.schritt in (''eingereicht'',''geprueft'')\n     and e.akteur_rolle=''obmann'' and e.vorheriger_status is not null\n     and e.vorheriger_status not in (''eingereicht'',''geprueft'')\n    order by e.erstellt_am desc,e.id desc limit 1;\n  v_letzte := case');
 d:=replace(d,'  a             public.ausruestungs_anfragen%rowtype;',
  E'  a             public.ausruestungs_anfragen%rowtype;\n  v_ruecknahme jsonb;\n  v_rueckgabe jsonb;');
 d:=replace(d,'when ''zurueckgezogen''     then 1',
  'when ''zurueckgezogen''     then case when v_ruecknahme->>''vorheriger_status''=''geprueft'' then 2 else 1 end');
 d:=replace(d,'''id'', a.id,',E'''id'', a.id,\n    ''ruecknahme'',v_ruecknahme,\n    ''rueckgabe'',v_rueckgabe,');
 execute d;
end $migration$;
