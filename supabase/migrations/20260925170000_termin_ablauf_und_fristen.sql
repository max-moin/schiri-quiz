-- ============================================================
--  Termine: wann ist etwas vorbei, wann ist eine Frist abgelaufen?
--  (25.09.2026, Backlog P1 "Vergangene Termine rotieren" + Max:
--   "den aktuellen Termine-Durchlauf checken, ob es abgelaufen ist")
-- ============================================================
--  WARUM
--  -----
--  Bis hierher galt ein Termin als "vergangen", sobald sein DATUM vor
--  heute lag. Das hatte drei sichtbare Folgen:
--
--  1. Der Lehrabend am 22.09. von 18 bis 20 Uhr stand um 23 Uhr noch als
--     kommender Termin da - mit der Aufforderung "Noch keine Rueckmeldung".
--  2. Man konnte sich waehrend eines laufenden Termins noch an- und
--     abmelden. Eine Absage um 19 Uhr fuer einen Termin um 18 Uhr ist
--     keine Absage, sondern ein Fehlen.
--  3. Beide Fristen wurden angezeigt, aber nirgends durchgesetzt: Nach
--     "Antwort bis" (termine.rueckmeldung_bis) und nach "Antwort bis" einer
--     Terminabstimmung (terminfindungen.antwort_bis) nahm der Server
--     weiter Antworten an. Wer die Teilnehmerzahl zum Stichtag gemeldet
--     hat, bekam danach noch Zusagen.
--
--  DIE REGEL (eine Stelle, drei Hilfsfunktionen, alles Europe/Berlin)
--  -----------------------------------------------------------------
--  * Beginn = Datum + Beginnzeit. Ohne Beginnzeit gibt es keinen Beginn.
--  * Ende   = Datum + Endzeit (liegt die Endzeit vor dem Beginn: naechster
--             Tag). Ohne Endzeit: Ende des Tages. Lieber einen Termin ein
--             paar Stunden zu lange zeigen als zu frueh verstecken.
--  * Rueckmeldeschluss = Beginn; ohne Beginnzeit das Ende des Tages.
--
--  Absage und Zusage werden BEWUSST verschieden behandelt:
--  * Absagen geht bis zum Rueckmeldeschluss, auch nach der Frist. Eine
--    spaete Absage ist immer besser als ein unangekuendigtes Fehlen.
--  * Zusagen endet mit der Frist ("rueckmeldung_bis"). Danach ist die
--    Planung gemacht (Soccer-Golf: Teilnehmerzahl bis 07.10.). Wer schon
--    zugesagt hat, kann seine Zusage aber ohne Fehler erneut bestaetigen.
--  * Der Obmann (obmann_termin_rueckmeldung_setzen) bleibt unbeschraenkt -
--    er traegt Nachzuegler von Hand nach.
--
--  Bei einer Terminabstimmung endet das Abstimmen mit "antwort_bis". Der
--  Status bleibt "offen", bis der Obmann entscheidet - die App zeigt dann
--  "Frist abgelaufen – jetzt entscheiden" statt die Abstimmung still
--  weiterlaufen zu lassen.
--
--  Mehrere RPCs bekommen dafuer neue Spalten. Postgres kann die
--  Rueckgabe einer Funktion nicht per "create or replace" aendern; diese
--  werden deshalb geloescht und mit denselben Rechten neu angelegt. Die
--  alten Spalten bleiben in Reihenfolge und Bedeutung erhalten, nur
--  "vergangen" rechnet jetzt minutengenau.
-- ============================================================

-- ------------------------------------------------------------
-- Die drei Hilfsfunktionen
-- ------------------------------------------------------------
create or replace function public.termin_beginn_zeitpunkt(p_datum date, p_beginn time)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select case when p_datum is null or p_beginn is null then null
              else (p_datum + p_beginn) at time zone 'Europe/Berlin' end;
$function$;

create or replace function public.termin_ende_zeitpunkt(p_datum date, p_beginn time, p_ende time)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select case
    when p_datum is null then null
    when p_ende is not null and (p_beginn is null or p_ende > p_beginn)
      then (p_datum + p_ende) at time zone 'Europe/Berlin'
    when p_ende is not null
      then ((p_datum + 1) + p_ende) at time zone 'Europe/Berlin'
    else ((p_datum + 1)::timestamp) at time zone 'Europe/Berlin'
  end;
$function$;

create or replace function public.termin_rueckmeldeschluss(p_datum date, p_beginn time)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select coalesce(
    public.termin_beginn_zeitpunkt(p_datum, p_beginn),
    ((p_datum + 1)::timestamp) at time zone 'Europe/Berlin');
$function$;

revoke all on function public.termin_beginn_zeitpunkt(date, time) from public, anon, authenticated;
revoke all on function public.termin_ende_zeitpunkt(date, time, time) from public, anon, authenticated;
revoke all on function public.termin_rueckmeldeschluss(date, time) from public, anon, authenticated;

comment on function public.termin_ende_zeitpunkt(date, time, time) is
  'Einzige Definition von "Termin ist vorbei" (Europe/Berlin). Ohne Endzeit: Ende des Tages.';

-- ------------------------------------------------------------
-- Startseite: die naechsten vier. Unveraenderte Spalten.
-- ------------------------------------------------------------
create or replace function public.oeffentliche_termine(p_seitenschluessel text)
returns table(id uuid, titel text, datum date, beschreibung text, beginn_zeit time,
  ende_zeit time, ort text, art text, pflicht boolean)
language sql
stable
security definer
set search_path to public
as $function$
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.sichtbarkeit = 'oeffentlich'
    and public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) > now()
  order by t.datum, t.beginn_zeit nulls last
  limit 4;
$function$;

revoke all on function public.oeffentliche_termine(text) from public;
grant execute on function public.oeffentliche_termine(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Oeffentliche Gesamtliste. Unveraenderte Spalten, "vergangen" genau.
-- ------------------------------------------------------------
create or replace function public.oeffentliche_termine_alle(p_seitenschluessel text)
returns table(id uuid, titel text, datum date, beschreibung text, beginn_zeit time,
  ende_zeit time, ort text, art text, pflicht boolean, rueckmeldung_bis date,
  rueckmeldung_erforderlich boolean, vergangen boolean)
language sql
stable
security definer
set search_path to public
as $function$
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.rueckmeldung_erforderlich,
         public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) <= now() as vergangen
  from termine t
  join vereine v on v.id = t.verein_id
  where v.oeffentliche_kennung = p_seitenschluessel
    and t.sichtbarkeit = 'oeffentlich'
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
$function$;

revoke all on function public.oeffentliche_termine_alle(text) from public;
grant execute on function public.oeffentliche_termine_alle(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Personalisierte Terminliste: vier neue Spalten am Ende.
-- ------------------------------------------------------------
drop function if exists public.termine_fuer_schiri_v2(uuid, text, text);

create function public.termine_fuer_schiri_v2(p_schiedsrichter_id uuid, p_pin text, p_seitenschluessel text)
returns table(id uuid, titel text, datum date, beschreibung text, beginn_zeit time,
  ende_zeit time, ort text, art text, pflicht boolean, rueckmeldung_bis date,
  rueckmeldung_erforderlich boolean, vergangen boolean, mein_status text, mein_grund text,
  mein_kommentar text, zusagen integer, absagen integer, eigener_verein boolean,
  termin_verein_id uuid, termin_verein_name text,
  laeuft boolean, rueckmeldefrist_abgelaufen boolean,
  zusage_moeglich boolean, absage_moeglich boolean)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  return query
  select t.id, t.titel, t.datum, t.beschreibung,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.rueckmeldung_erforderlich,
         public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) <= now() as vergangen,
         r.status, r.grund, r.kommentar,
         (select count(*)::integer
            from termin_rueckmeldungen x
            join schiedsrichter xs on xs.id = x.schiedsrichter_id
           where x.termin_id = t.id and x.status = 'zu'
             and xs.verein_id = v_verein),
         (select count(*)::integer
            from termin_rueckmeldungen x
            join schiedsrichter xs on xs.id = x.schiedsrichter_id
           where x.termin_id = t.id and x.status = 'ab'
             and xs.verein_id = v_verein),
         t.verein_id = v_verein,
         t.verein_id,
         tv.name,
         coalesce(public.termin_beginn_zeitpunkt(t.datum, t.beginn_zeit) <= now(), false)
           and public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) > now(),
         t.rueckmeldung_bis is not null and t.rueckmeldung_bis < v_heute,
         t.rueckmeldung_erforderlich
           and now() < public.termin_rueckmeldeschluss(t.datum, t.beginn_zeit)
           and (t.rueckmeldung_bis is null or t.rueckmeldung_bis >= v_heute or r.status = 'zu'),
         t.rueckmeldung_erforderlich
           and now() < public.termin_rueckmeldeschluss(t.datum, t.beginn_zeit)
  from termine t
  join vereine tv on tv.id = t.verein_id
  left join termin_rueckmeldungen r
    on r.termin_id = t.id and r.schiedsrichter_id = p_schiedsrichter_id
  where (
      t.verein_id = v_verein
      and t.sichtbarkeit in ('nur_verein', 'oeffentlich')
    ) or (
      tv.oeffentliche_kennung = p_seitenschluessel
      and t.sichtbarkeit = 'oeffentlich'
    )
  order by t.datum desc, t.beginn_zeit desc nulls last
  limit 120;
end;
$function$;

revoke all on function public.termine_fuer_schiri_v2(uuid, text, text) from public;
grant execute on function public.termine_fuer_schiri_v2(uuid, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Schreibweg des Schiedsrichters: Fristen durchsetzen.
-- ------------------------------------------------------------
create or replace function public.termin_rueckmeldung_setzen(p_schiedsrichter_id uuid, p_pin text,
  p_termin_id uuid, p_status text, p_grund text default null::text, p_kommentar text default null::text)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_datum date;
  v_beginn time;
  v_bis date;
  v_bisher text;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  select t.datum, t.beginn_zeit, t.rueckmeldung_bis into v_datum, v_beginn, v_bis
  from termine t
  where t.id = p_termin_id
    and (
      (t.sichtbarkeit = 'nur_verein' and t.verein_id = v_verein)
      or t.sichtbarkeit = 'oeffentlich'
    )
    and t.rueckmeldung_erforderlich;

  if v_datum is null then
    raise exception 'Termin nicht gefunden oder keine Rueckmeldung vorgesehen';
  end if;
  if p_status not in ('zu', 'ab') then
    raise exception 'Ungueltiger Status: %', p_status;
  end if;
  if now() >= public.termin_rueckmeldeschluss(v_datum, v_beginn) then
    raise exception 'Der Termin hat bereits begonnen. Eine Rückmeldung ist nicht mehr möglich.';
  end if;

  select r.status into v_bisher
  from termin_rueckmeldungen r
  where r.termin_id = p_termin_id and r.schiedsrichter_id = p_schiedsrichter_id;

  if p_status = 'zu'
     and v_bis is not null
     and v_bis < (now() at time zone 'Europe/Berlin')::date
     and v_bisher is distinct from 'zu' then
    raise exception 'Die Rückmeldefrist ist abgelaufen. Absagen geht weiterhin; für eine Zusage sprich bitte direkt den Obmann an.';
  end if;
  if p_status = 'ab' and p_grund is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  insert into termin_rueckmeldungen as r
    (termin_id, schiedsrichter_id, status, grund, kommentar, gemeldet_am)
  values (
    p_termin_id, p_schiedsrichter_id, p_status,
    case when p_status = 'ab' then p_grund else null end,
    case when p_status = 'ab' then nullif(trim(coalesce(p_kommentar, '')), '') else null end,
    now()
  )
  on conflict (termin_id, schiedsrichter_id) do update set
    status = excluded.status,
    grund = excluded.grund,
    kommentar = excluded.kommentar,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

revoke all on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) from public;
grant execute on function public.termin_rueckmeldung_setzen(uuid, text, uuid, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Obmann-Sicht fuer die App: vier neue Spalten am Ende.
-- ------------------------------------------------------------
drop function if exists public.obmann_termine_mit_stand(text);

create function public.obmann_termine_mit_stand(p_passwort text)
returns table(id uuid, titel text, datum date, beschreibung text, oeffentlich boolean,
  sichtbarkeit text, beginn_zeit time, ende_zeit time, ort text, art text, pflicht boolean,
  rueckmeldung_bis date, veranstalter text, rueckmeldung_erforderlich boolean,
  notiz_obmann text, zusagen integer, absagen integer, offen integer,
  vorbei boolean, laeuft boolean, rueckmeldefrist_abgelaufen boolean, hat_protokoll boolean)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_aktive integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  select count(*)::integer into v_aktive
  from schiedsrichter s
  where s.verein_id = v_verein and s.aktiv and not s.ist_test;

  return query
  select t.id, t.titel, t.datum, t.beschreibung, t.oeffentlich,
         t.sichtbarkeit,
         t.beginn_zeit, t.ende_zeit, t.ort, t.art, t.pflicht,
         t.rueckmeldung_bis, t.veranstalter,
         t.rueckmeldung_erforderlich, t.notiz_obmann,
         case when t.rueckmeldung_erforderlich then coalesce(z.zu, 0) else 0 end,
         case when t.rueckmeldung_erforderlich then coalesce(z.ab, 0) else 0 end,
         case when t.rueckmeldung_erforderlich
              then greatest(v_aktive - coalesce(z.zu, 0) - coalesce(z.ab, 0), 0)
              else 0 end,
         public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) <= now(),
         coalesce(public.termin_beginn_zeitpunkt(t.datum, t.beginn_zeit) <= now(), false)
           and public.termin_ende_zeitpunkt(t.datum, t.beginn_zeit, t.ende_zeit) > now(),
         t.rueckmeldung_bis is not null
           and t.rueckmeldung_bis < (now() at time zone 'Europe/Berlin')::date,
         nullif(btrim(coalesce(t.protokoll_inhalt, '')), '') is not null
  from termine t
  left join (
    select r.termin_id, s.verein_id,
           count(*) filter (where r.status = 'zu')::integer as zu,
           count(*) filter (where r.status = 'ab')::integer as ab
    from termin_rueckmeldungen r
    join schiedsrichter s on s.id = r.schiedsrichter_id
    group by r.termin_id, s.verein_id
  ) z on z.termin_id = t.id and z.verein_id = v_verein
  where t.verein_id = v_verein
  order by t.datum asc, t.beginn_zeit asc nulls last;
end;
$function$;

revoke all on function public.obmann_termine_mit_stand(text) from public;
grant execute on function public.obmann_termine_mit_stand(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Terminabstimmung: nach der Frist keine Stimmen mehr.
-- ------------------------------------------------------------
create or replace function public.terminfindung_stimme_setzen(p_schiedsrichter_id uuid, p_pin text,
  p_vorschlag_id uuid, p_antwort text)
returns void
language plpgsql
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_status text;
  v_bis date;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  if p_antwort not in ('ja', 'vielleicht', 'nein') then
    raise exception 'Ungueltige Antwort: %', p_antwort;
  end if;

  select f.status, f.antwort_bis into v_status, v_bis
  from terminfindung_vorschlaege v
  join terminfindungen f on f.id = v.findung_id
  where v.id = p_vorschlag_id and f.verein_id = v_verein;

  if v_status is null then
    raise exception 'Vorschlag nicht gefunden';
  end if;
  if v_status <> 'offen' then
    raise exception 'Diese Terminsuche ist abgeschlossen';
  end if;
  if v_bis is not null and v_bis < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Die Abstimmungsfrist ist abgelaufen. Der Obmann legt den Termin jetzt fest.';
  end if;

  insert into terminfindung_stimmen (vorschlag_id, schiedsrichter_id, antwort, gemeldet_am)
  values (p_vorschlag_id, p_schiedsrichter_id, p_antwort, now())
  on conflict (vorschlag_id, schiedsrichter_id) do update set
    antwort = excluded.antwort,
    gemeldet_am = excluded.gemeldet_am;
end;
$function$;

revoke all on function public.terminfindung_stimme_setzen(uuid, text, uuid, text) from public;
grant execute on function public.terminfindung_stimme_setzen(uuid, text, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Beide Abstimmungslisten melden, ob die Frist abgelaufen ist.
-- ------------------------------------------------------------
drop function if exists public.terminfindungen_fuer_schiri(uuid, text);

create function public.terminfindungen_fuer_schiri(p_schiedsrichter_id uuid, p_pin text)
returns table(id uuid, titel text, beschreibung text, antwort_bis date, status text,
  gewaehlter_vorschlag uuid, erstellt_am timestamptz, vorschlaege jsonb, frist_abgelaufen boolean)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
begin
  begin
    v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  exception when raise_exception then
    raise exception 'PIN ungueltig';
  end;

  return query
  select f.id, f.titel, f.beschreibung, f.antwort_bis, f.status,
         f.gewaehlter_vorschlag, f.erstellt_am,
         coalesce((
           select jsonb_agg(x order by x->>'position', x->>'datum')
           from (
             select jsonb_build_object(
               'id', v.id,
               'datum', v.datum,
               'beginn_zeit', v.beginn_zeit,
               'ort', v.ort,
               'position', v.position,
               'meine_antwort', (
                 select st.antwort from terminfindung_stimmen st
                 where st.vorschlag_id = v.id and st.schiedsrichter_id = p_schiedsrichter_id
               ),
               'ja', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'ja'),
               'vielleicht', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'vielleicht'),
               'nein', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'nein')
             ) as x
             from terminfindung_vorschlaege v
             where v.findung_id = f.id
           ) t
         ), '[]'::jsonb),
         f.antwort_bis is not null
           and f.antwort_bis < (now() at time zone 'Europe/Berlin')::date
  from terminfindungen f
  where f.verein_id = v_verein and f.status <> 'abgebrochen'
  order by case f.status when 'offen' then 0 else 1 end, f.erstellt_am desc
  limit 40;
end;
$function$;

revoke all on function public.terminfindungen_fuer_schiri(uuid, text) from public;
grant execute on function public.terminfindungen_fuer_schiri(uuid, text) to anon, authenticated;

drop function if exists public.obmann_terminfindungen(text);

create function public.obmann_terminfindungen(p_passwort text)
returns table(id uuid, titel text, beschreibung text, antwort_bis date, status text,
  gewaehlter_vorschlag uuid, erstellter_termin uuid, erstellt_am timestamptz,
  offen integer, vorschlaege jsonb, frist_abgelaufen boolean)
language plpgsql
stable
security definer
set search_path to public
as $function$
declare
  v_verein uuid;
  v_aktive integer;
begin
  v_verein := obmann_verein(p_passwort);

  select count(*)::integer into v_aktive
  from schiedsrichter s
  where s.verein_id = v_verein and s.aktiv and not s.ist_test;

  return query
  select f.id, f.titel, f.beschreibung, f.antwort_bis, f.status,
         f.gewaehlter_vorschlag, f.erstellter_termin, f.erstellt_am,
         greatest(v_aktive - (
           select count(distinct st.schiedsrichter_id)
           from terminfindung_stimmen st
           join terminfindung_vorschlaege v on v.id = st.vorschlag_id
           where v.findung_id = f.id
         ), 0)::integer,
         coalesce((
           select jsonb_agg(x order by x->>'position', x->>'datum')
           from (
             select jsonb_build_object(
               'id', v.id, 'datum', v.datum, 'beginn_zeit', v.beginn_zeit,
               'ort', v.ort, 'position', v.position,
               'ja', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'ja'),
               'vielleicht', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'vielleicht'),
               'nein', (select count(*) from terminfindung_stimmen st
                      where st.vorschlag_id = v.id and st.antwort = 'nein'),
               'namen_ja', coalesce((
                 select jsonb_agg(s.name order by s.name)
                 from terminfindung_stimmen st
                 join schiedsrichter s on s.id = st.schiedsrichter_id
                 where st.vorschlag_id = v.id and st.antwort = 'ja'), '[]'::jsonb)
             ) as x
             from terminfindung_vorschlaege v
             where v.findung_id = f.id
           ) t
         ), '[]'::jsonb),
         f.antwort_bis is not null
           and f.antwort_bis < (now() at time zone 'Europe/Berlin')::date
  from terminfindungen f
  where f.verein_id = v_verein
  order by case f.status when 'offen' then 0 else 1 end, f.erstellt_am desc;
end;
$function$;

revoke all on function public.obmann_terminfindungen(text) from public;
grant execute on function public.obmann_terminfindungen(text) to anon, authenticated;
