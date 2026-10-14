-- In einer BEGIN/ROLLBACK-Transaktion, ausschließlich eigene Testdatensätze.
do $$
declare c uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 p text:='rollback-'||gen_random_uuid()::text; q text:='custom_'||replace(gen_random_uuid()::text,'-','');
 n integer; r jsonb; v jsonb;
begin
 insert into public.vereine(id,name) values(c,'Filter-Termin-Rollback');
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,p,c);
 insert into public.schiedsrichter(id,name,verein_id,pin) values(s,'Testperson Filter-Termin',c,'739105');
 insert into public.termine(id,verein_id,titel,datum,rueckmeldung_erforderlich,sichtbarkeit)
 values(t,c,'Testtermin Filter-Termin',current_date+30,true,'nur_verein');
 r:=public.obmann_fragenquelle_speichern(p,q,'Isolierte Testquelle',true,'Kapitel','["A","B"]',0);
 if r->>'typ'<>q or r->>'revision'<>'1' then raise exception 'Quellenanlage fehlgeschlagen'; end if;
 insert into public.fragen(id,frage_text,quelle_typ,quelle_detail,medium,antworttyp,aktiv,in_bearbeitung)
 values(f,'Isolierte Rollbackfrage',q,'A','text','multiple_choice',false,true);
 r:=public.obmann_fragenquelle_speichern(p,q,'Umbenannte Testquelle',false,'Kapitel','["A","B"]',1);
 if (select quelle_typ from public.fragen where id=f)<>q or (select quelle_detail from public.fragen where id=f)<>'A' then raise exception 'Umbenennen zerstört Zuordnung'; end if;
 begin perform public.obmann_fragenquelle_speichern(p,q,'Konflikt',true,'Teil','[]',1); raise exception 'Konflikt nicht erkannt'; exception when serialization_failure then null; end;
 begin perform public.obmann_fragenquelle_speichern('ungueltig',q,'Unberechtigt',true,'Teil','[]',2); raise exception 'Ohne Passwort gespeichert'; exception when raise_exception then if SQLERRM='Ohne Passwort gespeichert' then raise; end if; end;
 if has_table_privilege('anon','public.fragen_quellenkatalog','UPDATE') or has_table_privilege('authenticated','public.fragen_quellenkatalog','INSERT') then raise exception 'Direkte Schreibrechte'; end if;

 begin perform public.termin_rueckmeldung_setzen(s,'739105',t,'unsicher','sonstiges','  '); raise exception 'Leere Begründung akzeptiert'; exception when raise_exception then if SQLERRM='Leere Begründung akzeptiert' then raise; end if; end;
 perform public.termin_rueckmeldung_setzen(s,'739105',t,'unsicher','sonstiges','Dienstplan steht noch aus');
 if not exists(select 1 from public.termin_rueckmeldungen where termin_id=t and schiedsrichter_id=s and status='unsicher' and kommentar='Dienstplan steht noch aus') then raise exception 'Unsicher nicht gespeichert'; end if;
 if not exists(select 1 from public.obmann_termin_rueckmeldungen(p,t) where schiedsrichter_id=s and status='unsicher' and kommentar='Dienstplan steht noch aus') then raise exception 'Obmann sieht Begründung nicht'; end if;
 if not exists(select 1 from public.termine_fuer_schiri_v2(s,'739105','test-filter-termin') where id=t and mein_status='unsicher') then raise exception 'Eigene Website sieht Status nicht'; end if;
 v:=public.obmann_termine_mit_fortbildung(p);
 if not exists(select 1 from jsonb_array_elements(v) x where x->>'id'=t::text and x->>'unsicher'='1' and x->>'zusagen'='0' and x->>'absagen'='0') then raise exception 'Falsche Zählung'; end if;
 begin perform public.termin_rueckmeldung_setzen(s,'falsche-pin',t,'unsicher','sonstiges','Test'); raise exception 'Falsche PIN akzeptiert'; exception when raise_exception then if SQLERRM='Falsche PIN akzeptiert' then raise; end if; end;
 perform public.termin_rueckmeldung_setzen(s,'739105',t,'zu');
 if exists(select 1 from public.termin_rueckmeldungen where termin_id=t and kommentar is not null) then raise exception 'Alter Unsicher-Grund blieb bei Zusage'; end if;
 perform public.obmann_termin_rueckmeldung_setzen(p,t,s,'unsicher','sonstiges','Vorläufig');
 update public.termine set rueckmeldung_bis=current_date-1 where id=t;
 begin perform public.termin_rueckmeldung_setzen(s,'739105',t,'zu'); raise exception 'Frist umgangen'; exception when raise_exception then if SQLERRM='Frist umgangen' then raise; end if; end;
 update public.termine set datum=current_date-1 where id=t;
 begin perform public.termin_rueckmeldung_setzen(s,'739105',t,'unsicher','sonstiges','Test'); raise exception 'Vergangener Termin erlaubt'; exception when raise_exception then if SQLERRM='Vergangener Termin erlaubt' then raise; end if; end;
end $$;
select 'Quellen- und Termin-Rollbacktests bestanden' as ergebnis;
