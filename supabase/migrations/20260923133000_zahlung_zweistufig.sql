-- 23.09.: Zahlung ist ein Zweipersonen-Schritt. Erst Max beauftragt,
-- dann bestätigt Tom die Ausführung; erst danach bestätigt der Schiri den Eingang.
-- Keine Migration bestehender zahlung_angewiesen-Vorgänge: diese gelten als
-- bereits ausgeführt und bleiben im alten Zustand konsistent.

alter table public.ausruestungs_anfragen
  add column if not exists zahlung_beauftragt_am timestamptz,
  add column if not exists zahlung_beauftragt_von text,
  add column if not exists zahlung_hinweis text;

alter table public.ausruestungs_anfragen
  drop constraint if exists ausruestungs_anfragen_prozess_status_check;
alter table public.ausruestungs_anfragen
  add constraint ausruestungs_anfragen_prozess_status_check
  check (prozess_status in (
    'eingereicht','geprueft','vorgelegt','abgelehnt','freigegeben',
    'gekauft','beleg_hochgeladen','beleg_geprueft','zahlung_beauftragt',
    'zahlung_angewiesen','geld_erhalten','bestellt','eingegangen',
    'uebergeben','abgeschlossen','zurueckgezogen'));

create or replace function public.ausruestung_uebergaenge()
returns table(von text,nach text,weg text,rollen text[])
language sql immutable set search_path to '' as $f$
  select * from (values
    ('eingereicht','geprueft','beide',array['obmann']),
    ('eingereicht','abgelehnt','beide',array['obmann']),
    ('eingereicht','zurueckgezogen','beide',array['schiri','obmann']),
    ('geprueft','eingereicht','beide',array['obmann']),
    ('geprueft','vorgelegt','beide',array['obmann']),
    ('geprueft','abgelehnt','beide',array['obmann']),
    ('geprueft','zurueckgezogen','beide',array['schiri','obmann']),
    ('vorgelegt','geprueft','beide',array['obmann']),
    ('vorgelegt','freigegeben','beide',array['vorstand']),
    ('vorgelegt','abgelehnt','beide',array['vorstand']),
    ('freigegeben','geprueft','beide',array['obmann']),
    ('abgelehnt','geprueft','beide',array['obmann']),
    ('freigegeben','gekauft','weg2_schiri_besorgt',array['schiri','obmann']),
    ('gekauft','beleg_hochgeladen','weg2_schiri_besorgt',array['schiri','obmann']),
    ('beleg_hochgeladen','beleg_geprueft','weg2_schiri_besorgt',array['obmann']),
    ('beleg_hochgeladen','gekauft','weg2_schiri_besorgt',array['obmann']),
    ('beleg_geprueft','zahlung_beauftragt','weg2_schiri_besorgt',array['obmann']),
    ('zahlung_beauftragt','zahlung_angewiesen','weg2_schiri_besorgt',array['vorstand','obmann']),
    ('beleg_geprueft','abgeschlossen','weg2_schiri_besorgt',array['obmann']),
    ('zahlung_angewiesen','geld_erhalten','weg2_schiri_besorgt',array['schiri','obmann']),
    ('geld_erhalten','abgeschlossen','weg2_schiri_besorgt',array['obmann','system']),
    ('freigegeben','bestellt','weg1_obmann_besorgt',array['obmann']),
    ('bestellt','eingegangen','weg1_obmann_besorgt',array['obmann']),
    ('eingegangen','uebergeben','weg1_obmann_besorgt',array['obmann']),
    ('uebergeben','abgeschlossen','weg1_obmann_besorgt',array['obmann','system']),
    ('abgelehnt','abgeschlossen','beide',array['obmann']),
    ('zurueckgezogen','abgeschlossen','beide',array['obmann'])
  ) as u(von,nach,weg,rollen);
$f$;
revoke all on function public.ausruestung_uebergaenge() from public;

create or replace function public.ausruestung_schritt_titel(p_schritt text)
returns text language sql immutable set search_path to '' as $f$
  select case p_schritt
    when 'eingereicht' then 'Anfrage'
    when 'geprueft' then 'Obmann-Prüfung'
    when 'vorgelegt' then 'Beim Vorstand'
    when 'entscheidung' then 'Vorstandsentscheidung'
    when 'freigegeben' then 'Freigabe'
    when 'abgelehnt' then 'Abgelehnt'
    when 'zurueckgezogen' then 'Zurückgezogen'
    when 'gekauft' then 'Kaufen'
    when 'beleg_hochgeladen' then 'Beleg einreichen'
    when 'beleg_geprueft' then 'Belegprüfung'
    when 'zahlung_beauftragt' then 'Zahlung beauftragen'
    when 'zahlung_angewiesen' then 'Zahlung ausführen'
    when 'geld_erhalten' then 'Geldeingang bestätigen'
    when 'bestellt' then 'Bestellen'
    when 'eingegangen' then 'Wareneingang'
    when 'uebergeben' then 'Übergabe'
    when 'abgeschlossen' then 'Abgeschlossen'
    else p_schritt end;
$f$;
revoke all on function public.ausruestung_schritt_titel(text) from public;

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
        (8,  'zahlung_beauftragt', 'obmann'),
        (9,  'zahlung_angewiesen', 'vorstand'),
        (10, 'geld_erhalten',      'schiri'),
        (11, 'abgeschlossen',      'obmann')
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

  v_letzte := case when v_weg = 'weg1_obmann_besorgt' then 8 else 11 end;

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
    when 'zahlung_beauftragt' then 8
    when 'zahlung_angewiesen' then 9
    when 'geld_erhalten'      then 10
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
      when 'zahlung_beauftragt' then a.zahlung_beauftragt_am
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
       and k.schluessel in ('zahlung_beauftragt', 'zahlung_angewiesen', 'geld_erhalten')
       and v_zeit is null then
      v_stand := 'entfaellt';
    end if;

    v_wert := case k.schluessel
      when 'vorgelegt' then
        case when a.vorlage_preis_cent is not null
             then replace(to_char(a.vorlage_preis_cent / 100.0, 'FM999999990.00'), '.', ',') || ' €'
             else null end
      when 'entscheidung'       then a.freigabe_name
      when 'zahlung_beauftragt' then a.zahlung_beauftragt_von
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
     and v_sicht = any(u.rollen)
     and not (v_sicht = 'obmann' and u.nach = 'zahlung_angewiesen');

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

revoke all on function public.ausruestung_prozess_jsonb(uuid,text) from public;

-- Der alte allgemeine Obmann-Knopf darf die Auszahlung nicht mehr abkürzen.
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
                       'geld_erhalten', 'bestellt',
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
  v_art    text;
  v_name   text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  v_name   := public.freigabe_akteur(p_token, p_name);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;

  perform 1
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.vorlage_am is not null
     and a.prozess_status = 'zahlung_beauftragt'
     and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link);
  if not found then raise exception 'Der Obmann hat fuer diesen Vorgang noch keine Zahlung beauftragt.'; end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_angewiesen', 'vorstand', v_name);
end;
$$;

-- Max beauftragt die Zahlung. Die E-Mail ist pro Auftrag abschaltbar,
-- der Prozessschritt selbst wird immer gespeichert.
create or replace function public.obmann_zahlung_beauftragen(
  p_passwort text, p_id uuid, p_hinweis text default null,
  p_email boolean default true)
returns void
language plpgsql security definer set search_path to ''
as $funktion$
declare
  v_verein uuid;
  v_anfrage public.ausruestungs_anfragen%rowtype;
  v_empfaenger text;
  v_person text;
  v_bezeichnung text;
  v_hinweis text := nullif(btrim(coalesce(p_hinweis, '')), '');
  v_ereignis uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  select a.* into v_anfrage
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein and a.typ = 'ausruestung'
   for update of a;
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;
  if v_anfrage.prozess_status <> 'beleg_geprueft' then
    raise exception 'Zahlung kann erst nach Belegprüfung beauftragt werden.';
  end if;
  if v_anfrage.keine_zahlung_faellig then
    raise exception 'Für diesen Vorgang ist keine Zahlung vorgesehen.';
  end if;
  if v_hinweis is not null and char_length(v_hinweis) > 500 then
    raise exception 'Der Übergabehinweis darf höchstens 500 Zeichen haben.';
  end if;

  if coalesce(p_email, true) then
    select k.empfaenger_schluessel into v_empfaenger
      from public.freigabe_links l
      join public.benachrichtigungs_einstellungen k
        on k.freigabe_link_id = l.id
     where l.verein_id = v_verein
       and l.widerrufen_am is null
       and (l.gueltig_bis is null or l.gueltig_bis > now())
       and k.email_aktiv and k.email_ziel is not null
       and (l.id = v_anfrage.vorlage_link_id or l.zugangsart = 'dauerhaft')
     order by (l.id = v_anfrage.vorlage_link_id) desc,
              (l.zugangsart = 'dauerhaft') desc, l.erstellt_am desc
     limit 1;
    if v_empfaenger is null then
      raise exception 'Kein aktiver Vorstands-Mailzugang gefunden. Bitte ohne E-Mail beauftragen oder Zugang prüfen.';
    end if;
  end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_beauftragt', 'obmann',
                                       'Obmann', v_hinweis);
  update public.ausruestungs_anfragen
     set zahlung_beauftragt_am = now(),
         zahlung_beauftragt_von = 'Obmann',
         zahlung_hinweis = v_hinweis
   where id = p_id;

  if v_empfaenger is not null then
    select s.name, coalesce(pr.bezeichnung, v_anfrage.kategorie)
      into v_person, v_bezeichnung
      from public.schiedsrichter s
      left join public.ausruestung_preise pr
        on pr.verein_id = s.verein_id and pr.kategorie = v_anfrage.kategorie
     where s.id = v_anfrage.schiedsrichter_id;
    insert into public.benachrichtigungs_ereignisse
      (verein_id, typ, referenz_art, referenz_id, metadaten, schluessel)
    values (
      v_verein, 'ausruestung.zahlung_beauftragt', 'ausruestungs_anfrage', p_id,
      jsonb_build_object(
        'person', v_person, 'bezeichnung', v_bezeichnung,
        'farbe', v_anfrage.farbe, 'groesse', v_anfrage.groesse,
        'betrag_cent', v_anfrage.vorlage_preis_cent,
        'hinweis', v_hinweis),
      'zahlung-beauftragt/' || p_id::text || '/' || v_anfrage.prozess_runde::text)
    on conflict (schluessel) do update set schluessel = excluded.schluessel
    returning id into v_ereignis;
    insert into public.benachrichtigungs_auftraege
      (ereignis_id, empfaenger_schluessel, kanal)
    values (v_ereignis, v_empfaenger, 'email')
    on conflict (ereignis_id, empfaenger_schluessel, kanal) do nothing;
  end if;
end;
$funktion$;
revoke all on function public.obmann_zahlung_beauftragen(text,uuid,text,boolean)
  from public,anon,authenticated;
grant execute on function public.obmann_zahlung_beauftragen(text,uuid,text,boolean)
  to anon,authenticated;

-- Tom teilt die Ausführung außerhalb des Portals mit: Max dokumentiert
-- seine Vertretung mit einer Pflichtnotiz statt sie still zu behaupten.
create or replace function public.obmann_zahlung_stellvertretend(
  p_passwort text, p_id uuid, p_notiz text)
returns void language plpgsql security definer set search_path to ''
as $funktion$
declare v_verein uuid; v_notiz text := nullif(btrim(coalesce(p_notiz,'')), '');
begin
  v_verein := public.obmann_verein(p_passwort);
  if v_notiz is null or char_length(v_notiz) < 10 then
    raise exception 'Für die stellvertretende Zahlungsbestätigung ist eine nachvollziehbare Notiz nötig.';
  end if;
  if char_length(v_notiz) > 500 then
    raise exception 'Die Notiz darf höchstens 500 Zeichen haben.';
  end if;
  perform 1 from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.prozess_status = 'zahlung_beauftragt';
  if not found then
    raise exception 'Dieser Zahlungsauftrag ist nicht offen.';
  end if;
  perform public.ausruestung_uebergang(
    p_id, 'zahlung_angewiesen', 'obmann', 'Obmann (stellvertretend)', v_notiz);
end;
$funktion$;
revoke all on function public.obmann_zahlung_stellvertretend(text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.obmann_zahlung_stellvertretend(text,uuid,text)
  to anon,authenticated;

-- Toms Portal erhält nur beauftragte Zahlungen desselben Vereins. Der
-- Dauerkontakt sieht laufend neue Aufträge, ein befristeter Link nur
-- seine verknüpften Positionen.
create or replace function public.freigabe_zahlungen(p_token text)
returns jsonb language plpgsql security definer set search_path to ''
as $funktion$
declare v_verein uuid; v_link uuid; v_art text; v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);
  select zugangsart into v_art from public.freigabe_links where id = v_link;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'person', s.name,
    'bezeichnung', coalesce(pr.bezeichnung,a.kategorie),
    'farbe', a.farbe, 'groesse', a.groesse,
    'preis_cent', a.vorlage_preis_cent,
    'freigabe_am', a.freigabe_am,
    'beauftragt_am', a.zahlung_beauftragt_am,
    'hinweis', a.zahlung_hinweis)
    order by a.zahlung_beauftragt_am, s.name), '[]'::jsonb)
    into v_ergebnis
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
    left join public.ausruestung_preise pr
      on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
   where s.verein_id = v_verein and a.typ = 'ausruestung'
     and a.prozess_status = 'zahlung_beauftragt'
     and a.vorlage_am is not null
     and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link);
  return v_ergebnis;
end;
$funktion$;
revoke all on function public.freigabe_zahlungen(text)
  from public,anon,authenticated;
grant execute on function public.freigabe_zahlungen(text) to anon;
