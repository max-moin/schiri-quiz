-- v141: Der Schiri waehlt seinen Beschaffungswunsch bereits beim Antrag.
-- Das vorhandene Feld "beschaffungsweg" bleibt die einzige Quelle der
-- Wahrheit: bei der Annahme kann der Obmann den Wunsch bestaetigen oder
-- aendern. Aeltere Clients, die den neuen Parameter noch nicht senden,
-- erhalten serverseitig weiterhin den Standard "selbst besorgen".

drop function if exists public.schiri_anfrage_erstellen(
  uuid, text, text, text, text, text, text, text
);

create function public.schiri_anfrage_erstellen(
  p_schiedsrichter_id uuid,
  p_pin text,
  p_kategorie text,
  p_farbe text default null,
  p_groesse text default null,
  p_aermellaenge text default null,
  p_anmerkung text default null,
  p_typ text default 'ausruestung',
  p_beschaffungsweg text default 'weg2_schiri_besorgt'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_beschaffungsweg text;
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
    ) then
      raise exception 'Ungueltige Kategorie: %', p_kategorie;
    end if;

    if p_aermellaenge is not null and
       (p_kategorie <> 'trikot' or p_aermellaenge not in ('kurz','lang')) then
      raise exception 'Ungueltige Aermellaenge.';
    end if;

    if p_kategorie = 'sonstiges' and
       char_length(btrim(coalesce(p_anmerkung, ''))) < 2 then
      raise exception 'Bitte das benoetigte Equipment beschreiben.';
    end if;

    v_beschaffungsweg := coalesce(
      nullif(btrim(p_beschaffungsweg), ''),
      'weg2_schiri_besorgt'
    );
    if v_beschaffungsweg not in ('weg1_obmann_besorgt', 'weg2_schiri_besorgt') then
      raise exception 'Ungueltiger Beschaffungsweg: %', v_beschaffungsweg;
    end if;

    insert into public.ausruestungs_anfragen(
      schiedsrichter_id, typ, kategorie, farbe, groesse, aermellaenge,
      anmerkung, beschaffungsweg
    ) values (
      p_schiedsrichter_id, 'ausruestung', p_kategorie,
      nullif(btrim(p_farbe), ''), nullif(btrim(p_groesse), ''),
      p_aermellaenge, nullif(btrim(p_anmerkung), ''), v_beschaffungsweg
    ) returning id into v_id;
  else
    if char_length(btrim(coalesce(p_anmerkung, ''))) = 0 then
      raise exception 'Anliegen braucht eine Beschreibung';
    end if;

    insert into public.ausruestungs_anfragen(
      schiedsrichter_id, typ, kategorie, farbe, groesse, aermellaenge,
      anmerkung, beschaffungsweg
    ) values (
      p_schiedsrichter_id, 'anliegen', null, null, null, null,
      btrim(p_anmerkung), null
    ) returning id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.schiri_anfrage_erstellen(
  uuid, text, text, text, text, text, text, text, text
) is 'Erstellt eine PIN-gepruefte Anfrage; bei Ausruestung wird der Beschaffungswunsch direkt gespeichert (Standard: Schiri besorgt selbst).';

revoke execute on function public.schiri_anfrage_erstellen(
  uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.schiri_anfrage_erstellen(
  uuid, text, text, text, text, text, text, text, text
) to anon, authenticated;
