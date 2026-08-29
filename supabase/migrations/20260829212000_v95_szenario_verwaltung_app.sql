-- v95_szenario_verwaltung_app (29.08.2026)
--
-- Die Verwaltung der Szenarien. Max hat sie ausdruecklich in der
-- Swift-App verortet und nicht im Obmann-Zugang der Website: "dann habe
-- ich zwei Sachen unterschiedlich ... dieses woechentliche Quiz verwalte
-- ich ja eh ueber das Dashboard."
--
-- Deshalb dieselbe Bauart wie obmann_frage_*: Passwort als erster
-- Parameter, SECURITY DEFINER, Pruefung gegen obmann_zugang.
--
-- ============================================================
--  Die Freigabesperre ist hier eingebaut, nicht in der App
-- ============================================================
--
-- Max: "Das mit den KI-Bildern sehe ich genauso. Das muss vor der
-- Fragenveroeffentlichung noch mal geprueft werden."
--
-- obmann_szenario_bild_setzen loescht bei jedem neuen Bild die Freigabe
-- UND schaltet das Szenario ab. Wer ein Bild austauscht, muss also
-- erneut hinsehen. Das ist der Punkt, an dem KI-Bilder kippen: sie sind
-- unzuverlaessig genau bei den Details, an denen eine
-- Schiedsrichterfrage haengt (Hand am Ball oder Ball an der Hand), und
-- ein zweiter Durchlauf sieht auf den ersten Blick genauso gut aus.

-- ============================================================
--  1. Liste (ohne Bilddaten - sonst waere die Antwort megabyteschwer)
-- ============================================================

drop function if exists public.obmann_szenarien_liste(text);

create function public.obmann_szenarien_liste(p_passwort text)
returns table (
  id uuid, titel text, beschreibung text,
  hat_bild boolean, bild_quelle text, bild_geprueft_am timestamptz,
  aktiv boolean, regel_nummer smallint, schwierigkeit smallint,
  spielfortsetzung text, fortsetzung_fuer text,
  persoenliche_strafe text, strafe_fuer_mannschaft text,
  anzahl_zusatzfragen integer, gespielt integer, quote numeric,
  status text, erstellt_am timestamptz
)
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  return query
  select s.id, s.titel, s.beschreibung,
         s.bild_base64 is not null, s.bild_quelle, s.bild_geprueft_am,
         s.aktiv, s.regel_nummer, s.schwierigkeit,
         l.spielfortsetzung, l.fortsetzung_fuer,
         l.persoenliche_strafe, l.strafe_fuer_mannschaft,
         (select count(*)::int from szenario_zusatzfragen z where z.szenario_id = s.id),
         (select count(*)::int from szenario_antworten a where a.szenario_id = s.id),
         (select case when count(*) = 0 then 0::numeric
                 else round(100.0 * count(*) filter (where a.bewertung = 'komplett')
                                  / count(*), 0) end
            from szenario_antworten a where a.szenario_id = s.id),
         -- Ein Wort statt drei Flags: die App soll den naechsten
         -- noetigen Schritt anzeigen koennen, ohne ihn selbst
         -- herzuleiten.
         case
           when l.szenario_id is null            then 'ohne_loesung'
           when s.bild_base64 is null            then 'ohne_bild'
           when s.bild_geprueft_am is null       then 'ungeprueft'
           when not s.aktiv                      then 'bereit'
           else                                       'aktiv'
         end,
         s.erstellt_am
  from entscheidungs_szenarien s
  left join szenario_loesungen l on l.szenario_id = s.id
  order by s.aktiv, s.erstellt_am desc;
end;
$function$;

-- ============================================================
--  2. Einzelansicht (mit Bild und Loesung)
-- ============================================================

drop function if exists public.obmann_szenario_details(text, uuid);

create function public.obmann_szenario_details(p_passwort text, p_szenario_id uuid)
returns table (
  id uuid, titel text, beschreibung text,
  bild_base64 text, bild_mime text, bild_quelle text, bild_modell text,
  bild_erzeugt_am timestamptz, bild_geprueft_am timestamptz, bild_geprueft_von text,
  trikot_heim text, trikot_gast text,
  regel_nummer smallint, schwierigkeit smallint, aktiv boolean,
  spielfortsetzung text, fortsetzung_fuer text,
  persoenliche_strafe text, strafe_fuer_mannschaft text,
  strafe_fuer_rolle text, strafe_rueckennummer smallint,
  erklaerung text, zusatzfragen jsonb
)
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  return query
  select s.id, s.titel, s.beschreibung,
         s.bild_base64, s.bild_mime, s.bild_quelle, s.bild_modell,
         s.bild_erzeugt_am, s.bild_geprueft_am, s.bild_geprueft_von,
         s.trikot_heim, s.trikot_gast,
         s.regel_nummer, s.schwierigkeit, s.aktiv,
         l.spielfortsetzung, l.fortsetzung_fuer,
         l.persoenliche_strafe, l.strafe_fuer_mannschaft,
         l.strafe_fuer_rolle, l.strafe_rueckennummer,
         l.erklaerung,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', z.id, 'position', z.position,
                    'frage_text', z.frage_text, 'optionen', z.optionen,
                    -- hier darf die richtige Antwort mit: das ist die
                    -- Verwaltung, nicht die Spielerseite
                    'richtig', l.zusatz_antworten ->> z.id::text)
                  order by z.position)
           from szenario_zusatzfragen z where z.szenario_id = s.id
         ), '[]'::jsonb)
  from entscheidungs_szenarien s
  left join szenario_loesungen l on l.szenario_id = s.id
  where s.id = p_szenario_id;
end;
$function$;

-- ============================================================
--  3. Anlegen und Bearbeiten - Szene und Loesung in einem Aufruf
-- ============================================================
--
-- Absichtlich EIN Aufruf fuer beide Tabellen. Getrennt koennte ein
-- Szenario ohne Loesung entstehen, und das faellt erst auf, wenn ein
-- Schiedsrichter davorsteht.

drop function if exists public.obmann_szenario_speichern(text, text, text, text, text, text, uuid, text, text, text, smallint, text, text, smallint, smallint);

create function public.obmann_szenario_speichern(
  p_passwort text,
  p_titel text,
  p_beschreibung text,
  p_spielfortsetzung text,
  p_persoenliche_strafe text,
  p_erklaerung text,
  p_szenario_id uuid default null,
  p_fortsetzung_fuer text default null,
  p_strafe_fuer_mannschaft text default null,
  p_strafe_fuer_rolle text default null,
  p_strafe_rueckennummer smallint default null,
  p_trikot_heim text default null,
  p_trikot_gast text default null,
  p_regel_nummer smallint default null,
  p_schwierigkeit smallint default null
)
returns uuid
language plpgsql security definer set search_path to public
as $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  if p_szenario_id is null then
    insert into entscheidungs_szenarien (
      titel, beschreibung, trikot_heim, trikot_gast, regel_nummer, schwierigkeit)
    values (
      p_titel, p_beschreibung,
      coalesce(p_trikot_heim, '#e4032e'), coalesce(p_trikot_gast, '#1d4ed8'),
      p_regel_nummer, p_schwierigkeit)
    returning id into v_id;
  else
    -- coalesce, damit eine aeltere App-Fassung ein Feld nicht still
    -- zuruecksetzt, das sie gar nicht kennt (die Lektion aus v51b).
    update entscheidungs_szenarien s set
      titel         = coalesce(p_titel, s.titel),
      beschreibung  = coalesce(p_beschreibung, s.beschreibung),
      trikot_heim   = coalesce(p_trikot_heim, s.trikot_heim),
      trikot_gast   = coalesce(p_trikot_gast, s.trikot_gast),
      regel_nummer  = coalesce(p_regel_nummer, s.regel_nummer),
      schwierigkeit = coalesce(p_schwierigkeit, s.schwierigkeit),
      geaendert_am  = now()
    where s.id = p_szenario_id
    returning s.id into v_id;
    if v_id is null then
      raise exception 'Szenario nicht gefunden';
    end if;
  end if;

  insert into szenario_loesungen (
    szenario_id, spielfortsetzung, fortsetzung_fuer,
    persoenliche_strafe, strafe_fuer_mannschaft, strafe_fuer_rolle,
    strafe_rueckennummer, erklaerung)
  values (
    v_id, p_spielfortsetzung, p_fortsetzung_fuer,
    p_persoenliche_strafe, p_strafe_fuer_mannschaft, p_strafe_fuer_rolle,
    p_strafe_rueckennummer, p_erklaerung)
  on conflict (szenario_id) do update set
    spielfortsetzung       = excluded.spielfortsetzung,
    fortsetzung_fuer       = excluded.fortsetzung_fuer,
    persoenliche_strafe    = excluded.persoenliche_strafe,
    strafe_fuer_mannschaft = excluded.strafe_fuer_mannschaft,
    strafe_fuer_rolle      = excluded.strafe_fuer_rolle,
    strafe_rueckennummer   = excluded.strafe_rueckennummer,
    erklaerung             = excluded.erklaerung,
    geaendert_am           = now();

  return v_id;
end;
$function$;

-- ============================================================
--  4. Bild setzen - und damit die Freigabe zuruecksetzen
-- ============================================================

drop function if exists public.obmann_szenario_bild_setzen(text, uuid, text, text, text, text);

create function public.obmann_szenario_bild_setzen(
  p_passwort text,
  p_szenario_id uuid,
  p_bild_base64 text,
  p_mime text,
  p_quelle text,
  p_modell text default null
)
returns void
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  if p_bild_base64 is null then
    -- Bild entfernen: dann faellt zwangslaeufig auch die Freigabe weg,
    -- sonst verletzte die naechste Zeile den CHECK.
    update entscheidungs_szenarien set
      bild_base64 = null, bild_mime = null, bild_quelle = null,
      bild_modell = null, bild_erzeugt_am = null,
      bild_geprueft_am = null, bild_geprueft_von = null,
      aktiv = false, geaendert_am = now()
    where id = p_szenario_id;
  else
    update entscheidungs_szenarien set
      bild_base64 = p_bild_base64, bild_mime = p_mime, bild_quelle = p_quelle,
      bild_modell = p_modell, bild_erzeugt_am = now(),
      -- Neues Bild, neue Pruefung. Und abgeschaltet, bis sie erfolgt
      -- ist - sonst waere die Sperre ein Hinweis statt einer Sperre.
      bild_geprueft_am = null, bild_geprueft_von = null,
      aktiv = false, geaendert_am = now()
    where id = p_szenario_id;
  end if;

  if not found then
    raise exception 'Szenario nicht gefunden';
  end if;
end;
$function$;

-- ============================================================
--  5. Freigeben und aktiv schalten - zwei getrennte Schritte
-- ============================================================
--
-- Getrennt, weil es zwei verschiedene Aussagen sind: "Ich habe das Bild
-- angesehen und es zeigt, was es zeigen soll" und "Das Szenario ist im
-- Umlauf". Ein einziger Knopf wuerde die erste stillschweigend
-- mitunterschreiben.

drop function if exists public.obmann_szenario_freigeben(text, uuid, text);

create function public.obmann_szenario_freigeben(
  p_passwort text, p_szenario_id uuid, p_geprueft_von text default 'Obmann')
returns void
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  update entscheidungs_szenarien set
    bild_geprueft_am = now(), bild_geprueft_von = p_geprueft_von, geaendert_am = now()
  where id = p_szenario_id and bild_base64 is not null;

  if not found then
    raise exception 'Szenario nicht gefunden oder ohne Bild';
  end if;
end;
$function$;

drop function if exists public.obmann_szenario_aktiv_setzen(text, uuid, boolean);

create function public.obmann_szenario_aktiv_setzen(
  p_passwort text, p_szenario_id uuid, p_aktiv boolean)
returns void
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  if p_aktiv and not exists (
    select 1 from szenario_loesungen where szenario_id = p_szenario_id) then
    raise exception 'Szenario hat noch keine Loesung';
  end if;

  update entscheidungs_szenarien set aktiv = p_aktiv, geaendert_am = now()
  where id = p_szenario_id;

  if not found then
    raise exception 'Szenario nicht gefunden';
  end if;
end;
$function$;

drop function if exists public.obmann_szenario_loeschen(text, uuid);

create function public.obmann_szenario_loeschen(p_passwort text, p_szenario_id uuid)
returns void
language plpgsql security definer set search_path to public
as $function$
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;
  delete from entscheidungs_szenarien where id = p_szenario_id;
end;
$function$;

-- ============================================================
--  6. Zusatzfragen
-- ============================================================
--
-- Die richtige Antwort wandert in szenario_loesungen.zusatz_antworten -
-- die Regel aus v93: es gibt genau eine Tabelle mit richtigen Antworten.

drop function if exists public.obmann_szenario_zusatzfrage_speichern(text, uuid, text, jsonb, text, uuid, smallint);

create function public.obmann_szenario_zusatzfrage_speichern(
  p_passwort text,
  p_szenario_id uuid,
  p_frage_text text,
  p_optionen jsonb,
  p_richtiger_schluessel text,
  p_zusatzfrage_id uuid default null,
  p_position smallint default null
)
returns uuid
language plpgsql security definer set search_path to public
as $function$
declare
  v_id uuid;
  v_pos smallint;
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  -- Der richtige Schluessel muss in den Optionen vorkommen. Ohne diese
  -- Pruefung waere eine Zusatzfrage moeglich, die niemand richtig
  -- beantworten kann - und das faellt erst dem Schiedsrichter auf.
  if not exists (
    select 1 from jsonb_array_elements(p_optionen) o
    where o ->> 'schluessel' = p_richtiger_schluessel) then
    raise exception 'Der richtige Schluessel steht nicht in den Optionen';
  end if;

  if not exists (select 1 from szenario_loesungen where szenario_id = p_szenario_id) then
    raise exception 'Erst die Loesung des Szenarios speichern';
  end if;

  if p_zusatzfrage_id is null then
    select coalesce(max(z.position), 0)::smallint + 1 into v_pos
    from szenario_zusatzfragen z where z.szenario_id = p_szenario_id;
    insert into szenario_zusatzfragen (szenario_id, position, frage_text, optionen)
    values (p_szenario_id, coalesce(p_position, v_pos), p_frage_text, p_optionen)
    returning id into v_id;
  else
    update szenario_zusatzfragen z set
      frage_text = coalesce(p_frage_text, z.frage_text),
      optionen   = coalesce(p_optionen, z.optionen),
      position   = coalesce(p_position, z.position)
    where z.id = p_zusatzfrage_id and z.szenario_id = p_szenario_id
    returning z.id into v_id;
    if v_id is null then
      raise exception 'Zusatzfrage nicht gefunden';
    end if;
  end if;

  update szenario_loesungen set
    zusatz_antworten = zusatz_antworten || jsonb_build_object(v_id::text, p_richtiger_schluessel),
    geaendert_am = now()
  where szenario_id = p_szenario_id;

  return v_id;
end;
$function$;

drop function if exists public.obmann_szenario_zusatzfrage_loeschen(text, uuid);

create function public.obmann_szenario_zusatzfrage_loeschen(p_passwort text, p_zusatzfrage_id uuid)
returns void
language plpgsql security definer set search_path to public
as $function$
declare
  v_szenario uuid;
begin
  if not exists (select 1 from obmann_zugang where passwort = p_passwort) then
    raise exception 'Falsches Passwort';
  end if;

  select szenario_id into v_szenario from szenario_zusatzfragen where id = p_zusatzfrage_id;
  if v_szenario is null then
    raise exception 'Zusatzfrage nicht gefunden';
  end if;

  delete from szenario_zusatzfragen where id = p_zusatzfrage_id;

  -- Die verwaiste Antwort mitloeschen, sonst waechst zusatz_antworten
  -- still zu einem Friedhof aus Schluesseln, die zu nichts gehoeren.
  update szenario_loesungen set
    zusatz_antworten = zusatz_antworten - p_zusatzfrage_id::text,
    geaendert_am = now()
  where szenario_id = v_szenario;
end;
$function$;

-- ============================================================
--  7. Rechte
-- ============================================================

revoke all on function public.obmann_szenarien_liste(text) from public;
revoke all on function public.obmann_szenario_details(text, uuid) from public;
revoke all on function public.obmann_szenario_speichern(text, text, text, text, text, text, uuid, text, text, text, smallint, text, text, smallint, smallint) from public;
revoke all on function public.obmann_szenario_bild_setzen(text, uuid, text, text, text, text) from public;
revoke all on function public.obmann_szenario_freigeben(text, uuid, text) from public;
revoke all on function public.obmann_szenario_aktiv_setzen(text, uuid, boolean) from public;
revoke all on function public.obmann_szenario_loeschen(text, uuid) from public;
revoke all on function public.obmann_szenario_zusatzfrage_speichern(text, uuid, text, jsonb, text, uuid, smallint) from public;
revoke all on function public.obmann_szenario_zusatzfrage_loeschen(text, uuid) from public;

grant execute on function public.obmann_szenarien_liste(text) to anon, authenticated;
grant execute on function public.obmann_szenario_details(text, uuid) to anon, authenticated;
grant execute on function public.obmann_szenario_speichern(text, text, text, text, text, text, uuid, text, text, text, smallint, text, text, smallint, smallint) to anon, authenticated;
grant execute on function public.obmann_szenario_bild_setzen(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.obmann_szenario_freigeben(text, uuid, text) to anon, authenticated;
grant execute on function public.obmann_szenario_aktiv_setzen(text, uuid, boolean) to anon, authenticated;
grant execute on function public.obmann_szenario_loeschen(text, uuid) to anon, authenticated;
grant execute on function public.obmann_szenario_zusatzfrage_speichern(text, uuid, text, jsonb, text, uuid, smallint) to anon, authenticated;
grant execute on function public.obmann_szenario_zusatzfrage_loeschen(text, uuid) to anon, authenticated;
