-- v120: Duell-Modus, zweite Ausbaustufe (04.09.2026, Max' Feedback zum
-- ersten Wurf von Codex). Drei Luecken zum normalen Wochenquiz werden
-- geschlossen:
--
-- 1. FREITEXT OHNE NACHBESSERN. api/duell-freitext.js rief bisher
--    "baueErstversuchPrompt(kontext, text, false)" auf - der dritte
--    Parameter "false" schaltet den Status "nachbessern" (die orange
--    Zwischenstufe mit gezielter Rueckfrage) fuer die KI-Bewertung
--    HART AUS. Ein Duell-Teilnehmer bekam also nie die Chance auf einen
--    zweiten Versuch, die schon beim normalen Quiz existiert (v71/v72,
--    "freitext_antwort_speichern" + "freitext_ergaenzung_speichern").
--    Diese Migration baut dasselbe Muster fuer Duelle nach: neue Spalten
--    auf "duell_antworten" (bewertungsstatus, ki_nachfrage,
--    zweiter_freitext, feedback_final, versuch_anzahl) plus zwei neue
--    RPCs "duell_freitext_ergaenzung_kontext"/"...ergaenzung_speichern".
--
-- 2. KEIN VERGLEICH. Bisher gab es nur "duell_stand" (Gesamtsumme
--    richtig/beantwortet). Max will pro Frage sehen, WAS der/die andere
--    geantwortet hat, sobald man selbst schon geantwortet hat - und ueber
--    den Session-Code jederzeit wieder dahin zurueckfinden (Auswertungs-
--    screen). Neue RPC "duell_verlauf": alle 5 Fragen inkl. Antwort-
--    optionen, pro Teilnehmer der eigene Stand IMMER sichtbar, der
--    fremde Stand nur, wenn man die jeweilige Frage selbst schon
--    beantwortet hat (dieselbe Sperre wie bisher schon bei den
--    Reaktionen - kein Vorab-Spicken).
--
-- 3. REAKTIONEN OHNE NAMEN. "duell_reaktionen_fuer_frage" lieferte nur
--    Zaehler pro Emoji ({"a":2}), nie WER reagiert hat. Fuer das von Max
--    gewuenschte Gimmick (Emoji + Name des Schiedsrichters schwebt kurz
--    ueber der Frage) muss der Name mitkommen. Rueckgabeform geaendert zu
--    einer Liste [{name,emoji,ist_ich}] - Frontend wird beim Umbau der
--    Duell-Seite mit umgestellt.
--
-- Dazu: "duell_meine_liste" (neue RPC) fuer angemeldete Vereinsmitglieder
-- - eine Uebersicht ihrer letzten Duelle (offen+geschlossen), damit man
-- nicht auf lokal gespeicherte Codes angewiesen ist.
--
-- NACHTRAG (selbes Datum): "duell_freitext_speichern" wurde zunaechst per
-- CREATE OR REPLACE um zwei Parameter erweitert - das legt in Postgres
-- aber einen ZWEITEN Overload an statt die Funktion zu ersetzen (Funktions-
-- identitaet = Name + Parametertypliste, nicht nur Name). Genau die aus
-- v85 bekannte PGRST202-Falle. Migration v120b (separate Datei) droppt
-- den alten 5-Parameter-Overload wieder.

alter table public.duell_antworten
  add column bewertungsstatus text,
  add column ki_nachfrage text,
  add column zweiter_freitext text,
  add column feedback_final text,
  add column versuch_anzahl smallint not null default 1;

update public.duell_antworten
  set bewertungsstatus = case when korrekt then 'richtig' else 'falsch' end
  where bewertungsstatus is null;

alter table public.duell_antworten
  alter column bewertungsstatus set not null,
  add constraint duell_antworten_status_check check (bewertungsstatus in ('richtig','nachbessern','falsch')),
  add constraint duell_antworten_versuch_check check (versuch_anzahl between 1 and 2);

-- 1a) Multiple-Choice-Antworten setzen bewertungsstatus jetzt mit (rein
--     additiv, Rueckgabeform unveraendert).
create or replace function public.duell_antwort_auswahl(p_zugang uuid,p_frage_id uuid,p_auswahl text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_t public.duell_teilnehmer%rowtype; v_typ text; v_richtig text[]; v_gegeben text[]; v_ok boolean; v_text jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  select f.antworttyp into v_typ from public.duell_fragen df join public.fragen f on f.id=df.frage_id
   join public.duell_sessions d on d.id=df.session_id where df.session_id=v_t.session_id and df.frage_id=p_frage_id and d.status='offen';
  if v_typ not in ('multiple_choice','mehrfachauswahl') then raise exception 'Falscher Antworttyp'; end if;
  select array_agg(distinct lower(x) order by lower(x)) into v_gegeben from unnest(p_auswahl)x;
  if v_gegeben is null or not v_gegeben<@array['a','b','c','d','e','f','g','h']::text[] then raise exception 'Ungueltige Auswahl'; end if;
  select array_agg(o.schluessel order by o.schluessel),jsonb_agg(o.text order by o.position) filter(where o.ist_richtig)
    into v_richtig,v_text from public.frage_antwortoptionen o where o.frage_id=p_frage_id;
  if v_richtig is null then select array[f.richtige_option],jsonb_build_array(case f.richtige_option when 'a' then f.option_a when 'b' then f.option_b else f.option_c end) into v_richtig,v_text from public.fragen f where f.id=p_frage_id; end if;
  v_ok:=v_gegeben=v_richtig;
  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebene_auswahl,korrekt,bewertungsstatus)
    values(v_t.id,p_frage_id,v_gegeben,v_ok,case when v_ok then 'richtig' else 'falsch' end)
   on conflict(teilnehmer_id,frage_id) do nothing;
  if not found then raise exception 'Diese Frage wurde schon beantwortet.'; end if;
  return jsonb_build_object('korrekt',v_ok,'richtige_auswahl',v_richtig,'richtige_texte',v_text);
end; $$;

-- 1b) Freitext-Erstversuch: jetzt mit Status/Nachfrage statt nur einem
--     harten korrekt-Boolean. Neue Parameter ans Ende angehaengt, mit
--     Standardwerten - Aufrufer, die sie weglassen, verhalten sich wie
--     vorher (reiner richtig/falsch-Fall).
create or replace function public.duell_freitext_speichern(
  p_zugang uuid, p_frage_id uuid, p_text text, p_korrekt boolean, p_feedback text,
  p_status text default null, p_nachfrage text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; v_loesung text; v_status text; v_nachfrage text; begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t join public.duell_fragen df on df.session_id=t.session_id
   join public.duell_sessions d on d.id=t.session_id where t.zugang=p_zugang and df.frage_id=p_frage_id and d.status='offen';
  if v_tid is null then raise exception 'Frage nicht verfuegbar'; end if;
  if exists(select 1 from public.duell_antworten where teilnehmer_id=v_tid and frage_id=p_frage_id) then
    raise exception 'Diese Frage wurde schon beantwortet.';
  end if;

  v_status := coalesce(nullif(btrim(coalesce(p_status,'')),''), case when p_korrekt then 'richtig' else 'falsch' end);
  if v_status not in ('richtig','nachbessern','falsch') then
    v_status := case when p_korrekt then 'richtig' else 'falsch' end;
  end if;
  v_nachfrage := nullif(btrim(coalesce(p_nachfrage,'')),'');
  if v_status='nachbessern' and v_nachfrage is null then
    v_nachfrage := 'Begruende bitte noch kurz, warum du so entscheidest.';
  end if;
  if v_status <> 'nachbessern' then v_nachfrage := null; end if;

  insert into public.duell_antworten(teilnehmer_id,frage_id,gegebener_freitext,korrekt,feedback,bewertungsstatus,ki_nachfrage,versuch_anzahl)
   values(v_tid,p_frage_id,left(btrim(p_text),400),(v_status='richtig'),
     case when v_status='nachbessern' then null else left(p_feedback,300) end,
     v_status, v_nachfrage, 1);

  select musterantwort into v_loesung from public.fragen where id=p_frage_id;
  return jsonb_build_object('status',v_status,'korrekt',(v_status='richtig'),
    'feedback', case when v_status='nachbessern' then null else p_feedback end,
    'nachfrage', v_nachfrage,
    'musterantwort', case when v_status='nachbessern' then null else v_loesung end);
end; $$;

-- 1c) Kontext fuer den zweiten Versuch (service_role-only, wie das
--     freitext-Gegenstueck "freitext_nachbesserung_kontext").
create or replace function public.duell_freitext_ergaenzung_kontext(p_zugang uuid,p_frage_id uuid)
returns table(frage_text text, musterantwort text, bewertungshinweise text, erster_freitext text, ki_nachfrage text)
language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t where t.zugang=p_zugang;
  if v_tid is null then raise exception 'Frage nicht verfuegbar'; end if;
  return query
    select f.frage_text, f.musterantwort, f.bewertungshinweise, a.gegebener_freitext, a.ki_nachfrage
    from public.duell_antworten a join public.fragen f on f.id=a.frage_id
    where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id and a.bewertungsstatus='nachbessern' and a.versuch_anzahl=1;
end; $$;

-- 1d) Zweiten Versuch abschliessend speichern (service_role-only, wie
--     "freitext_ergaenzung_speichern"). Die where-Klausel im Update ist
--     die Sperre gegen einen dritten Versuch bzw. Doppelklicks.
create or replace function public.duell_freitext_ergaenzung_speichern(p_zugang uuid,p_frage_id uuid,p_zweiter_text text,p_korrekt boolean,p_feedback text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; v_loesung text; v_treffer int; v_status text; begin
  if current_user not in ('service_role','postgres') then raise exception 'Nicht erlaubt'; end if;
  select t.id into v_tid from public.duell_teilnehmer t where t.zugang=p_zugang;
  if v_tid is null then raise exception 'Frage nicht verfuegbar'; end if;
  v_status := case when p_korrekt then 'richtig' else 'falsch' end;

  update public.duell_antworten
    set zweiter_freitext=left(btrim(p_zweiter_text),400), feedback_final=left(p_feedback,300),
        korrekt=p_korrekt, bewertungsstatus=v_status, versuch_anzahl=2, beantwortet_am=now()
    where teilnehmer_id=v_tid and frage_id=p_frage_id and bewertungsstatus='nachbessern' and versuch_anzahl=1;
  get diagnostics v_treffer=row_count;
  if v_treffer=0 then raise exception 'Fuer diese Frage ist keine Ergaenzung offen'; end if;

  select musterantwort into v_loesung from public.fragen where id=p_frage_id;
  return jsonb_build_object('status',v_status,'korrekt',p_korrekt,'feedback',p_feedback,'musterantwort',v_loesung);
end; $$;

-- 2) Voller Verlauf: alle 5 Fragen + pro Teilnehmer der eigene Stand
--    immer, der fremde Stand nur, wenn man selbst schon geantwortet hat.
--    Dient sowohl dem "Session-Code -> zurueckkommen"-Auswertungsscreen
--    als auch (gefiltert auf eine Frage) dem Vergleich direkt nach dem
--    eigenen Antworten.
create or replace function public.duell_verlauf(p_zugang uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_t public.duell_teilnehmer%rowtype;
  v_s public.duell_sessions%rowtype;
  v_fragen jsonb := '[]'::jsonb;
  v_frage record;
  v_ich_ok boolean;
  v_opts jsonb;
  v_teilnehmer jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungueltig'; end if;
  select * into v_s from public.duell_sessions where id=v_t.session_id;

  for v_frage in
    select df.position, f.id as frage_id, f.frage_text, f.medium, f.antworttyp,
           f.option_a, f.option_b, f.option_c
    from public.duell_fragen df join public.fragen f on f.id=df.frage_id
    where df.session_id=v_t.session_id
    order by df.position
  loop
    select exists(
      select 1 from public.duell_antworten where teilnehmer_id=v_t.id and frage_id=v_frage.frage_id
    ) into v_ich_ok;

    select coalesce(jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
      jsonb_strip_nulls(jsonb_build_array(
        jsonb_build_object('schluessel','a','text',v_frage.option_a),
        jsonb_build_object('schluessel','b','text',v_frage.option_b),
        jsonb_build_object('schluessel','c','text',v_frage.option_c))))
    into v_opts from public.frage_antwortoptionen o where o.frage_id=v_frage.frage_id;

    select jsonb_agg(jsonb_build_object(
      'name', t.anzeigename,
      'ist_ich', (t.id = v_t.id),
      'beantwortet', (a.teilnehmer_id is not null),
      'status', case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.bewertungsstatus else null end,
      'auswahl', case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.gegebene_auswahl else null end,
      'freitext', case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.gegebener_freitext else null end,
      'zweiter_freitext', case when a.teilnehmer_id is not null and (t.id=v_t.id or v_ich_ok) then a.zweiter_freitext else null end
    ) order by t.beigetreten_am)
    into v_teilnehmer
    from public.duell_teilnehmer t
    left join public.duell_antworten a on a.teilnehmer_id=t.id and a.frage_id=v_frage.frage_id
    where t.session_id=v_t.session_id;

    v_fragen := v_fragen || jsonb_build_array(jsonb_build_object(
      'position', v_frage.position,
      'frage_id', v_frage.frage_id,
      'frage_text', v_frage.frage_text,
      'medium', v_frage.medium,
      'antworttyp', v_frage.antworttyp,
      'antwortoptionen', v_opts,
      'teilnehmer', v_teilnehmer
    ));
  end loop;

  return jsonb_build_object(
    'code', v_s.code, 'status', v_s.status, 'ich', v_t.anzeigename,
    'fragen', v_fragen
  );
end; $$;

-- 3) Reaktionen jetzt mit Namen statt nur Zaehlern. Rueckgabeform bewusst
--    geaendert (Frontend wird beim Umbau mit angepasst) - Liste statt
--    Zaehl-Objekt, damit "wer hat wie reagiert" direkt daraus lesbar ist.
create or replace function public.duell_reaktionen_fuer_frage(p_zugang uuid,p_frage_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  select id into v_tid from public.duell_teilnehmer where zugang=p_zugang;
  if v_tid is null or not exists(select 1 from public.duell_antworten where teilnehmer_id=v_tid and frage_id=p_frage_id)
    then raise exception 'Erst antworten, dann Reaktionen ansehen.'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', t.anzeigename, 'emoji', r.emoji, 'ist_ich', (t.id=v_tid)
    ) order by r.erstellt_am), '[]'::jsonb)
    from public.duell_reaktionen r join public.duell_teilnehmer t on t.id=r.teilnehmer_id
    where r.frage_id=p_frage_id
  );
end; $$;

create or replace function public.duell_reaktion_setzen(p_zugang uuid,p_frage_id uuid,p_emoji text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_tid uuid; begin
  select t.id into v_tid from public.duell_teilnehmer t where t.zugang=p_zugang;
  if v_tid is null or not exists(select 1 from public.duell_antworten a where a.teilnehmer_id=v_tid and a.frage_id=p_frage_id) then raise exception 'Erst antworten, dann reagieren.'; end if;
  if p_emoji not in ('⚽','👏','😮','😂') then raise exception 'Unbekannte Reaktion'; end if;
  insert into public.duell_reaktionen(teilnehmer_id,frage_id,emoji) values(v_tid,p_frage_id,p_emoji)
   on conflict(teilnehmer_id,frage_id) do update set emoji=excluded.emoji,erstellt_am=now();
  return public.duell_reaktionen_fuer_frage(p_zugang,p_frage_id);
end; $$;

-- 4) "Meine letzten Duelle" fuer angemeldete Vereinsmitglieder (Gaeste
--    ohne Konto bleiben auf lokal gemerkte Codes angewiesen - dafuer gibt
--    es keine serverseitige Identitaet, an der man sie festmachen koennte).
create or replace function public.duell_meine_liste(p_schiedsrichter_id uuid, p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ergebnis jsonb; begin
  perform public.schiri_pin_pruefen(p_schiedsrichter_id, p_pin);
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', d.code,
    'status', d.status,
    'zugang', t.zugang,
    'ich_richtig', coalesce(a.richtig,0),
    'ich_beantwortet', coalesce(a.beantwortet,0),
    'erstellt_am', d.erstellt_am
  ) order by d.erstellt_am desc), '[]'::jsonb)
  into v_ergebnis
  from public.duell_teilnehmer t
  join public.duell_sessions d on d.id=t.session_id
  left join lateral (
    select count(*) beantwortet, count(*) filter(where korrekt) richtig
    from public.duell_antworten where teilnehmer_id=t.id
  ) a on true
  where t.schiedsrichter_id=p_schiedsrichter_id;
  return v_ergebnis;
end; $$;

revoke all on function public.duell_freitext_speichern(uuid,uuid,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.duell_freitext_speichern(uuid,uuid,text,boolean,text,text,text) to service_role;

revoke all on function public.duell_freitext_ergaenzung_kontext(uuid,uuid) from public,anon,authenticated;
grant execute on function public.duell_freitext_ergaenzung_kontext(uuid,uuid) to service_role;

revoke all on function public.duell_freitext_ergaenzung_speichern(uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.duell_freitext_ergaenzung_speichern(uuid,uuid,text,boolean,text) to service_role;

revoke all on function public.duell_verlauf(uuid) from public,anon,authenticated;
grant execute on function public.duell_verlauf(uuid) to anon;

revoke all on function public.duell_meine_liste(uuid,text) from public,anon,authenticated;
grant execute on function public.duell_meine_liste(uuid,text) to anon;
