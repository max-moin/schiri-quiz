-- Nachkontrolle mit den Supabase Security-/Performance-Advisors.
-- auth.jwt() muss als eigener SELECT-Initplan geschrieben werden; so wird
-- der Claim nicht fuer jede Tabellenzeile erneut ausgewertet.

drop policy if exists "Redakteur sieht nur die eigene Zuordnung mit MFA"
  on public.website_redakteure;
create policy "Redakteur sieht nur die eigene Zuordnung mit MFA"
  on public.website_redakteure
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
  );

drop policy if exists "Zugeordnete Redakteure duerfen mit MFA anlegen"
  on public.website_spesen_konfiguration;
create policy "Zugeordnete Redakteure duerfen mit MFA anlegen"
  on public.website_spesen_konfiguration
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  );

drop policy if exists "Zugeordnete Redakteure duerfen mit MFA aktualisieren"
  on public.website_spesen_konfiguration;
create policy "Zugeordnete Redakteure duerfen mit MFA aktualisieren"
  on public.website_spesen_konfiguration
  for update
  to authenticated
  using (
    ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  )
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  );

create index if not exists website_spesen_konfiguration_updated_by_idx
  on public.website_spesen_konfiguration(updated_by);

