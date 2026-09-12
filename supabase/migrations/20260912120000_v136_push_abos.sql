-- ============================================================
--  v136 - Abonnements fuer Push-Benachrichtigungen
-- ============================================================
--  Max am 12.09.2026: Seit die Seite auf dem Home-Bildschirm liegt,
--  kann sie auch Benachrichtigungen schicken - auf dem iPhone erst ab
--  iOS 16.4 und NUR im installierten Zustand, auf Android auch im
--  Browser. Diese Migration haelt nur das fest, was der Push-Dienst
--  braucht, um ein Geraet zu erreichen.
--
--  WARUM EINE EIGENE TABELLE UND NICHT EIN FELD AM SCHIEDSRICHTER:
--  Eine Person hat mehrere Geraete (Handy, Tablet, Rechner), und jedes
--  bekommt einen eigenen Endpunkt. Ausserdem ist ein Abo fluechtig: wird
--  die App geloescht oder die Erlaubnis entzogen, antwortet der
--  Push-Dienst mit 404/410 und die Zeile muss weg. Das an einem
--  Personendatensatz zu haengen waere eine dauerhafte Eigenschaft fuer
--  etwas, das kommt und geht.
--
--  DATENSPARSAMKEIT: Es wird NICHT gespeichert, was verschickt wurde,
--  und auch kein Lesezustand. Der Endpunkt ist eine Adresse beim
--  Push-Dienst von Apple oder Google, kein Inhalt. "geraet" ist eine
--  freiwillige Selbstbeschreibung, damit man in der eigenen Uebersicht
--  erkennt, welches Abo welches ist ("iPhone" statt einer 200 Zeichen
--  langen URL) - sie wird vom Browser NICHT ausgelesen, sondern grob
--  aus der Plattform abgeleitet.
-- ============================================================

create table if not exists public.push_abos (
  id uuid primary key default gen_random_uuid(),
  schiedsrichter_id uuid not null references public.schiedsrichter(id) on delete cascade,
  verein_id uuid not null references public.vereine(id) on delete cascade,
  endpunkt text not null,
  p256dh text not null,
  auth text not null,
  geraet text,
  erstellt_am timestamptz not null default now(),
  zuletzt_bestaetigt timestamptz not null default now(),
  constraint push_abos_endpunkt_eindeutig unique (endpunkt)
);

create index if not exists push_abos_schiedsrichter_idx
  on public.push_abos (schiedsrichter_id);

-- Wie alle Datentabellen hier: RLS an, keine Policy. Der Zugang laeuft
-- ausschliesslich ueber die SECURITY-DEFINER-Funktionen unten.
alter table public.push_abos enable row level security;
revoke all on table public.push_abos from public;
revoke all on table public.push_abos from anon;
revoke all on table public.push_abos from authenticated;

-- ---------- Fuer die angemeldete Person ----------

create or replace function public.push_abo_speichern(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_endpunkt text,
  p_p256dh text,
  p_auth text,
  p_geraet text default null
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
begin
  v_verein := public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);

  if coalesce(length(p_endpunkt), 0) < 20 or p_endpunkt !~ '^https://' then
    raise exception 'Ungültiger Push-Endpunkt';
  end if;
  if coalesce(length(p_p256dh), 0) < 20 or coalesce(length(p_auth), 0) < 10 then
    raise exception 'Unvollständige Push-Schlüssel';
  end if;

  -- Derselbe Endpunkt kann nach einem Geraetewechsel einer anderen
  -- Person gehoeren: der Browser vergibt ihn neu, nicht wir. Deshalb
  -- wird beim Zusammenstoss der Besitzer mit uebernommen und nicht
  -- stur die alte Zuordnung behalten.
  insert into public.push_abos (schiedsrichter_id, verein_id, endpunkt, p256dh, auth, geraet)
  values (p_schiedsrichter_id, v_verein, p_endpunkt, p_p256dh, p_auth, nullif(left(coalesce(p_geraet, ''), 60), ''))
  on conflict (endpunkt) do update
    set schiedsrichter_id = excluded.schiedsrichter_id,
        verein_id = excluded.verein_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        geraet = coalesce(excluded.geraet, public.push_abos.geraet),
        zuletzt_bestaetigt = now();

  return jsonb_build_object('gespeichert', true);
end;
$$;

create or replace function public.push_abo_loeschen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_endpunkt text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  delete from public.push_abos
   where endpunkt = p_endpunkt
     and schiedsrichter_id = p_schiedsrichter_id;
  return jsonb_build_object('geloescht', true);
end;
$$;

-- Sagt dem Browser, ob GENAU DIESES Geraet angemeldet ist. Ohne das
-- kann die Seite nach einem Neustart nicht wissen, ob der Schalter an
-- oder aus stehen muss - die Browsererlaubnis allein sagt es nicht,
-- denn die kann erteilt und das Abo trotzdem geloescht sein.
create or replace function public.push_abo_status(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_endpunkt text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_da boolean;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select exists(
    select 1 from public.push_abos
     where endpunkt = p_endpunkt and schiedsrichter_id = p_schiedsrichter_id
  ) into v_da;
  return jsonb_build_object('angemeldet', coalesce(v_da, false));
end;
$$;

-- ---------- Nur fuer den Versandweg (Serverschluessel) ----------

create or replace function public.push_abos_holen(
  p_alle boolean default true,
  p_schiedsrichter uuid[] default null
) returns table(id uuid, endpunkt text, p256dh text, auth text)
language plpgsql
security definer
set search_path to ''
as $$
begin
  return query
  select a.id, a.endpunkt, a.p256dh, a.auth
    from public.push_abos a
   where coalesce(p_alle, true)
      or (p_schiedsrichter is not null and a.schiedsrichter_id = any(p_schiedsrichter));
end;
$$;

create or replace function public.push_abo_entfernen(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  delete from public.push_abos where id = p_id;
  return jsonb_build_object('entfernt', true);
end;
$$;

-- ---------- Rechte ----------
-- Erst alles entziehen, dann gezielt freigeben. Die beiden
-- Versandfunktionen bleiben dem Serverschluessel vorbehalten: mit
-- "push_abos_holen" bekaeme sonst jeder Besucher die Push-Adressen
-- aller Mitglieder, und das ist ein Verteiler.

revoke all on function public.push_abo_speichern(uuid, text, text, text, text, text) from public;
revoke all on function public.push_abo_loeschen(uuid, text, text) from public;
revoke all on function public.push_abo_status(uuid, text, text) from public;
revoke all on function public.push_abos_holen(boolean, uuid[]) from public;
revoke all on function public.push_abo_entfernen(uuid) from public;

grant execute on function public.push_abo_speichern(uuid, text, text, text, text, text) to anon;
grant execute on function public.push_abo_loeschen(uuid, text, text) to anon;
grant execute on function public.push_abo_status(uuid, text, text) to anon;

grant execute on function public.push_abos_holen(boolean, uuid[]) to service_role;
grant execute on function public.push_abo_entfernen(uuid) to service_role;
