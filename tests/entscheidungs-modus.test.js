import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/* ============================================================
   Der Entscheidungs-Modus (29.08.2026, Migrationen v93 bis v96)
   ============================================================
   Die wichtigste Eigenschaft dieses Modus laesst sich nicht ansehen:
   dass die richtige Antwort NICHT mit dem Bild im Browser landet. Genau
   dafuer sind diese Tests da - fuer das, was man beim Draufschauen nicht
   bemerkt.

   Zwei Lehren vom selben Tag stecken in der Bauart dieser Datei:

   1. Wer etwas VERBIETEN will, muss vorher die Kommentare entfernen.
      Sonst trifft die Suche die Erklaerung, warum die Sache fehlt, und
      der Test ist gruen, obwohl er nichts geprueft hat.

   2. Zusicherungen gehoeren auf EINEN Funktionsrumpf, nicht auf die
      ganze Datei. Ein "die Datei enthaelt X" ist gruen, solange
      irgendeine der zehn Funktionen X enthaelt - auch wenn genau die
      eine, auf die es ankommt, es verloren hat. Am 29.08.2026 haette
      eine solche Luecke beinahe interne Termine oeffentlich gemacht.
   ============================================================ */

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

const MIGRATIONEN = new URL("../supabase/migrations/", import.meta.url);
const migration = (teil) => {
  const datei = readdirSync(MIGRATIONEN).find((n) => n.includes(teil));
  assert.ok(datei, `Migration mit "${teil}" im Namen fehlt`);
  return readFileSync(new URL(datei, MIGRATIONEN), "utf8");
};

/** Entfernt SQL-Kommentare (-- bis Zeilenende). */
const sqlOhneKommentare = (sql) => sql.replace(/--[^\n]*/g, "");

/** Entfernt JS-Kommentare (// und Blockkommentare). */
const jsOhneKommentare = (js) =>
  js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/**
 * Schneidet den Rumpf EINER Tabelle heraus - von "create table" bis zur
 * schliessenden Klammer.
 *
 * Noetig, weil sqlOhneKommentare nur "--"-Kommentare entfernt, nicht die
 * COMMENT-ON-Texte: die sind SQL-Strings und stehen direkt hinter der
 * Tabelle. Der erste Entwurf dieses Tests ist genau darueber gestolpert -
 * er fand das Wort "richtige" in dem Satz, der erklaert, dass die
 * richtige Antwort hier NICHT steht. Dieselbe Falle wie am 29.08.2026
 * schon einmal, nur in anderer Verkleidung.
 */
function tabellenRumpf(sql, name) {
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  assert.ok(start >= 0, `Tabelle ${name} nicht gefunden`);
  const ende = sql.indexOf("\n);", start);
  assert.ok(ende > start, `Ende von ${name} nicht gefunden`);
  return sql.slice(start, ende);
}

/**
 * Schneidet den Rumpf EINER Funktion heraus - von ihrem Namen bis zum
 * abschliessenden $function$;. Damit trifft eine Zusicherung genau die
 * Funktion, um die es geht, und nicht irgendeine andere in derselben
 * Datei.
 */
function funktionsRumpf(sql, name) {
  const start = sql.indexOf(`function public.${name}(`, sql.indexOf("create function") >= 0 ? 0 : 0);
  const echterStart = sql.indexOf(`create function public.${name}(`) >= 0
    ? sql.indexOf(`create function public.${name}(`)
    : sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(echterStart >= 0 && start >= 0, `Funktion ${name} nicht gefunden`);
  const ende = sql.indexOf("$function$;", echterStart);
  assert.ok(ende > echterStart, `Ende von ${name} nicht gefunden`);
  return sql.slice(echterStart, ende);
}

// ============================================================
//  1. Die richtige Antwort verlaesst den Server nicht zu frueh
// ============================================================

test("die Loesung liegt in einer eigenen Tabelle", () => {
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));

  assert.match(v93, /create table if not exists public\.szenario_loesungen/);

  // Die Spalten, die die Antwort ausmachen, duerfen NICHT am Szenario
  // haengen - sonst reicht ein "select *", und der Modus ist wertlos.
  const szenarioTabelle = tabellenRumpf(v93, "entscheidungs_szenarien");
  for (const spalte of ["spielfortsetzung", "persoenliche_strafe", "erklaerung"]) {
    assert.doesNotMatch(szenarioTabelle, new RegExp(`\\b${spalte}\\b`),
      `${spalte} steht am Szenario - die Loesung gehoert in szenario_loesungen`);
  }
});

test("die Zusatzfragen tragen ihre Loesung ebenfalls nicht bei sich", () => {
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));
  const zusatz = tabellenRumpf(v93, "szenario_zusatzfragen");
  assert.doesNotMatch(zusatz, /richtig/,
    "die richtigen Schluessel gehoeren in szenario_loesungen.zusatz_antworten");
  assert.match(v93, /zusatz_antworten\s+jsonb/);
});

test("szenario_naechstes gibt keine Loesungsspalte zurueck", () => {
  const v94 = sqlOhneKommentare(migration("v94_szenario_spielerseite"));
  const rumpf = funktionsRumpf(v94, "szenario_naechstes");

  for (const spalte of ["spielfortsetzung", "persoenliche_strafe", "erklaerung", "fortsetzung_fuer"]) {
    assert.doesNotMatch(rumpf, new RegExp(`\\b${spalte}\\b`),
      `szenario_naechstes liefert ${spalte} mit - damit stuende die Antwort im Browser`);
  }
  // Gegenprobe: der Rumpf ist ueberhaupt der richtige.
  assert.match(rumpf, /from entscheidungs_szenarien/);
  assert.doesNotMatch(rumpf, /szenario_loesungen/);
});

test("die Auswertung passiert im Server, nicht im Browser", () => {
  const seite = jsOhneKommentare(lies("src/website/entscheiden-seite.js"));
  const zugriff = jsOhneKommentare(lies("src/website/szenario-zugriff.js"));

  // Kein Vergleich der Wahl mit einer Loesung im Browser.
  assert.doesNotMatch(seite, /loesung\s*(===|==)/);
  assert.doesNotMatch(zugriff, /szenario_loesungen/);
  assert.match(zugriff, /szenario_antwort_pruefen/);
});

// ============================================================
//  2. Die Freigabesperre fuer Bilder
// ============================================================

test("ein Szenario kann ohne geprueftes Bild nicht aktiv werden", () => {
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));
  assert.match(v93, /constraint szenario_aktiv_nur_geprueft/);
  assert.match(v93,
    /check \(not aktiv or \(bild_base64 is not null and bild_geprueft_am is not null\)\)/);
});

test("ein neues Bild setzt Freigabe und Aktivschaltung zurueck", () => {
  const v95 = sqlOhneKommentare(migration("v95_szenario_verwaltung_app"));
  const rumpf = funktionsRumpf(v95, "obmann_szenario_bild_setzen");

  // Beides, in beiden Zweigen (Bild setzen und Bild entfernen).
  const treffer = rumpf.match(/bild_geprueft_am = null/g) || [];
  assert.equal(treffer.length, 2,
    "bild_geprueft_am wird nicht in beiden Zweigen geleert");
  assert.equal((rumpf.match(/aktiv = false/g) || []).length, 2,
    "das Szenario bleibt nach einem Bildwechsel aktiv - die Sperre waere ein Hinweis statt einer Sperre");
});

// ============================================================
//  3. Die beiden Achsen stimmen mit der Datenbank ueberein
// ============================================================

test("neun Spielfortsetzungen, vier Strafen - und dieselben Schluessel wie in der Datenbank", async () => {
  const modul = await import("../src/website/entscheidungs-optionen.js");
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));

  assert.equal(modul.FORTSETZUNGEN.length, 9);
  assert.equal(modul.STRAFEN.length, 4);

  for (const f of modul.FORTSETZUNGEN) {
    assert.match(v93, new RegExp(`'${f.schluessel}'`),
      `Spielfortsetzung "${f.schluessel}" kennt die Datenbank nicht`);
  }
  for (const s of modul.STRAFEN) {
    assert.match(v93, new RegExp(`'${s.schluessel}'`),
      `Strafe "${s.schluessel}" kennt die Datenbank nicht`);
  }

  // Die Zeitstrafe ist am 29.08.2026 gestrichen worden. Max: "Das gibt
  // es im Profifussball nicht."
  assert.ok(!modul.STRAFEN.some((s) => s.schluessel.includes("zeit")),
    "die Zeitstrafe ist zurueck - sie wurde bewusst gestrichen");
});

test("jedes Icon hat ein Textlabel", async () => {
  // Hausregel seit dem 10.07.2026: ein Icon allein ist eine Vermutung.
  const modul = await import("../src/website/entscheidungs-optionen.js");
  for (const f of modul.FORTSETZUNGEN) {
    assert.ok(f.icon.startsWith("<svg"), `${f.schluessel} hat kein Icon`);
    assert.ok(f.label && f.label.length > 2, `${f.schluessel} hat kein Textlabel`);
  }
  const seite = lies("src/website/entscheiden-seite.js");
  assert.match(seite, /\$\{f\.icon\}<span>\$\{f\.label\}<\/span>/,
    "das Textlabel steht nicht mehr neben dem Icon");
});

test("nur Weiterspielen und Schiedsrichter-Ball kommen ohne Richtung aus", async () => {
  const modul = await import("../src/website/entscheidungs-optionen.js");
  assert.deepEqual([...modul.OHNE_RICHTUNG].sort(), ["sr_ball", "weiterspielen"]);

  // Dieselbe Regel steht als CHECK in der Datenbank. Zwei Orte, weil die
  // Datenbank sich nicht auf den Browser verlassen darf und umgekehrt -
  // aber sie muessen dasselbe sagen.
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));
  assert.match(v93, /spielfortsetzung in \('weiterspielen', 'sr_ball'\)/);
});

// ============================================================
//  4. Die Seiten selbst
// ============================================================

test("die beiden neuen Seiten laden ihre eigenen Bausteine", () => {
  const modus = lies("modus.html");
  const entscheiden = lies("entscheiden.html");

  assert.match(modus, /src\/website\/modus-seite\.js/);
  assert.match(modus, /stil\/modus\.css/);
  assert.match(entscheiden, /src\/website\/entscheiden-seite\.js/);
  assert.match(entscheiden, /stil\/entscheiden\.css/);

  // Beide brauchen die seitenweite Anmeldung aus seite.js.
  for (const seite of [modus, entscheiden]) {
    assert.match(seite, /src\/core\/anmeldung\.js/);
    assert.match(seite, /src\/ui\/login-dialog\.js/);
  }

  // Nicht in Suchmaschinen: der Modus ist ein Innenbereich.
  assert.match(modus, /name="robots" content="noindex"/);
  assert.match(entscheiden, /name="robots" content="noindex"/);
});

test("der Modus liegt hinter der Anmeldung, ohne Gastweg", () => {
  const v94 = sqlOhneKommentare(migration("v94_szenario_spielerseite"));

  // Alle drei Spieler-RPCs pruefen die PIN.
  for (const name of ["szenario_naechstes", "szenario_antwort_pruefen", "szenario_statistik"]) {
    assert.match(funktionsRumpf(v94, name), /raise exception 'PIN falsch'/,
      `${name} prueft die PIN nicht`);
  }

  // Und es gibt bewusst keinen Gast-Zwilling wie beim Quiz.
  assert.doesNotMatch(v94, /szenario_gast/);
});

test("die Tabellen des Modus haben RLS an und keine Policy", () => {
  const v93 = sqlOhneKommentare(migration("v93_entscheidungs_szenarien"));
  for (const tabelle of ["entscheidungs_szenarien", "szenario_loesungen",
                         "szenario_zusatzfragen", "szenario_antworten"]) {
    assert.match(v93, new RegExp(`alter table public\\.${tabelle}\\s+enable row level security`),
      `${tabelle} hat keine RLS`);
  }
  assert.doesNotMatch(v93, /create policy/,
    "eine Policy waere ein Zugang an den RPCs vorbei");
});

// ============================================================
//  5. Die Serie zaehlt an genau einer Stelle
// ============================================================

test("die Serie steht in einer Funktion, nicht doppelt in zwei RPCs", () => {
  const v96 = sqlOhneKommentare(migration("v96_szenario_serie_deterministisch"));

  assert.match(v96, /create or replace function public\.szenario_serie\(/);
  // Beide Aufrufer benutzen sie.
  assert.match(funktionsRumpf(v96, "szenario_antwort_pruefen"), /public\.szenario_serie\(/);
  assert.match(funktionsRumpf(v96, "szenario_statistik"), /public\.szenario_serie\(/);

  // Und sortiert wird nach lfd, nicht nach der Uhr: beantwortet_am kann
  // bei zwei Antworten in derselben Transaktion gleich sein, dann ist die
  // Reihenfolge beliebig und die Serie zaehlt falsch (gefunden am
  // 29.08.2026 durch Pruefung 10 der Testreihe).
  const serie = v96.slice(v96.indexOf("function public.szenario_serie("));
  const rumpf = serie.slice(0, serie.indexOf("$function$;"));
  assert.match(rumpf, /order by a\.lfd desc/);
  assert.doesNotMatch(rumpf, /order by a\.beantwortet_am/);
});
