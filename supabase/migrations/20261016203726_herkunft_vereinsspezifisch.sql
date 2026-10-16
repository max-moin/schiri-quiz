-- Dieselbe fachliche Frage kann von mehreren Vereinen genutzt werden.
-- Die freiwillige Kennzeichnung gehört deshalb zum Paar Frage/Verein.
alter table public.frage_herkunft drop constraint frage_herkunft_pkey;
alter table public.frage_herkunft add primary key(frage_id,verein_id);
do $migration$
declare d text;
begin
 select pg_get_functiondef('public.obmann_frage_redaktion_speichern(text,uuid,jsonb,jsonb,boolean,jsonb,text,jsonb)'::regprocedure) into d;
 if position('on conflict(frage_id) do update' in d)=0 then raise exception 'Unerwarteter Funktionsstand'; end if;
 d:=replace(d,$old$    if exists(select 1 from public.frage_herkunft where frage_id=p_frage_id and verein_id<>v_verein) then
      raise exception 'Frage gehört zu einem anderen Verein.';
    end if;
$old$,'');
 d:=replace(d,'h on h.frage_id=p_frage_id;','h on h.frage_id=p_frage_id and h.verein_id=v_verein;');
 d:=replace(d,'on conflict(frage_id) do update','on conflict(frage_id,verein_id) do update');
 execute d;
end $migration$;
