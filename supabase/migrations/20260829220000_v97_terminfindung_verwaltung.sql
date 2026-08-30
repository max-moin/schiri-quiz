-- v97_terminfindung_verwaltung (29.08.2026)
--
-- Die Terminfindung aus v91 hat bisher nur die Haelfte, die man am Handy
-- braucht: anlegen, Stand ansehen, entscheiden, abbrechen. Genau das
-- fehlt aber, was man am Rechner macht und nicht unterwegs - naemlich
-- eine falsch getippte Zeile korrigieren, einen vergessenen Termin
-- nachtragen und nachsehen, wer noch gar nicht geantwortet hat.
--
-- Max' eigene Beschreibung seines Arbeitsablaufs ist der Grund fuer den
-- Zuschnitt: die Weboberflaeche benutzt er "wenn ihn jemand auf einen
-- Fehler hinweist". Das Tagesgeschaeft laeuft ueber die Swift-App. Diese
-- Migration baut deshalb bewusst NICHT nach, was die App schon kann,
-- sondern nur die vier Faelle, die am Rechner leichter gehen:
--
--   1. Textpflege   - Titel, Beschreibung und Antwortfrist korrigieren.
--   2. Nachtragen   - einen weiteren Vorschlag ergaenzen.
--   3. Zuruecknehmen- einen Vorschlag wieder von der Wahl nehmen.
--   4. Uebersicht   - wer hat geantwortet, wer nicht, und wie hat jede
--                     einzelne Person gestimmt. Das ist die Grundlage
--                     fuer die Erinnerungsliste und den CSV-Export in
--                     der Weboberflaeche.
--
-- Warum p_passwort und nicht die 2FAS-Sitzung der Webredaktion:
-- terminfindungen, terminfindung_vorschlaege und terminfindung_stimmen
-- sind Datentabellen mit RLS und ohne jede Policy. Der einzige Weg
-- hinein sind die geprueften SECURITY-DEFINER-Funktionen, und alle
-- bestehenden Obmann-Funktionen dieser Familie pruefen p_passwort gegen
-- obmann_zugang. Ein zweites Rechtemodell fuer dieselben drei Tabellen
-- waere die gefaehrlichere Loesung: die Oberflaeche muesste ohnehin
-- obmann_terminfindungen und obmann_terminfindung_entscheiden aus v91
-- aufrufen, also brauchte sie beides gleichzeitig. Ein Modell, zwei
-- Schloesser: die Seite selbst liegt hinter Supabase Auth mit 2FAS, das
-- Passwort kommt zusaetzlich und wird nur im Arbeitsspeicher gehalten.
--
-- Alle vier Funktionen sind neu. Trotzdem drop+create statt
-- create or replace: ein spaeteres erneutes Ausfuehren mit geaenderter
-- Signatur laesst sonst die alte Fassung stehen, PostgREST findet zwei
-- Kandidaten und meldet PGRST202. Dieselbe Falle wie bei v85.

-- ============================================================
--  1. Textpflege: Titel, Beschreibung, Frist
-- ============================================================
--
-- Der Vertrag ist bewusst dreiwertig, weil "nicht angefasst" und
-- "absichtlich geleert" zwei verschiedene Dinge sind:
--
--   null           -> Wert bleibt, wie er ist. Damit kann eine aeltere
--                     App-Version, die ein Feld gar nicht kennt, nichts
--                     still zuruecksetzen.
--   leerer Text    -> Wert wird geleert.
--   Text           -> Wert wird gesetzt.
--
-- Fuer das Datum gibt es keinen leeren Text, deshalb dort der eigene
-- Schalter p_frist_entfernen. Ohne ihn liesse sich eine einmal gesetzte
-- Antwortfrist nie wieder loswerden.

drop function if exists public.obmann_terminfindung_bearbeiten(text, uuid, text, text, date, boolean);

create function public.obmann_terminfindung_bearbeiten(
  p_passwort text,
  p_findung_id uuid,
  p_titel text default null,
  p_beschreibung text default null,
  p_antwort_bis date default null,
  p_frist_entfernen boolean default false
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_status text;
begin
  v_verein := obmann_verein(p_passwort);

  -- Verein UND Status in einem Schritt. Ohne die Vereinspruefung koennte
  -- ein Obmann die Terminsuche eines fremden Vereins umschreiben.
  select f.status into v_status
  from terminfindungen f
  where f.id = p_findung_id and f.verein_id = v_verein;

  if v_status is null then
    raise exception 'Terminsuche nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist bereits abgeschlossen';
  end if;

  -- Ein absichtlich geleerter Titel waere eine Karte ohne Ueberschrift.
  if p_titel is not null and coalesce(trim(p_titel), '') = '' then
    raise exception 'Titel fehlt';
  end if;

  update terminfindungen set
    titel = coalesce(trim(p_titel), titel),
    beschreibung = case
      when p_beschreibung is null then beschreibung
      when trim(p_beschreibung) = '' then null
      else trim(p_beschreibung)
    end,
    antwort_bis = case
      when coalesce(p_frist_entfernen, false) then null
      else coalesce(p_antwort_bis, antwort_bis)
    end
  where id = p_findung_id and verein_id = v_verein;
end;
$function$;

-- ============================================================
--  2. Einen Vorschlag nachtragen
-- ============================================================
--
-- Der haeufigste Korrekturfall: die Abstimmung laeuft schon, und es
-- faellt jemandem ein weiteres Wochenende ein. Bisher blieb nur
-- abbrechen und alles neu anlegen - womit alle bereits abgegebenen
-- Stimmen weg gewesen waeren.

drop function if exists public.obmann_terminfindung_vorschlag_ergaenzen(text, uuid, date, time, text);

create function public.obmann_terminfindung_vorschlag_ergaenzen(
  p_passwort text,
  p_findung_id uuid,
  p_datum date,
  p_beginn_zeit time default null,
  p_ort text default null
)
returns uuid
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_status text;
  v_anzahl integer;
  v_pos integer;
  v_id uuid;
begin
  v_verein := obmann_verein(p_passwort);

  select f.status into v_status
  from terminfindungen f
  where f.id = p_findung_id and f.verein_id = v_verein;

  if v_status is null then
    raise exception 'Terminsuche nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist bereits abgeschlossen';
  end if;
  if p_datum is null then
    raise exception 'Datum fehlt';
  end if;

  select count(*)::integer, coalesce(max(v.position), -1) + 1
    into v_anzahl, v_pos
  from terminfindung_vorschlaege v
  where v.findung_id = p_findung_id;

  -- Dieselbe Obergrenze wie beim Anlegen in v91. Mehr als acht Spalten
  -- liest auf dem Handy niemand mehr.
  if v_anzahl >= 8 then
    raise exception 'Hoechstens acht Vorschlaege';
  end if;

  -- Der Unique-Index faengt das ohnehin ab; hier steht die Pruefung nur,
  -- damit die Oberflaeche einen verstaendlichen Satz anzeigen kann statt
  -- einer Postgres-Meldung ueber einen Constraint-Namen.
  if exists (
    select 1 from terminfindung_vorschlaege v
    where v.findung_id = p_findung_id
      and v.datum = p_datum
      and v.beginn_zeit is not distinct from p_beginn_zeit
  ) then
    raise exception 'Dieser Vorschlag steht schon zur Wahl';
  end if;

  insert into terminfindung_vorschlaege (findung_id, datum, beginn_zeit, ort, position)
  values (
    p_findung_id,
    p_datum,
    p_beginn_zeit,
    nullif(trim(coalesce(p_ort, '')), ''),
    v_pos
  )
  returning id into v_id;

  return v_id;
end;
$function$;

-- ============================================================
--  3. Einen Vorschlag wieder zuruecknehmen
-- ============================================================
--
-- Loescht ueber den Fremdschluessel auch die Stimmen zu diesem einen
-- Vorschlag mit. Das ist gewollt - eine Stimme zu einem zurueckgezogenen
-- Datum hat keine Bedeutung mehr -, aber es ist unumkehrbar. Die
-- Oberflaeche muss deshalb warnen und die Zahl der betroffenen Stimmen
-- vorher nennen.
--
-- Die Untergrenze zwei ist dieselbe Aussage wie beim Anlegen in v91:
-- eine Abstimmung mit einem einzigen Vorschlag ist keine Abstimmung.

drop function if exists public.obmann_terminfindung_vorschlag_entfernen(text, uuid);

create function public.obmann_terminfindung_vorschlag_entfernen(
  p_passwort text,
  p_vorschlag_id uuid
)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_findung uuid;
  v_status text;
  v_anzahl integer;
begin
  v_verein := obmann_verein(p_passwort);

  select v.findung_id, f.status into v_findung, v_status
  from terminfindung_vorschlaege v
  join terminfindungen f on f.id = v.findung_id
  where v.id = p_vorschlag_id and f.verein_id = v_verein;

  if v_findung is null then
    raise exception 'Vorschlag nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist bereits abgeschlossen';
  end if;

  select count(*)::integer into v_anzahl
  from terminfindung_vorschlaege v
  where v.findung_id = v_findung;

  if v_anzahl <= 2 then
    raise exception 'Mindestens zwei Vorschlaege noetig';
  end if;

  delete from terminfindung_vorschlaege where id = p_vorschlag_id;
end;
$function$;

-- ============================================================
--  4. Wer hat geantwortet - und wie
-- ============================================================
--
-- obmann_terminfindungen aus v91 liefert nur Zahlen und die Ja-Namen je
-- Vorschlag. Fuer die beiden Dinge, die am Rechner den Unterschied
-- machen, reicht das nicht:
--
--   * die Erinnerungsliste braucht die Namen der Personen, die noch gar
--     nichts gesagt haben - die stehen in keiner Ja-Liste;
--   * der CSV-Export braucht eine Zeile je Person mit allen Antworten,
--     nicht eine Spalte je Vorschlag mit allen Personen.
--
-- Deshalb geht die Abfrage hier von den Personen aus und nicht von den
-- Vorschlaegen: jede aktive, echte Person des Vereins bekommt genau eine
-- Zeile, auch wenn sie nie abgestimmt hat. "aktiv and not ist_test" ist
-- dieselbe Abgrenzung, mit der v91 die Zahl der Offenen bildet - sonst
-- wuerden Liste und Zaehler verschiedene Wahrheiten erzaehlen.

drop function if exists public.obmann_terminfindung_stand(text, uuid);

create function public.obmann_terminfindung_stand(
  p_passwort text,
  p_findung_id uuid
)
returns table (
  schiedsrichter_id uuid,
  name text,
  hat_geantwortet boolean,
  antworten jsonb
)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  v_verein := obmann_verein(p_passwort);

  if not exists (
    select 1 from terminfindungen f
    where f.id = p_findung_id and f.verein_id = v_verein
  ) then
    raise exception 'Terminsuche nicht gefunden';
  end if;

  return query
  select s.id,
         s.name,
         exists (
           select 1
           from terminfindung_stimmen st
           join terminfindung_vorschlaege v on v.id = st.vorschlag_id
           where v.findung_id = p_findung_id and st.schiedsrichter_id = s.id
         ),
         -- Antworten als Zuordnung Vorschlag-ID -> Antwort. Die
         -- Oberflaeche haelt die Vorschlaege ohnehin schon, sie braucht
         -- hier nur noch das Kreuz je Feld.
         coalesce((
           select jsonb_object_agg(st.vorschlag_id::text, st.antwort)
           from terminfindung_stimmen st
           join terminfindung_vorschlaege v on v.id = st.vorschlag_id
           where v.findung_id = p_findung_id and st.schiedsrichter_id = s.id
         ), '{}'::jsonb)
  from schiedsrichter s
  where s.verein_id = v_verein
    and s.aktiv
    and not s.ist_test
  order by s.name;
end;
$function$;

comment on function public.obmann_terminfindung_stand(text, uuid) is
  'Eine Zeile je aktiver Person: hat sie geantwortet und wie. Grundlage fuer Erinnerungsliste und CSV-Export der Weboberflaeche.';

-- ============================================================
--  5. Rechte
-- ============================================================
--
-- Seit v82 erben neue Funktionen keine Rechte mehr, jede muss einzeln
-- freigegeben werden. anon steht mit drin, weil die Seite den Aufruf mit
-- dem veroeffentlichbaren Schluessel macht; die eigentliche Pruefung ist
-- obmann_verein(p_passwort) im Rumpf.

revoke all on function public.obmann_terminfindung_bearbeiten(text, uuid, text, text, date, boolean) from public;
revoke all on function public.obmann_terminfindung_vorschlag_ergaenzen(text, uuid, date, time, text) from public;
revoke all on function public.obmann_terminfindung_vorschlag_entfernen(text, uuid) from public;
revoke all on function public.obmann_terminfindung_stand(text, uuid) from public;

grant execute on function public.obmann_terminfindung_bearbeiten(text, uuid, text, text, date, boolean) to anon, authenticated;
grant execute on function public.obmann_terminfindung_vorschlag_ergaenzen(text, uuid, date, time, text) to anon, authenticated;
grant execute on function public.obmann_terminfindung_vorschlag_entfernen(text, uuid) to anon, authenticated;
grant execute on function public.obmann_terminfindung_stand(text, uuid) to anon, authenticated;
