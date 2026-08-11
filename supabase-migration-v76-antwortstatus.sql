-- Migration v76 (11.08.2026)
-- Hält "korrekt" und "bewertungsstatus" bei ALLEN Schreibwegen konsistent.
--
-- Hintergrund: Die ältere Multiple-Choice-RPC "antwort_abgeben" setzt nur
-- "korrekt". Seit der Orange-/Nachbesserungs-Migration hat die Tabelle aber
-- zusätzlich den verpflichtenden "bewertungsstatus". Bei einer richtigen
-- Antwort blieb dessen Standardwert "falsch" stehen und der Constraint
-- "antworten_status_passt_zu_korrekt" hat den Datensatz deshalb abgelehnt.
--
-- Die zentrale Trigger-Lösung ist absichtlich schmal:
-- - korrekt = true  -> Status immer "richtig"
-- - korrekt = false -> nur fehlenden/widersprüchlichen Status auf "falsch"
-- - "nachbessern" bei korrekt = false bleibt ausdrücklich erhalten

create or replace function public.antworten_bewertungsstatus_synchronisieren()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.korrekt is true then
    new.bewertungsstatus := 'richtig';
  elsif new.korrekt is false
    and (new.bewertungsstatus is null or new.bewertungsstatus = 'richtig') then
    new.bewertungsstatus := 'falsch';
  end if;

  return new;
end;
$$;

drop trigger if exists antworten_bewertungsstatus_synchronisieren_vor_schreiben
  on public.antworten;

create trigger antworten_bewertungsstatus_synchronisieren_vor_schreiben
before insert or update of korrekt, bewertungsstatus
on public.antworten
for each row
execute function public.antworten_bewertungsstatus_synchronisieren();

