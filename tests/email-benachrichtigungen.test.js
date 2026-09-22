import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { betreffFuer, saubererAnzeigename } from "../supabase/functions/obmann-benachrichtigungen/betreff.js";

const migration = readFileSync(
  new URL("../supabase/migrations/20260922120508_v159_obmann_benachrichtigungen.sql", import.meta.url),
  "utf8",
);
const funktion = readFileSync(
  new URL("../supabase/functions/obmann-benachrichtigungen/index.ts", import.meta.url),
  "utf8",
);
const cronMigration = readFileSync(
  new URL("../supabase/migrations/20260922120600_v160_obmann_benachrichtigungen_cron.sql", import.meta.url),
  "utf8",
);
const indexMigration = readFileSync(
  new URL("../supabase/migrations/20260922120700_v161_benachrichtigungs_empfaenger_index.sql", import.meta.url),
  "utf8",
);

test("Outbox ist standardmaessig aus und nicht ueber die Data API lesbar", () => {
  assert.match(migration, /values \('max', false\)/);
  for (const tabelle of ["benachrichtigungs_einstellungen", "benachrichtigungs_ereignisse", "benachrichtigungs_auftraege"]) {
    assert.match(migration, new RegExp(`alter table public\\.${tabelle} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.${tabelle} from public, anon, authenticated`, "i"));
  }
  assert.doesNotMatch(migration, /create\s+policy/i);
});

test("Fachereignis und Versandauftrag besitzen getrennte Idempotenz", () => {
  assert.match(migration, /schluessel text not null unique/);
  assert.match(migration, /unique \(ereignis_id, empfaenger_schluessel, kanal\)/);
  assert.match(migration, /for update of a skip locked/i);
  assert.match(migration, /gesperrt_bis = now\(\) \+ interval '5 minutes'/);
  assert.match(funktion, /"Idempotency-Key": auftrag\.idempotenzschluessel/);
});

test("nur fachliche Neuzugaenge loesen aus", () => {
  for (const trigger of [
    "benachrichtigung_ausruestung_trigger",
    "benachrichtigung_quiz_pruefen_trigger",
    "benachrichtigung_frage_feedback_trigger",
    "benachrichtigung_meldung_trigger",
    "benachrichtigung_fragenvorschlag_trigger",
    "benachrichtigung_terminvorschlag_trigger",
    "benachrichtigung_terminabsage_trigger",
  ]) assert.match(migration, new RegExp(`create trigger ${trigger}`));
  assert.match(migration, /after insert on public\.antworten/);
  assert.match(migration, /new\.status <> 'ab'/);
  assert.match(migration, /old\.status = 'ab'/);
  assert.doesNotMatch(migration, /eingang_gelesen_am[\s\S]{0,100}benachrichtigung_einreihen/);
  assert.doesNotMatch(migration, /eingang_erledigt_am[\s\S]{0,100}benachrichtigung_einreihen/);
});

test("Quizabschluss ist je Person und Runde genau einmal", () => {
  assert.match(migration, /'quiz:' \|\| new\.schiedsrichter_id::text \|\| ':' \|\| v_runde\.runde_id::text/);
  assert.match(migration, /if v_soll > 0 and v_ist >= v_soll/);
  assert.match(migration, /if not found or v_schiri\.ist_test then return new/);
});

test("Betreff ist auffaellig, kurz und ohne unkontrollierte Zeilenumbrueche", () => {
  assert.equal(betreffFuer("quiz.abgeschlossen", { anzeigename: "Peter G." }),
    "— SR-OBMANN · QUIZ — Quiz abgeschlossen: Peter G.");
  assert.equal(betreffFuer("meldung.vorfall", { anzeigename: "Nicht anzeigen" }),
    "— SR-OBMANN · MELDUNG — Neuer Vorfall");
  assert.equal(saubererAnzeigename(" Max\nM. "), "Max M.");
  assert.ok(betreffFuer("ausruestung.eingereicht", { anzeigename: "Luca N." }).length < 100);
});

test("E-Mail hat keinen fachlichen Body und keine Zugangsdaten im Repository", () => {
  assert.match(funktion, /text: ""/);
  assert.match(funktion, /<p>&nbsp;<\/p>/);
  assert.match(funktion, /Deno\.env\.get\(name\)/);
  assert.doesNotMatch(funktion, /@proton\.me|re_[A-Za-z0-9]/);
  assert.doesNotMatch(migration, /@proton\.me|RESEND_API_KEY\s*=/);
});

test("Dispatcher wiederholt nur temporaere Fehler und gibt nach fuenf Versuchen auf", () => {
  assert.match(migration, /a\.versuche < 5/);
  assert.match(migration, /when 1 then interval '1 minute'/);
  assert.match(migration, /when 4 then interval '1 hour'/);
  assert.match(funktion, /antwort\.status !== 429/);
  assert.match(funktion, /versand_config_missing/);
});

test("Cron ruft die Function autorisiert auf und bleibt ohne Vault-Konfiguration ruhig", () => {
  assert.match(cronMigration, /'\*\/2 \* \* \* \*'/);
  assert.match(cronMigration, /having count\(\*\) filter/);
  assert.match(cronMigration, /'Authorization', 'Bearer ' \|\| k\.publishable_key/);
  assert.match(cronMigration, /'apikey', k\.publishable_key/);
  assert.doesNotMatch(cronMigration, /sb_publishable_|supabase\.co/);
});

test("der Empfaenger-Fremdschluessel besitzt einen eigenen Index", () => {
  assert.match(indexMigration, /benachrichtigungs_auftraege_empfaenger_idx/);
  assert.match(indexMigration, /\(empfaenger_schluessel\)/);
});
