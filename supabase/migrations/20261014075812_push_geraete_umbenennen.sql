-- Anzeigenamen wiederverwenden, keine neue Geräte-/Push-Tabelle.
-- Lokale CLI-Datei an die tatsächlich angewendete MCP-Migrationsversion angeglichen.
create function public.push_geraetename_pruefen(p_name text)
returns text language plpgsql immutable security invoker set search_path='' as $function$
declare v_name text := btrim(p_name);
begin
  if v_name is null or char_length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Bitte einen Gerätenamen mit 1 bis 60 Zeichen ohne Steuerzeichen eingeben.';
  end if;
  return v_name;
end $function$;
revoke all on function public.push_geraetename_pruefen(text) from public,anon,authenticated;

create function public.schiri_push_geraet_umbenennen(p_schiedsrichter_id uuid,p_pin text,p_abo_id uuid,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_verein uuid; v_name text; v_id uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  v_name := public.push_geraetename_pruefen(p_name);
  update public.push_abos a set geraet=v_name
    where a.id=p_abo_id and a.schiedsrichter_id=p_schiedsrichter_id and a.verein_id=v_verein
    returning a.id into v_id;
  if v_id is null then raise exception 'Gerät ist nicht verfügbar.'; end if;
  return jsonb_build_object('id',v_id,'geraet',v_name);
end $function$;
revoke all on function public.schiri_push_geraet_umbenennen(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.schiri_push_geraet_umbenennen(uuid,text,uuid,text) to anon,authenticated,service_role;

-- Nur Serverzugriff: Obmann-Passwort und eigener Verein bleiben Pflicht.
create function public.obmann_push_geraet_umbenennen(p_passwort text,p_abo_id uuid,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_verein uuid; v_name text; v_id uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  v_name := public.push_geraetename_pruefen(p_name);
  update public.push_abos a set geraet=v_name from public.schiedsrichter s
    where a.id=p_abo_id and a.verein_id=v_verein and s.id=a.schiedsrichter_id
      and s.verein_id=v_verein and s.aktiv and not coalesce(s.ist_test,false)
    returning a.id into v_id;
  if v_id is null then raise exception 'Gerät ist nicht verfügbar.'; end if;
  return jsonb_build_object('id',v_id,'geraet',v_name);
end $function$;
revoke all on function public.obmann_push_geraet_umbenennen(text,uuid,text) from public,anon,authenticated;
grant execute on function public.obmann_push_geraet_umbenennen(text,uuid,text) to service_role;

-- Gleiches Abo beim selben Konto: Namen nicht durch automatische Erkennung
-- überschreiben. Bei Kontowechsel keinen Namen des vorherigen Kontos übernehmen.
create or replace function public.push_abo_speichern(
  p_schiedsrichter_id uuid,p_pin text,p_endpunkt text,p_p256dh text,p_auth text,p_geraet text default null
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_verein uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if coalesce(length(p_endpunkt),0)<20 or length(p_endpunkt)>2048
    or p_endpunkt !~ '^https://[^/[:space:]]+/' then raise exception 'Ungueltiger Push-Endpunkt'; end if;
  if coalesce(length(p_p256dh),0) not between 20 and 200
    or coalesce(length(p_auth),0) not between 10 and 100 then raise exception 'Unvollstaendige Push-Schluessel'; end if;
  insert into public.push_abos(schiedsrichter_id,verein_id,endpunkt,p256dh,auth,geraet,gueltig_bis)
    values(p_schiedsrichter_id,v_verein,p_endpunkt,p_p256dh,p_auth,
      nullif(left(coalesce(p_geraet,''),60),''),now()+interval '30 days')
  on conflict(endpunkt) do update set
    geraet=case when push_abos.schiedsrichter_id=excluded.schiedsrichter_id
      and push_abos.verein_id=excluded.verein_id then coalesce(push_abos.geraet,excluded.geraet) else excluded.geraet end,
    schiedsrichter_id=excluded.schiedsrichter_id,verein_id=excluded.verein_id,
    p256dh=excluded.p256dh,auth=excluded.auth,zuletzt_bestaetigt=now(),gueltig_bis=excluded.gueltig_bis;
  return jsonb_build_object('gespeichert',true);
end $function$;
notify pgrst,'reload schema';
