-- ============================================================
--  v145 - Richtpreise und die Freigabe durch den Vorstand
-- ------------------------------------------------------------
--  Hinweis zur Nummer: eingespielt wurde dieser Stand am
--  16.09.2026 unter den Namen v141a bis v141e - v141 und v142
--  waren zu diesem Zeitpunkt in einer parallel laufenden Sitzung
--  schon vergeben und tauchten erst danach hier auf. Die Datei
--  traegt deshalb v145; in der Supabase-Historie stehen die
--  alten Namen.
-- ============================================================
--  Das Problem, das hier geloest wird, ist kein technisches:
--  Der Obmann darf ueber Vereinsgeld nicht allein entscheiden.
--  Bisher endete eine Ausruestungsanfrage bei ihm - und damit in
--  einer Zusage, die er gar nicht geben darf.
--
--  Drei Bausteine:
--
--  1. EIN PREISKATALOG je Verein. Damit steht an jeder Anfrage
--     eine Hausnummer, ohne dass jemand nachschlagen muss. Der
--     Richtwert wird beim Anlegen der Anfrage als SCHNAPPSCHUSS
--     mitgeschrieben (Trigger), nicht spaeter nachgeschlagen:
--     aendert der Obmann den Katalog, sollen alte Anfragen den
--     Preis behalten, mit dem sie freigegeben wurden.
--
--  2. DREI PREISFELDER an der Anfrage, in dieser Rangfolge:
--     preis_final_cent (Obmann korrigiert) schlaegt
--     preis_schiri_cent (der Schiri weiss, was er kaufen will)
--     schlaegt preis_richtwert_cent (der Katalog).
--     Absichtlich drei Felder statt einem: sonst weiss hinterher
--     niemand mehr, ob die 42 Euro geschaetzt oder belegt waren.
--
--  3. EIN FREIGABELINK fuer ein Vorstandsmitglied. Bewusst OHNE
--     Konto: die Huerde "Registrieren plus 2FAS einrichten" ist
--     genau die Stelle, an der so etwas einschlaeft. Dafuer:
--     - im Klartext existiert der Token nur einmal, beim Erzeugen;
--       gespeichert wird ausschliesslich sein SHA-256-Abdruck
--     - jeder Link hat ein Ablaufdatum und ist widerrufbar
--     - jede Entscheidung wird mit Zeitpunkt und selbst
--       eingetragenem Namen protokolliert
--     Wer den Link weitergibt, gibt den Zugang weiter - das ist
--     der bewusst gezahlte Preis. Er zeigt nur offene Anfragen
--     mit Name, Stueck und Preis, sonst nichts.
-- ============================================================

-- ------------------------------------------------------------
--  1. Preiskatalog
-- ------------------------------------------------------------
create table if not exists public.ausruestung_preise (
  verein_id       uuid not null references public.vereine(id) on delete cascade,
  kategorie       text not null,
  bezeichnung     text not null,
  -- null heisst ausdruecklich "noch kein Richtwert bekannt" und
  -- nicht "kostenlos". Die Oberflaeche zeigt dann einen Strich.
  richtwert_cent  integer check (richtwert_cent >= 0 and richtwert_cent <= 500000),
  aktiv           boolean not null default true,
  aktualisiert_am timestamptz not null default now(),
  primary key (verein_id, kategorie)
);
alter table public.ausruestung_preise enable row level security;

-- ------------------------------------------------------------
--  2. Preis- und Freigabefelder an der Anfrage
-- ------------------------------------------------------------
alter table public.ausruestungs_anfragen
  add column if not exists preis_richtwert_cent integer,
  add column if not exists preis_schiri_cent    integer,
  add column if not exists preis_final_cent     integer,
  add column if not exists freigabe_status      text not null default 'nicht_vorgelegt',
  add column if not exists freigabe_notiz       text,
  add column if not exists freigabe_name        text,
  add column if not exists freigabe_am          timestamptz;

alter table public.ausruestungs_anfragen
  drop constraint if exists ausruestungs_anfragen_freigabe_status_check;
alter table public.ausruestungs_anfragen
  add constraint ausruestungs_anfragen_freigabe_status_check
  check (freigabe_status in ('nicht_vorgelegt','vorgelegt','freigegeben','abgelehnt'));

-- ------------------------------------------------------------
--  3. Richtwert beim Anlegen einfrieren
-- ------------------------------------------------------------
create or replace function public.ausruestung_richtwert_setzen()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  if new.typ <> 'ausruestung' or new.kategorie is null then
    return new;
  end if;
  -- Ein bereits mitgegebener Wert wird nicht ueberschrieben.
  if new.preis_richtwert_cent is not null then
    return new;
  end if;
  select s.verein_id into v_verein
    from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  select p.richtwert_cent into new.preis_richtwert_cent
    from public.ausruestung_preise p
   where p.verein_id = v_verein and p.kategorie = new.kategorie and p.aktiv;
  return new;
end;
$$;

drop trigger if exists ausruestung_richtwert on public.ausruestungs_anfragen;
create trigger ausruestung_richtwert
  before insert on public.ausruestungs_anfragen
  for each row execute function public.ausruestung_richtwert_setzen();

-- ------------------------------------------------------------
--  4. Freigabelinks
-- ------------------------------------------------------------
create table if not exists public.freigabe_links (
  id                 uuid primary key default gen_random_uuid(),
  verein_id          uuid not null references public.vereine(id) on delete cascade,
  -- Nur der Abdruck. Wer die Datenbank liest, kann den Link nicht benutzen.
  token_abdruck      text not null unique,
  beschriftung       text,
  erstellt_am        timestamptz not null default now(),
  gueltig_bis        timestamptz not null,
  widerrufen_am      timestamptz,
  zuletzt_genutzt_am timestamptz
);
alter table public.freigabe_links enable row level security;
create index if not exists freigabe_links_verein on public.freigabe_links(verein_id);

-- ------------------------------------------------------------
--  5. Katalog fuellen
-- ------------------------------------------------------------
--  Die drei Werte sind Max' Angaben vom 16.09.2026 und
--  ausdruecklich RICHTWERTE - er korrigiert sie im Obmann-
--  Bereich, sobald die echten Preise vorliegen. Alle uebrigen
--  Kategorien werden mit null angelegt, damit sie im Editor
--  auftauchen und nicht vergessen werden.
insert into public.ausruestung_preise (verein_id, kategorie, bezeichnung, richtwert_cent)
select v.id, k.kategorie, k.bezeichnung, k.cent
from public.vereine v
cross join (values
  ('trikot',             'Schiedsrichter-Trikot', 3500),
  ('hose',               'Hose',                  2000),
  ('stutzen',            'Stutzen',                800),
  ('schuhe',             'Schuhe',                null),
  ('spielnotizkarten',   'Spielnotizkarten',      null),
  ('spesenquittungen',   'Spesenquittungen',      null),
  ('schiedsrichtermappe','Schiedsrichtermappe',   null),
  ('gelbe_karte',        'Gelbe Karte',           null),
  ('rote_karte',         'Rote Karte',            null),
  ('pfeife',             'Pfeife',                null),
  ('headset',            'Headset',               null),
  ('funkfahnen',         'Funkfahnen',            null),
  ('schiedsrichterfahnen','Schiedsrichterfahnen', null),
  ('sporttasche',        'Sporttasche',           null),
  ('sonstiges',          'Sonstiges',             null)
) as k(kategorie, bezeichnung, cent)
on conflict (verein_id, kategorie) do nothing;

-- ------------------------------------------------------------
--  6. Preise lesen und pflegen
-- ------------------------------------------------------------
create or replace function public.schiri_ausruestung_preise(
  p_schiedsrichter_id uuid, p_pin text)
returns table(kategorie text, bezeichnung text, richtwert_cent integer)
language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select s.verein_id into v_verein
    from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  return query select p.kategorie, p.bezeichnung, p.richtwert_cent
    from public.ausruestung_preise p
   where p.verein_id = v_verein and p.aktiv
   order by p.bezeichnung;
end;
$$;

create or replace function public.obmann_ausruestung_preise(p_passwort text)
returns table(kategorie text, bezeichnung text, richtwert_cent integer,
              aktiv boolean, aktualisiert_am timestamptz)
language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select p.kategorie, p.bezeichnung, p.richtwert_cent, p.aktiv, p.aktualisiert_am
    from public.ausruestung_preise p where p.verein_id = v_verein order by p.bezeichnung;
end;
$$;

create or replace function public.obmann_ausruestung_preis_speichern(
  p_passwort text, p_kategorie text, p_bezeichnung text,
  p_richtwert_cent integer, p_aktiv boolean default true)
returns void language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  if char_length(btrim(coalesce(p_bezeichnung,''))) < 2 then
    raise exception 'Die Bezeichnung fehlt.';
  end if;
  if p_richtwert_cent is not null and (p_richtwert_cent < 0 or p_richtwert_cent > 500000) then
    raise exception 'Der Richtwert liegt ausserhalb des zulaessigen Bereichs.';
  end if;
  insert into public.ausruestung_preise(verein_id, kategorie, bezeichnung, richtwert_cent, aktiv)
  values (v_verein, p_kategorie, btrim(p_bezeichnung), p_richtwert_cent, coalesce(p_aktiv, true))
  on conflict (verein_id, kategorie) do update
    set bezeichnung = excluded.bezeichnung,
        richtwert_cent = excluded.richtwert_cent,
        aktiv = excluded.aktiv,
        aktualisiert_am = now();
end;
$$;

-- Der Obmann korrigiert den Preis einer einzelnen Anfrage.
create or replace function public.obmann_anfrage_preis_setzen(
  p_passwort text, p_id uuid, p_preis_final_cent integer)
returns void language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  if p_preis_final_cent is not null and (p_preis_final_cent < 0 or p_preis_final_cent > 500000) then
    raise exception 'Der Betrag liegt ausserhalb des zulaessigen Bereichs.';
  end if;
  update public.ausruestungs_anfragen a
     set preis_final_cent = p_preis_final_cent
   where a.id = p_id
     and exists (select 1 from public.schiedsrichter s
                  where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
end;
$$;

-- ------------------------------------------------------------
--  7. Anfragen dem Vorstand vorlegen
-- ------------------------------------------------------------
create or replace function public.obmann_anfrage_vorlegen(
  p_passwort text, p_id uuid, p_vorlegen boolean default true)
returns void language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.ausruestungs_anfragen a
     set freigabe_status = case when p_vorlegen then 'vorgelegt' else 'nicht_vorgelegt' end,
         -- Zurueckziehen loescht eine frueher getroffene Entscheidung,
         -- damit nicht spaeter eine alte Freigabe an einer geaenderten
         -- Anfrage klebt.
         freigabe_notiz = null, freigabe_name = null, freigabe_am = null
   where a.id = p_id
     and a.typ = 'ausruestung'
     and a.freigabe_status in ('nicht_vorgelegt','vorgelegt')
     and exists (select 1 from public.schiedsrichter s
                  where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
end;
$$;

-- ------------------------------------------------------------
--  8. Freigabelinks erzeugen, auflisten, widerrufen
-- ------------------------------------------------------------
create or replace function public.obmann_freigabe_link_erstellen(
  p_passwort text, p_tage integer default 30, p_beschriftung text default null)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_verein uuid;
  v_token  text;
  v_tage   integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  v_tage := least(greatest(coalesce(p_tage, 30), 1), 365);
  -- 32 Zufallsbytes, urlsicher kodiert. Das ist der einzige
  -- Moment, in dem der Token im Klartext existiert.
  v_token := replace(replace(replace(
    encode(extensions.gen_random_bytes(32), 'base64'), '+','-'), '/','_'), '=','');
  insert into public.freigabe_links(verein_id, token_abdruck, beschriftung, gueltig_bis)
  values (v_verein,
          encode(extensions.digest(v_token, 'sha256'), 'hex'),
          nullif(btrim(coalesce(p_beschriftung,'')), ''),
          now() + (v_tage || ' days')::interval);
  return v_token;
end;
$$;

create or replace function public.obmann_freigabe_links(p_passwort text)
returns table(id uuid, beschriftung text, erstellt_am timestamptz,
              gueltig_bis timestamptz, widerrufen_am timestamptz,
              zuletzt_genutzt_am timestamptz)
language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select l.id, l.beschriftung, l.erstellt_am, l.gueltig_bis,
                      l.widerrufen_am, l.zuletzt_genutzt_am
    from public.freigabe_links l where l.verein_id = v_verein
    order by l.erstellt_am desc;
end;
$$;

create or replace function public.obmann_freigabe_link_widerrufen(
  p_passwort text, p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.freigabe_links l set widerrufen_am = now()
   where l.id = p_id and l.verein_id = v_verein and l.widerrufen_am is null;
end;
$$;

-- ------------------------------------------------------------
--  9. Die Sicht des Vorstands
-- ------------------------------------------------------------
--  Prueft den Token und gibt den Verein zurueck. Eine Funktion,
--  damit die beiden folgenden nicht zweimal dieselbe Pruefung
--  mit womoeglich unterschiedlicher Strenge machen.
create or replace function public.freigabe_verein(p_token text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  select l.verein_id into v_verein from public.freigabe_links l
   where l.token_abdruck = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
     and l.widerrufen_am is null
     and l.gueltig_bis > now();
  if v_verein is null then
    raise exception 'Dieser Freigabe-Link ist nicht mehr gueltig.';
  end if;
  return v_verein;
end;
$$;

create or replace function public.freigabe_uebersicht(p_token text)
returns table(id uuid, person text, bezeichnung text, kategorie text,
              farbe text, groesse text, aermellaenge text, anmerkung text,
              preis_cent integer, preis_quelle text,
              erstellt_am timestamptz, freigabe_status text,
              freigabe_notiz text, freigabe_name text, freigabe_am timestamptz)
language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.freigabe_verein(p_token);
  update public.freigabe_links l set zuletzt_genutzt_am = now()
   where l.token_abdruck = encode(extensions.digest(p_token, 'sha256'), 'hex');

  return query
    select a.id, s.name, coalesce(pr.bezeichnung, a.kategorie), a.kategorie,
           a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           coalesce(a.preis_final_cent, a.preis_schiri_cent, a.preis_richtwert_cent),
           case when a.preis_final_cent  is not null then 'obmann'
                when a.preis_schiri_cent is not null then 'schiri'
                when a.preis_richtwert_cent is not null then 'richtwert'
                else 'unbekannt' end,
           a.erstellt_am, a.freigabe_status, a.freigabe_notiz,
           a.freigabe_name, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.freigabe_status <> 'nicht_vorgelegt'
     -- Unentschiedenes zuerst, sonst sucht man es unter den erledigten.
     order by (a.freigabe_status = 'vorgelegt') desc, a.erstellt_am;
end;
$$;

create or replace function public.freigabe_entscheiden(
  p_token text, p_id uuid, p_entscheidung text,
  p_name text, p_notiz text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.freigabe_verein(p_token);
  if p_entscheidung not in ('freigegeben','abgelehnt') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if char_length(btrim(coalesce(p_name,''))) < 2 then
    raise exception 'Bitte tragen Sie Ihren Namen ein.';
  end if;
  update public.ausruestungs_anfragen a
     set freigabe_status = p_entscheidung,
         freigabe_name   = btrim(p_name),
         freigabe_notiz  = nullif(btrim(coalesce(p_notiz,'')), ''),
         freigabe_am     = now()
   where a.id = p_id
     and a.typ = 'ausruestung'
     -- Nur was auch wirklich vorgelegt wurde. Ein Link erlaubt
     -- damit nie, etwas zu entscheiden, das niemand vorgelegt hat.
     and a.freigabe_status = 'vorgelegt'
     and exists (select 1 from public.schiedsrichter s
                  where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
  if not found then
    raise exception 'Diese Anfrage steht nicht (mehr) zur Entscheidung.';
  end if;
end;
$$;

-- ------------------------------------------------------------
--  10. Rechte
-- ------------------------------------------------------------
--  Die Tabellen bleiben wie alle anderen ohne Policy: erreichbar
--  ist ausschliesslich, was diese Funktionen herausgeben.
revoke all on function public.schiri_ausruestung_preise(uuid, text) from public;
revoke all on function public.obmann_ausruestung_preise(text) from public;
revoke all on function public.obmann_ausruestung_preis_speichern(text, text, text, integer, boolean) from public;
revoke all on function public.obmann_anfrage_preis_setzen(text, uuid, integer) from public;
revoke all on function public.obmann_anfrage_vorlegen(text, uuid, boolean) from public;
revoke all on function public.obmann_freigabe_link_erstellen(text, integer, text) from public;
revoke all on function public.obmann_freigabe_links(text) from public;
revoke all on function public.obmann_freigabe_link_widerrufen(text, uuid) from public;
revoke all on function public.freigabe_uebersicht(text) from public;
revoke all on function public.freigabe_entscheiden(text, uuid, text, text, text) from public;
-- freigabe_verein ist ein Baustein und wird nie von aussen gerufen.
revoke all on function public.freigabe_verein(text) from public;

grant execute on function public.schiri_ausruestung_preise(uuid, text) to anon;
grant execute on function public.obmann_ausruestung_preise(text) to anon;
grant execute on function public.obmann_ausruestung_preis_speichern(text, text, text, integer, boolean) to anon;
grant execute on function public.obmann_anfrage_preis_setzen(text, uuid, integer) to anon;
grant execute on function public.obmann_anfrage_vorlegen(text, uuid, boolean) to anon;
grant execute on function public.obmann_freigabe_link_erstellen(text, integer, text) to anon;
grant execute on function public.obmann_freigabe_links(text) to anon;
grant execute on function public.obmann_freigabe_link_widerrufen(text, uuid) to anon;
grant execute on function public.freigabe_uebersicht(text) to anon;
grant execute on function public.freigabe_entscheiden(text, uuid, text, text, text) to anon;

-- ------------------------------------------------------------
--  11. Der Schiri darf seinen eigenen Preis mitgeben
-- ------------------------------------------------------------
--  Neuer Parameter, also drop+create statt create or replace:
--  bei abweichender Parameterzahl entstuende sonst eine zweite
--  Ueberladung, und PostgREST waehlt dann nach Tageslaune.
drop function if exists public.schiri_anfrage_erstellen(uuid, text, text, text, text, text, text, text, text);

create function public.schiri_anfrage_erstellen(
  p_schiedsrichter_id uuid, p_pin text, p_kategorie text,
  p_farbe text default null, p_groesse text default null,
  p_aermellaenge text default null, p_anmerkung text default null,
  p_typ text default 'ausruestung', p_beschaffungsweg text default 'weg2_schiri_besorgt',
  p_preis_schiri_cent integer default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_id uuid;
  v_beschaffungsweg text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if p_typ not in ('ausruestung', 'anliegen') then
    raise exception 'Ungueltiger Typ: %', p_typ;
  end if;

  if p_typ = 'ausruestung' then
    if p_kategorie not in (
      'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
      'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
      'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
    ) then
      raise exception 'Ungueltige Kategorie: %', p_kategorie;
    end if;

    if p_aermellaenge is not null and
       (p_kategorie <> 'trikot' or p_aermellaenge not in ('kurz','lang')) then
      raise exception 'Ungueltige Aermellaenge.';
    end if;

    if p_kategorie = 'sonstiges' and
       char_length(btrim(coalesce(p_anmerkung, ''))) < 2 then
      raise exception 'Bitte das benoetigte Equipment beschreiben.';
    end if;

    if p_preis_schiri_cent is not null and
       (p_preis_schiri_cent < 0 or p_preis_schiri_cent > 500000) then
      raise exception 'Der angegebene Preis liegt ausserhalb des zulaessigen Bereichs.';
    end if;

    v_beschaffungsweg := coalesce(
      nullif(btrim(p_beschaffungsweg), ''),
      'weg2_schiri_besorgt'
    );
    if v_beschaffungsweg not in ('weg1_obmann_besorgt', 'weg2_schiri_besorgt') then
      raise exception 'Ungueltiger Beschaffungsweg: %', v_beschaffungsweg;
    end if;

    insert into public.ausruestungs_anfragen(
      schiedsrichter_id, typ, kategorie, farbe, groesse, aermellaenge,
      anmerkung, beschaffungsweg, preis_schiri_cent
    ) values (
      p_schiedsrichter_id, 'ausruestung', p_kategorie,
      nullif(btrim(p_farbe), ''), nullif(btrim(p_groesse), ''),
      p_aermellaenge, nullif(btrim(p_anmerkung), ''), v_beschaffungsweg,
      p_preis_schiri_cent
    ) returning id into v_id;
  else
    if char_length(btrim(coalesce(p_anmerkung, ''))) = 0 then
      raise exception 'Anliegen braucht eine Beschreibung';
    end if;

    insert into public.ausruestungs_anfragen(
      schiedsrichter_id, typ, kategorie, farbe, groesse, aermellaenge,
      anmerkung, beschaffungsweg
    ) values (
      p_schiedsrichter_id, 'anliegen', null, null, null, null,
      btrim(p_anmerkung), null
    ) returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.schiri_anfrage_erstellen(uuid, text, text, text, text, text, text, text, text, integer) from public;
grant execute on function public.schiri_anfrage_erstellen(uuid, text, text, text, text, text, text, text, text, integer) to anon;

-- ------------------------------------------------------------
--  12. Schlanke Anfragenliste fuer den Obmann-Bereich
-- ------------------------------------------------------------
--  Absichtlich nicht obmann_anfragen_liste erweitert: die traegt
--  das Rechnungsbild als base64 mit und wird von der SwiftUI-App
--  dekodiert. Hier braucht es nur Name, Stueck, Preis und Stand.
create or replace function public.obmann_freigabe_anfragen(p_passwort text)
returns table(id uuid, person text, bezeichnung text, kategorie text,
              farbe text, groesse text, aermellaenge text, anmerkung text,
              status text, erstellt_am timestamptz,
              preis_richtwert_cent integer, preis_schiri_cent integer,
              preis_final_cent integer, preis_cent integer, preis_quelle text,
              freigabe_status text, freigabe_name text,
              freigabe_notiz text, freigabe_am timestamptz)
language plpgsql security definer set search_path to '' as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query
    select a.id, s.name, coalesce(pr.bezeichnung, a.kategorie), a.kategorie,
           a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           a.status, a.erstellt_am,
           a.preis_richtwert_cent, a.preis_schiri_cent, a.preis_final_cent,
           coalesce(a.preis_final_cent, a.preis_schiri_cent, a.preis_richtwert_cent),
           case when a.preis_final_cent  is not null then 'obmann'
                when a.preis_schiri_cent is not null then 'schiri'
                when a.preis_richtwert_cent is not null then 'richtwert'
                else 'unbekannt' end,
           a.freigabe_status, a.freigabe_name, a.freigabe_notiz, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.status not in ('erledigt','abgelehnt','abgeschlossen')
     order by (a.freigabe_status = 'nicht_vorgelegt') desc, a.erstellt_am;
end;
$$;

revoke all on function public.obmann_freigabe_anfragen(text) from public;
grant execute on function public.obmann_freigabe_anfragen(text) to anon;
