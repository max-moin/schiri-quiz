-- v142: Nach der Freigabe eines Selbstkaufs kann der Schiri den Kauf
-- bestaetigen und den Beleg sofort oder zu einem spaeteren Zeitpunkt
-- hochladen. Ein direkter Rechnungs-Upload bestaetigt den Kauf ebenfalls.

alter table public.ausruestungs_anfragen
  add column if not exists selbstkauf_bestaetigt boolean not null default false,
  add column if not exists selbstkauf_bestaetigt_am timestamptz;

update public.ausruestungs_anfragen
set selbstkauf_bestaetigt = true,
    selbstkauf_bestaetigt_am = coalesce(selbstkauf_bestaetigt_am, rechnung_hochgeladen_am)
where rechnung_hochgeladen_am is not null
  and beschaffungsweg = 'weg2_schiri_besorgt';

create or replace function public.schiri_anfrage_selbstkauf_bestaetigen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_anfrage_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  update public.ausruestungs_anfragen
  set selbstkauf_bestaetigt = true,
      selbstkauf_bestaetigt_am = coalesce(selbstkauf_bestaetigt_am, now()),
      obmann_gesehen = false,
      aktualisiert_am = now()
  where id = p_anfrage_id
    and schiedsrichter_id = p_schiedsrichter_id
    and typ = 'ausruestung'
    and status = 'angenommen'
    and beschaffungsweg = 'weg2_schiri_besorgt';

  if not found then
    raise exception 'Anfrage nicht gefunden oder Selbstkauf noch nicht freigegeben';
  end if;
end;
$$;

revoke execute on function public.schiri_anfrage_selbstkauf_bestaetigen(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.schiri_anfrage_selbstkauf_bestaetigen(uuid, text, uuid)
  to anon, authenticated;

create or replace function public.schiri_anfrage_rechnung_hochladen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_anfrage_id uuid,
  p_bild_base64 text,
  p_mime text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  update public.ausruestungs_anfragen
  set rechnung_bild_base64 = p_bild_base64,
      rechnung_mime = p_mime,
      rechnung_hochgeladen_am = now(),
      selbstkauf_bestaetigt = true,
      selbstkauf_bestaetigt_am = coalesce(selbstkauf_bestaetigt_am, now()),
      obmann_gesehen = false,
      aktualisiert_am = now()
  where id = p_anfrage_id
    and schiedsrichter_id = p_schiedsrichter_id
    and status = 'angenommen'
    and beschaffungsweg = 'weg2_schiri_besorgt';

  if not found then
    raise exception 'Anfrage nicht gefunden oder Rechnung aktuell nicht hochladbar';
  end if;
end;
$$;

revoke execute on function public.schiri_anfrage_rechnung_hochladen(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.schiri_anfrage_rechnung_hochladen(uuid, text, uuid, text, text)
  to anon, authenticated;

drop function if exists public.schiri_anfragen_liste(uuid, text);
create function public.schiri_anfragen_liste(
  p_schiedsrichter_id uuid,
  p_pin text
) returns table(
  id uuid,
  typ text,
  kategorie text,
  farbe text,
  groesse text,
  aermellaenge text,
  anmerkung text,
  status text,
  beschaffungsweg text,
  erstellt_am timestamptz,
  schiri_gesehen boolean,
  rechnung_hochgeladen_am timestamptz,
  erstattet boolean,
  selbstkauf_bestaetigt boolean,
  selbstkauf_bestaetigt_am timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  return query
  select a.id, a.typ, a.kategorie, a.farbe, a.groesse, a.aermellaenge,
         a.anmerkung, a.status, a.beschaffungsweg, a.erstellt_am,
         a.schiri_gesehen, a.rechnung_hochgeladen_am, a.erstattet,
         a.selbstkauf_bestaetigt, a.selbstkauf_bestaetigt_am
  from public.ausruestungs_anfragen a
  where a.schiedsrichter_id = p_schiedsrichter_id
  order by a.erstellt_am desc;
end;
$$;

revoke execute on function public.schiri_anfragen_liste(uuid, text)
  from public, anon, authenticated;
grant execute on function public.schiri_anfragen_liste(uuid, text)
  to anon, authenticated;

drop function if exists public.obmann_anfragen_liste(text);
create function public.obmann_anfragen_liste(
  p_passwort text
) returns table(
  id uuid,
  schiedsrichter_id uuid,
  schiri_name text,
  typ text,
  kategorie text,
  farbe text,
  groesse text,
  aermellaenge text,
  anmerkung text,
  status text,
  beschaffungsweg text,
  notiz_obmann text,
  erstellt_am timestamptz,
  rechnung_bild_base64 text,
  rechnung_mime text,
  rechnung_hochgeladen_am timestamptz,
  abholung_bestaetigt boolean,
  keine_zahlung_faellig boolean,
  erstattet boolean,
  obmann_gesehen boolean,
  selbstkauf_bestaetigt boolean,
  selbstkauf_bestaetigt_am timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  return query
  select a.id, a.schiedsrichter_id, s.name, a.typ, a.kategorie, a.farbe,
         a.groesse, a.aermellaenge, a.anmerkung, a.status,
         a.beschaffungsweg, a.notiz_obmann, a.erstellt_am,
         a.rechnung_bild_base64, a.rechnung_mime, a.rechnung_hochgeladen_am,
         a.abholung_bestaetigt, a.keine_zahlung_faellig, a.erstattet,
         a.obmann_gesehen, a.selbstkauf_bestaetigt, a.selbstkauf_bestaetigt_am
  from public.ausruestungs_anfragen a
  join public.schiedsrichter s
    on s.id = a.schiedsrichter_id and s.verein_id = v_verein
  order by a.erstellt_am desc;
end;
$$;

revoke execute on function public.obmann_anfragen_liste(text)
  from public, anon, authenticated;
grant execute on function public.obmann_anfragen_liste(text)
  to anon, authenticated;

drop function if exists public.obmann_anfragen_liste_fuer_schiri(text, text);
create function public.obmann_anfragen_liste_fuer_schiri(
  p_passwort text,
  p_schiedsrichter text
) returns table(
  id uuid,
  typ text,
  kategorie text,
  farbe text,
  groesse text,
  aermellaenge text,
  anmerkung text,
  status text,
  beschaffungsweg text,
  notiz_obmann text,
  erstellt_am timestamptz,
  rechnung_bild_base64 text,
  rechnung_mime text,
  rechnung_hochgeladen_am timestamptz,
  abholung_bestaetigt boolean,
  keine_zahlung_faellig boolean,
  erstattet boolean,
  obmann_gesehen boolean,
  selbstkauf_bestaetigt boolean,
  selbstkauf_bestaetigt_am timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  return query
  select a.id, a.typ, a.kategorie, a.farbe, a.groesse, a.aermellaenge,
         a.anmerkung, a.status, a.beschaffungsweg, a.notiz_obmann,
         a.erstellt_am, a.rechnung_bild_base64, a.rechnung_mime,
         a.rechnung_hochgeladen_am, a.abholung_bestaetigt,
         a.keine_zahlung_faellig, a.erstattet, a.obmann_gesehen,
         a.selbstkauf_bestaetigt, a.selbstkauf_bestaetigt_am
  from public.ausruestungs_anfragen a
  join public.schiedsrichter s
    on s.id = a.schiedsrichter_id and s.verein_id = v_verein
  where s.name = p_schiedsrichter
  order by a.erstellt_am desc;
end;
$$;

revoke execute on function public.obmann_anfragen_liste_fuer_schiri(text, text)
  from public, anon, authenticated;
grant execute on function public.obmann_anfragen_liste_fuer_schiri(text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
