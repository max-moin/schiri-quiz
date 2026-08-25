-- Redaktion der drei nach dem Spesen-Piloten freigegebenen Inhaltsbereiche.
-- Schreibrechte verlangen weiterhin Konto + Vereinszuordnung + TOTP/AAL2.

create table if not exists public.website_inhalte_konfiguration (
  seitenschluessel text not null,
  bereich text not null,
  konfiguration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  primary key (seitenschluessel, bereich),
  constraint website_inhalte_seitenschluessel_check
    check (seitenschluessel ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint website_inhalte_bereich_check
    check (bereich in ('regeln', 'vorlagen', 'unterlagen')),
  constraint website_inhalte_konfiguration_objekt_check
    check (jsonb_typeof(konfiguration) = 'object'),
  constraint website_inhalte_konfiguration_groesse_check
    check (octet_length(konfiguration::text) <= 400000)
);

create table if not exists public.website_inhalte_versionen (
  id bigint generated always as identity primary key,
  seitenschluessel text not null,
  bereich text not null,
  konfiguration jsonb not null,
  urspruenglich_veroeffentlicht_am timestamptz,
  archiviert_am timestamptz not null default now(),
  archiviert_von uuid not null references auth.users(id),
  constraint website_inhalte_versionen_bereich_check
    check (bereich in ('regeln', 'vorlagen', 'unterlagen')),
  constraint website_inhalte_versionen_objekt_check
    check (jsonb_typeof(konfiguration) = 'object'),
  constraint website_inhalte_versionen_groesse_check
    check (octet_length(konfiguration::text) <= 400000)
);

create index if not exists website_inhalte_updated_by_idx
  on public.website_inhalte_konfiguration (updated_by);
create index if not exists website_inhalte_versionen_lookup_idx
  on public.website_inhalte_versionen (seitenschluessel, bereich, archiviert_am desc);
create index if not exists website_inhalte_versionen_benutzer_idx
  on public.website_inhalte_versionen (archiviert_von);

alter table public.website_inhalte_konfiguration enable row level security;
alter table public.website_inhalte_versionen enable row level security;

revoke all on table public.website_inhalte_konfiguration from public, anon, authenticated;
revoke all on table public.website_inhalte_versionen from public, anon, authenticated;

grant select (seitenschluessel, bereich, konfiguration, updated_at)
  on table public.website_inhalte_konfiguration to anon, authenticated;
grant insert (seitenschluessel, bereich, konfiguration, updated_at, updated_by)
  on table public.website_inhalte_konfiguration to authenticated;
grant update (konfiguration, updated_at, updated_by)
  on table public.website_inhalte_konfiguration to authenticated;
grant select (id, seitenschluessel, bereich, konfiguration, urspruenglich_veroeffentlicht_am, archiviert_am)
  on table public.website_inhalte_versionen to authenticated;
grant insert (seitenschluessel, bereich, konfiguration, urspruenglich_veroeffentlicht_am, archiviert_von)
  on table public.website_inhalte_versionen to authenticated;
grant usage, select on sequence public.website_inhalte_versionen_id_seq to authenticated;

create policy "Website-Inhalte sind oeffentlich lesbar"
  on public.website_inhalte_konfiguration for select to anon, authenticated
  using (true);

create policy "Redakteure duerfen Website-Inhalte mit MFA anlegen"
  on public.website_inhalte_konfiguration for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_inhalte_konfiguration.seitenschluessel
    )
  );

create policy "Redakteure duerfen Website-Inhalte mit MFA aktualisieren"
  on public.website_inhalte_konfiguration for update to authenticated
  using (
    ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_inhalte_konfiguration.seitenschluessel
    )
  )
  with check (
    updated_by = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_inhalte_konfiguration.seitenschluessel
    )
  );

create policy "Redakteure sehen eigene Inhaltsversionen mit MFA"
  on public.website_inhalte_versionen for select to authenticated
  using (
    ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_inhalte_versionen.seitenschluessel
    )
  );

create policy "Redakteure archivieren eigene Inhaltsversionen mit MFA"
  on public.website_inhalte_versionen for insert to authenticated
  with check (
    archiviert_von = (select auth.uid())
    and ((select auth.jwt())->>'aal') = 'aal2'
    and exists (
      select 1 from public.website_redakteure wr
      where wr.user_id = (select auth.uid())
        and wr.seitenschluessel = website_inhalte_versionen.seitenschluessel
    )
  );

comment on table public.website_inhalte_konfiguration is
  'Veroeffentlichte Regeln, Absagevorlagen und Unterlagen der Vereinsseite.';
comment on table public.website_inhalte_versionen is
  'Nur fuer zugeordnete AAL2-Redakteure sichtbare vorherige Inhaltsstaende.';
