-- =====================================================================
-- v149 - Ausruestungsanfragen: der Prozessvertrag
-- =====================================================================
--
-- WARUM diese Migration ueberhaupt gebaut wird
-- --------------------------------------------
-- Bis hierher war der Zustand einer Ausruestungsanfrage ueber mehrere
-- lose Felder verteilt: ein Freitext-`status` (offen/angenommen/abgelehnt/
-- erledigt), ein davon unabhaengiger `freigabe_status`, dazu vier einzelne
-- Boolean-Schalter (`selbstkauf_bestaetigt`, `abholung_bestaetigt`,
-- `keine_zahlung_faellig`, `erstattet`). Jede Oberflaeche - Website,
-- Obmann-App, Vorstandsseite - hat sich daraus ihre eigene Geschichte
-- zusammengereimt. Genau deshalb konnten drei Oberflaechen drei
-- verschiedene Zustaende derselben Anfrage anzeigen.
--
-- Fachlich ist der Vorgang aber ein ganz normaler Procure-to-Pay-Prozess
-- mit mehreren Akteuren:
--
--   gemeinsamer Anfang
--     eingereicht      (Schiedsrichter fragt auf der Website an)
--     geprueft         (Max prueft Preis und Vollstaendigkeit)
--     vorgelegt        (Max legt dem Vorstand vor - Preis eingefroren)
--     freigegeben  ODER  abgelehnt      (Entscheidung des Vorstands)
--
--   danach zwei getrennte Wege
--     Selbstkauf (weg2_schiri_besorgt):
--       gekauft -> beleg_hochgeladen -> beleg_geprueft
--               -> zahlung_angewiesen -> geld_erhalten -> abgeschlossen
--     Vereinskauf (weg1_obmann_besorgt):
--       bestellt -> eingegangen -> uebergeben -> abgeschlossen
--
-- Zwei Punkte sind dabei nicht Kosmetik, sondern der eigentliche Grund
-- fuer den Umbau:
--
--   1. "Freigegeben" heisst freigegebenes Budget, NICHT ausgegebenes Geld.
--      Und "erstattet" war bisher ein einziger Schalter fuer zwei voellig
--      verschiedene Dinge: "die Ueberweisung ist angewiesen" (weiss der
--      Vereinsverantwortliche) und "das Geld ist angekommen" (weiss nur
--      der Schiedsrichter). Das sind jetzt zwei Schritte mit je eigenem
--      Akteur.
--
--   2. Max darf Preis und Vollstaendigkeit pruefen, aber er darf die
--      Vereinsausgabe nicht selbst freigeben. Der Uebergang nach
--      'freigegeben' ist deshalb ausschliesslich der Rolle 'vorstand'
--      erlaubt - und zwar hier in der Datenbank, nicht im Frontend.
--
-- Was hier NICHT passiert
-- -----------------------
-- Diese Migration legt nur den Vertrag an: Spalten, Zustandsmenge,
-- erlaubte Uebergaenge, Ereignistabelle und die eine zentrale
-- Uebergangsfunktion. Die rollenabhaengigen Aktions-RPCs (v150) und die
-- Eingang-/Postfach-Anbindung (v151) setzen darauf auf. Bereits
-- angewandte Migrationen v145-v148 werden bewusst nicht rueckwirkend
-- veraendert.
--
-- Die alten Felder bleiben vorerst erhalten und werden von der zentralen
-- Uebergangsfunktion mitgepflegt. Solange App und Website noch nicht auf
-- den neuen Vertrag umgestellt sind, zeigen sie damit weiterhin das
-- Richtige an, statt waehrend des Umbaus kaputtzugehen.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Neue Spalten am Vorgang
-- ---------------------------------------------------------------------
-- `abgeholt_am` existiert schon aus v58 und bedeutet fachlich genau
-- "uebergeben" - deshalb wird es weiterverwendet und nicht verdoppelt.

alter table public.ausruestungs_anfragen
  add column if not exists prozess_status        text        not null default 'eingereicht',
  add column if not exists prozess_runde         smallint    not null default 1,
  add column if not exists geprueft_am           timestamptz,
  add column if not exists vorlage_preis_cent    integer,
  add column if not exists vorlage_am            timestamptz,
  add column if not exists vorlage_link_id       uuid,
  add column if not exists vorlage_umfang        jsonb,
  add column if not exists gekauft_am            timestamptz,
  add column if not exists beleg_geprueft_am     timestamptz,
  add column if not exists zahlung_angewiesen_am timestamptz,
  add column if not exists zahlung_angewiesen_von text,
  add column if not exists geld_erhalten_am      timestamptz,
  add column if not exists geld_erhalten_von     text,
  add column if not exists bestellt_am           timestamptz,
  add column if not exists wareneingang_am       timestamptz,
  add column if not exists abgeschlossen_am      timestamptz;

-- Der Freigabe-Link, unter dem der Vorgang vorgelegt wurde. Ein Link darf
-- spaeter nur noch genau seinen eigenen Stapel sehen - bisher haette ein
-- laufender Link auch Anfragen erfasst, die erst nach seiner Erstellung
-- vorgelegt wurden.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ausruestungs_anfragen_vorlage_link_fk'
  ) then
    alter table public.ausruestungs_anfragen
      add constraint ausruestungs_anfragen_vorlage_link_fk
      foreign key (vorlage_link_id)
      references public.freigabe_links(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ausruestungs_anfragen_prozess_status_check'
  ) then
    alter table public.ausruestungs_anfragen
      add constraint ausruestungs_anfragen_prozess_status_check
      check (prozess_status in (
        'eingereicht','geprueft','vorgelegt','abgelehnt','freigegeben',
        'gekauft','beleg_hochgeladen','beleg_geprueft',
        'zahlung_angewiesen','geld_erhalten',
        'bestellt','eingegangen','uebergeben',
        'abgeschlossen','zurueckgezogen'));
  end if;
end $$;

create index if not exists ausruestungs_anfragen_prozess_idx
  on public.ausruestungs_anfragen (prozess_status, erstellt_am);

create index if not exists ausruestungs_anfragen_vorlage_link_idx
  on public.ausruestungs_anfragen (vorlage_link_id);


-- ---------------------------------------------------------------------
-- 2. Ereignistabelle - die gemeinsame Grundlage aller Oberflaechen
-- ---------------------------------------------------------------------
-- Website, Obmann-App, Vorstandsseite, Eingang und (spaeter) Push lesen
-- alle dieselbe Liste und stellen sie nur unterschiedlich dar. Damit
-- kann keine Oberflaeche mehr einen Zustand zeigen, den es nie gab.
--
-- `schluessel` ist der Idempotenz-Schluessel: Anfrage + Schritt + Runde.
-- Ein Reload, ein doppelter Tap oder eine wiederholte Zustellung erzeugt
-- damit keinen zweiten Eingangseintrag. Die Runde ist Teil des
-- Schluessels, weil ein Vorgang nach einer Preisaenderung erneut
-- vorgelegt und erneut entschieden werden darf.

create table if not exists public.ausruestung_ereignisse (
  id                   uuid primary key default gen_random_uuid(),
  anfrage_id           uuid not null
                         references public.ausruestungs_anfragen(id) on delete cascade,
  verein_id            uuid not null
                         references public.vereine(id) on delete cascade,
  runde                smallint not null default 1,
  schritt              text not null,
  akteur_rolle         text not null
                         check (akteur_rolle in ('schiri','obmann','vorstand','system')),
  akteur_name          text,
  notiz                text,
  betrag_cent          integer,
  -- Nicht jede technische Aenderung wird zu einer Nachricht. Nur
  -- Ereignisse mit eingang = true landen in Max' Postfach.
  eingang              boolean not null default false,
  eingang_gelesen_am   timestamptz,
  eingang_erledigt_am  timestamptz,
  erstellt_am          timestamptz not null default now(),
  schluessel           text not null unique
);

create index if not exists ausruestung_ereignisse_anfrage_idx
  on public.ausruestung_ereignisse (anfrage_id, erstellt_am);

create index if not exists ausruestung_ereignisse_eingang_idx
  on public.ausruestung_ereignisse (verein_id, eingang, eingang_erledigt_am, erstellt_am desc);

alter table public.ausruestung_ereignisse enable row level security;
-- Bewusst ohne Policies: der Zugriff laeuft ausschliesslich ueber die
-- SECURITY-DEFINER-RPCs, genau wie bei allen anderen Datentabellen.


-- ---------------------------------------------------------------------
-- 3. Die erlaubten Uebergaenge - als Daten, nicht als if-Wald
-- ---------------------------------------------------------------------
-- Als Tabelle formuliert, damit sie testbar ist und man sie lesen kann,
-- ohne plpgsql zu entziffern. `weg` ist entweder 'beide' oder der
-- Beschaffungsweg, auf dem der Uebergang ueberhaupt vorkommt.
-- `rollen` zaehlt auf, wer ihn ausloesen darf.

create or replace function public.ausruestung_uebergaenge()
returns table(von text, nach text, weg text, rollen text[])
language sql
immutable
set search_path to ''
as $$
  select * from (values
    -- gemeinsamer Anfang
    ('eingereicht',        'geprueft',           'beide',              array['obmann']),
    ('eingereicht',        'abgelehnt',          'beide',              array['obmann']),
    ('eingereicht',        'zurueckgezogen',     'beide',              array['schiri','obmann']),
    ('geprueft',           'eingereicht',        'beide',              array['obmann']),
    ('geprueft',           'vorgelegt',          'beide',              array['obmann']),
    ('geprueft',           'abgelehnt',          'beide',              array['obmann']),
    ('geprueft',           'zurueckgezogen',     'beide',              array['schiri','obmann']),
    ('vorgelegt',          'geprueft',           'beide',              array['obmann']),
    -- NUR der Vorstand entscheidet. Max steht hier bewusst nicht.
    ('vorgelegt',          'freigegeben',        'beide',              array['vorstand']),
    ('vorgelegt',          'abgelehnt',          'beide',              array['vorstand']),
    -- Preis- oder Umfangsaenderung nach der Entscheidung: der Vorgang
    -- faellt auf 'geprueft' zurueck und braucht eine NEUE Freigabe.
    -- Die alte Entscheidung bleibt als Ereignis erhalten.
    ('freigegeben',        'geprueft',           'beide',              array['obmann']),
    ('abgelehnt',          'geprueft',           'beide',              array['obmann']),

    -- Selbstkauf
    ('freigegeben',        'gekauft',            'weg2_schiri_besorgt', array['schiri','obmann']),
    ('gekauft',            'beleg_hochgeladen',  'weg2_schiri_besorgt', array['schiri']),
    ('beleg_hochgeladen',  'beleg_geprueft',     'weg2_schiri_besorgt', array['obmann']),
    ('beleg_hochgeladen',  'gekauft',            'weg2_schiri_besorgt', array['obmann']),
    ('beleg_geprueft',     'zahlung_angewiesen', 'weg2_schiri_besorgt', array['obmann','vorstand']),
    -- Wenn gar nichts zu erstatten ist (der Schiedsrichter will kein
    -- Geld), endet der Weg direkt hier.
    ('beleg_geprueft',     'abgeschlossen',      'weg2_schiri_besorgt', array['obmann']),
    ('zahlung_angewiesen', 'geld_erhalten',      'weg2_schiri_besorgt', array['schiri','obmann']),
    ('geld_erhalten',      'abgeschlossen',      'weg2_schiri_besorgt', array['obmann','system']),

    -- Vereinskauf
    ('freigegeben',        'bestellt',           'weg1_obmann_besorgt', array['obmann']),
    ('bestellt',           'eingegangen',        'weg1_obmann_besorgt', array['obmann']),
    ('eingegangen',        'uebergeben',         'weg1_obmann_besorgt', array['obmann']),
    ('uebergeben',         'abgeschlossen',      'weg1_obmann_besorgt', array['obmann','system']),

    -- Ablage
    ('abgelehnt',          'abgeschlossen',      'beide',              array['obmann']),
    ('zurueckgezogen',     'abgeschlossen',      'beide',              array['obmann'])
  ) as t(von, nach, weg, rollen);
$$;

revoke all on function public.ausruestung_uebergaenge() from public;


-- ---------------------------------------------------------------------
-- 4. Ereignis schreiben (idempotent)
-- ---------------------------------------------------------------------
create or replace function public.ausruestung_ereignis_schreiben(
  p_anfrage uuid,
  p_schritt text,
  p_rolle   text,
  p_name    text,
  p_notiz   text,
  p_betrag  integer,
  p_eingang boolean
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_runde  smallint;
  v_id     uuid;
begin
  select s.verein_id, a.prozess_runde
    into v_verein, v_runde
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_anfrage;

  if v_verein is null then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  insert into public.ausruestung_ereignisse
    (anfrage_id, verein_id, runde, schritt, akteur_rolle, akteur_name,
     notiz, betrag_cent, eingang, schluessel)
  values
    (p_anfrage, v_verein, v_runde, p_schritt, p_rolle,
     nullif(btrim(coalesce(p_name, '')), ''),
     nullif(btrim(coalesce(p_notiz, '')), ''),
     p_betrag, coalesce(p_eingang, false),
     p_anfrage::text || ':' || p_schritt || ':' || v_runde::text)
  on conflict (schluessel) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ausruestung_ereignis_schreiben(uuid, text, text, text, text, integer, boolean) from public;


-- ---------------------------------------------------------------------
-- 5. Die eine zentrale Uebergangsfunktion
-- ---------------------------------------------------------------------
-- JEDE Zustandsaenderung laeuft hier durch - aus der App, von der
-- Website, von der Vorstandsseite. Nur so kann kein Weg an den Regeln
-- vorbei. Die Funktion setzt ausserdem die alten Felder mit, damit die
-- noch nicht umgestellten Oberflaechen weiterhin das Richtige anzeigen.

create or replace function public.ausruestung_uebergang(
  p_anfrage uuid,
  p_nach    text,
  p_rolle   text,
  p_name    text     default null,
  p_notiz   text     default null,
  p_betrag  integer  default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  a        public.ausruestungs_anfragen%rowtype;
  v_weg    text;
  v_notiz  text := nullif(btrim(coalesce(p_notiz, '')), '');
  v_status text;
begin
  select * into a from public.ausruestungs_anfragen where id = p_anfrage for update;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  if a.typ <> 'ausruestung' then
    raise exception 'Nur Ausruestungsanfragen durchlaufen diesen Prozess.';
  end if;

  v_weg := coalesce(a.beschaffungsweg, 'weg2_schiri_besorgt');

  -- (a) Ist der Uebergang fachlich ueberhaupt vorgesehen?
  if not exists (
    select 1 from public.ausruestung_uebergaenge() u
     where u.von = a.prozess_status
       and u.nach = p_nach
       and (u.weg = 'beide' or u.weg = v_weg)
  ) then
    raise exception 'Schritt "%" ist aus dem Zustand "%" nicht vorgesehen.',
      p_nach, a.prozess_status;
  end if;

  -- (b) Darf diese Rolle das ausloesen?
  if not exists (
    select 1 from public.ausruestung_uebergaenge() u
     where u.von = a.prozess_status
       and u.nach = p_nach
       and (u.weg = 'beide' or u.weg = v_weg)
       and p_rolle = any(u.rollen)
  ) then
    raise exception 'Diese Rolle darf den Schritt "%" nicht ausloesen.', p_nach;
  end if;

  -- (c) Ablehnung ohne Begruendung ist serverseitig verboten. Der
  --     Schiedsrichter bekommt diesen Text zu lesen - ein leeres Nein
  --     ist keine Antwort.
  if p_nach = 'abgelehnt' and v_notiz is null then
    raise exception 'Eine Ablehnung braucht eine Begruendung.';
  end if;

  -- (d) Eine Freigabe ohne eingefrorenen Betrag ist verboten. Der
  --     Vorstand muss wissen, worueber er entscheidet.
  if p_nach = 'freigegeben' and a.vorlage_preis_cent is null then
    raise exception 'Ohne vorgelegten Betrag kann nichts freigegeben werden.';
  end if;

  -- (e) Der alte Freitext-Status, damit nicht umgestellte Oberflaechen
  --     weiter funktionieren.
  v_status := case p_nach
    when 'eingereicht'    then 'offen'
    when 'geprueft'       then 'offen'
    when 'vorgelegt'      then 'offen'
    when 'abgelehnt'      then 'abgelehnt'
    when 'zurueckgezogen' then 'erledigt'
    when 'abgeschlossen'  then 'erledigt'
    else 'angenommen'
  end;

  update public.ausruestungs_anfragen t
     set prozess_status = p_nach,
         status         = v_status,
         -- Zeitpunkte: jeder Schritt schreibt genau seinen eigenen.
         geprueft_am            = case when p_nach = 'geprueft'
                                       then now() else t.geprueft_am end,
         gekauft_am             = case when p_nach = 'gekauft'
                                       then coalesce(t.gekauft_am, now()) else t.gekauft_am end,
         beleg_geprueft_am      = case when p_nach = 'beleg_geprueft'
                                       then now() else t.beleg_geprueft_am end,
         zahlung_angewiesen_am  = case when p_nach = 'zahlung_angewiesen'
                                       then now() else t.zahlung_angewiesen_am end,
         zahlung_angewiesen_von = case when p_nach = 'zahlung_angewiesen'
                                       then nullif(btrim(coalesce(p_name, '')), '')
                                       else t.zahlung_angewiesen_von end,
         geld_erhalten_am       = case when p_nach = 'geld_erhalten'
                                       then now() else t.geld_erhalten_am end,
         geld_erhalten_von      = case when p_nach = 'geld_erhalten'
                                       then nullif(btrim(coalesce(p_name, '')), '')
                                       else t.geld_erhalten_von end,
         bestellt_am            = case when p_nach = 'bestellt'
                                       then now() else t.bestellt_am end,
         wareneingang_am        = case when p_nach = 'eingegangen'
                                       then now() else t.wareneingang_am end,
         abgeholt_am            = case when p_nach = 'uebergeben'
                                       then coalesce(t.abgeholt_am, now()) else t.abgeholt_am end,
         abgeschlossen_am       = case when p_nach = 'abgeschlossen'
                                       then now() else t.abgeschlossen_am end,
         -- Die alten Boolean-Schalter mitfuehren, solange sie noch
         -- irgendwo gelesen werden.
         selbstkauf_bestaetigt  = case when p_nach = 'gekauft'
                                       then true else t.selbstkauf_bestaetigt end,
         selbstkauf_bestaetigt_am = case when p_nach = 'gekauft'
                                       then coalesce(t.selbstkauf_bestaetigt_am, now())
                                       else t.selbstkauf_bestaetigt_am end,
         abholung_bestaetigt    = case when p_nach = 'uebergeben'
                                       then true else t.abholung_bestaetigt end,
         erstattet              = case when p_nach = 'geld_erhalten'
                                       then true else t.erstattet end,
         -- Entscheidung des Vorstands an den bestehenden Feldern.
         freigabe_status        = case
                                    when p_nach = 'freigegeben' then 'freigegeben'
                                    when p_nach = 'abgelehnt' and p_rolle = 'vorstand' then 'abgelehnt'
                                    when p_nach = 'vorgelegt' then 'vorgelegt'
                                    when p_nach = 'geprueft' then 'nicht_vorgelegt'
                                    else t.freigabe_status
                                  end,
         freigabe_name          = case
                                    when p_nach in ('freigegeben') or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                    then nullif(btrim(coalesce(p_name, '')), '')
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_name
                                  end,
         freigabe_notiz         = case
                                    when p_nach in ('freigegeben') or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                    then v_notiz
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_notiz
                                  end,
         freigabe_am            = case
                                    when p_nach in ('freigegeben') or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                    then now()
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_am
                                  end,
         entschieden_am         = case when p_nach in ('freigegeben','abgelehnt')
                                       then now() else t.entschieden_am end,
         -- Zurueck auf 'geprueft' heisst: neue Runde, neue Freigabe noetig.
         prozess_runde          = case when p_nach = 'geprueft'
                                            and t.prozess_status in ('freigegeben','abgelehnt')
                                       then (t.prozess_runde + 1)::smallint
                                       else t.prozess_runde end,
         vorlage_preis_cent     = case when p_nach = 'geprueft' then null else t.vorlage_preis_cent end,
         vorlage_am             = case when p_nach = 'geprueft' then null else t.vorlage_am end,
         vorlage_link_id        = case when p_nach = 'geprueft' then null else t.vorlage_link_id end,
         vorlage_umfang         = case when p_nach = 'geprueft' then null else t.vorlage_umfang end,
         obmann_gesehen         = case when p_rolle in ('schiri','vorstand')
                                       then false else t.obmann_gesehen end,
         schiri_gesehen         = case when p_rolle in ('obmann','vorstand')
                                       then false else t.schiri_gesehen end,
         aktualisiert_am        = now()
   where t.id = p_anfrage;

  -- (f) Ereignis schreiben. Welche Schritte in Max' Postfach landen,
  --     steht bewusst an EINER Stelle.
  perform public.ausruestung_ereignis_schreiben(
    p_anfrage, p_nach, p_rolle, p_name, v_notiz,
    coalesce(p_betrag, a.vorlage_preis_cent),
    p_nach in ('eingereicht','freigegeben','abgelehnt','gekauft',
               'beleg_hochgeladen','geld_erhalten'));
end;
$$;

revoke all on function public.ausruestung_uebergang(uuid, text, text, text, text, integer) from public;


-- ---------------------------------------------------------------------
-- 6. Einfrieren: was vorgelegt ist, aendert sich nicht mehr unbemerkt
-- ---------------------------------------------------------------------
-- Ohne diesen Schutz koennte jemand nach dem Vorlegen den Preis
-- veraendern und der Vorstand haette faktisch etwas anderes freigegeben,
-- als er gesehen hat.

create or replace function public.ausruestung_vorlage_schuetzen()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if old.prozess_status = 'vorgelegt' and new.prozess_status = 'vorgelegt' then
    if new.vorlage_preis_cent is distinct from old.vorlage_preis_cent
       or new.preis_final_cent is distinct from old.preis_final_cent
       or new.kategorie is distinct from old.kategorie
       or new.groesse is distinct from old.groesse
       or new.farbe is distinct from old.farbe
       or new.aermellaenge is distinct from old.aermellaenge then
      raise exception 'Der Vorgang liegt beim Vorstand. Erst zurueckziehen, dann aendern.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ausruestung_vorlage_schuetzen_trigger on public.ausruestungs_anfragen;
create trigger ausruestung_vorlage_schuetzen_trigger
  before update on public.ausruestungs_anfragen
  for each row execute function public.ausruestung_vorlage_schuetzen();


-- ---------------------------------------------------------------------
-- 7. Altbestand einordnen - ohne Geschichte zu erfinden
-- ---------------------------------------------------------------------
-- Wichtig: kein Altvorgang wird auf 'freigegeben' gesetzt. Diese Vorgaenge
-- hat nie ein Vorstand entschieden - sie als freigegeben auszuweisen
-- waere eine glatte Falschaussage im System. Ein vom Obmann angenommener
-- Altvorgang landet deshalb auf 'geprueft': Max hat ihn gesehen, die
-- Freigabe steht aus.

update public.ausruestungs_anfragen a
   set prozess_status = case
         when a.status = 'abgelehnt'  then 'abgelehnt'
         when a.status = 'erledigt'   then 'abgeschlossen'
         when a.status = 'angenommen' then 'geprueft'
         else 'eingereicht'
       end,
       geprueft_am = case when a.status = 'angenommen'
                          then coalesce(a.geprueft_am, a.entschieden_am, a.aktualisiert_am)
                          else a.geprueft_am end,
       abgeschlossen_am = case when a.status = 'erledigt'
                               then coalesce(a.abgeschlossen_am, a.aktualisiert_am)
                               else a.abgeschlossen_am end
 where a.typ = 'ausruestung';

-- Ein Eroeffnungsereignis je Altvorgang, damit die Zeitleiste nicht bei
-- null anfaengt. Mehr wird bewusst nicht rekonstruiert.
insert into public.ausruestung_ereignisse
  (anfrage_id, verein_id, runde, schritt, akteur_rolle, akteur_name,
   notiz, betrag_cent, eingang, erstellt_am, schluessel)
select a.id, s.verein_id, 1, 'eingereicht', 'schiri', s.name,
       null, null, false, a.erstellt_am,
       a.id::text || ':eingereicht:1'
  from public.ausruestungs_anfragen a
  join public.schiedsrichter s on s.id = a.schiedsrichter_id
 where a.typ = 'ausruestung'
on conflict (schluessel) do nothing;
