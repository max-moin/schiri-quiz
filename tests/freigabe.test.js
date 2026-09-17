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

import {
  euro, betrag, datum, stueckText, QUELLE_TEXT, STAND_TEXT,
  summeMitLuecken, saisonKontext,
} from "../src/website/freigabe-zugriff.js";
import { centAusEingabe } from "../src/admin/freigabe-editor.js";

const lies = (n) => readFileSync(new URL("../" + n, import.meta.url), "utf8");

test("Betraege werden als Euro dargestellt, fehlende gar nicht", () => {
  assert.match(euro(3500), /35,00/);
  assert.match(euro(0), /0,00/);
  assert.equal(euro(null), null);
  assert.equal(euro(undefined), null);
});

test("die Summe zaehlt nur, was einen Preis hat - und sagt, was fehlt", () => {
  const zeilen = [{ preis_cent: 3500 }, { preis_cent: null }, { preis_cent: 800 }];
  const r = summeMitLuecken(zeilen);
  assert.equal(r.cent, 4300);
  assert.equal(r.anzahl, 3);
  // Eine Anfrage ohne Preis darf nicht als 0 mitzaehlen und dadurch
  // aussehen, als koste sie nichts. Die Luecke muss benannt werden.
  assert.equal(r.ohnePreis, 1);
  assert.deepEqual(summeMitLuecken([]), { cent: 0, ohnePreis: 0, anzahl: 0 });
  assert.deepEqual(summeMitLuecken(null), { cent: 0, ohnePreis: 0, anzahl: 0 });
});

test("leere Betraege werden als Strich gezeigt, nicht als 0,00", () => {
  assert.equal(betrag(null), "–");
  assert.equal(betrag(0, { nullIstNichts: true }), "–");
  // Ohne die Kennzeichnung ist 0 eine echte Zahl und wird gezeigt.
  assert.match(betrag(0), /0,00/);
  assert.match(betrag(3500), /35,00/);
});

// Die deutsche Waehrungsausgabe trennt Betrag und Zeichen mit einem
// GESCHUETZTEN Leerzeichen (je nach ICU-Fassung U+00A0 oder U+202F).
// Ein Vergleich mit einem getippten Leerzeichen scheitert dann an zwei
// Strings, die auf dem Bildschirm identisch aussehen.
const ohneSchmalraum = (text) => String(text).replace(/[\u00a0\u202f]/g, " ");

test("der Personenkontext ist auf eine einzige Zahl geschrumpft", () => {
  // Bis v150 standen hier der komplette Ausruestungsbestand und die
  // vollstaendige Anfragehistorie jeder Person. Fuer eine Entscheidung
  // ueber ein Trikot braucht es das nicht - und bei minderjaehrigen
  // Schiedsrichtern ist es deutlich mehr, als ein Vereinsverantwortlicher
  // sehen muss.
  assert.equal(
    ohneSchmalraum(saisonKontext({ saison_freigegeben_anzahl: 2, saison_freigegeben_cent: 4300 })),
    "In dieser Saison schon freigegeben: 2 Stücke (43,00 €).");
  assert.equal(saisonKontext({ saison_freigegeben_anzahl: 0 }),
    "In dieser Saison noch nichts freigegeben.");
  assert.equal(saisonKontext(undefined), "In dieser Saison noch nichts freigegeben.");
});

test("zu jedem Freigabestand steht ein Satz in Worten", () => {
  for (const s of ["nicht_vorgelegt", "vorgelegt", "freigegeben", "abgelehnt"]) {
    assert.ok(STAND_TEXT[s] && STAND_TEXT[s].length > 5, s);
  }
});

test("Datumsangaben bleiben deutsch und leer heisst leer", () => {
  assert.equal(datum(null), "");
  assert.match(datum("2026-09-17T10:00:00Z"), /^\d{2}\.\d{2}\.\d{4}$/);
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

test("eine Ablehnung ohne Begruendung wird nicht abgeschickt", () => {
  // Der Grund wird an den Schiedsrichter weitergegeben. Ohne ihn ist die
  // Ablehnung fuer ihn wertlos - deshalb ein Pflichtfeld in der Seite.
  const skript = lies("src/website/freigabe-seite.js");
  assert.match(skript, /entscheidung === "abgelehnt" && notiz\.length < 3/);
  assert.match(skript, /bekommt der Schiedsrichter zu lesen/);
});

test("waehrend des Speicherns sind beide Knoepfe gesperrt", () => {
  // Sonst schickt ein zweiter Klick die Gegenentscheidung, und die
  // waere dann die, die zaehlt.
  const skript = lies("src/website/freigabe-seite.js");
  assert.match(skript, /querySelectorAll\("button"\)\.forEach\(\(b\) => \{ b\.disabled = true; \}\)/);
});

test("die Migration schuetzt Tabellen und oeffnet nur Funktionen", () => {
  const m = lies("supabase/migrations/20260916120000_v145_ausruestung_preise_und_freigabe.sql");
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

/* ============================================================
   Die Liste zum Weitergeben
   ------------------------------------------------------------
   Das Blatt geht aus der Hand und kommt unterschrieben zurueck.
   Was darauf fehlt, fehlt endgueltig - deshalb wird der Aufbau
   hier geprueft und nicht nur einmal angesehen.
   ============================================================ */
const { baueDruckliste } = await import("../src/admin/freigabe-druck.js");

const BEISPIEL = [
  { person: "Anna B.", bezeichnung: "Trikot", farbe: "rot", groesse: "M",
    aermellaenge: "lang", preis_cent: 3500, freigabe_status: "nicht_vorgelegt" },
  { person: "Carl D.", bezeichnung: "Pfeife", preis_cent: null,
    freigabe_status: "vorgelegt", anmerkung: "die alte ist kaputt" },
  { person: "Erik F.", bezeichnung: "Hose", preis_cent: 2000,
    freigabe_status: "freigegeben" },
];

test("das Blatt zeigt nur, worueber noch nicht entschieden wurde", () => {
  const blatt = baueDruckliste(BEISPIEL, "FV Löbtauer Kickers", new Date("2026-09-17T09:00:00"));
  assert.match(blatt, /Anna B\./);
  assert.match(blatt, /Carl D\./);
  // Erledigtes gehoert nicht auf ein Blatt, das um Entscheidung bittet.
  assert.doesNotMatch(blatt, /Erik F\./);
});

test("die Summe auf dem Blatt nennt ihre Luecken", () => {
  const blatt = baueDruckliste(BEISPIEL, "FV Löbtauer Kickers");
  // 35,00 aus der einen Zeile mit Preis - die Pfeife hat keinen.
  assert.match(blatt, /35,00/);
  assert.match(blatt, /ohne 1 Zeile ohne Preis/);
  // Die preislose Zeile steht trotzdem drauf, mit Strich statt Zahl.
  assert.match(blatt, /<td class="dr-rechts">–<\/td>/);
});

test("auf Papier gibt es Kaestchen, Schreiblinien und eine Unterschrift", () => {
  const blatt = baueDruckliste(BEISPIEL, "FV Löbtauer Kickers");
  // Zwei Kaestchen je Zeile (ja/nein), also vier bei zwei Zeilen.
  assert.equal((blatt.match(/dr-kasten/g) || []).length, 4);
  assert.equal((blatt.match(/dr-linie/g) || []).length, 2);
  assert.match(blatt, /Unterschrift/);
  assert.match(blatt, /Name in Druckbuchstaben/);
  assert.match(blatt, /Datum/);
});

test("ohne offene Anfragen entsteht kein leeres Formular", () => {
  const blatt = baueDruckliste([{ person: "X", bezeichnung: "Hose", freigabe_status: "freigegeben" }], "Verein");
  assert.match(blatt, /keine Anfrage vor/);
  assert.doesNotMatch(blatt, /dr-kasten|Unterschrift/);
});

test("Eingaben aus der Datenbank landen nicht als HTML auf dem Blatt", () => {
  const blatt = baueDruckliste([{
    person: '<script>böse()</script>', bezeichnung: "Trikot",
    anmerkung: '"><b>fett', preis_cent: 100, freigabe_status: "vorgelegt",
  }], "Verein");
  assert.doesNotMatch(blatt, /<script>/);
  assert.doesNotMatch(blatt, /<b>fett/);
  assert.match(blatt, /&lt;script&gt;/);
});

test("das Druckblatt blendet den Obmann-Bereich vollstaendig aus", () => {
  const css = lies("stil/druckblatt.css");
  // Ausblenden statt einblenden: so kann kein Bedienelement des
  // Obmann-Bereichs versehentlich mit aufs Papier geraten.
  assert.match(css, /@media print/);
  assert.match(css, /\.admin-seite, \.admin-seite \* \{ visibility: hidden; \}/);
  assert.match(css, /\.druckblatt, \.druckblatt \* \{ visibility: visible; \}/);
  assert.match(css, /@page \{ size: A4/);
  // Am Bildschirm bleibt das Blatt unsichtbar.
  assert.match(css, /^\.druckblatt \{ display: none; \}/m);
});

test("jede obmann_-Funktion des Web-Editors ist auch fuer angemeldete Rollen freigegeben", () => {
  // Der Obmann-Bereich der Website laeuft ueber Supabase Auth, PostgREST
  // ruft von dort als "authenticated". Nur "anon" zu berechtigen sieht in
  // der Migration vollstaendig aus und scheitert erst im Browser mit
  // "permission denied" - genau so passiert am 17.09.2026.
  const editor = lies("src/admin/freigabe-editor.js");
  const gerufen = [...editor.matchAll(/rufe\("(obmann_[a-z_]+)"/g)].map((t) => t[1]);
  const ausSchloss = [...editor.matchAll(/client\.rpc\("(obmann_[a-z_]+)"/g)].map((t) => t[1]);
  const alle = [...new Set([...gerufen, ...ausSchloss])];
  assert.ok(alle.length >= 6, `nur ${alle.length} Funktionen gefunden - stimmt das Muster noch?`);

  // Die Rechte stehen ueber mehrere Migrationen verteilt: v147 hat die
  // erste Runde nachgezogen, v150 bringt die Aktionen des
  // Beschaffungsprozesses mit. Geprueft wird die Summe, nicht eine Datei.
  const rechte = [
    "supabase/migrations/20260917140000_v147_obmann_freigabe_auch_fuer_angemeldete.sql",
    "supabase/migrations/20260917190000_v150_ausruestung_aktionen_und_zeitleiste.sql",
  ].map(lies).join("\n");
  for (const funktion of alle) {
    // "to anon, authenticated" und "to authenticated" sind beide gueltig -
    // gesucht ist die Rolle, nicht eine bestimmte Schreibweise.
    assert.match(rechte, new RegExp(`grant execute on function public\\.${funktion}\\([^;]*\\bauthenticated\\b`),
      `${funktion} ist nicht fuer "authenticated" freigegeben - der Web-Editor bekommt permission denied`);
  }
});

test("die Seite des Vorstands bleibt bewusst bei anon", () => {
  // Dort ist niemand angemeldet - das ist der Sinn des Links. Eine
  // Freigabe an "authenticated" waere hier kein Fehler, aber ein Zeichen,
  // dass jemand die beiden Tueren verwechselt hat.
  const rechte = lies("supabase/migrations/20260917140000_v147_obmann_freigabe_auch_fuer_angemeldete.sql");
  for (const funktion of ["freigabe_dashboard", "freigabe_entscheiden", "freigabe_uebersicht"]) {
    assert.doesNotMatch(rechte, new RegExp(`${funktion}[^;]*to authenticated`), funktion);
  }
});
