-- Eine von Tom bestaetigte Zahlung ist fuer Max ein neuer Eingang.
-- Die von Max selbst stellvertretend gesetzte Bestaetigung nicht.
create or replace function public.ausruestung_zahlung_eingang_markieren()
returns trigger language plpgsql set search_path to '' as $funktion$
begin
  if new.schritt = 'zahlung_angewiesen'
     and new.akteur_rolle = 'vorstand' then
    new.eingang := true;
  end if;
  return new;
end;
$funktion$;

drop trigger if exists ausruestung_zahlung_eingang_markieren
  on public.ausruestung_ereignisse;
create trigger ausruestung_zahlung_eingang_markieren
  before insert on public.ausruestung_ereignisse
  for each row execute function public.ausruestung_zahlung_eingang_markieren();

revoke all on function public.ausruestung_zahlung_eingang_markieren()
  from public,anon,authenticated;
