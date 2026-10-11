-- Keep an HRT's complete working period within the selected season.
-- Filename matches the live MCP migration version 20261011183823.
alter table public.termine add constraint termine_hrt_saisonzeitraum check (
  zeitraum_von is null or (punkte_saison is not null
    and zeitraum_von >= make_date(left(punkte_saison,4)::integer,7,1))
);

-- The old writer updates date before the new metadata. For already recorded
-- HRTs retain the old date during that call, then validate date and period
-- together. Unrecorded entries can still change category/season atomically.
create or replace function public.obmann_termin_mit_punkten_speichern(
  p_passwort text,p_titel text,p_datum date,p_oeffentlich boolean,p_art text,p_pflicht boolean,
  p_rueckmeldung_erforderlich boolean,p_veranstalter text,p_erinnerung_modus text,
  p_sichtbarkeit text default null,p_termin_id uuid default null,p_beschreibung text default null,
  p_beginn_zeit time default null,p_ende_zeit time default null,p_ort text default null,
  p_rueckmeldung_bis date default null,p_notiz_obmann text default null,
  p_punkte_saison text default null,p_punkte_art text default null,p_zeitraum_von date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_verein uuid; v_id uuid; v_alt public.termine; v_basis_art text; v_basis_datum date;
begin
  v_verein:=public.obmann_verein(p_passwort);
  select * into v_alt from public.termine t where t.id=p_termin_id and t.verein_id=v_verein for update;
  if p_punkte_saison is not null then
    insert into public.fortbildung_saisons(verein_id,saison) values(v_verein,p_punkte_saison) on conflict do nothing;
  end if;
  if v_alt.id is not null and not exists(select 1 from public.fortbildung_nachweise n where n.termin_id=v_alt.id) then
    update public.termine set art=case when art='hausregeltest' then 'sonstiges' else art end,
      punkte_saison=null,punkte_art=null,zeitraum_von=null where id=v_alt.id;
    v_alt.art:=case when v_alt.art='hausregeltest' then 'sonstiges' else v_alt.art end;
  end if;
  v_basis_art:=case when p_art='hausregeltest' then coalesce(v_alt.art,'sonstiges') else p_art end;
  v_basis_datum:=case when v_alt.art='hausregeltest' then v_alt.datum else p_datum end;
  v_id:=public.obmann_termin_speichern_mit_erinnerung(p_passwort,p_titel,v_basis_datum,p_oeffentlich,
    v_basis_art,p_pflicht,case when p_art='hausregeltest' then false else p_rueckmeldung_erforderlich end,
    p_veranstalter,case when p_art='hausregeltest' then 'aus' else p_erinnerung_modus end,
    p_sichtbarkeit,p_termin_id,p_beschreibung,
    case when p_art='hausregeltest' then null else p_beginn_zeit end,
    case when p_art='hausregeltest' then null else p_ende_zeit end,p_ort,
    case when p_art='hausregeltest' then null else p_rueckmeldung_bis end,p_notiz_obmann);
  update public.termine set art=p_art,datum=p_datum,punkte_saison=p_punkte_saison,
    punkte_art=p_punkte_art,zeitraum_von=p_zeitraum_von where id=v_id;
  return v_id;
end $$;
