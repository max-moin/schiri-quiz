-- ============================================================
--  v137 - Ablage fuer selbst hochgeladene Website-Bilder
-- ============================================================
--  Max am 12.09.2026: "Du hattest ja online nicht wirklich Bilder
--  gefunden fuer die einzelnen Widgets von der Startseite. Dass ich da
--  einfach Bilder hochladen kann und die dann reingepackt werden, waere
--  fuer mich ganz geil."
--
--  Bisher standen die Bildadressen fest in verein.config.js - einer
--  Datei, die an jeden Besucher ausgeliefert wird und die nur aendern
--  kann, wer das Projekt neu veroeffentlicht. Ein Motiv auszutauschen
--  war damit eine Entwickleraufgabe.
--
--  ZUGANGSMODELL, genau wie bei den redaktionellen Texten:
--  Lesen darf jeder (die Bilder stehen ohnehin auf der oeffentlichen
--  Startseite). Schreiben darf nur, wer mit E-Mail UND zweitem Faktor
--  angemeldet ist (aal2) UND in "website_redakteure" fuer genau diesen
--  Seitenschluessel eingetragen ist. Die Pruefung haengt am ERSTEN
--  Pfadabschnitt: "<seitenschluessel>/aufmacher-123.jpg". Damit kann ein
--  Redakteur nicht in den Ordner eines anderen Vereins schreiben.
--
--  Groesse und Dateityp begrenzt der Bucket selbst, nicht erst der
--  Browser: eine Grenze, die nur im JavaScript steht, ist keine.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-bilder',
  'website-bilder',
  true,
  3145728,                                  -- 3 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lesen: oeffentlich. Die Bilder stehen auf der oeffentlichen
-- Startseite, ein Leserecht zu verlangen waere Theater.
drop policy if exists "Website-Bilder sind oeffentlich lesbar" on storage.objects;
create policy "Website-Bilder sind oeffentlich lesbar"
  on storage.objects for select
  using (bucket_id = 'website-bilder');

-- Hochladen, ersetzen, entfernen: nur Redakteure dieses Seitenschluessels
-- mit zweitem Faktor.
drop policy if exists "Redakteure duerfen Website-Bilder hochladen" on storage.objects;
create policy "Redakteure duerfen Website-Bilder hochladen"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'website-bilder'
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
       where wr.user_id = (select auth.uid())
         and wr.seitenschluessel = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Redakteure duerfen Website-Bilder ersetzen" on storage.objects;
create policy "Redakteure duerfen Website-Bilder ersetzen"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'website-bilder'
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
       where wr.user_id = (select auth.uid())
         and wr.seitenschluessel = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Redakteure duerfen Website-Bilder entfernen" on storage.objects;
create policy "Redakteure duerfen Website-Bilder entfernen"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'website-bilder'
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
       where wr.user_id = (select auth.uid())
         and wr.seitenschluessel = (storage.foldername(name))[1]
    )
  );
