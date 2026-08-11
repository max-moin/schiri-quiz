-- Der Abgleich mit allen RPC-Aufrufen in Website und Dashboard-App hat zwei
-- veraltete Funktionen ohne Aufrufer und drei rein interne Helfer ergeben.
-- Die Helfer laufen innerhalb von SECURITY-DEFINER-Funktionen unter deren
-- Besitzerrechten weiter, muessen aber nicht direkt aus dem Browser aufrufbar
-- sein. DROP ohne CASCADE bricht bei einer unerwarteten Abhaengigkeit sicher ab.

begin;

drop function if exists public.pin_pruefen(uuid, text);
drop function if exists public.vereinskennung_pruefen(text);

revoke execute on function public.historie_fortschritt_auffuellen(uuid)
  from public, anon, authenticated;
revoke execute on function public.frage_ist_sichtbar(boolean, uuid, boolean)
  from public, anon, authenticated;
revoke execute on function public.obmann_verein(text)
  from public, anon, authenticated;

-- Postgres vergibt fuer neue Funktionen sonst standardmaessig EXECUTE an
-- PUBLIC. Kuenftige Migrationen muessen den benoetigten Zugriff daher bewusst
-- an anon, authenticated oder service_role vergeben.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

commit;
