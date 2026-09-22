-- Ein neu eingereichter Artikel darf nicht direkt dem Vorstand vorgelegt
-- werden: zuerst muss der Obmann ihn pruefen. Der gemeinsame Knopf ist
-- bewusst eine ausdrueckliche Pruef- UND Vorlagehandlung fuer alle Teile.
create or replace function public.obmann_ausruestungsbuendel_vorlegen(
  p_passwort text, p_buendel_id uuid, p_link_id uuid default null
)
returns integer
language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_anzahl integer := 0;
  v_anfrage record;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1
    from public.ausruestungs_buendel b
    join public.schiedsrichter s on s.id = b.schiedsrichter_id
   where b.id = p_buendel_id and s.verein_id = v_verein;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;

  for v_anfrage in
    select a.id, a.prozess_status
      from public.ausruestungs_anfragen a
     where a.buendel_id = p_buendel_id
       and a.freigabe_status = 'nicht_vorgelegt'
     order by a.buendel_position
  loop
    if v_anfrage.prozess_status = 'eingereicht' then
      perform public.ausruestung_uebergang(
        v_anfrage.id, 'geprueft', 'obmann', null, null, null);
    elsif v_anfrage.prozess_status <> 'geprueft' then
      raise exception 'Position ist im Zustand "%" nicht vorlegbar.',
        v_anfrage.prozess_status;
    end if;
    perform public.obmann_anfrage_vorlegen(p_passwort, v_anfrage.id, p_link_id);
    v_anzahl := v_anzahl + 1;
  end loop;

  if v_anzahl = 0 then raise exception 'Es gibt keine offene Position zum Vorlegen.'; end if;
  return v_anzahl;
end;
$function$;

revoke all on function public.obmann_ausruestungsbuendel_vorlegen(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_ausruestungsbuendel_vorlegen(text,uuid,uuid)
  to anon,authenticated;
