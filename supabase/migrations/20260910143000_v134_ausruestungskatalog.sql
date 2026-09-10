-- v134: Bestand und Anfragen verwenden denselben erweiterten Katalog.
-- Die Data-API bleibt geschlossen; Zugriff weiterhin nur ueber die
-- PIN-pruefenden RPCs.

alter table public.ausruestungsbestand
  drop constraint if exists ausruestungsbestand_kategorie_check;
alter table public.ausruestungsbestand
  add constraint ausruestungsbestand_kategorie_check check (kategorie in (
    'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
    'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
    'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
  ));

alter table public.ausruestungs_anfragen
  drop constraint if exists ausruestungs_anfragen_kategorie_typ_check;
alter table public.ausruestungs_anfragen
  add constraint ausruestungs_anfragen_kategorie_typ_check check (
    (typ = 'ausruestung' and kategorie in (
      'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
      'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
      'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
    )) or (typ = 'anliegen' and kategorie is null)
  );

create or replace function public.schiri_anfrage_erstellen(
  p_schiedsrichter_id uuid, p_pin text, p_kategorie text,
  p_farbe text default null, p_groesse text default null,
  p_aermellaenge text default null, p_anmerkung text default null,
  p_typ text default 'ausruestung'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  if p_typ not in ('ausruestung', 'anliegen') then
    raise exception 'Ungueltiger Typ: %', p_typ;
  end if;

  if p_typ = 'ausruestung' then
    if p_kategorie not in (
      'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
      'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
      'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
    ) then raise exception 'Ungueltige Kategorie: %', p_kategorie; end if;
    if p_aermellaenge is not null and
       (p_kategorie <> 'trikot' or p_aermellaenge not in ('kurz','lang')) then
      raise exception 'Ungueltige Aermellaenge.';
    end if;
    if p_kategorie = 'sonstiges' and char_length(btrim(coalesce(p_anmerkung,''))) < 2 then
      raise exception 'Bitte das benoetigte Equipment beschreiben.';
    end if;
    insert into public.ausruestungs_anfragen(
      schiedsrichter_id,typ,kategorie,farbe,groesse,aermellaenge,anmerkung
    ) values (
      p_schiedsrichter_id,'ausruestung',p_kategorie,nullif(btrim(p_farbe),''),
      nullif(btrim(p_groesse),''),p_aermellaenge,nullif(btrim(p_anmerkung),'')
    ) returning id into v_id;
  else
    if char_length(btrim(coalesce(p_anmerkung,''))) = 0 then
      raise exception 'Anliegen braucht eine Beschreibung';
    end if;
    insert into public.ausruestungs_anfragen(
      schiedsrichter_id,typ,kategorie,farbe,groesse,aermellaenge,anmerkung
    ) values (p_schiedsrichter_id,'anliegen',null,null,null,null,btrim(p_anmerkung))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.schiri_ausruestungsbestand_speichern(
  p_schiedsrichter_id uuid, p_pin text, p_kategorie text,
  p_bezeichnung text default null, p_farbe text default null,
  p_groesse text default null, p_aermellaenge text default null,
  p_anzahl smallint default 1, p_zustand text default 'einsatzbereit',
  p_anmerkung text default null, p_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin);
  if p_kategorie not in (
       'trikot','hose','stutzen','schuhe','spielnotizkarten','spesenquittungen',
       'schiedsrichtermappe','gelbe_karte','rote_karte','pfeife','headset',
       'funkfahnen','schiedsrichterfahnen','sporttasche','sonstiges'
     ) or coalesce(p_anzahl,0) not between 1 and 20
     or p_zustand not in ('einsatzbereit','ersatz','verschlissen','fehlt')
     or (p_aermellaenge is not null and
         (p_kategorie <> 'trikot' or p_aermellaenge not in ('kurz','lang'))) then
    raise exception 'Ungueltige Bestandsangabe.';
  end if;
  if p_kategorie = 'sonstiges' and
     char_length(btrim(coalesce(p_bezeichnung,''))) not between 2 and 80 then
    raise exception 'Sonstiges Equipment braucht eine Bezeichnung.';
  end if;
  if p_id is null then
    insert into public.ausruestungsbestand(
      schiedsrichter_id,kategorie,bezeichnung,farbe,groesse,aermellaenge,anzahl,zustand,anmerkung
    ) values (p_schiedsrichter_id,p_kategorie,nullif(btrim(p_bezeichnung),''),
      nullif(btrim(p_farbe),''),nullif(btrim(p_groesse),''),p_aermellaenge,p_anzahl,
      p_zustand,nullif(btrim(p_anmerkung),'')) returning id into v_id;
  else
    update public.ausruestungsbestand set kategorie=p_kategorie,
      bezeichnung=nullif(btrim(p_bezeichnung),''),farbe=nullif(btrim(p_farbe),''),
      groesse=nullif(btrim(p_groesse),''),aermellaenge=p_aermellaenge,
      anzahl=p_anzahl,zustand=p_zustand,anmerkung=nullif(btrim(p_anmerkung),''),
      aktualisiert_am=now()
    where id=p_id and schiedsrichter_id=p_schiedsrichter_id returning id into v_id;
    if v_id is null then raise exception 'Bestandseintrag nicht gefunden.'; end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.schiri_anfrage_erstellen(uuid,text,text,text,text,text,text,text)
  from public, anon, authenticated;
revoke execute on function public.schiri_ausruestungsbestand_speichern(uuid,text,text,text,text,text,text,smallint,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.schiri_anfrage_erstellen(uuid,text,text,text,text,text,text,text)
  to anon, authenticated;
grant execute on function public.schiri_ausruestungsbestand_speichern(uuid,text,text,text,text,text,text,smallint,text,text,uuid)
  to anon, authenticated;
