-- =====================================================================
-- Bestandsfinanzierung: selbst gekauft, vom Verein bezahlt oder unklar
-- ---------------------------------------------------------------------
-- Bestehende Eintraege bekommen bewusst "unbekannt". Eine nachtraeglich
-- erfundene Finanzierung waere fuer Toms Budgetentscheidung schlechter
-- als eine sichtbare Datenluecke. Alte Clients duerfen weiter ueber die
-- v1-Funktion speichern; neue Web-Clients verwenden die v2-Funktion.
-- =====================================================================

alter table public.ausruestungsbestand
  add column if not exists finanzierung text not null default 'unbekannt';

alter table public.ausruestungsbestand
  drop constraint if exists ausruestungsbestand_finanzierung_check;
alter table public.ausruestungsbestand
  add constraint ausruestungsbestand_finanzierung_check
  check (finanzierung in ('unbekannt', 'selbst', 'verein'));

comment on column public.ausruestungsbestand.finanzierung is
  'Vertrauensangabe des Schiedsrichters: selbst gekauft, vom Verein bezahlt oder bei Altdaten unbekannt.';

create or replace function public.schiri_ausruestungsbestand_speichern_v2(
  p_schiedsrichter_id uuid, p_pin text, p_kategorie text,
  p_finanzierung text,
  p_bezeichnung text default null, p_farbe text default null,
  p_groesse text default null, p_aermellaenge text default null,
  p_anzahl smallint default 1, p_zustand text default 'einsatzbereit',
  p_anmerkung text default null, p_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if p_kategorie not in (
       'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
       'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
       'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
     )
     or p_finanzierung not in ('unbekannt', 'selbst', 'verein')
     or coalesce(p_anzahl, 0) not between 1 and 20
     or p_zustand not in ('einsatzbereit','ersatz','verschlissen','fehlt')
     or (p_aermellaenge is not null and
         (p_kategorie <> 'trikot' or p_aermellaenge not in ('kurz','lang'))) then
    raise exception 'Ungueltige Bestandsangabe.';
  end if;

  if p_kategorie = 'sonstiges' and
     char_length(btrim(coalesce(p_bezeichnung, ''))) not between 2 and 80 then
    raise exception 'Sonstiges Equipment braucht eine Bezeichnung.';
  end if;

  if p_id is null then
    insert into public.ausruestungsbestand(
      schiedsrichter_id, kategorie, finanzierung, bezeichnung, farbe,
      groesse, aermellaenge, anzahl, zustand, anmerkung
    ) values (
      p_schiedsrichter_id, p_kategorie, p_finanzierung,
      nullif(btrim(p_bezeichnung), ''), nullif(btrim(p_farbe), ''),
      nullif(btrim(p_groesse), ''), p_aermellaenge, p_anzahl,
      p_zustand, nullif(btrim(p_anmerkung), '')
    ) returning id into v_id;
  else
    update public.ausruestungsbestand
       set kategorie = p_kategorie,
           finanzierung = p_finanzierung,
           bezeichnung = nullif(btrim(p_bezeichnung), ''),
           farbe = nullif(btrim(p_farbe), ''),
           groesse = nullif(btrim(p_groesse), ''),
           aermellaenge = p_aermellaenge,
           anzahl = p_anzahl,
           zustand = p_zustand,
           anmerkung = nullif(btrim(p_anmerkung), ''),
           aktualisiert_am = now()
     where id = p_id and schiedsrichter_id = p_schiedsrichter_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Bestandseintrag nicht gefunden.';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.schiri_ausruestungsbestand_speichern_v2(
  uuid,text,text,text,text,text,text,text,smallint,text,text,uuid
) from public, anon, authenticated;
grant execute on function public.schiri_ausruestungsbestand_speichern_v2(
  uuid,text,text,text,text,text,text,text,smallint,text,text,uuid
) to anon, authenticated;

-- Toms kategorisierte Bestandsansicht erhaelt dieselbe Angabe. Der
-- Umfang bleibt sonst unveraendert: keine PIN, Kontaktdaten oder Quizdaten.
create or replace function public.freigabe_bestand(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link uuid;
  v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);

  perform 1 from public.freigabe_links l
   where l.id = v_link
     and l.zugangsart = 'dauerhaft'
     and char_length(btrim(coalesce(l.verantwortlicher_name, ''))) >= 2;
  if not found then
    raise exception 'Die Bestandsuebersicht gehoert nur zu einem persoenlichen Dauerzugang.';
  end if;

  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  with personen as (
    select s.id, s.name,
           coalesce(b.anzahl, 0) as anzahl,
           coalesce(b.bestand, '[]'::jsonb) as bestand
      from public.schiedsrichter s
      left join lateral (
        select sum(x.anzahl)::integer as anzahl,
               jsonb_agg(jsonb_build_object(
                 'id', x.id,
                 'kategorie', x.kategorie,
                 'bezeichnung', x.bezeichnung,
                 'farbe', x.farbe,
                 'groesse', x.groesse,
                 'aermellaenge', x.aermellaenge,
                 'anzahl', x.anzahl,
                 'zustand', x.zustand,
                 'finanzierung', x.finanzierung,
                 'anmerkung', x.anmerkung,
                 'aktualisiert_am', x.aktualisiert_am)
                 order by x.kategorie, x.bezeichnung nulls first,
                          x.aktualisiert_am desc) as bestand
          from public.ausruestungsbestand x
         where x.schiedsrichter_id = s.id
      ) b on true
     where s.verein_id = v_verein
       and coalesce(s.aktiv, true)
       and not coalesce(s.ist_test, false)
  )
  select jsonb_build_object(
           'personen', coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id,
             'name', p.name,
             'anzahl', p.anzahl,
             'bestand', p.bestand)
             order by p.name), '[]'::jsonb))
    into v_ergebnis
    from personen p;

  return v_ergebnis;
end;
$$;

revoke all on function public.freigabe_bestand(text) from public;
grant execute on function public.freigabe_bestand(text) to anon;

-- Auch die bestehende Personenansicht der Dashboard-App bekommt die
-- Finanzierung. Swift ignoriert das neue Feld bis zur UI-Erweiterung.
create or replace function public.obmann_ausruestung_person(
  p_passwort text, p_schiedsrichter text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_id uuid;
  v_jahr int := extract(year from now())::int;
begin
  v_verein := obmann_verein(p_passwort);

  select s.id into v_id from schiedsrichter s
   where s.verein_id = v_verein and s.name = p_schiedsrichter;
  if v_id is null then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;

  return jsonb_build_object(
    'schiedsrichter_id', v_id,
    'person', p_schiedsrichter,
    'jahr', v_jahr,
    'bestand', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kategorie', b.kategorie, 'bezeichnung', b.bezeichnung,
        'farbe', b.farbe, 'groesse', b.groesse, 'aermellaenge', b.aermellaenge,
        'anzahl', b.anzahl, 'zustand', b.zustand,
        'finanzierung', b.finanzierung, 'anmerkung', b.anmerkung,
        'aktualisiert_am', b.aktualisiert_am)
        order by b.kategorie, b.bezeichnung)
      from ausruestungsbestand b where b.schiedsrichter_id = v_id), '[]'::jsonb),
    'stueck_gesamt', coalesce((
      select sum(b.anzahl)::int from ausruestungsbestand b
       where b.schiedsrichter_id = v_id), 0),
    'anfragen', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'typ', a.typ, 'kategorie', a.kategorie, 'farbe', a.farbe,
        'groesse', a.groesse, 'aermellaenge', a.aermellaenge,
        'anmerkung', a.anmerkung, 'status', a.status,
        'beschaffungsweg', a.beschaffungsweg, 'notiz_obmann', a.notiz_obmann,
        'abholung_bestaetigt', a.abholung_bestaetigt,
        'erstattet', a.erstattet,
        'erstellt_am', a.erstellt_am,
        'entschieden_am', a.entschieden_am,
        'abgeholt_am', a.abgeholt_am)
        order by a.erstellt_am desc)
      from ausruestungs_anfragen a where a.schiedsrichter_id = v_id), '[]'::jsonb),
    'jahr_angefragt', (
      select count(*)::int from ausruestungs_anfragen a
       where a.schiedsrichter_id = v_id
         and extract(year from a.erstellt_am)::int = v_jahr),
    'jahr_bekommen', (
      select count(*)::int from ausruestungs_anfragen a
       where a.schiedsrichter_id = v_id
         and a.abgeholt_am is not null
         and extract(year from a.abgeholt_am)::int = v_jahr),
    'jahr_offen', (
      select count(*)::int from ausruestungs_anfragen a
       where a.schiedsrichter_id = v_id and a.status = 'offen')
  );
end;
$$;
