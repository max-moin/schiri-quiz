-- PDF-Protokolle bleiben im privaten Storage. Leserechte entstehen nur
-- fuer die eigene Vereinsmitgliedschaft UND nach Obmann-Freigabe; Browser
-- erhalten ausschliesslich kurzlebige, serverseitig signierte Links.

insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values ('sr-protokolle', 'sr-protokolle', false, 3000000,
        array['application/pdf']::text[])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.termine
  add column if not exists protokoll_pdf_pfad text,
  add column if not exists protokoll_pdf_name text;

-- Nur der serverseitige Upload-Endpunkt darf nach erfolgreicher
-- Obmann-Passwortpruefung einen PDF-Pfad hinterlegen. Der Server prueft die
-- Datei und laedt sie zuerst hoch; die DB prueft den Bezug zum Termin.
create or replace function public.obmann_termin_protokoll_pdf_setzen(
  p_passwort text, p_termin_id uuid, p_pfad text, p_name text
) returns text language plpgsql security definer set search_path to '' as $function$
declare v_verein uuid; v_alt text;
begin
  v_verein := public.obmann_verein(p_passwort);
  if p_pfad !~ ('^' || p_termin_id::text || '/[0-9a-f-]{36}\.pdf$') then
    raise exception 'Ungueltiger PDF-Pfad';
  end if;
  if not exists (select 1 from storage.objects o
    where o.bucket_id = 'sr-protokolle' and o.name = p_pfad) then
    raise exception 'PDF fehlt im Speicher';
  end if;
  select t.protokoll_pdf_pfad into v_alt from public.termine t
   where t.id = p_termin_id and t.verein_id = v_verein for update;
  if not found then raise exception 'Termin nicht gefunden'; end if;
  update public.termine t set
    protokoll_pdf_pfad = p_pfad,
    protokoll_pdf_name = left(nullif(btrim(coalesce(p_name,'')),''), 120),
    protokoll_freigegeben = false,
    protokoll_aktualisiert_am = now()
  where t.id = p_termin_id and t.verein_id = v_verein;
  return v_alt;
end $function$;

-- App-Statusabfrage fuer das angehaengte PDF; kein Storage-Geheimnis.
create or replace function public.obmann_termin_protokoll_pdf(
  p_passwort text, p_termin_id uuid
) returns table(name text, vorhanden boolean, freigegeben boolean)
language plpgsql stable security definer set search_path to '' as $function$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select t.protokoll_pdf_name,
    (t.protokoll_pdf_pfad is not null), t.protokoll_freigegeben
  from public.termine t where t.id = p_termin_id and t.verein_id = v_verein;
end $function$;

-- PIN und Vereinszuordnung werden auch beim PDF-Abruf erneut geprueft.
create or replace function public.termin_protokoll_pdf_fuer_schiri(
  p_schiedsrichter_id uuid, p_pin text, p_termin_id uuid
) returns table(pfad text, name text)
language plpgsql stable security definer set search_path to '' as $function$
declare v_verein uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query select t.protokoll_pdf_pfad, t.protokoll_pdf_name
    from public.termine t
   where t.id = p_termin_id and t.verein_id = v_verein
     and t.protokoll_freigegeben and t.protokoll_pdf_pfad is not null;
end $function$;

-- Die bestehende Text-/Freigabeaktion soll auch ein reines PDF-Protokoll
-- veroeffentlichen koennen. Ohne Text UND ohne PDF bleibt sie gesperrt.
create or replace function public.obmann_termin_protokoll_speichern(
  p_passwort text, p_termin_id uuid, p_titel text,
  p_inhalt text, p_freigegeben boolean
) returns void language plpgsql security definer set search_path to '' as $function$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.termine t set
    protokoll_titel = nullif(btrim(p_titel),''),
    protokoll_inhalt = nullif(btrim(p_inhalt),''),
    protokoll_freigegeben = coalesce(p_freigegeben,false)
      and (nullif(btrim(p_inhalt),'') is not null
           or t.protokoll_pdf_pfad is not null),
    protokoll_aktualisiert_am = now()
  where t.id = p_termin_id and t.verein_id = v_verein;
  if not found then raise exception 'Termin nicht gefunden'; end if;
end $function$;

revoke all on function public.obmann_termin_protokoll_pdf_setzen(text,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.obmann_termin_protokoll_pdf(text,uuid)
  from public,anon,authenticated;
revoke all on function public.termin_protokoll_pdf_fuer_schiri(uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_termin_protokoll_pdf_setzen(text,uuid,text,text)
  to service_role;
grant execute on function public.obmann_termin_protokoll_pdf(text,uuid)
  to anon,authenticated;
grant execute on function public.termin_protokoll_pdf_fuer_schiri(uuid,text,uuid)
  to service_role;
-- Der Upload-Endpunkt liest die bestehende Protokollberechtigung mit dem
-- Service-Schluessel, bevor er eine Datei in den privaten Bucket schreibt.
grant execute on function public.obmann_termin_protokoll(text,uuid)
  to service_role;
notify pgrst, 'reload schema';
