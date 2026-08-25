-- Die RLS-Policies der Redaktionsinhalte pruefen website_redakteure.user_id.
-- Dafuer braucht die Rolle auch das Spaltenrecht auf user_id. Die RLS der
-- Zuordnungstabelle liefert weiterhin ausschliesslich die eigene Zeile und nur
-- bei AAL2; fremde Benutzer-UUIDs werden dadurch nicht lesbar.

grant select (user_id, seitenschluessel)
  on table public.website_redakteure to authenticated;

comment on table public.website_redakteure is
  'AAL2-geschuetzte Zuordnung von Supabase-Auth-Benutzern zu Vereinsseiten; jeder Redakteur sieht nur die eigene Zeile.';
