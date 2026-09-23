-- Die Beschaffungsansicht kann abgeschlossene Vorgänge nur einblenden,
-- wenn die zentrale Prozessliste sie auch liefert. Der Server liefert
-- weiterhin denselben Prozessvertrag für jeden Artikel.
create or replace function public.obmann_prozess_liste(p_passwort text)
returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_liste jsonb;
begin
  v_verein := public.obmann_verein(p_passwort);
  select coalesce(jsonb_agg(x.p order by x.dringend desc, x.erstellt_am desc), '[]'::jsonb)
    into v_liste
    from (
      select public.ausruestung_prozess_jsonb(a.id, 'obmann') as p,
             (a.prozess_status in ('eingereicht', 'beleg_hochgeladen',
                                   'freigegeben', 'zahlung_angewiesen')) as dringend,
             a.erstellt_am
        from public.ausruestungs_anfragen a
        join public.schiedsrichter s on s.id = a.schiedsrichter_id
       where s.verein_id = v_verein
         and a.typ = 'ausruestung'
    ) x;
  return v_liste;
end;
$function$;

revoke all on function public.obmann_prozess_liste(text)
  from public, anon, authenticated;
grant execute on function public.obmann_prozess_liste(text)
  to anon, authenticated;
