-- Gemeinsame Obmann-Vorprüfung: jede Position bekommt genau eine Entscheidung.
-- Die Kaufentscheidung bleibt weiterhin ausschließlich beim Vorstand.

create or replace function public.benachrichtigung_vorstand_vorlage_trigger()
returns trigger
language plpgsql security definer set search_path to ''
as $function$
declare
  v_empfaenger text;
  v_verein uuid;
  v_person text;
  v_positionen jsonb;
  v_anzahl integer;
  v_gesamt_cent bigint;
  v_ereignis uuid;
  v_referenz uuid;
  v_link uuid;
  v_marker timestamptz;
begin
  -- Auch die letzte Obmann-Ablehnung kann ein gemischtes Bündel abschließen.
  if old.prozess_status is not distinct from new.prozess_status
     or not (new.prozess_status = 'vorgelegt'
             or (new.buendel_id is not null
                 and new.prozess_status = 'abgelehnt'
                 and old.prozess_status in ('eingereicht', 'geprueft'))) then
    return new;
  end if;

  -- Vorstandsentscheide selbst verschicken keine zweite Vorlage-Mail.
  select a.vorlage_link_id, max(a.vorlage_am)
    into v_link, v_marker
    from public.ausruestungs_anfragen a
   where (new.buendel_id is not null and a.buendel_id = new.buendel_id
          or new.buendel_id is null and a.id = new.id)
     and a.prozess_status = 'vorgelegt'
     and a.vorlage_link_id is not null
   group by a.vorlage_link_id
   order by max(a.vorlage_am) desc
   limit 1;
  if v_link is null then return new; end if;

  -- Nur auf noch unentschiedene Obmann-Positionen warten, nicht auf
  -- bereits begründet zurückgewiesene Artikel.
  if new.buendel_id is not null and exists (
    select 1 from public.ausruestungs_anfragen a
     where a.buendel_id = new.buendel_id
       and a.prozess_status in ('eingereicht', 'geprueft')
  ) then return new; end if;

  select k.empfaenger_schluessel into v_empfaenger
    from public.benachrichtigungs_einstellungen k
    join public.freigabe_links l on l.id = k.freigabe_link_id
   where l.id = v_link and l.widerrufen_am is null
     and (l.gueltig_bis is null or l.gueltig_bis > now())
     and k.email_aktiv and k.email_ziel is not null
     and 'ausruestung.vorgelegt' = any(k.aktivierte_typen);
  if v_empfaenger is null then return new; end if;

  select s.verein_id, s.name into v_verein, v_person
    from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  v_referenz := coalesce(new.buendel_id, new.id);

  select jsonb_agg(jsonb_build_object(
           'bezeichnung', coalesce(pr.bezeichnung, a.kategorie),
           'farbe', a.farbe, 'groesse', a.groesse,
           'aermellaenge', a.aermellaenge, 'anmerkung', a.anmerkung,
           'preis_cent', a.vorlage_preis_cent,
           'beschaffungsweg', a.beschaffungsweg
         ) order by a.buendel_position nulls last, a.erstellt_am),
         count(*)::integer, coalesce(sum(a.vorlage_preis_cent), 0)
    into v_positionen, v_anzahl, v_gesamt_cent
    from public.ausruestungs_anfragen a
    left join public.ausruestung_preise pr
      on pr.verein_id = v_verein and pr.kategorie = a.kategorie
   where (new.buendel_id is not null and a.buendel_id = new.buendel_id
          or new.buendel_id is null and a.id = new.id)
     and a.prozess_status = 'vorgelegt'
     and a.vorlage_link_id = v_link;
  if v_anzahl = 0 then return new; end if;

  v_ereignis := public.benachrichtigung_einreihen(
    v_verein, 'ausruestung.vorgelegt', 'ausruestungs_anfrage',
    v_referenz,
    'vorstand-vorlage/' || v_link::text || '/' ||
      v_referenz::text || '/' || v_marker::text,
    jsonb_build_object(
      'person', v_person, 'anzahl', v_anzahl,
      'gesamt_cent', v_gesamt_cent, 'positionen', v_positionen,
      'gesamt_anmerkung', (
        select b.gesamt_anmerkung from public.ausruestungs_buendel b
         where b.id = new.buendel_id
      )
    )
  );

  insert into public.benachrichtigungs_auftraege
    (ereignis_id, empfaenger_schluessel, kanal)
  values (v_ereignis, v_empfaenger, 'email')
  on conflict (ereignis_id, empfaenger_schluessel, kanal) do nothing;
  return new;
end;
$function$;

revoke all on function public.benachrichtigung_vorstand_vorlage_trigger()
  from public, anon, authenticated;

create function public.obmann_ausruestungsbuendel_vorpruefen(
  p_passwort text, p_buendel_id uuid, p_entscheidungen jsonb,
  p_link_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_offen integer;
  v_gesehen uuid[] := '{}'::uuid[];
  v_ja integer := 0;
  v_nein integer := 0;
  v_e record;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.ausruestungs_buendel b
    join public.schiedsrichter s on s.id = b.schiedsrichter_id
   where b.id = p_buendel_id and s.verein_id = v_verein;
  if not found then raise exception 'Gemeinsame Anfrage nicht gefunden.'; end if;
  if p_entscheidungen is null or jsonb_typeof(p_entscheidungen) <> 'array' then
    raise exception 'Bitte jede offene Position einzeln prüfen.';
  end if;

  -- Serverseitig sperren und die gesamte noch offene Vorprüfung verlangen.
  perform 1 from public.ausruestungs_anfragen a
   where a.buendel_id = p_buendel_id for update;
  select count(*) into v_offen from public.ausruestungs_anfragen a
   where a.buendel_id = p_buendel_id
     and a.prozess_status in ('eingereicht', 'geprueft');
  if v_offen = 0 or jsonb_array_length(p_entscheidungen) <> v_offen then
    raise exception 'Die Anfrage hat sich geändert. Bitte neu laden und alle offenen Positionen prüfen.';
  end if;

  for v_e in select * from jsonb_to_recordset(p_entscheidungen)
    as x(id uuid, entscheidung text, grund text)
  loop
    if v_e.id is null or v_e.id = any(v_gesehen)
       or v_e.entscheidung not in ('vorlegen', 'ablehnen')
       or v_e.entscheidung is null then
      raise exception 'Ungültige oder doppelte Position in der Vorprüfung.';
    end if;
    perform 1 from public.ausruestungs_anfragen a
     where a.id = v_e.id and a.buendel_id = p_buendel_id
       and a.prozess_status in ('eingereicht', 'geprueft');
    if not found then raise exception 'Eine Position ist nicht mehr offen.'; end if;
    if v_e.entscheidung = 'ablehnen'
       and char_length(btrim(coalesce(v_e.grund, ''))) < 5 then
      raise exception 'Für jede Ablehnung bitte eine kurze Begründung angeben.';
    end if;
    v_gesehen := array_append(v_gesehen, v_e.id);
  end loop;

  -- Erst alle Ablehnungen, dann die Vorlagen. Dadurch löst der letzte
  -- vorgelegte Artikel genau einen gemeinsamen Tom-Auftrag aus.
  for v_e in select * from jsonb_to_recordset(p_entscheidungen)
    as x(id uuid, entscheidung text, grund text)
   where x.entscheidung = 'ablehnen'
  loop
    perform public.obmann_anfrage_ablehnen(p_passwort, v_e.id, btrim(v_e.grund));
    v_nein := v_nein + 1;
  end loop;
  for v_e in select * from jsonb_to_recordset(p_entscheidungen)
    as x(id uuid, entscheidung text, grund text)
   where x.entscheidung = 'vorlegen'
  loop
    perform public.obmann_anfrage_direkt_vorlegen(p_passwort, v_e.id, p_link_id);
    v_ja := v_ja + 1;
  end loop;
  return jsonb_build_object('vorgelegt', v_ja, 'abgelehnt', v_nein);
end;
$function$;

revoke all on function public.obmann_ausruestungsbuendel_vorpruefen(
  text, uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.obmann_ausruestungsbuendel_vorpruefen(
  text, uuid, jsonb, uuid) to anon, authenticated;

-- Der bisherige "alles vorlegen"-Weg bleibt kompatibel, soll aber eine
-- bereits vom Obmann zurückgewiesene Position nicht erneut anfassen.
create or replace function public.obmann_ausruestungsbuendel_vorlegen(
  p_passwort text, p_buendel_id uuid, p_link_id uuid default null
)
returns integer
language plpgsql security definer set search_path to ''
as $function$
declare v_verein uuid; v_id uuid; v_anzahl integer := 0;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.ausruestungs_buendel b
    join public.schiedsrichter s on s.id = b.schiedsrichter_id
   where b.id = p_buendel_id and s.verein_id = v_verein;
  if not found then raise exception 'Gemeinsame Anfrage nicht gefunden.'; end if;

  for v_id in
    select a.id from public.ausruestungs_anfragen a
     where a.buendel_id = p_buendel_id
       and a.prozess_status in ('eingereicht', 'geprueft')
     order by a.buendel_position
  loop
    perform public.obmann_anfrage_direkt_vorlegen(p_passwort, v_id, p_link_id);
    v_anzahl := v_anzahl + 1;
  end loop;
  if v_anzahl = 0 then raise exception 'Keine offene Position zum Vorlegen.'; end if;
  return v_anzahl;
end;
$function$;

revoke all on function public.obmann_ausruestungsbuendel_vorlegen(
  text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.obmann_ausruestungsbuendel_vorlegen(
  text, uuid, uuid) to anon, authenticated;
