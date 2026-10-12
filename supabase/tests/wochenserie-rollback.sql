-- Echte Daten unveraendert lassen: der gesamte Test wird zurueckgerollt.
begin;
do $$
declare v uuid; fremd uuid; s uuid; s2 uuid; r uuid; r2 uuid; f uuid; i int;
  ende timestamptz := now()-interval '1 day';
begin
  insert into public.vereine(name) values('Rollback-Serie-'||gen_random_uuid()) returning id into v;
  insert into public.vereine(name) values('Rollback-Serie-Fremd-'||gen_random_uuid()) returning id into fremd;
  insert into public.schiedsrichter(name,pin,verein_id,erstellt_am,ist_test)
    values('Rollback-Serie','nur-rollback-serie',v,now()-interval '30 days',true) returning id into s;
  insert into public.schiedsrichter(name,pin,verein_id,erstellt_am,ist_test)
    values('Fremde Person','fremder-rollback-pin',fremd,now()-interval '30 days',true) returning id into s2;
  insert into public.runden(bezeichnung,startet_am,endet_am)
    values('Rollback-Serie-alt',ende-interval '14 days',ende-interval '7 days') returning id into r;
  insert into public.runden(bezeichnung,startet_am,endet_am)
    values('Rollback-Serie-neu',ende-interval '7 days',ende) returning id into r2;
  for i in 1..5 loop
    insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option)
      values('Rollback-Serie-Frage-'||i,'multiple_choice','text','multiple_choice','a','b','c','a') returning id into f;
    insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r,f,i);
    -- Auch falsche abschliessende Antworten ergeben einen Wochenabschluss.
    insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,bewertungsstatus,beantwortet_am)
      values(s,f,'b',false,'falsch',ende-interval '10 days');
    if i<=4 then
      insert into public.historie_antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,beantwortet_am)
        values(s,f,'a',true,ende+interval '1 hour');
    end if;
    if i=1 then
      -- Wiederholung, fremde Person und ausserhalb des Fensters zaehlen nicht.
      insert into public.historie_antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,beantwortet_am)
        values(s,f,'a',true,ende+interval '2 hours'),(s2,f,'a',true,ende+interval '3 hours');
    end if;
    if i=5 then
      insert into public.historie_antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,beantwortet_am)
        values(s,f,'b',false,ende+interval '1 hour'),(s,f,'a',true,ende-interval '1 hour');
      perform set_config('test.serie_frage',f::text,true);
    end if;
    insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option)
      values('Rollback-neue-Frage-'||i,'multiple_choice','text','multiple_choice','a','b','c','a') returning id into f;
    insert into public.runden_fragen(verein_id,runde_id,frage_id,position) values(v,r2,f,i);
    if i<=2 then
      insert into public.antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt,bewertungsstatus,beantwortet_am)
        values(s,f,'a',i=1,case when i=1 then 'richtig' else 'nachbessern' end,ende-interval '2 days');
    end if;
  end loop;
  perform set_config('test.serie_person',s::text,true);
  perform set_config('test.serie_fremd',s2::text,true);
end $$;
set local role anon;
do $$
declare s uuid:=current_setting('test.serie_person')::uuid; w jsonb; n jsonb;
begin
  w:=public.meine_wochenserie_basis(s,'nur-rollback-serie');
  if jsonb_array_length(w->'wochen')<>2 then raise exception 'Falsche Rundenzahl'; end if;
  if (w#>>'{wochen,0,beantwortet}')::int<>5 then raise exception 'Falsche Antworten verhindern Wochenabschluss'; end if;
  n:=w#>'{wochen,1}';
  if (n->>'beantwortet')::int<>1 then raise exception 'Offene Nachbesserung gilt als abgeschlossen'; end if;
  if (n->>'uebung_richtig')::int<>4 then raise exception 'Wiederholung/fremde/falsche/fruehe Uebung mitgezaehlt'; end if;
  begin
    perform public.meine_wochenserie_basis(current_setting('test.serie_fremd')::uuid,'nur-rollback-serie');
    raise exception 'Fremdes Konto sichtbar';
  exception when others then if sqlerrm='Fremdes Konto sichtbar' then raise; end if; end;
  begin
    perform public.meine_wochenserie_basis(s,null);
    raise exception 'Leere PIN zugelassen';
  exception when others then if sqlerrm='Leere PIN zugelassen' then raise; end if; end;
end $$;
reset role;
do $$
declare s uuid:=current_setting('test.serie_person')::uuid; f uuid:=current_setting('test.serie_frage')::uuid; w jsonb;
begin
  insert into public.historie_antworten(schiedsrichter_id,frage_id,gegebene_option,korrekt)
    values(s,f,'a',true);
  w:=public.meine_wochenserie_basis(s,'nur-rollback-serie');
  if (w#>>'{wochen,1,uebung_richtig}')::int<>5 then raise exception 'Fuenfte richtige Uebung fehlt'; end if;
  if (w#>>'{wochen,1,beantwortet}')::int<>1 then raise exception 'Rettung hat Wochenantworten veraendert'; end if;
  if (((timestamptz '2026-10-19 00:00:00+02' at time zone 'Europe/Berlin')+interval '7 days')
      at time zone 'Europe/Berlin') <> timestamptz '2026-10-26 00:00:00+01' then
    raise exception 'Berliner Sommerzeitgrenze falsch'; end if;
end $$;
select 'Eigener Zugang, fremde PIN, Wochenabschluss, Nachbesserung, 5 verschiedene Uebungsfragen und Berliner Frist geprueft' as ergebnis;
rollback;
