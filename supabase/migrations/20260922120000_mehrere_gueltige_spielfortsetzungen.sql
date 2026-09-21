-- Eine Icon-Frage darf mehrere fachlich gleichwertige Spielfortsetzungen
-- akzeptieren. Im Quiz wird weiterhin genau EINE Antwort gewählt.
--
-- Der bisherige Einzelwert bleibt als primaere/abwärtskompatible Lösung
-- erhalten. Er ist immer das erste Element der neuen Liste. Alte Clients
-- und Auswertungen laufen dadurch weiter, neue Auswertungen prüfen gegen
-- die vollständige Liste.

alter table public.frage_entscheidungsloesungen
  add column if not exists spielfortsetzungen_gueltig text[] not null default '{}'::text[];

update public.frage_entscheidungsloesungen
set spielfortsetzungen_gueltig = case
  when fordert_fortsetzung and spielfortsetzung is not null
    then array[spielfortsetzung]
  else '{}'::text[]
end
where spielfortsetzungen_gueltig = '{}'::text[];

alter table public.frage_entscheidungsloesungen
  drop constraint if exists frage_entscheidung_fortsetzungen_gueltig,
  drop constraint if exists frage_entscheidung_fortsetzungen_konsistent,
  drop constraint if exists frage_entscheidung_richtung_zulaessig,
  add constraint frage_entscheidung_fortsetzungen_gueltig check (
    array_position(spielfortsetzungen_gueltig, null) is null
    and spielfortsetzungen_gueltig <@ array[
      'weiterspielen', 'direkter_freistoss', 'indirekter_freistoss',
      'strafstoss', 'sr_ball', 'eckstoss', 'abstoss', 'einwurf', 'anstoss'
    ]::text[]
  ),
  add constraint frage_entscheidung_fortsetzungen_konsistent check (
    (fordert_fortsetzung
      and cardinality(spielfortsetzungen_gueltig) > 0
      and spielfortsetzung = spielfortsetzungen_gueltig[1])
    or
    (not fordert_fortsetzung
      and cardinality(spielfortsetzungen_gueltig) = 0
      and spielfortsetzung is null)
  ),
  -- Nur wenn mindestens eine zulässige Antwort eine Richtung haben kann,
  -- darf die Frage nach Heim/Gast fragen. Wählt der Teilnehmer eine
  -- richtungslose Alternative (Weiterspielen/SR-Ball), wird die Teilfrage
  -- bei dieser konkreten Antwort nicht bewertet.
  add constraint frage_entscheidung_richtung_zulaessig check (
    not fordert_fortsetzung_fuer
    or spielfortsetzungen_gueltig && array[
      'direkter_freistoss', 'indirekter_freistoss', 'strafstoss',
      'eckstoss', 'abstoss', 'einwurf', 'anstoss'
    ]::text[]
  );

comment on column public.frage_entscheidungsloesungen.spielfortsetzungen_gueltig is
  'Alle als richtig gewerteten Spielfortsetzungen. Der Teilnehmer waehlt weiterhin genau eine; Element 1 entspricht dem Legacy-Feld spielfortsetzung.';

-- Alte Schreibwege kennen nur den Einzelwert. Der Trigger hält deren Liste
-- automatisch synchron. Der neue Flex-Editor überschreibt sie anschließend
-- innerhalb derselben Transaktion mit der vollständigen Auswahl.
create or replace function public.frage_entscheidung_fortsetzungen_sync()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not new.fordert_fortsetzung then
    new.spielfortsetzungen_gueltig := '{}'::text[];
  elsif tg_op = 'INSERT'
     or cardinality(new.spielfortsetzungen_gueltig) = 0
     or (new.spielfortsetzung is distinct from old.spielfortsetzung
         and new.spielfortsetzungen_gueltig is not distinct from old.spielfortsetzungen_gueltig) then
    new.spielfortsetzungen_gueltig := array[new.spielfortsetzung];
  end if;
  return new;
end;
$function$;

drop trigger if exists frage_entscheidung_fortsetzungen_sync
  on public.frage_entscheidungsloesungen;
create trigger frage_entscheidung_fortsetzungen_sync
before insert or update on public.frage_entscheidungsloesungen
for each row execute function public.frage_entscheidung_fortsetzungen_sync();

-- Der bestehende JSON-Vertrag wird nur um
-- `spielfortsetzungen_gueltig: [..]` erweitert. Deshalb bleibt der RPC-Name
-- gleich und ältere App-Versionen können ihn weiterhin aufrufen.
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
as $function$
declare
  v_id uuid := p_frage_id;
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_call_basis jsonb := p_basis;
  v_bild_base64 text := nullif(p_inhalt->>'bild_base64', '');
  v_bild_mime text := nullif(p_inhalt->>'bild_mime', '');
  v_bild_alt text := nullif(btrim(p_inhalt->>'bild_alt'), '');
  v_bild_quelle text := nullif(p_inhalt->>'bild_quelle', '');
  v_will_fortsetzung boolean := coalesce((p_loesung->>'fordert_fortsetzung')::boolean, true);
  v_haupt_fortsetzung text := nullif(p_loesung->>'spielfortsetzung', '');
  v_fortsetzungen text[];
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

  if v_will_fortsetzung then
    if p_loesung ? 'spielfortsetzungen_gueltig'
       and jsonb_typeof(p_loesung->'spielfortsetzungen_gueltig') = 'array' then
      select array[v_haupt_fortsetzung] || coalesce(array_agg(q.wert order by q.erste_position), '{}'::text[])
      into v_fortsetzungen
      from (
        select value as wert, min(ordinality) as erste_position
        from jsonb_array_elements_text(p_loesung->'spielfortsetzungen_gueltig') with ordinality
        where value <> v_haupt_fortsetzung
        group by value
      ) q;
    else
      v_fortsetzungen := array[v_haupt_fortsetzung];
    end if;
    if v_haupt_fortsetzung is null then
      raise exception 'Mindestens eine richtige Spielfortsetzung ist erforderlich';
    end if;
  else
    v_fortsetzungen := '{}'::text[];
  end if;

  update public.fragen set
    medium = v_medium,
    bild_base64 = v_bild_base64,
    bild_mime = v_bild_mime,
    bild_alt = v_bild_alt,
    bild_quelle = v_bild_quelle
  where id = v_id;

  update public.frage_entscheidungsloesungen
  set spielfortsetzungen_gueltig = v_fortsetzungen,
      geaendert_am = now()
  where frage_id = v_id;

  return v_id;
end;
$function$;

revoke all on function public.obmann_frage_entscheidung_flex_speichern(text,uuid,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.obmann_frage_entscheidung_flex_speichern(text,uuid,jsonb,jsonb,jsonb)
  to anon, authenticated;

-- Die App erhält die ganze Liste, fällt bei einer älteren Datenbank aber
-- weiterhin auf `spielfortsetzung` zurück.
drop function if exists public.obmann_frage_entscheidungsloesung_details(text, uuid);
create function public.obmann_frage_entscheidungsloesung_details(
  p_passwort text, p_frage_id uuid)
returns table(
  frage_id uuid, spielfortsetzung text, spielfortsetzungen_gueltig text[],
  fortsetzung_fuer text, fortsetzung_ort text,
  persoenliche_strafe text, strafe_fuer_mannschaft text,
  strafe_fuer_rolle text, strafe_rollen_gueltig text[],
  strafe_rueckennummer smallint, strafen jsonb,
  trikot_heim text, trikot_gast text,
  fordert_fortsetzung boolean, fordert_fortsetzung_fuer boolean,
  fordert_fortsetzung_ort boolean, fordert_strafe boolean,
  fordert_strafe_mannschaft boolean, fordert_strafe_rolle boolean,
  fordert_strafe_nummer boolean, zeigt_trikotfarben boolean)
language plpgsql security definer set search_path = public
as $function$
begin
  perform public.obmann_verein(p_passwort);
  return query
  select l.frage_id, l.spielfortsetzung, l.spielfortsetzungen_gueltig,
         l.fortsetzung_fuer, l.fortsetzung_ort,
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
revoke all on function public.obmann_frage_entscheidungsloesung_details(text, uuid)
  from public, anon, authenticated;
grant execute on function public.obmann_frage_entscheidungsloesung_details(text, uuid)
  to anon, authenticated;

-- Wrapper um die bewährte Auswertung: sie bewertet alle übrigen Bestandteile
-- unverändert. Nur die Fortsetzungs-Teilnote wird gegen die neue Liste
-- korrigiert; bei einer richtungslosen Auswahl entfällt die Richtungsnote.
create or replace function public.entscheidung_antwort_speichern_v2(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb,
  p_ort_richtig boolean, p_ort_feedback text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_basis jsonb; v_antwort jsonb; v_loesung jsonb;
  v_fortsetzungen text[]; v_fordert_fortsetzung boolean; v_fordert_richtung boolean;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean;
  v_ziel boolean; v_rolle boolean; v_nummer boolean; v_korrekt boolean;
  v_bereits boolean; v_antwort_id uuid; v_ort_text text;
begin
  select l.spielfortsetzungen_gueltig, l.fordert_fortsetzung, l.fordert_fortsetzung_fuer
  into v_fortsetzungen, v_fordert_fortsetzung, v_fordert_richtung
  from public.frage_entscheidungsloesungen l where l.frage_id = p_frage_id;

  v_basis := public.entscheidung_antwort_speichern(
    p_schiedsrichter_id, p_frage_id, p_pin, p_antwort,
    p_ort_richtig, p_ort_feedback);

  v_antwort := coalesce(v_basis->'antwort', p_antwort);
  v_loesung := coalesce(v_basis->'loesung', '{}'::jsonb)
    || jsonb_build_object('spielfortsetzungen_gueltig', to_jsonb(v_fortsetzungen));
  v_bereits := coalesce((v_basis->>'bereits_beantwortet')::boolean, false);
  v_fort := case when v_fordert_fortsetzung
    then v_antwort->>'spielfortsetzung' = any(v_fortsetzungen) end;
  v_richtung := (v_basis #>> '{ergebnis,richtung_richtig}')::boolean;
  if v_fordert_richtung
     and coalesce(v_antwort->>'spielfortsetzung', '') in ('weiterspielen', 'sr_ball') then
    v_richtung := null;
  end if;
  v_ort := (v_basis #>> '{ergebnis,ort_richtig}')::boolean;
  v_strafe := (v_basis #>> '{ergebnis,strafe_richtig}')::boolean;
  v_ziel := (v_basis #>> '{ergebnis,strafziel_richtig}')::boolean;
  v_rolle := (v_basis #>> '{ergebnis,rolle_richtig}')::boolean;
  v_nummer := (v_basis #>> '{ergebnis,rueckennummer_richtig}')::boolean;
  v_ort_text := v_basis #>> '{ergebnis,ort_feedback}';
  v_korrekt := coalesce(v_fort, true) and coalesce(v_richtung, true)
    and coalesce(v_ort, true) and coalesce(v_strafe, true)
    and coalesce(v_ziel, true) and coalesce(v_rolle, true)
    and coalesce(v_nummer, true);

  select a.id into v_antwort_id from public.antworten a
  where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
  if v_antwort_id is not null then
    update public.antwort_entscheidungen set
      loesung_snapshot = v_loesung,
      fortsetzung_richtig = v_fort,
      richtung_richtig = v_richtung
    where antwort_id = v_antwort_id;
    update public.antworten set
      korrekt = v_korrekt,
      bewertungsstatus = case when v_korrekt then 'richtig' else 'falsch' end
    where id = v_antwort_id;
  end if;

  return public.entscheidung_ergebnis_bauen(
    v_antwort, v_loesung, v_bereits,
    v_fort, v_richtung, v_ort, v_strafe, v_ziel, v_rolle, v_nummer, v_ort_text);
end;
$function$;
revoke all on function public.entscheidung_antwort_speichern_v2(uuid,uuid,text,jsonb,boolean,text)
  from public, anon, authenticated;
grant execute on function public.entscheidung_antwort_speichern_v2(uuid,uuid,text,jsonb,boolean,text)
  to service_role;

-- Gleiche Regel im Duell. Die bestehende Funktion erledigt Validierung und
-- Speichern, anschließend werden Teilnote, Gesamtstatus und Verlauf atomar
-- auf die Liste zulässiger Fortsetzungen korrigiert.
create or replace function public.duell_entscheidung_speichern_v2(
  p_zugang uuid, p_frage_id uuid, p_antwort jsonb,
  p_ort_richtig boolean, p_ort_feedback text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_basis jsonb; v_antwort jsonb; v_loesung jsonb; v_rueckgabe jsonb;
  v_fortsetzungen text[]; v_fordert_fortsetzung boolean; v_fordert_richtung boolean;
  v_fort boolean; v_richtung boolean; v_ort boolean; v_strafe boolean;
  v_ziel boolean; v_rolle boolean; v_nummer boolean; v_korrekt boolean;
  v_tid uuid; v_ort_text text;
begin
  if current_user not in ('service_role', 'postgres') then raise exception 'Nicht erlaubt'; end if;
  select l.spielfortsetzungen_gueltig, l.fordert_fortsetzung, l.fordert_fortsetzung_fuer
  into v_fortsetzungen, v_fordert_fortsetzung, v_fordert_richtung
  from public.frage_entscheidungsloesungen l where l.frage_id = p_frage_id;

  v_basis := public.duell_entscheidung_speichern(
    p_zugang, p_frage_id, p_antwort, p_ort_richtig, p_ort_feedback);
  v_antwort := coalesce(v_basis->'antwort', p_antwort);
  v_loesung := coalesce(v_basis->'loesung', '{}'::jsonb)
    || jsonb_build_object('spielfortsetzungen_gueltig', to_jsonb(v_fortsetzungen));
  v_fort := case when v_fordert_fortsetzung
    then v_antwort->>'spielfortsetzung' = any(v_fortsetzungen) end;
  v_richtung := (v_basis #>> '{ergebnis,richtung_richtig}')::boolean;
  if v_fordert_richtung
     and coalesce(v_antwort->>'spielfortsetzung', '') in ('weiterspielen', 'sr_ball') then
    v_richtung := null;
  end if;
  v_ort := (v_basis #>> '{ergebnis,ort_richtig}')::boolean;
  v_strafe := (v_basis #>> '{ergebnis,strafe_richtig}')::boolean;
  v_ziel := (v_basis #>> '{ergebnis,strafziel_richtig}')::boolean;
  v_rolle := (v_basis #>> '{ergebnis,rolle_richtig}')::boolean;
  v_nummer := (v_basis #>> '{ergebnis,rueckennummer_richtig}')::boolean;
  v_ort_text := v_basis #>> '{ergebnis,ort_feedback}';
  v_korrekt := coalesce(v_fort, true) and coalesce(v_richtung, true)
    and coalesce(v_ort, true) and coalesce(v_strafe, true)
    and coalesce(v_ziel, true) and coalesce(v_rolle, true)
    and coalesce(v_nummer, true);

  v_rueckgabe := public.entscheidung_ergebnis_bauen(
    v_antwort, v_loesung, false,
    v_fort, v_richtung, v_ort, v_strafe, v_ziel, v_rolle, v_nummer, v_ort_text);

  select t.id into v_tid from public.duell_teilnehmer t where t.zugang = p_zugang;
  update public.duell_antworten set
    korrekt = v_korrekt,
    bewertungsstatus = case when v_korrekt then 'richtig' else 'falsch' end,
    gegebene_details = jsonb_set(
      jsonb_set(gegebene_details, '{loesung}', v_loesung, true),
      '{ergebnis}', v_rueckgabe->'ergebnis', true)
  where teilnehmer_id = v_tid and frage_id = p_frage_id;

  return v_rueckgabe;
end;
$function$;
revoke all on function public.duell_entscheidung_speichern_v2(uuid,uuid,jsonb,boolean,text)
  from public, anon, authenticated;
grant execute on function public.duell_entscheidung_speichern_v2(uuid,uuid,jsonb,boolean,text)
  to service_role;
