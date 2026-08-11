-- Supabase hatte fuer neue Funktionen neben PUBLIC auch anon und
-- authenticated explizit mit EXECUTE vorbelegt. Alle drei Standardrechte
-- werden deshalb entfernt. Benoetigte Endpunkte muessen kuenftig in ihrer
-- Migration bewusst fuer die vorgesehenen Rollen freigegeben werden.

begin;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;
