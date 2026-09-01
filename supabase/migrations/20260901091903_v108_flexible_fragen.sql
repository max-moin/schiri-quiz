-- Flexible Wochenfragen: Mehrfachauswahl, Bild und Zahl mit Einheit.
-- Bestehende RPCs bleiben unverändert erreichbar; die Website nutzt neue
-- v2-Lesewege, damit ein altes Deployment während des Rollouts weiterläuft.

alter table public.fragen
  drop constraint if exists fragen_antworttyp_gueltig;
alter table public.fragen
  add constraint fragen_antworttyp_gueltig
  check (antworttyp in ('multiple_choice', 'mehrfachauswahl', 'freitext', 'entscheidung', 'zahl'));

alter table public.fragen
  drop constraint if exists fragen_video_antworttyp_check;
alter table public.fragen
  add constraint fragen_video_antworttyp_check
  check (video_antworttyp is null or video_antworttyp in ('multiple_choice', 'mehrfachauswahl', 'freitext', 'zahl'));

alter table public.fragen
  add column if not exists bild_base64 text,
  add column if not exists bild_mime text,
  add column if not exists bild_alt text,
  add column if not exists bild_quelle text;

alter table public.fragen
  add constraint fragen_bild_mime_gueltig
  check (bild_mime is null or bild_mime in ('image/jpeg', 'image/png', 'image/webp')),
  add constraint fragen_bild_vollstaendig
  check (
    (bild_base64 is null and bild_mime is null and bild_alt is null)
    or
    (bild_base64 is not null and bild_mime is not null and nullif(btrim(bild_alt), '') is not null)
  ),
  add constraint fragen_bild_nur_bei_medium_bild
  check (medium = 'bild' or bild_base64 is null);

create table if not exists public.frage_antwortoptionen (
  frage_id uuid not null references public.fragen(id) on delete cascade,
  schluessel text not null,
  position smallint not null,
  text text not null,
  ist_richtig boolean not null default false,
  primary key (frage_id, schluessel),
  unique (frage_id, position),
  constraint frage_antwortoptionen_schluessel check (schluessel ~ '^[a-h]$'),
  constraint frage_antwortoptionen_position check (position between 1 and 8),
  constraint frage_antwortoptionen_text check (nullif(btrim(text), '') is not null)
);
alter table public.frage_antwortoptionen enable row level security;
revoke all on table public.frage_antwortoptionen from public, anon, authenticated;

create table if not exists public.frage_zahl_loesungen (
  id bigint generated always as identity primary key,
  frage_id uuid not null references public.fragen(id) on delete cascade,
  wert numeric not null,
  einheit text not null,
  toleranz numeric not null default 0,
  position smallint not null default 1,
  unique (frage_id, position),
  constraint frage_zahl_loesungen_einheit check (
    char_length(btrim(einheit)) between 1 and 20
    and einheit !~ '[<>]'
  ),
  constraint frage_zahl_loesungen_toleranz check (toleranz >= 0),
  constraint frage_zahl_loesungen_position check (position between 1 and 8)
);
alter table public.frage_zahl_loesungen enable row level security;
revoke all on table public.frage_zahl_loesungen from public, anon, authenticated;

alter table public.antworten
  add column if not exists gegebene_auswahl text[],
  add column if not exists gegebene_zahl numeric,
  add column if not exists gegebene_einheit text;

alter table public.antworten
  add constraint antworten_auswahl_gueltig
  check (
    gegebene_auswahl is null
    or (
      cardinality(gegebene_auswahl) between 1 and 8
      and gegebene_auswahl <@ array['a','b','c','d','e','f','g','h']::text[]
    )
  ),
  add constraint antworten_zahl_vollstaendig
  check ((gegebene_zahl is null) = (gegebene_einheit is null));

create or replace function public.obmann_frage_flex_speichern(
  p_passwort text,
  p_frage_id uuid default null,
  p_basis jsonb default '{}'::jsonb,
  p_inhalt jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_frage_id;
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_antworttyp text := coalesce(nullif(p_basis->>'antworttyp', ''), 'multiple_choice');
  v_typ text;
  v_optionen jsonb := coalesce(p_inhalt->'optionen', '[]'::jsonb);
  v_zahlen jsonb := coalesce(p_inhalt->'zahlen', '[]'::jsonb);
  v_anzahl integer;
  v_richtige integer;
  v_option_a text;
  v_option_b text;
  v_option_c text;
  v_richtige_option text;
  v_bild_base64 text := nullif(p_inhalt->>'bild_base64', '');
  v_bild_mime text := nullif(p_inhalt->>'bild_mime', '');
  v_bild_alt text := nullif(btrim(p_inhalt->>'bild_alt'), '');
  v_bild_quelle text := nullif(p_inhalt->>'bild_quelle', '');
begin
  perform public.obmann_verein(p_passwort);

  if v_medium not in ('text', 'video', 'bild') then
    raise exception 'Unbekannter Fragentyp';
  end if;
  if v_antworttyp not in ('multiple_choice', 'mehrfachauswahl', 'freitext', 'zahl') then
    raise exception 'Dieser Antworttyp wird über einen anderen Speicherweg verwaltet';
  end if;
  if nullif(btrim(p_basis->>'frage_text'), '') is null then
    raise exception 'Fragetext fehlt';
  end if;
  if v_medium = 'video' and nullif(btrim(p_basis->>'video_url'), '') is null then
    raise exception 'Video-Link fehlt';
  end if;
  if v_medium = 'bild' then
    if v_bild_base64 is null or v_bild_mime is null or v_bild_alt is null then
      raise exception 'Bild, Dateityp und Alternativtext sind erforderlich';
    end if;
    if v_bild_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'Nicht unterstütztes Bildformat';
    end if;
    if char_length(v_bild_base64) > 2800000 then
      raise exception 'Bild ist zu groß';
    end if;
  else
    v_bild_base64 := null;
    v_bild_mime := null;
    v_bild_alt := null;
    v_bild_quelle := null;
  end if;

  if v_antworttyp in ('multiple_choice', 'mehrfachauswahl') then
    if jsonb_typeof(v_optionen) <> 'array' then raise exception 'Antwortoptionen sind ungültig'; end if;
    v_anzahl := jsonb_array_length(v_optionen);
    select count(*) filter (where coalesce((e.value->>'richtig')::boolean, false))::integer
      into v_richtige
    from jsonb_array_elements(v_optionen) e;

    if v_anzahl not between 2 and 8 then raise exception 'Es sind 2 bis 8 Antwortoptionen erforderlich'; end if;
    if exists (
      select 1 from jsonb_array_elements(v_optionen) e
      where nullif(btrim(e.value->>'text'), '') is null
    ) then raise exception 'Leere Antwortoption'; end if;
    if v_antworttyp = 'multiple_choice' and v_richtige <> 1 then
      raise exception 'Bei Einfachauswahl muss genau eine Antwort richtig sein';
    end if;
    if v_antworttyp = 'mehrfachauswahl' and (v_richtige < 1 or v_richtige >= v_anzahl) then
      raise exception 'Bei Mehrfachauswahl muss mindestens eine, aber nicht jede Antwort richtig sein';
    end if;

    select max(case when ordinality = 1 then btrim(value->>'text') end),
           max(case when ordinality = 2 then btrim(value->>'text') end),
           max(case when ordinality = 3 then btrim(value->>'text') end),
           min(chr(96 + ordinality::integer)) filter (where coalesce((value->>'richtig')::boolean, false))
      into v_option_a, v_option_b, v_option_c, v_richtige_option
    from jsonb_array_elements(v_optionen) with ordinality;
  elsif v_antworttyp = 'zahl' then
    if jsonb_typeof(v_zahlen) <> 'array' or jsonb_array_length(v_zahlen) not between 1 and 8 then
      raise exception 'Mindestens eine gültige Zahlenlösung ist erforderlich';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_zahlen) e
      where nullif(btrim(e.value->>'einheit'), '') is null
         or (e.value->>'wert') is null
         or coalesce((e.value->>'toleranz')::numeric, 0) < 0
    ) then raise exception 'Zahlenlösung ist unvollständig'; end if;
  elsif v_antworttyp = 'freitext' then
    if nullif(btrim(p_basis->>'musterantwort'), '') is null then
      raise exception 'Musterantwort fehlt';
    end if;
  end if;

  v_typ := case
    when v_antworttyp = 'freitext' and v_medium = 'video' then 'video_freitext'
    when v_antworttyp = 'freitext' then 'freitext'
    when v_medium = 'video' then 'video_mc'
    else 'multiple_choice'
  end;

  if v_id is null then
    v_id := public.obmann_frage_erstellen(
      p_passwort,
      btrim(p_basis->>'frage_text'),
      v_option_a, v_option_b, v_option_c, v_richtige_option,
      nullif(p_basis->>'regel_nummer', '')::smallint,
      nullif(p_basis->>'schwierigkeit', '')::smallint,
      nullif(p_basis->>'quelle_typ', ''), nullif(p_basis->>'quelle_detail', ''),
      v_typ,
      nullif(p_basis->>'musterantwort', ''), nullif(p_basis->>'bewertungshinweise', ''),
      nullif(p_basis->>'antwort_hinweis', ''), nullif(p_basis->>'video_url', ''),
      nullif(p_basis->>'video_start_sekunden', '')::integer,
      nullif(p_basis->>'video_end_sekunden', '')::integer,
      case when v_medium = 'video' then v_antworttyp else null end,
      coalesce((p_basis->>'video_stumm')::boolean, false),
      nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
      coalesce((p_basis->>'nie_in_rotation')::boolean, false),
      v_medium, v_antworttyp
    );
  else
    if not exists (select 1 from public.fragen where id = v_id) then raise exception 'Frage nicht gefunden'; end if;
    perform public.obmann_frage_bearbeiten(
      p_passwort, v_id,
      btrim(p_basis->>'frage_text'),
      v_option_a, v_option_b, v_option_c, v_richtige_option,
      nullif(p_basis->>'regel_nummer', '')::smallint,
      nullif(p_basis->>'schwierigkeit', '')::smallint,
      nullif(p_basis->>'quelle_typ', ''), nullif(p_basis->>'quelle_detail', ''),
      v_typ,
      nullif(p_basis->>'musterantwort', ''), nullif(p_basis->>'bewertungshinweise', ''),
      nullif(p_basis->>'antwort_hinweis', ''), nullif(p_basis->>'video_url', ''),
      nullif(p_basis->>'video_start_sekunden', '')::integer,
      nullif(p_basis->>'video_end_sekunden', '')::integer,
      case when v_medium = 'video' then v_antworttyp else null end,
      coalesce((p_basis->>'video_stumm')::boolean, false),
      nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
      coalesce((p_basis->>'nie_in_rotation')::boolean, false),
      v_medium, v_antworttyp
    );
  end if;

  update public.fragen set
    bild_base64 = v_bild_base64,
    bild_mime = v_bild_mime,
    bild_alt = v_bild_alt,
    bild_quelle = v_bild_quelle
  where id = v_id;

  delete from public.frage_antwortoptionen where frage_id = v_id;
  delete from public.frage_zahl_loesungen where frage_id = v_id;

  if v_antworttyp in ('multiple_choice', 'mehrfachauswahl') then
    insert into public.frage_antwortoptionen(frage_id, schluessel, position, text, ist_richtig)
    select v_id, chr(96 + ordinality::integer), ordinality::smallint,
           btrim(value->>'text'), coalesce((value->>'richtig')::boolean, false)
    from jsonb_array_elements(v_optionen) with ordinality;
  elsif v_antworttyp = 'zahl' then
    insert into public.frage_zahl_loesungen(frage_id, wert, einheit, toleranz, position)
    select v_id, (value->>'wert')::numeric, btrim(value->>'einheit'),
           coalesce((value->>'toleranz')::numeric, 0), ordinality::smallint
    from jsonb_array_elements(v_zahlen) with ordinality;
  end if;

  return v_id;
end;
$$;

-- Icon-Antworten behalten ihre eigene Lösungstabelle. Dieser Wrapper macht
-- lediglich das Aufgabenmedium unabhängig und speichert ein Bild gemeinsam
-- mit der Entscheidungsfrage in einer Transaktion. Die ältere Entscheidungs-
-- RPC kennt Text/Video; für Bild wird sie intern mit Text aufgerufen und das
-- Medium anschließend noch in derselben Transaktion korrekt gesetzt.
create or replace function public.obmann_frage_entscheidung_flex_speichern(
  p_passwort text,
  p_frage_id uuid default null,
  p_basis jsonb default '{}'::jsonb,
  p_loesung jsonb default '{}'::jsonb,
  p_inhalt jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_frage_id;
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_call_basis jsonb := p_basis;
  v_bild_base64 text := nullif(p_inhalt->>'bild_base64', '');
  v_bild_mime text := nullif(p_inhalt->>'bild_mime', '');
  v_bild_alt text := nullif(btrim(p_inhalt->>'bild_alt'), '');
  v_bild_quelle text := nullif(p_inhalt->>'bild_quelle', '');
begin
  perform public.obmann_verein(p_passwort);
  if v_medium not in ('text', 'video', 'bild') then raise exception 'Unbekanntes Medium'; end if;
  if v_medium = 'bild' then
    if v_bild_base64 is null or v_bild_mime not in ('image/jpeg','image/png','image/webp') or v_bild_alt is null then
      raise exception 'Bild, Format und Alternativtext sind erforderlich';
    end if;
    v_call_basis := jsonb_set(p_basis, '{medium}', '"text"'::jsonb, true);
  else
    v_bild_base64 := null;
    v_bild_mime := null;
    v_bild_alt := null;
    v_bild_quelle := null;
  end if;

  if v_id is null then
    v_id := public.obmann_frage_entscheidung_erstellen(p_passwort, v_call_basis, p_loesung);
  else
    perform public.obmann_frage_entscheidung_bearbeiten(p_passwort, v_id, v_call_basis, p_loesung);
  end if;

  update public.fragen set
    medium = v_medium,
    bild_base64 = v_bild_base64,
    bild_mime = v_bild_mime,
    bild_alt = v_bild_alt,
    bild_quelle = v_bild_quelle
  where id = v_id;
  return v_id;
end;
$$;

create or replace function public.obmann_frage_flex_details(p_passwort text, p_frage_id uuid)
returns table(inhalt jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.obmann_verein(p_passwort);
  return query
  select jsonb_build_object(
    'optionen', coalesce((
      select jsonb_agg(jsonb_build_object('schluessel', o.schluessel, 'text', o.text, 'richtig', o.ist_richtig) order by o.position)
      from public.frage_antwortoptionen o where o.frage_id = f.id
    ), '[]'::jsonb),
    'zahlen', coalesce((
      select jsonb_agg(jsonb_build_object('wert', z.wert, 'einheit', z.einheit, 'toleranz', z.toleranz) order by z.position)
      from public.frage_zahl_loesungen z where z.frage_id = f.id
    ), '[]'::jsonb),
    'bild_base64', f.bild_base64,
    'bild_mime', f.bild_mime,
    'bild_alt', f.bild_alt,
    'bild_quelle', f.bild_quelle
  )
  from public.fragen f where f.id = p_frage_id;
end;
$$;

create or replace function public.wochen_fragen_v2(p_schiedsrichter_id uuid, p_pin text)
returns table(
  id uuid, frage_text text, option_a text, option_b text, option_c text,
  regel_nummer smallint, regel_bezeichnung text, schwierigkeit smallint, "position" integer,
  typ text, antwort_hinweis text, video_url text, video_start_sekunden integer,
  video_end_sekunden integer, video_antworttyp text, video_stumm boolean,
  frage_nummer integer, medium text, antworttyp text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean,
  trikot_heim text, trikot_gast text,
  antwortoptionen jsonb, zahl_einheiten jsonb,
  bild_base64 text, bild_mime text, bild_alt text
)
language plpgsql
security definer
set search_path = public
as $$
declare v_pin text; v_aktiv boolean; v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then raise exception 'PIN falsch'; end if;

  return query
  select f.id, f.frage_text, f.option_a, f.option_b, f.option_c,
         f.regel_nummer, reg.bezeichnung, f.schwierigkeit, rf.position,
         f.typ, f.antwort_hinweis, f.video_url, f.video_start_sekunden,
         f.video_end_sekunden, f.video_antworttyp, f.video_stumm,
         nr.frage_nummer, f.medium, f.antworttyp,
         l.fordert_fortsetzung, l.fordert_fortsetzung_fuer,
         l.fordert_fortsetzung_ort, l.fordert_strafe,
         l.fordert_strafe_mannschaft, l.fordert_strafe_rolle,
         l.fordert_strafe_nummer, l.zeigt_trikotfarben,
         l.trikot_heim, l.trikot_gast,
         case when f.antworttyp in ('multiple_choice','mehrfachauswahl') then
           coalesce((select jsonb_agg(jsonb_build_object('schluessel', o.schluessel, 'text', o.text) order by o.position)
                     from public.frage_antwortoptionen o where o.frage_id = f.id),
                    jsonb_strip_nulls(jsonb_build_array(
                      jsonb_build_object('schluessel','a','text',f.option_a),
                      jsonb_build_object('schluessel','b','text',f.option_b),
                      jsonb_build_object('schluessel','c','text',f.option_c))))
           else null end,
         case when f.antworttyp = 'zahl' then
           (select jsonb_agg(jsonb_build_object('einheit', q.einheit) order by q.erste_position)
            from (select z.einheit, min(z.position) erste_position from public.frage_zahl_loesungen z where z.frage_id=f.id group by z.einheit) q)
           else null end,
         f.bild_base64, f.bild_mime, f.bild_alt
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  join public.wochen_frage_nummern nr on nr.verein_id=rf.verein_id and nr.frage_id=rf.frage_id
  left join public.regeln reg on reg.nummer=f.regel_nummer
  left join public.frage_entscheidungsloesungen l on l.frage_id=f.id
  where now() between r.startet_am and r.endet_am and f.aktiv
  order by nr.frage_nummer nulls last, f.erstellt_am;
end;
$$;

create or replace function public.antwort_auswahl_abgeben(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_auswahl text[], p_pin text
)
returns table(korrekt boolean, richtige_auswahl text[], bereits_beantwortet boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text; v_ist_test boolean; v_aktiv boolean; v_verein uuid; v_typ text;
  v_gegeben text[]; v_richtig text[]; v_vorhanden public.antworten%rowtype; v_korrekt boolean;
begin
  select s.pin,s.ist_test,s.aktiv,s.verein_id into v_pin,v_ist_test,v_aktiv,v_verein
  from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  if v_pin is null or v_pin<>p_pin or not coalesce(v_aktiv,false) then raise exception 'PIN falsch'; end if;

  select f.antworttyp into v_typ
  from public.fragen f join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  where f.id=p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv;
  if v_typ not in ('multiple_choice','mehrfachauswahl') then raise exception 'Frage nicht gefunden oder falscher Antworttyp'; end if;

  select array_agg(distinct lower(x) order by lower(x)) into v_gegeben from unnest(p_auswahl) x;
  if v_gegeben is null or cardinality(v_gegeben)=0 then raise exception 'Keine Antwort ausgewählt'; end if;
  if not v_gegeben <@ array['a','b','c','d','e','f','g','h']::text[] then raise exception 'Ungültige Antwort'; end if;
  if v_typ='multiple_choice' and cardinality(v_gegeben)<>1 then raise exception 'Bitte genau eine Antwort auswählen'; end if;

  select array_agg(o.schluessel order by o.schluessel) into v_richtig
  from public.frage_antwortoptionen o where o.frage_id=p_frage_id and o.ist_richtig;
  if v_richtig is null then
    select array[f.richtige_option] into v_richtig from public.fragen f where f.id=p_frage_id;
  end if;
  v_korrekt := v_gegeben = v_richtig;

  select * into v_vorhanden from public.antworten a
  where a.schiedsrichter_id=p_schiedsrichter_id and a.frage_id=p_frage_id;
  if found then return query select v_vorhanden.korrekt,v_richtig,true; return; end if;
  if not v_ist_test then
    insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,gegebene_auswahl,korrekt,bewertungsstatus)
    values(p_schiedsrichter_id,p_frage_id,case when cardinality(v_gegeben)=1 then v_gegeben[1] else null end,v_gegeben,v_korrekt,case when v_korrekt then 'richtig' else 'falsch' end);
  end if;
  return query select v_korrekt,v_richtig,false;
end;
$$;

create or replace function public.antwort_zahl_abgeben(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_wert numeric, p_einheit text, p_pin text
)
returns table(korrekt boolean, richtige_antworten jsonb, bereits_beantwortet boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text; v_ist_test boolean; v_aktiv boolean; v_verein uuid; v_typ text;
  v_loesungen jsonb; v_vorhanden public.antworten%rowtype; v_korrekt boolean;
begin
  select s.pin,s.ist_test,s.aktiv,s.verein_id into v_pin,v_ist_test,v_aktiv,v_verein
  from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  if v_pin is null or v_pin<>p_pin or not coalesce(v_aktiv,false) then raise exception 'PIN falsch'; end if;
  if p_wert is null or nullif(btrim(p_einheit),'') is null then raise exception 'Zahl und Einheit fehlen'; end if;

  select f.antworttyp into v_typ
  from public.fragen f join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  where f.id=p_frage_id and now() between r.startet_am and r.endet_am and f.aktiv;
  if v_typ <> 'zahl' then raise exception 'Frage nicht gefunden oder falscher Antworttyp'; end if;

  select coalesce(bool_or(z.einheit=btrim(p_einheit) and abs(z.wert-p_wert)<=z.toleranz),false),
         jsonb_agg(jsonb_build_object('wert',z.wert,'einheit',z.einheit) order by z.position)
    into v_korrekt,v_loesungen
  from public.frage_zahl_loesungen z where z.frage_id=p_frage_id;

  select * into v_vorhanden from public.antworten a
  where a.schiedsrichter_id=p_schiedsrichter_id and a.frage_id=p_frage_id;
  if found then return query select v_vorhanden.korrekt,v_loesungen,true; return; end if;
  if not v_ist_test then
    insert into public.antworten(schiedsrichter_id,frage_id,gegebene_zahl,gegebene_einheit,korrekt,bewertungsstatus)
    values(p_schiedsrichter_id,p_frage_id,p_wert,btrim(p_einheit),v_korrekt,case when v_korrekt then 'richtig' else 'falsch' end);
  end if;
  return query select v_korrekt,v_loesungen,false;
end;
$$;

create or replace function public.meine_antworten_v2(p_schiedsrichter_id uuid, p_pin text)
returns table(
  frage_id uuid, beantwortet boolean, gegebene_option text, korrekt boolean,
  richtige_option text, gegebener_freitext text, ki_feedback text, musterantwort text,
  bewertungsstatus text, nachbesserung_offen boolean, zweiter_freitext text,
  ki_nachfrage text, entscheidung jsonb, gegebene_auswahl text[], richtige_auswahl text[],
  gegebene_zahl numeric, gegebene_einheit text, richtige_zahlen jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare v_pin text; v_verein uuid;
begin
  select s.pin,s.verein_id into v_pin,v_verein from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  if v_pin is null or v_pin<>p_pin then raise exception 'PIN falsch'; end if;
  return query
  select f.id,(a.id is not null),a.gegebene_option,a.korrekt,
    case when a.id is not null and a.bewertungsstatus<>'nachbessern' then f.richtige_option end,
    a.gegebener_freitext,coalesce(a.ki_feedback_final,a.ki_feedback),
    case when a.id is not null and a.bewertungsstatus<>'nachbessern' then f.musterantwort end,
    a.bewertungsstatus,(a.bewertungsstatus='nachbessern'),a.zweiter_freitext,a.ki_nachfrage,
    case when ae.antwort_id is not null then jsonb_build_object('antwort',ae.gegebene_antwort,'loesung',ae.loesung_snapshot,'ergebnis',jsonb_build_object('fortsetzung_richtig',ae.fortsetzung_richtig,'richtung_richtig',ae.richtung_richtig,'ort_richtig',ae.ort_richtig,'strafe_richtig',ae.strafe_richtig,'strafziel_richtig',ae.strafziel_richtig,'rolle_richtig',ae.rolle_richtig,'rueckennummer_richtig',ae.rueckennummer_richtig,'ort_feedback',ae.ort_feedback)) end,
    a.gegebene_auswahl,
    case when a.id is not null then (select array_agg(o.schluessel order by o.schluessel) from public.frage_antwortoptionen o where o.frage_id=f.id and o.ist_richtig) end,
    a.gegebene_zahl,a.gegebene_einheit,
    case when a.id is not null then (select jsonb_agg(jsonb_build_object('wert',z.wert,'einheit',z.einheit) order by z.position) from public.frage_zahl_loesungen z where z.frage_id=f.id) end
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id=f.id and rf.verein_id=v_verein
  join public.runden r on r.id=rf.runde_id
  left join public.antworten a on a.frage_id=f.id and a.schiedsrichter_id=p_schiedsrichter_id
  left join public.antwort_entscheidungen ae on ae.antwort_id=a.id
  where now() between r.startet_am and r.endet_am and f.aktiv;
end;
$$;

revoke all on function public.obmann_frage_flex_speichern(text,uuid,jsonb,jsonb) from public, authenticated;
revoke all on function public.obmann_frage_entscheidung_flex_speichern(text,uuid,jsonb,jsonb,jsonb) from public, authenticated;
revoke all on function public.obmann_frage_flex_details(text,uuid) from public, authenticated;
revoke all on function public.wochen_fragen_v2(uuid,text) from public, authenticated;
revoke all on function public.antwort_auswahl_abgeben(uuid,uuid,text[],text) from public, authenticated;
revoke all on function public.antwort_zahl_abgeben(uuid,uuid,numeric,text,text) from public, authenticated;
revoke all on function public.meine_antworten_v2(uuid,text) from public, authenticated;
grant execute on function public.obmann_frage_flex_speichern(text,uuid,jsonb,jsonb) to anon;
grant execute on function public.obmann_frage_entscheidung_flex_speichern(text,uuid,jsonb,jsonb,jsonb) to anon;
grant execute on function public.obmann_frage_flex_details(text,uuid) to anon;
grant execute on function public.wochen_fragen_v2(uuid,text) to anon;
grant execute on function public.antwort_auswahl_abgeben(uuid,uuid,text[],text) to anon;
grant execute on function public.antwort_zahl_abgeben(uuid,uuid,numeric,text,text) to anon;
grant execute on function public.meine_antworten_v2(uuid,text) to anon;

comment on function public.obmann_frage_flex_speichern(text,uuid,jsonb,jsonb) is
  'Obmann-App: atomarer Speicherweg fuer Text/Video/Bild mit Einfach-, Mehrfach-, Freitext- oder Zahlenantwort. Authentifiziert ueber obmann_verein().';
comment on function public.obmann_frage_entscheidung_flex_speichern(text,uuid,jsonb,jsonb,jsonb) is
  'Obmann-App: atomarer Speicherweg fuer Icon-Antworten mit Text, Video oder Bild.';
comment on function public.wochen_fragen_v2(uuid,text) is
  'Wochenquiz v2: liefert flexible Antwortoptionen, Einheiten und das Aufgabenbild, aber niemals die richtige Auswahl oder Zahlenwerte.';
