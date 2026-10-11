-- App-only offers are not a website calendar. A person can still see their
-- Filename matches the live MCP migration version 20261011191044.
-- own recorded proof, but gets no link to an unpublished event. Obmann's
-- complete administrative catalogue stays unchanged.
create or replace function public.meine_fortbildungspunkte(p_schiedsrichter_id uuid,p_pin text,p_saison text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_stand jsonb; v_termine jsonb;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  v_stand:=public.fortbildung_person_stand(p_schiedsrichter_id,p_saison);
  select coalesce(jsonb_agg(e.value || jsonb_build_object('termin_sichtbar',t.sichtbarkeit<>'nur_app') order by e.ord),'[]'::jsonb)
    into v_termine from jsonb_array_elements(v_stand->'termine') with ordinality e(value,ord)
    join public.termine t on t.id=(e.value->>'id')::uuid
    where t.sichtbarkeit<>'nur_app' or (e.value->>'erfasst')::boolean;
  return jsonb_set(v_stand,'{termine}',v_termine);
end $$;
