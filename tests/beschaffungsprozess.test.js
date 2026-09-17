// ============================================================
//  Der Beschaffungsprozess als Vertrag
// ------------------------------------------------------------
//  Hier wird nicht geprueft, ob eine Seite huebsch aussieht,
//  sondern ob die Regeln, auf die sich drei Oberflaechen
//  verlassen, ueberhaupt in der Datenbank stehen.
//
//  Der Anlass: bis v148 hat sich jede Oberflaeche - Website,
//  Obmann-App, Vorstandsseite - ihre eigene Kette aus Status,
//  Beschaffungsweg und ein paar Booleans zusammengereimt.
//  Deshalb konnten drei Oberflaechen drei verschiedene Zustaende
//  desselben Vorgangs anzeigen.
//
//  Diese Tests lesen die Migrationen als Text. Das ist bewusst
//  so: sie sollen genau dann anschlagen, wenn jemand eine Regel
//  aus dem Vertrag wieder herausnimmt - auch wenn gerade keine
//  Datenbank erreichbar ist.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { saisonKontext } from "../src/website/freigabe-zugriff.js";

const lies = (n) => readFileSync(new URL("../" + n, import.meta.url), "utf8");

const VERTRAG = lies("supabase/migrations/20260917180000_v149_ausruestung_prozessvertrag.sql");
const AKTIONEN = lies("supabase/migrations/20260917190000_v150_ausruestung_aktionen_und_zeitleiste.sql");
const POSTFACH = lies("supabase/migrations/20260917200000_v151_ausruestung_postfach_und_freigabestapel.sql");
const EINGANG = lies("supabase/migrations/20260917210000_v152_eingang_prozess_status.sql");

/* ============================================================
   Die Zustaende
   ============================================================ */

test("der gemeinsame Anfang und beide Wege stehen als Zustaende in der Datenbank", () => {
  const gemeinsam = ["eingereicht", "geprueft", "vorgelegt", "abgelehnt", "freigegeben"];
  const selbstkauf = ["gekauft", "beleg_hochgeladen", "beleg_geprueft",
    "zahlung_angewiesen", "geld_erhalten"];
  const vereinskauf = ["bestellt", "eingegangen", "uebergeben"];
  for (const zustand of [...gemeinsam, ...selbstkauf, ...vereinskauf, "abgeschlossen", "zurueckgezogen"]) {
    assert.match(VERTRAG, new RegExp(`'${zustand}'`), `Zustand ${zustand} fehlt`);
  }
});

test("Zahlung angewiesen und Geld erhalten sind zwei verschiedene Schritte", () => {
  // Der alte Schalter "erstattet" hat beides in einen Topf geworfen:
  // "die Ueberweisung ist raus" weiss der Vereinsverantwortliche, "das
  // Geld ist da" weiss nur der Schiedsrichter.
  assert.match(VERTRAG, /'beleg_geprueft',\s*'zahlung_angewiesen'/);
  assert.match(VERTRAG, /'zahlung_angewiesen',\s*'geld_erhalten'/);
  assert.match(VERTRAG, /zahlung_angewiesen_von/);
  assert.match(VERTRAG, /geld_erhalten_von/);
});

/* ============================================================
   Wer darf was
   ============================================================ */

test("freigeben darf ausschliesslich der Vorstand", () => {
  // Max darf pruefen und weiterreichen. Ueber Vereinsgeld entscheidet er
  // nicht - und das steht hier, nicht in einer View-Bedingung.
  const zeile = VERTRAG.match(/\('vorgelegt',\s*'freigegeben',[^)]*\)/);
  assert.ok(zeile, "Uebergang vorgelegt -> freigegeben fehlt");
  assert.match(zeile[0], /array\['vorstand'\]/);
  assert.doesNotMatch(zeile[0], /'obmann'/);
});

test("der Obmann kann Schritte nur aus einer festen Liste setzen", () => {
  // Kein frei verstellbarer Status mehr: die App schickt eine Absicht,
  // die Datenbank entscheidet, ob sie zulaessig ist.
  assert.match(AKTIONEN, /create or replace function public\.obmann_anfrage_schritt/);
  assert.match(AKTIONEN, /raise exception 'Diesen Schritt kann der Obmann nicht setzen\.'/);
  assert.match(AKTIONEN, /raise exception 'Diesen Schritt kann der Schiedsrichter nicht setzen\.'/);
});

test("der alte freie Status-Picker ist fuer Ausruestung gesperrt", () => {
  const funktion = AKTIONEN.match(
    /create or replace function public\.obmann_anfrage_status_setzen[\s\S]*?\$\$;/);
  assert.ok(funktion, "obmann_anfrage_status_setzen wurde nicht neu definiert");
  assert.match(funktion[0], /if v_typ = 'ausruestung' then\s*\n\s*raise exception/);
});

/* ============================================================
   Was serverseitig scheitern muss
   ============================================================ */

test("eine Ablehnung ohne Begruendung scheitert in der Datenbank", () => {
  // Der Schiedsrichter bekommt diesen Text zu lesen. Ein leeres Nein ist
  // keine Antwort - und eine Pruefung nur im Frontend ist keine Pruefung.
  assert.match(VERTRAG, /if p_nach = 'abgelehnt' and v_notiz is null then\s*\n\s*raise exception/);
});

test("ohne vorgelegten Betrag kann nichts freigegeben werden", () => {
  assert.match(VERTRAG,
    /if p_nach = 'freigegeben' and a\.vorlage_preis_cent is null then\s*\n\s*raise exception/);
  assert.match(AKTIONEN, /Ohne Betrag kann nichts vorgelegt werden/);
});

test("ein vorgelegter Vorgang laesst sich nicht unbemerkt umpreisen", () => {
  // Sonst haette der Vorstand faktisch etwas anderes freigegeben, als er
  // gesehen hat.
  assert.match(VERTRAG, /create or replace function public\.ausruestung_vorlage_schuetzen/);
  assert.match(VERTRAG, /new\.vorlage_preis_cent is distinct from old\.vorlage_preis_cent/);
  assert.match(VERTRAG, /new\.preis_final_cent is distinct from old\.preis_final_cent/);
  assert.match(VERTRAG, /create trigger ausruestung_vorlage_schuetzen_trigger/);
});

test("eine Preisaenderung nach der Entscheidung erzwingt eine neue Freigabe", () => {
  // Zurueck auf "geprueft" heisst: neue Runde, alte Entscheidung gilt
  // nicht mehr, bleibt aber als Ereignis stehen.
  assert.match(VERTRAG, /\('freigegeben',\s*'geprueft',\s*'beide',\s*array\['obmann'\]\)/);
  assert.match(VERTRAG, /prozess_runde\s*=\s*case when p_nach = 'geprueft'/);
  assert.match(VERTRAG, /vorlage_preis_cent\s*=\s*case when p_nach = 'geprueft' then null/);
});

test("ein Beleg vor der Freigabe ist nicht vorgesehen", () => {
  // "beleg_hochgeladen" ist nur aus "gekauft" erreichbar, und "gekauft"
  // nur aus "freigegeben".
  assert.match(VERTRAG, /\('freigegeben',\s*'gekauft',\s*'weg2_schiri_besorgt'/);
  assert.match(VERTRAG, /\('gekauft',\s*'beleg_hochgeladen',\s*'weg2_schiri_besorgt'/);
  assert.match(AKTIONEN, /Ein Beleg ist fuer diesen Vorgang gerade nicht vorgesehen/);
});

/* ============================================================
   Der Freigabe-Stapel
   ============================================================ */

test("ein Freigabe-Link sieht nur seinen eigenen Stapel", () => {
  // Vorher haette ein laufender Link ohne Zutun auch alles erfasst, was
  // erst spaeter vorgelegt wurde.
  assert.match(VERTRAG, /vorlage_link_id/);
  assert.match(AKTIONEN, /vorlage_link_id\s*=\s*v_link/);
  const entscheiden = AKTIONEN.match(
    /create or replace function public\.freigabe_entscheiden[\s\S]*?\$\$;/);
  assert.ok(entscheiden);
  assert.match(entscheiden[0], /a\.vorlage_link_id = v_link/);
  assert.match(entscheiden[0], /a\.prozess_status = 'vorgelegt'/);
  for (const stelle of [POSTFACH]) {
    assert.match(stelle, /a\.vorlage_link_id = v_link/);
  }
});

test("beim Vorlegen werden Betrag und Umfang eingefroren", () => {
  const vorlegen = AKTIONEN.match(
    /create or replace function public\.obmann_anfrage_vorlegen[\s\S]*?\$\$;/);
  assert.ok(vorlegen);
  assert.match(vorlegen[0], /vorlage_preis_cent = v_betrag/);
  assert.match(vorlegen[0], /vorlage_umfang\s*=\s*jsonb_build_object/);
});

/* ============================================================
   Die gemeinsame Ereignisliste
   ============================================================ */

test("es gibt genau eine Ereignistabelle, und sie ist gegen Direktzugriff zu", () => {
  assert.match(VERTRAG, /create table if not exists public\.ausruestung_ereignisse/);
  assert.match(VERTRAG, /alter table public\.ausruestung_ereignisse enable row level security/);
  assert.doesNotMatch(VERTRAG, /create policy[\s\S]*ausruestung_ereignisse/);
});

test("Ereignisse sind idempotent - ein zweiter Klick erzeugt keinen zweiten Eintrag", () => {
  assert.match(VERTRAG, /schluessel\s+text not null unique/);
  assert.match(VERTRAG, /on conflict \(schluessel\) do nothing/);
  // Die Runde gehoert in den Schluessel, sonst waere eine zweite Vorlage
  // desselben Vorgangs nicht mehr abbildbar.
  assert.match(VERTRAG, /p_anfrage::text \|\| ':' \|\| p_schritt \|\| ':' \|\| v_runde::text/);
});

test("genau die fuenf meldenswerten Ereignisse landen im Postfach", () => {
  // Nicht jede technische Aenderung wird zu einer Nachricht. Die Liste
  // steht bewusst an genau einer Stelle.
  const zeile = VERTRAG.match(/p_nach in \('eingereicht','freigegeben','abgelehnt','gekauft',[\s\S]{0,80}?\)\)/);
  assert.ok(zeile, "die Auswahl der Postfach-Ereignisse wurde umgebaut");
  for (const schritt of ["eingereicht", "freigegeben", "abgelehnt", "gekauft",
    "beleg_hochgeladen", "geld_erhalten"]) {
    assert.match(zeile[0], new RegExp(`'${schritt}'`), schritt);
  }
});

test("jede neue Anfrage meldet sich von selbst im Postfach", () => {
  // Als Trigger und nicht in einer einzelnen RPC: es soll egal sein, ueber
  // welchen Weg eine Anfrage entsteht.
  assert.match(POSTFACH, /create trigger ausruestung_anfrage_eroeffnen_trigger/);
  assert.match(POSTFACH, /after insert on public\.ausruestungs_anfragen/);
});

test("der Eingang kennt die Art 'prozess', und 'anfrage' meint nur noch Anliegen", () => {
  assert.match(POSTFACH, /'anfrage','prozess','absage'/);
  const strom = POSTFACH.match(/with anfragen as \([\s\S]*?\),\s*\n\s*prozess as/);
  assert.ok(strom, "der Anliegen-Strom wurde umgebaut");
  assert.match(strom[0], /a\.typ = 'anliegen'/);
});

test("ein Prozessereignis wird abgehakt, nicht geloescht", () => {
  // Es ist der Nachweis, wer was wann entschieden hat.
  assert.match(POSTFACH, /elsif p_art = 'prozess' then\s*\n\s*update ausruestung_ereignisse/);
  assert.doesNotMatch(POSTFACH, /delete from ausruestung_ereignisse/);
  assert.match(EINGANG, /elsif p_art = 'prozess' then/);
  assert.match(EINGANG, /Status % ist fuer einen Prozesseintrag nicht zulaessig/);
});

/* ============================================================
   Was der Vorstand zu sehen bekommt
   ============================================================ */

test("die Vorstandsseite zeigt keinen Ausruestungsbestand und keine Personenhistorie mehr", () => {
  // Fuer eine Entscheidung ueber ein Trikot braucht es das nicht - und bei
  // minderjaehrigen Schiedsrichtern ist es deutlich zu viel.
  const dashboard = POSTFACH.match(
    /create or replace function public\.freigabe_dashboard[\s\S]*?\$function\$;/);
  assert.ok(dashboard);
  assert.doesNotMatch(dashboard[0], /ausruestungsbestand/);
  assert.doesNotMatch(dashboard[0], /'schiedsrichter',/);
  const seite = lies("src/website/freigabe-seite.js");
  assert.doesNotMatch(seite, /bestandText|fg-bestand|fg-person-karte/);
});

test("der Saisonkontext nennt eine Zahl und sonst nichts", () => {
  assert.equal(saisonKontext({ saison_freigegeben_anzahl: 0 }),
    "In dieser Saison noch nichts freigegeben.");
  assert.equal(saisonKontext(null), "In dieser Saison noch nichts freigegeben.");
  const zwei = saisonKontext({ saison_freigegeben_anzahl: 2, saison_freigegeben_cent: 7000 });
  assert.match(zwei, /2 Stücke/);
  assert.match(zwei, /70,00/);
  assert.match(saisonKontext({ saison_freigegeben_anzahl: 1, saison_freigegeben_cent: 3500 }),
    /ein Stück/);
});

test("der Vorstand kann die angewiesene Zahlung selbst eintragen - muss aber nicht", () => {
  // Beide Wege sind vorgesehen: ueber die Seite, oder der Obmann traegt es
  // nach einer Nachricht ein. In beiden Faellen steht hinterher da, wer es
  // war.
  assert.match(AKTIONEN, /create or replace function public\.freigabe_zahlung_angewiesen/);
  assert.match(VERTRAG,
    /\('beleg_geprueft',\s*'zahlung_angewiesen',\s*'weg2_schiri_besorgt',\s*array\['obmann','vorstand'\]\)/);
  const zugriff = lies("src/website/freigabe-zugriff.js");
  assert.match(zugriff, /freigabe_zahlung_angewiesen/);
});

/* ============================================================
   Eine Quelle fuer alle Oberflaechen
   ============================================================ */

test("die Schrittliste wird an genau einer Stelle gebaut", () => {
  // Website, Obmann-App und Vorstandsseite lesen dieselbe Liste und
  // stellen sie nur unterschiedlich dar.
  assert.match(AKTIONEN, /create or replace function public\.ausruestung_prozess_jsonb/);
  for (const tuer of ["obmann_anfrage_prozess", "schiri_anfrage_prozess"]) {
    assert.match(AKTIONEN, new RegExp(`${tuer}[\\s\\S]{0,900}?ausruestung_prozess_jsonb`), tuer);
  }
  // Die erlaubten Aktionen kommen aus derselben Uebergangstabelle wie die
  // serverseitige Pruefung - nicht aus einer zweiten Liste daneben.
  assert.match(AKTIONEN, /from public\.ausruestung_uebergaenge\(\) u\s*\n\s*where u\.von = a\.prozess_status/);
});

test("die inneren Bausteine bleiben von aussen unerreichbar", () => {
  for (const funktion of ["ausruestung_uebergaenge", "ausruestung_ereignis_schreiben",
    "ausruestung_uebergang", "ausruestung_prozess_jsonb", "freigabe_link_id"]) {
    const quelle = `${VERTRAG}\n${AKTIONEN}`;
    assert.match(quelle, new RegExp(`revoke all on function public\\.${funktion}`), funktion);
    assert.doesNotMatch(quelle,
      new RegExp(`grant execute on function public\\.${funktion}`), funktion);
  }
});
