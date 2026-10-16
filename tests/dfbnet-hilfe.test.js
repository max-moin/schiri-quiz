import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DFB_GUIDES } from '../src/website/dfbnet-redaktion.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Hilfe und DFBnet-Einstieg verknüpfen alle vereinbarten Themen',()=>{
 const h=lies('hilfe.html'),hub=lies('dfbnet.html');
 for(const p of ['spielbericht','rote-karte',...DFB_GUIDES]){assert.match(h,new RegExp(`href="${p}.html"`));assert.match(hub,new RegExp(`href="${p}.html`));}
 assert.match(h,/hilfe-dfbnet-einstieg/);assert.match(h,/bilder\/dfbnet-logo.png/);assert.match(h,/Website & Verein/);
 assert.match(hub,/spielbericht.html#wechsel/);assert.match(hub,/Sperrtermin/);assert.match(hub,/Spielersperre/);
 for(const p of ['dfbnet',...DFB_GUIDES]){
  const html=lies(`${p}.html`);for(const m of html.matchAll(/href="([a-zA-Z0-9_-]+\.html)(?:#[^"]*)?"/g))assert.ok(existsSync(new URL('../'+m[1],import.meta.url)),m[1]);
  assert.match(lies('src/ui/wegweiser.js'),new RegExp(`"${p}.html"`));assert.match(lies('src/website/hilfe-inhalte.js'),new RegExp(`'${p}.html'`));
 }
});
test('Neue Guides haben stabile Inhalts-IDs, Phasen und sichere getrennte Redaktion',()=>{
 for(const p of DFB_GUIDES){
  const h=lies(`${p}.html`),ids=[...h.matchAll(/data-sb-inhalt="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length>10&&ids.length<=60);
  assert.match(h,new RegExp(`data-dfbnet-guide="${p}"`));assert.doesNotMatch(h,/data-spielbericht/);
  for(const phase of ['vorbereiten','erfassen','abschliessen'])assert.match(h,new RegExp(`id="${phase}"`));
  assert.match(h,/data-ansicht="kurz"/);assert.match(h,/role="group" aria-label="Textumfang"/);
  assert.match(h,/dfbnet-redaktion.js/);assert.match(h,/<noscript>/);
 }
 const js=lies('src/website/dfbnet-redaktion.js');assert.match(js,/kennung:`\$\{seite\}-v1`/);assert.match(js,/DFB_GUIDES.includes\(seite\)/);
 assert.doesNotMatch(js,/innerHTML\s*=|service_role|signInWithPassword|localStorage/);
});
test('Sperrtermine nutzen aktuelle lokale Vorgaben und verwechseln Kalender nicht mit Absage',()=>{
 const h=lies('sperrtermine.html');
 for(const text of ['20. des Vormonats','19–20 Uhr','auch dann, wenn du sie danach absagen musst','Bis zur tatsächlichen Absetzung','24 Stunden','Modernisierung 2025'])assert.ok(h.includes(text),text);
 assert.match(h,/Vereinskalender/);assert.match(h,/vorlagen.html/);assert.match(h,/kein aktueller Bildschirmplan/);
});
test('Beobachtungsfeedback ist keine Leistungsnote und wird nicht als anonymes Eingabeformular verkauft',()=>{
 const h=lies('schiri-beobachtung.html');
 assert.match(h,/feedbackbogen-beobachtungsauswertung/);assert.match(h,/Feedback zur Auswertung geben/);
 assert.match(h,/nicht der Vergabe deiner Leistungsnote/);assert.match(h,/nicht schon bei Abgabe anonym/);
 assert.match(h,/halbjährlich/);assert.match(h,/Assistenten/);assert.match(h,/Prüfung und Freigabe/);
 assert.doesNotMatch(h,/<iframe|<form|<input/);
});
test('Spielersperren bleiben Hintergrund, kein veralteter Rechner und keine Spielberechtigungsauskunft',()=>{
 const h=lies('spielersperren.html');
 assert.match(h,/2017/);assert.match(h,/Geltung/);assert.match(h,/Ableistung/);
 assert.match(h,/keine pauschale Kartenzähl- oder Sperrdauertabelle/);assert.match(h,/keine verbindliche Spielberechtigungsauskunft/);
 assert.doesNotMatch(h,/fünf gelbe Karten|5 gelbe Karten|automatisch spielberechtigt|<input|<form/);
});
test('Neue Inhaltsschlüssel behalten bestehende Seiten und AAL2-/Vereinsgrenzen',()=>{
 const sql=lies('supabase/migrations/20261016181326_dfbnet_hilfe_redaktion.sql');
 for(const key of ['dfbnet','sonderbericht','schiri-treff','rote-karte','spielbericht',...DFB_GUIDES])assert.ok(sql.includes(`'${key}'`));
 assert.match(sql,/auth\.uid\(\) is null/);assert.match(sql,/'aal2'/);assert.match(sql,/seitenschluessel=p_seitenschluessel/);
 assert.match(sql,/revoke all on function private\.blockredaktion_pruefen/);
 assert.doesNotMatch(sql,/insert into public\.website_blockseiten|update public\.website_blockseiten|grant .*entwurf/);
});
