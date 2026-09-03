-- v114, 03.09.2026 -- Die PIN-Pruefung wird flaechendeckend nullsicher.
--
-- WORUM ES GEHT
--
-- v113 hat den Befund beschrieben und den Helfer "schiri_pin_pruefen" gebaut,
-- aber nur drei Funktionen darauf umgestellt. Diese Migration zieht die
-- restlichen nach. Zur Erinnerung der Kern des Fehlers:
--
--   if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
--     raise exception 'PIN falsch';
--   end if;
--
-- Wird p_pin als NULL uebergeben, ergibt "v_pin <> p_pin" nicht false, sondern
-- NULL. Die ODER-Kette wird damit NULL, NULL ist nicht true, die Bedingung
-- greift nicht, und die Funktion laeuft durch, als waere der PIN richtig
-- gewesen. Das ist kein Raten und kein Zufall: Wer NULL schickt, kommt ohne
-- PIN hinein.
--
-- Am 03.09.2026 in einem eigens angelegten Testverein nachgemessen: Von den
-- 31 spielerseitigen Funktionen mit p_schiedsrichter_id und p_pin sind mit
-- p_pin = NULL alle 31 durchgelaufen, keine einzige hat abgebrochen.
--
--
-- WAS BEIM MESSEN ZUSAETZLICH AUFGEFALLEN IST -- DIE HAUSTUER SELBST
--
-- Auch "schiri_anmelden(p_kennung, p_name, p_pin)" traegt das Muster. Diese
-- Funktion stand in der Aufstellung von v113 nicht, weil sie keine
-- schiedsrichter_id entgegennimmt, sondern ueber Vereinskennung und Namen
-- sucht. Sie ist aber die Anmeldung selbst. Gemessen am 03.09.2026:
--
--   schiri_anmelden('<kennung>', '<name>', null)
--     -> 1 Zeile, erfolgreicher Login, ohne dass ein PIN bekannt war.
--
-- Damit ist die Lage ernster als in v113 beschrieben. Dort hiess es, man
-- brauche eine fremde schiedsrichter_id aus "schiri_liste". Das stimmt, ist
-- aber nicht einmal noetig: Vereinskennung und Name genuegen, und der Name
-- steht ohnehin in der Namensliste der Anmeldemaske. Die Anmeldung wird
-- deshalb hier mitrepariert, obwohl sie nicht im urspruenglichen Auftrag
-- stand -- eine sanierte Innentuer bei offener Haustuer waere sinnlos.
--
--
-- WARUM DER BESTAND ERSETZT UND NICHT NEU GESCHRIEBEN WIRD
--
-- 31 Funktionsruempfe von Hand abzutippen ist der sichere Weg in einen
-- stillen Folgefehler: Ein vertipptes Vorzeichen, eine vergessene Zeile, und
-- die Funktion tut etwas anderes als vorher, ohne dass es jemand merkt.
-- Deshalb dasselbe Verfahren wie in v110: Die bestehende Definition wird mit
-- pg_get_functiondef gelesen, es wird genau ein woertlich bekanntes
-- Textstueck ersetzt, und das Ergebnis wird mit execute zurueckgespielt.
-- Alles ausserhalb des Anmeldeblocks bleibt damit Byte fuer Byte, wie es war.
--
-- Trifft die Ersetzung nicht genau einmal, bricht die Migration mit einem
-- Fehler ab, statt zu raten. Ebenso, wenn eine Funktion unter ihrem Namen
-- mehrfach existiert (Ueberladung) oder gar nicht gefunden wird.
--
-- Ein lockerer regulaerer Ausdruck ueber alle waere hier gefaehrlich, denn
-- der Anmeldeblock ist ueber die Jahre in sechs Spielarten abgeschrieben
-- worden. Erhoben am 03.09.2026 aus pg_get_functiondef:
--
--   A1  einzeilig, mit aktiv-Pruefung, Meldung 'PIN falsch'         2 Stueck
--   A2  mehrzeilig, mit aktiv-Pruefung, Meldung 'PIN falsch'       16 Stueck
--   A3  mehrzeilig, mit aktiv-Pruefung, Meldung 'PIN ungueltig'     9 Stueck
--   A4  einzeilig, OHNE aktiv-Pruefung, Meldung 'PIN falsch'        1 Stueck
--   A5  einzeilig ohne Leerzeichen, mit aktiv, 'PIN falsch'         2 Stueck
--   A6  einzeilig ohne Leerzeichen, OHNE aktiv, 'PIN falsch'        1 Stueck
--                                                          Summe:  31 Stueck
--
-- Jede Spielart bekommt ihren eigenen, woertlichen Suchtext und ihre eigene
-- namentliche Liste. Die Suchtexte sind gegenseitig ausschliessend: A1
-- verlangt "then raise" in derselben Zeile, A2 verlangt einen Zeilenumbruch
-- danach, A5 und A6 verlangen "v_pin<>p_pin" ohne Leerzeichen.
--
--
-- WAS SICH FACHLICH AENDERT -- UND WAS AUSDRUECKLICH NICHT
--
-- Ersetzt wird ausschliesslich der Anmeldeblock. Signaturen, Rueckgabetypen,
-- Vorgabewerte, Abfragen, Einfuegungen und Fehlermeldungen der Fachlogik
-- bleiben unveraendert.
--
-- Das "select s.pin, s.aktiv, s.verein_id into ..." VOR dem Anmeldeblock
-- bleibt bewusst stehen, obwohl der Helfer die Person ohnehin noch einmal
-- liest. Die Ruempfe verwenden v_verein, v_aktiv und v_ist_test spaeter
-- weiter; wuerde man das select mitentfernen, muesste man jeden Rumpf
-- anfassen -- genau das Risiko, das dieses Verfahren vermeiden soll. Der
-- Preis ist ein zweiter, sehr kleiner Lesezugriff pro Aufruf. Aufraeumen
-- kann man das spaeter in Ruhe und einzeln.
--
-- Die Fehlermeldungen bleiben woertlich so, wie sie waren:
--   * 22 Funktionen werfen weiterhin 'PIN falsch' (das wirft der Helfer selbst),
--   * die 9 Funktionen der Spielart A3 werfen weiterhin 'PIN ungueltig'.
-- Dafuer wird beim Aufruf des Helfers in A3 der Fehler abgefangen und mit der
-- alten Meldung neu geworfen -- gezielt nur SQLSTATE P0001 (raise_exception),
-- also genau das, was der Helfer wirft, und nicht "when others". Der Grund
-- ist nicht Kosmetik: "tests/api-sicherheit.test.js" prueft die Meldung
-- 'PIN ungueltig' woertlich, und aeltere App-Staende sollen unveraendert
-- weiterlaufen. Ausserdem soll die Meldung fuer alle Fehlerfaelle dieselbe
-- bleiben, damit sich gueltige ids und Namen nicht durchprobieren lassen.
--
-- Zwei Aenderungen im Anmeldeverhalten sind beabsichtigt und hier offen
-- benannt, weil sie ueber das reine Schliessen der NULL-Luecke hinausgehen:
--
--   1. "meine_antworten" und "meine_antworten_v2" (Spielarten A4 und A6)
--      hatten bisher KEINE aktiv-Pruefung. Ueber den Helfer bekommen sie
--      eine. Eine deaktivierte Person kann ihre eigenen Antworten damit
--      nicht mehr abrufen. Das ist gewollt: Genau dieselbe Person wird von
--      allen anderen Funktionen bereits abgewiesen, und ein gesperrter
--      Zugang, der noch lesen darf, ist kein gesperrter Zugang.
--   2. Alle Funktionen weisen jetzt auch einen leeren PIN ('' oder nur
--      Leerzeichen) und eine unbekannte Person ab. Vorher rutschte eine
--      unbekannte Person nur zufaellig in den Fehler, weil v_pin dann NULL
--      blieb.
--
--
-- RECHTE
--
-- pg_get_functiondef liefert "CREATE OR REPLACE FUNCTION". Ersetzt wird also
-- an Ort und Stelle, ohne drop. Damit bleiben Eigentuemer, SECURITY DEFINER,
-- search_path, Volatilitaet und vor allem die Zugriffsrechte (pg_proc.proacl)
-- unveraendert erhalten -- exakt so, wie sie vorher waren. Deshalb steht in
-- dieser Migration bewusst KEIN revoke und KEIN grant: Jedes von Hand
-- nachgezogene Recht waere eine Gelegenheit, versehentlich ein anderes Recht
-- zu setzen als das vorhandene. Die Rechte werden nach dem Lauf
-- stichprobenfrei mit has_function_privilege gegen den Vorher-Stand
-- verglichen.
--
-- OFFEN, NICHT IN DIESER MIGRATION: 11 der betroffenen Funktionen tragen
-- noch ein "execute" fuer PUBLIC (proacl enthaelt "=X/postgres"), statt nur
-- fuer anon und authenticated. Das ist eine eigene, aeltere Unsauberkeit und
-- wird hier absichtlich nicht angefasst -- Rechte aendern und Ruempfe
-- umbauen in einem Zug macht im Fehlerfall unauffindbar, welches von beidem
-- schuld war. Gehoert in eine eigene Migration.


-- ---------------------------------------------------------------------------
-- 1) Die 31 spielerseitigen Funktionen, nach Spielart
-- ---------------------------------------------------------------------------

do $migration$
declare
  -- Der Ersatz fuer die 22 Funktionen, die 'PIN falsch' werfen: Der Helfer
  -- wirft diese Meldung selbst, also genuegt der nackte Aufruf.
  v_neu_falsch text := 'perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);';

  -- Der Ersatz fuer die 9 Funktionen der Spielart A3: gleiche Pruefung, aber
  -- die alte Meldung bleibt nach aussen sichtbar.
  v_neu_ungueltig text := E'begin\n'
    || E'    perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);\n'
    || E'  exception when raise_exception then\n'
    || E'    raise exception ''PIN ungueltig'';\n'
    || E'  end;';

  v_spielart text;
  v_alt text;
  v_neu text;
  v_namen text[];
  v_name text;
  v_def text;
  v_treffer integer;
  v_anzahl integer;
  v_gesamt integer := 0;
  i integer;
begin
  for i in 1..6 loop
    case i

      when 1 then
        v_spielart := 'A1 einzeilig, mit aktiv-Pruefung, Meldung PIN falsch';
        v_alt := 'if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then raise exception ''PIN falsch''; end if;';
        v_neu := v_neu_falsch;
        v_namen := array[
          'erklaerung_kontext_laden',
          'wochen_fragen_v2'
        ];

      when 2 then
        v_spielart := 'A2 mehrzeilig, mit aktiv-Pruefung, Meldung PIN falsch';
        v_alt := E'if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then\n'
              || E'    raise exception ''PIN falsch'';\n'
              || E'  end if;';
        v_neu := v_neu_falsch;
        v_namen := array[
          'antwort_abgeben',
          'entscheidung_antwort_speichern',
          'entscheidung_kontext_laden',
          'freitext_antwort_speichern',
          'freitext_ergaenzung_speichern',
          'freitext_kontext_laden',
          'freitext_nachbesserung_kontext',
          'historie_antwort_abgeben',
          'historie_fortschritt_uebersicht',
          'historie_freitext_antwort_speichern',
          'historie_freitext_kontext_laden',
          'historie_naechste_frage',
          'szenario_antwort_pruefen',
          'szenario_naechstes',
          'szenario_statistik',
          'wochen_fragen'
        ];

      when 3 then
        v_spielart := 'A3 mehrzeilig, mit aktiv-Pruefung, Meldung PIN ungueltig';
        v_alt := E'if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then\n'
              || E'    raise exception ''PIN ungueltig'';\n'
              || E'  end if;';
        v_neu := v_neu_ungueltig;
        v_namen := array[
          'schiri_anfrage_erstellen',
          'schiri_anfrage_rechnung_hochladen',
          'schiri_anfragen_als_gesehen_markieren',
          'schiri_anfragen_liste',
          'termin_rueckmeldung_setzen',
          'termin_zusagen',
          'termine_fuer_schiri',
          'terminfindung_stimme_setzen',
          'terminfindungen_fuer_schiri'
        ];

      when 4 then
        v_spielart := 'A4 einzeilig, OHNE aktiv-Pruefung, Meldung PIN falsch';
        v_alt := 'if v_pin is null or v_pin <> p_pin then raise exception ''PIN falsch''; end if;';
        v_neu := v_neu_falsch;
        v_namen := array[
          'meine_antworten'
        ];

      when 5 then
        v_spielart := 'A5 einzeilig ohne Leerzeichen, mit aktiv-Pruefung, Meldung PIN falsch';
        v_alt := 'if v_pin is null or v_pin<>p_pin or not coalesce(v_aktiv,false) then raise exception ''PIN falsch''; end if;';
        v_neu := v_neu_falsch;
        v_namen := array[
          'antwort_auswahl_abgeben',
          'antwort_zahl_abgeben'
        ];

      when 6 then
        v_spielart := 'A6 einzeilig ohne Leerzeichen, OHNE aktiv-Pruefung, Meldung PIN falsch';
        v_alt := 'if v_pin is null or v_pin<>p_pin then raise exception ''PIN falsch''; end if;';
        v_neu := v_neu_falsch;
        v_namen := array[
          'meine_antworten_v2'
        ];

    end case;

    foreach v_name in array v_namen loop

      -- Ueberladungen wuerden dazu fuehren, dass unten die falsche Definition
      -- erwischt wird. Lieber abbrechen als raten.
      select count(*) into v_anzahl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name;

      if v_anzahl <> 1 then
        raise exception 'v114: % ist % mal in public vorhanden statt genau einmal (Spielart %) - bitte von Hand pruefen',
          v_name, v_anzahl, v_spielart;
      end if;

      select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name;

      -- Der eigentliche Schutz vor stillen Folgefehlern: Der Suchtext muss
      -- genau einmal vorkommen. Null Treffer hiesse, die Definition sieht
      -- anders aus als erhoben; mehr als einer hiesse, wir wuessten nicht,
      -- welche Stelle gemeint ist.
      v_treffer := (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt);

      if v_treffer <> 1 then
        raise exception 'v114: Anmeldeblock der Spielart % in % % mal gefunden statt genau einmal - Definition weicht ab, bitte von Hand pruefen',
          v_spielart, v_name, v_treffer;
      end if;

      execute replace(v_def, v_alt, v_neu);
      v_gesamt := v_gesamt + 1;

    end loop;
  end loop;

  if v_gesamt <> 31 then
    raise exception 'v114: % Funktionen umgebaut statt der erwarteten 31', v_gesamt;
  end if;

  raise notice 'v114: % Funktionen auf schiri_pin_pruefen umgestellt', v_gesamt;
end;
$migration$;


-- ---------------------------------------------------------------------------
-- 2) Die Anmeldung selbst
-- ---------------------------------------------------------------------------
--
-- "schiri_anmelden" kann den Helfer nicht verwenden: Der Helfer erwartet eine
-- schiedsrichter_id, und genau die soll diese Funktion ja erst ermitteln. Sie
-- bekommt deshalb dieselbe Pruefung an Ort und Stelle -- p_pin gegen NULL und
-- Leerstring, und der Vergleich mit "is distinct from" statt "<>", das auch
-- dann true liefert, wenn eine Seite NULL ist.
--
-- Auch hier nur eine woertliche Ersetzung einer einzigen Zeile. Die Meldung
-- 'Name oder PIN stimmt nicht' bleibt unveraendert -- sie ist bewusst
-- dieselbe fuer falsche Kennung, falschen Namen, falschen PIN und gesperrten
-- Zugang, damit sich nicht durch Ausprobieren herausfinden laesst, welche
-- Namen es in einem Verein gibt.

do $migration$
declare
  v_def text;
  v_alt text := 'if v_id is null or v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then';
  v_neu text := E'if p_pin is null or btrim(p_pin) = '''' or v_id is null or v_pin is null\n'
             || E'     or v_pin is distinct from p_pin or not coalesce(v_aktiv, false) then';
  v_treffer integer;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'schiri_anmelden'
    and pg_get_function_identity_arguments(p.oid) = 'p_kennung text, p_name text, p_pin text';

  if v_def is null then
    raise exception 'v114: schiri_anmelden(text, text, text) nicht gefunden - Migration passt nicht zum Stand der Datenbank';
  end if;

  v_treffer := (length(v_def) - length(replace(v_def, v_alt, ''))) / length(v_alt);

  if v_treffer <> 1 then
    raise exception 'v114: Anmeldeblock in schiri_anmelden % mal gefunden statt genau einmal - bitte von Hand pruefen', v_treffer;
  end if;

  execute replace(v_def, v_alt, v_neu);
end;
$migration$;


-- ---------------------------------------------------------------------------
-- 3) Nachweis, dass nichts uebersehen wurde
-- ---------------------------------------------------------------------------
--
-- Diese Pruefung ist der eigentliche Beleg der Migration. Sie sucht nicht
-- nach dem, was ersetzt wurde, sondern nach dem, was noch da sein koennte:
-- irgendeine Funktion mit einem p_pin-Parameter, die den nicht nullsicheren
-- Vergleich noch im Rumpf traegt. Findet sie eine, bricht die Migration ab
-- und wird zurueckgerollt.

do $pruefung$
declare
  v_rest text;
  v_ohne_helfer text;
begin
  select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' order by p.proname)
    into v_rest
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_function_identity_arguments(p.oid) like '%p_pin %'
    and (pg_get_functiondef(p.oid) like '%v_pin <> p_pin%'
      or pg_get_functiondef(p.oid) like '%v_pin<>p_pin%');

  if v_rest is not null then
    raise exception 'v114: Diese Funktionen tragen den nicht nullsicheren Vergleich noch: %', v_rest;
  end if;

  -- Und die Gegenprobe: Jede Funktion mit p_schiedsrichter_id und p_pin muss
  -- den Helfer jetzt tatsaechlich aufrufen. Sonst haette eine Ersetzung zwar
  -- den alten Text entfernt, aber nichts an seine Stelle gesetzt.
  select string_agg(p.proname, ', ' order by p.proname) into v_ohne_helfer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_function_identity_arguments(p.oid) like 'p_schiedsrichter_id uuid%'
    and pg_get_function_identity_arguments(p.oid) like '%p_pin %'
    and p.proname <> 'schiri_pin_pruefen'
    and pg_get_functiondef(p.oid) not like '%schiri_pin_pruefen%';

  if v_ohne_helfer is not null then
    raise exception 'v114: Diese Funktionen rufen schiri_pin_pruefen nicht auf: %', v_ohne_helfer;
  end if;

  -- Die Anmeldung gesondert, sie benutzt den Helfer bauartbedingt nicht.
  if (select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'schiri_anmelden')
     not like '%v_pin is distinct from p_pin%' then
    raise exception 'v114: schiri_anmelden vergleicht den PIN nicht nullsicher';
  end if;
end;
$pruefung$;
