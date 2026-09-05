-- v121: Der Duell-Player nutzt denselben Video-/Hinweisbaustein wie das
-- Wochenquiz. Dafür muss duell_frage neben den bereits vorhandenen
-- Videozeiten auch den redaktionellen Antworthinweis ausliefern.
create or replace function public.duell_frage(p_zugang uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.duell_teilnehmer%rowtype;
  v_f public.fragen%rowtype;
  v_pos integer;
  v_opts jsonb;
begin
  select * into v_t from public.duell_teilnehmer where zugang=p_zugang;
  if not found then raise exception 'Duell-Zugang ungültig'; end if;

  select f.* into v_f
  from public.duell_fragen df
  join public.fragen f on f.id=df.frage_id
  join public.duell_sessions d on d.id=df.session_id and d.status='offen'
  where df.session_id=v_t.session_id
    and not exists(
      select 1 from public.duell_antworten a
      where a.teilnehmer_id=v_t.id and a.frage_id=df.frage_id
    )
  order by df.position
  limit 1;
  if not found then return jsonb_build_object('fertig',true); end if;

  select position into v_pos
  from public.duell_fragen
  where session_id=v_t.session_id and frage_id=v_f.id;

  select coalesce(
    jsonb_agg(jsonb_build_object('schluessel',o.schluessel,'text',o.text) order by o.position),
    jsonb_strip_nulls(jsonb_build_array(
      jsonb_build_object('schluessel','a','text',v_f.option_a),
      jsonb_build_object('schluessel','b','text',v_f.option_b),
      jsonb_build_object('schluessel','c','text',v_f.option_c)
    ))
  ) into v_opts
  from public.frage_antwortoptionen o
  where o.frage_id=v_f.id;

  return jsonb_strip_nulls(jsonb_build_object(
    'fertig',false,'id',v_f.id,'position',v_pos,'gesamt',5,
    'frage_text',v_f.frage_text,'medium',v_f.medium,
    'antworttyp',v_f.antworttyp,'antwortoptionen',v_opts,
    'antwort_hinweis',v_f.antwort_hinweis,
    'video_url',v_f.video_url,
    'video_start_sekunden',v_f.video_start_sekunden,
    'video_end_sekunden',v_f.video_end_sekunden,
    'video_stumm',v_f.video_stumm,
    'bild_base64',v_f.bild_base64,'bild_mime',v_f.bild_mime,
    'bild_alt',v_f.bild_alt
  ));
end;
$$;

revoke all on function public.duell_frage(uuid) from public, anon, authenticated;
grant execute on function public.duell_frage(uuid) to anon;
