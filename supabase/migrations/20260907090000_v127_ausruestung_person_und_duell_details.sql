-- v127: Zwei Ansichten fuer die Dashboard-App (Max, 06.09.2026)
--
-- 1. AUSRUESTUNG BEIM SCHIEDSRICHTER. Seit v123 pflegen die Schiedsrichter
--    ihren Bestand selbst auf der Website. In der App war davon nichts zu
--    sehen: "dass ich das auch in der App sehen kann und vor allem auch
--    verwalten kann". Dazu die Historie - "was wann bestaetigt wurde und was
--    er wann neu bekommen hat" - und eine Jahresuebersicht.
--
--    Fuer die Historie fehlten die Zeitpunkte. "aktualisiert_am" wird bei
--    JEDER Aenderung ueberschrieben und kann deshalb nicht sagen, wann eine
--    Anfrage entschieden oder abgeholt wurde. Zwei eigene Zeitstempel
--    schliessen die Luecke. Beide Tabellen sind aktuell leer, es geht also
--    nichts verloren und es muss nichts geschaetzt werden.
--
--    Wird eine Anfrage wieder geoeffnet oder die Abholung zurueckgenommen,
--    werden die Zeitpunkte ausdruecklich wieder geleert: ein Datum, das eine
--    Bestaetigung behauptet, die es nicht mehr gibt, waere schlimmer als gar
--    keins.
--
-- 2. DUELL-DETAILS. "Wenn ich jetzt auf ein Duell draufklicke, kann ich da
--    nichts weiter einsehen, nicht, was die Fragen waren, wie das beantwortet
--    wurde." Die Website hat das seit v120 ("duell_verlauf"), aber diese RPC
--    haengt am Zugang eines Teilnehmers. Der Obmann ist kein Teilnehmer,
--    deshalb hier eine eigene, passwortgeschuetzte Fassung. Die Sperre
--    "fremde Antwort erst nach eigener Antwort" gilt hier bewusst NICHT: der
--    Obmann verwaltet die Fragen ohnehin und spielt nicht mit.

alter table public.ausruestungs_anfragen
  add column entschieden_am timestamptz,
  add column abgeholt_am timestamptz;

comment on column public.ausruestungs_anfragen.entschieden_am is
  'Wann die Anfrage den Status offen verlassen hat. Wird beim Wiederoeffnen geleert.';
comment on column public.ausruestungs_anfragen.abgeholt_am is
  'Wann die Abholung bestaetigt wurde. Wird beim Zuruecknehmen geleert.';

-- 1a) Statussetzer fuellt die neuen Zeitpunkte mit. Bewusst chirurgisch:
--     die Funktion hat fuenf Parameter mit Standardwerten, und ein
--     vollstaendig neu getipptes "create or replace" ohne diese Standardwerte
--     wird von Postgres abgelehnt ("cannot remove parameter defaults from
--     existing function"). Aus der vorhandenen Definition heraus zu arbeiten
--     kann diesen Fehler gar nicht erst machen und laesst den Rest der
--     Funktion Zeichen fuer Zeichen unveraendert.
do $mig$
declare
  v_def text;
  v_anker text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'obmann_anfrage_status_setzen';
  if v_def is null then
    raise exception 'obmann_anfrage_status_setzen nicht gefunden';
  end if;

  v_anker := '      schiri_gesehen = false,';
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker im Statussetzer nicht gefunden';
  end if;

  -- Einmal gesetzt, bleibt der Zeitpunkt stehen; beim Wiederoeffnen bzw.
  -- Zuruecknehmen faellt er weg, damit die Historie nichts behauptet, was
  -- nicht mehr gilt.
  v_def := replace(v_def, v_anker,
    $q$      entschieden_am = case
        when p_status = 'offen' then null
        when entschieden_am is null then now()
        else entschieden_am end,
      abgeholt_am = case
        when not coalesce(p_abholung_bestaetigt, abholung_bestaetigt) then null
        when abgeholt_am is null then now()
        else abgeholt_am end,
$q$ || v_anker);

  execute v_def;
end
$mig$;

-- 1b) Alles zu einer Person in einem Aufruf: Bestand, Anfragenhistorie,
--     Jahresuebersicht. Der Zugriff laeuft ueber den Namen, weil die
--     Personenansicht in der App ohnehin mit dem Namen arbeitet.
create or replace function public.obmann_ausruestung_person(
  p_passwort text, p_schiedsrichter text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
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
        'anzahl', b.anzahl, 'zustand', b.zustand, 'anmerkung', b.anmerkung,
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

-- 1c) Bestand vom Obmann aus pflegen. Bewusst dieselbe Tabelle wie die
--     Selbstpflege auf der Website - es gibt einen Bestand pro Person, nicht
--     zwei Listen, die auseinanderlaufen koennen.
create or replace function public.obmann_ausruestungsbestand_speichern(
  p_passwort text, p_schiedsrichter_id uuid, p_kategorie text,
  p_bezeichnung text, p_farbe text, p_groesse text, p_aermellaenge text,
  p_anzahl smallint, p_zustand text, p_anmerkung text, p_id uuid default null
) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_verein uuid;
  v_id uuid;
begin
  v_verein := obmann_verein(p_passwort);

  if not exists (select 1 from schiedsrichter s
                  where s.id = p_schiedsrichter_id and s.verein_id = v_verein) then
    raise exception 'Schiedsrichter nicht gefunden';
  end if;

  if p_id is null then
    insert into ausruestungsbestand(schiedsrichter_id, kategorie, bezeichnung, farbe,
                                    groesse, aermellaenge, anzahl, zustand, anmerkung)
    values (p_schiedsrichter_id, p_kategorie, nullif(btrim(coalesce(p_bezeichnung,'')),''),
            nullif(btrim(coalesce(p_farbe,'')),''), nullif(btrim(coalesce(p_groesse,'')),''),
            nullif(p_aermellaenge,''), coalesce(p_anzahl, 1::smallint),
            coalesce(nullif(p_zustand,''), 'einsatzbereit'),
            nullif(btrim(coalesce(p_anmerkung,'')),''))
    returning id into v_id;
    return v_id;
  end if;

  update ausruestungsbestand b
     set kategorie = p_kategorie,
         bezeichnung = nullif(btrim(coalesce(p_bezeichnung,'')),''),
         farbe = nullif(btrim(coalesce(p_farbe,'')),''),
         groesse = nullif(btrim(coalesce(p_groesse,'')),''),
         aermellaenge = nullif(p_aermellaenge,''),
         anzahl = coalesce(p_anzahl, b.anzahl),
         zustand = coalesce(nullif(p_zustand,''), b.zustand),
         anmerkung = nullif(btrim(coalesce(p_anmerkung,'')),''),
         aktualisiert_am = now()
   where b.id = p_id
     and b.schiedsrichter_id = p_schiedsrichter_id
   returning b.id into v_id;

  if v_id is null then
    raise exception 'Bestandseintrag nicht gefunden';
  end if;
  return v_id;
end;
$$;

create or replace function public.obmann_ausruestungsbestand_loeschen(
  p_passwort text, p_id uuid
) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);
  delete from ausruestungsbestand b
   where b.id = p_id
     and exists (select 1 from schiedsrichter s
                  where s.id = b.schiedsrichter_id and s.verein_id = v_verein);
  return found;
end;
$$;

-- 2) Duell-Details fuer den Obmann.
create or replace function public.obmann_duell_details(
  p_passwort text, p_session_id uuid
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_verein uuid;
  v_s public.duell_sessions%rowtype;
  v_fragen jsonb := '[]'::jsonb;
  v_frage record;
  v_opts jsonb;
  v_teilnehmer jsonb;
begin
  v_verein := obmann_verein(p_passwort);

  select * into v_s from duell_sessions d
   where d.id = p_session_id and d.verein_id = v_verein;
  if not found then
    raise exception 'Duell nicht gefunden';
  end if;

  for v_frage in
    select df.position, f.id as frage_id, f.frage_text, f.medium, f.antworttyp,
           f.musterantwort, f.option_a, f.option_b, f.option_c
      from duell_fragen df join fragen f on f.id = df.frage_id
     where df.session_id = v_s.id
     order by df.position
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'schluessel', o.schluessel, 'text', o.text, 'ist_richtig', o.ist_richtig)
             order by o.position),
           jsonb_strip_nulls(jsonb_build_array(
             jsonb_build_object('schluessel','a','text',v_frage.option_a),
             jsonb_build_object('schluessel','b','text',v_frage.option_b),
             jsonb_build_object('schluessel','c','text',v_frage.option_c))))
      into v_opts
      from frage_antwortoptionen o where o.frage_id = v_frage.frage_id;

    select jsonb_agg(jsonb_build_object(
             'name', t.anzeigename,
             'beantwortet', (a.teilnehmer_id is not null),
             'korrekt', a.korrekt,
             'status', a.bewertungsstatus,
             'auswahl', a.gegebene_auswahl,
             'freitext', a.gegebener_freitext,
             'zweiter_freitext', a.zweiter_freitext,
             'beantwortet_am', a.beantwortet_am)
             order by t.beigetreten_am)
      into v_teilnehmer
      from duell_teilnehmer t
      left join duell_antworten a
        on a.teilnehmer_id = t.id and a.frage_id = v_frage.frage_id
     where t.session_id = v_s.id;

    v_fragen := v_fragen || jsonb_build_array(jsonb_build_object(
      'position', v_frage.position,
      'frage_id', v_frage.frage_id,
      'frage_text', v_frage.frage_text,
      'medium', v_frage.medium,
      'antworttyp', v_frage.antworttyp,
      'musterantwort', v_frage.musterantwort,
      'antwortoptionen', v_opts,
      'teilnehmer', v_teilnehmer));
  end loop;

  return jsonb_build_object(
    'id', v_s.id,
    'code', v_s.code,
    'status', v_s.status,
    'erstellt_am', v_s.erstellt_am,
    'geschlossen_am', v_s.geschlossen_am,
    'ersteller', (select s.name from schiedsrichter s where s.id = v_s.erstellt_von),
    'teilnehmer', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.anzeigename,
        'ist_mitglied', (t.schiedsrichter_id is not null),
        'beigetreten_am', t.beigetreten_am,
        'beantwortet', coalesce(x.beantwortet, 0),
        'richtig', coalesce(x.richtig, 0))
        order by coalesce(x.richtig,0) desc, coalesce(x.beantwortet,0) desc, t.beigetreten_am)
      from duell_teilnehmer t
      left join lateral (
        select count(*)::int as beantwortet,
               count(*) filter (where korrekt)::int as richtig
          from duell_antworten where teilnehmer_id = t.id) x on true
      where t.session_id = v_s.id), '[]'::jsonb),
    'fragen', v_fragen);
end;
$$;

revoke all on function public.obmann_ausruestung_person(text,text) from public, anon, authenticated;
grant execute on function public.obmann_ausruestung_person(text,text) to anon;

revoke all on function public.obmann_ausruestungsbestand_speichern(text,uuid,text,text,text,text,text,smallint,text,text,uuid) from public, anon, authenticated;
grant execute on function public.obmann_ausruestungsbestand_speichern(text,uuid,text,text,text,text,text,smallint,text,text,uuid) to anon;

revoke all on function public.obmann_ausruestungsbestand_loeschen(text,uuid) from public, anon, authenticated;
grant execute on function public.obmann_ausruestungsbestand_loeschen(text,uuid) to anon;

revoke all on function public.obmann_duell_details(text,uuid) from public, anon, authenticated;
grant execute on function public.obmann_duell_details(text,uuid) to anon;
