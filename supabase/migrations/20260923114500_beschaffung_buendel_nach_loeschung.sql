-- Eine gezielt geloeschte Position darf in einem mehrteiligen Buendel
-- keine veraltete Anzahl hinterlassen. Andere Positionen bleiben erhalten.
create or replace function public.obmann_ausruestungsanfrage_loeschen(
  p_passwort text,p_id uuid)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_buendel uuid; v_anzahl integer; v_rest integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  select a.buendel_id into v_buendel
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_id and s.verein_id=v_verein and a.typ='ausruestung'
   for update of a;
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;

  if v_buendel is not null then
    perform 1 from public.ausruestungs_buendel b
     where b.id=v_buendel for update;
  end if;
  select count(*) into v_anzahl from public.ausruestungs_anfragen
   where buendel_id=v_buendel;

  delete from public.benachrichtigungs_ereignisse
   where verein_id=v_verein and
     ((referenz_art='ausruestungsanfrage' and referenz_id=p_id)
       or (v_anzahl=1 and referenz_art='ausruestungs_anfrage'
           and referenz_id=v_buendel));
  delete from public.ausruestungs_anfragen where id=p_id;

  if v_buendel is not null then
    select count(*) into v_rest from public.ausruestungs_anfragen
     where buendel_id=v_buendel;
    if v_rest=0 then
      delete from public.ausruestungs_buendel where id=v_buendel;
    else
      update public.ausruestungs_buendel
         set positionen_anzahl=v_rest::smallint where id=v_buendel;
    end if;
  end if;
end;
$f$;
revoke all on function public.obmann_ausruestungsanfrage_loeschen(text,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_ausruestungsanfrage_loeschen(text,uuid)
  to anon,authenticated;
