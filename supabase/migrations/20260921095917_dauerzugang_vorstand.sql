-- =====================================================================
-- Persoenlicher Dauerzugang fuer einen Vereinsverantwortlichen
-- ---------------------------------------------------------------------
-- Bestehende Freigabelinks bleiben befristete, stapelbezogene Links.
-- Zusaetzlich kann der Obmann einen namentlich zugeordneten Zugang
-- erzeugen, der erst durch Widerruf endet. Der Klartext-Token wird wie
-- bisher nur einmal ausgegeben; gespeichert wird ausschliesslich sein
-- SHA-256-Abdruck.
--
-- Wichtig: "dauerhaft" heisst nicht "unkontrolliert". Jede Anfrage wird
-- weiterhin vom Obmann einzeln diesem Zugang vorgelegt und bleibt an die
-- dabei eingefrorene Version samt Betrag gebunden.
-- =====================================================================

alter table public.freigabe_links
  add column if not exists zugangsart text not null default 'befristet',
  add column if not exists verantwortlicher_name text,
  add column if not exists verantwortlicher_rolle text;

alter table public.freigabe_links
  alter column gueltig_bis drop not null;

alter table public.freigabe_links
  drop constraint if exists freigabe_links_zugangsart_check;
alter table public.freigabe_links
  add constraint freigabe_links_zugangsart_check
  check (zugangsart in ('befristet', 'dauerhaft'));

alter table public.freigabe_links
  drop constraint if exists freigabe_links_laufzeit_check;
alter table public.freigabe_links
  add constraint freigabe_links_laufzeit_check check (
    (zugangsart = 'befristet' and gueltig_bis is not null)
    or
    (zugangsart = 'dauerhaft' and gueltig_bis is null
      and char_length(btrim(coalesce(verantwortlicher_name, ''))) between 2 and 100)
  );

-- Pro Verein und Person nur ein aktiver Dauerzugang. Ein widerrufener
-- Zugang bleibt fuer die Historie erhalten und kann danach neu erstellt
-- werden.
create unique index if not exists freigabe_links_dauerzugang_person
  on public.freigabe_links(verein_id, lower(btrim(verantwortlicher_name)))
  where zugangsart = 'dauerhaft' and widerrufen_am is null;

create or replace function public.obmann_verantwortlichen_zugang_erstellen(
  p_passwort text,
  p_name text,
  p_rolle text default 'Vorstand')
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_name   text := btrim(coalesce(p_name, ''));
  v_rolle  text := btrim(coalesce(p_rolle, ''));
  v_token  text;
begin
  v_verein := public.obmann_verein(p_passwort);
  if char_length(v_name) not between 2 and 100 then
    raise exception 'Bitte den Namen der verantwortlichen Person eintragen.';
  end if;
  if char_length(v_rolle) not between 2 and 100 then
    raise exception 'Bitte die Rolle der verantwortlichen Person eintragen.';
  end if;
  if exists (
    select 1 from public.freigabe_links l
     where l.verein_id = v_verein
       and l.zugangsart = 'dauerhaft'
       and l.widerrufen_am is null
       and lower(btrim(l.verantwortlicher_name)) = lower(v_name)
  ) then
    raise exception 'Fuer diese Person gibt es bereits einen aktiven Dauerzugang.';
  end if;

  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');

  insert into public.freigabe_links(
    verein_id, token_abdruck, beschriftung, gueltig_bis, zugangsart,
    verantwortlicher_name, verantwortlicher_rolle)
  values (
    v_verein,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_name || ' · ' || v_rolle,
    null,
    'dauerhaft',
    v_name,
    v_rolle);

  return v_token;
end;
$$;

-- Ein Link ist aktiv, solange er nicht widerrufen wurde und entweder
-- keine Laufzeit hat (Dauerzugang) oder seine Frist noch laeuft.
create or replace function public.freigabe_verein(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  select l.verein_id into v_verein
    from public.freigabe_links l
   where l.token_abdruck = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and l.widerrufen_am is null
     and (l.gueltig_bis is null or l.gueltig_bis > now());
  if v_verein is null then
    raise exception 'Dieser Freigabe-Link ist nicht mehr gueltig.';
  end if;
  return v_verein;
end;
$$;

create or replace function public.freigabe_link_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  select l.id into v_id
    from public.freigabe_links l
   where l.token_abdruck = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and l.widerrufen_am is null
     and (l.gueltig_bis is null or l.gueltig_bis > now());
  if v_id is null then
    raise exception 'Dieser Freigabe-Link ist nicht mehr gueltig.';
  end if;
  return v_id;
end;
$$;

-- Kleine, bewusst sparsame Kopfinformation fuer die Vorstandsseite.
-- Der Token gibt niemals Link-ID, Tokenabdruck oder fremde Zugangslisten
-- preis.
create or replace function public.freigabe_zugang(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_link uuid;
  v_ergebnis jsonb;
begin
  v_link := public.freigabe_link_id(p_token);
  select jsonb_build_object(
      'art', l.zugangsart,
      'name', l.verantwortlicher_name,
      'rolle', l.verantwortlicher_rolle,
      'beschriftung', l.beschriftung,
      'gueltig_bis', l.gueltig_bis)
    into v_ergebnis
    from public.freigabe_links l
   where l.id = v_link;
  return v_ergebnis;
end;
$$;

-- Bei einem persoenlichen Zugang stammt der Akteur serverseitig aus dem
-- Link. Ein im Browser manipulierter Name kann die Historie nicht
-- umschreiben. Alte Stapellinks behalten das bisherige Namensfeld.
create or replace function public.freigabe_akteur(p_token text, p_name text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_link uuid;
  v_name text;
begin
  v_link := public.freigabe_link_id(p_token);
  select coalesce(nullif(btrim(l.verantwortlicher_name), ''), nullif(btrim(p_name), ''))
    into v_name from public.freigabe_links l where l.id = v_link;
  if char_length(coalesce(v_name, '')) < 2 then
    raise exception 'Bitte tragen Sie Ihren Namen ein.';
  end if;
  return v_name;
end;
$$;

-- Vorlegen: Dauerzugang und befristeten Link gleich behandeln. Ohne
-- explizite Auswahl wird der zuletzt angelegte aktive Zugang verwendet.
create or replace function public.obmann_anfrage_vorlegen(
  p_passwort text,
  p_id uuid,
  p_link_id uuid default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  a        public.ausruestungs_anfragen%rowtype;
  v_link   uuid;
  v_betrag integer;
begin
  v_verein := public.obmann_verein(p_passwort);

  select a2.* into a
    from public.ausruestungs_anfragen a2
    join public.schiedsrichter s on s.id = a2.schiedsrichter_id
   where a2.id = p_id and s.verein_id = v_verein and a2.typ = 'ausruestung';
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;

  v_betrag := coalesce(a.preis_final_cent, a.preis_schiri_cent, a.preis_richtwert_cent);
  if v_betrag is null then
    raise exception 'Ohne Betrag kann nichts vorgelegt werden. Bitte zuerst einen Preis eintragen.';
  end if;

  v_link := p_link_id;
  if v_link is null then
    select l.id into v_link
      from public.freigabe_links l
     where l.verein_id = v_verein
       and l.widerrufen_am is null
       and (l.gueltig_bis is null or l.gueltig_bis > now())
     order by (l.zugangsart = 'dauerhaft') desc, l.erstellt_am desc
     limit 1;
  else
    perform 1 from public.freigabe_links l
     where l.id = v_link and l.verein_id = v_verein
       and l.widerrufen_am is null
       and (l.gueltig_bis is null or l.gueltig_bis > now());
    if not found then raise exception 'Dieser Freigabe-Link ist nicht (mehr) gueltig.'; end if;
  end if;
  if v_link is null then
    raise exception 'Es gibt keinen gueltigen Freigabe-Link. Bitte zuerst einen erstellen.';
  end if;

  update public.ausruestungs_anfragen t
     set vorlage_preis_cent = v_betrag,
         vorlage_am         = now(),
         vorlage_link_id    = v_link,
         vorlage_umfang     = jsonb_build_object(
           'kategorie', t.kategorie, 'farbe', t.farbe, 'groesse', t.groesse,
           'aermellaenge', t.aermellaenge, 'anmerkung', t.anmerkung,
           'beschaffungsweg', t.beschaffungsweg, 'betrag_cent', v_betrag)
   where t.id = p_id;

  perform public.ausruestung_uebergang(p_id, 'vorgelegt', 'obmann', null, null, v_betrag);
end;
$$;

create or replace function public.freigabe_entscheiden(
  p_token text, p_id uuid, p_entscheidung text,
  p_name text, p_notiz text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
  v_name   text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  v_name   := public.freigabe_akteur(p_token, p_name);

  if p_entscheidung not in ('freigegeben', 'abgelehnt') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_entscheidung = 'abgelehnt' and char_length(btrim(coalesce(p_notiz, ''))) < 3 then
    raise exception 'Bitte die Ablehnung kurz begruenden.';
  end if;

  perform 1
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.vorlage_link_id = v_link and a.prozess_status = 'vorgelegt';
  if not found then raise exception 'Diese Anfrage steht nicht (mehr) zur Entscheidung.'; end if;

  perform public.ausruestung_uebergang(p_id, p_entscheidung, 'vorstand', v_name, p_notiz);
end;
$$;

create or replace function public.freigabe_zahlung_angewiesen(
  p_token text, p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
  v_name   text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  v_name   := public.freigabe_akteur(p_token, p_name);

  perform 1
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.vorlage_link_id = v_link and a.prozess_status = 'beleg_geprueft';
  if not found then raise exception 'Fuer diesen Vorgang steht gerade keine Zahlung an.'; end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_angewiesen', 'vorstand', v_name);
end;
$$;

revoke all on function public.obmann_verantwortlichen_zugang_erstellen(text, text, text) from public;
revoke all on function public.freigabe_verein(text) from public;
revoke all on function public.freigabe_link_id(text) from public;
revoke all on function public.freigabe_zugang(text) from public;
revoke all on function public.freigabe_akteur(text, text) from public;
revoke all on function public.obmann_anfrage_vorlegen(text, uuid, uuid) from public;
revoke all on function public.freigabe_entscheiden(text, uuid, text, text, text) from public;
revoke all on function public.freigabe_zahlung_angewiesen(text, uuid, text) from public;

grant execute on function public.obmann_verantwortlichen_zugang_erstellen(text, text, text)
  to anon, authenticated;
grant execute on function public.obmann_anfrage_vorlegen(text, uuid, uuid)
  to anon, authenticated;
grant execute on function public.freigabe_zugang(text) to anon;
grant execute on function public.freigabe_entscheiden(text, uuid, text, text, text) to anon;
grant execute on function public.freigabe_zahlung_angewiesen(text, uuid, text) to anon;
