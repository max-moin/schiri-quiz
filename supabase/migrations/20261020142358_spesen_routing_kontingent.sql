-- Created with Supabase CLI; filename aligned with the actual remote migration version.
-- No addresses, coordinates or routes are stored. Rolling counters only.
create table if not exists private.spesen_routing_kontingent (
  schluessel text primary key,
  tag date not null,
  tag_einheiten integer not null default 0,
  stunde timestamptz not null,
  stunden_einheiten integer not null default 0
);
alter table private.spesen_routing_kontingent enable row level security;
revoke all on private.spesen_routing_kontingent from public, anon, authenticated;

create or replace function public.spesen_routing_erlauben(p_schiedsrichter_id uuid, p_pin text, p_einheiten integer default 1)
returns boolean language plpgsql security definer set search_path = '' as $$
declare k text; r private.spesen_routing_kontingent; zeit timestamptz := now();
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_einheiten not in (1,2) or p_einheiten is null then raise exception 'Ungültige Einheit'; end if;
  -- The single global lock makes the per-person and global reservation atomic.
  perform pg_advisory_xact_lock(62492103);
  delete from private.spesen_routing_kontingent where tag < (zeit at time zone 'UTC')::date - 2;
  foreach k in array array['global', p_schiedsrichter_id::text] loop
    insert into private.spesen_routing_kontingent(schluessel,tag,stunde)
      values(k,(zeit at time zone 'UTC')::date,date_trunc('hour',zeit)) on conflict do nothing;
    update private.spesen_routing_kontingent set
      tag_einheiten=case when tag=(zeit at time zone 'UTC')::date then tag_einheiten else 0 end,
      stunden_einheiten=case when stunde=date_trunc('hour',zeit) then stunden_einheiten else 0 end,
      tag=(zeit at time zone 'UTC')::date, stunde=date_trunc('hour',zeit) where schluessel=k returning * into r;
    if r.tag_einheiten+p_einheiten > (case when k='global' then 600 else 60 end)
      or r.stunden_einheiten+p_einheiten > (case when k='global' then 120 else 20 end) then return false; end if;
  end loop;
  update private.spesen_routing_kontingent set tag_einheiten=tag_einheiten+p_einheiten,
    stunden_einheiten=stunden_einheiten+p_einheiten where schluessel in ('global',p_schiedsrichter_id::text);
  return true;
end $$;
revoke all on function public.spesen_routing_erlauben(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.spesen_routing_erlauben(uuid,text,integer) to service_role;
