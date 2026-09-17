-- =====================================================================
-- v151 - Ausruestungsprozess: Postfach im Eingang, Freigabe-Stapel und
--        weniger Personendaten auf der Vorstandsseite
-- =====================================================================
--
-- Drei Dinge, alle drei aus derselben Wurzel: die Ereignisliste aus v149
-- ist jetzt die gemeinsame Grundlage, und alles andere liest daraus.
--
-- 1. POSTFACH
--    Bisher hat der Eingang eine Ausruestungsanfrage genau einmal
--    gezeigt - beim Anlegen - und danach nie wieder. Alles, was danach
--    passiert (Entscheidung des Vorstands, Kauf, Beleg, Zahlungseingang),
--    lief an Max vorbei. Jetzt gibt es die eigene Art 'prozess': jedes
--    Ereignis mit eingang = true wird ein Eintrag, der gelesen und
--    erledigt werden kann.
--
--    Damit nichts doppelt steht, deckt die alte Art 'anfrage' nur noch
--    Anliegen ab - die haben keinen Beschaffungsprozess. Ausruestung
--    laeuft vollstaendig ueber 'prozess'.
--
--    Geloescht wird ein Prozessereignis NICHT. Es ist der Nachweis, wer
--    was wann entschieden hat. "Loeschen" heisst hier "erledigt" - der
--    Eintrag verschwindet aus dem Postfach, die Spur bleibt.
--
-- 2. FREIGABE-STAPEL
--    Ein Freigabe-Link sieht ab jetzt nur noch die Vorgaenge, die unter
--    genau diesem Link vorgelegt wurden. Vorher konnte ein laufender
--    Link auch alles erfassen, was erst spaeter vorgelegt wurde - der
--    Empfaenger haette ohne Zutun immer neue Vorgaenge zu sehen
--    bekommen.
--
-- 3. WENIGER PERSONENDATEN
--    Die Vorstandsseite hat bisher pro Schiedsrichter die vollstaendige
--    Anfragehistorie und den kompletten Ausruestungsbestand gezeigt.
--    Fuer eine Kaufentscheidung ueber 35 Euro braucht es das nicht, und
--    bei minderjaehrigen Schiedsrichtern ist es schlicht zu viel. Der
--    Kontext ist jetzt: wer, was, wie viel, und wie viel im laufenden
--    Saisonjahr fuer diese Person schon freigegeben wurde. Der Bestand
--    und die Einzelhistorie sind raus.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Jede neue Ausruestungsanfrage erzeugt ihr Eroeffnungsereignis
-- ---------------------------------------------------------------------
-- Als Trigger und nicht in schiri_anfrage_erstellen, damit es egal ist,
-- ueber welchen Weg eine Anfrage entsteht.
create or replace function public.ausruestung_anfrage_eroeffnen()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_name text;
begin
  if new.typ <> 'ausruestung' then
    return new;
  end if;
  select s.name into v_name from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  perform public.ausruestung_ereignis_schreiben(
    new.id, 'eingereicht', 'schiri', v_name, null, new.preis_schiri_cent, true);
  return new;
end;
$$;

drop trigger if exists ausruestung_anfrage_eroeffnen_trigger on public.ausruestungs_anfragen;
create trigger ausruestung_anfrage_eroeffnen_trigger
  after insert on public.ausruestungs_anfragen
  for each row execute function public.ausruestung_anfrage_eroeffnen();


-- ---------------------------------------------------------------------
-- 2. Postfach-Aktionen
-- ---------------------------------------------------------------------
create or replace function public.obmann_ereignis_gelesen(
  p_passwort text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.ausruestung_ereignisse e
     set eingang_gelesen_am = coalesce(e.eingang_gelesen_am, now())
   where e.id = p_id and e.verein_id = v_verein;
end;
$$;

create or replace function public.obmann_ereignis_erledigt(
  p_passwort text, p_id uuid, p_wert boolean default true)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.ausruestung_ereignisse e
     set eingang_erledigt_am = case when coalesce(p_wert, true) then now() else null end,
         eingang_gelesen_am  = coalesce(e.eingang_gelesen_am, now())
   where e.id = p_id and e.verein_id = v_verein;
  if not found then
    raise exception 'Eintrag nicht gefunden';
  end if;
end;
$$;

-- Alle Eintraege eines Vorgangs auf einmal erledigen - das ist der
-- normale Fall, wenn Max den Vorgang in der App bearbeitet hat.
create or replace function public.obmann_ereignisse_erledigt_fuer_anfrage(
  p_passwort text, p_anfrage_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_anzahl integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  update public.ausruestung_ereignisse e
     set eingang_erledigt_am = now(),
         eingang_gelesen_am  = coalesce(e.eingang_gelesen_am, now())
   where e.anfrage_id = p_anfrage_id
     and e.verein_id = v_verein
     and e.eingang = true
     and e.eingang_erledigt_am is null;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Eingang mit der neuen Art 'prozess'
-- ---------------------------------------------------------------------
create or replace function public.obmann_eingang(
  p_passwort text,
  p_art text default null,
  p_limit integer default 100,
  p_nur_offen boolean default true)
returns table(art text, eintrag_id uuid, titel text, vorschau text, person text,
              erstellt_am timestamp with time zone, ist_erledigbar boolean, status text,
              verweis_id uuid, unterart text, frage_in_bearbeitung boolean,
              offene_eintraege integer, eintraege_gesamt integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_limit int := greatest(1, least(coalesce(p_limit, 100), 500));
  v_nur_offen boolean := coalesce(p_nur_offen, true);
begin
  v_verein := obmann_verein(p_passwort);

  if p_art is not null
     and p_art not in ('anfrage','prozess','absage','frage_meldung','meldung','quiz','fragenvorschlag') then
    raise exception 'Unbekannte Art im Eingang: %', p_art;
  end if;

  return query
  with anfragen as (
    -- Nur noch Anliegen. Ausruestung laeuft ueber 'prozess'.
    select
      'anfrage'::text                          as e_art,
      a.id                                     as e_id,
      'Anliegen'::text                         as e_titel,
      left(nullif(coalesce(a.anmerkung, ''), ''), 200) as e_vorschau,
      s.name                                   as e_person,
      a.erstellt_am                            as e_zeit,
      true                                     as e_erledigbar,
      a.status                                 as e_status,
      a.id                                     as e_verweis,
      null::text                               as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from ausruestungs_anfragen a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where s.verein_id = v_verein
      and a.typ = 'anliegen'
      and (v_nur_offen = false or a.status = 'offen')
  ),
  prozess as (
    select
      'prozess'::text                          as e_art,
      e.id                                     as e_id,
      s.name || ': ' || public.ausruestung_schritt_titel(e.schritt) as e_titel,
      left(concat_ws(' · ',
        nullif(coalesce(pr.bezeichnung, a.kategorie), ''),
        case when e.betrag_cent is not null
             then replace(to_char(e.betrag_cent / 100.0, 'FM999999990.00'), '.', ',') || ' €'
             else null end,
        nullif(e.notiz, '')), 200)              as e_vorschau,
      s.name                                   as e_person,
      e.erstellt_am                            as e_zeit,
      true                                     as e_erledigbar,
      case when e.eingang_erledigt_am is not null then 'erledigt' else 'offen' end as e_status,
      e.anfrage_id                             as e_verweis,
      e.schritt                                as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from ausruestung_ereignisse e
    join ausruestungs_anfragen a on a.id = e.anfrage_id
    join schiedsrichter s on s.id = a.schiedsrichter_id
    left join ausruestung_preise pr
           on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
    where e.verein_id = v_verein
      and e.eingang = true
      and (v_nur_offen = false or e.eingang_erledigt_am is null)
  ),
  absagen as (
    select
      'absage'::text                           as e_art,
      tr.id                                    as e_id,
      'Absage: ' || t.titel                    as e_titel,
      left(nullif(concat_ws(' - ', nullif(tr.grund,''), nullif(tr.kommentar,'')), ''), 200) as e_vorschau,
      s.name                                   as e_person,
      tr.gemeldet_am                           as e_zeit,
      true                                     as e_erledigbar,
      case when tr.obmann_erledigt then 'erledigt' else 'offen' end as e_status,
      t.id                                     as e_verweis,
      null::text                               as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from termin_rueckmeldungen tr
    join termine t on t.id = tr.termin_id
    join schiedsrichter s on s.id = tr.schiedsrichter_id
    where t.verein_id = v_verein
      and tr.status = 'ab'
      and (v_nur_offen = false or tr.obmann_erledigt = false)
  ),
  frage_meldung as (
    select
      'frage_meldung'::text                    as e_art,
      fm.id                                    as e_id,
      'Frage ' || coalesce(nr.frage_nummer::text, '?') || ': '
        || left(f.frage_text, 60)              as e_titel,
      left(coalesce((select e.text
                       from frage_meldung_eintraege e
                      where e.meldung_id = fm.id
                      order by e.erstellt_am desc, e.id desc
                      limit 1), ''), 200)      as e_vorschau,
      coalesce(s.name, 'Unbekannt')            as e_person,
      fm.aktualisiert_am                       as e_zeit,
      true                                     as e_erledigbar,
      fm.status                                as e_status,
      fm.frage_id                              as e_verweis,
      null::text                               as e_unterart,
      f.in_bearbeitung                         as e_in_arbeit,
      (select count(*)::integer from frage_meldung_eintraege e
        where e.meldung_id = fm.id and e.erledigt = false) as e_offen,
      (select count(*)::integer from frage_meldung_eintraege e
        where e.meldung_id = fm.id)            as e_gesamt
    from frage_meldungen fm
    join fragen f on f.id = fm.frage_id
    left join schiedsrichter s on s.id = fm.schiedsrichter_id
    left join wochen_frage_nummern nr
      on nr.verein_id = fm.verein_id
     and nr.frage_id = fm.frage_id
     and nr.runde_id = fm.runde_id
    where fm.verein_id = v_verein
      and (v_nur_offen = false
           or (fm.status <> 'erledigt' and fm.status <> 'abgelehnt'))
  ),
  meldebogen as (
    select
      'meldung'::text                          as e_art,
      m.id                                     as e_id,
      case m.art
        when 'treff'     then 'Thema fuer Schiri-Treff'
        when 'regelfall' then 'Regelfall'
        when 'vorfall'   then 'Vorfall'
        when 'gespraech' then 'Gespraechswunsch'
        when 'website'   then 'Website-Hinweis'
      end                                      as e_titel,
      left(m.situation, 200)                   as e_vorschau,
      case when m.anonym then 'anonym'
           else coalesce(s.name, 'Unbekannt') end as e_person,
      m.erstellt_am                            as e_zeit,
      true                                     as e_erledigbar,
      m.status                                 as e_status,
      m.id                                     as e_verweis,
      m.art                                    as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from meldungen m
    left join schiedsrichter s on s.id = m.schiedsrichter_id
    where m.verein_id = v_verein
      and (v_nur_offen = false or m.status <> 'erledigt')
  ),
  vorschlaege as (
    select
      'fragenvorschlag'::text                  as e_art,
      fv.id                                    as e_id,
      'Fragenvorschlag: '
        || left(coalesce(fv.inhalt->>'frage_text', ''), 60) as e_titel,
      left(fv.begruendung, 200)                as e_vorschau,
      coalesce(s.name, 'Unbekannt')            as e_person,
      coalesce(fv.eingereicht_am, fv.aktualisiert_am) as e_zeit,
      true                                     as e_erledigbar,
      case fv.status
        when 'eingereicht'       then 'offen'
        when 'in_pruefung'       then 'in_arbeit'
        when 'aenderung_erbeten' then 'aenderung_erbeten'
        when 'angenommen'        then 'erledigt'
        when 'abgelehnt'         then 'abgelehnt'
      end                                      as e_status,
      fv.id                                    as e_verweis,
      null::text                               as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from fragenvorschlaege fv
    join schiedsrichter s on s.id = fv.schiedsrichter_id
    where fv.verein_id = v_verein
      and fv.status <> 'entwurf'
      and (v_nur_offen = false or fv.status in ('eingereicht','in_pruefung'))
  ),
  runde_soll as (
    select rf.runde_id, count(*)::int as soll
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id
    where rf.verein_id = v_verein and f.aktiv
    group by rf.runde_id
  ),
  quiz_stand as (
    select
      s.id            as schiri_id,
      s.name          as schiri_name,
      rf.runde_id     as runde_id,
      count(*)::int   as ist,
      count(*) filter (where a.korrekt)::int as richtig,
      max(a.beantwortet_am) as letzte
    from antworten a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    join runden_fragen rf on rf.frage_id = a.frage_id and rf.verein_id = s.verein_id
    join fragen f on f.id = a.frage_id and f.aktiv
    where s.verein_id = v_verein
      and s.ist_test = false
    group by s.id, s.name, rf.runde_id
  ),
  quiz as (
    select
      'quiz'::text                             as e_art,
      md5(q.schiri_id::text || q.runde_id::text)::uuid as e_id,
      'Quiz abgeschlossen: ' || r.bezeichnung  as e_titel,
      q.richtig::text || ' von ' || q.ist::text || ' richtig' as e_vorschau,
      q.schiri_name                            as e_person,
      q.letzte                                 as e_zeit,
      false                                    as e_erledigbar,
      'abgeschlossen'::text                    as e_status,
      q.schiri_id                              as e_verweis,
      null::text                               as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from quiz_stand q
    join runde_soll rs on rs.runde_id = q.runde_id and q.ist >= rs.soll
    join runden r on r.id = q.runde_id
  ),
  strom as (
    select * from anfragen
    union all select * from prozess
    union all select * from absagen
    union all select * from frage_meldung
    union all select * from meldebogen
    union all select * from quiz
    union all select * from vorschlaege
  )
  select
    st.e_art, st.e_id, st.e_titel, st.e_vorschau, st.e_person,
    st.e_zeit, st.e_erledigbar, st.e_status, st.e_verweis,
    st.e_unterart, st.e_in_arbeit, st.e_offen, st.e_gesamt
  from strom st
  where p_art is null or st.e_art = p_art
  order by (st.e_status in ('erledigt', 'abgelehnt', 'abgeschlossen')) asc,
           st.e_zeit desc
  limit v_limit;
end;
$function$;


create or replace function public.obmann_eingang_zaehler(p_passwort text)
returns table(art text, anzahl integer, zaehlt_fuer_reiter boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  return query
  select 'anfrage'::text, (
    select count(*)::integer
    from ausruestungs_anfragen a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where s.verein_id = v_verein and a.typ = 'anliegen' and a.status = 'offen'
  ), true

  union all
  select 'prozess'::text, (
    select count(*)::integer
    from ausruestung_ereignisse e
    where e.verein_id = v_verein and e.eingang = true and e.eingang_erledigt_am is null
  ), true

  union all
  select 'absage'::text, (
    select count(*)::integer
    from termin_rueckmeldungen tr
    join termine t on t.id = tr.termin_id
    where t.verein_id = v_verein and tr.status = 'ab' and tr.obmann_erledigt = false
  ), true

  union all
  select 'frage_meldung'::text, (
    select count(*)::integer
    from frage_meldungen fm
    where fm.verein_id = v_verein
      and fm.status <> 'erledigt'
      and fm.status <> 'abgelehnt'
  ), true

  union all
  select 'meldung'::text, (
    select count(*)::integer
    from meldungen m
    where m.verein_id = v_verein and m.status <> 'erledigt'
  ), true

  union all
  select 'fragenvorschlag'::text, (
    select count(*)::integer
    from fragenvorschlaege fv
    where fv.verein_id = v_verein
      and fv.status in ('eingereicht','in_pruefung')
  ), true

  union all
  select 'quiz'::text, (
    with runde_soll as (
      select rf.runde_id, count(*)::int as soll
      from runden_fragen rf
      join fragen f on f.id = rf.frage_id
      where rf.verein_id = v_verein and f.aktiv
      group by rf.runde_id
    ),
    quiz_stand as (
      select s.id as schiri_id, rf.runde_id as runde_id, count(*)::int as ist
      from antworten a
      join schiedsrichter s on s.id = a.schiedsrichter_id
      join runden_fragen rf on rf.frage_id = a.frage_id and rf.verein_id = s.verein_id
      join fragen f on f.id = a.frage_id and f.aktiv
      where s.verein_id = v_verein and s.ist_test = false
      group by s.id, rf.runde_id
    )
    select count(*)::integer
    from quiz_stand q
    join runde_soll rs on rs.runde_id = q.runde_id and q.ist >= rs.soll
  ), false;
end;
$function$;


-- Ein Prozessereignis wird nicht geloescht - es ist der Nachweis. Es
-- wird erledigt und verschwindet damit aus dem Postfach.
create or replace function public.obmann_eingang_loeschen(p_passwort text, p_art text, p_id uuid)
returns table(art text, geloescht boolean, kind_eintraege integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_verein uuid; v_kinder integer := 0; v_treffer integer;
begin
  v_verein := obmann_verein(p_passwort);
  if p_art = 'meldung' then
    delete from meldungen m where m.id = p_id and m.verein_id = v_verein;
  elsif p_art = 'frage_meldung' then
    select count(*)::integer into v_kinder from frage_meldung_eintraege e
      join frage_meldungen fm on fm.id = e.meldung_id
      where fm.id = p_id and fm.verein_id = v_verein;
    delete from frage_meldungen fm where fm.id = p_id and fm.verein_id = v_verein;
  elsif p_art = 'prozess' then
    update ausruestung_ereignisse e
       set eingang_erledigt_am = now(),
           eingang_gelesen_am = coalesce(e.eingang_gelesen_am, now())
     where e.id = p_id and e.verein_id = v_verein;
  else
    raise exception 'Nur Meldeboegen, Fragefeedback und Prozesseintraege werden hier erledigt';
  end if;
  get diagnostics v_treffer = row_count;
  if v_treffer = 0 then raise exception 'Kein passender Eintrag in diesem Verein gefunden'; end if;
  return query select p_art, true, v_kinder;
end;
$function$;


-- ---------------------------------------------------------------------
-- 4. Vorstandsseite: nur der eigene Stapel, nur der noetige Kontext
-- ---------------------------------------------------------------------
create or replace function public.freigabe_dashboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein   uuid;
  v_link     uuid;
  v_name     text;
  v_start    date;
  v_ende     date;
  v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  select v.name into v_name from public.vereine v where v.id = v_verein;

  -- Saison: 1. Juli bis 30. Juni.
  v_start := make_date(
    case when extract(month from current_date) >= 7
         then extract(year from current_date)::int
         else extract(year from current_date)::int - 1 end, 7, 1);
  v_ende := (v_start + interval '1 year' - interval '1 day')::date;

  with stapel as (
    -- Ausschliesslich Vorgaenge, die unter genau diesem Link vorgelegt
    -- wurden. Ein spaeter vorgelegter Vorgang taucht hier nicht auf.
    select a.id, a.schiedsrichter_id, s.name as person,
           coalesce(pr.bezeichnung, a.kategorie) as bezeichnung,
           a.kategorie, a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           a.erstellt_am, a.prozess_status, a.beschaffungsweg,
           a.vorlage_preis_cent as preis_cent,
           a.vorlage_am, a.freigabe_status, a.freigabe_name,
           a.freigabe_notiz, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.vorlage_link_id = v_link
  ),
  -- Saisonkontext je Person: eine einzige Zahl, keine Einzelhistorie.
  saison as (
    select a.schiedsrichter_id,
           count(*) filter (where a.prozess_status not in ('abgelehnt','zurueckgezogen')) as freigegeben_anzahl,
           coalesce(sum(a.vorlage_preis_cent) filter (
             where a.freigabe_status = 'freigegeben'), 0) as freigegeben_cent
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.freigabe_status = 'freigegeben'
       and a.freigabe_am::date between v_start and v_ende
     group by a.schiedsrichter_id
  )
  select jsonb_build_object(
    'verein', v_name,
    'saison', jsonb_build_object(
      'bezeichnung', to_char(v_start, 'YYYY') || '/' || to_char(v_start + interval '1 year', 'YY'),
      'von', v_start, 'bis', v_ende),
    'kennzahlen', (select jsonb_build_object(
        'offen_anzahl',       count(*) filter (where prozess_status = 'vorgelegt'),
        'offen_cent',         coalesce(sum(preis_cent) filter (where prozess_status = 'vorgelegt'), 0),
        'offen_ohne_preis',   count(*) filter (where prozess_status = 'vorgelegt' and preis_cent is null),
        'freigegeben_anzahl', count(*) filter (where freigabe_status = 'freigegeben'),
        'freigegeben_cent',   coalesce(sum(preis_cent) filter (where freigabe_status = 'freigegeben'), 0),
        'abgelehnt_anzahl',   count(*) filter (where freigabe_status = 'abgelehnt'),
        'zahlung_anzahl',     count(*) filter (where prozess_status = 'beleg_geprueft'),
        'zahlung_cent',       coalesce(sum(preis_cent) filter (where prozess_status = 'beleg_geprueft'), 0)
      ) from stapel),
    -- Zu entscheiden
    'offen', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'kategorie', z.kategorie, 'farbe', z.farbe, 'groesse', z.groesse,
        'aermellaenge', z.aermellaenge, 'anmerkung', z.anmerkung,
        'preis_cent', z.preis_cent, 'beschaffungsweg', z.beschaffungsweg,
        'erstellt_am', z.erstellt_am, 'vorlage_am', z.vorlage_am,
        'saison_freigegeben_cent', coalesce(sa.freigegeben_cent, 0),
        'saison_freigegeben_anzahl', coalesce(sa.freigegeben_anzahl, 0))
        order by z.person, z.vorlage_am)
      from stapel z left join saison sa on sa.schiedsrichter_id = z.schiedsrichter_id
      where z.prozess_status = 'vorgelegt'), '[]'::jsonb),
    -- Zahlung anzuweisen: freigegeben, gekauft, Beleg geprueft.
    'zahlungen', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'preis_cent', z.preis_cent, 'freigabe_am', z.freigabe_am)
        order by z.person)
      from stapel z where z.prozess_status = 'beleg_geprueft'), '[]'::jsonb),
    -- Was unter DIESEM Link bereits entschieden wurde.
    'verlauf', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'preis_cent', z.preis_cent, 'freigabe_status', z.freigabe_status,
        'freigabe_name', z.freigabe_name, 'freigabe_notiz', z.freigabe_notiz,
        'freigabe_am', z.freigabe_am, 'prozess_status', z.prozess_status)
        order by z.freigabe_am desc)
      from stapel z
      where z.freigabe_status in ('freigegeben','abgelehnt')
        and z.freigabe_am is not null), '[]'::jsonb)
  ) into v_ergebnis;

  return v_ergebnis;
end;
$function$;


-- Auch die einfache Liste sieht nur noch den eigenen Stapel.
create or replace function public.freigabe_uebersicht(p_token text)
returns table(id uuid, person text, bezeichnung text, kategorie text, farbe text,
              groesse text, aermellaenge text, anmerkung text, preis_cent integer,
              preis_quelle text, erstellt_am timestamp with time zone,
              freigabe_status text, freigabe_notiz text, freigabe_name text,
              freigabe_am timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein uuid;
  v_link   uuid;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  return query
    select a.id, s.name, coalesce(pr.bezeichnung, a.kategorie), a.kategorie,
           a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           a.vorlage_preis_cent,
           'vorgelegt'::text,
           a.erstellt_am, a.freigabe_status, a.freigabe_notiz,
           a.freigabe_name, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.vorlage_link_id = v_link
     order by (a.prozess_status = 'vorgelegt') desc, a.erstellt_am;
end;
$function$;


-- ---------------------------------------------------------------------
-- 5. Rechte
-- ---------------------------------------------------------------------
revoke all on function public.obmann_ereignis_gelesen(text, uuid) from public;
revoke all on function public.obmann_ereignis_erledigt(text, uuid, boolean) from public;
revoke all on function public.obmann_ereignisse_erledigt_fuer_anfrage(text, uuid) from public;
revoke all on function public.obmann_eingang(text, text, integer, boolean) from public;
revoke all on function public.obmann_eingang_zaehler(text) from public;
revoke all on function public.obmann_eingang_loeschen(text, text, uuid) from public;
revoke all on function public.freigabe_dashboard(text) from public;
revoke all on function public.freigabe_uebersicht(text) from public;

grant execute on function public.obmann_ereignis_gelesen(text, uuid) to anon, authenticated;
grant execute on function public.obmann_ereignis_erledigt(text, uuid, boolean) to anon, authenticated;
grant execute on function public.obmann_ereignisse_erledigt_fuer_anfrage(text, uuid) to anon, authenticated;
grant execute on function public.obmann_eingang(text, text, integer, boolean) to anon, authenticated;
grant execute on function public.obmann_eingang_zaehler(text) to anon, authenticated;
grant execute on function public.obmann_eingang_loeschen(text, text, uuid) to anon, authenticated;
grant execute on function public.freigabe_dashboard(text) to anon;
grant execute on function public.freigabe_uebersicht(text) to anon;
