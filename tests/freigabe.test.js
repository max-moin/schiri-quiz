// ============================================================
//  Freigabe durch den Vorstand
// ------------------------------------------------------------
//  Was hier schiefgehen kann, kostet echtes Geld oder gibt einen
//  Zugang preis. Deshalb liegt der Schwerpunkt auf zwei Fragen:
//  rechnet die Seite richtig, und steht der Token irgendwo, wo er
//  nicht hingehoert.
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { euro, summe, ohnePreis, stueckText, QUELLE_TEXT } from "../src/website/freigabe-zugriff.js";
import { centAusEingabe } from "../src/admin/freigabe-editor.js";

const lies = (n) => readFileSync(new URL("../" + n, import.meta.url), "utf8");

test("Betraege werden als Euro dargestellt, fehlende gar nicht", () => {
  assert.match(euro(3500), /35,00/);
  assert.match(euro(0), /0,00/);
  assert.equal(euro(null), null);
  assert.equal(euro(undefined), null);
});

test("die Summe zaehlt nur, was einen Preis hat", () => {
  const zeilen = [{ preis_cent: 3500 }, { preis_cent: null }, { preis_cent: 800 }];
  assert.equal(summe(zeilen), 4300);
  // Eine Anfrage ohne Preis darf die Summe nicht als 0 mitzaehlen und
  // dadurch so aussehen, als koste sie nichts.
  assert.equal(ohnePreis(zeilen), 1);
  assert.equal(summe([]), 0);
});

test("Eingaben werden in Cent umgerechnet, auch mit Komma und Euro-Zeichen", () => {
  assert.equal(centAusEingabe("35"), 3500);
  assert.equal(centAusEingabe("35,50"), 3550);
  assert.equal(centAusEingabe("35.50"), 3550);
  assert.equal(centAusEingabe(" 12,99 € "), 1299);
  assert.equal(centAusEingabe("0"), 0);
  // Leer heisst "kein Preis" und nicht "kostenlos".
  assert.equal(centAusEingabe(""), null);
  assert.equal(centAusEingabe("   "), null);
  assert.throws(() => centAusEingabe("viel"), /Betrag/);
  assert.throws(() => centAusEingabe("-5"), /Betrag/);
});

test("Rundungsfehler schleichen sich nicht ein", () => {
  // 0.1 + 0.2 laesst gruessen: ohne Math.round kaeme hier 3549 heraus.
  for (const [text, cent] of [["35,49", 3549], ["1,10", 110], ["0,07", 7], ["19,99", 1999]]) {
    assert.equal(centAusEingabe(text), cent, text);
  }
});

test("das Stueck wird in einer lesbaren Zeile beschrieben", () => {
  assert.equal(stueckText({ bezeichnung: "Trikot", farbe: "rot", groesse: "M", aermellaenge: "lang" }),
    "Trikot · rot · Größe M · lang" + "er Arm");
  // Fehlende Angaben hinterlassen keine leeren Trennzeichen.
  assert.equal(stueckText({ bezeichnung: "Pfeife" }), "Pfeife");
  assert.equal(stueckText({ bezeichnung: "Hose", groesse: "L" }), "Hose · Größe L");
});

test("zu jeder Preisquelle steht ein Satz in Worten", () => {
  for (const quelle of ["obmann", "schiri", "richtwert", "unbekannt"]) {
    assert.ok(QUELLE_TEXT[quelle] && QUELLE_TEXT[quelle].length > 5, quelle);
  }
});

test("die Freigabeseite gibt den Token nicht weiter", () => {
  const seite = lies("freigabe.html");
  // Ohne noindex landet ein geteilter Link in der Suchmaschine.
  assert.match(seite, /<meta name="robots" content="noindex, nofollow"/);
  // Ohne no-referrer steht der Token im Protokoll jeder verlinkten Seite.
  assert.match(seite, /<meta name="referrer" content="no-referrer"/);
  // Keine Navigation in den internen Bereich.
  assert.doesNotMatch(seite, /haupt-nav|nav-anmelden|modus\.html|quiz\.html/);
  // Pflichtlinks nach Paragraf 5 DDG trotzdem vorhanden.
  for (const pflicht of ["impressum.html", "datenschutz.html", "nutzungsbedingungen.html"]) {
    assert.match(seite, new RegExp(`href="${pflicht}"`));
  }
});

test("die Freigabeseite haelt keinen Schluessel im HTML", () => {
  const seite = lies("freigabe.html");
  assert.doesNotMatch(seite, /createClient|sb_publishable|eyJ[A-Za-z0-9]/);
});

test("der Token wird nirgends im Browser abgelegt", () => {
  const skript = lies("src/website/freigabe-seite.js");
  assert.doesNotMatch(skript, /localStorage|sessionStorage|document\.cookie/);
  // Auch der Name des Entscheiders nicht - der Link kann weitergegeben
  // werden, und dann stuende der falsche Name da.
  const editor = lies("src/admin/freigabe-editor.js");
  assert.doesNotMatch(editor, /localStorage|sessionStorage/);
});

test("die Migration schuetzt Tabellen und oeffnet nur Funktionen", () => {
  const m = lies("supabase/migrations/20260916120000_v141_ausruestung_preise_und_freigabe.sql");
  for (const tabelle of ["ausruestung_preise", "freigabe_links"]) {
    assert.match(m, new RegExp(`alter table public\\.${tabelle} enable row level security`));
  }
  // Der Token liegt nur als Abdruck in der Datenbank.
  assert.match(m, /token_abdruck/);
  assert.doesNotMatch(m, /token\s+text\s+not null unique/);
  assert.match(m, /digest\(v_token, 'sha256'\)/);
  for (const funktion of ["freigabe_uebersicht", "freigabe_entscheiden"]) {
    assert.match(m, new RegExp(`revoke all on function public\\.${funktion}`));
    assert.match(m, new RegExp(`grant execute on function public\\.${funktion}[^;]+to anon`));
  }
  // Der Baustein zur Tokenpruefung darf von aussen nicht rufbar sein.
  assert.match(m, /revoke all on function public\.freigabe_verein\(text\) from public;/);
  assert.doesNotMatch(m, /grant execute on function public\.freigabe_verein/);
});
