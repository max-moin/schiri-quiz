-- v126: Fragenvorschlaege tauchen im Eingang auf.
--
-- Codex hat am 06.09. die Fragenvorschlaege gebaut (v123-v125): Schiedsrichter
-- reichen Entwuerfe ein, der Obmann prueft sie in einem eigenen Menue. Zwei
-- ausdrueckliche Wuensche von Max fehlten dabei noch:
--   1. "wenn ein fragenvorschlag eingeht, der auch gern bei eingang mit
--      angezeigt werden [kann] ... aber trotzdem wie bei allen eingaengen
--      das auch als gelesen und vermerkt werden kann"
--   2. Einstieg ueber das Dashboard statt nur ueber den Eingang
--      (reiner Swift-Teil, dafuer braucht es keine Migration)
--
-- Diese Migration erledigt Punkt 1. Bewusst OHNE zweiten Status-Satz: Ein
-- Vorschlag hat bereits einen fachlichen Lebenslauf (entwurf -> eingereicht
-- -> in_pruefung -> aenderung_erbeten -> angenommen/abgelehnt). Ein davon
-- unabhaengiges "gelesen"-Flag waere ein zweiter Wahrheitsort fuer denselben
-- Sachverhalt und wuerde frueher oder spaeter auseinanderlaufen. Stattdessen
-- wird der vorhandene Status auf die Sprache des Eingangs abgebildet:
--   eingereicht       -> offen
--   in_pruefung       -> in_arbeit
--   aenderung_erbeten -> aenderung_erbeten (neuer Wert, die App kennt ihn)
--   angenommen        -> erledigt
--   abgelehnt         -> abgelehnt
--   entwurf           -> taucht gar nicht auf (privater Entwurf des Schiris)
--
-- Der Zaehler an der Reiterleiste zaehlt nur, was WIRKLICH bei Max liegt:
-- eingereicht und in_pruefung. "aenderung_erbeten" wartet auf den
-- Schiedsrichter und wird deshalb nicht mitgezaehlt - eine Zahl, die nie auf
-- null geht, lernt man zu ignorieren (dieselbe Ueberlegung wie bei der
-- Quiz-Aktivitaet in v111).
--
-- Aus dem Eingang heraus laesst sich ein Vorschlag nur anfassen ("in Arbeit"
-- und wieder zurueck auf "offen"), aber nicht entscheiden: Angenommen,
-- Abgelehnt und Aenderung-erbeten brauchen eine Rueckmeldung an den
-- Schiedsrichter und gehoeren deshalb ins Vorschlaege-Menue
-- (obmann_fragenvorschlag_status_setzen). Ein stilles "erledigt" aus dem
-- Eingang wuerde den Einreicher dauerhaft im Ungewissen lassen.
--
-- Technik: Die drei betroffenen Funktionen sind lang und stammen aus
-- mehreren Vorgaengermigrationen. Statt sie hier vollstaendig neu zu tippen
-- (und dabei womoeglich eine Zeile zu verlieren) wird ihre aktuelle
-- Definition gelesen, an genau benannten Ankern ergaenzt und neu ausgefuehrt
-- - dasselbe Vorgehen wie in v114. Jeder Anker wird vorher geprueft: fehlt
-- er, bricht die Migration ab, statt still nichts zu tun.

do $mig$
declare
  v_def text;
  v_anker text;
  v_cte text;
begin
  ------------------------------------------------------------------
  -- 1) obmann_eingang: neue Art in der Whitelist, neue Quelle im Strom
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'obmann_eingang';
  if v_def is null then
    raise exception 'obmann_eingang nicht gefunden';
  end if;

  v_anker := $q$'anfrage','absage','frage_meldung','meldung','quiz') then$q$;
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker fuer die Art-Whitelist in obmann_eingang nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    $q$'anfrage','absage','frage_meldung','meldung','quiz','fragenvorschlag') then$q$);

  v_cte := $q$  vorschlaege as (
    select
      'fragenvorschlag'::text                  as e_art,
      fv.id                                    as e_id,
      'Fragenvorschlag: '
        || left(coalesce(fv.inhalt->>'frage_text', ''), 60) as e_titel,
      left(fv.begruendung, 200)                as e_vorschau,
      coalesce(s.name, 'Unbekannt')            as e_person,
      coalesce(fv.eingereicht_am, fv.aktualisiert_am) as e_zeit,
      true                                     as e_erledigbar,
      case fv.status
        when 'eingereicht'       then 'offen'
        when 'in_pruefung'       then 'in_arbeit'
        when 'aenderung_erbeten' then 'aenderung_erbeten'
        when 'angenommen'        then 'erledigt'
        when 'abgelehnt'         then 'abgelehnt'
      end                                      as e_status,
      fv.id                                    as e_verweis,
      null::text                               as e_unterart,
      null::boolean                            as e_in_arbeit,
      null::integer                            as e_offen,
      null::integer                            as e_gesamt
    from fragenvorschlaege fv
    join schiedsrichter s on s.id = fv.schiedsrichter_id
    where fv.verein_id = v_verein
      and fv.status <> 'entwurf'
      and (v_nur_offen = false or fv.status in ('eingereicht','in_pruefung'))
  ),
$q$;

  v_anker := '  runde_soll as (';
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker "runde_soll as (" in obmann_eingang nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker, v_cte || v_anker);

  v_anker := '    union all select * from quiz';
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker fuer den Strom in obmann_eingang nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    v_anker || chr(10) || '    union all select * from vorschlaege');

  execute v_def;

  ------------------------------------------------------------------
  -- 2) obmann_eingang_zaehler: offene Vorschlaege zaehlen mit
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'obmann_eingang_zaehler';
  if v_def is null then
    raise exception 'obmann_eingang_zaehler nicht gefunden';
  end if;

  v_anker := '  -- Die Quiz-Aktivitaet wird mitgeliefert';
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker vor dem Quiz-Block im Zaehler nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    $q$  union all
  select 'fragenvorschlag'::text, (
    select count(*)::integer
    from fragenvorschlaege fv
    where fv.verein_id = v_verein
      and fv.status in ('eingereicht','in_pruefung')
  ), true

$q$ || v_anker);

  execute v_def;

  ------------------------------------------------------------------
  -- 3) obmann_meldung_status_setzen: anfassen ja, entscheiden nein
  ------------------------------------------------------------------
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'obmann_meldung_status_setzen';
  if v_def is null then
    raise exception 'obmann_meldung_status_setzen nicht gefunden';
  end if;

  v_anker := $q$  else
    raise exception 'Art % kann nicht erledigt werden'$q$;
  if position(v_anker in v_def) = 0 then
    raise exception 'Anker fuer den Sonst-Zweig im Statussetzer nicht gefunden';
  end if;
  v_def := replace(v_def, v_anker,
    $q$  elsif p_art = 'fragenvorschlag' then
    -- Nur anfassen, nicht entscheiden: siehe Kopfkommentar der Migration.
    if p_status not in ('offen','in_arbeit') then
      raise exception 'Ein Fragenvorschlag wird im Vorschlaege-Menue entschieden, nicht im Eingang';
    end if;
    update fragenvorschlaege fv
       set status = case when p_status = 'in_arbeit' then 'in_pruefung' else 'eingereicht' end,
           aktualisiert_am = now()
     where fv.id = p_id
       and fv.verein_id = v_verein
       and fv.status in ('eingereicht','in_pruefung');
    get diagnostics v_treffer = row_count;

$q$ || v_anker);

  execute v_def;
end
$mig$;

-- Gegenprobe: Die drei Funktionen muessen die neue Art jetzt wirklich kennen.
do $pruef$
declare
  v_fehlt text := '';
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'obmann_eingang'
       and p.prosrc like '%from fragenvorschlaege fv%'
  ) then v_fehlt := v_fehlt || ' obmann_eingang'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'obmann_eingang_zaehler'
       and p.prosrc like '%fragenvorschlag%'
  ) then v_fehlt := v_fehlt || ' obmann_eingang_zaehler'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'obmann_meldung_status_setzen'
       and p.prosrc like '%fragenvorschlag%'
  ) then v_fehlt := v_fehlt || ' obmann_meldung_status_setzen'; end if;

  if v_fehlt <> '' then
    raise exception 'Migration v126 unvollstaendig, betroffen:%', v_fehlt;
  end if;
end
$pruef$;
