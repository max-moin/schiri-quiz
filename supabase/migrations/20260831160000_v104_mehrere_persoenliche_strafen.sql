-- ============================================================
--  v104 - Mehrere persoenliche Strafen je Frage
--  Nachgetragene Datei zum bereits angewandten Stand (31.08.2026)
-- ============================================================
--
-- WARUM ES DIESE DATEI GIBT
--
-- v104 und v104b waren in der Live-Datenbank angewandt, lagen aber
-- nicht als Datei im Repo - der Ordner endete bei v103. Genau diese
-- Art von Drift hat hier schon einmal einen echten Fehler erzeugt
-- (v92: die Datei sagte etwas anderes als die Datenbank). Diese Datei
-- schliesst die Luecke. Ihr SQL ist wortgleich aus
-- supabase_migrations.schema_migrations uebernommen, nicht abgetippt.
--
-- HINWEIS ZUR AUFTEILUNG: In der Live-Datenbank wurde das in zwei
-- Schritten angewandt - v104 legte die Tabelle und die
-- Vergleichsfunktion an, v104b setzte sie in Schreiben und Bewerten
-- tatsaechlich ein. v104 allein haette eine Tabelle hinterlassen, die
-- niemand liest. Inhaltlich gehoert beides zusammen, darum steht es
-- hier in einer Datei, in der Reihenfolge der Anwendung.
--
-- ------------------------------------------------------------
--  WORUM ES GEHT
-- ------------------------------------------------------------
--
-- Max' Fall: "Der Einwechselspieler mit der Nummer 19 wartet an der
-- Mittellinie ... laeuft auf das Spielfeld und bringt seinen
-- Gegenspieler durch ein taktisches Foul zu Fall. Er kriegt erst eine
-- Verwarnung fuer das Betreten des Feldes und dann eine gelb-rote
-- Karte fuer das Unterbinden eines verheissungsvollen Angriffs."
--
-- Bis v103 konnte eine Frage genau EINE persoenliche Strafe verlangen.
-- Die Szene ist damit nicht abbildbar.
--
-- ------------------------------------------------------------
--  ZWEI ENTSCHEIDUNGEN VON MAX
-- ------------------------------------------------------------
--
-- 1. REIHENFOLGE EGAL bei der Bewertung. Wer beide Karten erkennt, hat
--    die Regel verstanden; an der Sortierung zu scheitern lehrt nichts.
-- 2. JE STRAFE EIGENE PERSON. Mannschaft, Rolle und Nummer haengen an
--    der einzelnen Strafe. Damit ist auch die Rudelbildung abgedeckt.
--
-- ------------------------------------------------------------
--  WARUM DER VERGLEICH TROTZDEM EINDEUTIG BLEIBT
-- ------------------------------------------------------------
--
-- Ohne Reihenfolge muessen beide Listen sortiert verglichen werden.
-- Das ist nur dann eindeutig, wenn sich zwei Strafen in mindestens
-- einem harten Feld unterscheiden (Karte, Mannschaft, Rueckennummer).
-- Ein eindeutiger Index erzwingt das beim Anlegen, statt es beim
-- Bewerten zu erraten - siehe idx_strafen_eindeutig weiter unten.
-- (Der Fliesstext im uebernommenen v104-Block spricht an einer Stelle
-- von einem CHECK; umgesetzt ist es als dieser eindeutige Index. Der
-- Wortlaut bleibt hier unveraendert, weil er so angewandt wurde.)
--
-- ------------------------------------------------------------
--  WARUM DIE ALTEN SPALTEN AM ELTERNSATZ BLEIBEN
-- ------------------------------------------------------------
--
-- Die alten Einzelspalten an frage_entscheidungsloesungen spiegeln die
-- erste Strafe, damit aeltere App-Fassungen und die noch nicht
-- ausgelieferte Website weiterlesen koennen - dasselbe Muster wie
-- fragen.typ neben medium/antworttyp. Massgeblich fuer die Bewertung
-- ist ausschliesslich die neue Tabelle
-- public.frage_entscheidung_strafen.
--
-- ------------------------------------------------------------
--  MERKSATZ (im Projekt schon zweimal gebraucht)
-- ------------------------------------------------------------
--
-- plpgsql loest Funktionsaufrufe erst zur Laufzeit auf. Ein
-- erfolgreiches "create function" beweist gar nichts - nur ein Aufruf
-- beweist etwas.
--
-- ============================================================
--  Ab hier: wortgleich der angewandte Stand
--  Schritt 1 von 2 - v104_mehrere_persoenliche_strafen
--  (Version 20260831105027)
-- ============================================================

-- v104_mehrere_persoenliche_strafen (31.08.2026)
--
-- Max' Fall: "Der Einwechselspieler mit der Nummer 19 wartet an der
-- Mittellinie ... laeuft auf das Spielfeld und bringt seinen Gegenspieler
-- durch ein taktisches Foul zu Fall. Er kriegt erst eine Verwarnung fuer
-- das Betreten des Feldes und dann eine gelb-rote Karte fuer das
-- Unterbinden eines verheissungsvollen Angriffs."
--
-- Bis v103 konnte eine Frage genau EINE persoenliche Strafe verlangen.
-- Die Szene oben ist damit nicht abbildbar - und sie ist kein Kuriosum,
-- sondern ein Standardfall aus der Regelpruefung.
--
-- ============================================================
--  Zwei Entscheidungen, die Max getroffen hat
-- ============================================================
--
-- 1. REIHENFOLGE EGAL. Gelb + Gelb-Rot zaehlt wie Gelb-Rot + Gelb. Wer
--    beide Karten erkennt, hat die Regel verstanden; an der Sortierung
--    zu scheitern lehrt nichts. Die richtige Abfolge steht trotzdem in
--    der Aufloesung (position).
-- 2. JE STRAFE EIGENE PERSON. Mannschaft, Rolle und Nummer haengen an
--    der einzelnen Strafe, nicht an der Frage. Damit ist auch die
--    Rudelbildung abgedeckt: Gelb fuer Heim Nr. 7, Rot fuer Gast Nr. 4.
--
-- ============================================================
--  Wie der Vergleich eindeutig bleibt
-- ============================================================
--
-- Ohne Reihenfolge muessen beide Listen sortiert verglichen werden. Das
-- ist nur dann eindeutig, wenn sich zwei Strafen einer Frage in
-- mindestens einem der harten Felder unterscheiden (Karte, Mannschaft,
-- Rueckennummer). Sonst waere bei zwei gleichen Eintraegen mit
-- verschiedenen gueltigen Rollen nicht bestimmt, welcher zu welchem
-- gehoert. Ein CHECK erzwingt das beim Anlegen, statt es beim Bewerten
-- zu erraten.
--
-- Die alten Spalten am Elternsatz bleiben und spiegeln die ERSTE Strafe.
-- Aeltere App-Fassungen und die alte Website lesen sie weiter, ohne von
-- der zweiten zu wissen - dasselbe Muster wie fragen.typ neben
-- medium/antworttyp. Massgeblich fuer die BEWERTUNG ist ab jetzt
-- ausschliesslich die neue Tabelle.

create table if not exists public.frage_entscheidung_strafen (
  frage_id        uuid     not null references public.fragen(id) on delete cascade,
  position        smallint not null,
  strafe          text     not null,
  fuer_mannschaft text,
  rolle_anzeige   text,
  rollen_gueltig  text[],
  rueckennummer   smallint,
  primary key (frage_id, position),

  -- "keine" gibt es hier nicht: keine Strafe heisst keine Zeile.
  constraint strafe_karte_gueltig
    check (strafe in ('gelb', 'gelb_rot', 'rot')),
  constraint strafe_position_gueltig
    check (position between 1 and 4),
  constraint strafe_mannschaft_gueltig
    check (fuer_mannschaft is null or fuer_mannschaft in ('heim', 'gast')),
  constraint strafe_rollen_gueltig_werte
    check (rollen_gueltig is null or (
      array_length(rollen_gueltig, 1) between 1 and 4
      and rollen_gueltig <@ array['feldspieler','torwart','auswechselspieler','trainer']::text[])),
  constraint strafe_rolle_ist_gueltig
    check (rolle_anzeige is null or rolle_anzeige = any(rollen_gueltig)),
  constraint strafe_nummer_gueltig
    check (rueckennummer is null or rueckennummer between 1 and 99)
);

-- Zwei Strafen derselben Frage muessen sich in einem harten Feld
-- unterscheiden - siehe Kopfkommentar.
create unique index if not exists idx_strafen_eindeutig
  on public.frage_entscheidung_strafen (
    frage_id, strafe, coalesce(fuer_mannschaft, ''), coalesce(rueckennummer, 0));

alter table public.frage_entscheidung_strafen enable row level security;
revoke all on public.frage_entscheidung_strafen from anon, authenticated;

comment on table public.frage_entscheidung_strafen is
  'Alle persoenlichen Strafen einer Icon-Frage, je Strafe eine Zeile mit eigener Person. Massgeblich fuer die Bewertung; die Spalten am Elternsatz spiegeln nur die erste Strafe fuer aeltere Leser.';

-- Bestand uebernehmen: die bisherige eine Strafe wird Position 1.
insert into public.frage_entscheidung_strafen (
  frage_id, position, strafe, fuer_mannschaft, rolle_anzeige, rollen_gueltig, rueckennummer)
select l.frage_id, 1, l.persoenliche_strafe, l.strafe_fuer_mannschaft,
       l.strafe_fuer_rolle, l.strafe_rollen_gueltig, l.strafe_rueckennummer
from public.frage_entscheidungsloesungen l
where l.persoenliche_strafe is not null and l.persoenliche_strafe <> 'keine'
on conflict do nothing;

-- ============================================================
--  Vergleich zweier Strafenlisten
-- ============================================================
--
-- Beide Listen werden nach denselben harten Feldern sortiert und
-- paarweise verglichen. Verglichen wird nur, was die Frage verlangt -
-- die Regel aus v101 gilt hier genauso.
--
-- Rueckgabe: die vier Teilnoten, die es seit v99 gibt. Damit aendert
-- sich die Form des Ergebnisses nicht, obwohl darunter jetzt eine Liste
-- steckt statt eines einzelnen Wertes.

create or replace function public.entscheidung_strafen_vergleich(
  p_gegeben jsonb,
  p_loesung jsonb,
  p_will_mannschaft boolean,
  p_will_rolle boolean,
  p_will_nummer boolean
)
returns jsonb
language plpgsql
immutable
set search_path to public
as $function$
declare
  v_g jsonb[]; v_l jsonb[];
  v_karten_ok boolean := true;
  v_ziel_ok   boolean := true;
  v_rolle_ok  boolean := true;
  v_nummer_ok boolean := true;
  i int;
begin
  select coalesce(array_agg(e order by
           e->>'strafe', coalesce(e->>'fuer_mannschaft', ''), coalesce(e->>'rueckennummer', '')),
         array[]::jsonb[])
    into v_g
  from jsonb_array_elements(coalesce(p_gegeben, '[]'::jsonb)) e;

  select coalesce(array_agg(e order by
           e->>'strafe', coalesce(e->>'fuer_mannschaft', ''), coalesce(e->>'rueckennummer', '')),
         array[]::jsonb[])
    into v_l
  from jsonb_array_elements(coalesce(p_loesung, '[]'::jsonb)) e;

  -- Unterschiedlich viele Strafen: die Karten stimmen nicht, und alles
  -- Weitere laesst sich nicht paarweise vergleichen.
  if coalesce(array_length(v_g, 1), 0) <> coalesce(array_length(v_l, 1), 0) then
    return jsonb_build_object(
      'strafe_richtig', false,
      'strafziel_richtig', case when p_will_mannschaft then false end,
      'rolle_richtig',    case when p_will_rolle then false end,
      'rueckennummer_richtig', case when p_will_nummer then false end);
  end if;

  for i in 1 .. coalesce(array_length(v_l, 1), 0) loop
    if v_g[i]->>'strafe' is distinct from v_l[i]->>'strafe' then
      v_karten_ok := false;
    end if;
    if p_will_mannschaft
       and coalesce(nullif(v_g[i]->>'fuer_mannschaft', ''), '')
           is distinct from coalesce(v_l[i]->>'fuer_mannschaft', '') then
      v_ziel_ok := false;
    end if;
    -- Rolle: jede hinterlegte gueltige zaehlt (die Regel aus v103).
    if p_will_rolle
       and not public.entscheidung_teilnote_rolle(
             v_g[i]->>'strafe_fuer_rolle',
             array(select jsonb_array_elements_text(
                     coalesce(v_l[i]->'rollen_gueltig', '[]'::jsonb)))) then
      v_rolle_ok := false;
    end if;
    if p_will_nummer
       and coalesce(nullif(v_g[i]->>'rueckennummer', ''), '')
           is distinct from coalesce(v_l[i]->>'rueckennummer', '') then
      v_nummer_ok := false;
    end if;
  end loop;

  return jsonb_build_object(
    'strafe_richtig', v_karten_ok,
    'strafziel_richtig',     case when p_will_mannschaft then v_ziel_ok end,
    'rolle_richtig',         case when p_will_rolle then v_rolle_ok end,
    'rueckennummer_richtig', case when p_will_nummer then v_nummer_ok end);
end;
$function$;

revoke all on function public.entscheidung_strafen_vergleich(jsonb, jsonb, boolean, boolean, boolean) from public;

-- Die Loesungsliste einer Frage als jsonb - eine Stelle, an der die
-- Sortierung und die Feldnamen festgelegt sind.
create or replace function public.entscheidung_strafen_liste(p_frage_id uuid)
returns jsonb
language sql
stable
set search_path to public
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', s.position,
           'strafe', s.strafe,
           'fuer_mannschaft', s.fuer_mannschaft,
           'strafe_fuer_rolle', s.rolle_anzeige,
           'rollen_gueltig', to_jsonb(s.rollen_gueltig),
           'rueckennummer', s.rueckennummer) order by s.position), '[]'::jsonb)
  from public.frage_entscheidung_strafen s
  where s.frage_id = p_frage_id;
$function$;

revoke all on function public.entscheidung_strafen_liste(uuid) from public;

-- ============================================================
--  Schritt 2 von 2 - v104b_schreiben_und_bewerten_mit_strafenliste
--  (Version 20260831105151)
-- ============================================================

-- v104b_schreiben_und_bewerten_mit_strafenliste (31.08.2026)
--
-- Setzt die Liste aus v104 tatsaechlich ein. v104 allein haette die
-- Tabelle angelegt, ohne dass irgendetwas sie liest - derselbe halbe
-- Schritt wie bei v103.
--
-- Vertrag fuer die Antwort aus dem Browser:
--   p_antwort.strafen = [ {strafe, fuer_mannschaft, strafe_fuer_rolle,
--                          rueckennummer}, ... ]
-- Fehlt "strafen", wird die Liste aus den bisherigen Einzelfeldern
-- gebaut. Damit funktioniert die HEUTE ausgelieferte Website weiter,
-- bis die neue Fassung drauf ist.

create or replace function public.frage_entscheidungsloesung_setzen(
  p_frage_id uuid, p_loesung jsonb)
returns void
language plpgsql
set search_path to public
as $function$
declare
  v_will_fortsetzung boolean; v_will_richtung boolean; v_will_ort boolean;
  v_will_strafe boolean; v_will_mannschaft boolean; v_will_rolle boolean;
  v_will_nummer boolean;
  v_strafen jsonb; v_eintrag jsonb; v_pos smallint := 0;
  v_erste jsonb; v_rollen text[]; v_rolle text;
begin
  v_will_fortsetzung := coalesce((p_loesung->>'fordert_fortsetzung')::boolean, true);
  v_will_strafe      := coalesce((p_loesung->>'fordert_strafe')::boolean, true);

  -- Strafenliste: neu "strafen", sonst aus den Einzelfeldern gebaut.
  if p_loesung ? 'strafen' and jsonb_typeof(p_loesung->'strafen') = 'array' then
    v_strafen := p_loesung->'strafen';
  elsif coalesce(nullif(p_loesung->>'persoenliche_strafe', ''), 'keine') <> 'keine' then
    v_strafen := jsonb_build_array(jsonb_build_object(
      'strafe', p_loesung->>'persoenliche_strafe',
      'fuer_mannschaft', nullif(p_loesung->>'strafe_fuer_mannschaft', ''),
      'strafe_fuer_rolle', nullif(p_loesung->>'strafe_fuer_rolle', ''),
      'rollen_gueltig', p_loesung->'strafe_rollen_gueltig',
      'rueckennummer', nullif(p_loesung->>'strafe_rueckennummer', '')));
  else
    v_strafen := '[]'::jsonb;
  end if;

  if not v_will_strafe or jsonb_array_length(v_strafen) = 0 then
    v_strafen := '[]'::jsonb;
    v_will_strafe := v_will_strafe;  -- "keine Strafe" bleibt eine Antwort
  end if;

  v_will_richtung   := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_fuer')::boolean, true)
    and coalesce(p_loesung->>'spielfortsetzung', '') not in ('weiterspielen', 'sr_ball');
  v_will_ort        := v_will_fortsetzung
    and coalesce((p_loesung->>'fordert_fortsetzung_ort')::boolean, true);
  v_will_mannschaft := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_mannschaft')::boolean, true);
  v_will_rolle      := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_rolle')::boolean, true);
  v_will_nummer     := v_will_strafe and jsonb_array_length(v_strafen) > 0
    and coalesce((p_loesung->>'fordert_strafe_nummer')::boolean, false);

  if not (v_will_fortsetzung or v_will_strafe) then
    raise exception 'Die Frage verlangt weder Spielfortsetzung noch persoenliche Strafe';
  end if;

  v_erste := v_strafen->0;

  -- Elternsatz: spiegelt die erste Strafe fuer aeltere Leser.
  if v_erste is not null then
    v_rollen := case when v_will_rolle then (
      select coalesce(nullif(array(select jsonb_array_elements_text(
               coalesce(v_erste->'rollen_gueltig', '[]'::jsonb))), '{}'),
             array[nullif(v_erste->>'strafe_fuer_rolle', '')])) end;
    v_rolle := case when v_will_rolle then
      coalesce(nullif(v_erste->>'strafe_fuer_rolle', ''), v_rollen[1]) end;
    if v_will_rolle and (v_rolle is null or not (v_rolle = any(v_rollen))) then
      v_rolle := v_rollen[1];
    end if;
  end if;

  insert into public.frage_entscheidungsloesungen (
    frage_id, spielfortsetzung, fortsetzung_fuer, fortsetzung_ort,
    persoenliche_strafe, strafe_fuer_mannschaft, strafe_fuer_rolle,
    strafe_rollen_gueltig, strafe_rueckennummer, trikot_heim, trikot_gast,
    fordert_fortsetzung, fordert_fortsetzung_fuer, fordert_fortsetzung_ort,
    fordert_strafe, fordert_strafe_mannschaft, fordert_strafe_rolle,
    fordert_strafe_nummer, zeigt_trikotfarben, geaendert_am
  ) values (
    p_frage_id,
    case when v_will_fortsetzung then p_loesung->>'spielfortsetzung' end,
    case when v_will_richtung   then nullif(p_loesung->>'fortsetzung_fuer', '') end,
    case when v_will_ort        then nullif(btrim(p_loesung->>'fortsetzung_ort'), '') end,
    case when v_will_strafe then coalesce(v_erste->>'strafe', 'keine') end,
    case when v_will_mannschaft then nullif(v_erste->>'fuer_mannschaft', '') end,
    v_rolle, v_rollen,
    case when v_will_nummer then nullif(v_erste->>'rueckennummer', '')::smallint end,
    coalesce(nullif(p_loesung->>'trikot_heim', ''), '#e4032e'),
    coalesce(nullif(p_loesung->>'trikot_gast', ''), '#1d4ed8'),
    v_will_fortsetzung, v_will_richtung, v_will_ort,
    v_will_strafe, v_will_mannschaft, v_will_rolle, v_will_nummer,
    coalesce((p_loesung->>'zeigt_trikotfarben')::boolean, true),
    now()
  )
  on conflict (frage_id) do update set
    spielfortsetzung = excluded.spielfortsetzung,
    fortsetzung_fuer = excluded.fortsetzung_fuer,
    fortsetzung_ort = excluded.fortsetzung_ort,
    persoenliche_strafe = excluded.persoenliche_strafe,
    strafe_fuer_mannschaft = excluded.strafe_fuer_mannschaft,
    strafe_fuer_rolle = excluded.strafe_fuer_rolle,
    strafe_rollen_gueltig = excluded.strafe_rollen_gueltig,
    strafe_rueckennummer = excluded.strafe_rueckennummer,
    trikot_heim = excluded.trikot_heim, trikot_gast = excluded.trikot_gast,
    fordert_fortsetzung = excluded.fordert_fortsetzung,
    fordert_fortsetzung_fuer = excluded.fordert_fortsetzung_fuer,
    fordert_fortsetzung_ort = excluded.fordert_fortsetzung_ort,
    fordert_strafe = excluded.fordert_strafe,
    fordert_strafe_mannschaft = excluded.fordert_strafe_mannschaft,
    fordert_strafe_rolle = excluded.fordert_strafe_rolle,
    fordert_strafe_nummer = excluded.fordert_strafe_nummer,
    zeigt_trikotfarben = excluded.zeigt_trikotfarben,
    geaendert_am = now();

  -- Die Liste wird immer komplett neu geschrieben. Einzelne Zeilen zu
  -- aktualisieren hiesse, geloeschte Strafen zu uebersehen.
  delete from public.frage_entscheidung_strafen where frage_id = p_frage_id;

  for v_eintrag in select * from jsonb_array_elements(v_strafen) loop
    v_pos := v_pos + 1;
    v_rollen := case when v_will_rolle then (
      select coalesce(nullif(array(select jsonb_array_elements_text(
               coalesce(v_eintrag->'rollen_gueltig', '[]'::jsonb))), '{}'),
             array[nullif(v_eintrag->>'strafe_fuer_rolle', '')])) end;
    v_rolle := case when v_will_rolle then
      coalesce(nullif(v_eintrag->>'strafe_fuer_rolle', ''), v_rollen[1]) end;
    if v_will_rolle and (v_rolle is null or not (v_rolle = any(v_rollen))) then
      v_rolle := v_rollen[1];
    end if;

    insert into public.frage_entscheidung_strafen (
      frage_id, position, strafe, fuer_mannschaft, rolle_anzeige,
      rollen_gueltig, rueckennummer)
    values (p_frage_id, v_pos, v_eintrag->>'strafe',
      case when v_will_mannschaft then nullif(v_eintrag->>'fuer_mannschaft', '') end,
      v_rolle, v_rollen,
      case when v_will_nummer then nullif(v_eintrag->>'rueckennummer', '')::smallint end);
  end loop;
end;
$function$;

-- ============================================================
--  Bewerten gegen die Liste
-- ============================================================

create or replace function public.entscheidung_antwort_speichern(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb,
  p_ort_richtig boolean, p_ort_feedback text default null)
returns jsonb
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_pin text; v_aktiv boolean; v_ist_test boolean; v_verein uuid;
  v_loesung public.frage_entscheidungsloesungen%rowtype;
  v_loesung_json jsonb; v_antwort_id uuid;
  v_alt public.antwort_entscheidungen%rowtype;
  v_fortsetzung_ok boolean; v_richtung_ok boolean; v_ort_ok boolean;
  v_strafe_ok boolean; v_strafziel_ok boolean; v_rolle_ok boolean;
  v_nummer_ok boolean; v_korrekt boolean;
  v_schalter jsonb; v_strafen_l jsonb; v_strafen_g jsonb; v_noten jsonb;
begin
  select s.pin, s.aktiv, s.ist_test, s.verein_id into v_pin, v_aktiv, v_ist_test, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;
  if jsonb_typeof(p_antwort) <> 'object' then raise exception 'Antwort ungueltig'; end if;

  select l.* into v_loesung
  from public.frage_entscheidungsloesungen l
  join public.fragen f on f.id = l.frage_id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;

  if v_loesung.fordert_fortsetzung then
    if p_antwort->>'spielfortsetzung' is null
       or p_antwort->>'spielfortsetzung' not in ('weiterspielen','direkter_freistoss',
          'indirekter_freistoss','strafstoss','sr_ball','eckstoss','abstoss','einwurf','anstoss') then
      raise exception 'Spielfortsetzung ungueltig';
    end if;
  end if;

  -- Gegebene Strafen: neue Liste, sonst aus den Einzelfeldern. So laeuft
  -- die heute ausgelieferte Website weiter.
  if p_antwort ? 'strafen' and jsonb_typeof(p_antwort->'strafen') = 'array' then
    v_strafen_g := p_antwort->'strafen';
  elsif coalesce(nullif(p_antwort->>'persoenliche_strafe', ''), 'keine') <> 'keine' then
    v_strafen_g := jsonb_build_array(jsonb_build_object(
      'strafe', p_antwort->>'persoenliche_strafe',
      'fuer_mannschaft', nullif(p_antwort->>'strafe_fuer_mannschaft', ''),
      'strafe_fuer_rolle', nullif(p_antwort->>'strafe_fuer_rolle', ''),
      'rueckennummer', nullif(p_antwort->>'strafe_rueckennummer', '')));
  else
    v_strafen_g := '[]'::jsonb;
  end if;

  if v_loesung.fordert_strafe then
    if not (p_antwort ? 'strafen')
       and (p_antwort->>'persoenliche_strafe' is null
            or p_antwort->>'persoenliche_strafe' not in ('keine','gelb','gelb_rot','rot')) then
      raise exception 'Persoenliche Strafe ungueltig';
    end if;
    if exists (select 1 from jsonb_array_elements(v_strafen_g) e
               where e->>'strafe' not in ('gelb','gelb_rot','rot')) then
      raise exception 'Persoenliche Strafe ungueltig';
    end if;
  end if;

  v_strafen_l := public.entscheidung_strafen_liste(p_frage_id);

  v_schalter := jsonb_build_object(
    'fordert_fortsetzung', v_loesung.fordert_fortsetzung,
    'fordert_fortsetzung_fuer', v_loesung.fordert_fortsetzung_fuer,
    'fordert_fortsetzung_ort', v_loesung.fordert_fortsetzung_ort,
    'fordert_strafe', v_loesung.fordert_strafe,
    'fordert_strafe_mannschaft', v_loesung.fordert_strafe_mannschaft,
    'fordert_strafe_rolle', v_loesung.fordert_strafe_rolle,
    'fordert_strafe_nummer', v_loesung.fordert_strafe_nummer,
    'zeigt_trikotfarben', v_loesung.zeigt_trikotfarben);

  select ae.* into v_alt from public.antworten a
  join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
  if found then
    return public.entscheidung_ergebnis_bauen(
      v_alt.gegebene_antwort, v_alt.loesung_snapshot, true,
      v_alt.fortsetzung_richtig, v_alt.richtung_richtig, v_alt.ort_richtig,
      v_alt.strafe_richtig, v_alt.strafziel_richtig, v_alt.rolle_richtig,
      v_alt.rueckennummer_richtig, v_alt.ort_feedback);
  end if;

  v_loesung_json := jsonb_build_object(
    'spielfortsetzung', v_loesung.spielfortsetzung,
    'fortsetzung_fuer', v_loesung.fortsetzung_fuer,
    'fortsetzung_ort', v_loesung.fortsetzung_ort,
    'persoenliche_strafe', v_loesung.persoenliche_strafe,
    'strafe_fuer_mannschaft', v_loesung.strafe_fuer_mannschaft,
    'strafe_fuer_rolle', v_loesung.strafe_fuer_rolle,
    'strafe_rollen_gueltig', to_jsonb(v_loesung.strafe_rollen_gueltig),
    'strafe_rueckennummer', v_loesung.strafe_rueckennummer,
    'strafen', v_strafen_l,
    'trikot_heim', v_loesung.trikot_heim,
    'trikot_gast', v_loesung.trikot_gast) || v_schalter;

  v_fortsetzung_ok := case when v_loesung.fordert_fortsetzung
    then p_antwort->>'spielfortsetzung' = v_loesung.spielfortsetzung end;
  v_richtung_ok := case when v_loesung.fordert_fortsetzung_fuer
    then coalesce(nullif(p_antwort->>'fortsetzung_fuer', ''), '')
         = coalesce(v_loesung.fortsetzung_fuer, '') end;
  v_ort_ok := case when v_loesung.fordert_fortsetzung_ort
    then coalesce(p_ort_richtig, false) end;

  if v_loesung.fordert_strafe then
    v_noten := public.entscheidung_strafen_vergleich(
      v_strafen_g, v_strafen_l,
      v_loesung.fordert_strafe_mannschaft,
      v_loesung.fordert_strafe_rolle,
      v_loesung.fordert_strafe_nummer);
    v_strafe_ok    := (v_noten->>'strafe_richtig')::boolean;
    v_strafziel_ok := (v_noten->>'strafziel_richtig')::boolean;
    v_rolle_ok     := (v_noten->>'rolle_richtig')::boolean;
    v_nummer_ok    := (v_noten->>'rueckennummer_richtig')::boolean;
  end if;

  v_korrekt := coalesce(v_fortsetzung_ok, true) and coalesce(v_richtung_ok, true)
    and coalesce(v_ort_ok, true) and coalesce(v_strafe_ok, true)
    and coalesce(v_strafziel_ok, true) and coalesce(v_rolle_ok, true)
    and coalesce(v_nummer_ok, true);

  if not v_ist_test then
    insert into public.antworten (schiedsrichter_id, frage_id, gegebene_option,
      korrekt, gegebener_freitext, ki_feedback, bewertungsstatus, versuch_anzahl)
    values (p_schiedsrichter_id, p_frage_id, null, v_korrekt,
      public.entscheidung_anzeige(p_antwort), nullif(btrim(p_ort_feedback), ''),
      case when v_korrekt then 'richtig' else 'falsch' end, 1)
    on conflict (schiedsrichter_id, frage_id) do nothing returning id into v_antwort_id;

    if v_antwort_id is null then
      select ae.* into v_alt from public.antworten a
      join public.antwort_entscheidungen ae on ae.antwort_id = a.id
      where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
      if found then
        return public.entscheidung_ergebnis_bauen(
          v_alt.gegebene_antwort, v_alt.loesung_snapshot, true,
          v_alt.fortsetzung_richtig, v_alt.richtung_richtig, v_alt.ort_richtig,
          v_alt.strafe_richtig, v_alt.strafziel_richtig, v_alt.rolle_richtig,
          v_alt.rueckennummer_richtig, v_alt.ort_feedback);
      end if;
      raise exception 'Antwort konnte nicht gespeichert werden';
    end if;

    insert into public.antwort_entscheidungen (antwort_id, gegebene_antwort,
      loesung_snapshot, fortsetzung_richtig, richtung_richtig, ort_richtig,
      strafe_richtig, strafziel_richtig, rolle_richtig, rueckennummer_richtig, ort_feedback)
    values (v_antwort_id, p_antwort, v_loesung_json,
      v_fortsetzung_ok, v_richtung_ok, v_ort_ok, v_strafe_ok,
      v_strafziel_ok, v_rolle_ok, v_nummer_ok, nullif(btrim(p_ort_feedback), ''));
  end if;

  return public.entscheidung_ergebnis_bauen(
    p_antwort, v_loesung_json, false,
    v_fortsetzung_ok, v_richtung_ok, v_ort_ok, v_strafe_ok,
    v_strafziel_ok, v_rolle_ok, v_nummer_ok, nullif(btrim(p_ort_feedback), ''));
end;
$function$;

-- Die App braucht die Liste im Editor.
drop function if exists public.obmann_frage_entscheidungsloesung_details(text, uuid);

create function public.obmann_frage_entscheidungsloesung_details(
  p_passwort text, p_frage_id uuid)
returns table(
  frage_id uuid, spielfortsetzung text, fortsetzung_fuer text,
  fortsetzung_ort text, persoenliche_strafe text,
  strafe_fuer_mannschaft text, strafe_fuer_rolle text,
  strafe_rollen_gueltig text[], strafe_rueckennummer smallint,
  strafen jsonb,
  trikot_heim text, trikot_gast text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean)
language plpgsql security definer set search_path to public
as $function$
begin
  perform public.obmann_verein(p_passwort);
  return query
  select l.frage_id, l.spielfortsetzung, l.fortsetzung_fuer, l.fortsetzung_ort,
         l.persoenliche_strafe, l.strafe_fuer_mannschaft, l.strafe_fuer_rolle,
         l.strafe_rollen_gueltig, l.strafe_rueckennummer,
         public.entscheidung_strafen_liste(l.frage_id),
         l.trikot_heim, l.trikot_gast,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben
  from public.frage_entscheidungsloesungen l
  where l.frage_id = p_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_entscheidungsloesung_details(text, uuid) from public;
grant execute on function public.obmann_frage_entscheidungsloesung_details(text, uuid) to anon, authenticated;
