-- Fuenf alte Views werden von Website, Dashboard-App und den aktuellen RPCs
-- nicht mehr verwendet. Sie umgehen als SECURITY-DEFINER-Views die RLS-Regeln
-- der zugrunde liegenden Tabellen und waren direkt fuer Browserrollen lesbar.
-- DROP ohne CASCADE stellt sicher, dass die Migration bei einer unerwarteten
-- Abhaengigkeit abbricht, statt weitere Objekte unbemerkt zu entfernen.

begin;

drop view if exists public.scoreboard;
drop view if exists public.schiedsrichter_oeffentlich;
drop view if exists public.trend_wochen;
drop view if exists public.fragen_oeffentlich;
drop view if exists public.fragen_erfolgsquote;

alter function public.ausruestungs_anfragen_touch()
  set search_path = pg_catalog, public;

commit;
