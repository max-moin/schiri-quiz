import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { betreffFuer } from "../supabase/functions/obmann-benachrichtigungen/betreff.js";
import { vorstandMail } from "../supabase/functions/obmann-benachrichtigungen/vorstand-mail.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const sql = lies("supabase/migrations/20260922195634_ausruestungsanfragen_buendeln.sql");

test("bestehende Einzelanfragen bleiben unveraendert und neue Gruppen sind atomar", () => {
  assert.match(sql, /add column buendel_id uuid/);
  assert.doesNotMatch(sql, /update public\.ausruestungs_anfragen a\s+set buendel_id/);
  assert.match(sql, /unique \(schiedsrichter_id, absende_id\)/);
  assert.match(sql, /inhalt_abdruck/);
  assert.match(sql, /on conflict \(schiedsrichter_id, absende_id\) do nothing/);
  assert.match(sql, /jsonb_array_length\(p_positionen\) not between 1 and 12/);
});

test("jede Position behaelt einen eigenen Prozess; nur die erste kommt als neuer Eingang", () => {
  assert.match(sql, /insert into public\.ausruestungs_anfragen[\s\S]*buendel_id, buendel_position/);
  assert.match(sql, /new\.buendel_id is null or new\.buendel_position = 1/);
  assert.match(sql, /new\.schritt = 'eingereicht' and not new\.eingang then return new/);
  assert.match(sql, /public\.obmann_anfrage_vorlegen\(p_passwort, v_id, p_link_id\)/);
});

test("Website kann mehrere Stuecke mit je eigener und gemeinsamer Anmerkung einreichen", () => {
  const formular = lies("src/ui/profil-fenster.js");
  const steuerung = lies("src/features/profile-requests.js");
  assert.match(formular, /anfrage-position-hinzufuegen/);
  assert.match(formular, /anfrage-gesamt-anmerkung/);
  assert.match(steuerung, /schiri_ausruestungsbuendel_erstellen/);
  assert.match(steuerung, /p_positionen: anfragePositionen/);
  assert.match(steuerung, /p_absende_id: anfrageAbsendeId/);
});

test("Obmann-Benachrichtigung nennt bei Gruppen nur die Anzahl statt mehrerer Mails", () => {
  assert.match(betreffFuer("ausruestung.eingereicht", { anzeigename: "Josef G.", anzahl: 3 }),
    /Josef G\. \(3 Teile\)$/);
  assert.doesNotMatch(betreffFuer("ausruestung.eingereicht", { anzeigename: "Josef G.", anzahl: 1 }),
    /Teile/);
});

test("Vorstand bekommt erst nach Vorlage genau eine Mail mit allen Positionen", () => {
  const mailSql = lies("supabase/migrations/20260922213000_vorstandsbenachrichtigung_buendel.sql");
  assert.match(mailSql, /new\.prozess_status <> 'vorgelegt'/);
  assert.match(mailSql, /a\.freigabe_status = 'nicht_vorgelegt'/);
  assert.match(mailSql, /on conflict \(ereignis_id, empfaenger_schluessel, kanal\) do nothing/);
  assert.match(mailSql, /k\.email_aktiv and k\.email_ziel is not null/);
  assert.match(mailSql, /l\.widerrufen_am is null/);
  const mail = vorstandMail({ person: "Josef Gessner", gesamt_cent: 6300,
    gesamt_anmerkung: "Grundausstattung", positionen: [
      { bezeichnung: "Trikot", farbe: "Blau", groesse: "M", preis_cent: 3500 },
      { bezeichnung: "Hose", farbe: "Schwarz", groesse: "M", preis_cent: 2000,
        anmerkung: "Alte gerissen" },
      { bezeichnung: "Stutzen", preis_cent: 800 },
    ] });
  assert.match(mail.betreff, /Josef Gessner: 3 Artikel/);
  assert.match(mail.text, /1\. Trikot · Blau · Größe M/);
  assert.match(mail.text, /2\. Hose · Schwarz · Größe M/);
  assert.match(mail.text, /3\. Stutzen/);
  assert.match(mail.text, /Alte gerissen/);
  assert.match(mail.text, /Grundausstattung/);
  assert.doesNotMatch(mail.text, /freigabe\.html\?code=/);
});
