-- Quellen nicht hart löschen: Fragen besitzen einen stabilen FK darauf.
alter table public.fragen_quellenkatalog add column archiviert boolean not null default false;
create function public.obmann_fragenquelle_archivieren(p_passwort text,p_typ text,p_archiviert boolean,p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.fragen_quellenkatalog;
begin
  perform public.obmann_verein(p_passwort);
  if p_archiviert is null then raise exception 'Archivstatus fehlt'; end if;
  select * into r from public.fragen_quellenkatalog where typ=p_typ for update;
  if not found then raise exception 'Quelle nicht gefunden'; end if;
  if r.revision is distinct from p_revision then raise exception 'Die Quelle wurde inzwischen geändert. Bitte den Katalog neu laden.' using errcode='40001'; end if;
  update public.fragen_quellenkatalog set archiviert=p_archiviert,revision=revision+1 where typ=p_typ returning * into r;
  return to_jsonb(r);
end $$;
revoke all on function public.obmann_fragenquelle_archivieren(text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.obmann_fragenquelle_archivieren(text,text,boolean,integer) to anon,authenticated,service_role;
