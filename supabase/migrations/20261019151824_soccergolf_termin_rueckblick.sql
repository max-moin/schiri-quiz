-- Eigene private Ablage: keine neuen Felder in alten Termin-RPCs/öffentlichen Feeds.
create table private.soccergolf_rueckblicke (
 termin_id uuid primary key references public.termine(id) on delete cascade,
 entwurf jsonb not null,
 veroeffentlicht jsonb,
 revision integer not null default 1,
 aktualisiert_am timestamptz not null default now()
);
alter table private.soccergolf_rueckblicke enable row level security;
revoke all on private.soccergolf_rueckblicke from public,anon,authenticated;

create function private.soccergolf_pruefen(d jsonb) returns void
language plpgsql set search_path='' as $$
declare b integer; p jsonb; n jsonb; namen text[] := '{}'; name text; u text;
begin
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>100000 then raise exception 'Ungültige Ergebnisse'; end if;
 if coalesce(d->>'bahnen','') !~ '^[0-9]{1,2}$' then raise exception 'Anzahl Bahnen fehlt'; end if;
 b:=(d->>'bahnen')::integer;
 if b<1 or b>36 or jsonb_typeof(d->'teilnehmer') is distinct from 'array' then raise exception '1 bis 36 Bahnen und eine Teilnehmerliste sind erforderlich'; end if;
 if jsonb_array_length(d->'teilnehmer')>60 then raise exception 'Maximal 60 Personen'; end if;
 for p in select value from jsonb_array_elements(d->'teilnehmer') loop
  name:=btrim(coalesce(p->>'name',''));
  if name='' or length(name)>80 or lower(name)=any(namen) then raise exception 'Bitte eindeutige Namen bis 80 Zeichen verwenden'; end if;
  namen:=array_append(namen,lower(name));
  if jsonb_typeof(p->'schlaege') is distinct from 'array' then raise exception 'Bahnwerte fehlen'; end if;
  if jsonb_array_length(p->'schlaege')<>b then raise exception 'Die Anzahl der Bahnwerte passt nicht'; end if;
  for n in select value from jsonb_array_elements(p->'schlaege') loop
   if n<>'null'::jsonb then
    if jsonb_typeof(n)<>'number' or n::text !~ '^[0-9]{1,2}$' then raise exception 'Bahnwerte: ganze Zahlen 1 bis 99 oder leer'; end if;
    if (n::text)::integer<1 then raise exception 'Null ist kein leerer Bahnwert'; end if;
   end if;
  end loop;
 end loop;
 if jsonb_typeof(d->'text') is distinct from 'string' or length(d->>'text')>2000 then raise exception 'Rückblick: maximal 2000 Zeichen'; end if;
 if length(coalesce(d->>'plan_quelle',''))>200 then raise exception 'Bildquelle: maximal 200 Zeichen'; end if;
 u:=coalesce(d->>'plan_link','');
 if length(u)>2000 or (u<>'' and (u !~ '^https://[^/@[:space:]]+\.[^/@[:space:]]+(/[^[:space:]]*)?$' or u ~ '[<>]')) then raise exception 'Bitte einen vollständigen HTTPS-Link zum Anlagenplan verwenden'; end if;
 u:=coalesce(d->>'plan_bild','');
 if u<>'' and (length(u)>2000 or position('..' in u)>0 or not (
  u ~* '^bilder/[a-z0-9_./-]+\.(png|jpe?g|webp)$' or
  u ~* '^https://ivwmixaicpmtvcjtnbjv\.supabase\.co/storage/v1/object/public/website-bilder/[a-z0-9_./%-]+\.(png|jpe?g|webp)$'
 )) then raise exception 'Planbild muss aus euren Website-Bildern stammen'; end if;
end $$;
revoke all on function private.soccergolf_pruefen(jsonb) from public,anon,authenticated;

create function public.obmann_soccergolf_liste(p_passwort text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.obmann_verein(p_passwort); ergebnis jsonb;
begin
 select coalesce(jsonb_agg(x order by x.datum desc,x.titel),'[]'::jsonb) into ergebnis from (
  select t.id,t.titel,t.datum,r.entwurf,r.veroeffentlicht,coalesce(r.revision,0) as revision
  from public.termine t left join private.soccergolf_rueckblicke r on r.termin_id=t.id
  where t.verein_id=v and t.art='event' and t.datum<=(now() at time zone 'Europe/Berlin')::date
  order by t.datum desc limit 250
 ) x;return ergebnis;
end $$;

create function public.obmann_soccergolf_speichern(p_passwort text,p_termin_id uuid,p_inhalt jsonb,p_revision integer,p_aktion text default 'entwurf') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid:=public.obmann_verein(p_passwort); t public.termine; r private.soccergolf_rueckblicke; publ jsonb;
begin
 if p_aktion is null or p_aktion not in ('entwurf','veroeffentlichen','zurueckziehen') then raise exception 'Unbekannte Aktion'; end if;
 select * into t from public.termine where id=p_termin_id and verein_id=v for update;
 if not found or t.art<>'event' or t.datum>(now() at time zone 'Europe/Berlin')::date then raise exception 'Vergangenes Event nicht gefunden'; end if;
 select * into r from private.soccergolf_rueckblicke where termin_id=p_termin_id;
 if p_revision is distinct from coalesce(r.revision,0) then raise exception 'Der Rückblick wurde inzwischen geändert. Bitte neu laden'; end if;
 perform private.soccergolf_pruefen(p_inhalt);
 publ:=r.veroeffentlicht;
 if p_aktion='veroeffentlichen' then
  if t.sichtbarkeit='nur_app' then raise exception 'Der Termin ist noch nicht für Mitglieder sichtbar'; end if;
  if p_inhalt->'freigabe_geprueft' is distinct from 'true'::jsonb or jsonb_array_length(p_inhalt->'teilnehmer')=0 then raise exception 'Bitte Ergebnisse sowie Namensanzeige und Bildrechte prüfen'; end if;
  publ:=p_inhalt;
 elsif p_aktion='zurueckziehen' then publ:=null; end if;
 insert into private.soccergolf_rueckblicke(termin_id,entwurf,veroeffentlicht,revision)
 values(p_termin_id,p_inhalt,publ,coalesce(r.revision,0)+1)
 on conflict(termin_id) do update set entwurf=excluded.entwurf,veroeffentlicht=excluded.veroeffentlicht,revision=excluded.revision,aktualisiert_am=now()
 returning * into r;
 return jsonb_build_object('entwurf',r.entwurf,'veroeffentlicht',r.veroeffentlicht,'revision',r.revision);
end $$;

create function public.soccergolf_fuer_schiri(p_schiedsrichter_id uuid,p_pin text,p_termin_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v uuid:=public.schiri_pin_pruefen(p_schiedsrichter_id,p_pin); d jsonb;
begin
 select r.veroeffentlicht into d from private.soccergolf_rueckblicke r join public.termine t on t.id=r.termin_id
 where t.id=p_termin_id and t.verein_id=v and t.sichtbarkeit in ('nur_verein','oeffentlich')
 and t.datum<=(now() at time zone 'Europe/Berlin')::date;
 return d;
end $$;
revoke all on function public.obmann_soccergolf_liste(text) from public,anon,authenticated;
revoke all on function public.obmann_soccergolf_speichern(text,uuid,jsonb,integer,text) from public,anon,authenticated;
revoke all on function public.soccergolf_fuer_schiri(uuid,text,uuid) from public,anon,authenticated;
-- Absichtlich dieselbe servergeprüfte Passwort-/PIN-Schnittstelle wie bestehende Termine.
grant execute on function public.obmann_soccergolf_liste(text) to anon,authenticated;
grant execute on function public.obmann_soccergolf_speichern(text,uuid,jsonb,integer,text) to anon,authenticated;
grant execute on function public.soccergolf_fuer_schiri(uuid,text,uuid) to anon,authenticated;
