-- v111, 03.09.2026 -- Der Rueckkanal.
--
-- Anlass: Aus dem Wochenquiz kommt bei Max bisher ausschliesslich Zahlenmaterial
-- an -- Quoten, Balken, Scoreboards. Was eine Zahl nie sagt, ist WARUM sie so
-- aussieht. Wenn achtzehn von zwanzig Leuten eine Frage falsch beantworten,
-- steht in der Auswertung "10 Prozent richtig", und Max muss raten, ob die Frage
-- schwer war, missverstaendlich formuliert, das Video kaputt oder die hinterlegte
-- Loesung schlicht falsch. Genau dieses Raten kostet ihn die Zeit, die er
-- eigentlich fuer die Ausbildung braucht.
--
-- Diese Migration baut den Weg zurueck. Zwei getrennte Rueckkanaele und einen
-- gemeinsamen Eingang:
--
--   1. Rueckmeldung zu einer Frage ("frage_meldungen"). Der Schiedsrichter
--      meldet direkt an der Frage: die Loesung stimmt nicht, der Text ist
--      unklar, das Video laedt nicht, oder er will einfach etwas dazu sagen.
--   2. Meldebogen ("meldungen"). Der Schiedsrichter meldet etwas aus seinem
--      eigenen Spielbetrieb: einen Regelfall, ueber den er unsicher ist, einen
--      Vorfall (Anfeindung, Bedrohung, Diskriminierung), einen
--      Gespraechswunsch, oder einen Hinweis fuer die Vereinswebsite.
--   3. Der Eingang ("obmann_eingang"). Ein Strom, der alles zusammenfuehrt, was
--      von den Leuten kommt: die beiden neuen Kanaele plus die schon
--      vorhandenen Ausruestungsanfragen und Termin-Absagen plus die
--      Quiz-Aktivitaet.
--
--
-- WARUM ZWEI TABELLEN FUER EINE FRAGE-RUECKMELDUNG
--
-- Max' Anforderung lautet woertlich: "ein offener Bericht pro Person und Frage;
-- eine zweite Meldung erweitert die erste, statt sie zu ersetzen". Das ist keine
-- Kosmetik. Wer eine Frage meldet, meldet sie oft zweimal -- erst "die Loesung
-- stimmt nicht", zwei Tage spaeter "ausserdem laedt das Video nicht". Wuerde man
-- den zweiten Text in dasselbe Feld schreiben, waere die erste Meldung weg.
-- Wuerde man ihn anhaengen, waere zwar der Wortlaut da, aber nicht mehr, wann
-- was gesagt wurde und unter welcher Kategorie -- und die Kategorie ist das
-- Einzige, woran Max auf einen Blick erkennt, ob er die Loesung pruefen oder
-- den Videolink erneuern muss. Also: ein Kopfsatz je Person und Frage
-- ("frage_meldungen"), darunter beliebig viele datierte, kategorisierte
-- Eintraege ("frage_meldung_eintraege"). Ein partieller Unique-Index haelt fest,
-- dass es je Frage und Person nur EINEN offenen Kopfsatz geben darf; ist der
-- erledigt, darf spaeter ein neuer entstehen.
--
--
-- WARUM DER SCHNAPPSCHUSS SERVERSEITIG ENTSTEHT
--
-- "gegebene_antwort" und "loesung_snapshot" halten fest, was die Person geantwortet
-- hatte und wie die Loesung zum Meldezeitpunkt aussah. Ohne das muesste Max bei
-- jeder Meldung rekonstruieren, worum es ueberhaupt ging -- und wenn er in der
-- Zwischenzeit die Loesung korrigiert hat, kann er es gar nicht mehr: die Meldung
-- "die Loesung ist falsch" wird sinnlos, sobald die Loesung eine andere ist.
-- Genau daran stirbt so eine Funktion im Alltag.
-- Beide Felder werden deshalb von der Datenbank aus den vorhandenen Daten
-- gefuellt und NICHT vom Aufrufer entgegengenommen. Wenn der Client den
-- Schnappschuss liefern duerfte, koennte er behaupten, was er will -- und Max
-- wuerde eine erfundene Vorgeschichte lesen und ihr glauben.
--
--
-- WARUM VIER CHECK-BEDINGUNGEN AUF "meldungen"
--
-- Was nur die Oberflaeche prueft, umgeht der naechste Aufrufer. Und beim
-- Meldebogen sind es keine Formalien, sondern Zusagen, die im Formular
-- ausgesprochen werden:
--
--   1. Ein Vorfall darf nie veroeffentlicht werden. Wer eine Anfeindung oder
--      Bedrohung meldet, tut das unter der Zusage, dass daraus kein Quizinhalt
--      und kein oeffentlicher "Fall der Woche" wird. Wird diese Zusage ein
--      einziges Mal gebrochen, meldet nie wieder jemand etwas -- der Kanal ist
--      dann tot, und zwar dauerhaft. Das ist die wichtigste Zusicherung des
--      ganzen Konzepts, also gehoert sie in die Datenbank und nicht in ein
--      Formularfeld.
--   2. Anonym heisst anonym. Steht bei einer als anonym markierten Meldung eine
--      schiedsrichter_id, dann war "anonym" eine Luege, die im Formular
--      versprochen wurde. Die Bedingung macht die Luege unmoeglich statt
--      unwahrscheinlich.
--   3. Vorfall und Gespraech brauchen eine Aufbewahrungsfrist. Personenbezogene
--      Aufzeichnungen ohne Loeschdatum bleiben ewig liegen. Die Frist wird
--      erzwungen, nicht erhofft.
--   4. Ein Website-Hinweis hat keine Spielklasse, keine eigene Entscheidung und
--      keine Beteiligten. Wer der Website schreibt, meldet keinen Spielvorgang;
--      wuerden diese Felder trotzdem gefuellt, entstuende ein Personenbezug, den
--      niemand gewollt hat.
--
--
-- AUFBEWAHRUNGSFRIST: ZWEI JAHRE
--
-- Fuer "vorfall" und "gespraech" wird "aufbewahren_bis" serverseitig auf
-- current_date + 2 Jahre gesetzt. Begruendung: Sportgerichtsverfahren und
-- Rechtsmittelfristen im Verbandsbereich sind regelmaessig binnen weniger Monate
-- abgeschlossen; ein Jahr wuerde dafuer genuegen. Zwei Jahre decken zusaetzlich
-- die komplette Folgesaison ab, und genau die braucht man: Ein zweiter Vorfall
-- mit derselben Mannschaft ist nur dann als Muster erkennbar, wenn der erste
-- noch auffindbar ist, und zwischen zwei Begegnungen mit derselben Mannschaft
-- liegt oft eine ganze Saison. Laenger als zwei Jahre waere nicht mehr
-- begruendbar: Danach ist der Vorgang fuer die Ausbildung wertlos, und eine
-- Aufzeichnung ueber ein persoenliches Gespraech, die niemand mehr braucht,
-- soll nicht liegenbleiben. Das Datum ist ein Loeschvorschlag, kein
-- automatischer Loeschlauf -- geloescht wird bewusst; ein Cronjob, der
-- Vorfaelle stillschweigend wegraeumt, waere schlimmer als eine Frist, die
-- jemand ueberzieht.
--
--
-- DER ZAEHLER AN DER REITERLEISTE ZAEHLT NUR ERLEDIGBARES
--
-- Der Eingang zeigt fuenf Arten. Vier davon sind Aufgaben: eine Anfrage, eine
-- Absage, ein Meldebogen, eine Frage-Rueckmeldung -- jede kann Max abarbeiten
-- und wegklicken. Die fuenfte, die Quiz-Aktivitaet, ist ein Strom: Jede Woche
-- schliessen Leute ihr Quiz ab, das ist erfreulich, aber es ist nichts zu tun.
-- Wuerde die Quiz-Aktivitaet in den Zaehler eingehen, ginge die Zahl an der
-- Reiterleiste nie auf null. Und eine Zahl, die nie auf null geht, lernt man
-- innerhalb von zwei Wochen zu ignorieren -- dann ist die ganze Zahl wertlos
-- und mit ihr die Anfragen und Meldungen, die tatsaechlich dahinterstehen.
-- Die Quiz-Aktivitaet erscheint deshalb im Strom, aber nicht im Zaehler.
-- "obmann_eingang_zaehler" liefert dafuer eine eigene Spalte
-- "zaehlt_fuer_reiter": die App summiert genau die Zeilen, in denen sie true
-- ist. Die Entwurfsentscheidung steht damit in den Daten und nicht nur in einer
-- Notiz, die beim naechsten Umbau niemand liest.
--
--
-- ZWEI NEUE SPALTEN AUF "termin_rueckmeldungen" -- ausdruecklich benannt
--
-- Damit Absagen ueberhaupt "erledigbar" sein koennen, brauchen sie zweierlei,
-- das die Tabelle bisher nicht hat:
--   * eine eigene, adressierbare id -- der Primaerschluessel ist
--     (termin_id, schiedsrichter_id), damit laesst sich ein Eintrag im
--     vereinheitlichten Strom nicht mit einer einzigen uuid ansprechen;
--   * ein Kennzeichen "obmann_erledigt" -- ohne das gaebe es keinen Weg, eine
--     gelesene Absage aus dem Eingang zu nehmen, und die Absagen-Zahl ginge
--     genauso wenig auf null wie die Quiz-Zahl. Damit haette man den Fehler,
--     den man bei der Quiz-Aktivitaet gerade vermeidet, an anderer Stelle
--     wieder eingebaut.
-- Beide Spalten sind rein additiv: bestehende Zeilen bekommen eine frische uuid
-- und "erledigt = false", das heisst sie tauchen ab jetzt einmal im Eingang auf.
-- Das ist gewollt -- es ist der Posteingang, den Max noch nie gesehen hat.
--
--
-- ZUGRIFF
--
-- Alle neuen Datentabellen: RLS an, keine Policies, zusaetzlich werden anon und
-- authenticated die Tabellenrechte ausdruecklich entzogen. Supabase vergibt auf
-- neu angelegte Tabellen per Default-Privileg volle Rechte an anon; ohne dieses
-- revoke haengt die Vertraulichkeit eines Vorfallberichts allein daran, dass
-- niemand versehentlich eine Policy anlegt. Zwei Schloesser statt einem.
-- Zugriff ausschliesslich ueber SECURITY DEFINER-RPCs -- spielerseitig mit PIN
-- wie in "wochen_fragen_v2", obmannseitig mit Passwort ueber "obmann_verein".
-- Fuer jede Funktion einzeln: revoke from public, dann grant execute an anon und
-- authenticated. Ein durchgelaufenes "create function" sagt ueber die Rechte
-- gar nichts -- das war in v107b schon einmal ein echter Fehler.
--
-- Alle neuen Funktionen werden vorher gedroppt statt "create or replace"
-- verwendet (PGRST202-Lehre aus v85). Alle optionalen Parameter haben Defaults
-- und werden mit coalesce gegen den Bestand gelegt, damit ein aelterer
-- App-Stand nie stillschweigend ein Feld zuruecksetzt.


-- ---------------------------------------------------------------------------
-- 1) Rueckmeldung zu einer Frage
-- ---------------------------------------------------------------------------

create table if not exists public.frage_meldungen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  frage_id uuid not null references public.fragen(id) on delete cascade,
  schiedsrichter_id uuid null references public.schiedsrichter(id) on delete set null,
  status text not null default 'offen'
    constraint frage_meldungen_status_gueltig
    check (status in ('offen','erledigt','abgelehnt')),
  runde_id uuid null references public.runden(id) on delete set null,
  gegebene_antwort text null,
  loesung_snapshot jsonb null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

comment on table public.frage_meldungen is
'Kopfsatz einer Rueckmeldung zu einer Quizfrage. Je Frage und Person hoechstens ein offener Kopfsatz (partieller Unique-Index). gegebene_antwort und loesung_snapshot sind Schnappschuesse zum Meldezeitpunkt und werden ausschliesslich serverseitig gefuellt. Siehe v111.';

create table if not exists public.frage_meldung_eintraege (
  id uuid primary key default gen_random_uuid(),
  meldung_id uuid not null references public.frage_meldungen(id) on delete cascade,
  kategorie text not null
    constraint frage_meldung_eintraege_kategorie_gueltig
    check (kategorie in ('antwort','feedback','text_unklar','video_technik','sonstiges')),
  text text not null
    constraint frage_meldung_eintraege_text_laenge
    check (char_length("text") between 1 and 1000),
  erstellt_am timestamptz not null default now()
);

comment on table public.frage_meldung_eintraege is
'Einzelner datierter, kategorisierter Beitrag zu einer frage_meldungen-Zeile. Eine zweite Meldung derselben Person zur selben Frage erweitert den Kopfsatz um einen Eintrag, statt ihn zu ueberschreiben. Siehe v111.';

-- Kernstueck der Anforderung "erweitern statt ersetzen": nur EIN offener
-- Kopfsatz je Frage und Person. Nach 'erledigt' oder 'abgelehnt' greift die
-- Bedingung nicht mehr, ein spaeterer neuer Vorgang ist also moeglich.
create unique index if not exists frage_meldungen_eine_offene_je_person_frage
  on public.frage_meldungen (frage_id, schiedsrichter_id)
  where status = 'offen';

create index if not exists frage_meldungen_verein_status_idx
  on public.frage_meldungen (verein_id, status, erstellt_am desc);

create index if not exists frage_meldungen_frage_idx
  on public.frage_meldungen (frage_id);

create index if not exists frage_meldung_eintraege_meldung_idx
  on public.frage_meldung_eintraege (meldung_id, erstellt_am);

alter table public.frage_meldungen enable row level security;
alter table public.frage_meldung_eintraege enable row level security;

revoke all on table public.frage_meldungen from anon, authenticated;
revoke all on table public.frage_meldung_eintraege from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2) Meldebogen
-- ---------------------------------------------------------------------------

create table if not exists public.meldungen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  art text not null
    constraint meldungen_art_gueltig
    check (art in ('regelfall','vorfall','gespraech','website')),
  schiedsrichter_id uuid null references public.schiedsrichter(id) on delete set null,
  anonym boolean not null default false,
  spielklasse text null,
  situation text not null
    constraint meldungen_situation_laenge
    check (char_length(situation) between 1 and 4000),
  eigene_entscheidung text null,
  unsicher_warum text null,
  beteiligte text null,
  sonderbericht_geschrieben boolean null,
  veroeffentlichung_erlaubt boolean not null default false,
  status text not null default 'offen'
    constraint meldungen_status_gueltig
    check (status in ('offen','in_arbeit','erledigt')),
  erstellt_am timestamptz not null default now(),
  aufbewahren_bis date null,

  -- (1) Ein Vorfall wird nie Quizinhalt und nie oeffentlicher Fall der Woche.
  constraint meldungen_vorfall_nie_veroeffentlichen
    check (art <> 'vorfall' or veroeffentlichung_erlaubt = false),

  -- (2) Anonym heisst anonym: keine Person am Datensatz.
  constraint meldungen_anonym_ohne_person
    check (anonym = false or schiedsrichter_id is null),

  -- (3) Vorfall und Gespraech ohne Loeschdatum gibt es nicht.
  constraint meldungen_frist_bei_vorfall_und_gespraech
    check (art not in ('vorfall','gespraech') or aufbewahren_bis is not null),

  -- (4) Ein Website-Hinweis ist kein Spielvorgang.
  constraint meldungen_website_ohne_spielfelder
    check (art <> 'website'
           or (spielklasse is null and eigene_entscheidung is null and beteiligte is null))
);

comment on table public.meldungen is
'Meldebogen: Regelfall, Vorfall, Gespraechswunsch oder Website-Hinweis. Vier CHECK-Bedingungen halten die fachlichen Zusagen fest (Vorfall nie veroeffentlichen, anonym ohne Person, Frist bei Vorfall und Gespraech, Website ohne Spielfelder). Siehe v111.';

create index if not exists meldungen_verein_status_idx
  on public.meldungen (verein_id, status, erstellt_am desc);

create index if not exists meldungen_aufbewahren_bis_idx
  on public.meldungen (aufbewahren_bis)
  where aufbewahren_bis is not null;

alter table public.meldungen enable row level security;

revoke all on table public.meldungen from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) Termin-Absagen erledigbar machen
-- ---------------------------------------------------------------------------

alter table public.termin_rueckmeldungen
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.termin_rueckmeldungen
  add column if not exists obmann_erledigt boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'termin_rueckmeldungen_id_key'
      and conrelid = 'public.termin_rueckmeldungen'::regclass
  ) then
    alter table public.termin_rueckmeldungen
      add constraint termin_rueckmeldungen_id_key unique (id);
  end if;
end $$;

comment on column public.termin_rueckmeldungen.id is
'Eigene adressierbare id. Der Primaerschluessel ist (termin_id, schiedsrichter_id) und laesst sich im vereinheitlichten Eingang nicht mit einer uuid ansprechen. Siehe v111.';

comment on column public.termin_rueckmeldungen.obmann_erledigt is
'Absage im Eingang abgehakt. Ohne dieses Kennzeichen ginge die Absagen-Zahl an der Reiterleiste nie auf null. Siehe v111.';


-- ---------------------------------------------------------------------------
-- 4) Spielerseitige RPCs (PIN-Anmeldung, Rechte fuer anon)
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
  v_pin text;
  v_aktiv boolean;
  v_verein uuid;
  v_runde uuid;
  v_meldung uuid;
  v_neu boolean := false;
  v_anzahl integer;
  v_text text;
  v_gegeben text;
  v_snapshot jsonb;
begin
  -- Anmeldung exakt wie in wochen_fragen_v2: PIN muss stimmen UND die Person
  -- muss aktiv sein. Ein Gast hat keine schiedsrichter_id und kommt hier gar
  -- nicht erst hinein.
  select s.pin, s.aktiv, s.verein_id
    into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;

  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

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
'Legt eine Rueckmeldung zu einer Frage an oder erweitert die vorhandene offene derselben Person zu derselben Frage um einen Eintrag. gegebene_antwort und loesung_snapshot werden serverseitig gefuellt und nicht vom Aufrufer entgegengenommen. Rueckgabe: meldung_id, neu_angelegt, anzahl_eintraege. Siehe v111.';


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
  v_pin text;
  v_aktiv boolean;
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
  select s.pin, s.aktiv, s.verein_id
    into v_pin, v_aktiv, v_verein
  from schiedsrichter s where s.id = p_schiedsrichter_id;

  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;

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
  -- ausfuehrlich im Kopfkommentar.
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
'Nimmt einen Meldebogen entgegen. p_anonym = true setzt schiedsrichter_id serverseitig auf null. Bei art = vorfall wird veroeffentlichung_erlaubt serverseitig auf false gezwungen, bei art = website werden Spielklasse, eigene Entscheidung und Beteiligte verworfen. aufbewahren_bis wird bei vorfall und gespraech auf current_date + 2 Jahre gesetzt. Siehe v111.';


-- ---------------------------------------------------------------------------
-- 5) Obmannseitige RPCs
-- ---------------------------------------------------------------------------

drop function if exists public.obmann_eingang(text, text, integer);

create function public.obmann_eingang(
  p_passwort text,
  p_art text default null,
  p_limit int default 100
)
returns table (
  art text,
  eintrag_id uuid,
  titel text,
  vorschau text,
  person text,
  erstellt_am timestamptz,
  ist_erledigbar boolean,
  status text,
  verweis_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_limit int := greatest(1, least(coalesce(p_limit, 100), 500));
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
      a.id                                     as e_verweis
    from ausruestungs_anfragen a
    join schiedsrichter s on s.id = a.schiedsrichter_id
    where s.verein_id = v_verein
      and a.status = 'offen'
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
      'offen'::text                            as e_status,
      t.id                                     as e_verweis
    from termin_rueckmeldungen tr
    join termine t on t.id = tr.termin_id
    join schiedsrichter s on s.id = tr.schiedsrichter_id
    where t.verein_id = v_verein
      and tr.status = 'ab'
      and tr.obmann_erledigt = false
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
      fm.frage_id                              as e_verweis
    from frage_meldungen fm
    join fragen f on f.id = fm.frage_id
    left join schiedsrichter s on s.id = fm.schiedsrichter_id
    left join wochen_frage_nummern nr
      on nr.verein_id = fm.verein_id
     and nr.frage_id = fm.frage_id
     and nr.runde_id = fm.runde_id
    where fm.verein_id = v_verein
      and fm.status = 'offen'
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
      m.id                                     as e_verweis
    from meldungen m
    left join schiedsrichter s on s.id = m.schiedsrichter_id
    where m.verein_id = v_verein
      and m.status in ('offen','in_arbeit')
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
    -- e_erledigbar = false und im Zaehler nicht enthalten.
    select
      'quiz'::text                             as e_art,
      md5(q.schiri_id::text || q.runde_id::text)::uuid as e_id,
      'Quiz abgeschlossen: ' || r.bezeichnung  as e_titel,
      q.richtig::text || ' von ' || q.ist::text || ' richtig' as e_vorschau,
      q.schiri_name                            as e_person,
      q.letzte                                 as e_zeit,
      false                                    as e_erledigbar,
      'abgeschlossen'::text                    as e_status,
      q.schiri_id                              as e_verweis
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
    st.e_zeit, st.e_erledigbar, st.e_status, st.e_verweis
  from strom st
  where p_art is null or st.e_art = p_art
  order by st.e_zeit desc
  limit v_limit;
end;
$function$;

revoke all on function public.obmann_eingang(text, text, integer) from public;
grant execute on function public.obmann_eingang(text, text, integer) to anon, authenticated;

comment on function public.obmann_eingang(text, text, integer) is
'Gemeinsamer Eingang des Obmanns ueber offene Ausruestungsanfragen, nicht abgehakte Termin-Absagen, offene Frage-Rueckmeldungen, offene Meldeboegen und abgeschlossene Quizrunden. p_art filtert auf anfrage, absage, frage_meldung, meldung oder quiz. Quiz-Eintraege sind bewusst nicht erledigbar. Siehe v111.';


drop function if exists public.obmann_eingang_zaehler(text);

create function public.obmann_eingang_zaehler(p_passwort text)
returns table (
  art text,
  anzahl integer,
  zaehlt_fuer_reiter boolean
)
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
    where fm.verein_id = v_verein and fm.status = 'offen'
  ), true

  union all
  select 'meldung'::text, (
    select count(*)::integer
    from meldungen m
    where m.verein_id = v_verein and m.status in ('offen','in_arbeit')
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
$function$;

revoke all on function public.obmann_eingang_zaehler(text) from public;
grant execute on function public.obmann_eingang_zaehler(text) to anon, authenticated;

comment on function public.obmann_eingang_zaehler(text) is
'Anzahl je Art fuer die Zahl an der Reiterleiste. Die Zahl am Reiter ist die Summe ueber die Zeilen mit zaehlt_fuer_reiter = true; die Quiz-Zeile ist bewusst false, damit die Zahl auf null gehen kann. Siehe v111.';


drop function if exists public.obmann_meldung_status_setzen(text, text, uuid, text);

create function public.obmann_meldung_status_setzen(
  p_passwort text,
  p_art text,
  p_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    if p_status not in ('offen','erledigt','abgelehnt') then
      raise exception 'Status % ist fuer eine Frage-Rueckmeldung nicht zulaessig', p_status;
    end if;
    update frage_meldungen fm
       set status = p_status, aktualisiert_am = now()
     where fm.id = p_id and fm.verein_id = v_verein;
    get diagnostics v_treffer = row_count;

  elsif p_art = 'meldung' then
    if p_status not in ('offen','in_arbeit','erledigt') then
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
$function$;

revoke all on function public.obmann_meldung_status_setzen(text, text, uuid, text) from public;
grant execute on function public.obmann_meldung_status_setzen(text, text, uuid, text) to anon, authenticated;

comment on function public.obmann_meldung_status_setzen(text, text, uuid, text) is
'Setzt den Status eines erledigbaren Eingangs-Eintrags. p_art: anfrage, absage, frage_meldung, meldung. Bei einer Absage wird nicht die Rueckmeldung der Person geaendert, sondern nur das Kennzeichen obmann_erledigt. Trifft nichts zu, wird ein Fehler geworfen statt still nichts zu tun. Siehe v111.';


drop function if exists public.obmann_frage_meldungen(text, uuid);

create function public.obmann_frage_meldungen(
  p_passwort text,
  p_frage_id uuid default null
)
returns table (
  meldung_id uuid,
  frage_id uuid,
  frage_nummer integer,
  frage_text text,
  schiedsrichter_id uuid,
  person text,
  status text,
  runde_id uuid,
  runde_bezeichnung text,
  gegebene_antwort text,
  loesung_snapshot jsonb,
  erstellt_am timestamptz,
  aktualisiert_am timestamptz,
  anzahl_eintraege integer,
  eintraege jsonb
)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  order by (fm.status = 'offen') desc, fm.aktualisiert_am desc;
end;
$function$;

revoke all on function public.obmann_frage_meldungen(text, uuid) from public;
grant execute on function public.obmann_frage_meldungen(text, uuid) to anon, authenticated;

comment on function public.obmann_frage_meldungen(text, uuid) is
'Frage-Rueckmeldungen samt ihrer Eintraege, fuer die Plakette an der Frage im Fragen-Reiter. p_frage_id null = alle Meldungen des Vereins, offene zuerst. Siehe v111.';
