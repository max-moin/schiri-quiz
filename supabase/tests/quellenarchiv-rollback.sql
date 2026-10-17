begin;
do $$
declare v uuid; p text:='rollback-'||gen_random_uuid(); t text:='custom_'||replace(gen_random_uuid()::text,'-',''); f uuid;
begin
 insert into public.vereine(name) values('Rollback-Quellenarchiv-'||gen_random_uuid()) returning id into v;
 insert into public.obmann_zugang(id,verein_id,passwort) values(-19876354,v,p);
 insert into public.fragen_quellenkatalog(typ,titel) values(t,'Rollback-Quelle-'||gen_random_uuid());
 insert into public.fragen(frage_text,typ,medium,antworttyp,option_a,option_b,option_c,richtige_option,quelle_typ)
 values('Rollback-Quellenfrage','multiple_choice','text','multiple_choice','a','b','c','a',t) returning id into f;
 perform set_config('test.archiv_passwort',p,true);perform set_config('test.archiv_typ',t,true);perform set_config('test.archiv_frage',f::text,true);
end $$;
set local role anon;
do $$
declare p text:=current_setting('test.archiv_passwort');t text:=current_setting('test.archiv_typ');x jsonb;
begin
 begin perform public.obmann_fragenquelle_archivieren('falsch',t,true,1);raise exception 'Ohne Berechtigung archiviert';
 exception when others then if sqlerrm='Ohne Berechtigung archiviert' then raise; end if; end;
 x:=public.obmann_fragenquelle_archivieren(p,t,true,1);
 if x->>'archiviert'<>'true' or x->>'revision'<>'2' then raise exception 'Nicht archiviert'; end if;
 begin perform public.obmann_fragenquelle_archivieren(p,t,false,1);raise exception 'Veraltete Revision akzeptiert';
 exception when serialization_failure then null; end;
 if not exists(select 1 from public.fragen_quellenkatalog where typ=t and archiviert) then raise exception 'Archivierte Quelle nicht lesbar'; end if;
 x:=public.obmann_fragenquelle_archivieren(p,t,false,2);
 if x->>'archiviert'<>'false' then raise exception 'Reaktivieren fehlgeschlagen'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.fragen where id=current_setting('test.archiv_frage')::uuid and quelle_typ=current_setting('test.archiv_typ')) then raise exception 'Alte Frage geändert'; end if;
end $$;
select 'Archivieren, Reaktivieren, Revisionskonflikt und bestehende Frage bestanden' as ergebnis;
rollback;
