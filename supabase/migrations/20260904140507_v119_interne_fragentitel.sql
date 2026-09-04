-- Interne Redaktion bleibt getrennt von den öffentlich lesbaren Quizfragen.
create table public.frage_redaktion (
  frage_id uuid primary key references public.fragen(id) on delete cascade,
  kurztitel text not null check (char_length(btrim(kurztitel)) between 1 and 120)
);
alter table public.frage_redaktion enable row level security;
revoke all on public.frage_redaktion from public, anon, authenticated;

create or replace function public.obmann_fragen_kennzeichnungen(p_passwort text)
returns table (frage_id uuid, kurztitel text, medium text, kontext text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.obmann_verein(p_passwort);
  return query
    select f.id, r.kurztitel, f.medium::text,
      case when f.medium = 'video' then nullif(left(btrim(f.antwort_hinweis), 180), '')
           when f.medium = 'bild' then nullif(left(btrim(f.bild_alt), 180), '') end
    from public.fragen f left join public.frage_redaktion r on r.frage_id = f.id;
end;
$$;
revoke all on function public.obmann_fragen_kennzeichnungen(text) from public;
grant execute on function public.obmann_fragen_kennzeichnungen(text) to anon, authenticated;

-- Frage, Lösung und interner Titel werden atomar gespeichert. Bestehende
-- Clients nutzen weiter die bisherigen RPCs und lassen den Titel unberührt.
create or replace function public.obmann_frage_mit_titel_speichern(
  p_passwort text,
  p_frage_id uuid default null,
  p_basis jsonb default '{}',
  p_inhalt jsonb default '{}',
  p_entscheidung boolean default false,
  p_loesung jsonb default '{}',
  p_kurztitel text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_titel text := btrim(coalesce(p_kurztitel, ''));
begin
  perform public.obmann_verein(p_passwort);
  if char_length(v_titel) > 120 then
    raise exception 'Der interne Kurztitel darf höchstens 120 Zeichen haben.';
  end if;
  if p_entscheidung then
    v_id := public.obmann_frage_entscheidung_flex_speichern(
      p_passwort, p_frage_id, p_basis, p_loesung, p_inhalt);
  else
    v_id := public.obmann_frage_flex_speichern(
      p_passwort, p_frage_id, p_basis, p_inhalt);
  end if;
  if v_titel = '' then
    delete from public.frage_redaktion where frage_id = v_id;
  else
    insert into public.frage_redaktion(frage_id, kurztitel) values(v_id, v_titel)
      on conflict (frage_id) do update set kurztitel = excluded.kurztitel;
  end if;
  return v_id;
end;
$$;
revoke all on function public.obmann_frage_mit_titel_speichern(text, uuid, jsonb, jsonb, boolean, jsonb, text) from public;
grant execute on function public.obmann_frage_mit_titel_speichern(text, uuid, jsonb, jsonb, boolean, jsonb, text) to anon, authenticated;
comment on table public.frage_redaktion is 'Interne Kurztitel der gemeinsamen Fragenbank; keine öffentliche Quizinformation. Nur über Obmann-RPCs zugänglich.';
