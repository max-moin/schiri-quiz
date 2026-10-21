-- Nur künstliche Vereine/Personen. Alle Änderungen, Bestände und Versandjobs
-- bleiben in derselben Transaktion und werden am Ende verworfen.
begin;
do $setup$
declare v uuid; f uuid; s uuid; s2 uuid; a uuid; b uuid; pw text:=gen_random_uuid()::text;
begin
 insert into public.vereine(name) values('Rollback-Bestellweg-'||gen_random_uuid()) returning id into v;
 insert into public.vereine(name) values('Rollback-Bestellweg-Fremd-'||gen_random_uuid()) returning id into f;
 insert into public.obmann_zugang(id,passwort,verein_id) values((select coalesce(min(id),0)-1 from public.obmann_zugang),pw,v);
 insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Bestellweg-Schiri','bw-pin',v) returning id into s;
 insert into public.schiedsrichter(name,pin,verein_id) values('Rollback-Bestellweg-Fremd','bw-fremd',f) returning id into s2;
 insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,beschaffungsweg,prozess_status,
   preis_final_cent,vorlage_preis_cent,vorlage_am,freigabe_status)
 values(s,'hose','weg2_schiri_besorgt','vorgelegt',3500,3500,now(),'vorgelegt') returning id into a;
 insert into public.ausruestungs_anfragen(schiedsrichter_id,kategorie,beschaffungsweg,prozess_status,vorlage_preis_cent)
 values(s,'trikot','weg2_schiri_besorgt','freigegeben',4000) returning id into b;
 perform set_config('test.bw_v',v::text,true); perform set_config('test.bw_s',s::text,true);
 perform set_config('test.bw_fremd',s2::text,true); perform set_config('test.bw_a',a::text,true);
 perform set_config('test.bw_b',b::text,true); perform set_config('test.bw_pw',pw,true);
end $setup$;
set local role anon;
do $test$
declare a uuid:=current_setting('test.bw_a')::uuid; b uuid:=current_setting('test.bw_b')::uuid;
 s uuid:=current_setting('test.bw_s')::uuid; fremd uuid:=current_setting('test.bw_fremd')::uuid;
 pw text:=current_setting('test.bw_pw'); x jsonb;
begin
 begin perform public.obmann_anfrage_bestellweg_aendern('falsch',a,'weg1_obmann_besorgt','weg2_schiri_besorgt','Sammelbestellung');
 raise exception 'TEST: falsches Passwort akzeptiert'; exception when others then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg1_obmann_besorgt','weg2_schiri_besorgt','Sammelbestellung telefonisch vereinbart');
 perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg1_obmann_besorgt','weg2_schiri_besorgt','Sammelbestellung telefonisch vereinbart');
 x:=public.obmann_anfrage_prozess(pw,a);
 if x->>'prozess_status'<>'vorgelegt' or (x->>'vorlage_preis_cent')::int<>3500 or (x->>'runde')::int<>1
   then raise exception 'TEST: Wechsel verändert Vorstandsvorlage: %',x;end if;
 begin perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg2_schiri_besorgt','weg2_schiri_besorgt','Veraltete Ansicht');
 raise exception 'TEST: Veraltete Ansicht akzeptiert';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.obmann_anfrage_schritt(pw,a,'bestellt');raise exception 'TEST: Bestellung vor Freigabe akzeptiert';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.obmann_anfrage_freigabe_dokumentieren(pw,a,'Tom','');raise exception 'TEST: Freigabe ohne Notiz akzeptiert';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.obmann_anfrage_freigabe_dokumentieren(pw,a,'Rollback-Vorstand','Telefonat 21.10.2026: 35 Euro unverändert freigegeben.');
 perform public.obmann_anfrage_freigabe_dokumentieren(pw,a,'Rollback-Vorstand','Telefonat 21.10.2026: 35 Euro unverändert freigegeben.');
 x:=public.obmann_anfrage_prozess(pw,a);
 if x->>'prozess_status'<>'freigegeben' or x->>'freigabe_name' not like '%extern durch Obmann dokumentiert%' then raise exception 'TEST: Freigabeherkunft fehlt';end if;
 -- Wechsel auch nach Entscheidung, in beide Richtungen, ohne zweite Freigabe.
 perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg2_schiri_besorgt','weg1_obmann_besorgt','Nochmals Selbstkauf besprochen');
 perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg1_obmann_besorgt','weg2_schiri_besorgt','Nun gemeinsame Sammelbestellung');
 perform public.obmann_anfrage_schritt(pw,a,'bestellt');
 begin perform public.obmann_anfrage_bestellweg_aendern(pw,a,'weg2_schiri_besorgt','weg1_obmann_besorgt','Nach Bestellung wechseln');raise exception 'TEST: Nach Bestellung gewechselt';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.schiri_anfrage_schritt(s,'bw-pin',a,'uebergeben');raise exception 'TEST: Erhalt vor Ankunft akzeptiert';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.obmann_anfrage_schritt(pw,a,'eingegangen');
 x:=public.schiri_anfrage_prozess(s,'bw-pin',a);
 perform set_config('test.bw_abholbereit',x::text,true);
 if not exists(select 1 from jsonb_array_elements(x->'meine_aktionen') q where q->>'schritt'='uebergeben') then raise exception 'TEST: Erhalt-Aktion fehlt';end if;
 begin perform public.obmann_anfrage_schritt(pw,a,'uebergeben');raise exception 'TEST: Obmann hat Schiri-Erhalt bestätigt';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.schiri_anfrage_schritt(fremd,'bw-fremd',a,'uebergeben');raise exception 'TEST: Fremder bestätigt Erhalt';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.schiri_anfrage_schritt(s,'bw-pin',a,'uebergeben');
 x:=public.schiri_anfrage_prozess(s,'bw-pin',a);
 if not (x->>'schiri_abgeschlossen')::bool or x->'naechster_schritt'<>'null'::jsonb or jsonb_array_length(x->'schritte')<>7
   then raise exception 'TEST: Schiri nicht fertig: %',x;end if;
 perform set_config('test.bw_erhalten',x::text,true);
 begin perform public.obmann_anfrage_schritt(pw,a,'abgeschlossen');raise exception 'TEST: Offene Erstattung übersprungen';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.obmann_zahlung_beauftragen(pw,a,'Erstattung für ausgelegte Sammelbestellung',false);
 x:=public.obmann_anfrage_prozess(pw,a);
 if x->>'prozess_status'<>'zahlung_beauftragt' or x#>>'{naechster_schritt,rolle}'<>'vorstand' then raise exception 'TEST: Auftrag nicht offen';end if;
 perform public.obmann_zahlung_stellvertretend(pw,a,'Vorstand bestätigt Überweisung telefonisch am 21.10.2026.');
 begin perform public.schiri_anfrage_schritt(s,'bw-pin',a,'geld_erhalten');raise exception 'TEST: Schiri bestätigt Obmann-Erstattung';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.obmann_anfrage_schritt(pw,a,'geld_erhalten');
 x:=public.obmann_anfrage_prozess(pw,a);
 if x->>'prozess_status'<>'abgeschlossen' then raise exception 'TEST: Finanzieller Abschluss fehlt';end if;
 x:=public.schiri_anfrage_prozess(s,'bw-pin',a);
 if jsonb_array_length(x->'schritte')<>7 or jsonb_array_length(x->'meine_aktionen')<>0 then raise exception 'TEST: Finanzaufgaben beim Schiri';end if;
 -- Bestehender Selbstkauf bleibt intakt und kann nach Kauf nicht wechseln.
 perform public.schiri_anfrage_schritt(s,'bw-pin',b,'gekauft');
 begin perform public.obmann_anfrage_bestellweg_aendern(pw,b,'weg1_obmann_besorgt','weg2_schiri_besorgt','Nach Selbstkauf wechseln');raise exception 'TEST: Nach Kauf gewechselt';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
end $test$;
reset role;
do $verify$
declare a uuid:=current_setting('test.bw_a')::uuid;
begin
 if (select count(*) from public.ausruestung_ereignisse where anfrage_id=a and schritt='beschaffungsweg_geaendert')<>3 then raise exception 'TEST: Wechselhistorie verloren oder doppelt';end if;
 if (select count(*) from public.ausruestung_ereignisse where anfrage_id=a and schritt='freigegeben')<>1 then raise exception 'TEST: Freigabe doppelt';end if;
 if (select count(*) from public.ausruestungsbestand where quell_anfrage_id=a)<>1 then raise exception 'TEST: Bestand fehlt oder doppelt';end if;
end $verify$;
select 'Vereinsbestellung, externe Freigabe, Wechsel, Rollen, Erhalt, Erstattung und Selbstkauf: geprüft' as ergebnis,
 current_setting('test.bw_abholbereit')::jsonb as abholbereit,
 current_setting('test.bw_erhalten')::jsonb as erhalten;
rollback;
