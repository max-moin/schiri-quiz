-- Neutral lesbare Schritte, die beiden Preisquellen fuer Max und weniger Mailrauschen.
-- Keine Status-/Rechteaenderung: ein laufender Vorgang bleibt unberuehrt.

create or replace function public.ausruestung_schritt_titel(p_schritt text)
returns text language sql immutable set search_path to '' as $f$
  select case p_schritt
    when 'eingereicht' then 'Anfrage'
    when 'geprueft' then 'Obmann-Prüfung'
    when 'vorgelegt' then 'Beim Vorstand'
    when 'entscheidung' then 'Vorstandsentscheidung'
    when 'freigegeben' then 'Freigabe'
    when 'abgelehnt' then 'Abgelehnt'
    when 'zurueckgezogen' then 'Zurückgezogen'
    when 'gekauft' then 'Kaufen'
    when 'beleg_hochgeladen' then 'Beleg einreichen'
    when 'beleg_geprueft' then 'Belegprüfung'
    when 'zahlung_angewiesen' then 'Zahlung anweisen'
    when 'geld_erhalten' then 'Geldeingang bestätigen'
    when 'bestellt' then 'Bestellen'
    when 'eingegangen' then 'Wareneingang'
    when 'uebergeben' then 'Übergabe'
    when 'abgeschlossen' then 'Abgeschlossen'
    else p_schritt end;
$f$;
revoke all on function public.ausruestung_schritt_titel(text) from public, anon, authenticated;

-- Nur im passwortgeschuetzten Obmann-Detail, nie in der Schiri- oder
-- Vorstandsansicht: Richtwert und Angabe getrennt neben dem Vorlagepreis.
create or replace function public.obmann_anfrage_prozess(p_passwort text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_verein uuid; v_result jsonb;
begin
  v_verein := public.obmann_verein(p_passwort);
  select public.ausruestung_prozess_jsonb(a.id, 'obmann') ||
         jsonb_build_object('preis_richtwert_cent', a.preis_richtwert_cent,
                            'preis_schiri_cent', a.preis_schiri_cent)
    into v_result
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein and a.typ = 'ausruestung';
  if v_result is null then raise exception 'Vorgang nicht gefunden.'; end if;
  return v_result;
end;
$f$;
revoke all on function public.obmann_anfrage_prozess(text, uuid) from public, anon, authenticated;
grant execute on function public.obmann_anfrage_prozess(text, uuid) to anon, authenticated;

-- Kaufbestätigung bleibt im App-Eingang, erzeugt aber keine zusätzliche
-- E-Mail an Max. Der Beleg-Upload meldet sich weiterhin separat.
create or replace function public.benachrichtigung_ausruestung_trigger()
returns trigger language plpgsql security definer set search_path to '' as $f$
declare v_typ text; v_name text; v_anzahl integer;
begin
  if new.akteur_rolle = 'schiri' and new.schritt in
      ('eingereicht', 'beleg_hochgeladen', 'geld_erhalten') then
    if new.schritt = 'eingereicht' and not new.eingang then return new; end if;
    v_typ := 'ausruestung.' || new.schritt;
  elsif new.akteur_rolle = 'vorstand' and new.schritt in
      ('freigegeben', 'abgelehnt', 'zahlung_angewiesen') then
    v_typ := 'ausruestung.' || new.schritt;
  else
    return new;
  end if;
  select public.benachrichtigung_kurzname(s.name), b.positionen_anzahl
    into v_name, v_anzahl
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
    left join public.ausruestungs_buendel b on b.id = a.buendel_id
   where a.id = new.anfrage_id;
  perform public.benachrichtigung_einreihen(
    new.verein_id, v_typ, 'ausruestungsanfrage', new.anfrage_id,
    'ausruestung:' || new.schluessel,
    jsonb_strip_nulls(jsonb_build_object('anzeigename', v_name, 'anzahl', v_anzahl)));
  return new;
end;
$f$;
revoke all on function public.benachrichtigung_ausruestung_trigger() from public, anon, authenticated;
