-- v113, 03.09.2026 -- Die PIN-Pruefung wird nullsicher.
--
-- BEFUND (gefunden beim Pruefen von v112, 03.09.2026)
--
-- Das im Projekt ueberall verwendete Anmeldemuster lautet:
--
--   if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
--     raise exception 'PIN falsch';
--   end if;
--
-- Wird p_pin als NULL uebergeben, ergibt "v_pin <> p_pin" nicht false, sondern
-- NULL. NULL ist nicht true, die Bedingung greift also nicht, und die Funktion
-- laeuft durch, als waere der PIN richtig gewesen. Es ist keine Frage von
-- Raten: Wer NULL schickt, kommt ohne PIN hinein.
--
-- Nachgewiesen am 03.09.2026 mit einer eigens angelegten Testperson:
-- "wochen_fragen_v2(<id>, null)" lieferte die Fragen der laufenden Woche,
-- ohne dass ein PIN bekannt war.
--
-- Die dazugehoerige schiedsrichter_id ist nicht geheim. "schiri_liste(kennung)"
-- ist fuer die Rolle anon ausfuehrbar und gibt id und Name aller aktiven
-- Personen eines Vereins zurueck -- das muss sie auch, es ist die Namensliste
-- der Anmeldemaske. Die Angriffskette ist damit vollstaendig und kurz:
-- Vereinskennung -> schiri_liste -> fremde schiedsrichter_id -> beliebige
-- PIN-Funktion mit p_pin = NULL. Der PIN wird dabei nie gebraucht.
--
--
-- WAS DIESE MIGRATION REPARIERT -- UND WAS NICHT
--
-- Das Muster steckt in 35 Funktionen. Diese Migration saniert die drei, die in
-- v111 und v112 entstanden sind, also die, die mit diesem Fehler neu gebaut
-- wurden: "meldung_frage_abgeben", "meldebogen_abgeben" und
-- "meine_frage_meldungen".
--
-- 🔴 Die uebrigen 32 Funktionen sind NICHT saniert -- darunter schreibende wie
-- "antwort_abgeben", "freitext_antwort_speichern", "schiri_anfrage_erstellen",
-- "termin_rueckmeldung_setzen" und lesende wie "meine_antworten_v2" oder
-- "wochen_fragen_v2". Sie brauchen eine eigene Migration. Das hier nicht
-- gleich mitzuerledigen ist eine bewusste Entscheidung und keine Schlamperei:
-- Jede dieser Funktionen muesste im Ganzen neu geschrieben werden (drop +
-- create), und 32 Funktionen in einem Zug neu zu schreiben, ohne sie einzeln
-- durchprobieren zu koennen, waere ein groesseres Risiko als die Luecke, die
-- ohnehin seit Monaten besteht. Was hier entsteht, ist das Werkzeug dafuer:
-- der Helfer unten. Die Sanierung der uebrigen ist danach mechanisch --
-- Anmeldeblock raus, ein Aufruf rein.
--
--
-- WARUM EIN ZENTRALER HELFER STATT DREIMAL DIESELBE KORREKTUR
--
-- Der Fehler ist genau deshalb entstanden, weil der Anmeldeblock ueberall
-- abgeschrieben wurde. Wird er dreimal einzeln korrigiert, ist er beim vierten
-- Abschreiben wieder da. "schiri_pin_pruefen" gibt es deshalb genau einmal;
-- es prueft und liefert nebenbei die verein_id zurueck, die die aufrufenden
-- Funktionen ohnehin alle brauchen. Ein kuenftiger Fehler in der Anmeldung
-- laesst sich dann an einer Stelle beheben statt an fuenfunddreissig.
--
-- Der Helfer bekommt ausdruecklich KEIN "grant execute" an anon oder
-- authenticated. Er ist kein Endpunkt, sondern Innenleben; ueber PostgREST
-- soll er gar nicht erreichbar sein (Linie aus v81, interne RPC-Flaeche klein
-- halten). Aufgerufen wird er ausschliesslich aus SECURITY DEFINER-Funktionen,
-- die als Eigentuemer laufen und die Rechte dafuer haben.
--
--
-- WAS GENAU GEPRUEFT WIRD
--
--   * p_pin ist NULL oder leer          -> Fehler. Das ist der Kern des Befunds.
--   * es gibt die Person gar nicht      -> Fehler (vorher: NOT FOUND, v_pin
--                                          blieb NULL, wurde nur zufaellig
--                                          mitgefangen).
--   * die Person hat keinen PIN         -> Fehler.
--   * PIN stimmt nicht                  -> Fehler, verglichen mit
--                                          "is distinct from", das auch dann
--                                          true liefert, wenn eine Seite NULL
--                                          ist.
--   * die Person ist nicht aktiv        -> Fehler.
--
-- Die Fehlermeldung bleibt woertlich "PIN falsch" -- dieselbe wie bisher und
-- fuer alle Faelle dieselbe. Erstens laufen aeltere App-Staende dadurch
-- unveraendert weiter, zweitens soll die Meldung nicht verraten, ob es die
-- Person ueberhaupt gibt: "Person unbekannt" gegen "PIN falsch" waere ein
-- bequemer Weg, gueltige ids durchzuprobieren.
--
-- Fachlich aendert sich an den drei Funktionen sonst nichts. Signaturen,
-- Rueckgabetypen und Verhalten bleiben gleich; wer den richtigen PIN schickt,
-- merkt keinen Unterschied. drop + create statt create or replace wie ueblich
-- (PGRST202-Lehre aus v85), danach fuer jede Funktion wieder revoke from
-- public und grant execute an anon und authenticated -- ein create function,
-- das durchlaeuft, sagt ueber die Rechte nichts (v107b).


-- ---------------------------------------------------------------------------
-- 1) Der Helfer
-- ---------------------------------------------------------------------------

drop function if exists public.schiri_pin_pruefen(uuid, text);

create function public.schiri_pin_pruefen(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
begin
  -- Der eigentliche Befund: ohne diese Zeile wird aus einem fehlenden PIN
  -- ein gueltiger.
  if p_pin is null or btrim(p_pin) = '' then
    raise exception 'PIN falsch';
  end if;

  select s.pin, s.aktiv, s.verein_id
    into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;

  if not found
     or v_pin is null
     or v_pin is distinct from p_pin
     or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

  return v_verein;
end;
$function$;

revoke all on function public.schiri_pin_pruefen(uuid, text) from public;
-- Bewusst kein grant an anon oder authenticated: interner Helfer, kein Endpunkt.

comment on function public.schiri_pin_pruefen(uuid, text) is
'Zentrale Anmeldepruefung fuer spielerseitige RPCs. Wirft "PIN falsch" bei leerem oder NULL-PIN, unbekannter Person, fehlendem PIN, falschem PIN (nullsicherer Vergleich mit is distinct from) oder inaktiver Person; sonst wird die verein_id zurueckgegeben. Absichtlich nicht an anon oder authenticated vergeben. Siehe v113.';


-- ---------------------------------------------------------------------------
-- 2) meldung_frage_abgeben auf den Helfer umstellen
-- ---------------------------------------------------------------------------

drop function if exists public.meldung_frage_abgeben(uuid, text, uuid, text, text);

create function public.meldung_frage_abgeben(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_frage_id uuid,
  p_kategorie text,
  p_text text
)
returns table (
  meldung_id uuid,
  neu_angelegt boolean,
  anzahl_eintraege integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Gibt es schon einen offenen Kopfsatz dieser Person zu dieser Frage?
  select m.id into v_meldung
  from frage_meldungen m
  where m.frage_id = p_frage_id
    and m.schiedsrichter_id = p_schiedsrichter_id
    and m.status = 'offen'
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
    on conflict (frage_id, schiedsrichter_id) where status = 'offen' do nothing
    returning id into v_meldung;

    if v_meldung is null then
      -- Zwei gleichzeitige Meldungen: die andere war schneller, wir haengen
      -- unseren Eintrag an ihren Kopfsatz.
      select m.id into v_meldung
      from frage_meldungen m
      where m.frage_id = p_frage_id
        and m.schiedsrichter_id = p_schiedsrichter_id
        and m.status = 'offen';
    else
      v_neu := true;
    end if;
  end if;

  insert into frage_meldung_eintraege (meldung_id, kategorie, text)
  values (v_meldung, p_kategorie, v_text);

  update frage_meldungen m set aktualisiert_am = now() where m.id = v_meldung;

  select count(*)::integer into v_anzahl
  from frage_meldung_eintraege e where e.meldung_id = v_meldung;

  return query select v_meldung, v_neu, v_anzahl;
end;
$function$;

revoke all on function public.meldung_frage_abgeben(uuid, text, uuid, text, text) from public;
grant execute on function public.meldung_frage_abgeben(uuid, text, uuid, text, text) to anon, authenticated;

comment on function public.meldung_frage_abgeben(uuid, text, uuid, text, text) is
'Legt eine Rueckmeldung zu einer Frage an oder erweitert die vorhandene offene derselben Person zu derselben Frage um einen Eintrag. gegebene_antwort und loesung_snapshot werden serverseitig gefuellt und nicht vom Aufrufer entgegengenommen. Rueckgabe: meldung_id, neu_angelegt, anzahl_eintraege. Anmeldung ueber schiri_pin_pruefen. Siehe v111, v113.';


-- ---------------------------------------------------------------------------
-- 3) meldebogen_abgeben auf den Helfer umstellen
-- ---------------------------------------------------------------------------

drop function if exists public.meldebogen_abgeben(uuid, text, text, text, boolean, text, text, text, text, boolean, boolean);

create function public.meldebogen_abgeben(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_art text,
  p_situation text,
  p_anonym boolean default false,
  p_spielklasse text default null,
  p_eigene_entscheidung text default null,
  p_unsicher_warum text default null,
  p_beteiligte text default null,
  p_sonderbericht_geschrieben boolean default null,
  p_veroeffentlichung_erlaubt boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_person uuid;
  v_anonym boolean := coalesce(p_anonym, false);
  v_situation text;
  v_veroeffentlichung boolean := coalesce(p_veroeffentlichung_erlaubt, false);
  v_spielklasse text := nullif(btrim(coalesce(p_spielklasse, '')), '');
  v_eigene text := nullif(btrim(coalesce(p_eigene_entscheidung, '')), '');
  v_beteiligte text := nullif(btrim(coalesce(p_beteiligte, '')), '');
  v_frist date := null;
  v_id uuid;
begin
  -- Auch eine anonyme Meldung braucht eine gueltige Anmeldung. Der Login sagt
  -- der Datenbank, um welchen Verein es geht, und verhindert, dass ein Gast
  -- oder ein Fremder schreiben kann. Gespeichert wird die Person danach nicht.
  v_verein := schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if p_art is null or p_art not in ('regelfall','vorfall','gespraech','website') then
    raise exception 'Unbekannte Meldungsart';
  end if;

  v_situation := btrim(coalesce(p_situation, ''));
  if char_length(v_situation) < 1 or char_length(v_situation) > 4000 then
    raise exception 'Situation muss zwischen 1 und 4000 Zeichen lang sein';
  end if;

  -- Anonym wird serverseitig durchgesetzt, egal was hereinkommt.
  v_person := case when v_anonym then null else p_schiedsrichter_id end;

  -- Ein Vorfall wird nie veroeffentlicht -- auch dann nicht, wenn der Client
  -- true schickt. Die CHECK-Bedingung wuerde den Datensatz sonst ablehnen und
  -- die Meldung ginge verloren; wichtiger ist, dass sie ankommt.
  if p_art = 'vorfall' then
    v_veroeffentlichung := false;
  end if;

  -- Ein Website-Hinweis ist kein Spielvorgang.
  if p_art = 'website' then
    v_spielklasse := null;
    v_eigene := null;
    v_beteiligte := null;
  end if;

  -- Zwei Jahre: deckt die Folgesaison ab, in der ein Wiederholungsfall noch
  -- als Muster erkennbar sein muss, und laeuft danach ab. Begruendung
  -- ausfuehrlich im Kopfkommentar von v111.
  if p_art in ('vorfall','gespraech') then
    v_frist := current_date + interval '2 years';
  end if;

  insert into meldungen (
    verein_id, art, schiedsrichter_id, anonym, spielklasse, situation,
    eigene_entscheidung, unsicher_warum, beteiligte,
    sonderbericht_geschrieben, veroeffentlichung_erlaubt, status,
    aufbewahren_bis
  )
  values (
    v_verein, p_art, v_person, v_anonym, v_spielklasse, v_situation,
    v_eigene, nullif(btrim(coalesce(p_unsicher_warum, '')), ''), v_beteiligte,
    p_sonderbericht_geschrieben, v_veroeffentlichung, 'offen',
    v_frist
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.meldebogen_abgeben(uuid, text, text, text, boolean, text, text, text, text, boolean, boolean) from public;
grant execute on function public.meldebogen_abgeben(uuid, text, text, text, boolean, text, text, text, text, boolean, boolean) to anon, authenticated;

comment on function public.meldebogen_abgeben(uuid, text, text, text, boolean, text, text, text, text, boolean, boolean) is
'Nimmt einen Meldebogen entgegen. p_anonym = true setzt schiedsrichter_id serverseitig auf null. Bei art = vorfall wird veroeffentlichung_erlaubt serverseitig auf false gezwungen, bei art = website werden Spielklasse, eigene Entscheidung und Beteiligte verworfen. aufbewahren_bis wird bei vorfall und gespraech auf current_date + 2 Jahre gesetzt. Anmeldung ueber schiri_pin_pruefen. Siehe v111, v113.';


-- ---------------------------------------------------------------------------
-- 4) meine_frage_meldungen auf den Helfer umstellen
-- ---------------------------------------------------------------------------

drop function if exists public.meine_frage_meldungen(uuid, text);

create function public.meine_frage_meldungen(
  p_schiedsrichter_id uuid,
  p_pin text
)
returns table (
  frage_id uuid,
  status text,
  anzahl_eintraege integer,
  erstellt_am timestamptz,
  aktualisiert_am timestamptz,
  eintraege jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
                       'erstellt_am', e.erstellt_am)
                     order by e.erstellt_am, e.id)
              from frage_meldung_eintraege e where e.meldung_id = fm.id), '[]'::jsonb)
  from frage_meldungen fm
  -- Der einzige Filter, auf den es ankommt. Kein verein-weiter Blick, kein
  -- Blick auf dieselbe Frage bei anderen Leuten.
  where fm.schiedsrichter_id = p_schiedsrichter_id
  order by fm.aktualisiert_am desc, fm.erstellt_am desc;
end;
$function$;

revoke all on function public.meine_frage_meldungen(uuid, text) from public;
grant execute on function public.meine_frage_meldungen(uuid, text) to anon, authenticated;

comment on function public.meine_frage_meldungen(uuid, text) is
'Eigene Frage-Rueckmeldungen einer Person, damit die Website eine bereits gemeldete Frage als gemeldet markieren kann. Liefert ausschliesslich Meldungen dieser Person, niemals fremde und keine Zahl ueber fremde. Aus Max Bearbeitung kommt nur der Status zurueck. loesung_snapshot und gegebene_antwort werden bewusst nicht ausgeliefert -- der Schnappschuss enthaelt die Loesung der Frage und wuerde das laufende Quiz aufloesbar machen. Anmeldung ueber schiri_pin_pruefen. Siehe v112, v113.';
