-- =====================================================================
-- v115 - Eingang: mehr Status, Einzeleintraege abhaken, Meldebogen-Detail,
--        endgueltiges Loeschen, Frage "in Bearbeitung", Wochen-Kappung
-- =====================================================================
--
-- WARUM DIESE MIGRATION
-- ---------------------
-- Max hat den Eingang aus v111 zum ersten Mal benutzt und sechs Dinge
-- zurueckgemeldet, die alle denselben Kern haben: der Eingang kannte bisher
-- nur "da" und "weg". Wer auf erledigt geklickt hat, hat den Vorgang aus dem
-- Blick verloren, ohne ihn wirklich loszuwerden. Das ist fuer einen
-- Rueckkanal, in dem Menschen Vorfaelle und Gespraechswuensche melden, die
-- falsche Grundeinstellung.
--
--  1. STATUS. "gelesen" fehlte. Max liest eine Meldung, arbeitet daran und
--     will das festhalten, ohne sie wegzuraeumen. meldungen bekommt
--     offen/gelesen/in_arbeit/erledigt, frage_meldungen zusaetzlich
--     abgelehnt. Erledigtes bleibt ueber obmann_eingang(p_nur_offen => false)
--     abrufbar - der Standard bleibt true, damit sich am heutigen Verhalten
--     der App nichts aendert.
--
--     Wichtig dabei: der partielle Unique-Index griff bisher nur bei
--     status = 'offen'. Damit haette eine zweite Rueckmeldung derselben
--     Person zur selben Frage einen ZWEITEN Kopfsatz angelegt, sobald Max
--     den ersten auf "gelesen" gesetzt hat - genau die Zersplitterung, die
--     v111 verhindern wollte. Der maszgebliche Zustand ist deshalb ab jetzt
--     "noch nicht erledigt" (status <> 'erledigt' and status <> 'abgelehnt')
--     und nicht mehr "offen". Das Praedikat ist bewusst als Ausschluss der
--     beiden Endzustaende formuliert: kommt spaeter ein weiterer
--     Zwischenstatus dazu, greift die Regel automatisch mit.
--
--  2. EINZELNE EINTRAEGE. Zu einer Frage kommen mehrere Rueckmeldungen in
--     verschiedenen Kategorien. "Video ruckelt" kann erledigt sein, waehrend
--     "Antwort fraglich" offen bleibt. Bisher konnte Max nur den ganzen
--     Kopfsatz abhaken und damit auch das, was er noch gar nicht angefasst
--     hatte. frage_meldung_eintraege bekommt deshalb einen eigenen
--     Erledigt-Zustand. Die Kopf-Meldung gilt erst dann automatisch als
--     erledigt, wenn ALLE ihre Eintraege erledigt sind - diese Regel steckt
--     im RPC und nicht in der Oberflaeche, damit sie auch dann gilt, wenn
--     spaeter eine zweite Oberflaeche dazukommt.
--
--  3. ART DES MELDEBOGENS. obmann_eingang lieferte die vier Arten nur im
--     Titeltext ("Vorfall", "Gespraechswunsch", ...). Die App unterschied
--     einen Vorfall an dieser Zeichenkette. Das bricht still, sobald jemand
--     die Beschriftung aendert oder uebersetzt. Die Art kommt deshalb als
--     eigene Spalte "unterart" zurueck (regelfall/vorfall/gespraech/website,
--     bei allen anderen Eingangsarten null). Max will die vier ausdruecklich
--     staerker voneinander abgrenzen; dafuer braucht die App einen stabilen
--     Schluessel.
--
--  4. DETAILANSICHT. Ein Regelfall liess sich nur abhaken, nicht ansehen.
--     obmann_meldung_details liefert einen Meldebogen vollstaendig.
--
--  5. ENDGUELTIG LOESCHEN. obmann_eingang_loeschen ist der EINZIGE Weg, auf
--     dem eine Meldung wirklich aus der Datenbank verschwindet. Es gibt
--     keinen automatischen Loeschlauf, und das ist Absicht: aufbewahren_bis
--     ist eine Erinnerung an Max, keine Anweisung an die Datenbank. Geloescht
--     werden darf nur, was erledigt ist - "ich will auch nichts von Leuten
--     verwerfen". Absagen zu Terminen sind bewusst ausgenommen, sie gehoeren
--     zur Terminstatistik und verschwinden nur mit ihrem Termin.
--
--  6. FRAGE IN BEARBEITUNG. siehe ausfuehrliche Begruendung direkt beim
--     Kennzeichen weiter unten.
--
--  7. WOCHEN-KAPPUNG. Wenn Max im Dashboard Wochen zurueckblaettert, sollen
--     die Verlaufsdarstellungen nur bis zu dieser Woche rechnen. Alle vier
--     Analysefunktionen bekommen hinten p_bis_runde; ohne den Parameter
--     bleibt jede Zahl exakt wie heute.
--
-- Alle Funktionen, deren Signatur oder Rueckgabetyp sich aendert, werden
-- geloescht und neu angelegt statt ersetzt. create or replace haette sonst
-- eine zweite Ueberladung erzeugt, und PostgREST antwortet dann mit PGRST202
-- statt die richtige zu finden (Lehre aus v85).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Statuswerte erweitern
-- ---------------------------------------------------------------------

alter table meldungen drop constraint if exists meldungen_status_gueltig;
alter table meldungen add constraint meldungen_status_gueltig
  check (status in ('offen','gelesen','in_arbeit','erledigt'));

alter table frage_meldungen drop constraint if exists frage_meldungen_status_gueltig;
alter table frage_meldungen add constraint frage_meldungen_status_gueltig
  check (status in ('offen','gelesen','in_arbeit','erledigt','abgelehnt'));


-- ---------------------------------------------------------------------
-- 2. Ein Kopfsatz je Person und Frage, solange er nicht erledigt ist
--
-- Vorher: WHERE status = 'offen'. Ein auf "gelesen" gesetzter Kopfsatz war
-- damit fuer den Index unsichtbar, und die naechste Rueckmeldung derselben
-- Person haette einen zweiten Kopfsatz angelegt.
-- ---------------------------------------------------------------------

drop index if exists frage_meldungen_eine_offene_je_person_frage;

create unique index if not exists frage_meldungen_eine_unerledigte_je_person_frage
  on frage_meldungen (frage_id, schiedsrichter_id)
  where (status <> 'erledigt' and status <> 'abgelehnt');


-- ---------------------------------------------------------------------
-- 3. Erledigt-Zustand je Einzeleintrag
-- ---------------------------------------------------------------------

alter table frage_meldung_eintraege
  add column if not exists erledigt boolean not null default false;
alter table frage_meldung_eintraege
  add column if not exists erledigt_am timestamptz;

-- Altbestand angleichen: was unter einem bereits abgeschlossenen Kopfsatz
-- haengt, ist auch als Einzeleintrag abgeschlossen. Ohne diesen Abgleich
-- wuerde ein alter erledigter Kopfsatz beim ersten Klick auf einen seiner
-- Eintraege wieder aufspringen.
update frage_meldung_eintraege e
   set erledigt = true,
       erledigt_am = coalesce(e.erledigt_am, now())
  from frage_meldungen m
 where m.id = e.meldung_id
   and m.status in ('erledigt','abgelehnt')
   and e.erledigt = false;

create index if not exists frage_meldung_eintraege_offen_idx
  on frage_meldung_eintraege (meldung_id)
  where erledigt = false;


-- ---------------------------------------------------------------------
-- 4. Kennzeichen "an dieser Frage wird gerade gearbeitet"
--
-- ENTSCHEIDUNG, WO DAS KENNZEICHEN WIRKT - und warum nicht anders:
--
-- wochen_fragen_v2 liest die Fragen der LAUFENDEN Woche direkt aus
-- runden_fragen (join runden r ... where now() between r.startet_am and
-- r.endet_am and f.aktiv). Wuerde dort zusaetzlich "and not
-- f.in_bearbeitung" stehen, verschwaende eine Frage mitten in der Woche aus
-- dem Quiz - und zwar auch dann, wenn die Haelfte der Schiedsrichter sie
-- schon beantwortet hat. Die Antworten blieben in der Tabelle stehen,
-- waeren aber keiner sichtbaren Frage mehr zugeordnet. Schlimmer noch:
-- obmann_fragen_woche, obmann_wochen_matrix, obmann_trend_wochen und
-- obmann_analyse_punkte bilden ihr Soll ueber runden_fragen join fragen
-- (f.aktiv). Der Sollwert wuerde also weiterlaufen, waehrend das Ist
-- einbricht, und die Auswertung zeigte falsche Luecken. Genau das soll
-- nicht passieren.
--
-- Zugewiesen werden Fragen in diesem Projekt ausschliesslich von Hand,
-- ueber obmann_frage_verschieben und obmann_frage_neu_einordnen. Eine
-- automatische Rotation gibt es nicht. Deshalb wirkt das Kennzeichen genau
-- dort: eine Frage in Bearbeitung laesst sich nicht in eine Woche legen,
-- die noch nicht begonnen hat. Die laufende und vergangene Wochen bleiben
-- unberuehrt - dort korrigiert Max bewusst, und ein Vetorecht der Datenbank
-- waere an dieser Stelle nur im Weg.
--
-- wochen_fragen_v2 wird bewusst NICHT angefasst.
--
-- Wer eine Frage sofort aus dem Verkehr ziehen will, hat dafuer weiterhin
-- obmann_frage_aktiv_setzen. in_bearbeitung ist die weiche Variante: ein
-- Merkzettel, keine Sperre.
-- ---------------------------------------------------------------------

alter table fragen
  add column if not exists in_bearbeitung boolean not null default false;


-- ---------------------------------------------------------------------
-- 5. Rueckmeldung abgeben - jetzt gegen "unerledigt" statt gegen "offen"
-- ---------------------------------------------------------------------

create or replace function public.meldung_frage_abgeben(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_frage_id uuid,
  p_kategorie text,
  p_text text
)
returns table(meldung_id uuid, neu_angelegt boolean, anzahl_eintraege integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_runde uuid;
  v_meldung uuid;
  v_neu boolean := false;
  v_anzahl integer;
  v_text text;
  v_gegeben text;
  v_snapshot jsonb;
begin
  -- Anmeldung ueber den zentralen Helfer (v113). Ein Gast hat keine
  -- schiedsrichter_id und kommt hier gar nicht erst hinein.
  v_verein := schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if p_kategorie is null
     or p_kategorie not in ('antwort','feedback','text_unklar','video_technik','sonstiges') then
    raise exception 'Unbekannte Kategorie';
  end if;

  v_text := btrim(coalesce(p_text, ''));
  if char_length(v_text) < 1 or char_length(v_text) > 1000 then
    raise exception 'Text muss zwischen 1 und 1000 Zeichen lang sein';
  end if;

  -- Die Frage muss zum Verein der Person gehoeren. Sonst koennte jemand
  -- Rueckmeldungen in die Ablage eines fremden Vereins schreiben.
  select rf.runde_id into v_runde
  from runden_fragen rf
  where rf.verein_id = v_verein and rf.frage_id = p_frage_id;

  if not found then
    raise exception 'Frage gehoert nicht zu diesem Verein';
  end if;

  -- Schnappschuss: was hat die Person geantwortet ...
  select nullif(concat_ws(' | ',
           nullif(a.gegebene_option, ''),
           case when a.gegebene_auswahl is not null
                then array_to_string(a.gegebene_auswahl, ', ') end,
           case when a.gegebene_zahl is not null
                then a.gegebene_zahl::text || ' ' || coalesce(a.gegebene_einheit, '') end,
           nullif(a.gegebener_freitext, ''),
           nullif(a.zweiter_freitext, ''),
           (select ae.gegebene_antwort::text
              from antwort_entscheidungen ae where ae.antwort_id = a.id)
         ), '')
    into v_gegeben
  from antworten a
  where a.schiedsrichter_id = p_schiedsrichter_id
    and a.frage_id = p_frage_id;

  -- ... und wie sah die Loesung in diesem Moment aus. Beides kommt aus der
  -- Datenbank, nicht vom Aufrufer.
  select jsonb_strip_nulls(jsonb_build_object(
           'frage_text', f.frage_text,
           'medium', f.medium,
           'antworttyp', f.antworttyp,
           'richtige_option', f.richtige_option,
           'musterantwort', f.musterantwort,
           'bewertungshinweise', f.bewertungshinweise,
           'erklaerung_zusatzhinweis', f.erklaerung_zusatzhinweis,
           'optionen', (select jsonb_agg(jsonb_build_object(
                                 'schluessel', o.schluessel,
                                 'text', o.text,
                                 'ist_richtig', o.ist_richtig)
                               order by o.position)
                        from frage_antwortoptionen o where o.frage_id = f.id),
           'zahl_loesungen', (select jsonb_agg(jsonb_build_object(
                                       'wert', z.wert,
                                       'einheit', z.einheit,
                                       'toleranz', z.toleranz)
                                     order by z.position)
                              from frage_zahl_loesungen z where z.frage_id = f.id),
           'entscheidung', (select to_jsonb(l) - 'frage_id'
                            from frage_entscheidungsloesungen l where l.frage_id = f.id),
           'geschnappt_am', to_jsonb(now())
         ))
    into v_snapshot
  from fragen f where f.id = p_frage_id;

  -- Gibt es schon einen NOCH NICHT ERLEDIGTEN Kopfsatz dieser Person zu
  -- dieser Frage? Frueher stand hier status = 'offen'. Damit haette ein von
  -- Max auf "gelesen" gesetzter Vorgang einen zweiten Kopfsatz nach sich
  -- gezogen, und Max haette dieselbe Sache zweimal im Eingang.
  select m.id into v_meldung
  from frage_meldungen m
  where m.frage_id = p_frage_id
    and m.schiedsrichter_id = p_schiedsrichter_id
    and m.status <> 'erledigt'
    and m.status <> 'abgelehnt'
  for update;

  if v_meldung is null then
    insert into frage_meldungen (
      verein_id, frage_id, schiedsrichter_id, status, runde_id,
      gegebene_antwort, loesung_snapshot
    )
    values (
      v_verein, p_frage_id, p_schiedsrichter_id, 'offen', v_runde,
      v_gegeben, v_snapshot
    )
    on conflict (frage_id, schiedsrichter_id)
      where (status <> 'erledigt' and status <> 'abgelehnt')
      do nothing
    returning id into v_meldung;

    if v_meldung is null then
      -- Zwei gleichzeitige Meldungen: die andere war schneller, wir haengen
      -- unseren Eintrag an ihren Kopfsatz.
      select m.id into v_meldung
      from frage_meldungen m
      where m.frage_id = p_frage_id
        and m.schiedsrichter_id = p_schiedsrichter_id
        and m.status <> 'erledigt'
        and m.status <> 'abgelehnt';
    else
      v_neu := true;
    end if;
  end if;

  insert into frage_meldung_eintraege (meldung_id, kategorie, text)
  values (v_meldung, p_kategorie, v_text);

  -- Ein neuer Eintrag unter einem Kopfsatz, den Max schon gelesen hatte,
  -- macht den Kopfsatz wieder zu einem offenen Vorgang. Sonst haette Max
  -- den Zusatz nie gesehen.
  update frage_meldungen m
     set aktualisiert_am = now(),
         status = case when m.status = 'gelesen' then 'offen' else m.status end
   where m.id = v_meldung;

  select count(*)::integer into v_anzahl
  from frage_meldung_eintraege e where e.meldung_id = v_meldung;

  return query select v_meldung, v_neu, v_anzahl;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Einzelnen Eintrag abhaken
--
-- Die Regel "Kopf ist erledigt, wenn alle Eintraege erledigt sind" steht
-- hier und nicht in der App. Umgekehrt gilt sie auch: wird ein Eintrag
-- wieder geoeffnet, faellt ein bereits erledigter Kopfsatz auf in_arbeit
-- zurueck. Ein abgelehnter Kopfsatz bleibt abgelehnt - "abgelehnt" ist eine
-- Entscheidung von Max ueber den ganzen Vorgang und keine Zwischenbilanz
-- ueber seine Teile.
-- ---------------------------------------------------------------------

drop function if exists public.obmann_frage_meldung_eintrag_status_setzen(text, uuid, boolean);

create function public.obmann_frage_meldung_eintrag_status_setzen(
  p_passwort text,
  p_eintrag_id uuid,
  p_erledigt boolean default true
)
returns table(
  eintrag_id uuid,
  erledigt boolean,
  meldung_id uuid,
  meldung_status text,
  offene_eintraege integer,
  eintraege_gesamt integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_meldung uuid;
  v_status text;
  v_wert boolean := coalesce(p_erledigt, true);
  v_offen integer;
  v_gesamt integer;
begin
  v_verein := obmann_verein(p_passwort);

  if p_eintrag_id is null then
    raise exception 'Keine Eintrag-id uebergeben';
  end if;

  select m.id, m.status into v_meldung, v_status
  from frage_meldung_eintraege e
  join frage_meldungen m on m.id = e.meldung_id
  where e.id = p_eintrag_id
    and m.verein_id = v_verein
  for update of m;

  if v_meldung is null then
    raise exception 'Kein passender Eintrag in diesem Verein gefunden';
  end if;

  update frage_meldung_eintraege e
     set erledigt = v_wert,
         erledigt_am = case when v_wert then now() else null end
   where e.id = p_eintrag_id;

  select count(*)::integer,
         count(*) filter (where e.erledigt = false)::integer
    into v_gesamt, v_offen
  from frage_meldung_eintraege e
  where e.meldung_id = v_meldung;

  if v_status <> 'abgelehnt' then
    if v_gesamt > 0 and v_offen = 0 then
      v_status := 'erledigt';
    elsif v_offen > 0 and v_status = 'erledigt' then
      v_status := 'in_arbeit';
    end if;
  end if;

  update frage_meldungen m
     set status = v_status,
         aktualisiert_am = now()
   where m.id = v_meldung;

  return query select p_eintrag_id, v_wert, v_meldung, v_status, v_offen, v_gesamt;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Status im Eingang setzen - mit den neuen Werten
-- ---------------------------------------------------------------------

create or replace function public.obmann_meldung_status_setzen(
  p_passwort text,
  p_art text,
  p_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_treffer integer := 0;
begin
  v_verein := obmann_verein(p_passwort);

  if p_id is null then
    raise exception 'Keine id uebergeben';
  end if;

  if p_art = 'anfrage' then
    if p_status not in ('offen','angenommen','abgelehnt','erledigt') then
      raise exception 'Status % ist fuer eine Anfrage nicht zulaessig', p_status;
    end if;
    update ausruestungs_anfragen a
       set status = p_status
     where a.id = p_id
       and exists (select 1 from schiedsrichter s
                    where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
    get diagnostics v_treffer = row_count;

  elsif p_art = 'absage' then
    -- Eine Absage ist die Antwort der Person; ihr Status wird hier nicht
    -- veraendert. Gesetzt wird nur, ob Max sie abgehakt hat.
    if p_status not in ('offen','erledigt') then
      raise exception 'Status % ist fuer eine Absage nicht zulaessig', p_status;
    end if;
    update termin_rueckmeldungen tr
       set obmann_erledigt = (p_status = 'erledigt')
     where tr.id = p_id
       and exists (select 1 from termine t
                    where t.id = tr.termin_id and t.verein_id = v_verein);
    get diagnostics v_treffer = row_count;

  elsif p_art = 'frage_meldung' then
    if p_status not in ('offen','gelesen','in_arbeit','erledigt','abgelehnt') then
      raise exception 'Status % ist fuer eine Frage-Rueckmeldung nicht zulaessig', p_status;
    end if;

    begin
      update frage_meldungen fm
         set status = p_status, aktualisiert_am = now()
       where fm.id = p_id and fm.verein_id = v_verein;
      get diagnostics v_treffer = row_count;
    exception when unique_violation then
      -- Es gibt bereits einen unerledigten Kopfsatz derselben Person zur
      -- selben Frage. Ein zweiter darf daneben nicht entstehen.
      raise exception 'Zu dieser Frage liegt von dieser Person bereits eine unerledigte Rueckmeldung vor; dieser Vorgang kann nicht wieder geoeffnet werden';
    end;

    -- "Alles erledigt" vom Kopf aus heisst auch: alle Einzeleintraege sind
    -- erledigt. Der umgekehrte Weg (Kopf wieder oeffnen) laesst die
    -- Einzeleintraege bewusst so, wie Max sie gesetzt hat - sonst waere die
    -- Feinarbeit an den Kategorien mit einem Klick weg.
    if v_treffer > 0 and p_status = 'erledigt' then
      update frage_meldung_eintraege e
         set erledigt = true,
             erledigt_am = coalesce(e.erledigt_am, now())
       where e.meldung_id = p_id and e.erledigt = false;
    end if;

  elsif p_art = 'meldung' then
    if p_status not in ('offen','gelesen','in_arbeit','erledigt') then
      raise exception 'Status % ist fuer einen Meldebogen nicht zulaessig', p_status;
    end if;
    update meldungen m
       set status = p_status
     where m.id = p_id and m.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

  else
    raise exception 'Art % kann nicht erledigt werden', coalesce(p_art, '(null)');
  end if;

  -- Lieber ein Fehler als ein stilles Nichts: Ein Klick, der nichts bewirkt,
  -- faellt sonst erst auf, wenn der Eintrag Wochen spaeter noch im Eingang steht.
  if v_treffer = 0 then
    raise exception 'Kein passender Eintrag in diesem Verein gefunden';
  end if;

  return p_status;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Eingangsliste: erledigte Eintraege abrufbar, Art als eigene Spalte
--
-- Neue Spalten hinten angehaengt, damit ein aelterer App-Stand, der die
-- Zeilen ueber Feldnamen liest, unveraendert weiterlaeuft:
--   unterart            regelfall/vorfall/gespraech/website, sonst null
--   frage_in_bearbeitung  ob an der Frage gerade gearbeitet wird
--   offene_eintraege / eintraege_gesamt  fuer den Fortschritt je Vorgang
-- ---------------------------------------------------------------------

drop function if exists public.obmann_eingang(text, text, integer);

create function public.obmann_eingang(
  p_passwort text,
  p_art text default null,
  p_limit integer default 100,
  p_nur_offen boolean default true
)
returns table(
  art text,
  eintrag_id uuid,
  titel text,
  vorschau text,
  person text,
  erstellt_am timestamptz,
  ist_erledigbar boolean,
  status text,
  verweis_id uuid,
  unterart text,
  frage_in_bearbeitung boolean,
  offene_eintraege integer,
  eintraege_gesamt integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_limit int := greatest(1, least(coalesce(p_limit, 100), 500));
  v_nur_offen boolean := coalesce(p_nur_offen, true);
begin
  v_verein := obmann_verein(p_passwort);

  if p_art is not null
     and p_art not in ('anfrage','absage','frage_meldung','meldung','quiz') then
    raise exception 'Unbekannte Art im Eingang: %', p_art;
  end if;

  return query
  with anfragen as (
    select
      'anfrage'::text                          as e_art,
      a.id                                     as e_id,
      case when a.typ = 'ausruestung'
           then 'Ausruestung: ' || coalesce(a.kategorie, 'unbekannt')
           else 'Anliegen' end                 as e_titel,
      left(nullif(concat_ws(', ', nullif(a.farbe,''), nullif(a.groesse,''),
                            nullif(a.aermellaenge,''), nullif(a.anmerkung,'')), ''), 200) as e_vorschau,
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
      and (v_nur_offen = false or a.status = 'offen')
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
      -- Frueher stand hier fest 'offen', weil erledigte Absagen gar nicht
      -- erst mitkamen. Mit p_nur_offen = false kommen sie mit, und dann muss
      -- der Status auch stimmen.
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
        when 'regelfall' then 'Regelfall'
        when 'vorfall'   then 'Vorfall'
        when 'gespraech' then 'Gespraechswunsch'
        when 'website'   then 'Website-Hinweis'
      end                                      as e_titel,
      left(m.situation, 200)                   as e_vorschau,
      -- Bei einer anonymen Meldung steht keine Person am Datensatz; hier kann
      -- also gar nichts durchsickern.
      case when m.anonym then 'anonym'
           else coalesce(s.name, 'Unbekannt') end as e_person,
      m.erstellt_am                            as e_zeit,
      true                                     as e_erledigbar,
      m.status                                 as e_status,
      m.id                                     as e_verweis,
      -- Die Art als eigene Spalte. Die App darf einen Vorfall nicht mehr an
      -- der Beschriftung erkennen muessen.
      m.art                                    as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from meldungen m
    left join schiedsrichter s on s.id = m.schiedsrichter_id
    where m.verein_id = v_verein
      and (v_nur_offen = false or m.status <> 'erledigt')
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
    -- Quiz-Aktivitaet: abgeschlossene Runden. Kein Aufgabencharakter, deshalb
    -- e_erledigbar = false und im Zaehler nicht enthalten. p_nur_offen
    -- beruehrt diesen Strom nicht - er kennt keinen Erledigt-Zustand.
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
    union all select * from absagen
    union all select * from frage_meldung
    union all select * from meldebogen
    union all select * from quiz
  )
  select
    st.e_art, st.e_id, st.e_titel, st.e_vorschau, st.e_person,
    st.e_zeit, st.e_erledigbar, st.e_status, st.e_verweis,
    st.e_unterart, st.e_in_arbeit, st.e_offen, st.e_gesamt
  from strom st
  where p_art is null or st.e_art = p_art
  order by st.e_zeit desc
  limit v_limit;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Zaehler an der Reiterleiste - gleiche Definition von "unerledigt"
--
-- Der Zaehler muss dieselbe Menge zaehlen, die obmann_eingang mit
-- p_nur_offen = true zeigt. Liefe er weiter auf status = 'offen', staende
-- eine 0 an einem Reiter, unter dem noch drei gelesene Vorgaenge liegen.
-- ---------------------------------------------------------------------

create or replace function public.obmann_eingang_zaehler(p_passwort text)
returns table(art text, anzahl integer, zaehlt_fuer_reiter boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  return query
  select 'anfrage'::text, (
    select count(*)::integer
    from ausruestungs_anfragen a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where s.verein_id = v_verein and a.status = 'offen'
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

  -- Die Quiz-Aktivitaet wird mitgeliefert, damit die App sie anzeigen kann,
  -- geht aber ausdruecklich nicht in die Zahl an der Reiterleiste ein. Sonst
  -- ginge diese Zahl nie auf null, und eine Zahl, die nie auf null geht, wird
  -- ignoriert.
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
$$;


-- ---------------------------------------------------------------------
-- 10. Meldebogen vollstaendig ansehen
--
-- Bis jetzt konnte Max einen Regelfall nur abhaken. Alles, was die Person
-- geschrieben hat, blieb hinter einer 200-Zeichen-Vorschau verborgen.
-- Die Felder sind je nach Art unterschiedlich belegt (ein Website-Hinweis
-- hat keine Spielklasse, ein Vorfall darf nie veroeffentlicht werden); die
-- Funktion gibt sie alle zurueck und ueberlaesst der App, welche sie zeigt.
-- ---------------------------------------------------------------------

drop function if exists public.obmann_meldung_details(text, uuid);

create function public.obmann_meldung_details(p_passwort text, p_id uuid)
returns table(
  id uuid,
  art text,
  art_beschriftung text,
  person text,
  anonym boolean,
  spielklasse text,
  situation text,
  eigene_entscheidung text,
  unsicher_warum text,
  beteiligte text,
  sonderbericht_geschrieben boolean,
  veroeffentlichung_erlaubt boolean,
  status text,
  erstellt_am timestamptz,
  aufbewahren_bis date,
  frist_erreicht boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  if p_id is null then
    raise exception 'Keine id uebergeben';
  end if;

  return query
  select
    m.id,
    m.art,
    case m.art
      when 'regelfall' then 'Regelfall'
      when 'vorfall'   then 'Vorfall'
      when 'gespraech' then 'Gespraechswunsch'
      when 'website'   then 'Website-Hinweis'
    end,
    -- Anonym bleibt anonym, auch in der Detailansicht.
    case when m.anonym then 'anonym'
         else coalesce(s.name, 'Unbekannt') end,
    m.anonym,
    m.spielklasse,
    m.situation,
    m.eigene_entscheidung,
    m.unsicher_warum,
    m.beteiligte,
    m.sonderbericht_geschrieben,
    m.veroeffentlichung_erlaubt,
    m.status,
    m.erstellt_am,
    m.aufbewahren_bis,
    (m.aufbewahren_bis is not null and m.aufbewahren_bis <= current_date)
  from meldungen m
  left join schiedsrichter s on s.id = m.schiedsrichter_id
  where m.id = p_id
    and m.verein_id = v_verein;

  if not found then
    raise exception 'Kein passender Meldebogen in diesem Verein gefunden';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. Endgueltig loeschen
--
-- DIES IST DER EINZIGE WEG, AUF DEM MELDUNGEN WIRKLICH AUS DER DATENBANK
-- VERSCHWINDEN. Es gibt keinen automatischen Loeschlauf und keinen Job, der
-- nach aufbewahren_bis aufraeumt - das ist Absicht. aufbewahren_bis ist eine
-- Erinnerung an Max, nicht eine Anweisung an die Datenbank. Was eine Person
-- gemeldet hat, verschwindet erst, wenn Max es bewusst wegwirft.
--
-- Zwei Sicherungen:
--   * Nur ERLEDIGTES darf weg. Etwas Ungelesenes zu verwerfen ist genau das,
--     was Max nicht will.
--   * Absagen zu Terminen sind ausgenommen. Sie sind zugleich die Antwort
--     der Person auf eine Einladung und stecken in jeder Terminstatistik;
--     sie zu loeschen wuerde die Zahlen am Termin still verfaelschen. Sie
--     verschwinden nur mit ihrem Termin.
--
-- Bei einer Frage-Rueckmeldung muessen die Kindeintraege mitgehen. Die
-- Fremdschluessel-Regel dafuer ist on delete cascade; die Funktion prueft
-- danach trotzdem nach, statt sich darauf zu verlassen.
-- ---------------------------------------------------------------------

drop function if exists public.obmann_eingang_loeschen(text, text, uuid);

create function public.obmann_eingang_loeschen(
  p_passwort text,
  p_art text,
  p_id uuid
)
returns table(art text, geloescht boolean, kind_eintraege integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_status text;
  v_kinder integer := 0;
  v_rest integer := 0;
  v_treffer integer := 0;
begin
  v_verein := obmann_verein(p_passwort);

  if p_id is null then
    raise exception 'Keine id uebergeben';
  end if;

  if p_art = 'meldung' then
    select m.status into v_status
    from meldungen m
    where m.id = p_id and m.verein_id = v_verein;

    if v_status is null then
      raise exception 'Kein passender Eintrag in diesem Verein gefunden';
    end if;
    if v_status <> 'erledigt' then
      raise exception 'Nur erledigte Eintraege duerfen geloescht werden (Status: %)', v_status;
    end if;

    delete from meldungen m where m.id = p_id and m.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

  elsif p_art = 'frage_meldung' then
    select fm.status into v_status
    from frage_meldungen fm
    where fm.id = p_id and fm.verein_id = v_verein;

    if v_status is null then
      raise exception 'Kein passender Eintrag in diesem Verein gefunden';
    end if;
    if v_status not in ('erledigt','abgelehnt') then
      raise exception 'Nur erledigte Eintraege duerfen geloescht werden (Status: %)', v_status;
    end if;

    select count(*)::integer into v_kinder
    from frage_meldung_eintraege e where e.meldung_id = p_id;

    delete from frage_meldungen fm where fm.id = p_id and fm.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

    -- Nachgeprueft statt angenommen: haengt noch ein Kindeintrag an der
    -- geloeschten Meldung, bricht die ganze Aktion ab.
    select count(*)::integer into v_rest
    from frage_meldung_eintraege e where e.meldung_id = p_id;

    if v_rest > 0 then
      raise exception 'Kindeintraege sind nicht mitgegangen (% uebrig), Loeschen abgebrochen', v_rest;
    end if;

  elsif p_art = 'anfrage' then
    select a.status into v_status
    from ausruestungs_anfragen a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where a.id = p_id and s.verein_id = v_verein;

    if v_status is null then
      raise exception 'Kein passender Eintrag in diesem Verein gefunden';
    end if;
    if v_status not in ('erledigt','abgelehnt') then
      raise exception 'Nur erledigte Eintraege duerfen geloescht werden (Status: %)', v_status;
    end if;

    delete from ausruestungs_anfragen a
     where a.id = p_id
       and exists (select 1 from schiedsrichter s
                    where s.id = a.schiedsrichter_id and s.verein_id = v_verein);
    get diagnostics v_treffer = row_count;

  elsif p_art = 'absage' then
    raise exception 'Eine Absage gehoert zum Termin und kann hier nicht geloescht werden; sie verschwindet mit dem Termin';

  elsif p_art = 'quiz' then
    raise exception 'Quiz-Aktivitaet ist eine Auswertung und kein Datensatz, der geloescht werden koennte';

  else
    raise exception 'Art % kann nicht geloescht werden', coalesce(p_art, '(null)');
  end if;

  if v_treffer = 0 then
    raise exception 'Kein passender Eintrag in diesem Verein gefunden';
  end if;

  return query select p_art, true, v_kinder;
end;
$$;


-- ---------------------------------------------------------------------
-- 12. Frage voruebergehend "in Bearbeitung"
-- ---------------------------------------------------------------------

drop function if exists public.obmann_frage_in_bearbeitung_setzen(text, uuid, boolean);

create function public.obmann_frage_in_bearbeitung_setzen(
  p_passwort text,
  p_frage_id uuid,
  p_wert boolean default true
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_wert boolean := coalesce(p_wert, true);
  v_treffer integer := 0;
begin
  perform obmann_verein(p_passwort);

  if p_frage_id is null then
    raise exception 'Keine frage_id uebergeben';
  end if;

  update fragen f set in_bearbeitung = v_wert where f.id = p_frage_id;
  get diagnostics v_treffer = row_count;

  if v_treffer = 0 then
    raise exception 'Frage nicht gefunden';
  end if;

  return v_wert;
end;
$$;


-- ---------------------------------------------------------------------
-- 13. Zuweisung in kommende Wochen sperren, solange gearbeitet wird
--
-- Hier - und nur hier - wirkt in_bearbeitung. Die laufende Woche bleibt
-- unangetastet, siehe die lange Begruendung oben bei der Spalte.
-- ---------------------------------------------------------------------

create or replace function public.obmann_frage_verschieben(
  p_passwort text,
  p_frage_id uuid,
  p_runde_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_naechste integer;
  v_start timestamptz;
begin
  v_verein := obmann_verein(p_passwort);

  if p_runde_id is null then
    delete from runden_fragen
    where verein_id = v_verein and frage_id = p_frage_id;
    return;
  end if;

  select r.startet_am into v_start from runden r where r.id = p_runde_id;

  if v_start is not null and v_start > now()
     and exists (select 1 from fragen f
                  where f.id = p_frage_id and f.in_bearbeitung) then
    raise exception 'Frage ist als "in Bearbeitung" markiert und kann nicht in eine kuenftige Woche gelegt werden';
  end if;

  -- Beim Verschieben hinten anhaengen. Die alte Position der Frage aus
  -- der vorherigen Woche mitzunehmen wuerde dort zu Doppelbelegungen fuehren.
  select coalesce(max(rf."position"), -1) + 1 into v_naechste
  from runden_fragen rf
  where rf.verein_id = v_verein and rf.runde_id = p_runde_id;

  insert into runden_fragen (verein_id, runde_id, frage_id, "position")
  values (v_verein, p_runde_id, p_frage_id, v_naechste)
  on conflict (verein_id, frage_id) do update
    set runde_id = excluded.runde_id,
        "position" = excluded."position";
end;
$$;


create or replace function public.obmann_frage_neu_einordnen(
  p_passwort text,
  p_frage_id uuid,
  p_ziel_runde_id uuid,
  p_vor_frage_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_ids uuid[];
  v_einfuege_index int;
  v_id uuid;
  v_i int;
  v_start timestamptz;
begin
  v_verein := obmann_verein(p_passwort);

  if p_vor_frage_id is not null and p_frage_id = p_vor_frage_id then
    return;
  end if;

  select r.startet_am into v_start from runden r where r.id = p_ziel_runde_id;

  if v_start is not null and v_start > now()
     and exists (select 1 from fragen f
                  where f.id = p_frage_id and f.in_bearbeitung) then
    raise exception 'Frage ist als "in Bearbeitung" markiert und kann nicht in eine kuenftige Woche gelegt werden';
  end if;

  select array_agg(rf.frage_id order by rf."position" nulls last, f.erstellt_am)
  into v_ids
  from runden_fragen rf
  join fragen f on f.id = rf.frage_id
  where rf.runde_id = p_ziel_runde_id
    and rf.verein_id = v_verein
    and rf.frage_id <> p_frage_id;

  if v_ids is null then
    v_ids := array[]::uuid[];
  end if;

  v_einfuege_index := null;
  if p_vor_frage_id is not null then
    select i - 1 into v_einfuege_index
    from unnest(v_ids) with ordinality as t(id, i)
    where t.id = p_vor_frage_id;
  end if;

  if v_einfuege_index is null then
    v_einfuege_index := coalesce(array_length(v_ids, 1), 0);
  end if;

  v_ids := v_ids[1:v_einfuege_index] || array[p_frage_id] || v_ids[v_einfuege_index + 1:];

  v_i := 0;
  foreach v_id in array v_ids loop
    insert into runden_fragen (verein_id, runde_id, frage_id, "position")
    values (v_verein, p_ziel_runde_id, v_id, v_i)
    on conflict (verein_id, frage_id) do update
      set runde_id = excluded.runde_id,
          "position" = excluded."position";
    v_i := v_i + 1;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 14. Fragenuebersicht zeigt das Kennzeichen
--
-- Ein Merkzettel, den niemand sehen kann, ist kein Merkzettel. Die Spalte
-- haengt hinten, damit die App unveraendert weiterlaeuft. Nebenbei werden
-- hier die Rechte geradegezogen: die Funktion war bisher fuer PUBLIC
-- ausfuehrbar - ein Rest aus der Zeit vor v82.
-- ---------------------------------------------------------------------

drop function if exists public.obmann_fragen_uebersicht(text);

create function public.obmann_fragen_uebersicht(p_passwort text)
returns table(
  frage_id uuid, frage_text text, kategorie text, typ text,
  regel_nummer smallint, regel_bezeichnung text, schwierigkeit smallint,
  quelle_typ text, quelle_detail text, quelle_sortierschluessel text,
  aktiv boolean, runde_id uuid, runde_bezeichnung text,
  runde_sortierschluessel text, beantwortungen integer,
  richtige_beantwortungen integer, erfolgsquote_prozent double precision,
  teilnahmequote_prozent double precision, sichtbar_gast boolean,
  sichtbar_historie boolean, nie_in_rotation boolean, im_gastzugang boolean,
  in_uebungsfragen boolean, in_bearbeitung boolean
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_gast_verein uuid;
  v_schiris integer;
begin
  v_verein := obmann_verein(p_passwort);

  select v.id into v_gast_verein
  from vereine v where v.gastzugang_erlaubt order by v.created_at limit 1;

  select count(*) into v_schiris
  from schiedsrichter s
  where s.verein_id = v_verein and s.ist_test = false and coalesce(s.aktiv, true);

  return query
  select
    f.id, f.frage_text, f.kategorie, f.typ, f.regel_nummer, reg.bezeichnung,
    f.schwierigkeit, f.quelle_typ, f.quelle_detail, f.quelle_sortierschluessel, f.aktiv,
    rd.id, rd.bezeichnung, to_char(rd.startet_am, 'YYYYMMDDHH24MI'),
    q.beantwortungen, q.richtige,
    case when q.beantwortungen > 0
         then (100.0 * q.richtige / q.beantwortungen)::double precision end,
    case when v_schiris > 0
         then (100.0 * q.beantwortungen / v_schiris)::double precision end,
    f.sichtbar_gast,
    f.sichtbar_historie,
    f.nie_in_rotation,
    (f.aktiv and f.typ = 'multiple_choice'
       and frage_ist_sichtbar(f.sichtbar_gast, rfg.runde_id, f.nie_in_rotation)),
    (f.aktiv
       and frage_ist_sichtbar(f.sichtbar_historie, rf.runde_id, f.nie_in_rotation)),
    f.in_bearbeitung
  from fragen f
  left join runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  left join runden_fragen rfg on rfg.frage_id = f.id and rfg.verein_id = v_gast_verein
  left join runden rd on rd.id = rf.runde_id
  left join regeln reg on reg.nummer = f.regel_nummer
  cross join lateral (
    select count(a.id)::integer as beantwortungen,
           count(a.id) filter (where a.korrekt)::integer as richtige
    from antworten a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where a.frage_id = f.id and s.verein_id = v_verein
      and s.ist_test = false and coalesce(s.aktiv, true)
  ) q
  order by f.erstellt_am desc;
end;
$$;


-- ---------------------------------------------------------------------
-- 15. Der Erledigt-Zustand je Eintrag muss auch sichtbar sein
--
-- Beide Funktionen behalten ihre Signatur; nur der Inhalt des jsonb-Feldes
-- "eintraege" bekommt das Feld erledigt dazu. Die Sortierung von
-- obmann_frage_meldungen stellt jetzt "unerledigt" nach vorn statt "offen",
-- sonst rutschten gelesene Vorgaenge ans Ende der Liste.
-- ---------------------------------------------------------------------

create or replace function public.obmann_frage_meldungen(
  p_passwort text,
  p_frage_id uuid default null
)
returns table(
  meldung_id uuid, frage_id uuid, frage_nummer integer, frage_text text,
  schiedsrichter_id uuid, person text, status text, runde_id uuid,
  runde_bezeichnung text, gegebene_antwort text, loesung_snapshot jsonb,
  erstellt_am timestamptz, aktualisiert_am timestamptz,
  anzahl_eintraege integer, eintraege jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  return query
  select
    fm.id,
    fm.frage_id,
    nr.frage_nummer,
    f.frage_text,
    fm.schiedsrichter_id,
    coalesce(s.name, 'Unbekannt'),
    fm.status,
    fm.runde_id,
    r.bezeichnung,
    fm.gegebene_antwort,
    fm.loesung_snapshot,
    fm.erstellt_am,
    fm.aktualisiert_am,
    (select count(*)::integer from frage_meldung_eintraege e where e.meldung_id = fm.id),
    coalesce((select jsonb_agg(jsonb_build_object(
                       'id', e.id,
                       'kategorie', e.kategorie,
                       'text', e.text,
                       'erledigt', e.erledigt,
                       'erledigt_am', e.erledigt_am,
                       'erstellt_am', e.erstellt_am)
                     order by e.erstellt_am, e.id)
              from frage_meldung_eintraege e where e.meldung_id = fm.id), '[]'::jsonb)
  from frage_meldungen fm
  join fragen f on f.id = fm.frage_id
  left join schiedsrichter s on s.id = fm.schiedsrichter_id
  left join runden r on r.id = fm.runde_id
  left join wochen_frage_nummern nr
    on nr.verein_id = fm.verein_id
   and nr.frage_id = fm.frage_id
   and nr.runde_id = fm.runde_id
  where fm.verein_id = v_verein
    and (p_frage_id is null or fm.frage_id = p_frage_id)
  order by (fm.status <> 'erledigt' and fm.status <> 'abgelehnt') desc,
           fm.aktualisiert_am desc;
end;
$$;


create or replace function public.meine_frage_meldungen(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns table(
  frage_id uuid, status text, anzahl_eintraege integer,
  erstellt_am timestamptz, aktualisiert_am timestamptz, eintraege jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Rueckgabewert bewusst verworfen: hier wird nur die Anmeldung gebraucht,
  -- der Filter unten laeuft ueber die Person und nicht ueber den Verein.
  perform schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  return query
  select
    fm.frage_id,
    fm.status,
    (select count(*)::integer
       from frage_meldung_eintraege e where e.meldung_id = fm.id),
    fm.erstellt_am,
    fm.aktualisiert_am,
    coalesce((select jsonb_agg(jsonb_build_object(
                       'kategorie', e.kategorie,
                       'text', e.text,
                       'erledigt', e.erledigt,
                       'erstellt_am', e.erstellt_am)
                     order by e.erstellt_am, e.id)
              from frage_meldung_eintraege e where e.meldung_id = fm.id), '[]'::jsonb)
  from frage_meldungen fm
  -- Der einzige Filter, auf den es ankommt. Kein verein-weiter Blick, kein
  -- Blick auf dieselbe Frage bei anderen Leuten.
  where fm.schiedsrichter_id = p_schiedsrichter_id
  order by fm.aktualisiert_am desc, fm.erstellt_am desc;
end;
$$;


-- ---------------------------------------------------------------------
-- 16. Wochen-Abschneidung fuer die Analysen
--
-- Max blaettert im Dashboard eine Woche zurueck und erwartet, dass die
-- Verlaufsdarstellungen dann auch nur bis dorthin rechnen. Alle vier
-- Funktionen bekommen hinten p_bis_runde uuid default null. Ist er gesetzt,
-- fallen alle Runden weg, die SPAETER beginnen als die genannte; die
-- genannte Runde ist die juengste im Ergebnis. Ohne den Parameter aendert
-- sich keine einzige Zahl.
--
-- Die Grenze ist der Startzeitpunkt der genannten Runde, nicht ihr Ende:
-- so bleibt die Runde selbst drin, auch wenn sie noch laeuft.
--
-- Die drei Funktionen mit p_wochen kappen zuerst nach oben und nehmen dann
-- die letzten n Wochen. Wer also 8 Wochen einstellt und auf die Woche vom
-- 1. Juli zurueckblaettert, sieht die 8 Wochen bis zum 1. Juli - nicht 8
-- Wochen bis heute, von denen die Haelfte weggeschnitten ist.
--
-- Neue Parameter stehen hinten und haben einen Default, damit ein aelterer
-- App-Stand die Funktionen unveraendert weiter aufrufen kann.
-- ---------------------------------------------------------------------

drop function if exists public.obmann_wochen_matrix(integer, text);

create function public.obmann_wochen_matrix(
  p_wochen integer default 8,
  p_passwort text default null,
  p_bis_runde uuid default null
)
returns table(
  runde_id uuid, runde text, woche_label text, ist_aktuelle_runde boolean,
  reihenfolge integer, schiedsrichter text, fragen_gesamt integer,
  beantwortet integer, richtig integer, falsch integer,
  nicht_beantwortet integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 8), 1), 52);
  v_grenze timestamptz := now();
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  if p_bis_runde is not null then
    select least(v_grenze, r.startet_am) into v_grenze
    from runden r where r.id = p_bis_runde;
    if not found then
      raise exception 'Unbekannte Runde: %', p_bis_runde;
    end if;
  end if;

  return query
  with letzte_runden as (
    -- Nur abgeschlossene und laufende Runden. Kuenftige Wochen sind zwar
    -- schon angelegt, haben aber definitionsgemaess keine Antworten und
    -- wuerden die Matrix mit leeren Spalten aufblaehen. Mit p_bis_runde
    -- wandert diese Obergrenze zusaetzlich in die Vergangenheit.
    select r.id, r.bezeichnung, r.startet_am, r.endet_am
    from runden r
    where r.startet_am <= v_grenze
    order by r.startet_am desc
    limit v_wochen
  ),
  runden_sortiert as (
    select lr.id, lr.bezeichnung, lr.startet_am, lr.endet_am,
           (row_number() over (order by lr.startet_am) - 1)::int as reihenfolge
    from letzte_runden lr
  ),
  wochenfragen as (
    select distinct rf.runde_id, rf.frage_id
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    where rf.runde_id in (select rs.id from runden_sortiert rs)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  fragen_je_runde as (
    select wf.runde_id, count(*)::int as anzahl
    from wochenfragen wf
    group by wf.runde_id
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
  )
  select
    rs.id,
    rs.bezeichnung,
    to_char(rs.startet_am, 'DD.MM.'),
    (now() between rs.startet_am and rs.endet_am),
    rs.reihenfolge,
    p.name,
    coalesce(fjr.anzahl, 0),
    count(a.id)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    greatest(coalesce(fjr.anzahl, 0) - count(a.id)::int, 0)
  from runden_sortiert rs
  cross join personen p
  left join fragen_je_runde fjr on fjr.runde_id = rs.id
  left join wochenfragen wf on wf.runde_id = rs.id
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by rs.id, rs.bezeichnung, rs.startet_am, rs.endet_am,
           rs.reihenfolge, p.id, p.name, fjr.anzahl
  order by rs.reihenfolge, p.name;
end;
$$;


drop function if exists public.obmann_trend_wochen(text);

create function public.obmann_trend_wochen(
  p_passwort text,
  p_bis_runde uuid default null
)
returns table(
  runde_id uuid, runde text, woche_label text, ist_aktuelle_runde boolean,
  fragen_anzahl integer, moegliche_antworten integer, beantwortet integer,
  richtig integer, falsch integer, nicht_beantwortet integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid;
  v_schiris integer;
  v_grenze timestamptz := null;
begin
  v_verein := obmann_verein(p_passwort);

  if p_bis_runde is not null then
    select r.startet_am into v_grenze from runden r where r.id = p_bis_runde;
    if v_grenze is null then
      raise exception 'Unbekannte Runde: %', p_bis_runde;
    end if;
  end if;

  select count(*) into v_schiris
  from schiedsrichter
  where verein_id = v_verein and ist_test = false and coalesce(aktiv, true);

  return query
  select
    r.id, r.bezeichnung, to_char(r.startet_am, 'DD.MM.'),
    (now() >= r.startet_am and now() <= r.endet_am),
    count(distinct f.id)::integer,
    (count(distinct f.id) * v_schiris)::integer,
    count(a.id)::integer,
    count(a.id) filter (where a.korrekt)::integer,
    (count(a.id) - count(a.id) filter (where a.korrekt))::integer,
    (count(distinct f.id) * v_schiris - count(a.id))::integer
  from runden r
  join runden_fragen rf on rf.runde_id = r.id and rf.verein_id = v_verein
  join fragen f on f.id = rf.frage_id and f.aktiv
  left join antworten a
    on a.frage_id = f.id
   and exists (select 1 from schiedsrichter s
               where s.id = a.schiedsrichter_id
                 and s.verein_id = v_verein
                 and s.ist_test = false
                 and coalesce(s.aktiv, true))
  where (v_grenze is null or r.startet_am <= v_grenze)
  group by r.id, r.bezeichnung, r.startet_am, r.endet_am
  order by r.startet_am;
end;
$$;


drop function if exists public.obmann_analyse_punkte(integer, text);

create function public.obmann_analyse_punkte(
  p_wochen integer default 12,
  p_passwort text default null,
  p_bis_runde uuid default null
)
returns table(
  schiedsrichter text, beantwortet integer, richtig integer, falsch integer,
  nicht_beantwortet integer, quote_prozent numeric, wochen_aktiv integer,
  mc_beantwortet integer, freitext_beantwortet integer,
  video_beantwortet integer, icon_beantwortet integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 12), 1), 52);
  v_grenze timestamptz := now();
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  if p_bis_runde is not null then
    select least(v_grenze, r.startet_am) into v_grenze
    from runden r where r.id = p_bis_runde;
    if not found then
      raise exception 'Unbekannte Runde: %', p_bis_runde;
    end if;
  end if;

  return query
  with letzte_runden as (
    select r.id, r.startet_am
    from runden r
    where r.startet_am <= v_grenze
    order by r.startet_am desc
    limit v_wochen
  ),
  wochenfragen as (
    -- runde_id bleibt mit im Schluessel, weil wochen_aktiv zaehlen soll, in
    -- wie vielen Runden ueberhaupt etwas abgegeben wurde.
    select distinct
      rf.runde_id,
      rf.frage_id,
      coalesce(f.medium, 'text') as medium,
      coalesce(f.antworttyp, 'multiple_choice') as antworttyp
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    where rf.runde_id in (select lr.id from letzte_runden lr)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
  )
  select
    p.name,
    count(a.id)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    (count(*) - count(a.id))::int,
    case
      when count(a.id) = 0 then 0::numeric
      else round(100.0 * count(a.id) filter (where a.korrekt is true)
                       / count(a.id), 1)
    end,
    count(distinct wf.runde_id) filter (where a.id is not null)::int,
    -- Die vier Typspalten sind bewusst ueberschneidungsfrei und ergeben in
    -- Summe wieder beantwortet: Icon-Fragen zuerst, dann alles mit Video,
    -- der Rest nach antworttyp.
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium <> 'video'
        and wf.antworttyp = 'multiple_choice')::int,
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium <> 'video'
        and wf.antworttyp = 'freitext')::int,
    count(a.id) filter (
      where wf.antworttyp <> 'entscheidung'
        and wf.medium = 'video')::int,
    count(a.id) filter (where wf.antworttyp = 'entscheidung')::int
  from personen p
  cross join wochenfragen wf
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by p.id, p.name
  order by p.name;
end;
$$;


drop function if exists public.obmann_staerken_schwaechen(text, integer, text);

create function public.obmann_staerken_schwaechen(
  p_schiedsrichter text default null,
  p_wochen integer default 12,
  p_passwort text default null,
  p_bis_runde uuid default null
)
returns table(
  thema text, gesamt integer, richtig integer, falsch integer,
  nicht_beantwortet integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_verein uuid := null;
  v_wochen int := least(greatest(coalesce(p_wochen, 12), 1), 52);
  v_grenze timestamptz := now();
begin
  if p_passwort is not null then
    v_verein := obmann_verein(p_passwort);
  end if;

  if p_bis_runde is not null then
    select least(v_grenze, r.startet_am) into v_grenze
    from runden r where r.id = p_bis_runde;
    if not found then
      raise exception 'Unbekannte Runde: %', p_bis_runde;
    end if;
  end if;

  return query
  with letzte_runden as (
    select r.id, r.startet_am
    from runden r
    where r.startet_am <= v_grenze
    order by r.startet_am desc
    limit v_wochen
  ),
  wochenfragen as (
    -- Das Thema kommt bevorzugt aus der frei gepflegten Kategorie. Fehlt
    -- sie, ist die Regelnummer der beste verfuegbare Regelbereich - sonst
    -- landeten zwei Drittel aller Fragen in einem nutzlosen Sammeltopf.
    select distinct
      rf.frage_id,
      coalesce(
        nullif(btrim(f.kategorie), ''),
        'Regel ' || rg.nummer::text || ' - ' || rg.bezeichnung,
        'Ohne Thema'
      ) as thema
    from runden_fragen rf
    join fragen f on f.id = rf.frage_id and f.aktiv
    left join regeln rg on rg.nummer = f.regel_nummer
    where rf.runde_id in (select lr.id from letzte_runden lr)
      and (v_verein is null or rf.verein_id = v_verein)
  ),
  personen as (
    select s.id, s.name
    from schiedsrichter s
    where s.ist_test = false
      and coalesce(s.aktiv, true)
      and (v_verein is null or s.verein_id = v_verein)
      and (p_schiedsrichter is null or s.name = p_schiedsrichter)
  )
  select
    wf.thema,
    count(*)::int,
    count(a.id) filter (where a.korrekt is true)::int,
    (count(a.id) - count(a.id) filter (where a.korrekt is true))::int,
    (count(*) - count(a.id))::int
  from wochenfragen wf
  cross join personen p
  left join antworten a
    on a.frage_id = wf.frage_id
   and a.schiedsrichter_id = p.id
  group by wf.thema
  order by wf.thema;
end;
$$;


-- ---------------------------------------------------------------------
-- 17. Rechte
--
-- Standard aus v82: kein PUBLIC, nur anon und authenticated. Die Funktionen
-- pruefen das Obmann-Passwort selbst; wer es nicht hat, kommt nicht weiter.
-- ---------------------------------------------------------------------

revoke all on function public.meldung_frage_abgeben(uuid, text, uuid, text, text) from public;
grant execute on function public.meldung_frage_abgeben(uuid, text, uuid, text, text) to anon, authenticated;

revoke all on function public.meine_frage_meldungen(uuid, text) from public;
grant execute on function public.meine_frage_meldungen(uuid, text) to anon, authenticated;

revoke all on function public.obmann_frage_meldungen(text, uuid) from public;
grant execute on function public.obmann_frage_meldungen(text, uuid) to anon, authenticated;

revoke all on function public.obmann_frage_meldung_eintrag_status_setzen(text, uuid, boolean) from public;
grant execute on function public.obmann_frage_meldung_eintrag_status_setzen(text, uuid, boolean) to anon, authenticated;

revoke all on function public.obmann_meldung_status_setzen(text, text, uuid, text) from public;
grant execute on function public.obmann_meldung_status_setzen(text, text, uuid, text) to anon, authenticated;

revoke all on function public.obmann_eingang(text, text, integer, boolean) from public;
grant execute on function public.obmann_eingang(text, text, integer, boolean) to anon, authenticated;

revoke all on function public.obmann_eingang_zaehler(text) from public;
grant execute on function public.obmann_eingang_zaehler(text) to anon, authenticated;

revoke all on function public.obmann_meldung_details(text, uuid) from public;
grant execute on function public.obmann_meldung_details(text, uuid) to anon, authenticated;

revoke all on function public.obmann_eingang_loeschen(text, text, uuid) from public;
grant execute on function public.obmann_eingang_loeschen(text, text, uuid) to anon, authenticated;

revoke all on function public.obmann_frage_in_bearbeitung_setzen(text, uuid, boolean) from public;
grant execute on function public.obmann_frage_in_bearbeitung_setzen(text, uuid, boolean) to anon, authenticated;

revoke all on function public.obmann_frage_verschieben(text, uuid, uuid) from public;
grant execute on function public.obmann_frage_verschieben(text, uuid, uuid) to anon, authenticated;

revoke all on function public.obmann_frage_neu_einordnen(text, uuid, uuid, uuid) from public;
grant execute on function public.obmann_frage_neu_einordnen(text, uuid, uuid, uuid) to anon, authenticated;

revoke all on function public.obmann_fragen_uebersicht(text) from public;
grant execute on function public.obmann_fragen_uebersicht(text) to anon, authenticated;

revoke all on function public.obmann_wochen_matrix(integer, text, uuid) from public;
grant execute on function public.obmann_wochen_matrix(integer, text, uuid) to anon, authenticated;

revoke all on function public.obmann_trend_wochen(text, uuid) from public;
grant execute on function public.obmann_trend_wochen(text, uuid) to anon, authenticated;

revoke all on function public.obmann_analyse_punkte(integer, text, uuid) from public;
grant execute on function public.obmann_analyse_punkte(integer, text, uuid) to anon, authenticated;

revoke all on function public.obmann_staerken_schwaechen(text, integer, text, uuid) from public;
grant execute on function public.obmann_staerken_schwaechen(text, integer, text, uuid) to anon, authenticated;
