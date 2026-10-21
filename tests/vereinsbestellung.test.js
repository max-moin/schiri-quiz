import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schiriAktionen, naechsterSchrittText, prozessLinieHtml } from '../src/website/prozess-linie.js';
import { vorstandZahlungMail } from '../supabase/functions/obmann-benachrichtigungen/vorstand-mail.js';
const sql=readFileSync(new URL('../supabase/migrations/20261021201351_beschaffung_vereinsbestellung_und_erstattung.sql',import.meta.url),'utf8');
test('Schiri bestätigt Erhalt ausschließlich bei erlaubter Aktion',()=>{
 assert.deepEqual(schiriAktionen({meine_aktionen:[{schritt:'uebergeben'}]}),[{schritt:'uebergeben',wort:'Ausrüstung erhalten · bestätigen'}]);
 assert.deepEqual(schiriAktionen({meine_aktionen:[{schritt:'bestellt'},{schritt:'zahlung_beauftragt'}]}),[]);
});
test('Schiri fertig trotz ausstehender Erstattung beim Obmann',()=>{
 const v={prozess_status:'zahlung_beauftragt',schiri_abgeschlossen:true,naechster_schritt:{rolle:'vorstand',titel:'Überweisen'}};
 assert.equal(naechsterSchrittText(v),'Erhalt bestätigt · für dich abgeschlossen.');
 assert.match(prozessLinieHtml({...v,schritte:[{titel:'Erhalt bestätigt',stand:'erledigt'}]},String),/Erhalt bestätigt/);
});
test('Vereinsweg fordert Schiri-Erhalt und eigene Erstattung statt Sofortabschluss',()=>{
 assert.match(sql,/'eingegangen','uebergeben','weg1_obmann_besorgt',array\['schiri'\]/);
 assert.match(sql,/'uebergeben','zahlung_beauftragt','weg1_obmann_besorgt'/);
 assert.match(sql,/'zahlung_angewiesen','geld_erhalten','weg1_obmann_besorgt',array\['obmann'\]/);
 assert.match(sql,/Die Erstattung ist noch offen/);
});
test('Bestellwegwechsel sperrt Kauf, Bestellung, fremde Vereine und veraltete Ansichten',()=>{
 assert.match(sql,/s\.verein_id=v/);
 assert.match(sql,/p_bisheriger_weg is distinct from/);
 assert.match(sql,/a\.gekauft_am is not null/);
 assert.match(sql,/a\.bestellt_am is not null/);
 const wechsel=sql.split('create or replace function public.obmann_anfrage_bestellweg_aendern')[1].split('end $$;')[0];
 assert.doesNotMatch(wechsel,/set prozess_status|set vorlage_preis_cent|set freigabe_status/);
 assert.match(wechsel,/for update of t/);
});
test('Externe Freigabe ist ausdrücklich dokumentiert, nicht als eigenes Vorstandslogin behauptet',()=>{
 assert.match(sql,/extern durch Obmann dokumentiert/);
 assert.match(sql,/Nur eine vorgelegte Anfrage/);
 assert.match(sql,/Name und nachvollziehbare Gesprächsnotiz/);
 assert.match(sql,/revoke all on function public\.obmann_anfrage_freigabe_dokumentieren/);
});
test('Zahlungsmail trennt Obmann und Schiri, alte Aufträge bleiben kompatibel',()=>{
 const club=vorstandZahlungMail({person:'RK',betrag_cent:3500,empfaenger_rolle:'obmann'});
 assert.match(club.text,/Erstattung an den Obmann/);
 assert.doesNotMatch(club.text,/Danach bestätigt der Schiedsrichter/);
 const selbst=vorstandZahlungMail({person:'RK',betrag_cent:3500});
 assert.match(selbst.text,/Danach bestätigt der Schiedsrichter/);
});
