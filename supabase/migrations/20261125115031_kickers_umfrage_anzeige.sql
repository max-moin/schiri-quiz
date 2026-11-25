-- Nur die Verfügbarkeit für Ideen & Feedback. Das Teilnehmer-RPC,
-- die Rundendaten und die Aufbewahrung werden nicht verändert.
create function private.kickers_umfrage_ist_offen() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from private.kickers_umfrage u
    where u.einmalig and u.stand='offen'
      and (u.schliesst_am is null or u.schliesst_am>statement_timestamp())
  );
$$;
revoke all on function private.kickers_umfrage_ist_offen() from public, anon, authenticated, service_role;
grant execute on function private.kickers_umfrage_ist_offen() to service_role;

create function public.kickers_umfrage_ist_offen() returns boolean
language sql stable security invoker set search_path=''
return private.kickers_umfrage_ist_offen();
revoke all on function public.kickers_umfrage_ist_offen() from public, anon, authenticated, service_role;
grant execute on function public.kickers_umfrage_ist_offen() to service_role;
