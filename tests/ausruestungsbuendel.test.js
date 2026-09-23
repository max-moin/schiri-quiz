import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { betreffFuer } from "../supabase/functions/obmann-benachrichtigungen/betreff.js";
import { vorstandMail, vorstandZahlungMail } from "../supabase/functions/obmann-benachrichtigungen/vorstand-mail.js";

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

test("Anfrage zeigt kein irrefuehrendes Null-Stuecke und erlaubt das Bearbeiten vor Versand", () => {
  const formular = lies("src/ui/profil-fenster.js");
  const steuerung = lies("src/features/profile-requests.js");
  const css = lies("stil/profil.css");
  assert.match(formular, /Noch kein Stück/);
  assert.match(formular, /Dieses Stück übernehmen/);
  assert.match(steuerung, /anfrageAbsendenButton\.disabled = !anfragePositionen\.length/);
  assert.match(steuerung, /bearbeitetePosition = index/);
  assert.match(steuerung, /Änderung übernehmen/);
  assert.match(steuerung, /Bitte übernimm zuerst dieses Stück/);
  assert.doesNotMatch(steuerung, /if \(anfrageKategorieAuswahl\.value && !fuegeAktuellePositionHinzu\(\)\)/);
  assert.match(css, /input:checked \+ span::after \{ content: "✓"/);
});

test("Kauf erzeugt keine Obmann-Mail und der Preisvergleich bleibt getrennt", () => {
  const nachzug = lies("supabase/migrations/20260923123000_anfrage_klartext_und_preisvergleich.sql");
  assert.match(nachzug, /'preis_richtwert_cent', a\.preis_richtwert_cent/);
  assert.match(nachzug, /'preis_schiri_cent', a\.preis_schiri_cent/);
  assert.match(nachzug, /\('eingereicht', 'beleg_hochgeladen', 'geld_erhalten'\)/);
  assert.doesNotMatch(nachzug, /\('eingereicht', 'gekauft', 'beleg_hochgeladen'/);
});

test("Zahlungsauftrag und Ausführung sind zwei getrennte, berechtigte Schritte", () => {
  const migration = lies("supabase/migrations/20260923133000_zahlung_zweistufig.sql");
  assert.match(migration, /'beleg_geprueft','zahlung_beauftragt'/);
  assert.match(migration, /'zahlung_beauftragt','zahlung_angewiesen'/);
  assert.doesNotMatch(migration, /'beleg_geprueft','zahlung_angewiesen'/);
  assert.match(migration, /p_email boolean default true/);
  assert.match(migration, /if v_notiz is null or char_length\(v_notiz\) < 10/);
  assert.match(migration, /a\.prozess_status = 'zahlung_beauftragt'/);
  assert.match(migration, /public\.freigabe_verein\(p_token\)/);
  assert.match(migration, /'zahlung_beauftragt' then 8/);
  assert.match(migration, /'zahlung_angewiesen' then 9/);
  const eingang = lies("supabase/migrations/20260923134500_zahlung_im_obmann_eingang.sql");
  assert.match(eingang, /new\.schritt = 'zahlung_angewiesen'/);
  assert.match(eingang, /new\.akteur_rolle = 'vorstand'/);
  const portal = lies("src/website/freigabe-seite.js");
  assert.match(portal, /zugriff\.zahlungen\(token\)/);
  assert.match(portal, /stand\.zahlungen = \[\]/);
  const mail = vorstandZahlungMail({
    person: "Testperson", bezeichnung: "Hose", farbe: "Blau",
    groesse: "M", betrag_cent: 3500,
    hinweis: "Papierbeleg liegt im Fach",
  });
  assert.match(mail.betreff, /ZAHLUNG.*35,00/);
  assert.match(mail.text, /Papierbeleg liegt im Fach/);
  assert.doesNotMatch(mail.text, /code=|Passwort/);
});

test("Obmann-Benachrichtigung nennt bei Gruppen nur die Anzahl statt mehrerer Mails", () => {
  assert.match(betreffFuer("ausruestung.eingereicht", { anzeigename: "Josef G.", anzahl: 3 }),
    /Josef G\. \(3 Teile\)$/);
  assert.doesNotMatch(betreffFuer("ausruestung.eingereicht", { anzeigename: "Josef G.", anzahl: 1 }),
    /Teile/);
});

test("Vorstand bekommt erst nach Vorlage genau eine Mail mit allen Positionen", () => {
  const mailSql = lies("supabase/migrations/20260923181500_buendel_vorpruefung.sql");
  assert.match(mailSql, /a\.prozess_status in \('eingereicht', 'geprueft'\)/);
  assert.match(mailSql, /new\.prozess_status = 'abgelehnt'/);
  assert.match(mailSql, /v_marker::text/);
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

test("Obmann prueft alle noch offenen Gruppenpositionen in einer Transaktion", () => {
  const migration = lies("supabase/migrations/20260923181500_buendel_vorpruefung.sql");
  assert.match(migration, /jsonb_array_length\(p_entscheidungen\) <> v_offen/);
  assert.match(migration, /v_e\.id = any\(v_gesehen\)/);
  assert.match(migration, /v_e\.entscheidung not in \('vorlegen', 'ablehnen'\)/);
  assert.match(migration, /char_length\(btrim\(coalesce\(v_e\.grund, ''\)\)\) < 5/);
  assert.match(migration, /perform public\.obmann_anfrage_ablehnen/);
  assert.match(migration, /perform public\.obmann_anfrage_direkt_vorlegen/);
  assert.match(migration, /where a\.buendel_id = p_buendel_id[\s\S]*a\.prozess_status in \('eingereicht', 'geprueft'\)/);
});

test("Beschaffungsfilter kann abgeschlossene Vorgänge wieder einblenden", () => {
  const migration = lies("supabase/migrations/20260923184500_beschaffung_abgeschlossene_liste.sql");
  assert.match(migration, /create or replace function public\.obmann_prozess_liste/);
  assert.doesNotMatch(migration, /a\.prozess_status <> 'abgeschlossen'/);
  assert.match(migration, /public\.ausruestung_prozess_jsonb\(a\.id, 'obmann'\)/);
});

test("Tom kann eine Teilmenge eines Bündels atomar entscheiden oder als bezahlt bestätigen", () => {
  const migration = lies("supabase/migrations/20260923234000_freigabe_buendelaktionen.sql");
  const seite = lies("src/website/freigabe-seite.js");
  const html = lies("freigabe.html");
  assert.match(migration, /create function public\.freigabe_buendel_entscheiden/);
  assert.match(migration, /create function public\.freigabe_buendel_zahlung_bestaetigen/);
  assert.match(migration, /a\.buendel_id = p_buendel_id/);
  assert.match(migration, /a\.prozess_status = 'vorgelegt'/);
  assert.match(migration, /a\.prozess_status = 'zahlung_beauftragt'/);
  assert.match(migration, /v_anzahl <> array_length\(p_ids, 1\)/);
  assert.match(migration, /perform public\.freigabe_entscheiden/);
  assert.match(migration, /perform public\.freigabe_zahlung_angewiesen/);
  assert.match(seite, /data-buendel-entscheidung/);
  assert.match(seite, /data-buendel-zahlung/);
  assert.match(seite, /zugriff\.buendelZahlungBestaetigen/);
  assert.match(html, /<dialog id="fgBestaetigung"/);
  assert.doesNotMatch(seite, /\[data-zahlung\][\s\S]{0,400}await zugriff\.zahlungAngewiesen/);
});
