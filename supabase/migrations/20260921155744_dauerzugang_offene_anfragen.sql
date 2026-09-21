-- =====================================================================
-- Dauerzugang als lebendes Vorstandspostfach
-- ---------------------------------------------------------------------
-- Befristete Freigabelinks bleiben unveraenderliche Stapel: Sie sehen
-- nur Anfragen, die genau diesem Link zugeordnet wurden. Ein namentlicher
-- Dauerzugang ist dagegen das laufende Arbeitsdashboard des Vereins und
-- sieht alle bereits vom Obmann vorgelegten Anfragen des eigenen Vereins.
--
-- Die beim Vorlegen eingefrorenen Angaben (vorlage_preis_cent und
-- vorlage_umfang) werden dabei nicht veraendert. Es wird nur die
-- Sichtbarkeit und Aktionsberechtigung des Dauerzugangs erweitert.
-- =====================================================================

create or replace function public.freigabe_dashboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein   uuid;
  v_link     uuid;
  v_art      text;
  v_name     text;
  v_start    date;
  v_ende     date;
  v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;
  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  select v.name into v_name from public.vereine v where v.id = v_verein;

  v_start := make_date(
    case when extract(month from current_date) >= 7
         then extract(year from current_date)::int
         else extract(year from current_date)::int - 1 end, 7, 1);
  v_ende := (v_start + interval '1 year' - interval '1 day')::date;

  with stapel as (
    select a.id, a.schiedsrichter_id, s.name as person,
           coalesce(pr.bezeichnung, a.kategorie) as bezeichnung,
           a.kategorie, a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           a.erstellt_am, a.prozess_status, a.beschaffungsweg,
           a.vorlage_preis_cent as preis_cent,
           a.vorlage_am, a.freigabe_status, a.freigabe_name,
           a.freigabe_notiz, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.vorlage_am is not null
       and (
         v_art = 'dauerhaft'
         or (v_art = 'befristet' and a.vorlage_link_id = v_link)
       )
  ),
  saison as (
    select a.schiedsrichter_id,
           count(*) filter (where a.prozess_status not in ('abgelehnt','zurueckgezogen')) as freigegeben_anzahl,
           coalesce(sum(a.vorlage_preis_cent) filter (
             where a.freigabe_status = 'freigegeben'), 0) as freigegeben_cent
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.freigabe_status = 'freigegeben'
       and a.freigabe_am::date between v_start and v_ende
     group by a.schiedsrichter_id
  )
  select jsonb_build_object(
    'verein', v_name,
    'saison', jsonb_build_object(
      'bezeichnung', to_char(v_start, 'YYYY') || '/' || to_char(v_start + interval '1 year', 'YY'),
      'von', v_start, 'bis', v_ende),
    'kennzahlen', (select jsonb_build_object(
        'offen_anzahl',       count(*) filter (where prozess_status = 'vorgelegt'),
        'offen_cent',         coalesce(sum(preis_cent) filter (where prozess_status = 'vorgelegt'), 0),
        'offen_ohne_preis',   count(*) filter (where prozess_status = 'vorgelegt' and preis_cent is null),
        'freigegeben_anzahl', count(*) filter (where freigabe_status = 'freigegeben'),
        'freigegeben_cent',   coalesce(sum(preis_cent) filter (where freigabe_status = 'freigegeben'), 0),
        'abgelehnt_anzahl',   count(*) filter (where freigabe_status = 'abgelehnt'),
        'zahlung_anzahl',     count(*) filter (where prozess_status = 'beleg_geprueft'),
        'zahlung_cent',       coalesce(sum(preis_cent) filter (where prozess_status = 'beleg_geprueft'), 0)
      ) from stapel),
    'offen', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'kategorie', z.kategorie, 'farbe', z.farbe, 'groesse', z.groesse,
        'aermellaenge', z.aermellaenge, 'anmerkung', z.anmerkung,
        'preis_cent', z.preis_cent, 'beschaffungsweg', z.beschaffungsweg,
        'erstellt_am', z.erstellt_am, 'vorlage_am', z.vorlage_am,
        'saison_freigegeben_cent', coalesce(sa.freigegeben_cent, 0),
        'saison_freigegeben_anzahl', coalesce(sa.freigegeben_anzahl, 0))
        order by z.person, z.vorlage_am)
      from stapel z left join saison sa on sa.schiedsrichter_id = z.schiedsrichter_id
      where z.prozess_status = 'vorgelegt'), '[]'::jsonb),
    'zahlungen', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'preis_cent', z.preis_cent, 'freigabe_am', z.freigabe_am)
        order by z.person)
      from stapel z where z.prozess_status = 'beleg_geprueft'), '[]'::jsonb),
    'verlauf', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'person', z.person, 'bezeichnung', z.bezeichnung,
        'preis_cent', z.preis_cent, 'freigabe_status', z.freigabe_status,
        'freigabe_name', z.freigabe_name, 'freigabe_notiz', z.freigabe_notiz,
        'freigabe_am', z.freigabe_am, 'prozess_status', z.prozess_status)
        order by z.freigabe_am desc)
      from stapel z
      where z.freigabe_status in ('freigegeben','abgelehnt')
        and z.freigabe_am is not null), '[]'::jsonb)
  ) into v_ergebnis;

  return v_ergebnis;
end;
$function$;


create or replace function public.freigabe_uebersicht(p_token text)
returns table(id uuid, person text, bezeichnung text, kategorie text, farbe text,
              groesse text, aermellaenge text, anmerkung text, preis_cent integer,
              preis_quelle text, erstellt_am timestamp with time zone,
              freigabe_status text, freigabe_notiz text, freigabe_name text,
              freigabe_am timestamp with time zone)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_verein uuid;
  v_link   uuid;
  v_art    text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;
  update public.freigabe_links l set zuletzt_genutzt_am = now() where l.id = v_link;

  return query
    select a.id, s.name, coalesce(pr.bezeichnung, a.kategorie), a.kategorie,
           a.farbe, a.groesse, a.aermellaenge, a.anmerkung,
           a.vorlage_preis_cent,
           'vorgelegt'::text,
           a.erstellt_am, a.freigabe_status, a.freigabe_notiz,
           a.freigabe_name, a.freigabe_am
      from public.ausruestungs_anfragen a
      join public.schiedsrichter s on s.id = a.schiedsrichter_id
      left join public.ausruestung_preise pr
             on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
     where s.verein_id = v_verein
       and a.typ = 'ausruestung'
       and a.vorlage_am is not null
       and (
         v_art = 'dauerhaft'
         or (v_art = 'befristet' and a.vorlage_link_id = v_link)
       )
     order by (a.prozess_status = 'vorgelegt') desc, s.name, a.erstellt_am;
end;
$function$;


create or replace function public.freigabe_entscheiden(
  p_token text, p_id uuid, p_entscheidung text,
  p_name text, p_notiz text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
  v_art    text;
  v_name   text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  v_name   := public.freigabe_akteur(p_token, p_name);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;

  if p_entscheidung not in ('freigegeben', 'abgelehnt') then
    raise exception 'Ungueltige Entscheidung.';
  end if;
  if p_entscheidung = 'abgelehnt' and char_length(btrim(coalesce(p_notiz, ''))) < 3 then
    raise exception 'Bitte die Ablehnung kurz begruenden.';
  end if;

  perform 1
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.vorlage_am is not null
     and a.prozess_status = 'vorgelegt'
     and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link);
  if not found then raise exception 'Diese Anfrage steht nicht (mehr) zur Entscheidung.'; end if;

  perform public.ausruestung_uebergang(p_id, p_entscheidung, 'vorstand', v_name, p_notiz);
end;
$$;


create or replace function public.freigabe_zahlung_angewiesen(
  p_token text, p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_verein uuid;
  v_link   uuid;
  v_art    text;
  v_name   text;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link   := public.freigabe_link_id(p_token);
  v_name   := public.freigabe_akteur(p_token, p_name);
  select l.zugangsart into v_art from public.freigabe_links l where l.id = v_link;

  perform 1
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein
     and a.vorlage_am is not null
     and a.prozess_status = 'beleg_geprueft'
     and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link);
  if not found then raise exception 'Fuer diesen Vorgang steht gerade keine Zahlung an.'; end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_angewiesen', 'vorstand', v_name);
end;
$$;

revoke all on function public.freigabe_dashboard(text) from public;
revoke all on function public.freigabe_uebersicht(text) from public;
revoke all on function public.freigabe_entscheiden(text, uuid, text, text, text) from public;
revoke all on function public.freigabe_zahlung_angewiesen(text, uuid, text) from public;

grant execute on function public.freigabe_dashboard(text) to anon;
grant execute on function public.freigabe_uebersicht(text) to anon;
grant execute on function public.freigabe_entscheiden(text, uuid, text, text, text) to anon;
grant execute on function public.freigabe_zahlung_angewiesen(text, uuid, text) to anon;

comment on function public.freigabe_dashboard(text) is
  'Befristete Links sehen ihren Stapel; Dauerzugaenge sehen alle vorgelegten Ausruestungsvorgaenge ihres Vereins.';
comment on function public.freigabe_entscheiden(text, uuid, text, text, text) is
  'Vorstandsentscheidung. Ablehnung braucht einen Grund; Dauerzugang darf alle offenen Vorlagen des eigenen Vereins entscheiden.';
