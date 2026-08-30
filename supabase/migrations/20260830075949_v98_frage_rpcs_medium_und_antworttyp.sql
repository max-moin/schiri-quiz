-- v98_frage_rpcs_medium_und_antworttyp (30.08.2026)
--
-- Die App schickt beim Anlegen und Bearbeiten einer Frage bisher nur
-- p_typ. Seit v92 gibt es die beiden Achsen medium und antworttyp, aber
-- keine RPC, ueber die die App sie setzen koennte - der Trigger
-- fragen_typ_ableiten() hat sie deshalb bis heute immer aus typ
-- abgeleitet.
--
-- Diese Migration ergaenzt die beiden Schreib-RPCs um p_medium und
-- p_antworttyp und die Lese-RPC obmann_frage_details um die beiden
-- Spalten.
--
-- Warum die Lese-Seite mit muss: die Faltung ist nicht umkehrbar.
-- "bild + multiple_choice" und "text + mehrfachauswahl" landen beide
-- auf typ = 'multiple_choice'. Wer eine solche Frage im Bearbeiten-
-- Sheet oeffnet und wieder speichert, haette ohne die beiden Spalten
-- still das Medium verloren - der Editor kennt dann nur noch "typ".
--
-- Beide neuen Parameter haben DEFAULT NULL. Genau daran erkennt der
-- Trigger aus v92 den alten Aufrufer: kommt NULL an, leitet er
-- medium/antworttyp weiter aus typ ab. Eine aeltere App-Fassung laeuft
-- unveraendert weiter (die Lektion aus v85 / PGRST202).
--
-- Beim Bearbeiten wird coalesce(p_medium, medium) geschrieben: eine
-- alte App-Fassung ueberschreibt damit nicht die Achsen einer Frage,
-- die eine neuere Fassung schon zweiachsig gespeichert hat.
--
-- Signaturaenderung heisst drop + create, nicht create or replace -
-- sonst stuenden zwei Ueberladungen nebeneinander und PostgREST findet
-- keine eindeutige Funktion mehr.

-- ============================================================
--  1. obmann_frage_erstellen
-- ============================================================

drop function if exists public.obmann_frage_erstellen(
  text, text, text, text, text, text, smallint, smallint, text, text, text,
  text, text, text, text, integer, integer, text, boolean, text, boolean);

create function public.obmann_frage_erstellen(
    p_passwort text,
    p_frage_text text,
    p_option_a text default null,
    p_option_b text default null,
    p_option_c text default null,
    p_richtige_option text default null,
    p_regel_nummer smallint default null,
    p_schwierigkeit smallint default null,
    p_quelle_typ text default null,
    p_quelle_detail text default null,
    p_typ text default 'multiple_choice',
    p_musterantwort text default null,
    p_bewertungshinweise text default null,
    p_antwort_hinweis text default null,
    p_video_url text default null,
    p_video_start_sekunden integer default null,
    p_video_end_sekunden integer default null,
    p_video_antworttyp text default null,
    p_video_stumm boolean default false,
    p_erklaerung_zusatzhinweis text default null,
    p_nie_in_rotation boolean default false,
    p_medium text default null,
    p_antworttyp text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_sortierschluessel text;
    v_neue_id uuid;
    v_match text[];
begin
    perform obmann_verein(p_passwort);

    if p_quelle_typ = 'dfb_schiri_zeitung' then
        v_match := regexp_match(coalesce(p_quelle_detail, ''), '^(\d{2})/(\d{2})$');
        if v_match is not null then
            v_sortierschluessel := '20' || v_match[2] || v_match[1];
        else
            v_sortierschluessel := null;
        end if;
    elsif p_quelle_typ = 'hausregeltest' then
        v_sortierschluessel := p_quelle_detail;
    else
        v_sortierschluessel := null;
    end if;

    -- medium/antworttyp werden bewusst ungefiltert durchgereicht, auch
    -- als NULL: der BEFORE-Trigger fragen_typ_ableiten() erkennt genau
    -- daran den alten Aufrufer und fuellt beide Spalten aus typ. Ein
    -- coalesce oder ein Default hier waere derselbe Fehler wie v92c.
    insert into fragen (
        frage_text, typ, medium, antworttyp,
        option_a, option_b, option_c, richtige_option,
        musterantwort, bewertungshinweise, antwort_hinweis,
        video_url, video_start_sekunden, video_end_sekunden, video_antworttyp, video_stumm,
        erklaerung_zusatzhinweis, nie_in_rotation,
        regel_nummer, schwierigkeit, quelle_typ, quelle_detail, quelle_sortierschluessel,
        aktiv
    ) values (
        p_frage_text, p_typ, p_medium, p_antworttyp,
        p_option_a, p_option_b, p_option_c, p_richtige_option,
        p_musterantwort, p_bewertungshinweise, p_antwort_hinweis,
        p_video_url, p_video_start_sekunden, p_video_end_sekunden, p_video_antworttyp, p_video_stumm,
        p_erklaerung_zusatzhinweis, p_nie_in_rotation,
        p_regel_nummer, p_schwierigkeit, p_quelle_typ, p_quelle_detail, v_sortierschluessel,
        true
    ) returning id into v_neue_id;

    return v_neue_id;
end;
$function$;

revoke all on function public.obmann_frage_erstellen(
  text, text, text, text, text, text, smallint, smallint, text, text, text,
  text, text, text, text, integer, integer, text, boolean, text, boolean,
  text, text) from public;

grant execute on function public.obmann_frage_erstellen(
  text, text, text, text, text, text, smallint, smallint, text, text, text,
  text, text, text, text, integer, integer, text, boolean, text, boolean,
  text, text) to anon, authenticated;

-- ============================================================
--  2. obmann_frage_bearbeiten
-- ============================================================

drop function if exists public.obmann_frage_bearbeiten(
  text, uuid, text, text, text, text, text, smallint, smallint, text, text,
  text, text, text, text, text, integer, integer, text, boolean, text, boolean);

create function public.obmann_frage_bearbeiten(
    p_passwort text,
    p_frage_id uuid,
    p_frage_text text,
    p_option_a text default null,
    p_option_b text default null,
    p_option_c text default null,
    p_richtige_option text default null,
    p_regel_nummer smallint default null,
    p_schwierigkeit smallint default null,
    p_quelle_typ text default null,
    p_quelle_detail text default null,
    p_typ text default 'multiple_choice',
    p_musterantwort text default null,
    p_bewertungshinweise text default null,
    p_antwort_hinweis text default null,
    p_video_url text default null,
    p_video_start_sekunden integer default null,
    p_video_end_sekunden integer default null,
    p_video_antworttyp text default null,
    p_video_stumm boolean default false,
    p_erklaerung_zusatzhinweis text default null,
    p_nie_in_rotation boolean default false,
    p_medium text default null,
    p_antworttyp text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ok boolean;
  v_match text[];
  v_sortierschluessel text;
begin
  select exists(select 1 from obmann_zugang where passwort = p_passwort) into v_ok;
  if not v_ok then
    raise exception 'Falsches Passwort';
  end if;

  if p_quelle_typ = 'dfb_schiri_zeitung' then
    v_match := regexp_match(coalesce(p_quelle_detail, ''), '^(\d{2})/(\d{2})$');
    if v_match is not null then
      v_sortierschluessel := '20' || v_match[2] || v_match[1];
    else
      v_sortierschluessel := null;
    end if;
  elsif p_quelle_typ = 'hausregeltest' then
    v_sortierschluessel := p_quelle_detail;
  else
    v_sortierschluessel := null;
  end if;

  -- coalesce statt direkter Zuweisung: schickt eine aeltere App-Fassung
  -- die beiden Achsen nicht mit, bleiben die gespeicherten Werte stehen.
  -- Der Trigger sieht dann medium/antworttyp unveraendert und ein
  -- geaendertes typ - genau sein Zweig fuer den alten Aufrufer.
  update fragen
  set frage_text = p_frage_text,
      typ = p_typ,
      medium = coalesce(p_medium, medium),
      antworttyp = coalesce(p_antworttyp, antworttyp),
      option_a = p_option_a,
      option_b = p_option_b,
      option_c = p_option_c,
      richtige_option = p_richtige_option,
      musterantwort = p_musterantwort,
      bewertungshinweise = p_bewertungshinweise,
      antwort_hinweis = p_antwort_hinweis,
      video_url = p_video_url,
      video_start_sekunden = p_video_start_sekunden,
      video_end_sekunden = p_video_end_sekunden,
      video_antworttyp = p_video_antworttyp,
      video_stumm = p_video_stumm,
      erklaerung_zusatzhinweis = p_erklaerung_zusatzhinweis,
      nie_in_rotation = p_nie_in_rotation,
      regel_nummer = p_regel_nummer,
      schwierigkeit = p_schwierigkeit,
      quelle_typ = p_quelle_typ,
      quelle_detail = p_quelle_detail,
      quelle_sortierschluessel = v_sortierschluessel
  where id = p_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_bearbeiten(
  text, uuid, text, text, text, text, text, smallint, smallint, text, text,
  text, text, text, text, text, integer, integer, text, boolean, text, boolean,
  text, text) from public;

grant execute on function public.obmann_frage_bearbeiten(
  text, uuid, text, text, text, text, text, smallint, smallint, text, text,
  text, text, text, text, text, integer, integer, text, boolean, text, boolean,
  text, text) to anon, authenticated;

-- ============================================================
--  3. obmann_frage_details - die beiden Achsen mitliefern
-- ============================================================
--
-- Die Signatur (text, uuid) bleibt gleich, nur die RETURNS TABLE waechst.
-- Auch das geht nicht mit create or replace.

drop function if exists public.obmann_frage_details(text, uuid);

create function public.obmann_frage_details(p_passwort text, p_frage_id uuid)
returns table(
  frage_id uuid,
  frage_text text,
  typ text,
  medium text,
  antworttyp text,
  option_a text,
  option_b text,
  option_c text,
  richtige_option text,
  musterantwort text,
  bewertungshinweise text,
  antwort_hinweis text,
  regel_nummer smallint,
  schwierigkeit smallint,
  quelle_typ text,
  quelle_detail text,
  video_url text,
  video_start_sekunden integer,
  video_end_sekunden integer,
  video_antworttyp text,
  video_stumm boolean,
  erklaerung_zusatzhinweis text,
  nie_in_rotation boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ok boolean;
begin
  select exists(select 1 from obmann_zugang where passwort = p_passwort) into v_ok;
  if not v_ok then
    raise exception 'Falsches Passwort';
  end if;

  return query
  select f.id, f.frage_text, f.typ, f.medium, f.antworttyp,
         f.option_a, f.option_b, f.option_c, f.richtige_option,
         f.musterantwort, f.bewertungshinweise, f.antwort_hinweis,
         f.regel_nummer, f.schwierigkeit, f.quelle_typ, f.quelle_detail,
         f.video_url, f.video_start_sekunden, f.video_end_sekunden, f.video_antworttyp, f.video_stumm,
         f.erklaerung_zusatzhinweis, f.nie_in_rotation
  from fragen f
  where f.id = p_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_details(text, uuid) from public;
grant execute on function public.obmann_frage_details(text, uuid) to anon, authenticated;
