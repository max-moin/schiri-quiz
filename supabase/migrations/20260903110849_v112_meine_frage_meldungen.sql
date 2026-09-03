-- v112, 03.09.2026 -- Der Rueckweg zur eigenen Meldung.
--
-- Anlass: v111 hat den Rueckkanal gebaut, aber nur in eine Richtung. Eine
-- Person kann eine Frage melden -- und sieht danach nichts. Die Frage sieht
-- hinterher genauso aus wie vorher. Wer nicht sieht, dass seine Meldung
-- angekommen ist, meldet dieselbe Sache noch einmal, und noch einmal, weil er
-- vernuenftigerweise annimmt, sie sei untergegangen. Und wenn auch das nichts
-- sichtbar veraendert, meldet er irgendwann gar nichts mehr. Ein Rueckkanal
-- ohne Empfangsbestaetigung erzieht die Leute dazu, ihn nicht zu benutzen --
-- das ist kein Schoenheitsfehler, das ist der Ausfall der ganzen Funktion.
--
-- Diese Migration liefert deshalb genau eine Funktion:
-- "meine_frage_meldungen(p_schiedsrichter_id, p_pin)". Die Website markiert
-- damit jede Frage, zu der diese Person schon etwas gemeldet hat, sichtbar als
-- "gemeldet", und zeigt daneben, was sie selbst geschrieben hat und wie weit
-- Max damit ist.
--
--
-- WARUM AUSSCHLIESSLICH DIE EIGENEN MELDUNGEN
--
-- Die Funktion filtert hart auf "schiedsrichter_id = p_schiedsrichter_id". Sie
-- liefert keine fremden Meldungen, auch nicht zur selben Frage, und sie liefert
-- keine Zahl darueber, wie viele andere dieselbe Frage gemeldet haben.
-- Das ist keine uebertriebene Vorsicht. Eine Anzeige "zu dieser Frage gibt es
-- 3 Meldungen" klingt harmlos und ist trotzdem ein Verzeichnis darueber, wer
-- sich beschwert -- man muss nur ueber ein paar Wochen mitzaehlen, um zu
-- sehen, wer nach welchem Spieltag etwas gemeldet hat. Wer damit rechnen muss,
-- meldet nichts Unangenehmes mehr. Die Zahl "anzahl_eintraege" zaehlt deshalb
-- ausschliesslich die Beitraege an der eigenen Meldung; ein Beitrag haengt
-- immer an genau einem Kopfsatz und ein Kopfsatz gehoert immer genau einer
-- Person, ein Fremdanteil ist darin also gar nicht darstellbar.
--
--
-- WARUM DER LOESUNGS-SCHNAPPSCHUSS HIER NICHT ZURUECKKOMMT
--
-- Das ist der Punkt, an dem diese Funktion am leichtesten kaputtgeht. Rein
-- formal gehoert "loesung_snapshot" zur eigenen Meldung -- er ist beim eigenen
-- Melden entstanden. Ausgeliefert werden darf er trotzdem nicht: Er enthaelt
-- die richtige Option, die Musterantwort und die Bewertungshinweise der Frage.
-- Wuerde er hier mitkommen, waere das Quiz der laufenden Woche mit zwei Klicks
-- geloest -- Frage melden, eigene Meldung abrufen, Loesung ablesen. Aus einer
-- Empfangsbestaetigung wuerde ein Loesungsautomat. "gegebene_antwort" bleibt
-- aus demselben Grund draussen: Sie wird nicht gebraucht (die Person kennt ihre
-- eigene Antwort ohnehin) und jedes Feld, das nicht gebraucht wird, ist ein
-- Feld, das spaeter jemand versehentlich erweitert.
-- Geliefert wird deshalb nur: frage_id, status, anzahl_eintraege, die beiden
-- Zeitstempel und die eigenen Beitraege mit Kategorie und Text.
--
--
-- WARUM NICHTS AUS MAX' BEARBEITUNG AUSSER DEM STATUS
--
-- Zurueck geht "offen", "erledigt" oder "abgelehnt" -- mehr nicht. Keine
-- internen Notizen, keine Begruendung einer Ablehnung. Zwei Gruende: Erstens
-- muss Max sich beim Abarbeiten Notizen machen koennen, ohne jedes Wort als
-- Antwort an die Person formulieren zu muessen -- sonst schreibt er lieber
-- nichts, und dann fehlt die Notiz auch ihm. Zweitens ist "abgelehnt" ohne
-- Begruendung ehrlicher als eine halbe Begruendung: Wenn Max jemandem etwas
-- erklaeren will, tut er das persoenlich und nicht ueber ein Statusfeld.
-- Die Tabelle "frage_meldungen" fuehrt heute ohnehin kein Notizfeld. Dieser
-- Absatz steht hier fuer den Tag, an dem eines dazukommt: Es gehoert dann
-- nicht in diese Funktion.
--
--
-- WARUM ALLE STATUS UND NICHT NUR DIE OFFENEN
--
-- Geliefert werden auch erledigte und abgelehnte Meldungen. Genau die braucht
-- die Anzeige: "gemeldet und erledigt" ist die Rueckmeldung, auf die jemand
-- gewartet hat. Wuerde eine Meldung beim Erledigen aus der Liste verschwinden,
-- saehe die Frage wieder aus wie nie gemeldet -- und die Person faengt von
-- vorne an. Weil es je Frage und Person nach dem Erledigen wieder einen neuen
-- offenen Kopfsatz geben darf (partieller Unique-Index aus v111), koennen zu
-- derselben frage_id mehrere Zeilen zurueckkommen. Sortiert wird neueste
-- zuerst; die Oberflaeche gruppiert nach frage_id.
--
--
-- Anmeldung nach demselben Muster wie "meldung_frage_abgeben" und
-- "wochen_fragen_v2": PIN muss stimmen UND die Person muss aktiv sein. Ein
-- Gast hat keine schiedsrichter_id und kommt gar nicht erst hinein. Zugriff
-- wie im ganzen Projekt ausschliesslich ueber SECURITY DEFINER; die Tabellen
-- selbst bleiben fuer anon und authenticated gesperrt (RLS an, keine Policies,
-- Tabellenrechte entzogen -- v111). drop vor create statt create or replace
-- (PGRST202-Lehre aus v85), danach revoke from public und grant execute an
-- anon und authenticated. Ein durchgelaufenes create function sagt ueber die
-- Rechte nichts (v107b).

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
declare
  v_pin text;
  v_aktiv boolean;
begin
  select s.pin, s.aktiv into v_pin, v_aktiv
  from schiedsrichter s where s.id = p_schiedsrichter_id;

  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

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
'Eigene Frage-Rueckmeldungen einer Person, damit die Website eine bereits gemeldete Frage als gemeldet markieren kann. Liefert ausschliesslich Meldungen dieser Person, niemals fremde und keine Zahl ueber fremde. Aus Max Bearbeitung kommt nur der Status zurueck. loesung_snapshot und gegebene_antwort werden bewusst nicht ausgeliefert -- der Schnappschuss enthaelt die Loesung der Frage und wuerde das laufende Quiz aufloesbar machen. Siehe v112.';
