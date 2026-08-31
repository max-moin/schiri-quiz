-- v100_wochenquiz_icon_antworten (31.08.2026)
-- Bindet die mit v99 editierbaren Icon-Entscheidungen an das Wochenquiz an.
-- Die Loesung bleibt geschuetzt; freie Ortsangaben werden serverseitig
-- semantisch geprueft und erst danach atomar gespeichert.

create table if not exists public.antwort_entscheidungen (
  antwort_id uuid primary key references public.antworten(id) on delete cascade,
  gegebene_antwort jsonb not null,
  loesung_snapshot jsonb not null,
  fortsetzung_richtig boolean not null,
  richtung_richtig boolean not null,
  ort_richtig boolean not null,
  strafe_richtig boolean not null,
  strafziel_richtig boolean not null,
  rolle_richtig boolean not null,
  rueckennummer_richtig boolean not null,
  ort_feedback text,
  erstellt_am timestamptz not null default now(),
  constraint antwort_entscheidung_gegeben_objekt check (jsonb_typeof(gegebene_antwort) = 'object'),
  constraint antwort_entscheidung_loesung_objekt check (jsonb_typeof(loesung_snapshot) = 'object')
);

comment on table public.antwort_entscheidungen is
  'Detailauswertung strukturierter Icon-Antworten; direkter Zugriff ist gesperrt.';
alter table public.antwort_entscheidungen enable row level security;
revoke all on public.antwort_entscheidungen from public, anon, authenticated;

alter table public.fragen drop constraint if exists fragen_icon_erst_nach_player_aktiv;

create or replace function public.entscheidung_anzeige(p_wert jsonb)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select concat_ws(
    ' · ',
    case p_wert->>'spielfortsetzung'
      when 'weiterspielen' then 'Weiterspielen'
      when 'direkter_freistoss' then 'Direkter Freistoss'
      when 'indirekter_freistoss' then 'Indirekter Freistoss'
      when 'strafstoss' then 'Strafstoss'
      when 'sr_ball' then 'Schiedsrichter-Ball'
      when 'eckstoss' then 'Eckstoss'
      when 'abstoss' then 'Abstoss'
      when 'einwurf' then 'Einwurf'
      when 'anstoss' then 'Anstoss'
      else coalesce(p_wert->>'spielfortsetzung', 'Keine Spielfortsetzung')
    end || case when nullif(p_wert->>'fortsetzung_fuer', '') is not null
      then ' fuer ' || case p_wert->>'fortsetzung_fuer'
        when 'heim' then 'Heim' when 'gast' then 'Gast' else p_wert->>'fortsetzung_fuer' end
      else '' end,
    case when nullif(p_wert->>'fortsetzung_ort', '') is not null
       and p_wert->>'spielfortsetzung' <> 'weiterspielen'
      then 'Ort: ' || (p_wert->>'fortsetzung_ort') else null end,
    case p_wert->>'persoenliche_strafe'
      when 'keine' then 'Keine persoenliche Strafe'
      when 'gelb' then 'Gelbe Karte'
      when 'gelb_rot' then 'Gelb-Rote Karte'
      when 'rot' then 'Rote Karte'
      else coalesce(p_wert->>'persoenliche_strafe', 'Keine Strafangabe')
    end || case when nullif(p_wert->>'strafe_fuer_mannschaft', '') is not null
      then ' fuer ' || case p_wert->>'strafe_fuer_mannschaft'
        when 'heim' then 'Heim' when 'gast' then 'Gast' else p_wert->>'strafe_fuer_mannschaft' end
      else '' end
      || case when nullif(p_wert->>'strafe_fuer_rolle', '') is not null
        then ' (' || case p_wert->>'strafe_fuer_rolle'
          when 'feldspieler' then 'Feldspieler'
          when 'torwart' then 'Torwart'
          when 'auswechselspieler' then 'Auswechselspieler'
          when 'trainer' then 'Trainer/Betreuer'
          else p_wert->>'strafe_fuer_rolle' end
        || case when nullif(p_wert->>'strafe_rueckennummer', '') is not null
          then ', Nr. ' || (p_wert->>'strafe_rueckennummer') else '' end || ')'
        else '' end
  );
$function$;
revoke all on function public.entscheidung_anzeige(jsonb) from public;

-- Neue Icon-Fragen starten aktiv. Beim Bearbeiten bleibt der vorhandene
-- Aktivstatus erhalten, damit ein bewusst deaktivierter Entwurf nicht
-- unbemerkt veroeffentlicht wird.
create or replace function public.obmann_frage_entscheidung_erstellen(
  p_passwort text, p_basis jsonb, p_loesung jsonb
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_frage_id uuid;
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_basis_typ text;
begin
  perform public.obmann_verein(p_passwort);
  if v_medium not in ('text', 'video') then
    raise exception 'Icon-Fragen unterstuetzen derzeit Text oder Video';
  end if;
  v_basis_typ := case when v_medium = 'video' then 'video_mc' else 'multiple_choice' end;
  v_frage_id := public.obmann_frage_erstellen(
    p_passwort => p_passwort, p_frage_text => p_basis->>'frage_text',
    p_regel_nummer => nullif(p_basis->>'regel_nummer', '')::smallint,
    p_schwierigkeit => nullif(p_basis->>'schwierigkeit', '')::smallint,
    p_quelle_typ => nullif(p_basis->>'quelle_typ', ''),
    p_quelle_detail => nullif(p_basis->>'quelle_detail', ''), p_typ => v_basis_typ,
    p_antwort_hinweis => nullif(p_basis->>'antwort_hinweis', ''),
    p_video_url => nullif(p_basis->>'video_url', ''),
    p_video_start_sekunden => nullif(p_basis->>'video_start_sekunden', '')::integer,
    p_video_end_sekunden => nullif(p_basis->>'video_end_sekunden', '')::integer,
    p_video_antworttyp => null,
    p_video_stumm => coalesce((p_basis->>'video_stumm')::boolean, false),
    p_erklaerung_zusatzhinweis => nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
    p_nie_in_rotation => coalesce((p_basis->>'nie_in_rotation')::boolean, false),
    p_medium => v_medium, p_antworttyp => 'multiple_choice'
  );
  update public.fragen set antworttyp = 'entscheidung', typ = 'szenario'
  where id = v_frage_id;
  perform public.frage_entscheidungsloesung_setzen(v_frage_id, p_loesung);
  return v_frage_id;
end;
$function$;
revoke all on function public.obmann_frage_entscheidung_erstellen(text, jsonb, jsonb) from public;
grant execute on function public.obmann_frage_entscheidung_erstellen(text, jsonb, jsonb) to anon, authenticated;

create or replace function public.obmann_frage_entscheidung_bearbeiten(
  p_passwort text, p_frage_id uuid, p_basis jsonb, p_loesung jsonb
) returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_basis_typ text;
begin
  perform public.obmann_verein(p_passwort);
  if v_medium not in ('text', 'video') then
    raise exception 'Icon-Fragen unterstuetzen derzeit Text oder Video';
  end if;
  v_basis_typ := case when v_medium = 'video' then 'video_mc' else 'multiple_choice' end;
  perform public.obmann_frage_bearbeiten(
    p_passwort => p_passwort, p_frage_id => p_frage_id,
    p_frage_text => p_basis->>'frage_text',
    p_regel_nummer => nullif(p_basis->>'regel_nummer', '')::smallint,
    p_schwierigkeit => nullif(p_basis->>'schwierigkeit', '')::smallint,
    p_quelle_typ => nullif(p_basis->>'quelle_typ', ''),
    p_quelle_detail => nullif(p_basis->>'quelle_detail', ''), p_typ => v_basis_typ,
    p_antwort_hinweis => nullif(p_basis->>'antwort_hinweis', ''),
    p_video_url => nullif(p_basis->>'video_url', ''),
    p_video_start_sekunden => nullif(p_basis->>'video_start_sekunden', '')::integer,
    p_video_end_sekunden => nullif(p_basis->>'video_end_sekunden', '')::integer,
    p_video_antworttyp => null,
    p_video_stumm => coalesce((p_basis->>'video_stumm')::boolean, false),
    p_erklaerung_zusatzhinweis => nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
    p_nie_in_rotation => coalesce((p_basis->>'nie_in_rotation')::boolean, false),
    p_medium => v_medium, p_antworttyp => 'multiple_choice'
  );
  update public.fragen set antworttyp = 'entscheidung', typ = 'szenario'
  where id = p_frage_id;
  if not found then raise exception 'Frage nicht gefunden'; end if;
  perform public.frage_entscheidungsloesung_setzen(p_frage_id, p_loesung);
end;
$function$;
revoke all on function public.obmann_frage_entscheidung_bearbeiten(text, uuid, jsonb, jsonb) from public;
grant execute on function public.obmann_frage_entscheidung_bearbeiten(text, uuid, jsonb, jsonb) to anon, authenticated;

create or replace function public.entscheidung_kontext_laden(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text
) returns table(frage_text text, fortsetzung_ort text)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_pin text; v_aktiv boolean; v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then
    raise exception 'PIN falsch';
  end if;
  return query
  select f.frage_text, l.fortsetzung_ort
  from public.fragen f
  join public.frage_entscheidungsloesungen l on l.frage_id = f.id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;
end;
$function$;
revoke all on function public.entscheidung_kontext_laden(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.entscheidung_kontext_laden(uuid, uuid, text) to service_role;

create or replace function public.entscheidung_antwort_speichern(
  p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_antwort jsonb,
  p_ort_richtig boolean, p_ort_feedback text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_pin text; v_aktiv boolean; v_ist_test boolean; v_verein uuid;
  v_loesung public.frage_entscheidungsloesungen%rowtype;
  v_loesung_json jsonb; v_antwort_id uuid;
  v_alt public.antwort_entscheidungen%rowtype;
  v_fortsetzung_ok boolean; v_richtung_ok boolean; v_ort_ok boolean;
  v_strafe_ok boolean; v_strafziel_ok boolean; v_rolle_ok boolean;
  v_nummer_ok boolean; v_korrekt boolean;
begin
  select s.pin, s.aktiv, s.ist_test, s.verein_id
  into v_pin, v_aktiv, v_ist_test, v_verein
  from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then raise exception 'PIN falsch'; end if;
  if jsonb_typeof(p_antwort) <> 'object' then raise exception 'Antwort ungueltig'; end if;
  if p_antwort->>'spielfortsetzung' is null or p_antwort->>'spielfortsetzung' not in ('weiterspielen','direkter_freistoss','indirekter_freistoss','strafstoss','sr_ball','eckstoss','abstoss','einwurf','anstoss') then raise exception 'Spielfortsetzung ungueltig'; end if;
  if p_antwort->>'persoenliche_strafe' is null or p_antwort->>'persoenliche_strafe' not in ('keine','gelb','gelb_rot','rot') then raise exception 'Persoenliche Strafe ungueltig'; end if;

  select l.* into v_loesung
  from public.frage_entscheidungsloesungen l
  join public.fragen f on f.id = l.frage_id
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  where f.id = p_frage_id and f.aktiv and f.antworttyp = 'entscheidung'
    and now() between r.startet_am and r.endet_am;
  if not found then raise exception 'Frage nicht gefunden oder aktuell nicht aktiv'; end if;

  select ae.* into v_alt from public.antworten a
  join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
  if found then
    return jsonb_build_object('korrekt', (v_alt.fortsetzung_richtig and v_alt.richtung_richtig and v_alt.ort_richtig and v_alt.strafe_richtig and v_alt.strafziel_richtig and v_alt.rolle_richtig and v_alt.rueckennummer_richtig), 'bereits_beantwortet', true, 'antwort', v_alt.gegebene_antwort, 'loesung', v_alt.loesung_snapshot, 'ergebnis', jsonb_build_object('fortsetzung_richtig', v_alt.fortsetzung_richtig, 'richtung_richtig', v_alt.richtung_richtig, 'ort_richtig', v_alt.ort_richtig, 'strafe_richtig', v_alt.strafe_richtig, 'strafziel_richtig', v_alt.strafziel_richtig, 'rolle_richtig', v_alt.rolle_richtig, 'rueckennummer_richtig', v_alt.rueckennummer_richtig, 'ort_feedback', v_alt.ort_feedback));
  end if;

  v_loesung_json := jsonb_build_object('spielfortsetzung', v_loesung.spielfortsetzung, 'fortsetzung_fuer', v_loesung.fortsetzung_fuer, 'fortsetzung_ort', v_loesung.fortsetzung_ort, 'persoenliche_strafe', v_loesung.persoenliche_strafe, 'strafe_fuer_mannschaft', v_loesung.strafe_fuer_mannschaft, 'strafe_fuer_rolle', v_loesung.strafe_fuer_rolle, 'strafe_rueckennummer', v_loesung.strafe_rueckennummer);
  v_fortsetzung_ok := p_antwort->>'spielfortsetzung' = v_loesung.spielfortsetzung;
  v_richtung_ok := coalesce(nullif(p_antwort->>'fortsetzung_fuer', ''), '') = coalesce(v_loesung.fortsetzung_fuer, '');
  v_ort_ok := case when v_loesung.spielfortsetzung = 'weiterspielen' then true else coalesce(p_ort_richtig, false) end;
  v_strafe_ok := p_antwort->>'persoenliche_strafe' = v_loesung.persoenliche_strafe;
  v_strafziel_ok := coalesce(nullif(p_antwort->>'strafe_fuer_mannschaft', ''), '') = coalesce(v_loesung.strafe_fuer_mannschaft, '');
  v_rolle_ok := coalesce(nullif(p_antwort->>'strafe_fuer_rolle', ''), '') = coalesce(v_loesung.strafe_fuer_rolle, '');
  v_nummer_ok := v_loesung.strafe_rueckennummer is null or nullif(p_antwort->>'strafe_rueckennummer', '')::smallint = v_loesung.strafe_rueckennummer;
  v_korrekt := v_fortsetzung_ok and v_richtung_ok and v_ort_ok and v_strafe_ok and v_strafziel_ok and v_rolle_ok and v_nummer_ok;

  if not v_ist_test then
    insert into public.antworten (schiedsrichter_id, frage_id, gegebene_option, korrekt, gegebener_freitext, ki_feedback, bewertungsstatus, versuch_anzahl)
    values (p_schiedsrichter_id, p_frage_id, null, v_korrekt, public.entscheidung_anzeige(p_antwort), nullif(btrim(p_ort_feedback), ''), case when v_korrekt then 'richtig' else 'falsch' end, 1)
    on conflict (schiedsrichter_id, frage_id) do nothing returning id into v_antwort_id;
    if v_antwort_id is null then
      select ae.* into v_alt from public.antworten a join public.antwort_entscheidungen ae on ae.antwort_id = a.id where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id;
      if found then
        return jsonb_build_object('korrekt', (v_alt.fortsetzung_richtig and v_alt.richtung_richtig and v_alt.ort_richtig and v_alt.strafe_richtig and v_alt.strafziel_richtig and v_alt.rolle_richtig and v_alt.rueckennummer_richtig), 'bereits_beantwortet', true, 'antwort', v_alt.gegebene_antwort, 'loesung', v_alt.loesung_snapshot, 'ergebnis', jsonb_build_object('fortsetzung_richtig', v_alt.fortsetzung_richtig, 'richtung_richtig', v_alt.richtung_richtig, 'ort_richtig', v_alt.ort_richtig, 'strafe_richtig', v_alt.strafe_richtig, 'strafziel_richtig', v_alt.strafziel_richtig, 'rolle_richtig', v_alt.rolle_richtig, 'rueckennummer_richtig', v_alt.rueckennummer_richtig, 'ort_feedback', v_alt.ort_feedback));
      end if;
      raise exception 'Antwort konnte nicht gespeichert werden';
    end if;
    insert into public.antwort_entscheidungen (antwort_id, gegebene_antwort, loesung_snapshot, fortsetzung_richtig, richtung_richtig, ort_richtig, strafe_richtig, strafziel_richtig, rolle_richtig, rueckennummer_richtig, ort_feedback)
    values (v_antwort_id, p_antwort, v_loesung_json, v_fortsetzung_ok, v_richtung_ok, v_ort_ok, v_strafe_ok, v_strafziel_ok, v_rolle_ok, v_nummer_ok, nullif(btrim(p_ort_feedback), ''));
  end if;

  return jsonb_build_object('korrekt', v_korrekt, 'bereits_beantwortet', false, 'antwort', p_antwort, 'loesung', v_loesung_json, 'ergebnis', jsonb_build_object('fortsetzung_richtig', v_fortsetzung_ok, 'richtung_richtig', v_richtung_ok, 'ort_richtig', v_ort_ok, 'strafe_richtig', v_strafe_ok, 'strafziel_richtig', v_strafziel_ok, 'rolle_richtig', v_rolle_ok, 'rueckennummer_richtig', v_nummer_ok, 'ort_feedback', nullif(btrim(p_ort_feedback), '')));
end;
$function$;
revoke all on function public.entscheidung_antwort_speichern(uuid, uuid, text, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.entscheidung_antwort_speichern(uuid, uuid, text, jsonb, boolean, text) to service_role;

drop function if exists public.wochen_fragen(uuid, text);
create function public.wochen_fragen(p_schiedsrichter_id uuid, p_pin text)
returns table(id uuid, frage_text text, option_a text, option_b text, option_c text, regel_nummer smallint, regel_bezeichnung text, schwierigkeit smallint, "position" integer, typ text, antwort_hinweis text, video_url text, video_start_sekunden integer, video_end_sekunden integer, video_antworttyp text, video_stumm boolean, frage_nummer integer, medium text, antworttyp text, entscheidung_darstellung jsonb)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_pin text; v_aktiv boolean; v_verein uuid;
begin
  select s.pin, s.aktiv, s.verein_id into v_pin, v_aktiv, v_verein from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then raise exception 'PIN falsch'; end if;
  return query
  select f.id, f.frage_text, f.option_a, f.option_b, f.option_c, f.regel_nummer, reg.bezeichnung, f.schwierigkeit, rf."position", f.typ, f.antwort_hinweis, f.video_url, f.video_start_sekunden, f.video_end_sekunden, f.video_antworttyp, f.video_stumm, nr.frage_nummer, f.medium, f.antworttyp,
    case when f.antworttyp = 'entscheidung' then jsonb_build_object('trikot_heim', l.trikot_heim, 'trikot_gast', l.trikot_gast) else null end
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  join public.wochen_frage_nummern nr on nr.verein_id = rf.verein_id and nr.frage_id = rf.frage_id
  left join public.regeln reg on reg.nummer = f.regel_nummer
  left join public.frage_entscheidungsloesungen l on l.frage_id = f.id
  where now() between r.startet_am and r.endet_am and f.aktiv and (f.antworttyp <> 'entscheidung' or l.frage_id is not null)
  order by nr.frage_nummer nulls last, f.erstellt_am;
end;
$function$;
revoke all on function public.wochen_fragen(uuid, text) from public;
grant execute on function public.wochen_fragen(uuid, text) to anon, authenticated;

drop function if exists public.meine_antworten(uuid, text);
create function public.meine_antworten(p_schiedsrichter_id uuid, p_pin text)
returns table(frage_id uuid, beantwortet boolean, gegebene_option text, korrekt boolean, richtige_option text, gegebener_freitext text, ki_feedback text, musterantwort text, bewertungsstatus text, nachbesserung_offen boolean, zweiter_freitext text, ki_nachfrage text, entscheidung jsonb)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_pin text; v_verein uuid;
begin
  select s.pin, s.verein_id into v_pin, v_verein from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin then raise exception 'PIN falsch'; end if;
  return query
  select f.id, (a.id is not null), a.gegebene_option, a.korrekt,
    case when a.id is not null and a.bewertungsstatus <> 'nachbessern' then f.richtige_option else null end,
    a.gegebener_freitext, coalesce(a.ki_feedback_final, a.ki_feedback),
    case when a.id is not null and a.bewertungsstatus <> 'nachbessern' then f.musterantwort else null end,
    a.bewertungsstatus, (a.bewertungsstatus = 'nachbessern'), a.zweiter_freitext, a.ki_nachfrage,
    case when ae.antwort_id is not null then jsonb_build_object('antwort', ae.gegebene_antwort, 'loesung', ae.loesung_snapshot, 'ergebnis', jsonb_build_object('fortsetzung_richtig', ae.fortsetzung_richtig, 'richtung_richtig', ae.richtung_richtig, 'ort_richtig', ae.ort_richtig, 'strafe_richtig', ae.strafe_richtig, 'strafziel_richtig', ae.strafziel_richtig, 'rolle_richtig', ae.rolle_richtig, 'rueckennummer_richtig', ae.rueckennummer_richtig, 'ort_feedback', ae.ort_feedback)) else null end
  from public.fragen f
  join public.runden_fragen rf on rf.frage_id = f.id and rf.verein_id = v_verein
  join public.runden r on r.id = rf.runde_id
  left join public.antworten a on a.frage_id = f.id and a.schiedsrichter_id = p_schiedsrichter_id
  left join public.antwort_entscheidungen ae on ae.antwort_id = a.id
  where now() between r.startet_am and r.endet_am and f.aktiv;
end;
$function$;
revoke all on function public.meine_antworten(uuid, text) from public;
grant execute on function public.meine_antworten(uuid, text) to anon, authenticated;

create or replace function public.erklaerung_kontext_laden(p_schiedsrichter_id uuid, p_frage_id uuid, p_pin text, p_historie boolean default false)
returns table(frage_text text, typ text, option_a text, option_b text, option_c text, richtige_option text, musterantwort text, bewertungshinweise text, gegebene_option text, gegebener_freitext text, korrekt boolean, erklaerung_zusatzhinweis text)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_pin text; v_aktiv boolean;
begin
  select s.pin, s.aktiv into v_pin, v_aktiv from public.schiedsrichter s where s.id = p_schiedsrichter_id;
  if v_pin is null or v_pin <> p_pin or not coalesce(v_aktiv, false) then raise exception 'PIN falsch'; end if;
  if not p_historie and exists (select 1 from public.antworten a where a.schiedsrichter_id = p_schiedsrichter_id and a.frage_id = p_frage_id and a.bewertungsstatus = 'nachbessern') then raise exception 'Erklaerung erst nach der Ergaenzung verfuegbar'; end if;
  if p_historie then
    return query select f.frage_text, f.typ, f.option_a, f.option_b, f.option_c, f.richtige_option, f.musterantwort, f.bewertungshinweise, a.gegebene_option, a.gegebener_freitext, a.korrekt, f.erklaerung_zusatzhinweis
    from public.fragen f join public.historie_antworten a on a.frage_id = f.id and a.schiedsrichter_id = p_schiedsrichter_id where f.id = p_frage_id order by a.beantwortet_am desc limit 1;
  else
    return query select f.frage_text, case when f.antworttyp = 'entscheidung' then 'entscheidung' else f.typ end, f.option_a, f.option_b, f.option_c, f.richtige_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.loesung_snapshot) else f.musterantwort end,
      f.bewertungshinweise, a.gegebene_option,
      case when ae.antwort_id is not null then public.entscheidung_anzeige(ae.gegebene_antwort) else a.gegebener_freitext end,
      a.korrekt, f.erklaerung_zusatzhinweis
    from public.fragen f join public.antworten a on a.frage_id = f.id and a.schiedsrichter_id = p_schiedsrichter_id
    left join public.antwort_entscheidungen ae on ae.antwort_id = a.id where f.id = p_frage_id;
  end if;
  if not found then raise exception 'Frage wurde noch nicht beantwortet oder existiert nicht'; end if;
end;
$function$;
revoke all on function public.erklaerung_kontext_laden(uuid, uuid, text, boolean) from public;
grant execute on function public.erklaerung_kontext_laden(uuid, uuid, text, boolean) to service_role;

-- Bestehende Icon-Entwuerfe bleiben deaktiviert und koennen nach Sichtpruefung
-- im Themen-Tab mit dem Augen-Symbol aktiviert werden.
