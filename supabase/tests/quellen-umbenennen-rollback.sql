-- Nur isolierte Testdaten, nichts wird dauerhaft gespeichert.
begin;
do $$
declare
 c uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 p text:='rollback-'||gen_random_uuid()::text;
 q text:='custom_'||replace(gen_random_uuid()::text,'-','');
 n integer; r jsonb;
begin
 insert into public.vereine(id,name) values(c,'Quellen-Umbenennen-Rollback');
 select coalesce(min(id),0)-1 into n from public.obmann_zugang;
 insert into public.obmann_zugang(id,passwort,verein_id) values(n,p,c);
 r:=public.obmann_fragenquelle_speichern(p,q,'Testquelle '||q,true,'Ausgabe','["05/26","04/26"]',0);
 if r->>'typ'<>q then raise exception 'Neue Quellenkennung verloren'; end if;
 insert into public.fragen(id,frage_text,quelle_typ,quelle_detail,medium,antworttyp,aktiv,in_bearbeitung)
 values(f,'Quellen-Rollbackfrage',q,'04/26','text','multiple_choice',false,true);
 r:=public.obmann_fragenquelle_speichern(p,q,'Umbenannte Quelle '||q,true,'Heft','["06/26","05/26"]',1);
 if not exists(select 1 from public.fragen x join public.fragen_quellenkatalog k on k.typ=x.quelle_typ
   where x.id=f and x.quelle_typ=q and x.quelle_detail='04/26' and k.titel='Umbenannte Quelle '||q and k.detail_label='Heft')
 then raise exception 'Umbenennen verliert vorhandene Fragen oder Ausgabe'; end if;
 begin
  perform public.obmann_fragenquelle_speichern(p,q,'Veralteter Stand',false,'Teil','[]',1);
  raise exception 'Revisionskonflikt übergangen';
 exception when serialization_failure then null; end;
 begin
  perform public.obmann_fragenquelle_speichern('ungueltig',q,'Nicht erlaubt',false,'Teil','[]',2);
  raise exception 'Unberechtigt gespeichert';
 exception when raise_exception then if SQLERRM='Unberechtigt gespeichert' then raise; end if; end;
 if has_table_privilege('anon','public.fragen_quellenkatalog','UPDATE') then raise exception 'Direkte anonyme Schreibrechte'; end if;
end $$;
select 'Anlegen, Umbenennen, Untergliederung, Altfrage, Revision und Rechte geprüft' as ergebnis;
rollback;
