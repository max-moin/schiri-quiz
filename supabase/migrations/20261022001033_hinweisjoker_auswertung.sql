-- Applied as 20261022001033. Existing audit extended; no answer changes.
create or replace function public.obmann_joker_verlauf(p_passwort text,p_schiedsrichter text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare verein uuid; person uuid; basis jsonb; e record;
begin
 verein:=public.obmann_verein(p_passwort);
 select s.id into person from public.schiedsrichter s where s.verein_id=verein and s.name=p_schiedsrichter;
 basis:=coalesce((select jsonb_agg(jsonb_build_object('frage_id',v.frage,'runde_id',v.runde,
  'halbhalb',v.halbhalb is not null,'zweiter',v.zweiter is not null,'status',v.status,
  'erstantwort',v.erste_antwort,'jokerantwort',case when v.zweiter is not null then v.letzte_antwort end,
  'erstantwort_text',private.quiz_joker_antworttext(v.art,v.erste_antwort,v.frage),
  'jokerantwort_text',case when v.zweiter is not null then private.quiz_joker_antworttext(v.art,v.letzte_antwort,v.frage) end,
  'korrekt',(v.letztes_ergebnis->>'korrekt')::boolean,'eingesetzt_am',coalesce(j.verbraucht_am,h.verbraucht_am)) order by v.erstellt_am)
 from private.quiz_joker_vorgaenge v
 left join private.jokerbestand j on j.id=v.zweiter left join private.jokerbestand h on h.id=v.halbhalb
 where v.person=person and (v.halbhalb is not null or v.zweiter is not null)),'[]');
 for e in
  select h.frage,j.runde,jsonb_agg(jsonb_build_object('typ',h.typ,'hinweis',h.hinweis) order by h.erstellt_am) as hinweise
  from private.quiz_hinweis_einsaetze h join private.jokerbestand j on j.id=h.joker
  where h.person=person group by h.frage,j.runde
 loop
  if exists(select 1 from jsonb_array_elements(basis) b where b->>'frage_id'=e.frage::text) then
   select jsonb_agg(case when b->>'frage_id'=e.frage::text then b||jsonb_build_object('hinweise',e.hinweise) else b end) into basis from jsonb_array_elements(basis) b;
  else basis:=basis||jsonb_build_array(jsonb_build_object('frage_id',e.frage,'runde_id',e.runde,'halbhalb',false,'zweiter',false,'status','hinweis','hinweise',e.hinweise,'erstantwort_text',null,'jokerantwort_text',null)); end if;
 end loop;
 return basis;
end $$;
revoke all on function public.obmann_joker_verlauf(text,text) from public;
grant execute on function public.obmann_joker_verlauf(text,text) to anon,authenticated;
notify pgrst,'reload schema';
