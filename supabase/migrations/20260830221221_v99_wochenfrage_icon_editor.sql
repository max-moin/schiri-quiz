-- v99_wochenfrage_icon_editor (30.08.2026)
--
-- Eine normale Wochenfrage kann ab jetzt eine strukturierte Icon-Antwort
-- besitzen. Die richtige Entscheidung liegt absichtlich NICHT in `fragen`:
-- `wochen_fragen` liefert aus dieser Tabelle an den Browser aus. Eine eigene,
-- für anon/authenticated gesperrte Lösungstabelle verhindert, dass ein später
-- versehentliches `select *` die richtige Antwort verrät.
--
-- Der normale Wochenquiz-Player kann diese Antwortform noch nicht darstellen
-- oder prüfen. Deshalb erzwingt die Datenbank vorerst `aktiv = false`. Der
-- Obmann kann Fragen schon vollständig anlegen und bearbeiten, ohne dass ein
-- unfertiger Datensatz in der laufenden Woche erscheint. Die Sperre wird erst
-- mit der späteren Player-/Prüf-RPC-Migration entfernt.

create table if not exists public.frage_entscheidungsloesungen (
  frage_id uuid primary key
    references public.fragen(id) on delete cascade,
  spielfortsetzung text not null,
  fortsetzung_fuer text,
  fortsetzung_ort text not null,
  persoenliche_strafe text not null,
  strafe_fuer_mannschaft text,
  strafe_fuer_rolle text,
  strafe_rueckennummer smallint,
  trikot_heim text not null default '#e4032e',
  trikot_gast text not null default '#1d4ed8',
  geaendert_am timestamptz not null default now(),

  constraint frage_entscheidung_fortsetzung_gueltig check (spielfortsetzung in (
    'weiterspielen', 'direkter_freistoss', 'indirekter_freistoss',
    'strafstoss', 'sr_ball', 'eckstoss', 'abstoss', 'einwurf', 'anstoss'
  )),
  constraint frage_entscheidung_strafe_gueltig check (
    persoenliche_strafe in ('keine', 'gelb', 'gelb_rot', 'rot')
  ),
  constraint frage_entscheidung_mannschaft_gueltig check (
    fortsetzung_fuer is null or fortsetzung_fuer in ('heim', 'gast')
  ),
  constraint frage_entscheidung_strafmannschaft_gueltig check (
    strafe_fuer_mannschaft is null or strafe_fuer_mannschaft in ('heim', 'gast')
  ),
  constraint frage_entscheidung_rolle_gueltig check (
    strafe_fuer_rolle is null or strafe_fuer_rolle in
      ('feldspieler', 'torwart', 'auswechselspieler', 'trainer')
  ),
  constraint frage_entscheidung_rueckennummer_gueltig check (
    strafe_rueckennummer is null or strafe_rueckennummer between 1 and 99
  ),
  constraint frage_entscheidung_ort_nicht_leer check (
    btrim(fortsetzung_ort) <> ''
  ),
  constraint frage_entscheidung_richtung_konsistent check (
    case when spielfortsetzung in ('weiterspielen', 'sr_ball')
         then fortsetzung_fuer is null
         else fortsetzung_fuer is not null end
  ),
  constraint frage_entscheidung_strafziel_konsistent check (
    case when persoenliche_strafe = 'keine'
         then strafe_fuer_mannschaft is null
              and strafe_fuer_rolle is null
              and strafe_rueckennummer is null
         else strafe_fuer_mannschaft is not null
              and strafe_fuer_rolle is not null end
  ),
  constraint frage_entscheidung_trikot_heim_gueltig check (
    trikot_heim ~ '^#[0-9a-fA-F]{6}$'
  ),
  constraint frage_entscheidung_trikot_gast_gueltig check (
    trikot_gast ~ '^#[0-9a-fA-F]{6}$'
  )
);

comment on table public.frage_entscheidungsloesungen is
  'Geschuetzte richtige Icon-Antwort einer normalen Wochenfrage. Nicht an Spieler ausliefern; Auswertung muss spaeter serverseitig erfolgen.';
comment on column public.frage_entscheidungsloesungen.fortsetzung_ort is
  'Regeltechnisch genauer Ausfuehrungsort als Freitext, z.B. wo der Ball zuletzt gespielt wurde.';

alter table public.frage_entscheidungsloesungen enable row level security;
revoke all on public.frage_entscheidungsloesungen from public, anon, authenticated;

alter table public.fragen
  add constraint fragen_icon_erst_nach_player_aktiv
  check (antworttyp <> 'entscheidung' or aktiv = false);

comment on constraint fragen_icon_erst_nach_player_aktiv on public.fragen is
  'Temporäre Freigabesperre: normale Wochenquiz-RPCs kennen die Icon-Antwort noch nicht. Mit der Player-Migration ersetzen.';

-- Wechselt eine Icon-Frage zurück auf MC/Freitext, darf keine alte richtige
-- Entscheidung als unsichtbare Altlast liegen bleiben. Beim Bearbeiten über
-- die Icon-RPC wird sie innerhalb derselben Transaktion anschließend wieder
-- neu eingesetzt.
create or replace function public.frage_entscheidungsloesung_aufraeumen()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.antworttyp = 'entscheidung' and new.antworttyp <> 'entscheidung' then
    delete from public.frage_entscheidungsloesungen where frage_id = new.id;
  end if;
  return new;
end;
$function$;

revoke all on function public.frage_entscheidungsloesung_aufraeumen() from public;

drop trigger if exists frage_entscheidungsloesung_bei_typwechsel_aufraeumen on public.fragen;
create trigger frage_entscheidungsloesung_bei_typwechsel_aufraeumen
  after update of antworttyp on public.fragen
  for each row execute function public.frage_entscheidungsloesung_aufraeumen();

-- Gemeinsamer interner Upsert. Nicht über die Data API freigegeben.
create or replace function public.frage_entscheidungsloesung_setzen(
  p_frage_id uuid,
  p_loesung jsonb
) returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  insert into public.frage_entscheidungsloesungen (
    frage_id, spielfortsetzung, fortsetzung_fuer, fortsetzung_ort,
    persoenliche_strafe, strafe_fuer_mannschaft, strafe_fuer_rolle,
    strafe_rueckennummer, trikot_heim, trikot_gast, geaendert_am
  ) values (
    p_frage_id,
    p_loesung->>'spielfortsetzung',
    nullif(p_loesung->>'fortsetzung_fuer', ''),
    btrim(p_loesung->>'fortsetzung_ort'),
    p_loesung->>'persoenliche_strafe',
    nullif(p_loesung->>'strafe_fuer_mannschaft', ''),
    nullif(p_loesung->>'strafe_fuer_rolle', ''),
    nullif(p_loesung->>'strafe_rueckennummer', '')::smallint,
    coalesce(nullif(p_loesung->>'trikot_heim', ''), '#e4032e'),
    coalesce(nullif(p_loesung->>'trikot_gast', ''), '#1d4ed8'),
    now()
  )
  on conflict (frage_id) do update set
    spielfortsetzung = excluded.spielfortsetzung,
    fortsetzung_fuer = excluded.fortsetzung_fuer,
    fortsetzung_ort = excluded.fortsetzung_ort,
    persoenliche_strafe = excluded.persoenliche_strafe,
    strafe_fuer_mannschaft = excluded.strafe_fuer_mannschaft,
    strafe_fuer_rolle = excluded.strafe_fuer_rolle,
    strafe_rueckennummer = excluded.strafe_rueckennummer,
    trikot_heim = excluded.trikot_heim,
    trikot_gast = excluded.trikot_gast,
    geaendert_am = now();
end;
$function$;

revoke all on function public.frage_entscheidungsloesung_setzen(uuid, jsonb) from public;

create or replace function public.obmann_frage_entscheidung_erstellen(
  p_passwort text,
  p_basis jsonb,
  p_loesung jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_frage_id uuid;
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_basis_typ text;
begin
  perform public.obmann_verein(p_passwort);

  if v_medium not in ('text', 'video') then
    raise exception 'Icon-Fragen unterstützen derzeit Text oder Video';
  end if;
  v_basis_typ := case when v_medium = 'video' then 'video_mc' else 'multiple_choice' end;

  v_frage_id := public.obmann_frage_erstellen(
    p_passwort => p_passwort,
    p_frage_text => p_basis->>'frage_text',
    p_regel_nummer => nullif(p_basis->>'regel_nummer', '')::smallint,
    p_schwierigkeit => nullif(p_basis->>'schwierigkeit', '')::smallint,
    p_quelle_typ => nullif(p_basis->>'quelle_typ', ''),
    p_quelle_detail => nullif(p_basis->>'quelle_detail', ''),
    p_typ => v_basis_typ,
    p_antwort_hinweis => nullif(p_basis->>'antwort_hinweis', ''),
    p_video_url => nullif(p_basis->>'video_url', ''),
    p_video_start_sekunden => nullif(p_basis->>'video_start_sekunden', '')::integer,
    p_video_end_sekunden => nullif(p_basis->>'video_end_sekunden', '')::integer,
    p_video_antworttyp => null,
    p_video_stumm => coalesce((p_basis->>'video_stumm')::boolean, false),
    p_erklaerung_zusatzhinweis => nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
    p_nie_in_rotation => coalesce((p_basis->>'nie_in_rotation')::boolean, false),
    p_medium => v_medium,
    p_antworttyp => 'multiple_choice'
  );

  update public.fragen
  set antworttyp = 'entscheidung', typ = 'szenario', aktiv = false
  where id = v_frage_id;

  perform public.frage_entscheidungsloesung_setzen(v_frage_id, p_loesung);
  return v_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_entscheidung_erstellen(text, jsonb, jsonb) from public;
grant execute on function public.obmann_frage_entscheidung_erstellen(text, jsonb, jsonb) to anon, authenticated;

create or replace function public.obmann_frage_entscheidung_bearbeiten(
  p_passwort text,
  p_frage_id uuid,
  p_basis jsonb,
  p_loesung jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_medium text := coalesce(nullif(p_basis->>'medium', ''), 'text');
  v_basis_typ text;
begin
  perform public.obmann_verein(p_passwort);

  if v_medium not in ('text', 'video') then
    raise exception 'Icon-Fragen unterstützen derzeit Text oder Video';
  end if;
  v_basis_typ := case when v_medium = 'video' then 'video_mc' else 'multiple_choice' end;

  -- Die bewährte allgemeine RPC bleibt die einzige Stelle für Quelle,
  -- Video und Metadaten. Kurz auf MC umstellen, danach im selben Vorgang
  -- atomar zur geschützten Icon-Lösung wechseln.
  perform public.obmann_frage_bearbeiten(
    p_passwort => p_passwort,
    p_frage_id => p_frage_id,
    p_frage_text => p_basis->>'frage_text',
    p_regel_nummer => nullif(p_basis->>'regel_nummer', '')::smallint,
    p_schwierigkeit => nullif(p_basis->>'schwierigkeit', '')::smallint,
    p_quelle_typ => nullif(p_basis->>'quelle_typ', ''),
    p_quelle_detail => nullif(p_basis->>'quelle_detail', ''),
    p_typ => v_basis_typ,
    p_antwort_hinweis => nullif(p_basis->>'antwort_hinweis', ''),
    p_video_url => nullif(p_basis->>'video_url', ''),
    p_video_start_sekunden => nullif(p_basis->>'video_start_sekunden', '')::integer,
    p_video_end_sekunden => nullif(p_basis->>'video_end_sekunden', '')::integer,
    p_video_antworttyp => null,
    p_video_stumm => coalesce((p_basis->>'video_stumm')::boolean, false),
    p_erklaerung_zusatzhinweis => nullif(p_basis->>'erklaerung_zusatzhinweis', ''),
    p_nie_in_rotation => coalesce((p_basis->>'nie_in_rotation')::boolean, false),
    p_medium => v_medium,
    p_antworttyp => 'multiple_choice'
  );

  update public.fragen
  set antworttyp = 'entscheidung', typ = 'szenario', aktiv = false
  where id = p_frage_id;

  if not found then
    raise exception 'Frage nicht gefunden';
  end if;

  perform public.frage_entscheidungsloesung_setzen(p_frage_id, p_loesung);
end;
$function$;

revoke all on function public.obmann_frage_entscheidung_bearbeiten(text, uuid, jsonb, jsonb) from public;
grant execute on function public.obmann_frage_entscheidung_bearbeiten(text, uuid, jsonb, jsonb) to anon, authenticated;

create or replace function public.obmann_frage_entscheidungsloesung_details(
  p_passwort text,
  p_frage_id uuid
) returns table(
  frage_id uuid,
  spielfortsetzung text,
  fortsetzung_fuer text,
  fortsetzung_ort text,
  persoenliche_strafe text,
  strafe_fuer_mannschaft text,
  strafe_fuer_rolle text,
  strafe_rueckennummer smallint,
  trikot_heim text,
  trikot_gast text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.obmann_verein(p_passwort);

  return query
  select l.frage_id, l.spielfortsetzung, l.fortsetzung_fuer,
         l.fortsetzung_ort, l.persoenliche_strafe,
         l.strafe_fuer_mannschaft, l.strafe_fuer_rolle,
         l.strafe_rueckennummer, l.trikot_heim, l.trikot_gast
  from public.frage_entscheidungsloesungen l
  where l.frage_id = p_frage_id;
end;
$function$;

revoke all on function public.obmann_frage_entscheidungsloesung_details(text, uuid) from public;
grant execute on function public.obmann_frage_entscheidungsloesung_details(text, uuid) to anon, authenticated;
