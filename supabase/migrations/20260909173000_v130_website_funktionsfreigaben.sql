-- v130: Regelübersicht und Spesenrechner unabhängig vom Inhalt sichtbar
-- schalten. Fehlt die Zeile, bleibt beides im Frontend sicher gesperrt.

create table if not exists public.website_funktionsfreigaben (
  seitenschluessel text primary key,
  spesen_aktiv boolean not null default false,
  regeln_aktiv boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  constraint website_funktionsfreigaben_seitenschluessel_check
    check (seitenschluessel ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

alter table public.website_funktionsfreigaben enable row level security;

revoke all on table public.website_funktionsfreigaben from public, anon, authenticated;
grant select (seitenschluessel, spesen_aktiv, regeln_aktiv, updated_at)
  on table public.website_funktionsfreigaben to anon, authenticated;
grant insert (seitenschluessel, spesen_aktiv, regeln_aktiv, updated_at, updated_by)
  on table public.website_funktionsfreigaben to authenticated;
grant update (spesen_aktiv, regeln_aktiv, updated_at, updated_by)
  on table public.website_funktionsfreigaben to authenticated;

create policy "Website-Funktionsfreigaben sind oeffentlich lesbar"
  on public.website_funktionsfreigaben for select to anon, authenticated
  using (true);

create policy "Redakteure duerfen Funktionsfreigaben mit MFA anlegen"
  on public.website_funktionsfreigaben for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_funktionsfreigaben.seitenschluessel
    )
  );

create policy "Redakteure duerfen Funktionsfreigaben mit MFA aktualisieren"
  on public.website_funktionsfreigaben for update to authenticated
  using (
    ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_funktionsfreigaben.seitenschluessel
    )
  )
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_funktionsfreigaben.seitenschluessel
    )
  );

comment on table public.website_funktionsfreigaben is
  'Oeffentliche Sichtbarkeit fachlich noch pruefbarer Website-Funktionen. Schreiben nur fuer zugeordnete AAL2-Redakteure.';
