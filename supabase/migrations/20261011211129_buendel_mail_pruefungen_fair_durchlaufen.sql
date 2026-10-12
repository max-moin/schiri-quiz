-- Live angewandt am 11.10.2026 als 20261011211129.
-- Nachlauf: interne Prüfkandidaten fair rotieren, ohne Fachzeitstempel zu ändern.
create or replace function public.benachrichtigung_buendel_pruefen()
returns integer language plpgsql security definer set search_path to '' as $function$
declare p record; v_verein uuid; v_name text; v_anzahl integer; v_offen integer;
  v_ja integer; v_nein integer; v_runden text; v_typ text; v_erstellt integer:=0;
begin
  for p in select q.buendel_id,q.phase from public.benachrichtigung_buendel_pruefungen q
    order by q.erstellt_am,q.buendel_id for update skip locked limit 50
  loop
    select s.verein_id,public.benachrichtigung_kurzname(s.name) into v_verein,v_name
      from public.ausruestungs_buendel b join public.schiedsrichter s on s.id=b.schiedsrichter_id
     where b.id=p.buendel_id;
    select count(*),
      count(*) filter(where case when p.phase='entscheidung'
        then a.prozess_status in ('eingereicht','geprueft','vorgelegt')
        else coalesce(a.beschaffungsweg,'weg2_schiri_besorgt')='weg2_schiri_besorgt'
          and a.freigabe_status='freigegeben' and not a.keine_zahlung_faellig
          and a.prozess_status not in ('zahlung_angewiesen','geld_erhalten','abgeschlossen','zurueckgezogen','abgelehnt') end),
      count(*) filter(where a.freigabe_status='freigegeben'),
      count(*) filter(where a.prozess_status='abgelehnt'),
      md5(string_agg(a.id::text||':'||a.prozess_runde::text,',' order by a.id))
      into v_anzahl,v_offen,v_ja,v_nein,v_runden
      from public.ausruestungs_anfragen a where a.buendel_id=p.buendel_id;
    if v_anzahl=0 then
      delete from public.benachrichtigung_buendel_pruefungen q where q.buendel_id=p.buendel_id and q.phase=p.phase;
      continue;
    end if;
    if v_offen>0 then
      -- Nicht fertig bearbeitete Buendel hinter die anderen Kandidaten stellen.
      -- Sonst blockieren 50 alte offene Buendel alle spaeteren Abschluesse.
      -- Dieser Zeitstempel ist nur interne Queue-Prioritaet, kein Fachdatenverlauf.
      update public.benachrichtigung_buendel_pruefungen q set erstellt_am=clock_timestamp()
       where q.buendel_id=p.buendel_id and q.phase=p.phase;
      continue;
    end if;
    v_typ := case when p.phase='zahlung' then 'ausruestung.zahlung_angewiesen'
      when v_ja=0 then 'ausruestung.abgelehnt' else 'ausruestung.freigegeben' end;
    perform public.benachrichtigung_einreihen(v_verein,v_typ,'ausruestungsbuendel',p.buendel_id,
      'ausruestung:buendel:'||p.buendel_id::text||':'||p.phase||':'||v_runden,
      jsonb_build_object('anzeigename',v_name,'anzahl',v_anzahl,'buendel_phase',p.phase,
        'freigegeben',v_ja,'abgelehnt',v_nein));
    delete from public.benachrichtigung_buendel_pruefungen q where q.buendel_id=p.buendel_id and q.phase=p.phase;
    v_erstellt:=v_erstellt+1;
  end loop;
  return v_erstellt;
end $function$;
