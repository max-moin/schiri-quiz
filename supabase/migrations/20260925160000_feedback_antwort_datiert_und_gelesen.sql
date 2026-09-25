-- ============================================================
--  Antwort des Obmanns auf Fragenfeedback: datiert und mit Lesestand
--  (25.09.2026, Backlog P1 "Antwort des Obmanns auf Fragenfeedback")
-- ============================================================
--  WARUM
--  -----
--  Seit v129 gibt es je Hinweis ein Feld "rueckmeldung_obmann". Benutzt
--  wurde es nie (0 von 9 Hinweisen): In der App lag das Schreiben hinter
--  einem Menuepunkt in einem Alert mit einzeiligem Feld, und auf der
--  Website stand eine Antwort ohne Datum irgendwo im Verlauf. Wer eine
--  Rueckmeldung gibt, will aber zwei Dinge wissen: WANN kam die Antwort,
--  und - aus Obmann-Sicht - hat die Person sie GELESEN?
--
--  Deshalb zwei Spalten statt einer zweiten Nachrichtentabelle. Es bleibt
--  bei genau einer Antwort je Hinweis. Das ist bewusst kein Chat: Ein
--  Chat braeuchte Moderation, Loeschfristen je Nachricht und ein
--  Benachrichtigungsversprechen, das wir fuer Schiedsrichter noch nicht
--  halten koennen.
--
--  EIN SCHREIBWEG FUER DEN ZEITSTEMPEL
--  -----------------------------------
--  Der Zeitstempel wird von einem Trigger gesetzt, nicht von der RPC.
--  Egal wer "rueckmeldung_obmann" aendert (heute obmann_feedback_aktion,
--  morgen vielleicht ein Web-Editor): Sobald sich der Text aendert, gibt
--  es einen neuen Zeitpunkt und der Lesestand faellt auf "ungelesen"
--  zurueck. Eine geaenderte Antwort ist fuer den Empfaenger neu.
--
--  Nebenwirkungen, die bewusst mitkommen:
--  * Ein noch "offener" Hinweis wird beim Antworten "gelesen". Wer
--    antwortet, hat ihn gelesen - ein "Eingegangen" daneben waere falsch.
--  * Die Aufbewahrung der Rueckmeldung wird auf mindestens 14 Tage ab
--    heute verlaengert. Sonst koennte die taegliche Loeschroutine eine
--    Antwort entfernen, bevor die Person sie ueberhaupt sehen konnte.
--    Laenger als der eingestellte Rahmen plus 14 Tage bleibt nichts.
-- ============================================================

alter table public.frage_meldung_eintraege
  add column if not exists rueckmeldung_am timestamptz,
  add column if not exists rueckmeldung_gelesen_am timestamptz;

comment on column public.frage_meldung_eintraege.rueckmeldung_am is
  'Zeitpunkt der letzten Aenderung der sichtbaren Obmann-Antwort. Wird ausschliesslich vom Trigger feedback_antwort_stempeln gesetzt.';
comment on column public.frage_meldung_eintraege.rueckmeldung_gelesen_am is
  'Wann der Absender die aktuelle Antwort in Meine Anliegen gesehen hat. NULL = neu.';

create or replace function public.feedback_antwort_stempeln()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.rueckmeldung_obmann is not distinct from old.rueckmeldung_obmann then
    return new;
  end if;

  if new.rueckmeldung_obmann is null then
    new.rueckmeldung_am := null;
    new.rueckmeldung_gelesen_am := null;
    return new;
  end if;

  new.rueckmeldung_am := now();
  new.rueckmeldung_gelesen_am := null;
  if new.status = 'offen' then
    new.status := 'gelesen';
  end if;

  update public.frage_meldungen m
     set aufbewahren_bis = greatest(
           coalesce(m.aufbewahren_bis, (now() at time zone 'Europe/Berlin')::date),
           (now() at time zone 'Europe/Berlin')::date + 14)
   where m.id = new.meldung_id;

  return new;
end;
$function$;

revoke all on function public.feedback_antwort_stempeln() from public, anon, authenticated;

drop trigger if exists feedback_antwort_stempeln on public.frage_meldung_eintraege;
-- Name beginnt mit "feedback_a": Postgres feuert BEFORE-Trigger
-- alphabetisch, dieser laeuft also VOR feedback_status_kompatibel. Das
-- ist noetig, damit der dort abgeleitete "erledigt"-Wert den Status
-- sieht, den dieser Trigger gesetzt hat.
create trigger feedback_antwort_stempeln
  before update of rueckmeldung_obmann on public.frage_meldung_eintraege
  for each row execute function public.feedback_antwort_stempeln();

-- ------------------------------------------------------------
-- Obmann-Sicht: Antwortzeit und Lesestand mitliefern.
-- Signatur unveraendert (Rueckgabe bleibt jsonb), daher kein drop.
-- ------------------------------------------------------------
create or replace function public.obmann_frage_meldungen(p_passwort text, p_frage_id uuid default null::uuid)
returns table(meldung_id uuid, frage_id uuid, frage_nummer integer, frage_text text,
  schiedsrichter_id uuid, person text, status text, runde_id uuid, runde_bezeichnung text,
  gegebene_antwort text, loesung_snapshot jsonb, erstellt_am timestamptz, aktualisiert_am timestamptz,
  anzahl_eintraege integer, eintraege jsonb)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query select fm.id,fm.frage_id,nr.frage_nummer,f.frage_text,fm.schiedsrichter_id,
    coalesce(s.name,'Unbekannt'),fm.status,fm.runde_id,r.bezeichnung,fm.gegebene_antwort,
    fm.loesung_snapshot,fm.erstellt_am,fm.aktualisiert_am,
    (select count(*)::integer from public.frage_meldung_eintraege e where e.meldung_id=fm.id),
    coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kategorie',e.kategorie,'text',e.text,
      'status',e.status,'erledigt',e.erledigt,'erledigt_am',e.erledigt_am,
      'rueckmeldung_obmann',e.rueckmeldung_obmann,
      'rueckmeldung_am',e.rueckmeldung_am,
      'rueckmeldung_gelesen_am',e.rueckmeldung_gelesen_am,
      'erstellt_am',e.erstellt_am)
      order by e.erstellt_am,e.id) from public.frage_meldung_eintraege e where e.meldung_id=fm.id),'[]'::jsonb)
    from public.frage_meldungen fm join public.fragen f on f.id=fm.frage_id
    left join public.schiedsrichter s on s.id=fm.schiedsrichter_id
    left join public.runden r on r.id=fm.runde_id
    left join public.wochen_frage_nummern nr on nr.verein_id=fm.verein_id and nr.frage_id=fm.frage_id and nr.runde_id=fm.runde_id
    where fm.verein_id=v_verein and (p_frage_id is null or fm.frage_id=p_frage_id)
    order by (fm.status not in ('erledigt','abgelehnt')) desc,fm.aktualisiert_am desc;
end $function$;

revoke all on function public.obmann_frage_meldungen(text,uuid) from public;
grant execute on function public.obmann_frage_meldungen(text,uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Eigene Sicht: Antwortzeit und "neu". Das Lesedatum selbst geht nicht
-- hinaus - die Person braucht nur zu wissen, dass etwas neu ist.
-- ------------------------------------------------------------
create or replace function public.meine_frage_meldungen(p_schiedsrichter_id uuid, p_pin text)
returns table(meldung_id uuid, frage_id uuid, frage_nummer integer, frage_text text,
  runde_bezeichnung text, status text, anzahl_eintraege integer,
  erstellt_am timestamptz, aktualisiert_am timestamptz, eintraege jsonb)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  return query
  select fm.id, fm.frage_id, nr.frage_nummer, f.frage_text, r.bezeichnung,
         fm.status,
         (select count(*)::integer from public.frage_meldung_eintraege e where e.meldung_id = fm.id),
         fm.erstellt_am, fm.aktualisiert_am,
         coalesce((select jsonb_agg(jsonb_build_object(
           'id', e.id, 'kategorie', e.kategorie, 'text', e.text,
           'status', e.status, 'erledigt', e.erledigt,
           'rueckmeldung_obmann', e.rueckmeldung_obmann,
           'rueckmeldung_am', e.rueckmeldung_am,
           'rueckmeldung_neu', (e.rueckmeldung_obmann is not null and e.rueckmeldung_gelesen_am is null),
           'erstellt_am', e.erstellt_am) order by e.erstellt_am, e.id)
           from public.frage_meldung_eintraege e where e.meldung_id = fm.id), '[]'::jsonb)
    from public.frage_meldungen fm
    join public.fragen f on f.id = fm.frage_id
    left join public.runden r on r.id = fm.runde_id
    left join public.wochen_frage_nummern nr
      on nr.verein_id = fm.verein_id and nr.frage_id = fm.frage_id and nr.runde_id = fm.runde_id
   where fm.schiedsrichter_id = p_schiedsrichter_id
   order by fm.aktualisiert_am desc, fm.erstellt_am desc;
end;
$function$;

revoke all on function public.meine_frage_meldungen(uuid,text) from public;
grant execute on function public.meine_frage_meldungen(uuid,text) to anon, authenticated;

-- ------------------------------------------------------------
-- Zaehler fuer den blauen Neuigkeiten-Punkt im Kontomenue und
-- Quittung beim Oeffnen von "Meine Anliegen". Beides nur fuer die
-- eigene, per PIN gepruefte Person.
-- ------------------------------------------------------------
create or replace function public.meine_neuen_antworten(p_schiedsrichter_id uuid, p_pin text)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_anzahl integer;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select count(*)::integer into v_anzahl
    from public.frage_meldung_eintraege e
    join public.frage_meldungen fm on fm.id = e.meldung_id
   where fm.schiedsrichter_id = p_schiedsrichter_id
     and e.rueckmeldung_obmann is not null
     and e.rueckmeldung_gelesen_am is null;
  return v_anzahl;
end;
$function$;

revoke all on function public.meine_neuen_antworten(uuid,text) from public, anon, authenticated;
grant execute on function public.meine_neuen_antworten(uuid,text) to anon, authenticated;

create or replace function public.meine_antworten_gelesen(p_schiedsrichter_id uuid, p_pin text)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare v_anzahl integer;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  update public.frage_meldung_eintraege e
     set rueckmeldung_gelesen_am = now()
    from public.frage_meldungen fm
   where fm.id = e.meldung_id
     and fm.schiedsrichter_id = p_schiedsrichter_id
     and e.rueckmeldung_obmann is not null
     and e.rueckmeldung_gelesen_am is null;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$function$;

revoke all on function public.meine_antworten_gelesen(uuid,text) from public, anon, authenticated;
grant execute on function public.meine_antworten_gelesen(uuid,text) to anon, authenticated;
