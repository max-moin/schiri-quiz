-- v144: Kompatibilitaet fuer bereits ausgerollte Website-Staende.
-- Die neue Website nutzt `termine_fuer_schiri_v2`; die derzeit oeffentlich
-- laufende Fassung ruft noch `termine_fuer_schiri` auf. Auch dieser Vertrag
-- muss den Rueckmeldeschalter liefern, damit interne Termine nicht pauschal
-- als Informationstermine erscheinen.

drop function if exists public.termine_fuer_schiri(uuid, text);
create function public.termine_fuer_schiri(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns table (
  id uuid, titel text, datum date, beschreibung text,
  beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, rueckmeldung_erforderlich boolean,
  vergangen boolean,
  mein_status text, mein_grund text, mein_kommentar text,
  zusagen integer, absagen integer
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  return query
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.rueckmeldung_erforderlich,
         t.datum < (now() at time zone 'Europe/Berlin')::date as vergangen,
         r.status, r.grund, r.kommentar,
         (select count(*)::integer from termin_rueckmeldungen x
           where x.termin_id = t.id and x.status = 'zu'),
         (select count(*)::integer from termin_rueckmeldungen x
           where x.termin_id = t.id and x.status = 'ab')
  from termine t
  left join termin_rueckmeldungen r
    on r.termin_id = t.id and r.schiedsrichter_id = p_schiedsrichter_id
  where t.verein_id = v_verein
    and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
end;
$function$;

revoke all on function public.termine_fuer_schiri(uuid, text) from public, anon, authenticated;
grant execute on function public.termine_fuer_schiri(uuid, text) to anon, authenticated;

comment on function public.termine_fuer_schiri(uuid, text) is
  'Legacy-Webvertrag mit explizitem Rueckmeldeschalter; neue Clients verwenden termine_fuer_schiri_v2.';
