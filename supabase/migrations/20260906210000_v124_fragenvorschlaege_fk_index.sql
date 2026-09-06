-- v124: covering index fuer den optionalen Verweis vom angenommenen
-- Vorschlag auf die daraus angelegte Quizfrage. Die Fachindizes aus v123
-- decken diese FK-Spalte nicht ab (Supabase Performance Advisor 06.09.2026).
create index if not exists fragenvorschlaege_uebernommene_frage
  on public.fragenvorschlaege(uebernommene_frage_id)
  where uebernommene_frage_id is not null;
