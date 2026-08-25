-- Sicherer Pilot fuer die Website-Redaktion.
--
-- Anders als die historischen obmann_* RPCs akzeptiert dieser Bereich kein
-- kurzes Passwort im Browser. Schreibzugriffe brauchen gleichzeitig
--   1. ein Supabase-Benutzerkonto,
--   2. eine ausdrueckliche Zuordnung zu dieser Vereinsseite und
--   3. eine mit TOTP bestaetigte AAL2-Sitzung.
--
-- Die 2FAS-App ist dabei nur der TOTP-Generator. Das Benutzerkonto und die
-- Berechtigungspruefung bleiben bei Supabase Auth/Postgres.

create table if not exists public.website_redakteure (
  user_id uuid not null references auth.users(id) on delete cascade,
  seitenschluessel text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, seitenschluessel),
  constraint website_redakteure_seitenschluessel_check
    check (seitenschluessel ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table public.website_redakteure is
  'Explizite Zuordnung von Supabase-Auth-Benutzern zu einer Vereinsseite.';

alter table public.website_redakteure enable row level security;
revoke all on table public.website_redakteure from public, anon, authenticated;
grant select (seitenschluessel) on table public.website_redakteure to authenticated;

create policy "Redakteur sieht nur die eigene Zuordnung mit MFA"
  on public.website_redakteure
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select auth.jwt()->>'aal') = 'aal2'
  );

create table if not exists public.website_spesen_konfiguration (
  seitenschluessel text primary key,
  konfiguration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  constraint website_spesen_seitenschluessel_check
    check (seitenschluessel ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint website_spesen_konfiguration_objekt_check
    check (jsonb_typeof(konfiguration) = 'object'),
  constraint website_spesen_konfiguration_groesse_check
    check (octet_length(konfiguration::text) <= 200000)
);

comment on table public.website_spesen_konfiguration is
  'Oeffentlich lesbare, aber nur nach Supabase Auth plus TOTP-AAL2 editierbare Spesenkonfiguration.';

alter table public.website_spesen_konfiguration enable row level security;
revoke all on table public.website_spesen_konfiguration from public, anon, authenticated;

-- Der Rechner braucht nur diese drei oeffentlichen Felder. Die UUID des
-- Bearbeiters bleibt dem Browser absichtlich verborgen.
grant select (seitenschluessel, konfiguration, updated_at)
  on table public.website_spesen_konfiguration to anon, authenticated;
grant insert (seitenschluessel, konfiguration, updated_at, updated_by)
  on table public.website_spesen_konfiguration to authenticated;
grant update (konfiguration, updated_at, updated_by)
  on table public.website_spesen_konfiguration to authenticated;

create policy "Spesenkonfiguration ist oeffentlich lesbar"
  on public.website_spesen_konfiguration
  for select
  to anon, authenticated
  using (true);

create policy "Zugeordnete Redakteure duerfen mit MFA anlegen"
  on public.website_spesen_konfiguration
  for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  );

create policy "Zugeordnete Redakteure duerfen mit MFA aktualisieren"
  on public.website_spesen_konfiguration
  for update
  to authenticated
  using (
    (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  )
  with check (
    updated_by = (select auth.uid())
    and (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1
      from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_spesen_konfiguration.seitenschluessel
    )
  );

-- Weder DELETE noch Browser-Schreibrechte fuer website_redakteure werden
-- vergeben. Zuordnungen und ein komplettes Zuruecksetzen bleiben damit eine
-- bewusste Admin-Aktion im Supabase-Dashboard.

