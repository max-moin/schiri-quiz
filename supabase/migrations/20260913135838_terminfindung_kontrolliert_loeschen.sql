-- Eine abgebrochene Terminsuche darf der Obmann endgueltig entfernen.
-- Laufende Abstimmungen und entschiedene Suchen bleiben bewusst erhalten:
-- Bei ihnen haengen entweder noch Stimmen oder ein entstandener Termin am
-- Verlauf. Vorschlaege und Stimmen einer abgebrochenen Suche werden ueber
-- die bereits vorhandenen ON-DELETE-CASCADE-Fremdschluessel mit entfernt.

create or replace function public.obmann_terminfindung_loeschen(
  p_passwort text,
  p_findung_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  delete from public.terminfindungen
  where id = p_findung_id
    and verein_id = v_verein
    and status = 'abgebrochen'
    and erstellter_termin is null;

  if not found then
    raise exception 'Nur abgebrochene Terminsuchen ohne erzeugten Termin koennen geloescht werden';
  end if;
end;
$$;

revoke execute on function public.obmann_terminfindung_loeschen(text, uuid)
  from public, authenticated;
grant execute on function public.obmann_terminfindung_loeschen(text, uuid)
  to anon, service_role;
