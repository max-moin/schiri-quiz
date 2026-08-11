-- Die KI-nahen RPCs liefern Musterloesungen oder speichern das Urteil der
-- KI. Sie duerfen deshalb nicht direkt mit dem oeffentlichen Browser-Key
-- aufrufbar sein. Nach dieser Migration kann nur noch der serverseitige
-- Supabase-Schluessel der Vercel Functions diese Funktionen ausfuehren.
--
-- WICHTIGE DEPLOY-REIHENFOLGE:
-- 1. SUPABASE_SECRET_KEY (bevorzugt) oder SUPABASE_SERVICE_ROLE_KEY in
--    Vercel fuer Preview und Production hinterlegen.
-- 2. Die API-Aenderung deployen und eine Freitextantwort testen.
-- 3. Erst dann diese Migration auf Production anwenden.

begin;

revoke execute on function public.erklaerung_kontext_laden(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.erklaerung_kontext_laden(uuid, uuid, text, boolean)
  to service_role;

revoke execute on function public.freitext_kontext_laden(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.freitext_kontext_laden(uuid, uuid, text)
  to service_role;

revoke execute on function public.historie_freitext_kontext_laden(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.historie_freitext_kontext_laden(uuid, uuid, text)
  to service_role;

revoke execute on function public.freitext_nachbesserung_kontext(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.freitext_nachbesserung_kontext(uuid, uuid, text)
  to service_role;

revoke execute on function public.freitext_antwort_speichern(
  uuid, uuid, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.freitext_antwort_speichern(
  uuid, uuid, text, text, boolean, text, text, text
) to service_role;

revoke execute on function public.historie_freitext_antwort_speichern(
  uuid, uuid, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.historie_freitext_antwort_speichern(
  uuid, uuid, text, text, boolean, text
) to service_role;

revoke execute on function public.freitext_ergaenzung_speichern(
  uuid, uuid, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.freitext_ergaenzung_speichern(
  uuid, uuid, text, text, boolean, text
) to service_role;

commit;
