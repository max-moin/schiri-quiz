-- Benötigt termin_absage sowie kickers_stimmungsbild. Beide Funktionen
-- verwenden den bereits serverseitig geprüften Obmann-Vereinszugang.
create function private.obmann_termin_absagen(p_passwort text,p_termin_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_verein uuid:=public.obmann_verein(p_passwort); v_zeit timestamptz;
begin
  update public.termine t set abgesagt_am=clock_timestamp()
    where t.id=p_termin_id and t.verein_id=v_verein and t.abgesagt_am is null
      and t.art<>'hausregeltest' and public.termin_ende_zeitpunkt(t.datum,t.beginn_zeit,t.ende_zeit)>clock_timestamp()
    returning t.abgesagt_am into v_zeit;
  if v_zeit is null then
    select t.abgesagt_am into v_zeit from public.termine t where t.id=p_termin_id and t.verein_id=v_verein;
  end if;
  if v_zeit is null then
    raise exception 'Kein absagbarer fester Termin für diesen Verein.' using errcode='22023';
  end if;
  return v_zeit::text;
end $$;
revoke all on function private.obmann_termin_absagen(text,uuid) from public,anon,authenticated;
grant execute on function private.obmann_termin_absagen(text,uuid) to anon,authenticated;
create function public.obmann_termin_absagen(p_passwort text,p_termin_id uuid) returns text
language sql security invoker set search_path='' return private.obmann_termin_absagen(p_passwort,p_termin_id);
revoke all on function public.obmann_termin_absagen(text,uuid) from public,anon,authenticated;
grant execute on function public.obmann_termin_absagen(text,uuid) to anon,authenticated;

-- Additives JSON-Feld: bisherige App-DTOs und Berechtigungen bleiben gültig.
create or replace function public.obmann_termine_mit_fortbildung(p_passwort text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_verein uuid:=public.obmann_verein(p_passwort);
begin
 return coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object(
 'punkte_saison',t.punkte_saison,'punkte_art',t.punkte_art,'zeitraum_von',t.zeitraum_von,'abgesagt_am',t.abgesagt_am,
 'unsicher',case when t.rueckmeldung_erforderlich then u.anzahl else 0 end) order by x.datum,x.beginn_zeit)
 from public.obmann_termine_mit_stand(p_passwort) x join public.termine t on t.id=x.id and t.verein_id=v_verein
 left join lateral(select count(*) as anzahl from public.termin_rueckmeldungen r
 join public.schiedsrichter s on s.id=r.schiedsrichter_id
 where r.termin_id=t.id and r.status='unsicher' and s.verein_id=v_verein and s.aktiv and not s.ist_test) u on true),'[]'::jsonb);
end $$;

-- Der private Umfragedatensatz wird nur nach Prüfung DESSELBEN Vereins
-- gelesen. Die Vereinskennung der Teilnehmer kann diese Prüfung nicht passieren.
create function private.obmann_kickers_umfrage(p_passwort text,p_aktion text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_verein uuid:=public.obmann_verein(p_passwort); u private.kickers_umfrage%rowtype;
begin
  if not exists(select 1 from public.vereine v where v.id=v_verein and v.oeffentliche_kennung='loebtauer-kickers') then
    raise exception 'Kein Obmann-Zugriff für diese Vereinsumfrage.' using errcode='42501';
  end if;
  if p_aktion is null or p_aktion not in ('stand','oeffnen','schliessen') then
    raise exception 'Ungültige Aktion.' using errcode='22023';
  end if;
  if p_aktion='oeffnen' then
    update private.kickers_umfrage k set stand='offen' where k.verein=v_verein
      and k.stand='entwurf' and (k.schliesst_am is null or k.schliesst_am>clock_timestamp())
      and exists(select 1 from private.kickers_umfrage_teilnahme p join public.schiedsrichter s on s.id=p.person
                 where s.verein_id=v_verein and s.aktiv);
  elsif p_aktion='schliessen' then
    update private.kickers_umfrage k set stand='geschlossen' where k.verein=v_verein and k.stand='offen';
  end if;
  select * into u from private.kickers_umfrage k where k.verein=v_verein and k.einmalig;
  if not found then return '{"stand":"nicht_eingerichtet","personen":[]}'; end if;
  return jsonb_build_object(
    'stand', case when u.stand='offen' and u.schliesst_am<=clock_timestamp() then 'geschlossen' else u.stand end,
    'personen', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'antwort',k.antwort) order by s.name,s.id)
      from private.kickers_umfrage_teilnahme k join public.schiedsrichter s on s.id=k.person
      where s.verein_id=v_verein and (s.aktiv or k.antwort is not null)), '[]'::jsonb));
end $$;
revoke all on function private.obmann_kickers_umfrage(text,text) from public,anon,authenticated;
grant execute on function private.obmann_kickers_umfrage(text,text) to anon,authenticated;
create function public.obmann_kickers_umfrage(p_passwort text,p_aktion text) returns jsonb
language sql security invoker set search_path='' return private.obmann_kickers_umfrage(p_passwort,p_aktion);
revoke all on function public.obmann_kickers_umfrage(text,text) from public,anon,authenticated;
grant execute on function public.obmann_kickers_umfrage(text,text) to anon,authenticated;
