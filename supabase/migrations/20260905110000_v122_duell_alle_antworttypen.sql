-- Duell v122: alle im Wochenquiz vorhandenen Antworttypen sicher nutzen.
-- Zahlen- und Icon-Antworten werden serverseitig bewertet; Loesungen
-- gelangen erst nach der eigenen Antwort in die Auswertung.

alter table public.duell_antworten
  add column if not exists gegebene_details jsonb;

alter table public.duell_antworten
  drop constraint if exists duell_antworten_check,
  add constraint duell_antworten_eine_antwort_check check (
    (gegebene_auswahl is not null)::integer
    + (gegebener_freitext is not null)::integer
    + (gegebene_details is not null)::integer = 1
  ),
  add constraint duell_antworten_details_objekt_check check (
    gegebene_details is null or jsonb_typeof(gegebene_details) = 'object'
  );

create or replace function public.duell_erstellen(p_schiedsrichter_id uuid,p_pin text)
returns table(code text,zugang uuid)
language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_name text; v_session uuid; v_code text; v_zugang uuid; v_anzahl int;
begin
  perform public.duell_aufraeumen();
  select s.verein_id,s.name into v_verein,v_name from public.schiedsrichter s
   where s.id=p_schiedsrichter_id and s.pin=p_pin and coalesce(s.aktiv,false);
  if v_verein is null then raise exception 'Anmeldung ungueltig'; end if;
  if (select count(*) from public.duell_sessions d where d.erstellt_von=p_schiedsrichter_id and d.status='offen')>=3 then
    raise exception 'Du kannst hoechstens drei offene Duelle haben.';
  end if;

  select count(distinct f.id) into v_anzahl
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id=f.id
  join public.runden r on r.id=rf.runde_id
  where r.startet_am<=now() and f.aktiv and (
    f.antworttyp='freitext'
    or (f.antworttyp in ('multiple_choice','mehrfachauswahl') and
        (exists(select 1 from public.frage_antwortoptionen o where o.frage_id=f.id)
         or f.richtige_option is not null))
    or (f.antworttyp='zahl' and exists(select 1 from public.frage_zahl_loesungen z where z.frage_id=f.id))
    or (f.antworttyp='entscheidung' and exists(select 1 from public.frage_entscheidungsloesungen l where l.frage_id=f.id))
  );
  if v_anzahl<5 then raise exception 'Noch nicht genuegend gespielte Fragen vorhanden.'; end if;

  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.duell_sessions d where d.code=v_code);
  end loop;
  insert into public.duell_sessions(code,verein_id,erstellt_von)
    values(v_code,v_verein,p_schiedsrichter_id) returning id into v_session;
  insert into public.duell_fragen(session_id,frage_id,position)
    select v_session,q.id,row_number() over(order by md5(q.id::text||v_session::text))::smallint
    from (
      select distinct f.id from public.fragen f
      join public.runden_fragen rf on rf.frage_id=f.id
      join public.runden r on r.id=rf.runde_id
      where r.startet_am<=now() and f.aktiv and (
        f.antworttyp='freitext'
        or (f.antworttyp in ('multiple_choice','mehrfachauswahl') and
            (exists(select 1 from public.frage_antwortoptionen o where o.frage_id=f.id)
             or f.richtige_option is not null))
        or (f.antworttyp='zahl' and exists(select 1 from public.frage_zahl_loesungen z where z.frage_id=f.id))
        or (f.antworttyp='entscheidung' and exists(select 1 from public.frage_entscheidungsloesungen l where l.frage_id=f.id))
      )
    ) q
    order by md5(q.id::text||v_session::text) limit 5;
  insert into public.duell_teilnehmer(session_id,schiedsrichter_id,anzeigename)
    values(v_session,p_schiedsrichter_id,v_name) returning duell_teilnehmer.zugang into v_zugang;
  return query select v_code,v_zugang;
end; $$;

create or replace function public.duell_frage(p_zugang uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_f public.fragen%rowtype; v_pos int; v_opts jsonb; v_zahl jsonb; v_icon jsonb; v_regel text;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  select f.* into v_f from public.duell_fragen df
    join public.fragen f on f.id=df.frage_id
    join public.duell_sessions d on d.id=df.session_id and d.status='offen'
    where df.session_id=v_t.session_id
      and not exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_t.id and a.frage_id=df.frage_id)
    order by df.position limit 1;
  if not found then return jsonb_build_object('fertig',true); end if;
  select position into v_pos from public.duell_fragen where session_id=v_t.session_id and frage_id=v_f.id;
  select r.bezeichnung into v_regel from public.regeln r where r.nummer=v_f.regel_nummer;
  select coalesce(jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
    jsonb_strip_nulls(jsonb_build_array(
      jsonb_build_object('schluessel','a','text',v_f.option_a),
      jsonb_build_object('schluessel','b','text',v_f.option_b),
      jsonb_build_object('schluessel','c','text',v_f.option_c))))
    into v_opts from public.frage_antwortoptionen o where o.frage_id=v_f.id;
  select jsonb_agg(jsonb_build_object('einheit',q.einheit) order by q.erste_position)
    into v_zahl from (
      select z.einheit,min(z.position) erste_position from public.frage_zahl_loesungen z
      where z.frage_id=v_f.id group by z.einheit
    ) q;
  select jsonb_build_object(
      'fordert_fortsetzung',l.fordert_fortsetzung,
      'fordert_fortsetzung_fuer',l.fordert_fortsetzung_fuer,
      'fordert_fortsetzung_ort',l.fordert_fortsetzung_ort,
      'fordert_strafe',l.fordert_strafe,
      'fordert_strafe_mannschaft',l.fordert_strafe_mannschaft,
      'fordert_strafe_rolle',l.fordert_strafe_rolle,
      'fordert_strafe_nummer',l.fordert_strafe_nummer,
      'zeigt_trikotfarben',l.zeigt_trikotfarben,
      'trikot_heim',l.trikot_heim,'trikot_gast',l.trikot_gast)
    into v_icon from public.frage_entscheidungsloesungen l where l.frage_id=v_f.id;
  return jsonb_strip_nulls(jsonb_build_object(
    'fertig',false,'id',v_f.id,'position',v_pos,'gesamt',5,
    'frage_text',v_f.frage_text,'medium',v_f.medium,'antworttyp',v_f.antworttyp,
    'antwortoptionen',v_opts,'zahl_einheiten',v_zahl,
    'antwort_hinweis',v_f.antwort_hinweis,'regel_nummer',v_f.regel_nummer,
    'regel_bezeichnung',v_regel,'schwierigkeit',v_f.schwierigkeit,
    'video_url',v_f.video_url,'video_start_sekunden',v_f.video_start_sekunden,
    'video_end_sekunden',v_f.video_end_sekunden,'video_stumm',v_f.video_stumm,
    'bild_base64',v_f.bild_base64,'bild_mime',v_f.bild_mime,'bild_alt',v_f.bild_alt
  ) || coalesce(v_icon,'{}'::jsonb));
end; $$;

create or replace function public.duell_antwort_zahl(p_zugang uuid,p_frage_id uuid,p_wert numeric,p_einheit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_ok boolean; v_loesungen jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  if p_wert is null or nullif(btrim(p_einheit),'') is null then raise exception 'Zahl und Einheit fehlen'; end if;
  if not exists(
    select 1 from public.duell_fragen df join public.fragen f on f.id=df.frage_id
    join public.duell_sessions d on d.id=df.session_id
    where df.session_id=v_t.session_id and df.frage_id=p_frage_id
      and d.status='offen' and f.antworttyp='zahl'
  ) then raise exception 'Frage nicht verfuegbar'; end if;
  select coalesce(bool_or(z.einheit=btrim(p_einheit) and abs(z.wert-p_wert)<=z.toleranz),false),
         jsonb_agg(jsonb_build_object('wert',z.wert,'einheit',z.einheit) order by z.position)
    into v_ok,v_loesungen from public.frage_zahl_loesungen z where z.frage_id=p_frage_id;
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_details,korrekt,bewertungsstatus)
    values(v_t.id,p_frage_id,jsonb_build_object('art','zahl','wert',p_wert,'einheit',btrim(p_einheit),'loesungen',v_loesungen),
      v_ok,case when v_ok then 'richtig' else 'falsch' end)
    on conflict(teilnehmer_id,frage_id) do nothing;
  if not found then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  return jsonb_build_object('korrekt',v_ok,'richtige_antworten',v_loesungen);
end; $$;

create or replace function public.duell_entscheidung_kontext(p_zugang uuid,p_frage_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; v_daten jsonb;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t
    join public.duell_fragen df on df.session_id=t.session_id
    join public.duell_sessions d on d.id=t.session_id
    where t.zugang=p_zugang and df.frage_id=p_frage_id and d.status='offen';
  if v_tid is null or exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id)
    then raise exception 'Frage nicht verfuegbar'; end if;
  select to_jsonb(l) || jsonb_build_object(
      'frage_text',f.frage_text,'strafen',public.entscheidung_strafen_liste(f.id))
    into v_daten from public.fragen f
    join public.frage_entscheidungsloesungen l on l.frage_id=f.id
    where f.id=p_frage_id and f.aktiv and f.antworttyp='entscheidung';
  if v_daten is null then raise exception 'Frage nicht verfuegbar'; end if;
  return v_daten;
end; $$;

create or replace function public.duell_entscheidung_speichern(
  p_zugang uuid,p_frage_id uuid,p_antwort jsonb,p_ort_richtig boolean,p_ort_feedback text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_tid uuid; v_l public.frage_entscheidungsloesungen%rowtype;
  v_strafen_l jsonb; v_strafen_g jsonb; v_loesung jsonb; v_noten jsonb; v_ergebnis jsonb;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean; v_ziel boolean; v_rolle boolean; v_nummer boolean; v_ok boolean;
begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  if jsonb_typeof(p_antwort)<>'object' then raise exception 'Antwort ungueltig'; end if;
  select t.id into v_tid from public.duell_teilnehmer t
    join public.duell_fragen df on df.session_id=t.session_id and df.frage_id=p_frage_id
    join public.duell_sessions d on d.id=t.session_id and d.status='offen'
    where t.zugang=p_zugang;
  if v_tid is null then raise exception 'Frage nicht verfuegbar'; end if;
  if exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id)
    then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  select l.* into v_l from public.frage_entscheidungsloesungen l
    join public.fragen f on f.id=l.frage_id
    where l.frage_id=p_frage_id and f.aktiv and f.antworttyp='entscheidung';
  if not found then raise exception 'Frage nicht verfuegbar'; end if;

  if p_antwort ? 'strafen' and jsonb_typeof(p_antwort->'strafen')='array' then
    v_strafen_g:=p_antwort->'strafen';
  elsif coalesce(nullif(p_antwort->>'persoenliche_strafe',''),'keine')<>'keine' then
    v_strafen_g:=jsonb_build_array(jsonb_build_object(
      'strafe',p_antwort->>'persoenliche_strafe','fuer_mannschaft',nullif(p_antwort->>'strafe_fuer_mannschaft',''),
      'strafe_fuer_rolle',nullif(p_antwort->>'strafe_fuer_rolle',''),'rueckennummer',nullif(p_antwort->>'strafe_rueckennummer','')));
  else v_strafen_g:='[]'::jsonb; end if;
  v_strafen_l:=public.entscheidung_strafen_liste(p_frage_id);
  v_loesung:=jsonb_build_object(
    'spielfortsetzung',v_l.spielfortsetzung,'fortsetzung_fuer',v_l.fortsetzung_fuer,
    'fortsetzung_ort',v_l.fortsetzung_ort,'persoenliche_strafe',v_l.persoenliche_strafe,
    'strafe_fuer_mannschaft',v_l.strafe_fuer_mannschaft,'strafe_fuer_rolle',v_l.strafe_fuer_rolle,
    'strafe_rollen_gueltig',to_jsonb(v_l.strafe_rollen_gueltig),'strafe_rueckennummer',v_l.strafe_rueckennummer,
    'strafen',v_strafen_l,'trikot_heim',v_l.trikot_heim,'trikot_gast',v_l.trikot_gast,
    'fordert_fortsetzung',v_l.fordert_fortsetzung,'fordert_fortsetzung_fuer',v_l.fordert_fortsetzung_fuer,
    'fordert_fortsetzung_ort',v_l.fordert_fortsetzung_ort,'fordert_strafe',v_l.fordert_strafe,
    'fordert_strafe_mannschaft',v_l.fordert_strafe_mannschaft,'fordert_strafe_rolle',v_l.fordert_strafe_rolle,
    'fordert_strafe_nummer',v_l.fordert_strafe_nummer,'zeigt_trikotfarben',v_l.zeigt_trikotfarben);
  v_fort:=case when v_l.fordert_fortsetzung then p_antwort->>'spielfortsetzung'=v_l.spielfortsetzung end;
  v_richtung:=case when v_l.fordert_fortsetzung_fuer then coalesce(nullif(p_antwort->>'fortsetzung_fuer',''),'')=coalesce(v_l.fortsetzung_fuer,'') end;
  v_ort:=case when v_l.fordert_fortsetzung_ort then coalesce(p_ort_richtig,false) end;
  if v_l.fordert_strafe then
    v_noten:=public.entscheidung_strafen_vergleich(v_strafen_g,v_strafen_l,v_l.fordert_strafe_mannschaft,v_l.fordert_strafe_rolle,v_l.fordert_strafe_nummer);
    v_strafe:=(v_noten->>'strafe_richtig')::boolean; v_ziel:=(v_noten->>'strafziel_richtig')::boolean;
    v_rolle:=(v_noten->>'rolle_richtig')::boolean; v_nummer:=(v_noten->>'rueckennummer_richtig')::boolean;
  end if;
  v_ok:=coalesce(v_fort,true) and coalesce(v_richtung,true) and coalesce(v_ort,true)
    and coalesce(v_strafe,true) and coalesce(v_ziel,true) and coalesce(v_rolle,true) and coalesce(v_nummer,true);
  v_ergebnis:=public.entscheidung_ergebnis_bauen(p_antwort,v_loesung,false,v_fort,v_richtung,v_ort,v_strafe,v_ziel,v_rolle,v_nummer,nullif(btrim(p_ort_feedback),''));
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_details,korrekt,bewertungsstatus,feedback)
    values(v_tid,p_frage_id,jsonb_build_object('art','entscheidung','antwort',p_antwort,'loesung',v_loesung,'ergebnis',v_ergebnis->'ergebnis'),
      v_ok,case when v_ok then 'richtig' else 'falsch' end,nullif(btrim(p_ort_feedback),''));
  return v_ergebnis;
end; $$;

create or replace function public.duell_verlauf(p_zugang uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_s public.duell_sessions%rowtype; v_fragen jsonb:='[]'::jsonb; v_f record; v_ich_ok boolean; v_opts jsonb; v_teilnehmer jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  select * into v_s from public.duell_sessions where id=v_t.session_id;
  for v_f in
    select df.position,f.id frage_id,f.frage_text,f.medium,f.antworttyp,f.option_a,f.option_b,f.option_c
    from public.duell_fragen df join public.fragen f on f.id=df.frage_id
    where df.session_id=v_t.session_id order by df.position
  loop
    select exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_t.id and a.frage_id=v_f.frage_id) into v_ich_ok;
    select coalesce(jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
      jsonb_strip_nulls(jsonb_build_array(jsonb_build_object('schluessel','a','text',v_f.option_a),jsonb_build_object('schluessel','b','text',v_f.option_b),jsonb_build_object('schluessel','c','text',v_f.option_c))))
      into v_opts from public.frage_antwortoptionen o where o.frage_id=v_f.frage_id;
    select jsonb_agg(jsonb_build_object(
      'name',t.anzeigename,'ist_ich',(t.id=v_t.id),'beantwortet',(a.teilnehmer_id is not null),
      'status',case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.bewertungsstatus end,
      'auswahl',case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.gegebene_auswahl end,
      'freitext',case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.gegebener_freitext end,
      'zweiter_freitext',case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.zweiter_freitext end,
      'details',case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.gegebene_details end
    ) order by t.beigetreten_am) into v_teilnehmer
    from public.duell_teilnehmer t left join public.duell_antworten a on a.teilnehmer_id=t.id and a.frage_id=v_f.frage_id
    where t.session_id=v_t.session_id;
    v_fragen:=v_fragen||jsonb_build_array(jsonb_build_object(
      'position',v_f.position,'frage_id',v_f.frage_id,'frage_text',v_f.frage_text,
      'medium',v_f.medium,'antworttyp',v_f.antworttyp,'antwortoptionen',v_opts,'teilnehmer',v_teilnehmer));
  end loop;
  return jsonb_build_object('code',v_s.code,'status',v_s.status,'ich',v_t.anzeigename,'fragen',v_fragen);
end; $$;

revoke all on function public.duell_erstellen(uuid,text),public.duell_frage(uuid),
  public.duell_antwort_zahl(uuid,uuid,numeric,text),public.duell_verlauf(uuid)
  from public,anon,authenticated;
revoke all on function public.duell_entscheidung_kontext(uuid,uuid),
  public.duell_entscheidung_speichern(uuid,uuid,jsonb,boolean,text)
  from public,anon,authenticated;
grant execute on function public.duell_erstellen(uuid,text),public.duell_frage(uuid),
  public.duell_antwort_zahl(uuid,uuid,numeric,text),public.duell_verlauf(uuid) to anon;
grant execute on function public.duell_entscheidung_kontext(uuid,uuid),
  public.duell_entscheidung_speichern(uuid,uuid,jsonb,boolean,text) to service_role;
