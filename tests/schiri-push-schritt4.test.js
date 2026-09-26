import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nachrichtFuer } from "../server/schiri-push.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const sql = lies("supabase/migrations/20260926091250_schiri_push_termine_v2.sql");
const id = "11111111-1111-1111-1111-111111111111";

test("Terminerinnerung ist per Termin und Schiri freiwillig, Alttermine bleiben aus", () => {
  assert.match(sql, /erinnerung_modus text not null default 'aus'/);
  assert.match(sql, /schiri_push_termine_setzen/);
  assert.match(sql, /public\.schiri_pin_pruefen\(p_schiedsrichter_id,p_pin\)/);
  assert.match(sql, /and p\.termine/);
  assert.match(sql, /t\.sichtbarkeit<>'nur_app'/);
  assert.match(sql, /t\.pflicht and s\.verein_id=t\.verein_id/);
  assert.match(sql, /r\.status='zu'/);
  assert.match(sql, /t\.sichtbarkeit='oeffentlich' or s\.verein_id=t\.verein_id/);
});

test("Erinnerungen laufen zu Berliner Zeiten und nie nach Terminbeginn", () => {
  assert.match(sql, /now\(\) at time zone 'Europe\/Berlin'/);
  assert.match(sql, /between 1080 and 1089/);
  assert.match(sql, /between 540 and 549/);
  assert.match(sql, /t\.beginn_zeit>time '09:00'/);
  assert.match(sql, /t\.beginn_zeit>\(now\(\) at time zone 'Europe\/Berlin'\)::time/);
  assert.match(sql, /on conflict\(schluessel\) do nothing/);
  assert.match(sql, /for update of a skip locked/);
});

test("Umplanung, Widerruf und geänderte Zusage werden vor Zustellung neu geprüft", () => {
  assert.match(sql, /schiri_push_termin_gueltig\([\s\S]*?p_datum date,p_beginn text,p_phase text/);
  assert.match(sql, /t\.datum=p_datum/);
  assert.match(sql, /coalesce\(t\.beginn_zeit::text,''\)=p_beginn/);
  assert.match(sql, /einwilligung_widerrufen/);
  assert.match(sql, /termin_nicht_mehr_gueltig/);
  assert.match(sql, /public\.schiri_push_termin_gueltig\([\s\S]*?e\.metadaten->>'phase'/);
  assert.match(sql, /grant execute on function public\.schiri_push_termin_zustellliste\(uuid\) to service_role/);
});

test("Website, App, Cron und Dispatcher verwenden denselben Schritt", () => {
  assert.match(lies("mitteilungen.html"), /id="mitteilungen-termine"/);
  assert.match(lies("src/website/mitteilungen-steuerung.js"), /schiri_push_termine_setzen/);
  assert.match(lies("supabase/functions/obmann-benachrichtigungen/index.ts"), /schiri_push_termine_einreihen/);
  assert.match(lies("api/push-auftraege.js"), /schiri_push_termin_zustellliste/);
  const nachricht = JSON.parse(nachrichtFuer("termin.erinnerung", id, `termin_${id}`));
  assert.equal(nachricht.ziel, "/termine.html");
  assert.doesNotMatch(JSON.stringify(nachricht), /Max|Schiedsrichter|SR-Treff|Datum/);
});
