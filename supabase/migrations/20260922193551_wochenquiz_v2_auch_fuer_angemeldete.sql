-- Angemeldete Obmann-/Redakteurskonten nutzen im Browser denselben
-- PIN-geschuetzten Wochenquiz-Ablauf wie anonyme Schiedsrichter.
-- v108 hatte diese vier RPCs nur fuer anon freigegeben.

grant execute on function public.wochen_fragen_v2(uuid, text) to authenticated;
grant execute on function public.meine_antworten_v2(uuid, text) to authenticated;
grant execute on function public.antwort_auswahl_abgeben(uuid, uuid, text[], text) to authenticated;
grant execute on function public.antwort_zahl_abgeben(uuid, uuid, numeric, text, text) to authenticated;
