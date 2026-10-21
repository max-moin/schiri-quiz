-- Vereinsbestellung: Bestellweg ändern, externe Freigabe dokumentieren,
-- Schiri-Erhalt und Obmann-Erstattung getrennt. Keine Bestandsdaten fortschreiben.

CREATE OR REPLACE FUNCTION public.ausruestung_uebergaenge()
 RETURNS TABLE(von text, nach text, weg text, rollen text[])
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
    ('beleg_geprueft','zahlung_beauftragt','weg2_schiri_besorgt',array['obmann']),
    ('zahlung_beauftragt','zahlung_angewiesen','weg2_schiri_besorgt',array['vorstand','obmann']),
    ('beleg_geprueft','abgeschlossen','weg2_schiri_besorgt',array['obmann']),
    ('zahlung_angewiesen','geld_erhalten','weg2_schiri_besorgt',array['schiri','obmann']),
    ('geld_erhalten','abgeschlossen','weg2_schiri_besorgt',array['obmann','system']),
    ('freigegeben','bestellt','weg1_obmann_besorgt',array['obmann']),
    ('bestellt','eingegangen','weg1_obmann_besorgt',array['obmann']),
    ('eingegangen','uebergeben','weg1_obmann_besorgt',array['schiri']),
    ('uebergeben','zahlung_beauftragt','weg1_obmann_besorgt',array['obmann']),
    ('zahlung_beauftragt','zahlung_angewiesen','weg1_obmann_besorgt',array['vorstand','obmann']),
    ('zahlung_angewiesen','geld_erhalten','weg1_obmann_besorgt',array['obmann']),
    ('geld_erhalten','abgeschlossen','weg1_obmann_besorgt',array['system']),
    ('uebergeben','abgeschlossen','weg1_obmann_besorgt',array['obmann','system']),
    ('abgelehnt','abgeschlossen','beide',array['obmann']),
    ('zurueckgezogen','abgeschlossen','beide',array['obmann'])
  ) as u(von,nach,weg,rollen);
$function$;
CREATE OR REPLACE FUNCTION public.ausruestung_uebergang(p_anfrage uuid, p_nach text, p_rolle text, p_name text DEFAULT NULL::text, p_notiz text DEFAULT NULL::text, p_betrag integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a        public.ausruestungs_anfragen%rowtype;
  v_weg    text;
  v_notiz  text := nullif(btrim(coalesce(p_notiz, '')), '');
  v_status text;
  v_ereignis uuid;
begin
  select * into a from public.ausruestungs_anfragen where id = p_anfrage for update;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;
  if a.typ <> 'ausruestung' then
    raise exception 'Nur Ausruestungsanfragen durchlaufen diesen Prozess.';
  end if;

  v_weg := coalesce(a.beschaffungsweg, 'weg2_schiri_besorgt');

  if not exists (select 1 from public.ausruestung_uebergaenge() u
                  where u.von = a.prozess_status and u.nach = p_nach
                    and (u.weg = 'beide' or u.weg = v_weg)) then
    raise exception 'Schritt "%" ist aus dem Zustand "%" nicht vorgesehen.', p_nach, a.prozess_status;
  end if;

  if not exists (select 1 from public.ausruestung_uebergaenge() u
                  where u.von = a.prozess_status and u.nach = p_nach
                    and (u.weg = 'beide' or u.weg = v_weg)
                    and p_rolle = any(u.rollen)) then
    raise exception 'Diese Rolle darf den Schritt "%" nicht ausloesen.', p_nach;
  end if;

  if p_nach = 'abgelehnt' and v_notiz is null then
    raise exception 'Eine Ablehnung braucht eine Begruendung.';
  end if;

  if p_nach = 'freigegeben' and a.vorlage_preis_cent is null then
    raise exception 'Ohne vorgelegten Betrag kann nichts freigegeben werden.';
  end if;

  if p_nach = 'abgeschlossen'
     and ((v_weg = 'weg1_obmann_besorgt' and a.prozess_status = 'uebergeben')
       or a.prozess_status = 'beleg_geprueft')
     and not a.keine_zahlung_faellig then
    raise exception 'Die Erstattung ist noch offen.';
  end if;

  v_status := case p_nach
    when 'eingereicht'    then 'offen'
    when 'geprueft'       then 'offen'
    when 'vorgelegt'      then 'offen'
    when 'abgelehnt'      then 'abgelehnt'
    when 'zurueckgezogen' then 'erledigt'
    when 'abgeschlossen'  then 'erledigt'
    else 'angenommen'
  end;

  update public.ausruestungs_anfragen t
     set prozess_status = p_nach,
         status         = v_status,
         geprueft_am            = case when p_nach = 'geprueft' then now() else t.geprueft_am end,
         gekauft_am             = case when p_nach = 'gekauft' then coalesce(t.gekauft_am, now()) else t.gekauft_am end,
         beleg_geprueft_am      = case when p_nach = 'beleg_geprueft' then now() else t.beleg_geprueft_am end,
         zahlung_angewiesen_am  = case when p_nach = 'zahlung_angewiesen' then now() else t.zahlung_angewiesen_am end,
         zahlung_angewiesen_von = case when p_nach = 'zahlung_angewiesen' then nullif(btrim(coalesce(p_name,'')),'') else t.zahlung_angewiesen_von end,
         geld_erhalten_am       = case when p_nach = 'geld_erhalten' then now() else t.geld_erhalten_am end,
         geld_erhalten_von      = case when p_nach = 'geld_erhalten' then nullif(btrim(coalesce(p_name,'')),'') else t.geld_erhalten_von end,
         bestellt_am            = case when p_nach = 'bestellt' then now() else t.bestellt_am end,
         wareneingang_am        = case when p_nach = 'eingegangen' then now() else t.wareneingang_am end,
         abgeholt_am            = case when p_nach = 'uebergeben' then coalesce(t.abgeholt_am, now()) else t.abgeholt_am end,
         abgeschlossen_am       = case when p_nach = 'abgeschlossen' then now() else t.abgeschlossen_am end,
         selbstkauf_bestaetigt  = case when p_nach = 'gekauft' then true else t.selbstkauf_bestaetigt end,
         selbstkauf_bestaetigt_am = case when p_nach = 'gekauft' then coalesce(t.selbstkauf_bestaetigt_am, now()) else t.selbstkauf_bestaetigt_am end,
         abholung_bestaetigt    = case when p_nach = 'uebergeben' then true else t.abholung_bestaetigt end,
         erstattet              = case when p_nach = 'geld_erhalten' then true else t.erstattet end,
         freigabe_status        = case
                                    when p_nach = 'freigegeben' then 'freigegeben'
                                    when p_nach = 'abgelehnt' and p_rolle = 'vorstand' then 'abgelehnt'
                                    when p_nach = 'vorgelegt' then 'vorgelegt'
                                    when p_nach = 'geprueft' then 'nicht_vorgelegt'
                                    else t.freigabe_status end,
         freigabe_name          = case
                                    when p_nach = 'freigegeben' or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                      then nullif(btrim(coalesce(p_name,'')),'')
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_name end,
         freigabe_notiz         = case
                                    when p_nach = 'freigegeben' or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                      then v_notiz
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_notiz end,
         freigabe_am            = case
                                    when p_nach = 'freigegeben' or (p_nach = 'abgelehnt' and p_rolle = 'vorstand')
                                      then now()
                                    when p_nach = 'geprueft' then null
                                    else t.freigabe_am end,
         entschieden_am         = case when p_nach in ('freigegeben','abgelehnt') then now() else t.entschieden_am end,
         prozess_runde          = case when p_nach = 'geprueft' and t.prozess_status in ('vorgelegt','freigegeben','abgelehnt')
                                       then (t.prozess_runde + 1)::smallint else t.prozess_runde end,
         vorlage_preis_cent     = case when p_nach = 'geprueft' then null else t.vorlage_preis_cent end,
         vorlage_am             = case when p_nach = 'geprueft' then null else t.vorlage_am end,
         vorlage_link_id        = case when p_nach = 'geprueft' then null else t.vorlage_link_id end,
         vorlage_umfang         = case when p_nach = 'geprueft' then null else t.vorlage_umfang end,
         obmann_gesehen         = case when p_rolle in ('schiri','vorstand') then false else t.obmann_gesehen end,
         schiri_gesehen         = case when p_rolle in ('obmann','vorstand') then false else t.schiri_gesehen end,
         aktualisiert_am        = now()
   where t.id = p_anfrage;

  v_ereignis := public.ausruestung_ereignis_schreiben(
    p_anfrage, p_nach, p_rolle, p_name, v_notiz,
    coalesce(p_betrag, a.vorlage_preis_cent),
    p_nach in ('eingereicht','freigegeben','abgelehnt','gekauft','beleg_hochgeladen','geld_erhalten','uebergeben','zurueckgezogen'));
  update public.ausruestung_ereignisse set vorheriger_status=a.prozess_status
   where id=v_ereignis
     and vorheriger_status is null;
end;
$function$;
CREATE OR REPLACE FUNCTION public.ausruestung_schritt_katalog(p_weg text)
 RETURNS TABLE(nr integer, schluessel text, titel text, rolle text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select k.nr, k.schluessel,
    case when p_weg = 'weg1_obmann_besorgt' then case k.schluessel
      when 'eingegangen' then 'Bei mir angekommen · abholbereit'
      when 'uebergeben' then 'Erhalt bestätigen'
      when 'zahlung_beauftragt' then 'Erstattung an Obmann anfordern'
      when 'zahlung_angewiesen' then 'Erstattung an Obmann überweisen'
      when 'geld_erhalten' then 'Mein Geldeingang'
      when 'abgeschlossen' then 'Auch finanziell abgeschlossen'
      else public.ausruestung_schritt_titel(k.schluessel) end
    else public.ausruestung_schritt_titel(k.schluessel) end, k.rolle
    from (
      select * from (values
        (1, 'eingereicht',  'schiri'),
        (2, 'geprueft',     'obmann'),
        (3, 'vorgelegt',    'obmann'),
        (4, 'entscheidung', 'vorstand')
      ) as gemeinsam(nr, schluessel, rolle)
      union all
      select * from (values
        (5,  'gekauft',            'schiri'),
        (6,  'beleg_hochgeladen',  'schiri'),
        (7,  'beleg_geprueft',     'obmann'),
        (8,  'zahlung_beauftragt', 'obmann'),
        (9,  'zahlung_angewiesen', 'vorstand'),
        (10, 'geld_erhalten',      'schiri'),
        (11, 'abgeschlossen',      'obmann')
      ) as selbstkauf(nr, schluessel, rolle)
      where coalesce(p_weg, 'weg2_schiri_besorgt') = 'weg2_schiri_besorgt'
      union all
      select * from (values
        (5, 'bestellt',      'obmann'),
        (6, 'eingegangen',   'obmann'),
        (7, 'uebergeben',    'schiri'),
        (8, 'zahlung_beauftragt', 'obmann'),
        (9, 'zahlung_angewiesen', 'vorstand'),
        (10, 'geld_erhalten', 'obmann'),
        (11, 'abgeschlossen', 'obmann')
      ) as vereinskauf(nr, schluessel, rolle)
      where coalesce(p_weg, 'weg2_schiri_besorgt') = 'weg1_obmann_besorgt'
    ) k
   order by k.nr;
$function$;
CREATE OR REPLACE FUNCTION public.ausruestung_schritt_titel(p_schritt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
    when 'zahlung_beauftragt' then 'Zahlung beauftragen'
    when 'zahlung_angewiesen' then 'Zahlung ausführen'
    when 'geld_erhalten' then 'Geldeingang bestätigen'
    when 'bestellt' then 'Bestellen'
    when 'eingegangen' then 'Wareneingang'
    when 'uebergeben' then 'Übergabe'
    when 'beschaffungsweg_geaendert' then 'Bestellweg geändert'
    when 'abgeschlossen' then 'Abgeschlossen'
    else p_schritt end;
$function$;
CREATE OR REPLACE FUNCTION public.schiri_anfrage_schritt(p_schiedsrichter_id uuid, p_pin text, p_anfrage_id uuid, p_schritt text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_name text;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_schritt not in ('gekauft','geld_erhalten','uebergeben','zurueckgezogen') then
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
$function$;
CREATE OR REPLACE FUNCTION public.obmann_anfrage_schritt(p_passwort text, p_id uuid, p_schritt text, p_notiz text DEFAULT NULL::text, p_name text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_verein uuid; v_weg text;
begin
  v_verein := public.obmann_verein(p_passwort);

  if p_schritt not in ('eingereicht', 'geprueft', 'gekauft', 'beleg_geprueft',
                       'geld_erhalten', 'bestellt',
                       'eingegangen', 'uebergeben', 'abgeschlossen', 'zurueckgezogen') then
    raise exception 'Diesen Schritt kann der Obmann nicht setzen.';
  end if;

  perform 1 from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  select beschaffungsweg into v_weg from public.ausruestungs_anfragen where id=p_id;
  perform public.ausruestung_uebergang(p_id, p_schritt, 'obmann',
    case when v_weg='weg1_obmann_besorgt' and p_schritt='geld_erhalten' then 'Obmann' else p_name end, p_notiz);
  if v_weg='weg1_obmann_besorgt' and p_schritt='geld_erhalten' then
    perform public.ausruestung_uebergang(p_id,'abgeschlossen','system');
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.obmann_zahlung_beauftragen(p_passwort text, p_id uuid, p_hinweis text DEFAULT NULL::text, p_email boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_verein uuid;
  v_anfrage public.ausruestungs_anfragen%rowtype;
  v_empfaenger text;
  v_person text;
  v_bezeichnung text;
  v_hinweis text := nullif(btrim(coalesce(p_hinweis, '')), '');
  v_ereignis uuid;
begin
  v_verein := public.obmann_verein(p_passwort);
  select a.* into v_anfrage
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
   where a.id = p_id and s.verein_id = v_verein and a.typ = 'ausruestung'
   for update of a;
  if not found then raise exception 'Vorgang nicht gefunden.'; end if;
  if not ((v_anfrage.beschaffungsweg='weg1_obmann_besorgt' and v_anfrage.prozess_status='uebergeben')
      or (coalesce(v_anfrage.beschaffungsweg,'weg2_schiri_besorgt')='weg2_schiri_besorgt'
          and v_anfrage.prozess_status='beleg_geprueft')) then
    raise exception 'Zahlung braucht einen geprüften Beleg oder den bestätigten Erhalt der Vereinsbestellung.';
  end if;
  if v_anfrage.keine_zahlung_faellig then
    raise exception 'Für diesen Vorgang ist keine Zahlung vorgesehen.';
  end if;
  if v_hinweis is not null and char_length(v_hinweis) > 500 then
    raise exception 'Der Übergabehinweis darf höchstens 500 Zeichen haben.';
  end if;

  if coalesce(p_email, true) then
    select k.empfaenger_schluessel into v_empfaenger
      from public.freigabe_links l
      join public.benachrichtigungs_einstellungen k
        on k.freigabe_link_id = l.id
     where l.verein_id = v_verein
       and l.widerrufen_am is null
       and (l.gueltig_bis is null or l.gueltig_bis > now())
       and k.email_aktiv and k.email_ziel is not null
       and (l.id = v_anfrage.vorlage_link_id or l.zugangsart = 'dauerhaft')
     order by (l.id = v_anfrage.vorlage_link_id) desc,
              (l.zugangsart = 'dauerhaft') desc, l.erstellt_am desc
     limit 1;
    if v_empfaenger is null then
      raise exception 'Kein aktiver Vorstands-Mailzugang gefunden. Bitte ohne E-Mail beauftragen oder Zugang prüfen.';
    end if;
  end if;

  perform public.ausruestung_uebergang(p_id, 'zahlung_beauftragt', 'obmann',
                                       'Obmann', v_hinweis);
  update public.ausruestungs_anfragen
     set zahlung_beauftragt_am = now(),
         zahlung_beauftragt_von = 'Obmann',
         zahlung_hinweis = v_hinweis
   where id = p_id;

  if v_empfaenger is not null then
    select s.name, coalesce(pr.bezeichnung, v_anfrage.kategorie)
      into v_person, v_bezeichnung
      from public.schiedsrichter s
      left join public.ausruestung_preise pr
        on pr.verein_id = s.verein_id and pr.kategorie = v_anfrage.kategorie
     where s.id = v_anfrage.schiedsrichter_id;
    insert into public.benachrichtigungs_ereignisse
      (verein_id, typ, referenz_art, referenz_id, metadaten, schluessel)
    values (
      v_verein, 'ausruestung.zahlung_beauftragt', 'ausruestungs_anfrage', p_id,
      jsonb_build_object(
        'person', v_person, 'bezeichnung', v_bezeichnung,
        'farbe', v_anfrage.farbe, 'groesse', v_anfrage.groesse,
        'betrag_cent', v_anfrage.vorlage_preis_cent,
        'hinweis', v_hinweis, 'empfaenger_rolle', case when v_anfrage.beschaffungsweg='weg1_obmann_besorgt' then 'obmann' else 'schiri' end),
      'zahlung-beauftragt/' || p_id::text || '/' || v_anfrage.prozess_runde::text)
    on conflict (schluessel) do update set schluessel = excluded.schluessel
    returning id into v_ereignis;
    insert into public.benachrichtigungs_auftraege
      (ereignis_id, empfaenger_schluessel, kanal)
    values (v_ereignis, v_empfaenger, 'email')
    on conflict (ereignis_id, empfaenger_schluessel, kanal) do nothing;
  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.freigabe_zahlungen(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_verein uuid; v_link uuid; v_art text; v_ergebnis jsonb;
begin
  v_verein := public.freigabe_verein(p_token);
  v_link := public.freigabe_link_id(p_token);
  select zugangsart into v_art from public.freigabe_links where id = v_link;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'person', s.name,
    'empfaenger_rolle', case when a.beschaffungsweg='weg1_obmann_besorgt' then 'obmann' else 'schiri' end,
    'bezeichnung', coalesce(pr.bezeichnung,a.kategorie),
    'farbe', a.farbe, 'groesse', a.groesse,
    'preis_cent', a.vorlage_preis_cent,
    'freigabe_am', a.freigabe_am,
    'beauftragt_am', a.zahlung_beauftragt_am,
    'hinweis', a.zahlung_hinweis)
    order by a.zahlung_beauftragt_am, s.name), '[]'::jsonb)
    into v_ergebnis
    from public.ausruestungs_anfragen a
    join public.schiedsrichter s on s.id = a.schiedsrichter_id
    left join public.ausruestung_preise pr
      on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
   where s.verein_id = v_verein and a.typ = 'ausruestung'
     and a.prozess_status = 'zahlung_beauftragt'
     and a.vorlage_am is not null
     and (v_art = 'dauerhaft' or a.vorlage_link_id = v_link);
  return v_ergebnis;
end;
$function$;
CREATE OR REPLACE FUNCTION public.ausruestung_prozess_jsonb(p_anfrage uuid, p_sicht text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a             public.ausruestungs_anfragen%rowtype;
  v_ruecknahme jsonb;
  v_rueckgabe jsonb;
  v_sicht       text := coalesce(p_sicht, 'obmann');
  v_person      text;
  v_bezeichnung text;
  v_weg         text;
  v_erreicht    integer;
  v_letzte      integer;
  v_gestoppt    boolean;
  v_betrag      integer;
  v_quelle      text;
  v_schritte    jsonb := '[]'::jsonb;
  v_ereignisse  jsonb := '[]'::jsonb;
  v_aktionen    jsonb := '[]'::jsonb;
  v_naechster   jsonb := null;
  k             record;
  v_stand       text;
  v_zeit        timestamptz;
  v_wert        text;
begin
  select * into a from public.ausruestungs_anfragen where id = p_anfrage;
  if not found then
    raise exception 'Vorgang nicht gefunden.';
  end if;

  select s.name into v_person
    from public.schiedsrichter s where s.id = a.schiedsrichter_id;

  v_weg := coalesce(a.beschaffungsweg, 'weg2_schiri_besorgt');

  select coalesce(pr.bezeichnung, a.kategorie) into v_bezeichnung
    from public.schiedsrichter s
    left join public.ausruestung_preise pr
           on pr.verein_id = s.verein_id and pr.kategorie = a.kategorie
   where s.id = a.schiedsrichter_id;

  -- Der eingefrorene Vorlagebetrag hat immer Vorrang: was der Vorstand
  -- gesehen hat, ist der Betrag, der gilt.
  v_betrag := coalesce(a.vorlage_preis_cent, a.preis_final_cent,
                       a.preis_schiri_cent, a.preis_richtwert_cent);
  v_quelle := case
                when a.vorlage_preis_cent   is not null then 'vorgelegt'
                when a.preis_final_cent     is not null then 'obmann'
                when a.preis_schiri_cent    is not null then 'schiri'
                when a.preis_richtwert_cent is not null then 'richtwert'
                else 'unbekannt' end;

  select jsonb_build_object('rolle',e.akteur_rolle,'name',e.akteur_name,
    'zeit',e.erstellt_am,'vorheriger_status',e.vorheriger_status,
    'vorheriger_titel',case when e.vorheriger_status is not null then public.ausruestung_schritt_titel(e.vorheriger_status) else null end)
    into v_ruecknahme from public.ausruestung_ereignisse e
    where e.anfrage_id=p_anfrage and e.schritt='zurueckgezogen' and e.runde=a.prozess_runde
    order by e.erstellt_am desc,e.id desc limit 1;
  select jsonb_build_object('rolle',e.akteur_rolle,'name',e.akteur_name,
    'zeit',e.erstellt_am,'vorheriger_status',e.vorheriger_status,
    'vorheriger_titel',public.ausruestung_schritt_titel(e.vorheriger_status))
    into v_rueckgabe from public.ausruestung_ereignisse e
    where e.anfrage_id=p_anfrage and e.schritt in ('eingereicht','geprueft')
     and e.akteur_rolle='obmann' and e.vorheriger_status is not null
     and e.vorheriger_status not in ('eingereicht','geprueft')
    order by e.erstellt_am desc,e.id desc limit 1;
  v_letzte := 11;

  v_erreicht := case a.prozess_status
    when 'eingereicht'        then 1
    when 'geprueft'           then 2
    when 'vorgelegt'          then 3
    when 'freigegeben'        then 4
    when 'abgelehnt'          then 4
    when 'zurueckgezogen'     then case when v_ruecknahme->>'vorheriger_status'='geprueft' then 2 else 1 end
    when 'gekauft'            then 5
    when 'bestellt'           then 5
    when 'beleg_hochgeladen'  then 6
    when 'eingegangen'        then 6
    when 'beleg_geprueft'     then 7
    when 'uebergeben'         then 7
    when 'zahlung_beauftragt' then 8
    when 'zahlung_angewiesen' then 9
    when 'geld_erhalten'      then 10
    when 'abgeschlossen'      then v_letzte
    else 1 end;

  v_gestoppt := a.prozess_status in ('abgelehnt', 'zurueckgezogen');

  for k in select * from public.ausruestung_schritt_katalog(v_weg) loop
    v_zeit := case k.schluessel
      when 'eingereicht'        then a.erstellt_am
      when 'geprueft'           then a.geprueft_am
      when 'vorgelegt'          then a.vorlage_am
      when 'entscheidung'       then a.freigabe_am
      when 'gekauft'            then a.gekauft_am
      when 'beleg_hochgeladen'  then a.rechnung_hochgeladen_am
      when 'beleg_geprueft'     then a.beleg_geprueft_am
      when 'zahlung_beauftragt' then a.zahlung_beauftragt_am
      when 'zahlung_angewiesen' then a.zahlung_angewiesen_am
      when 'geld_erhalten'      then a.geld_erhalten_am
      when 'bestellt'           then a.bestellt_am
      when 'eingegangen'        then a.wareneingang_am
      when 'uebergeben'         then a.abgeholt_am
      when 'abgeschlossen'      then a.abgeschlossen_am
      else null end;

    if v_gestoppt and k.nr > v_erreicht then
      v_stand := 'entfaellt';
    elsif v_gestoppt and k.nr = v_erreicht then
      v_stand := 'gestoppt';
    elsif k.nr <= v_erreicht then
      v_stand := 'erledigt';
    elsif k.nr = v_erreicht + 1 then
      v_stand := 'dran';
    else
      v_stand := 'wartet';
    end if;

    -- Wenn gar nichts zu erstatten ist, entfallen die beiden Geldschritte.
    if a.keine_zahlung_faellig
       and k.schluessel in ('zahlung_beauftragt', 'zahlung_angewiesen', 'geld_erhalten')
       and v_zeit is null then
      v_stand := 'entfaellt';
    end if;

    v_wert := case k.schluessel
      when 'vorgelegt' then
        case when a.vorlage_preis_cent is not null
             then replace(to_char(a.vorlage_preis_cent / 100.0, 'FM999999990.00'), '.', ',') || ' €'
             else null end
      when 'entscheidung'       then a.freigabe_name
      when 'zahlung_beauftragt' then a.zahlung_beauftragt_von
      when 'zahlung_angewiesen' then a.zahlung_angewiesen_von
      when 'geld_erhalten'      then a.geld_erhalten_von
      else null end;

    v_schritte := v_schritte || jsonb_build_object(
      'nr', k.nr,
      'schluessel', k.schluessel,
      'titel', case when v_sicht='schiri' and v_weg='weg1_obmann_besorgt' and k.schluessel='eingegangen' then 'Bei Max angekommen · abholbereit' else k.titel end,
      'rolle', k.rolle,
      'stand', v_stand,
      'zeitpunkt', v_zeit,
      'wert', v_wert);
  end loop;

  -- Welche Aktionen darf genau diese Sicht jetzt ausloesen? Der Client
  -- rendert daraus Knoepfe - er entscheidet nicht selbst, was erlaubt ist.
  select coalesce(jsonb_agg(jsonb_build_object(
           'schritt', u.nach,
           'titel', coalesce((select c.titel from public.ausruestung_schritt_katalog(v_weg) c where c.schluessel=u.nach),
             public.ausruestung_schritt_titel(u.nach))) order by u.nach), '[]'::jsonb)
    into v_aktionen
    from public.ausruestung_uebergaenge() u
   where u.von = a.prozess_status
     and (u.weg = 'beide' or u.weg = v_weg)
     and v_sicht = any(u.rollen)
     and not (v_sicht = 'obmann' and u.nach = 'zahlung_angewiesen')
     and not (u.nach='abgeschlossen' and a.prozess_status in ('uebergeben','beleg_geprueft') and not a.keine_zahlung_faellig);

  select jsonb_build_object('schluessel', x.schluessel, 'titel', x.titel, 'rolle', x.rolle)
    into v_naechster
    from jsonb_to_recordset(v_schritte)
         as x(nr integer, schluessel text, titel text, rolle text, stand text)
   where x.stand = 'dran'
   order by x.nr
   limit 1;

  if v_sicht <> 'vorstand' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'schritt', e.schritt,
             'titel', public.ausruestung_schritt_titel(e.schritt),
             'rolle', e.akteur_rolle,
             'name', e.akteur_name,
             -- Interne Obmann-Notizen sind nichts fuer den
             -- Schiedsrichter. Eine Ablehnungsbegruendung schon.
             'notiz', case when v_sicht = 'schiri'
                             and e.akteur_rolle = 'obmann'
                             and e.schritt <> 'abgelehnt'
                           then null else e.notiz end,
             'betrag_cent', e.betrag_cent,
             'runde', e.runde,
             'erstellt_am', e.erstellt_am) order by e.erstellt_am, e.id), '[]'::jsonb)
      into v_ereignisse
      from public.ausruestung_ereignisse e
     where e.anfrage_id = p_anfrage;
  end if;

  -- Für den Schiri endet der Vereinsweg bei seinem Erhalt. Finanzschritte
  -- gehören ausschließlich zu Max und Vorstand, nicht in seine Aufgabenliste.
  if v_sicht='schiri' and v_weg='weg1_obmann_besorgt' then
    select coalesce(jsonb_agg(t order by (t->>'nr')::int),'[]'::jsonb) into v_schritte
      from jsonb_array_elements(v_schritte) t where (t->>'nr')::int<=7;
    if a.abgeholt_am is not null then v_naechster:=null; end if;
    select coalesce(jsonb_agg(e),'[]'::jsonb) into v_ereignisse
      from jsonb_array_elements(v_ereignisse) e
      where e->>'schritt' not in ('zahlung_beauftragt','zahlung_angewiesen','geld_erhalten','abgeschlossen');
  end if;

  return jsonb_build_object(
    'id', a.id,
    'ruecknahme',v_ruecknahme,
    'rueckgabe',v_rueckgabe,
    'person', v_person,
    'bezeichnung', coalesce(v_bezeichnung, 'Ausrüstung'),
    'kategorie', a.kategorie,
    'farbe', a.farbe,
    'groesse', a.groesse,
    'aermellaenge', a.aermellaenge,
    'anmerkung', a.anmerkung,
    'weg', v_weg,
    'prozess_status', a.prozess_status,
    'prozess_titel', public.ausruestung_schritt_titel(a.prozess_status),
    'runde', a.prozess_runde,
    'betrag_cent', v_betrag,
    'betrag_quelle', v_quelle,
    'vorlage_preis_cent', a.vorlage_preis_cent,
    'beschaffungsweg_aenderbar', a.prozess_status in ('eingereicht','geprueft','vorgelegt','freigegeben')
       and a.gekauft_am is null and a.bestellt_am is null,
    'freigabe_dokumentierbar', a.prozess_status='vorgelegt',
    'schiri_abgeschlossen', v_weg='weg1_obmann_besorgt' and a.abgeholt_am is not null,
    'erstattung_empfaenger', case when v_weg='weg1_obmann_besorgt' then 'obmann' else 'schiri' end,
    'preis_aenderbar', a.prozess_status in ('eingereicht', 'geprueft'),
    'keine_zahlung_faellig', a.keine_zahlung_faellig,
    'beleg_vorhanden', a.rechnung_hochgeladen_am is not null,
    'notiz_obmann', case when v_sicht = 'obmann' then a.notiz_obmann else null end,
    'freigabe_name', a.freigabe_name,
    'freigabe_notiz', a.freigabe_notiz,
    'freigabe_am', a.freigabe_am,
    'erstellt_am', a.erstellt_am,
    'fortschritt', case when v_sicht='schiri' and v_weg='weg1_obmann_besorgt' then round(least(v_erreicht,7)::numeric/7,3) else round(least(v_erreicht, v_letzte)::numeric / v_letzte::numeric, 3) end,
    'naechster_schritt', v_naechster,
    'meine_aktionen', v_aktionen,
    'schritte', v_schritte,
    'ereignisse', v_ereignisse);
end;
$function$;

-- Eigenständige Aktion statt obmann_anfrage_pruefen: kein Zurücksetzen der
-- Vorstandsvorlage, kein Umzeichnen alter Ereignisse, kein Preiswechsel.
create or replace function public.obmann_anfrage_bestellweg_aendern(
 p_passwort text,p_id uuid,p_beschaffungsweg text,p_bisheriger_weg text,p_grund text)
returns void language plpgsql security definer set search_path='' as $$
declare v uuid; a public.ausruestungs_anfragen%rowtype; g text:=nullif(btrim(p_grund),'');
begin
 v:=public.obmann_verein(p_passwort);
 select t.* into a from public.ausruestungs_anfragen t join public.schiedsrichter s on s.id=t.schiedsrichter_id
 where t.id=p_id and s.verein_id=v and t.typ='ausruestung' for update of t;
 if not found then raise exception 'Vorgang nicht gefunden.'; end if;
 if p_beschaffungsweg is null or p_beschaffungsweg not in ('weg1_obmann_besorgt','weg2_schiri_besorgt') then raise exception 'Unbekannter Bestellweg.'; end if;
 if coalesce(a.beschaffungsweg,'weg2_schiri_besorgt')=p_beschaffungsweg then return; end if;
 if p_bisheriger_weg is distinct from coalesce(a.beschaffungsweg,'weg2_schiri_besorgt') then raise exception 'Der Bestellweg wurde inzwischen geändert. Bitte neu laden.'; end if;
 if a.prozess_status not in ('eingereicht','geprueft','vorgelegt','freigegeben') or a.gekauft_am is not null
    or a.bestellt_am is not null or a.abgeholt_am is not null or a.rechnung_hochgeladen_am is not null then
   raise exception 'Nach Kauf oder Bestellung lässt sich der Bestellweg nicht mehr umschalten.'; end if;
 if g is null or char_length(g)<5 or char_length(g)>500 then raise exception 'Bitte den Grund in 5 bis 500 Zeichen festhalten.'; end if;
 update public.ausruestungs_anfragen set beschaffungsweg=p_beschaffungsweg,schiri_gesehen=false,aktualisiert_am=now() where id=p_id;
 insert into public.ausruestung_ereignisse(anfrage_id,verein_id,runde,schritt,akteur_rolle,akteur_name,notiz,betrag_cent,eingang,schluessel)
 values(p_id,v,a.prozess_runde,'beschaffungsweg_geaendert','obmann','Obmann',
   case when p_beschaffungsweg='weg1_obmann_besorgt' then 'Schiri kauft → Verein bestellt. ' else 'Verein bestellt → Schiri kauft. ' end ||g,
   a.vorlage_preis_cent,false,p_id::text||':bestellweg:'||gen_random_uuid()::text);
end $$;
revoke all on function public.obmann_anfrage_bestellweg_aendern(text,uuid,text,text,text) from public;
grant execute on function public.obmann_anfrage_bestellweg_aendern(text,uuid,text,text,text) to anon,authenticated;

-- Dokumentation einer tatsächlich extern getroffenen Entscheidung.
-- Keine eigene Geldfreigabe des Obmanns und kein fingiertes Vorstandslogin.
create or replace function public.obmann_anfrage_freigabe_dokumentieren(
 p_passwort text,p_id uuid,p_name text,p_notiz text)
returns void language plpgsql security definer set search_path='' as $$
declare v uuid; a public.ausruestungs_anfragen%rowtype;
 n text:=nullif(btrim(p_name),''); t text:=nullif(btrim(p_notiz),'');
begin
 v:=public.obmann_verein(p_passwort);
 if n is null or char_length(n)<2 or char_length(n)>80 or t is null or char_length(t)<10 or char_length(t)>500 then
   raise exception 'Name und nachvollziehbare Gesprächsnotiz (10 bis 500 Zeichen) erforderlich.'; end if;
 select x.* into a from public.ausruestungs_anfragen x join public.schiedsrichter s on s.id=x.schiedsrichter_id
 where x.id=p_id and s.verein_id=v and x.typ='ausruestung' for update of x;
 if not found then raise exception 'Vorgang nicht gefunden.'; end if;
 -- Wiederholung derselben gespeicherten Bestätigung ist unschädlich.
 if a.prozess_status='freigegeben' and a.freigabe_name=n||' · extern durch Obmann dokumentiert'
   and a.freigabe_notiz='Externe Vorstandsfreigabe, durch Obmann erfasst: '||t then return; end if;
 if a.prozess_status<>'vorgelegt' then raise exception 'Nur eine vorgelegte Anfrage kann so bestätigt werden.'; end if;
 perform public.ausruestung_uebergang(p_id,'freigegeben','vorstand',
   n||' · extern durch Obmann dokumentiert','Externe Vorstandsfreigabe, durch Obmann erfasst: '||t);
end $$;
revoke all on function public.obmann_anfrage_freigabe_dokumentieren(text,uuid,text,text) from public;
grant execute on function public.obmann_anfrage_freigabe_dokumentieren(text,uuid,text,text) to anon,authenticated;
