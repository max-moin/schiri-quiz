-- Neue Ausruestungsanfragen koennen mehrere Positionen enthalten. Bereits
-- eingereichte Einzelanfragen bleiben unveraendert (buendel_id = null).
-- Jeder Artikel behaelt seinen eigenen Preis, Prozess und Vorstandsentscheid.

create table public.ausruestungs_buendel (
  id uuid primary key default gen_random_uuid(),
  schiedsrichter_id uuid not null references public.schiedsrichter(id),
  absende_id uuid not null,
  gesamt_anmerkung text,
  beschaffungsweg text not null
    check (beschaffungsweg in ('weg1_obmann_besorgt', 'weg2_schiri_besorgt')),
  positionen_anzahl smallint not null check (positionen_anzahl between 1 and 12),
  inhalt_abdruck text not null,
  erstellt_am timestamptz not null default now(),
  unique (schiedsrichter_id, absende_id),
  constraint ausruestungs_buendel_anmerkung_laenge
    check (char_length(coalesce(gesamt_anmerkung, '')) <= 1500)
);

create index ausruestungs_buendel_schiri_zeit_idx
  on public.ausruestungs_buendel (schiedsrichter_id, erstellt_am desc);

alter table public.ausruestungs_buendel enable row level security;
revoke all on public.ausruestungs_buendel from public, anon, authenticated;

alter table public.ausruestungs_anfragen
  add column buendel_id uuid references public.ausruestungs_buendel(id),
  add column buendel_position smallint;

alter table public.ausruestungs_anfragen
  add constraint ausruestungs_anfragen_buendel_paar
  check ((buendel_id is null and buendel_position is null)
      or (buendel_id is not null and buendel_position between 1 and 12));

create unique index ausruestungs_anfragen_buendel_position_idx
  on public.ausruestungs_anfragen (buendel_id, buendel_position)
  where buendel_id is not null;

-- Ein RPC = eine Transaktion. Ein erneuter Submit mit gleicher absende_id
-- liefert dieselbe Anfrage; ein anderer Inhalt mit gleicher ID wird abgewiesen.
create function public.schiri_ausruestungsbuendel_erstellen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_absende_id uuid,
  p_positionen jsonb,
  p_gesamt_anmerkung text default null,
  p_beschaffungsweg text default 'weg2_schiri_besorgt'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_bestehend text;
  v_abdruck text;
  v_position jsonb;
  v_nummer smallint := 0;
  v_kategorie text;
  v_farbe text;
  v_groesse text;
  v_aermel text;
  v_anmerkung text;
  v_preis integer;
  v_preis_text text;
  v_gesamt text := nullif(btrim(coalesce(p_gesamt_anmerkung, '')), '');
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_absende_id is null then raise exception 'Absende-ID fehlt.'; end if;
  if jsonb_typeof(p_positionen) is distinct from 'array'
     or jsonb_array_length(p_positionen) not between 1 and 12 then
    raise exception 'Bitte 1 bis 12 Ausruestungsstuecke angeben.';
  end if;
  if char_length(coalesce(v_gesamt, '')) > 1500 then
    raise exception 'Die Anmerkung zur gesamten Anfrage ist zu lang.';
  end if;
  if p_beschaffungsweg not in ('weg1_obmann_besorgt', 'weg2_schiri_besorgt') then
    raise exception 'Ungueltiger Beschaffungswunsch.';
  end if;

  v_abdruck := encode(extensions.digest(
    p_positionen::text || '|' || coalesce(v_gesamt, '') || '|' || p_beschaffungsweg,
    'sha256'), 'hex');

  insert into public.ausruestungs_buendel
    (schiedsrichter_id, absende_id, gesamt_anmerkung, beschaffungsweg,
     positionen_anzahl, inhalt_abdruck)
  values
    (p_schiedsrichter_id, p_absende_id, v_gesamt, p_beschaffungsweg,
     jsonb_array_length(p_positionen), v_abdruck)
  on conflict (schiedsrichter_id, absende_id) do nothing
  returning id into v_id;

  if v_id is null then
    select b.id, b.inhalt_abdruck into v_id, v_bestehend
      from public.ausruestungs_buendel b
     where b.schiedsrichter_id = p_schiedsrichter_id
       and b.absende_id = p_absende_id;
    if v_bestehend is distinct from v_abdruck then
      raise exception 'Diese Absende-ID gehoert bereits zu einer anderen Anfrage.';
    end if;
    return v_id;
  end if;

  for v_position in select value from jsonb_array_elements(p_positionen) loop
    v_nummer := v_nummer + 1;
    if jsonb_typeof(v_position) <> 'object' then
      raise exception 'Position % ist ungueltig.', v_nummer;
    end if;
    v_kategorie := nullif(btrim(v_position->>'kategorie'), '');
    v_farbe := nullif(btrim(v_position->>'farbe'), '');
    v_groesse := nullif(btrim(v_position->>'groesse'), '');
    v_aermel := nullif(btrim(v_position->>'aermellaenge'), '');
    v_anmerkung := nullif(btrim(v_position->>'anmerkung'), '');
    v_preis_text := v_position->>'preis_cent';

    if v_kategorie not in (
      'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
      'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
      'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
    ) or v_kategorie is null then
      raise exception 'Ungueltige Kategorie in Position %.', v_nummer;
    end if;
    if v_aermel is not null
       and (v_kategorie <> 'trikot' or v_aermel not in ('kurz','lang')) then
      raise exception 'Ungueltige Aermellaenge in Position %.', v_nummer;
    end if;
    if v_kategorie = 'sonstiges' and char_length(coalesce(v_anmerkung, '')) < 2 then
      raise exception 'Bitte Sonstiges in Position % beschreiben.', v_nummer;
    end if;
    if char_length(coalesce(v_farbe, '')) > 80
       or char_length(coalesce(v_groesse, '')) > 80
       or char_length(coalesce(v_anmerkung, '')) > 1000 then
      raise exception 'Angaben in Position % sind zu lang.', v_nummer;
    end if;
    if v_preis_text is null then
      v_preis := null;
    elsif v_preis_text !~ '^[0-9]{1,6}$' then
      raise exception 'Ungueltiger Preis in Position %.', v_nummer;
    else
      v_preis := v_preis_text::integer;
      if v_preis > 500000 then
        raise exception 'Preis in Position % liegt ausserhalb des Bereichs.', v_nummer;
      end if;
    end if;

    insert into public.ausruestungs_anfragen
      (schiedsrichter_id, typ, kategorie, farbe, groesse, aermellaenge,
       anmerkung, beschaffungsweg, preis_schiri_cent, buendel_id, buendel_position)
    values
      (p_schiedsrichter_id, 'ausruestung', v_kategorie, v_farbe, v_groesse,
       v_aermel, v_anmerkung, p_beschaffungsweg, v_preis, v_id, v_nummer);
  end loop;

  return v_id;
end;
$function$;

revoke all on function public.schiri_ausruestungsbuendel_erstellen(
  uuid,text,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.schiri_ausruestungsbuendel_erstellen(
  uuid,text,uuid,jsonb,text,text) to anon,authenticated;

-- Metadaten getrennt von den bestehenden Listen-RPCs: deren Rueckgabetyp
-- bleibt kompatibel mit App und alter Website.
create function public.schiri_ausruestungsbuendel_zuordnung(
  p_schiedsrichter_id uuid, p_pin text
)
returns table(anfrage_id uuid, buendel_id uuid, buendel_position smallint,
              gesamt_anmerkung text, positionen_anzahl smallint, erstellt_am timestamptz)
language plpgsql security definer set search_path to ''
as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
    select a.id, b.id, a.buendel_position, b.gesamt_anmerkung,
           b.positionen_anzahl, b.erstellt_am
      from public.ausruestungs_buendel b
      join public.ausruestungs_anfragen a on a.buendel_id = b.id
     where b.schiedsrichter_id = p_schiedsrichter_id
     order by b.erstellt_am desc, a.buendel_position;
end;
$function$;

revoke all on function public.schiri_ausruestungsbuendel_zuordnung(uuid,text)
  from public,anon,authenticated;
grant execute on function public.schiri_ausruestungsbuendel_zuordnung(uuid,text)
  to anon,authenticated;

create function public.obmann_ausruestungsbuendel_zuordnung(p_passwort text)
returns table(anfrage_id uuid, buendel_id uuid, buendel_position smallint,
              gesamt_anmerkung text, positionen_anzahl smallint, erstellt_am timestamptz)
language plpgsql security definer set search_path to ''
as $function$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query
    select a.id, b.id, a.buendel_position, b.gesamt_anmerkung,
           b.positionen_anzahl, b.erstellt_am
      from public.ausruestungs_buendel b
      join public.schiedsrichter s on s.id = b.schiedsrichter_id
      join public.ausruestungs_anfragen a on a.buendel_id = b.id
     where s.verein_id = v_verein
     order by b.erstellt_am desc, a.buendel_position;
end;
$function$;

revoke all on function public.obmann_ausruestungsbuendel_zuordnung(text)
  from public,anon,authenticated;
grant execute on function public.obmann_ausruestungsbuendel_zuordnung(text)
  to anon,authenticated;

-- Tom sieht nur Gruppenpositionen, die bereits vorgelegt wurden. Der
-- Dauerzugang sieht alle Vorlagen seines Vereins; ein befristeter Link nur
-- seinen Stapel. Die Zuordnung aendert keine Entscheidungsrechte.
create function public.freigabe_ausruestungsbuendel_zuordnung(p_token text)
returns table(anfrage_id uuid, buendel_id uuid, buendel_position smallint,
              gesamt_anmerkung text, positionen_anzahl smallint, erstellt_am timestamptz)
language plpgsql security definer set search_path to ''
as $function$
declare v_verein uuid; v_link uuid; v_art text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;
  return query
    select a.id, b.id, a.buendel_position, b.gesamt_anmerkung,
           b.positionen_anzahl, b.erstellt_am
      from public.ausruestungs_buendel b
      join public.schiedsrichter s on s.id = b.schiedsrichter_id
      join public.ausruestungs_anfragen a on a.buendel_id = b.id
     where s.verein_id = v_verein
       and a.vorlage_am is not null
       and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link)
     order by b.erstellt_am desc, a.buendel_position;
end;
$function$;

revoke all on function public.freigabe_ausruestungsbuendel_zuordnung(text)
  from public,anon,authenticated;
grant execute on function public.freigabe_ausruestungsbuendel_zuordnung(text)
  to anon,authenticated;

-- Der Obmann kann eine ganze neue Anfrage in EINEM Vorgang vorlegen.
-- Jede Position wird weiter einzeln entschieden; wenn eine Position nicht
-- vorgelegt werden kann (z. B. Preis fehlt), wird alles zurueckgerollt.
create function public.obmann_ausruestungsbuendel_vorlegen(
  p_passwort text, p_buendel_id uuid, p_link_id uuid default null
)
returns integer
language plpgsql security definer set search_path to ''
as $function$
declare v_verein uuid; v_anzahl integer := 0; v_id uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1
    from public.ausruestungs_buendel b
    join public.schiedsrichter s on s.id = b.schiedsrichter_id
   where b.id = p_buendel_id and s.verein_id = v_verein;
  if not found then raise exception 'Anfrage nicht gefunden.'; end if;

  for v_id in
    select a.id from public.ausruestungs_anfragen a
     where a.buendel_id = p_buendel_id
       and a.freigabe_status = 'nicht_vorgelegt'
     order by a.buendel_position
  loop
    perform public.obmann_anfrage_vorlegen(p_passwort, v_id, p_link_id);
    v_anzahl := v_anzahl + 1;
  end loop;
  if v_anzahl = 0 then raise exception 'Es gibt keine offene Position zum Vorlegen.'; end if;
  return v_anzahl;
end;
$function$;

revoke all on function public.obmann_ausruestungsbuendel_vorlegen(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_ausruestungsbuendel_vorlegen(text,uuid,uuid)
  to anon,authenticated;

-- Nur die erste Position erscheint als Eingang und erzeugt die eine
-- Obmann-Mail. Die uebrigen Positionen behalten ihre Prozessereignisse.
create or replace function public.ausruestung_anfrage_eroeffnen()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_name text; v_anzahl smallint; v_notiz text;
begin
  if new.typ <> 'ausruestung' then return new; end if;
  select s.name into v_name from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  if new.buendel_id is not null and new.buendel_position = 1 then
    select b.positionen_anzahl into v_anzahl
      from public.ausruestungs_buendel b where b.id = new.buendel_id;
    v_notiz := 'Gemeinsame Anfrage mit ' || v_anzahl || ' Stuecken';
  end if;
  perform public.ausruestung_ereignis_schreiben(
    new.id, 'eingereicht', 'schiri', v_name, v_notiz, new.preis_schiri_cent,
    new.buendel_id is null or new.buendel_position = 1);
  return new;
end;
$function$;

create or replace function public.benachrichtigung_ausruestung_trigger()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  v_typ text;
  v_name text;
  v_anzahl integer;
begin
  if new.akteur_rolle = 'schiri' and new.schritt in
      ('eingereicht', 'gekauft', 'beleg_hochgeladen', 'geld_erhalten') then
    if new.schritt = 'eingereicht' and not new.eingang then return new; end if;
    v_typ := 'ausruestung.' || new.schritt;
  elsif new.akteur_rolle = 'vorstand' and new.schritt in
      ('freigegeben', 'abgelehnt', 'zahlung_angewiesen') then
    v_typ := 'ausruestung.' || new.schritt;
  else
    return new;
  end if;

  select public.benachrichtigung_kurzname(s.name), b.positionen_anzahl
    into v_name, v_anzahl
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
    left join public.ausruestungs_buendel b on b.id = a.buendel_id
   where a.id = new.anfrage_id;

  perform public.benachrichtigung_einreihen(
    new.verein_id, v_typ, 'ausruestungsanfrage', new.anfrage_id,
    'ausruestung:' || new.schluessel,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name, 'anzahl', v_anzahl)));
  return new;
end;
$function$;
