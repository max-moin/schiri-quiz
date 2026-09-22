-- Eine Mail pro Vorlage, nicht pro Ausruestungsposition. Die Adresse ist
-- optional und gehoert zu einem einzelnen, widerrufbaren Freigabezugang.
alter table public.benachrichtigungs_einstellungen
  add column if not exists email_ziel text,
  add column if not exists freigabe_link_id uuid unique
    references public.freigabe_links(id);

alter table public.benachrichtigungs_einstellungen
  add constraint benachrichtigung_email_ziel_check check (
    email_ziel is null or (
      char_length(email_ziel) <= 254
      and email_ziel ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

create or replace function public.obmann_vorstandsbenachrichtigungen(p_passwort text)
returns table(link_id uuid, email text, aktiv boolean)
language plpgsql security definer set search_path to ''
as $function$
declare v_verein uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  return query
    select l.id, k.email_ziel, coalesce(k.email_aktiv, false)
      from public.freigabe_links l
      left join public.benachrichtigungs_einstellungen k
        on k.freigabe_link_id = l.id
     where l.verein_id = v_verein;
end;
$function$;

create or replace function public.obmann_vorstandsbenachrichtigung_setzen(
  p_passwort text, p_link_id uuid, p_email text, p_aktiv boolean
)
returns void
language plpgsql security definer set search_path to ''
as $function$
declare
  v_verein uuid;
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
begin
  v_verein := public.obmann_verein(p_passwort);
  perform 1 from public.freigabe_links l
   where l.id = p_link_id and l.verein_id = v_verein
     and l.widerrufen_am is null
     and (l.gueltig_bis is null or l.gueltig_bis > now());
  if not found then raise exception 'Dieser Zugang ist nicht aktiv.'; end if;
  if coalesce(p_aktiv, false) and v_email is null then
    raise exception 'Bitte zuerst die E-Mail-Adresse eintragen.';
  end if;
  if v_email is not null and (
    char_length(v_email) > 254 or
    v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then raise exception 'Bitte eine gueltige E-Mail-Adresse eintragen.'; end if;

  insert into public.benachrichtigungs_einstellungen
    (empfaenger_schluessel, freigabe_link_id, email_ziel,
     email_aktiv, aktivierte_typen, aktualisiert_am)
  values
    ('v_' || replace(p_link_id::text, '-', ''), p_link_id, v_email,
     coalesce(p_aktiv, false), array['ausruestung.vorgelegt']::text[], now())
  on conflict (empfaenger_schluessel) do update
    set email_ziel = excluded.email_ziel,
        email_aktiv = excluded.email_aktiv,
        aktivierte_typen = excluded.aktivierte_typen,
        aktualisiert_am = now();
end;
$function$;

-- Der letzte vorgelegte Teil eines Buendels erzeugt genau ein Ereignis.
-- Altfalle ohne Buendel erzeugen wie bisher ein einzelnes Ereignis.
create or replace function public.benachrichtigung_vorstand_vorlage_trigger()
returns trigger
language plpgsql security definer set search_path to ''
as $function$
declare
  v_empfaenger text;
  v_verein uuid;
  v_person text;
  v_positionen jsonb;
  v_anzahl integer;
  v_gesamt_cent bigint;
  v_ereignis uuid;
  v_referenz uuid;
begin
  if new.prozess_status <> 'vorgelegt'
     or old.prozess_status is not distinct from new.prozess_status
     or new.vorlage_link_id is null then
    return new;
  end if;

  select k.empfaenger_schluessel into v_empfaenger
    from public.benachrichtigungs_einstellungen k
    join public.freigabe_links l on l.id = k.freigabe_link_id
   where l.id = new.vorlage_link_id
     and l.widerrufen_am is null
     and (l.gueltig_bis is null or l.gueltig_bis > now())
     and k.email_aktiv and k.email_ziel is not null
     and 'ausruestung.vorgelegt' = any(k.aktivierte_typen);
  if v_empfaenger is null then return new; end if;

  if new.buendel_id is not null and exists (
    select 1 from public.ausruestungs_anfragen a
     where a.buendel_id = new.buendel_id
       and a.freigabe_status = 'nicht_vorgelegt'
  ) then return new; end if;

  select s.verein_id, s.name into v_verein, v_person
    from public.schiedsrichter s where s.id = new.schiedsrichter_id;
  v_referenz := coalesce(new.buendel_id, new.id);

  select jsonb_agg(jsonb_build_object(
           'bezeichnung', coalesce(pr.bezeichnung, a.kategorie),
           'farbe', a.farbe, 'groesse', a.groesse,
           'aermellaenge', a.aermellaenge, 'anmerkung', a.anmerkung,
           'preis_cent', a.vorlage_preis_cent,
           'beschaffungsweg', a.beschaffungsweg
         ) order by a.buendel_position nulls last, a.erstellt_am),
         count(*)::integer, coalesce(sum(a.vorlage_preis_cent), 0)
    into v_positionen, v_anzahl, v_gesamt_cent
    from public.ausruestungs_anfragen a
    left join public.ausruestung_preise pr
      on pr.verein_id = v_verein and pr.kategorie = a.kategorie
   where (new.buendel_id is not null and a.buendel_id = new.buendel_id
          or new.buendel_id is null and a.id = new.id)
     and a.prozess_status = 'vorgelegt';

  v_ereignis := public.benachrichtigung_einreihen(
    v_verein, 'ausruestung.vorgelegt', 'ausruestungs_anfrage',
    v_referenz,
    'vorstand-vorlage/' || new.vorlage_link_id::text || '/' ||
      v_referenz::text || '/' || new.vorlage_am::text,
    jsonb_build_object(
      'person', v_person, 'anzahl', v_anzahl,
      'gesamt_cent', v_gesamt_cent, 'positionen', v_positionen,
      'gesamt_anmerkung', (
        select b.gesamt_anmerkung from public.ausruestungs_buendel b
         where b.id = new.buendel_id
      )
    )
  );

  insert into public.benachrichtigungs_auftraege
    (ereignis_id, empfaenger_schluessel, kanal)
  values (v_ereignis, v_empfaenger, 'email')
  on conflict (ereignis_id, empfaenger_schluessel, kanal) do nothing;
  return new;
end;
$function$;

drop trigger if exists benachrichtigung_vorstand_vorlage_trigger
  on public.ausruestungs_anfragen;
create trigger benachrichtigung_vorstand_vorlage_trigger
  after update of prozess_status on public.ausruestungs_anfragen
  for each row execute function public.benachrichtigung_vorstand_vorlage_trigger();

-- V2 erweitert den vorhandenen Lease-Claim nur um den Empfaenger. Die alte
-- Funktion bleibt fuer bestehende Aufrufe unveraendert.
create or replace function public.benachrichtigung_auftraege_v2_beanspruchen(
  p_limit integer default 10
)
returns table(
  auftrag_id uuid, ereignis_id uuid, typ text, metadaten jsonb,
  versuch integer, idempotenzschluessel text,
  empfaenger_schluessel text, ziel_email text
)
language plpgsql security definer set search_path to ''
as $function$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  return query
  with kandidaten as (
    select a.id
      from public.benachrichtigungs_auftraege a
      join public.benachrichtigungs_einstellungen k
        on k.empfaenger_schluessel = a.empfaenger_schluessel
      left join public.freigabe_links l on l.id = k.freigabe_link_id
     where k.email_aktiv and a.kanal = 'email'
       and a.status in ('offen', 'fehlgeschlagen', 'in_arbeit')
       and a.naechster_versuch_am <= now()
       and (a.gesperrt_bis is null or a.gesperrt_bis < now())
       and a.versuche < 5
       and (k.freigabe_link_id is null or (
         l.widerrufen_am is null
         and (l.gueltig_bis is null or l.gueltig_bis > now())
       ))
     order by a.erstellt_am
     for update of a skip locked
     limit v_limit
  ), beansprucht as (
    update public.benachrichtigungs_auftraege a
       set status = 'in_arbeit', versuche = a.versuche + 1,
           gesperrt_bis = now() + interval '5 minutes', aktualisiert_am = now()
      from kandidaten k where a.id = k.id
     returning a.id, a.ereignis_id, a.versuche, a.empfaenger_schluessel
  )
  select b.id, e.id, e.typ, e.metadaten, b.versuche,
         'obmann-email/' || b.id::text,
         b.empfaenger_schluessel, k.email_ziel
    from beansprucht b
    join public.benachrichtigungs_ereignisse e on e.id = b.ereignis_id
    join public.benachrichtigungs_einstellungen k
      on k.empfaenger_schluessel = b.empfaenger_schluessel;
end;
$function$;

revoke all on function public.obmann_vorstandsbenachrichtigungen(text)
  from public, anon, authenticated;
revoke all on function public.obmann_vorstandsbenachrichtigung_setzen(text,uuid,text,boolean)
  from public, anon, authenticated;
revoke all on function public.benachrichtigung_vorstand_vorlage_trigger()
  from public, anon, authenticated;
revoke all on function public.benachrichtigung_auftraege_v2_beanspruchen(integer)
  from public, anon, authenticated;
grant execute on function public.obmann_vorstandsbenachrichtigungen(text)
  to anon, authenticated;
grant execute on function public.obmann_vorstandsbenachrichtigung_setzen(text,uuid,text,boolean)
  to anon, authenticated;
grant execute on function public.benachrichtigung_auftraege_v2_beanspruchen(integer)
  to service_role;
