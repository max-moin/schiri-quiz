-- Eine Auswahl aus demselben Anfragebuendel wird in einer Transaktion
-- verarbeitet. Die bestehenden Einzel-RPCs bleiben die fachliche Quelle
-- fuer Rechte, Statuswechsel, Ereignisse und Benachrichtigungen.
create function public.freigabe_buendel_entscheiden(
  p_token text, p_buendel_id uuid, p_ids uuid[], p_entscheidung text,
  p_name text, p_notiz text default null)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_link uuid;
  v_art text;
  v_id uuid;
  v_anzahl integer := 0;
begin
  if p_buendel_id is null or coalesce(array_length(p_ids, 1), 0) not between 1 and 12
     or p_entscheidung is null
     or p_entscheidung not in ('freigegeben', 'abgelehnt') then
    raise exception 'Bitte eine gueltige Auswahl treffen.';
  end if;
  if (select count(distinct id) from unnest(p_ids) as id) <> array_length(p_ids, 1)
     or array_position(p_ids, null) is not null then
    raise exception 'Eine Position darf nur einmal ausgewaehlt werden.';
  end if;
  if p_entscheidung = 'abgelehnt' and char_length(btrim(coalesce(p_notiz, ''))) < 3 then
    raise exception 'Bitte die Ablehnung kurz begruenden.';
  end if;

  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);
  perform public.freigabe_akteur(p_token, p_name);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;

  -- Gleiche Sperrreihenfolge auch bei parallelen Teilmengen.
  for v_id in
    select a.id
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
     where a.id = any(p_ids) and a.buendel_id = p_buendel_id
       and a.typ = 'ausruestung' and s.verein_id = v_verein
       and a.vorlage_am is not null and a.prozess_status = 'vorgelegt'
       and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link)
     order by a.id for update of a
  loop
    v_anzahl := v_anzahl + 1;
  end loop;
  if v_anzahl <> array_length(p_ids, 1) then
    raise exception 'Mindestens eine Position steht nicht mehr zur Entscheidung. Bitte neu laden.';
  end if;

  foreach v_id in array p_ids loop
    perform public.freigabe_entscheiden(
      p_token, v_id, p_entscheidung, p_name, p_notiz);
  end loop;
  return v_anzahl;
end;
$function$;

create function public.freigabe_buendel_zahlung_bestaetigen(
  p_token text, p_buendel_id uuid, p_ids uuid[], p_name text)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_link uuid;
  v_art text;
  v_id uuid;
  v_anzahl integer := 0;
begin
  if p_buendel_id is null or coalesce(array_length(p_ids, 1), 0) not between 1 and 12 then
    raise exception 'Bitte mindestens einen offenen Zahlungsauftrag auswaehlen.';
  end if;
  if (select count(distinct id) from unnest(p_ids) as id) <> array_length(p_ids, 1)
     or array_position(p_ids, null) is not null then
    raise exception 'Ein Zahlungsauftrag darf nur einmal ausgewaehlt werden.';
  end if;

  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);
  perform public.freigabe_akteur(p_token, p_name);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;

  for v_id in
    select a.id
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
     where a.id = any(p_ids) and a.buendel_id = p_buendel_id
       and a.typ = 'ausruestung' and s.verein_id = v_verein
       and a.vorlage_am is not null and a.prozess_status = 'zahlung_beauftragt'
       and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link)
     order by a.id for update of a
  loop
    v_anzahl := v_anzahl + 1;
  end loop;
  if v_anzahl <> array_length(p_ids, 1) then
    raise exception 'Mindestens ein Zahlungsauftrag ist nicht mehr offen. Bitte neu laden.';
  end if;

  foreach v_id in array p_ids loop
    perform public.freigabe_zahlung_angewiesen(p_token, v_id, p_name);
  end loop;
  return v_anzahl;
end;
$function$;

revoke all on function public.freigabe_buendel_entscheiden(text,uuid,uuid[],text,text,text)
  from public,anon,authenticated;
revoke all on function public.freigabe_buendel_zahlung_bestaetigen(text,uuid,uuid[],text)
  from public,anon,authenticated;
grant execute on function public.freigabe_buendel_entscheiden(text,uuid,uuid[],text,text,text)
  to anon;
grant execute on function public.freigabe_buendel_zahlung_bestaetigen(text,uuid,uuid[],text)
  to anon;
