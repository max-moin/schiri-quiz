-- Drei Fachthemen im vorhandenen festen Guide-Editor erlauben.
-- Keine Inhalte veröffentlichen oder bestehende Berechtigungen erweitern.
alter table public.website_blockseiten drop constraint website_blockseiten_seite_check;
alter table public.website_blockseiten add constraint website_blockseiten_seite_check
 check(seite in ('dfbnet','sonderbericht','schiri-treff','rote-karte','spielbericht','sperrtermine','schiri-beobachtung','spielersperren'));

create or replace function private.blockredaktion_pruefen(p_seitenschluessel text,p_seite text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or (auth.jwt()->>'aal') is distinct from 'aal2' or not exists(
  select 1 from public.website_redakteure where user_id=auth.uid() and seitenschluessel=p_seitenschluessel)
 then raise exception 'Redaktionszugriff erfordert die berechtigte Anmeldung mit zweitem Faktor.' using errcode='42501'; end if;
 if p_seite not in ('dfbnet','sonderbericht','schiri-treff','rote-karte','spielbericht','sperrtermine','schiri-beobachtung','spielersperren') or p_seite is null
 then raise exception 'Unbekannte Redaktionsseite.'; end if;
end $$;
revoke all on function private.blockredaktion_pruefen(text,text) from public,anon,authenticated;
