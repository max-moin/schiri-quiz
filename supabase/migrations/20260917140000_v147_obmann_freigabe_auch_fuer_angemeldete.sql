-- ============================================================
--  v147 - Die Freigabe-Funktionen auch fuer angemeldete Rollen
-- ============================================================
--  Fehlerbild: "permission denied for function
--  obmann_freigabe_anfragen", sobald der Reiter Freigabe im
--  Obmann-Bereich geoeffnet wird.
--
--  Ursache: Der Obmann-Bereich der Website ist ueber Supabase
--  Auth angemeldet. PostgREST fuehrt Aufrufe von dort unter der
--  Rolle "authenticated" aus, nicht unter "anon". v145 hat nur
--  "anon" berechtigt - die SwiftUI-App laeuft naemlich anonym.
--  Die Terminsuche, die im selben Bereich seit Monaten laeuft,
--  ist an beide Rollen vergeben; das war die Vorlage, an die ich
--  mich haette halten muessen.
--
--  Merksatz fuer die naechste obmann_-Funktion: Wird sie aus
--  src/admin/ gerufen, braucht sie BEIDE Rollen. Ruft sie nur die
--  SwiftUI-App, genuegt anon. Im Zweifel beide - die eigentliche
--  Pruefung ist ohnehin obmann_verein(p_passwort), nicht die Rolle.
--  tests/freigabe.test.js haelt das jetzt fest.
--
--  Nicht betroffen: die freigabe_-Funktionen des Vorstands. Dort
--  ist niemand angemeldet, das ist der Sinn des Links.
-- ============================================================

grant execute on function public.obmann_freigabe_anfragen(text) to authenticated;
grant execute on function public.obmann_ausruestung_preise(text) to authenticated;
grant execute on function public.obmann_ausruestung_preis_speichern(text, text, text, integer, boolean) to authenticated;
grant execute on function public.obmann_anfrage_preis_setzen(text, uuid, integer) to authenticated;
grant execute on function public.obmann_anfrage_vorlegen(text, uuid, boolean) to authenticated;
grant execute on function public.obmann_freigabe_link_erstellen(text, integer, text) to authenticated;
grant execute on function public.obmann_freigabe_links(text) to authenticated;
grant execute on function public.obmann_freigabe_link_widerrufen(text, uuid) to authenticated;
