-- Live-Migrationskennung: 20261014143213 (nach CLI-Anlage mit MCP angewandt).
-- Personenorientierte Beschaffung, verschlüsselt wiederabrufbare neue Links
-- und ein klar abgegrenzter visueller Redaktionspilot. Keine Bestandslinks
-- werden ersetzt, keine öffentlichen Inhalte automatisch veröffentlicht.
create schema if not exists private;
create table private.freigabe_link_geheimnisse (
  link_id uuid primary key references public.freigabe_links(id) on delete cascade,
  geheimnis_id uuid not null unique references vault.secrets(id)
);
alter table private.freigabe_link_geheimnisse enable row level security;
revoke all on private.freigabe_link_geheimnisse from public, anon, authenticated;

create function private.freigabe_token_sichern(p_id uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_geheimnis uuid;
begin
  if not exists(select 1 from public.freigabe_links where id=p_id
    and token_abdruck=encode(extensions.digest(p_token,'sha256'),'hex')) then
    raise exception 'Link und Token passen nicht zusammen.';
  end if;
  v_geheimnis := vault.create_secret(p_token, 'freigabelink:' || p_id::text, 'Wiederaufruf nur durch zuständigen Obmann');
  insert into private.freigabe_link_geheimnisse values(p_id,v_geheimnis);
end $$;
revoke all on function private.freigabe_token_sichern(uuid,text) from public,anon,authenticated;

create or replace function public.obmann_freigabe_link_erstellen(
 p_passwort text,p_tage integer default 30,p_beschriftung text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_token text; v_id uuid; v_tage integer;
begin
 v_verein := public.obmann_verein(p_passwort);
 v_tage := least(greatest(coalesce(p_tage,30),1),365);
 v_token := translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
 insert into public.freigabe_links(verein_id,token_abdruck,beschriftung,gueltig_bis)
 values(v_verein,encode(extensions.digest(v_token,'sha256'),'hex'),nullif(btrim(coalesce(p_beschriftung,'')),''),now()+make_interval(days=>v_tage)) returning id into v_id;
 perform private.freigabe_token_sichern(v_id,v_token);
 return v_token;
end $$;

create or replace function public.obmann_verantwortlichen_zugang_erstellen(
 p_passwort text,p_name text,p_rolle text default 'Vorstand')
returns text language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_name text:=btrim(coalesce(p_name,'')); v_rolle text:=btrim(coalesce(p_rolle,'')); v_token text; v_id uuid;
begin
 v_verein := public.obmann_verein(p_passwort);
 if char_length(v_name) not between 2 and 100 then raise exception 'Bitte den Namen der verantwortlichen Person eintragen.'; end if;
 if char_length(v_rolle) not between 2 and 100 then raise exception 'Bitte die Rolle der verantwortlichen Person eintragen.'; end if;
 if exists(select 1 from public.freigabe_links l where l.verein_id=v_verein and l.zugangsart='dauerhaft'
   and l.widerrufen_am is null and lower(btrim(l.verantwortlicher_name))=lower(v_name)) then
   raise exception 'Fuer diese Person gibt es bereits einen aktiven Dauerzugang.';
 end if;
 v_token := translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
 insert into public.freigabe_links(verein_id,token_abdruck,beschriftung,gueltig_bis,zugangsart,verantwortlicher_name,verantwortlicher_rolle)
 values(v_verein,encode(extensions.digest(v_token,'sha256'),'hex'),v_name||' · '||v_rolle,null,'dauerhaft',v_name,v_rolle) returning id into v_id;
 perform private.freigabe_token_sichern(v_id,v_token);
 return v_token;
end $$;

create function public.obmann_freigabe_link_abrufen(p_passwort text,p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_token text;
begin
 v_verein:=public.obmann_verein(p_passwort);
 if not exists(select 1 from public.freigabe_links where id=p_id and verein_id=v_verein
   and widerrufen_am is null and (gueltig_bis is null or gueltig_bis>now())) then
   raise exception 'Dieser Link ist nicht verfügbar, abgelaufen oder widerrufen.';
 end if;
 select s.decrypted_secret into v_token from private.freigabe_link_geheimnisse g
 join vault.decrypted_secrets s on s.id=g.geheimnis_id where g.link_id=p_id;
 if v_token is null then raise exception 'Dieser ältere Link wurde nur als Hash gespeichert. Bitte den vorhandenen Original-Link verwenden oder ausdrücklich einen neuen Zugang erzeugen.'; end if;
 return v_token;
end $$;
revoke all on function public.obmann_freigabe_link_abrufen(text,uuid) from public;
grant execute on function public.obmann_freigabe_link_abrufen(text,uuid) to anon,authenticated;

-- Ergänzung ohne Änderungen an Schritten, Aktionen oder Rollen des Prozesses.
create or replace function public.obmann_prozess_liste(p_passwort text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_verein uuid; v_liste jsonb;
begin
 v_verein:=public.obmann_verein(p_passwort);
 select coalesce(jsonb_agg(x.p order by x.dringend desc,x.erstellt_am desc),'[]'::jsonb) into v_liste
 from (select public.ausruestung_prozess_jsonb(a.id,'obmann') || jsonb_build_object('schiedsrichter_id',a.schiedsrichter_id) as p,
   (a.prozess_status in ('eingereicht','beleg_hochgeladen','freigegeben','zahlung_angewiesen')) as dringend,a.erstellt_am
   from public.ausruestungs_anfragen a join public.schiedsrichter s on s.id=a.schiedsrichter_id
   where s.verein_id=v_verein and a.typ='ausruestung') x;
 return v_liste;
end $$;

create table public.website_blockseiten (
 seitenschluessel text not null, seite text not null check(seite in ('dfbnet','sonderbericht','schiri-treff')),
 revision bigint not null default 0, entwurf jsonb, veroeffentlicht jsonb,
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 primary key(seitenschluessel,seite),
 check(octet_length(entwurf::text)<=200000),check(octet_length(veroeffentlicht::text)<=200000)
);
alter table public.website_blockseiten enable row level security;
revoke all on public.website_blockseiten from public,anon,authenticated;
-- Nie SELECT auf die ganze Tabelle vergeben: die Entwurfsspalte ist privat.
grant select(seitenschluessel,seite,veroeffentlicht) on public.website_blockseiten to anon,authenticated;
create policy "Nur veröffentlichte Blockseiten lesen" on public.website_blockseiten for select to anon,authenticated using(veroeffentlicht is not null);

create table private.website_blockversionen (
 id uuid primary key default gen_random_uuid(), seitenschluessel text not null, seite text not null,
 inhalt jsonb not null, erstellt_am timestamptz not null default now(),
 foreign key(seitenschluessel,seite) references public.website_blockseiten on delete cascade
);
create index website_blockversionen_seite_datum on private.website_blockversionen(seitenschluessel,seite,erstellt_am desc);
alter table private.website_blockversionen enable row level security;
revoke all on private.website_blockversionen from public,anon,authenticated;

create function private.blockredaktion_pruefen(p_seitenschluessel text,p_seite text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or (auth.jwt()->>'aal') is distinct from 'aal2' or not exists(
  select 1 from public.website_redakteure where user_id=auth.uid() and seitenschluessel=p_seitenschluessel)
 then raise exception 'Redaktionszugriff erfordert die berechtigte Anmeldung mit zweitem Faktor.' using errcode='42501'; end if;
 if p_seite not in ('dfbnet','sonderbericht','schiri-treff') or p_seite is null then raise exception 'Unbekannte Pilotseite.'; end if;
end $$;
revoke all on function private.blockredaktion_pruefen(text,text) from public,anon,authenticated;

create function private.block_url_ok(p_url text,p_bild boolean default false) returns boolean
language sql immutable set search_path = '' as $$
 select coalesce(length(p_url) between 1 and 12000 and p_url !~ '[[:space:]\\[:cntrl:]]' and p_url !~ '^//'
 and (p_url ~ '^https://[^/@]+(/|$)' or (not p_bild and p_url ~ '^tel:\+?[0-9]{5,20}$')
 or (p_url ~ '^([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_.-]+(#[a-zA-Z0-9_-]+)?$' and p_url !~ '(^|/)\.\.(/|$)')
 or (not p_bild and p_url ~ '^#[a-zA-Z0-9_-]+$')),false)
$$;
revoke all on function private.block_url_ok(text,boolean) from public,anon,authenticated;

create function private.blockinhalt_pruefen(p_inhalt jsonb) returns void
language plpgsql set search_path = '' as $$
declare b jsonb; e jsonb; k text; ids text[]:='{}';
begin
 if jsonb_typeof(p_inhalt) is distinct from 'object' or p_inhalt->>'version' is distinct from '1'
   or jsonb_typeof(p_inhalt->'bloecke') is distinct from 'array' or octet_length(p_inhalt::text)>200000
 then raise exception 'Ungültiger Seiteninhalt.'; end if;
 if jsonb_array_length(p_inhalt->'bloecke') not between 1 and 60 then raise exception '1 bis 60 Blöcke erforderlich.'; end if;
 for b in select value from jsonb_array_elements(p_inhalt->'bloecke') loop
  if jsonb_typeof(b) is distinct from 'object' or coalesce(b->>'typ','') not in ('absatz','ueberschrift','liste','hinweis','bild','schritte','link','quelle')
   or coalesce(b->>'layout','') not in ('normal','zweispaltig','bild-neben-text') or coalesce(b->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
   or b->>'id'=any(ids) then raise exception 'Ungültiger Block.'; end if;
  ids:=array_append(ids,b->>'id');
  for k in select unnest(array['titel','text','url','alt','beschriftung','stand']) loop
   if b ? k and (jsonb_typeof(b->k) is distinct from 'string' or length(b->>k)>12000) then raise exception 'Ungültiges Textfeld.'; end if;
  end loop;
  if b->>'typ' in ('absatz','ueberschrift','hinweis') and length(btrim(coalesce(b->>'text','')))=0 then raise exception 'Blocktext fehlt.'; end if;
  if b->>'typ' in ('bild','link','quelle') and not private.block_url_ok(b->>'url',b->>'typ'='bild') then raise exception 'Ungültige URL.'; end if;
  if b->>'typ'='bild' and length(btrim(coalesce(b->>'alt','')))=0 then raise exception 'Bildbeschreibung fehlt.'; end if;
  if b->>'typ'='quelle' and coalesce(b->>'stand','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Quellenstand fehlt.'; end if;
  if b->>'typ' in ('liste','schritte') then
   if jsonb_typeof(b->'eintraege') is distinct from 'array' then raise exception 'Listeneinträge fehlen.'; end if;
   if jsonb_array_length(b->'eintraege') not between 1 and 30 then raise exception '1 bis 30 Listeneinträge erforderlich.'; end if;
   for e in select value from jsonb_array_elements(b->'eintraege') loop
    if jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'text') is distinct from 'string'
      or length(btrim(coalesce(e->>'text',''))) not between 1 and 12000
      or length(coalesce(e->>'titel',''))>1000 then raise exception 'Ungültiger Listeneintrag.'; end if;
    if coalesce(e->>'url','')<>'' and (not private.block_url_ok(e->>'url',true) or length(btrim(coalesce(e->>'alt','')))=0) then raise exception 'Screenshot braucht sichere URL und Bildbeschreibung.'; end if;
   end loop;
  end if;
 end loop;
end $$;
revoke all on function private.blockinhalt_pruefen(jsonb) from public,anon,authenticated;

create function public.website_blockseite_redaktion(p_seitenschluessel text,p_seite text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.website_blockseiten; v jsonb;
begin
 perform private.blockredaktion_pruefen(p_seitenschluessel,p_seite);
 select * into r from public.website_blockseiten where seitenschluessel=p_seitenschluessel and seite=p_seite;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v from (select id,inhalt,erstellt_am from private.website_blockversionen
   where seitenschluessel=p_seitenschluessel and seite=p_seite order by erstellt_am desc limit 8) x;
 return jsonb_build_object('revision',coalesce(r.revision,0),'entwurf',r.entwurf,'veroeffentlicht',r.veroeffentlicht,'versionen',v);
end $$;
revoke all on function public.website_blockseite_redaktion(text,text) from public,anon;
grant execute on function public.website_blockseite_redaktion(text,text) to authenticated;

create function public.website_blockseite_speichern(p_seitenschluessel text,p_seite text,p_inhalt jsonb,p_revision bigint,p_veroeffentlichen boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.website_blockseiten;
begin
 perform private.blockredaktion_pruefen(p_seitenschluessel,p_seite);
 perform private.blockinhalt_pruefen(p_inhalt);
 insert into public.website_blockseiten(seitenschluessel,seite) values(p_seitenschluessel,p_seite) on conflict do nothing;
 select * into r from public.website_blockseiten where seitenschluessel=p_seitenschluessel and seite=p_seite for update;
 if p_revision is distinct from r.revision then raise exception 'Der Entwurf wurde inzwischen auf einem anderen Gerät geändert. Bitte aktuellen Stand neu laden; deine Änderungen wurden nicht überschrieben.' using errcode='40001'; end if;
 if p_veroeffentlichen and r.veroeffentlicht is not null then
  insert into private.website_blockversionen(seitenschluessel,seite,inhalt) values(p_seitenschluessel,p_seite,r.veroeffentlicht);
 end if;
 update public.website_blockseiten set entwurf=p_inhalt,
  veroeffentlicht=case when p_veroeffentlichen then p_inhalt else veroeffentlicht end,
  revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where seitenschluessel=p_seitenschluessel and seite=p_seite;
 return public.website_blockseite_redaktion(p_seitenschluessel,p_seite);
end $$;
revoke all on function public.website_blockseite_speichern(text,text,jsonb,bigint,boolean) from public,anon;
grant execute on function public.website_blockseite_speichern(text,text,jsonb,bigint,boolean) to authenticated;
