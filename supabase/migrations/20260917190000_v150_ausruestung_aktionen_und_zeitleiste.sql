-- =====================================================================
-- v150 - Ausruestungsanfragen: rollenabhaengige Aktionen und die
--        gemeinsame Zeitleiste
-- =====================================================================
--
-- Baut auf dem Prozessvertrag aus v149 auf. Zwei Dinge passieren hier:
--
-- 1. Der frei verstellbare Status-Picker verschwindet. Statt "setze den
--    Status auf irgendwas" gibt es konkrete, benannte Aktionen, und die
--    Datenbank entscheidet, wer sie ausloesen darf. Jede Aktion laeuft
--    durch public.ausruestung_uebergang() - einen zweiten Weg, den
--    Zustand zu aendern, gibt es nicht mehr. Die alte
--    obmann_anfrage_status_setzen bleibt nur noch fuer Anliegen
--    zustaendig und weist Ausruestungsvorgaenge mit einer klaren
--    Meldung ab.
--
-- 2. Es gibt genau EINE serverseitige Prozessliste. Website, Obmann-App
--    und Vorstandsseite lesen dieselben Schritte und stellen sie nur
--    unterschiedlich dar. Vorher hat sich jede Oberflaeche ihre eigene
--    Kette zusammengebaut - genau deshalb liefen sie auseinander.
--
-- Beim Vorlegen werden Betrag UND Anfrageumfang als Schnappschuss
-- eingefroren und der Vorgang wird an genau einen Freigabe-Link
-- gebunden. Ein Link sieht danach nur seinen eigenen Stapel; vorher
-- haette ein laufender Link auch spaeter vorgelegte Anfragen erfasst.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Beschriftungen an einer Stelle
-- ---------------------------------------------------------------------
create or replace function public.ausruestung_schritt_titel(p_schritt text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case p_schritt
    when 'eingereicht'        then 'Angefragt'
    when 'geprueft'           then 'Von mir geprüft'
    when 'vorgelegt'          then 'Dem Vorstand vorgelegt'
    when 'entscheidung'       then 'Entscheidung des Vorstands'
    when 'freigegeben'        then 'Freigegeben'
    when 'abgelehnt'          then 'Abgelehnt'
    when 'zurueckgezogen'     then 'Zurückgezogen'
    when 'gekauft'            then 'Gekauft'
    when 'beleg_hochgeladen'  then 'Beleg hochgeladen'
    when 'beleg_geprueft'     then 'Beleg geprüft'
    when 'zahlung_angewiesen' then 'Zahlung angewiesen'
    when 'geld_erhalten'      then 'Geld erhalten'
    when 'bestellt'           then 'Bestellt'
    when 'eingegangen'        then 'Ware eingegangen'
    when 'uebergeben'         then 'Übergeben'
    when 'abgeschlossen'      then 'Abgeschlossen'
    else p_schritt end;
$$;

revoke all on function public.ausruestung_schritt_titel(text) from public;


-- ---------------------------------------------------------------------
-- 2. Schrittkatalog: welche Schritte hat dieser Weg ueberhaupt?
-- ---------------------------------------------------------------------
create or replace function public.ausruestung_schritt_katalog(p_weg text)
returns table(nr integer, schluessel text, titel text, rolle text)
language sql
stable
set search_path to ''
as $$
  select k.nr, k.schluessel, public.ausruestung_schritt_titel(k.schluessel), k.rolle
    from (
      select * from (values
        (1, 'eingereicht',  'schiri'),
        (2, 'geprueft',     'obmann'),
        (3, 'vorgelegt',    'obmann'),
        (4, 'entscheidung', 'vorstand')
      ) as gemeinsam(nr, schluessel, rolle)
      union all
      select * from (values
        (5,  'gekauft',            'schiri'),
        (6,  'beleg_hochgeladen',  'schiri'),
        (7,  'beleg_geprueft',     'obmann'),
        (8,  'zahlung_angewiesen', 'vorstand'),
        (9,  'geld_erhalten',      'schiri'),
        (10, 'abgeschlossen',      'obmann')
      ) as selbstkauf(nr, schluessel, rolle)
      where coalesce(p_weg, 'weg2_schiri_besorgt') = 'weg2_schiri_besorgt'
      union all
      select * from (values
        (5, 'bestellt',      'obmann'),
        (6, 'eingegangen',   'obmann'),
        (7, 'uebergeben',    'obmann'),
        (8, 'abgeschlossen', 'obmann')
      ) as vereinskauf(nr, schluessel, rolle)
      where coalesce(p_weg, 'weg2_schiri_besorgt') = 'weg1_obmann_besorgt'
    ) k
   order by k.nr;
$$;

revoke all on function public.ausruestung_schritt_katalog(text) from public;


-- ---------------------------------------------------------------------
-- 3. Die gemeinsame Zeitleiste
-- ---------------------------------------------------------------------
-- p_sicht steuert nur, WIE VIEL geliefert wird, nicht WAS gilt:
--   'obmann'   - alles
--   'schiri'   - der eigene Vorgang ohne interne Obmann-Notiz
--   'vorstand' - Schritte und Betrag, keine Ereignis-Freitexte
create or replace function public.ausruestung_prozess_jsonb(p_anfrage uuid, p_sicht text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  a             public.ausruestungs_anfragen%rowtype;
  v_sicht       text := coalesce(p_sicht, 'obmann');
  v_person      text;
  v_bezeichnung text;
  v_weg         text;
  v_erreicht    integer;
  v_letzte      integer;
  v_gestoppt    boolean;
  v_betrag      integer;
  v_quelle      text;
  v_schritte    jsonb := '[]'::jsonb;
  v_ereignisse  jsonb := '[]'::jsonb;
  v_aktionen    jsonb := '[]'::jsonb;
  v_naechster   jsonb := null;
  k             record;
  v_stand       text;
  v_zeit        timestamptz;
  v_wert        text;
begin
  select * into a from public.ausruestungs_anfragen where id = p_anfrage;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  select s.name into v_person
    from public.schiedsrichter s where s.id = a.schiedsrichter_id;

  v_weg := coalesce(a.beschaffungsweg, 'weg2_schiri_besorgt');

  select coalesce(pr.bezeichnung, a.kategorie) into v_bezeichnung
    from public.schiedsrichter s
    left join public.ausruestung_preise pr
           on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
   where s.id = a.schiedsrichter_id;

  -- Der eingefrorene Vorlagebetrag hat immer Vorrang: was der Vorstand
  -- gesehen hat, ist der Betrag, der gilt.
  v_betrag := coalesce(a.vorlage_preis_cent, a.preis_final_cent,
                       a.preis_schiri_cent, a.preis_richtwert_cent);
  v_quelle := case
                when a.vorlage_preis_cent   is not null then 'vorgelegt'
                when a.preis_final_cent     is not null then 'obmann'
                when a.preis_schiri_cent    is not null then 'schiri'
                when a.preis_richtwert_cent is not null then 'richtwert'
                else 'unbekannt' end;

  v_letzte := case when v_weg = 'weg1_obmann_besorgt' then 8 else 10 end;

  v_erreicht := case a.prozess_status
    when 'eingereicht'        then 1
    when 'geprueft'           then 2
    when 'vorgelegt'          then 3
    when 'freigegeben'        then 4
    when 'abgelehnt'          then 4
    when 'zurueckgezogen'     then 1
    when 'gekauft'            then 5
    when 'bestellt'           then 5
    when 'beleg_hochgeladen'  then 6
    when 'eingegangen'        then 6
    when 'beleg_geprueft'     then 7
    when 'uebergeben'         then 7
    when 'zahlung_angewiesen' then 8
    when 'geld_erhalten'      then 9
    when 'abgeschlossen'      then v_letzte
    else 1 end;

  v_gestoppt := a.prozess_status in ('abgelehnt', 'zurueckgezogen');

  for k in select * from public.ausruestung_schritt_katalog(v_weg) loop
    v_zeit := case k.schluessel
      when 'eingereicht'        then a.erstellt_am
      when 'geprueft'           then a.geprueft_am
      when 'vorgelegt'          then a.vorlage_am
      when 'entscheidung'       then a.freigabe_am
      when 'gekauft'            then a.gekauft_am
      when 'beleg_hochgeladen'  then a.rechnung_hochgeladen_am
      when 'beleg_geprueft'     then a.beleg_geprueft_am
      when 'zahlung_angewiesen' then a.zahlung_angewiesen_am
      when 'geld_erhalten'      then a.geld_erhalten_am
      when 'bestellt'           then a.bestellt_am
      when 'eingegangen'        then a.wareneingang_am
      when 'uebergeben'         then a.abgeholt_am
      when 'abgeschlossen'      then a.abgeschlossen_am
      else null end;

    if v_gestoppt and k.nr > v_erreicht then
      v_stand := 'entfaellt';
    elsif v_gestoppt and k.nr = v_erreicht then
      v_stand := 'gestoppt';
    elsif k.nr <= v_erreicht then
      v_stand := 'erledigt';
    elsif k.nr = v_erreicht + 1 then
      v_stand := 'dran';
    else
      v_stand := 'wartet';
    end if;

    -- Wenn gar nichts zu erstatten ist, entfallen die beiden Geldschritte.
    if a.keine_zahlung_faellig
       and k.schluessel in ('zahlung_angewiesen', 'geld_erhalten')
       and v_stand in ('dran', 'wartet') then
      v_stand := 'entfaellt';
    end if;

    v_wert := case k.schluessel
      when 'vorgelegt' then
        case when a.vorlage_preis_cent is not null
             then replace(to_char(a.vorlage_preis_cent / 100.0, 'FM999999990.00'), '.', ',') || ' €'
             else null end
      when 'entscheidung'       then a.freigabe_name
      when 'zahlung_angewiesen' then a.zahlung_angewiesen_von
      when 'geld_erhalten'      then a.geld_erhalten_von
      else null end;

    v_schritte := v_schritte || jsonb_build_object(
      'nr', k.nr,
      'schluessel', k.schluessel,
      'titel', k.titel,
      'rolle', k.rolle,
      'stand', v_stand,
      'zeitpunkt', v_zeit,
      'wert', v_wert);
  end loop;

  -- Welche Aktionen darf genau diese Sicht jetzt ausloesen? Der Client
  -- rendert daraus Knoepfe - er entscheidet nicht selbst, was erlaubt ist.
  select coalesce(jsonb_agg(jsonb_build_object(
           'schritt', u.nach,
           'titel', public.ausruestung_schritt_titel(u.nach)) order by u.nach), '[]'::jsonb)
    into v_aktionen
    from public.ausruestung_uebergaenge() u
   where u.von = a.prozess_status
     and (u.weg = 'beide' or u.weg = v_weg)
     and v_sicht = any(u.rollen);

  select jsonb_build_object('schluessel', x.schluessel, 'titel', x.titel, 'rolle', x.rolle)
    into v_naechster
    from jsonb_to_recordset(v_schritte)
         as x(nr integer, schluessel text, titel text, rolle text, stand text)
   where x.stand = 'dran'
   order by x.nr
   limit 1;

  if v_sicht <> 'vorstand' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'schritt', e.schritt,
             'titel', public.ausruestung_schritt_titel(e.schritt),
             'rolle', e.akteur_rolle,
             'name', e.akteur_name,
             -- Interne Obmann-Notizen sind nichts fuer den
             -- Schiedsrichter. Eine Ablehnungsbegruendung schon.
             'notiz', case when v_sicht = 'schiri'
                             and e.akteur_rolle = 'obmann'
                             and e.schritt <> 'abgelehnt'
                           then null else e.notiz end,
             'betrag_cent', e.betrag_cent,
             'runde', e.runde,
             'erstellt_am', e.erstellt_am) order by e.erstellt_am, e.id), '[]'::jsonb)
      into v_ereignisse
      from public.ausruestung_ereignisse e
     where e.anfrage_id = p_anfrage;
  end if;

  return jsonb_build_object(
    'id', a.id,
    'person', v_person,
    'bezeichnung', coalesce(v_bezeichnung, 'Ausrüstung'),
    'kategorie', a.kategorie,
    'farbe', a.farbe,
    'groesse', a.groesse,
    'aermellaenge', a.aermellaenge,
    'anmerkung', a.anmerkung,
    'weg', v_weg,
    'prozess_status', a.prozess_status,
    'prozess_titel', public.ausruestung_schritt_titel(a.prozess_status),
    'runde', a.prozess_runde,
    'betrag_cent', v_betrag,
    'betrag_quelle', v_quelle,
    'vorlage_preis_cent', a.vorlage_preis_cent,
    'preis_aenderbar', a.prozess_status in ('eingereicht', 'geprueft'),
    'keine_zahlung_faellig', a.keine_zahlung_faellig,
    'beleg_vorhanden', a.rechnung_hochgeladen_am is not null,
    'notiz_obmann', case when v_sicht = 'obmann' then a.notiz_obmann else null end,
    'freigabe_name', a.freigabe_name,
    'freigabe_notiz', a.freigabe_notiz,
    'freigabe_am', a.freigabe_am,
    'erstellt_am', a.erstellt_am,
    'fortschritt', round(least(v_erreicht, v_letzte)::numeric / v_letzte::numeric, 3),
    'naechster_schritt', v_naechster,
    'meine_aktionen', v_aktionen,
    'schritte', v_schritte,
    'ereignisse', v_ereignisse);
end;
$$;

revoke all on function public.ausruestung_prozess_jsonb(uuid, text) from public;


-- ---------------------------------------------------------------------
-- 4. Tuer 1: der Obmann
-- ---------------------------------------------------------------------
-- Pruefen heisst: Betrag und Beschaffungsweg festlegen. Das ist Max'
-- Rolle - pruefen und weiterreichen, nicht freigeben. Liegt der Vorgang
-- schon weiter vorn, faellt er dabei bewusst auf 'geprueft' zurueck und
-- braucht eine neue Freigabe.
create or replace function public.obmann_anfrage_pruefen(
  p_passwort text,
  p_id uuid,
  p_preis_final_cent integer default null,
  p_beschaffungsweg text default null,
  p_notiz text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_status text;
begin
  v_verein := public.obmann_verein(p_passwort);

  if p_preis_final_cent is not null
     and (p_preis_final_cent < 0 or p_preis_final_cent > 500000) then
    raise exception 'Der Betrag liegt ausserhalb des zulaessigen Bereichs.';
  end if;
  if p_beschaffungsweg is not null
     and p_beschaffungsweg not in ('weg1_obmann_besorgt', 'weg2_schiri_besorgt') then
    raise exception 'Unbekannter Beschaffungsweg.';
  end if;

  select a.prozess_status into v_status
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein and a.typ = 'ausruestung';
  if v_status is null then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  -- Erst den Zustand zuruecksetzen, dann aendern. Andersherum wuerde der
  -- Einfrier-Schutz aus v149 zuschlagen - zu Recht.
  if v_status <> 'geprueft' then
    perform public.ausruestung_uebergang(p_id, 'geprueft', 'obmann', null, p_notiz);
  end if;

  update public.ausruestungs_anfragen a
     set preis_final_cent = coalesce(p_preis_final_cent, a.preis_final_cent),
         beschaffungsweg  = coalesce(p_beschaffungsweg, a.beschaffungsweg),
         notiz_obmann     = coalesce(nullif(btrim(coalesce(p_notiz, '')), ''), a.notiz_obmann),
         aktualisiert_am  = now()
   where a.id = p_id;
end;
$$;

-- Bestehender Aufrufname aus dem Web-Obmannbereich, jetzt vertragstreu:
-- eine Preisaenderung nach der Entscheidung erzwingt eine neue Freigabe.
create or replace function public.obmann_anfrage_preis_setzen(
  p_passwort text, p_id uuid, p_preis_final_cent integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.obmann_anfrage_pruefen(p_passwort, p_id, p_preis_final_cent, null, null);
end;
$$;

-- Vorlegen friert ein: Betrag, Umfang, Link.
drop function if exists public.obmann_anfrage_vorlegen(text, uuid, boolean);

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
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

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
       and l.gueltig_bis > now()
     order by l.erstellt_am desc
     limit 1;
  else
    perform 1 from public.freigabe_links l
      where l.id = v_link and l.verein_id = v_verein
        and l.widerrufen_am is null and l.gueltig_bis > now();
    if not found then
      raise exception 'Dieser Freigabe-Link ist nicht (mehr) gueltig.';
    end if;
  end if;
  if v_link is null then
    raise exception 'Es gibt keinen gueltigen Freigabe-Link. Bitte zuerst einen erstellen.';
  end if;

  update public.ausruestungs_anfragen t
     set vorlage_preis_cent = v_betrag,
         vorlage_am         = now(),
         vorlage_link_id    = v_link,
         vorlage_umfang     = jsonb_build_object(
                                'kategorie', t.kategorie,
                                'farbe', t.farbe,
                                'groesse', t.groesse,
                                'aermellaenge', t.aermellaenge,
                                'anmerkung', t.anmerkung,
                                'beschaffungsweg', t.beschaffungsweg,
                                'betrag_cent', v_betrag)
   where t.id = p_id;

  perform public.ausruestung_uebergang(p_id, 'vorgelegt', 'obmann', null, null, v_betrag);
end;
$$;

-- Ablehnen durch den Obmann, BEVOR es zum Vorstand geht. Der Grund ist
-- serverseitig Pflicht - der Schiedsrichter bekommt ihn zu lesen.
create or replace function public.obmann_anfrage_ablehnen(
  p_passwort text, p_id uuid, p_grund text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  perform public.ausruestung_uebergang(p_id, 'abgelehnt', 'obmann', null, p_grund);
end;
$$;

-- Alle uebrigen Schritte, die Max setzen darf: EINE Funktion mit fester
-- Whitelist konkreter Schritte - kein freier Status.
create or replace function public.obmann_anfrage_schritt(
  p_passwort text,
  p_id uuid,
  p_schritt text,
  p_notiz text default null,
  p_name text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);

  if p_schritt not in ('eingereicht', 'geprueft', 'gekauft', 'beleg_geprueft',
                       'zahlung_angewiesen', 'geld_erhalten', 'bestellt',
                       'eingegangen', 'uebergeben', 'abgeschlossen', 'zurueckgezogen') then
    raise exception 'Diesen Schritt kann der Obmann nicht setzen.';
  end if;

  perform 1 from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  perform public.ausruestung_uebergang(p_id, p_schritt, 'obmann', p_name, p_notiz);
end;
$$;

-- "Nichts zu erstatten" ist eine Angabe am Vorgang, kein Prozessschritt.
create or replace function public.obmann_anfrage_keine_zahlung(
  p_passwort text, p_id uuid, p_wert boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.ausruestungs_anfragen a
     set keine_zahlung_faellig = coalesce(p_wert, false),
         aktualisiert_am = now()
   where a.id = p_id
     and exists (select 1 from public.schiedsrichter s
                  where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
end;
$$;

create or replace function public.obmann_anfrage_prozess(p_passwort text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  return public.ausruestung_prozess_jsonb(p_id, 'obmann');
end;
$$;

-- Die Arbeitsliste: handlungsbeduerftige Vorgaenge zuerst.
create or replace function public.obmann_prozess_liste(p_passwort text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_liste  jsonb;
begin
  v_verein := public.obmann_verein(p_passwort);
  select coalesce(jsonb_agg(x.p order by x.dringend desc, x.erstellt_am), '[]'::jsonb)
    into v_liste
    from (
      select public.ausruestung_prozess_jsonb(a.id, 'obmann') as p,
             (a.prozess_status in ('eingereicht', 'beleg_hochgeladen',
                                   'freigegeben', 'zahlung_angewiesen')) as dringend,
             a.erstellt_am
        from public.ausruestungs_anfragen a
        join public.schiedsrichter s on s.id = a.schiedsrichter_id
       where s.verein_id = v_verein
         and a.typ = 'ausruestung'
         and a.prozess_status <> 'abgeschlossen'
    ) x;
  return v_liste;
end;
$$;

-- Der alte freie Status-Picker: fuer Ausruestungsvorgaenge ab jetzt
-- gesperrt, damit kein Client am Vertrag vorbei schreiben kann. Anliegen
-- haben keinen Beschaffungsprozess und behalten ihren einfachen Status.
create or replace function public.obmann_anfrage_status_setzen(
  p_passwort text,
  p_id uuid,
  p_status text,
  p_beschaffungsweg text default null,
  p_notiz_obmann text default null,
  p_abholung_bestaetigt boolean default null,
  p_keine_zahlung_faellig boolean default null,
  p_erstattet boolean default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_typ    text;
begin
  v_verein := public.obmann_verein(p_passwort);

  select a.typ into v_typ
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein;
  if v_typ is null then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  if v_typ = 'ausruestung' then
    raise exception 'Ausruestungsvorgaenge laufen jetzt ueber den Beschaffungsprozess. Bitte die App aktualisieren.';
  end if;

  if p_status not in ('offen', 'angenommen', 'abgelehnt', 'erledigt') then
    raise exception 'Unbekannter Status.';
  end if;

  update public.ausruestungs_anfragen a
     set status         = p_status,
         notiz_obmann   = coalesce(p_notiz_obmann, a.notiz_obmann),
         obmann_gesehen = true,
         schiri_gesehen = false,
         entschieden_am = case when p_status in ('angenommen', 'abgelehnt')
                               then now() else a.entschieden_am end,
         aktualisiert_am = now()
   where a.id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Tuer 2: der Schiedsrichter
-- ---------------------------------------------------------------------
create or replace function public.schiri_anfrage_schritt(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_anfrage_id uuid,
  p_schritt text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_name text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if p_schritt not in ('gekauft', 'geld_erhalten', 'zurueckgezogen') then
    raise exception 'Diesen Schritt kann der Schiedsrichter nicht setzen.';
  end if;

  perform 1 from public.ausruestungs_anfragen a
   where a.id = p_anfrage_id and a.schiedsrichter_id = p_schiedsrichter_id;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  select s.name into v_name from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  perform public.ausruestung_uebergang(p_anfrage_id, p_schritt, 'schiri', v_name);
end;
$$;

-- Alter Aufrufname von der Website, jetzt als Prozessschritt.
create or replace function public.schiri_anfrage_selbstkauf_bestaetigen(
  p_schiedsrichter_id uuid, p_pin text, p_anfrage_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.schiri_anfrage_schritt(p_schiedsrichter_id, p_pin, p_anfrage_id, 'gekauft');
end;
$$;

create or replace function public.schiri_anfrage_prozess(
  p_schiedsrichter_id uuid, p_pin text, p_anfrage_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  perform 1 from public.ausruestungs_anfragen a
   where a.id = p_anfrage_id and a.schiedsrichter_id = p_schiedsrichter_id;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  return public.ausruestung_prozess_jsonb(p_anfrage_id, 'schiri');
end;
$$;

-- Der Belegupload ist jetzt ein Prozessschritt, nicht mehr nur ein Feld.
-- Ein Beleg vor der Freigabe wird serverseitig abgewiesen.
create or replace function public.schiri_anfrage_rechnung_hochladen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_anfrage_id uuid,
  p_bild_base64 text,
  p_mime text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name   text;
  v_status text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if coalesce(btrim(coalesce(p_bild_base64, '')), '') = '' then
    raise exception 'Es wurde kein Beleg uebertragen.';
  end if;
  if coalesce(p_mime, '') not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Dieses Dateiformat wird nicht angenommen.';
  end if;

  select a.prozess_status into v_status
    from public.ausruestungs_anfragen a
   where a.id = p_anfrage_id
     and a.schiedsrichter_id = p_schiedsrichter_id
     and a.typ = 'ausruestung';
  if v_status is null then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  if v_status not in ('gekauft', 'beleg_hochgeladen', 'beleg_geprueft') then
    raise exception 'Ein Beleg ist fuer diesen Vorgang gerade nicht vorgesehen.';
  end if;

  select s.name into v_name from public.schiedsrichter s where s.id = p_schiedsrichter_id;

  update public.ausruestungs_anfragen
     set rechnung_bild_base64    = p_bild_base64,
         rechnung_mime           = p_mime,
         rechnung_hochgeladen_am = now(),
         obmann_gesehen          = false,
         aktualisiert_am         = now()
   where id = p_anfrage_id;

  -- Nur wenn der Beleg fachlich jetzt dran ist, bewegt sich der Prozess.
  -- Ein erneuter Upload danach tauscht nur das Bild.
  if v_status = 'gekauft' then
    perform public.ausruestung_uebergang(p_anfrage_id, 'beleg_hochgeladen', 'schiri', v_name);
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Tuer 3: der Vorstand (Link ohne Login)
-- ---------------------------------------------------------------------
create or replace function public.freigabe_link_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  select l.id into v_id from public.freigabe_links l
   where l.token_abdruck = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and l.widerrufen_am is null
     and l.gueltig_bis > now();
  if v_id is null then
    raise exception 'Dieser Freigabe-Link ist nicht mehr gueltig.';
  end if;
  return v_id;
end;
$$;

revoke all on function public.freigabe_link_id(text) from public;

-- Entscheiden: nur der eigene Stapel, nur mit eingefrorenem Betrag,
-- Ablehnung nur mit Begruendung. Alles drei serverseitig.
create or replace function public.freigabe_entscheiden(
  p_token text, p_id uuid, p_entscheidung text, p_name text, p_notiz text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);

  if p_entscheidung not in ('freigegeben', 'abgelehnt') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Bitte tragen Sie Ihren Namen ein.';
  end if;

  perform 1
     from public.ausruestungs_anfragen a
     join public.schiedsrichter s on s.id = a.schiedsrichter_id
    where a.id = p_id
      and s.verein_id = v_verein
      and a.vorlage_link_id = v_link
      and a.prozess_status = 'vorgelegt';
  if not found then
    raise exception 'Diese Anfrage steht nicht (mehr) zur Entscheidung.';
  end if;

  perform public.ausruestung_uebergang(p_id, p_entscheidung, 'vorstand', p_name, p_notiz);
end;
$$;

-- Der Vereinsverantwortliche kann die angewiesene Zahlung selbst
-- eintragen. Er muss nicht - Max darf denselben Schritt setzen, wenn die
-- Rueckmeldung per Nachricht kam. In beiden Faellen steht hinterher im
-- Ereignis, wer es war.
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
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);

  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Bitte tragen Sie Ihren Namen ein.';
  end if;

  perform 1
     from public.ausruestungs_anfragen a
     join public.schiedsrichter s on s.id = a.schiedsrichter_id
    where a.id = p_id
      and s.verein_id = v_verein
      and a.vorlage_link_id = v_link
      and a.prozess_status = 'beleg_geprueft';
  if not found then
    raise exception 'Fuer diesen Vorgang steht gerade keine Zahlung an.';
  end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_angewiesen', 'vorstand', p_name);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Rechte
-- ---------------------------------------------------------------------
-- Zwei getrennte Tueren: App und Passwort-RPCs laufen als anon, der
-- angemeldete Web-Obmannbereich als authenticated. Funktionen, die aus
-- src/admin/ aufgerufen werden, brauchen deshalb beide Rollen.

revoke all on function public.obmann_anfrage_pruefen(text, uuid, integer, text, text) from public;
revoke all on function public.obmann_anfrage_preis_setzen(text, uuid, integer) from public;
revoke all on function public.obmann_anfrage_vorlegen(text, uuid, uuid) from public;
revoke all on function public.obmann_anfrage_ablehnen(text, uuid, text) from public;
revoke all on function public.obmann_anfrage_schritt(text, uuid, text, text, text) from public;
revoke all on function public.obmann_anfrage_keine_zahlung(text, uuid, boolean) from public;
revoke all on function public.obmann_anfrage_prozess(text, uuid) from public;
revoke all on function public.obmann_prozess_liste(text) from public;
revoke all on function public.obmann_anfrage_status_setzen(text, uuid, text, text, text, boolean, boolean, boolean) from public;
revoke all on function public.schiri_anfrage_schritt(uuid, text, uuid, text) from public;
revoke all on function public.schiri_anfrage_selbstkauf_bestaetigen(uuid, text, uuid) from public;
revoke all on function public.schiri_anfrage_prozess(uuid, text, uuid) from public;
revoke all on function public.schiri_anfrage_rechnung_hochladen(uuid, text, uuid, text, text) from public;
revoke all on function public.freigabe_entscheiden(text, uuid, text, text, text) from public;
revoke all on function public.freigabe_zahlung_angewiesen(text, uuid, text) from public;

grant execute on function public.obmann_anfrage_pruefen(text, uuid, integer, text, text) to anon, authenticated;
grant execute on function public.obmann_anfrage_preis_setzen(text, uuid, integer) to anon, authenticated;
grant execute on function public.obmann_anfrage_vorlegen(text, uuid, uuid) to anon, authenticated;
grant execute on function public.obmann_anfrage_ablehnen(text, uuid, text) to anon, authenticated;
grant execute on function public.obmann_anfrage_schritt(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.obmann_anfrage_keine_zahlung(text, uuid, boolean) to anon, authenticated;
grant execute on function public.obmann_anfrage_prozess(text, uuid) to anon, authenticated;
grant execute on function public.obmann_prozess_liste(text) to anon, authenticated;
grant execute on function public.obmann_anfrage_status_setzen(text, uuid, text, text, text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.schiri_anfrage_schritt(uuid, text, uuid, text) to anon;
grant execute on function public.schiri_anfrage_selbstkauf_bestaetigen(uuid, text, uuid) to anon;
grant execute on function public.schiri_anfrage_prozess(uuid, text, uuid) to anon;
grant execute on function public.schiri_anfrage_rechnung_hochladen(uuid, text, uuid, text, text) to anon;
grant execute on function public.freigabe_entscheiden(text, uuid, text, text, text) to anon;
grant execute on function public.freigabe_zahlung_angewiesen(text, uuid, text) to anon;
