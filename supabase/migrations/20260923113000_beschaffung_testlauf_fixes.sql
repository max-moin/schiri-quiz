-- Durchgespielter Beschaffungsablauf: direkte Vorlage, Belegvarianten,
-- wiederholte Uploads, Bestand und explizite Testfall-Löschung.

alter table public.ausruestungs_anfragen
  add column if not exists beleg_art text,
  add column if not exists beleg_version integer not null default 0;
alter table public.ausruestungs_anfragen
  drop constraint if exists ausruestungs_anfragen_beleg_art_check;
alter table public.ausruestungs_anfragen
  add constraint ausruestungs_anfragen_beleg_art_check
    check (beleg_art is null or beleg_art in ('bild','papier'));

alter table public.ausruestungsbestand
  add column if not exists quell_anfrage_id uuid
    references public.ausruestungs_anfragen(id) on delete cascade;
create unique index if not exists ausruestungsbestand_quell_anfrage_eindeutig
  on public.ausruestungsbestand(quell_anfrage_id);

create or replace function public.obmann_anfrage_direkt_vorlegen(
  p_passwort text,p_id uuid,p_link_id uuid default null)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_status text;
begin
  v_verein := public.obmann_verein(p_passwort);
  select a.prozess_status into v_status
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_id and s.verein_id=v_verein and a.typ='ausruestung'
   for update of a;
  if v_status is null then raise exception 'Vorgang nicht gefunden.'; end if;
  if v_status='eingereicht' then
    perform public.ausruestung_uebergang(p_id,'geprueft','obmann');
  elsif v_status <> 'geprueft' then
    raise exception 'Nur neue oder gepruefte Anfragen koennen vorgelegt werden.';
  end if;
  perform public.obmann_anfrage_vorlegen(p_passwort,p_id,p_link_id);
end;
$f$;
revoke all on function public.obmann_anfrage_direkt_vorlegen(text,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_anfrage_direkt_vorlegen(text,uuid,uuid)
  to anon,authenticated;

-- Der Obmann darf einen physisch übergebenen Beleg selbst erfassen.
create or replace function public.ausruestung_uebergaenge()
returns table(von text,nach text,weg text,rollen text[])
language sql immutable set search_path to '' as $f$
  select * from (values
    ('eingereicht','geprueft','beide',array['obmann']),
    ('eingereicht','abgelehnt','beide',array['obmann']),
    ('eingereicht','zurueckgezogen','beide',array['schiri','obmann']),
    ('geprueft','eingereicht','beide',array['obmann']),
    ('geprueft','vorgelegt','beide',array['obmann']),
    ('geprueft','abgelehnt','beide',array['obmann']),
    ('geprueft','zurueckgezogen','beide',array['schiri','obmann']),
    ('vorgelegt','geprueft','beide',array['obmann']),
    ('vorgelegt','freigegeben','beide',array['vorstand']),
    ('vorgelegt','abgelehnt','beide',array['vorstand']),
    ('freigegeben','geprueft','beide',array['obmann']),
    ('abgelehnt','geprueft','beide',array['obmann']),
    ('freigegeben','gekauft','weg2_schiri_besorgt',array['schiri','obmann']),
    ('gekauft','beleg_hochgeladen','weg2_schiri_besorgt',array['schiri','obmann']),
    ('beleg_hochgeladen','beleg_geprueft','weg2_schiri_besorgt',array['obmann']),
    ('beleg_hochgeladen','gekauft','weg2_schiri_besorgt',array['obmann']),
    ('beleg_geprueft','zahlung_angewiesen','weg2_schiri_besorgt',array['obmann','vorstand']),
    ('beleg_geprueft','abgeschlossen','weg2_schiri_besorgt',array['obmann']),
    ('zahlung_angewiesen','geld_erhalten','weg2_schiri_besorgt',array['schiri','obmann']),
    ('geld_erhalten','abgeschlossen','weg2_schiri_besorgt',array['obmann','system']),
    ('freigegeben','bestellt','weg1_obmann_besorgt',array['obmann']),
    ('bestellt','eingegangen','weg1_obmann_besorgt',array['obmann']),
    ('eingegangen','uebergeben','weg1_obmann_besorgt',array['obmann']),
    ('uebergeben','abgeschlossen','weg1_obmann_besorgt',array['obmann','system']),
    ('abgelehnt','abgeschlossen','beide',array['obmann']),
    ('zurueckgezogen','abgeschlossen','beide',array['obmann'])
  ) as u(von,nach,weg,rollen);
$f$;
revoke all on function public.ausruestung_uebergaenge() from public;

create or replace function public.ausruestung_schritt_titel(p_schritt text)
returns text language sql immutable set search_path to '' as $f$
  select case p_schritt
    when 'eingereicht' then 'Angefragt'
    when 'geprueft' then 'Von mir geprüft'
    when 'vorgelegt' then 'Dem Vorstand vorgelegt'
    when 'entscheidung' then 'Entscheidung des Vorstands'
    when 'freigegeben' then 'Freigegeben'
    when 'abgelehnt' then 'Abgelehnt'
    when 'zurueckgezogen' then 'Zurückgezogen'
    when 'gekauft' then 'Gekauft'
    when 'beleg_hochgeladen' then 'Beleg eingereicht'
    when 'beleg_geprueft' then 'Beleg geprüft'
    when 'zahlung_angewiesen' then 'Zahlung angewiesen'
    when 'geld_erhalten' then 'Geld erhalten'
    when 'bestellt' then 'Bestellt'
    when 'eingegangen' then 'Ware eingegangen'
    when 'uebergeben' then 'Übergeben'
    when 'abgeschlossen' then 'Abgeschlossen'
    else p_schritt end;
$f$;
revoke all on function public.ausruestung_schritt_titel(text) from public;

-- Die bestehende eindeutige Ereignis-ID wird nur beim Beleg um eine
-- Version ergänzt: ein zweiter Upload muss erneut im Eingang landen.
create or replace function public.ausruestung_ereignis_schreiben(
  p_anfrage uuid,p_schritt text,p_rolle text,p_name text,
  p_notiz text,p_betrag integer,p_eingang boolean)
returns uuid language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_runde smallint; v_version integer; v_id uuid; v_key text;
begin
  select s.verein_id,a.prozess_runde,a.beleg_version
    into v_verein,v_runde,v_version
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_anfrage;
  if v_verein is null then raise exception 'Vorgang nicht gefunden.'; end if;
  v_key := p_anfrage::text||':'||p_schritt||':'||v_runde::text;
  if p_schritt='beleg_hochgeladen' then
    v_key := v_key||':'||v_version::text;
  end if;
  insert into public.ausruestung_ereignisse
    (anfrage_id,verein_id,runde,schritt,akteur_rolle,akteur_name,
     notiz,betrag_cent,eingang,schluessel)
  values (p_anfrage,v_verein,v_runde,p_schritt,p_rolle,
    nullif(btrim(coalesce(p_name,'')),''),nullif(btrim(coalesce(p_notiz,'')),''),
    p_betrag,coalesce(p_eingang,false),v_key)
  on conflict (schluessel) do nothing returning id into v_id;
  return v_id;
end;
$f$;
revoke all on function public.ausruestung_ereignis_schreiben(uuid,text,text,text,text,integer,boolean)
  from public;

create or replace function public.schiri_anfrage_rechnung_hochladen(
  p_schiedsrichter_id uuid,p_pin text,p_anfrage_id uuid,
  p_bild_base64 text,p_mime text)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_status text; v_name text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if nullif(btrim(coalesce(p_bild_base64,'')),'') is null then
    raise exception 'Es wurde kein Beleg uebertragen.';
  end if;
  if p_mime not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Dieses Dateiformat wird nicht angenommen.';
  end if;
  select a.prozess_status into v_status
    from public.ausruestungs_anfragen a
   where a.id=p_anfrage_id and a.schiedsrichter_id=p_schiedsrichter_id
     and a.typ='ausruestung' for update;
  if v_status not in ('gekauft','beleg_hochgeladen') then
    raise exception 'Ein Beleg ist in diesem Schritt nicht vorgesehen.';
  end if;
  select s.name into v_name from public.schiedsrichter s where s.id=p_schiedsrichter_id;
  update public.ausruestungs_anfragen set
    rechnung_bild_base64=p_bild_base64,rechnung_mime=p_mime,
    rechnung_hochgeladen_am=now(),beleg_art='bild',
    beleg_version=beleg_version+1,beleg_geprueft_am=null,
    obmann_gesehen=false,aktualisiert_am=now()
   where id=p_anfrage_id;
  if v_status='gekauft' then
    perform public.ausruestung_uebergang(p_anfrage_id,'beleg_hochgeladen','schiri',v_name);
  else
    perform public.ausruestung_ereignis_schreiben(
      p_anfrage_id,'beleg_hochgeladen','schiri',v_name,'Beleg ersetzt',null,true);
  end if;
end;
$f$;
revoke all on function public.schiri_anfrage_rechnung_hochladen(uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.schiri_anfrage_rechnung_hochladen(uuid,text,uuid,text,text)
  to anon,authenticated;

create or replace function public.obmann_anfrage_beleg_erfassen(
  p_passwort text,p_id uuid,p_art text,
  p_bild_base64 text default null,p_mime text default null)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_status text;
begin
  v_verein := public.obmann_verein(p_passwort);
  if p_art not in ('bild','papier') then raise exception 'Unbekannte Belegart.'; end if;
  if p_art='bild' and
     (nullif(btrim(coalesce(p_bild_base64,'')),'') is null or
      p_mime not in ('image/jpeg','image/png','image/webp')) then
    raise exception 'Bitte ein JPEG-, PNG- oder WebP-Bild auswaehlen.';
  end if;
  select a.prozess_status into v_status
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_id and s.verein_id=v_verein and a.typ='ausruestung'
   for update of a;
  if v_status not in ('gekauft','beleg_hochgeladen') then
    raise exception 'Ein Beleg kann in diesem Schritt nicht erfasst werden.';
  end if;
  update public.ausruestungs_anfragen set
    rechnung_bild_base64=case when p_art='bild' then p_bild_base64 else null end,
    rechnung_mime=case when p_art='bild' then p_mime else null end,
    rechnung_hochgeladen_am=now(),beleg_art=p_art,
    beleg_version=beleg_version+1,beleg_geprueft_am=null,
    aktualisiert_am=now()
   where id=p_id;
  if v_status='gekauft' then
    perform public.ausruestung_uebergang(p_id,'beleg_hochgeladen','obmann',null,
      case when p_art='papier' then 'Papierbeleg erhalten' else 'Belegbild erfasst' end);
  else
    perform public.ausruestung_ereignis_schreiben(p_id,'beleg_hochgeladen','obmann',null,
      case when p_art='papier' then 'Papierbeleg erhalten' else 'Belegbild ersetzt' end,
      null,false);
  end if;
end;
$f$;
revoke all on function public.obmann_anfrage_beleg_erfassen(text,uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.obmann_anfrage_beleg_erfassen(text,uuid,text,text,text)
  to anon,authenticated;

create or replace function public.obmann_anfrage_beleg(p_passwort text,p_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_result jsonb;
begin
  v_verein := public.obmann_verein(p_passwort);
  select jsonb_build_object('art',coalesce(a.beleg_art,
      case when a.rechnung_bild_base64 is not null then 'bild' end),
    'bild_base64',a.rechnung_bild_base64,'mime',a.rechnung_mime,
    'hochgeladen_am',a.rechnung_hochgeladen_am,'version',a.beleg_version)
    into v_result
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_id and s.verein_id=v_verein;
  if v_result is null then raise exception 'Vorgang nicht gefunden.'; end if;
  return v_result;
end;
$f$;
revoke all on function public.obmann_anfrage_beleg(text,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_anfrage_beleg(text,uuid)
  to anon,authenticated;

-- Der Schiedsrichter bestätigt den tatsächlichen Zahlungseingang. Danach
-- ist der Selbstkauf abgeschlossen; ein zusätzlicher Obmann-Klick wäre
-- eine falsche zweite Zuständigkeit.
create or replace function public.schiri_anfrage_schritt(
  p_schiedsrichter_id uuid,p_pin text,p_anfrage_id uuid,p_schritt text)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_name text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_schritt not in ('gekauft','geld_erhalten','zurueckgezogen') then
    raise exception 'Diesen Schritt kann der Schiedsrichter nicht setzen.';
  end if;
  perform 1 from public.ausruestungs_anfragen a
   where a.id=p_anfrage_id and a.schiedsrichter_id=p_schiedsrichter_id;
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;
  select s.name into v_name from public.schiedsrichter s
   where s.id=p_schiedsrichter_id;
  perform public.ausruestung_uebergang(p_anfrage_id,p_schritt,'schiri',v_name);
  if p_schritt='geld_erhalten' then
    perform public.ausruestung_uebergang(p_anfrage_id,'abgeschlossen','system');
  end if;
end;
$f$;
revoke all on function public.schiri_anfrage_schritt(uuid,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.schiri_anfrage_schritt(uuid,text,uuid,text)
  to anon;

-- Ein Kauf ist ein neuer physischer Gegenstand. Auch wenn schon eine
-- Hose gleicher Farbe/Groesse eingetragen wurde, wird nichts heimlich
-- zusammengefuehrt. Die Herkunft bleibt per Anfrage-ID nachweisbar.
create or replace function public.ausruestung_bestand_aus_vorgang()
returns trigger language plpgsql security definer set search_path to '' as $f$
begin
  if new.typ <> 'ausruestung' then return new; end if;
  if new.prozess_status in ('gekauft','uebergeben')
     and new.prozess_status is distinct from old.prozess_status then
    insert into public.ausruestungsbestand
      (schiedsrichter_id,kategorie,bezeichnung,farbe,groesse,aermellaenge,
       anzahl,zustand,anmerkung,finanzierung,quell_anfrage_id)
    values (new.schiedsrichter_id,new.kategorie,
      case when new.kategorie='sonstiges'
           then left(coalesce(nullif(btrim(new.anmerkung),''),'Sonstiges'),80)
           else null end,
      new.farbe,new.groesse,new.aermellaenge,1,'einsatzbereit',
      'Aus Anfrage übernommen',
      case when new.prozess_status='uebergeben' then 'verein' else 'unbekannt' end,
      new.id)
    on conflict (quell_anfrage_id) do nothing;
  end if;
  if new.prozess_status='geld_erhalten'
     and new.prozess_status is distinct from old.prozess_status then
    update public.ausruestungsbestand set finanzierung='verein',aktualisiert_am=now()
     where quell_anfrage_id=new.id;
  elsif new.prozess_status='abgeschlossen' and new.keine_zahlung_faellig
     and new.prozess_status is distinct from old.prozess_status then
    update public.ausruestungsbestand set finanzierung='selbst',aktualisiert_am=now()
     where quell_anfrage_id=new.id and finanzierung='unbekannt';
  end if;
  return new;
end;
$f$;
drop trigger if exists ausruestung_bestand_aus_vorgang on public.ausruestungs_anfragen;
create trigger ausruestung_bestand_aus_vorgang
  after update of prozess_status,keine_zahlung_faellig on public.ausruestungs_anfragen
  for each row execute function public.ausruestung_bestand_aus_vorgang();
revoke all on function public.ausruestung_bestand_aus_vorgang() from public;

-- Nur nach ausdrücklicher App-Bestätigung. Loescht den Testvorgang
-- inklusive Beleg, Ereignissen, Mail-Outbox und nur dem zugeordneten
-- automatisch angelegten Bestandsstück. Andere Bestände bleiben erhalten.
create or replace function public.obmann_ausruestungsanfrage_loeschen(
  p_passwort text,p_id uuid)
returns void language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_buendel uuid; v_anzahl integer;
begin
  v_verein := public.obmann_verein(p_passwort);
  select a.buendel_id into v_buendel
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where a.id=p_id and s.verein_id=v_verein and a.typ='ausruestung'
   for update of a;
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;
  select count(*) into v_anzahl from public.ausruestungs_anfragen
   where buendel_id=v_buendel;
  delete from public.benachrichtigungs_ereignisse
   where verein_id=v_verein and
     ((referenz_art='ausruestungsanfrage' and referenz_id=p_id)
       or (v_anzahl=1 and referenz_art='ausruestungs_anfrage'
           and referenz_id=v_buendel));
  delete from public.ausruestungs_anfragen where id=p_id;
  if v_buendel is not null and v_anzahl=1 then
    delete from public.ausruestungs_buendel where id=v_buendel;
  end if;
end;
$f$;
revoke all on function public.obmann_ausruestungsanfrage_loeschen(text,uuid)
  from public,anon,authenticated;
grant execute on function public.obmann_ausruestungsanfrage_loeschen(text,uuid)
  to anon,authenticated;
