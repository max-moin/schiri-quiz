-- Eigene Schiri-Aktion darf nicht einen älteren Obmann-Stand wieder hervorholen.
create or replace function public.schiri_push_ausruestung_kandidaten()
returns table(quelle_id uuid,anfrage_id uuid,person_id uuid,verein_id uuid,ziel_id uuid)
language sql stable security invoker set search_path='' as $function$
  with neueste as (
    select distinct on (coalesce(a.buendel_id,a.id)) e.id quelle_id,e.anfrage_id,s.id person_id,s.verein_id,
      coalesce(a.buendel_id,a.id) ziel_id,a.buendel_id,e.schritt,e.erstellt_am,e.akteur_rolle
    from public.ausruestung_ereignisse e
    join public.ausruestungs_anfragen a on a.id=e.anfrage_id
    join public.schiedsrichter s on s.id=a.schiedsrichter_id and s.verein_id=e.verein_id
    join public.schiri_push_praeferenzen p on p.schiedsrichter_id=s.id
    where s.aktiv and not coalesce(s.ist_test,false) and coalesce(a.typ,'ausruestung')<>'anliegen'
      and e.runde=a.prozess_runde and e.schritt=a.prozess_status
      and p.ausruestung_status and e.erstellt_am>=p.ausruestung_aktiviert_am
      and e.erstellt_am>=now()-interval '24 hours'
      and exists(select 1 from public.push_abos b where b.schiedsrichter_id=s.id
        and b.verein_id=s.verein_id and b.gueltig_bis>now())
      and not exists(select 1 from public.ausruestungs_anfragen x join public.schiedsrichter sx on sx.id=x.schiedsrichter_id
        where a.buendel_id is not null and x.buendel_id=a.buendel_id
          and (x.schiedsrichter_id<>s.id or sx.verein_id<>s.verein_id or x.typ='anliegen'))
    order by coalesce(a.buendel_id,a.id),e.erstellt_am desc,e.id desc
  )
  select n.quelle_id,n.anfrage_id,n.person_id,n.verein_id,n.ziel_id from neueste n
  where n.erstellt_am<=now()-interval '30 seconds' and n.akteur_rolle in ('obmann','vorstand')
    and not (n.buendel_id is not null and n.schritt in ('freigegeben','abgelehnt') and exists(
      select 1 from public.ausruestungs_anfragen x where x.buendel_id=n.buendel_id
        and x.prozess_status in ('eingereicht','geprueft','vorgelegt')))
    and not (n.buendel_id is not null and n.schritt='zahlung_angewiesen' and exists(
      select 1 from public.ausruestungs_anfragen x where x.buendel_id=n.buendel_id
        and coalesce(x.beschaffungsweg,'weg2_schiri_besorgt')='weg2_schiri_besorgt'
        and x.freigabe_status='freigegeben' and not x.keine_zahlung_faellig
        and x.prozess_status not in ('zahlung_angewiesen','geld_erhalten','abgeschlossen','zurueckgezogen','abgelehnt')));
$function$;
