import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {aktuelleSaison, punkteStand, PUNKTE_ARTEN} from "../src/features/fortbildungspunkte.js";
const migration = readFileSync(new URL("../supabase/migrations/20261011174826_schiri_fortbildungspunkte.sql", import.meta.url),"utf8");
test("Saison wechselt am 1. Juli in Berlin, nicht mit dem Kalenderjahr",()=>{
  assert.equal(aktuelleSaison(new Date("2026-06-30T21:59:59Z")),"2025/26");
  assert.equal(aktuelleSaison(new Date("2026-06-30T22:00:00Z")),"2026/27");
  assert.equal(aktuelleSaison(new Date("2027-01-01T12:00:00Z")),"2026/27");
});
test("Nur bestätigte Punkte zählen, U18 separat von acht regulären Möglichkeiten",()=>{
  const stand = punkteStand({ziel:5,gelegenheiten:8,termine:[{punkte_art:"rla",gewertet:true},{punkte_art:"hrt",gewertet:false},{punkte_art:"u18",gewertet:true}]});
  assert.equal(stand.anzahl,2);assert.equal(stand.regulaer,1);assert.equal(stand.bonus,1);assert.equal(stand.gelegenheiten,8);
});
test("Unbekannter Stand erfindet keine Punkte",()=>assert.equal(punkteStand(null).anzahl,0));
test("Alle Punktearten haben eine ausgeschriebene Bezeichnung",()=>assert.equal(Object.keys(PUNKTE_ARTEN).length,4));
test("RPCs und Tabellen schützen Nachweise; interne Funktion ist nicht öffentlich",()=>{
  for (const t of ["fortbildung_saisons","fortbildung_nachweise","fortbildung_korrekturen"]) assert.ok(migration.includes(`alter table public.${t} enable row level security`));
  assert.match(migration,/revoke all on function public\.fortbildung_person_stand\(uuid,text\) from public,anon,authenticated/);
  assert.match(migration,/public\.schiri_pin_pruefen\(p_schiedsrichter_id,p_pin\)/);
  assert.match(migration,/s\.verein_id=v_verein/);
});
test("Korrekturen sind versioniert, brauchen einen Grund und zählen nicht doppelt",()=>{
  assert.match(migration,/primary key\(termin_id,schiedsrichter_id\)/);
  assert.match(migration,/Stand inzwischen geändert/);
  assert.match(migration,/Eine Korrektur braucht eine Notiz/);
  assert.match(migration,/v_n\.gewertet=v_wert then continue/);
});
test("HRT setzt Anwesenheitsantworten und Uhrzeiten serverseitig aus",()=>{
  assert.match(migration,/new\.rueckmeldung_erforderlich:=false/);
  assert.match(migration,/new\.beginn_zeit:=null; new\.ende_zeit:=null/);
  assert.match(migration,/new\.zeitraum_von>new\.datum/);
});
test("Website zeigt eigenen Saisonstand mit zugänglichen Details und ohne HTML-Injektion",()=>{
  const ui=readFileSync(new URL("../src/website/fortbildungspunkte-ansicht.js",import.meta.url),"utf8");
  assert.match(ui,/meine_fortbildungspunkte/);assert.match(ui,/aria-label/);assert.match(ui,/generation!==nummer/);
  assert.ok(!ui.includes("innerHTML"));assert.match(ui,/zeitraum_von/);
});
test("Profil aktualisiert bei Kontowechsel und Wiederaufnahme statt veraltete Daten zu behalten",()=>{
  const ui=readFileSync(new URL("../src/website/meine-daten-seite.js",import.meta.url),"utf8");
  assert.match(ui,/anmeldung\.abonniere/);assert.match(ui,/visibilitychange/);assert.match(ui,/lauf !== ladeNummer/);
});
test("App-interne Termine geben nur eigenen erfassten Nachweis preis und keinen toten Website-Link",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/20261011191044_fortbildung_eigene_sicht.sql",import.meta.url),"utf8");
  assert.match(sql,/t\.sichtbarkeit<>'nur_app' or \(e\.value->>'erfasst'\)::boolean/);
  const ui=readFileSync(new URL("../src/website/fortbildungspunkte-ansicht.js",import.meta.url),"utf8");
  assert.match(ui,/t\.termin_sichtbar !== false/);
});
