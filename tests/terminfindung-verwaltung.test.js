// ============================================================
//  Terminsuche im Obmann-Zugang (29.08.2026, v97)
// ============================================================
//  Der offene Backlog-Punkt "Terminfindung fuer den Obmann" - v91 hatte
//  nur eine Teilnehmerseite. Diese Tests halten die Entscheidungen fest,
//  die man beim Weiterbauen am leichtesten versehentlich kippt:
//
//    * die drei Terminfindungs-Tabellen bleiben hinter geprueften
//      SECURITY-DEFINER-Funktionen, jede mit Vereins- UND Statuspruefung;
//    * obmann_terminfindung_stand gibt Namen heraus, aber niemals PINs;
//    * das Obmann-Passwort liegt nur im Arbeitsspeicher;
//    * die Empfehlung ist eine Empfehlung und entscheidet nicht selbst.
// ============================================================

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { erstellePasswortSchloss } from "../src/admin/obmann-passwort.js";
import {
  csvAusStand,
  csvDateiname,
  csvFeld,
  datumZahlen,
  empfehlung,
  erinnerungsText,
  offeneNamen,
  vorschlagLabel,
} from "../src/admin/terminfindung-daten.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

/* Kommentare wegwerfen, bevor auf Verbotenes geprueft wird. Sonst trifft
   jede "darf nicht vorkommen"-Pruefung den Erklaertext, der genau
   begruendet, warum es das hier nicht gibt. */
const sqlOhneKommentare = (sql) => sql.replace(/--[^\n]*/g, "");

const jsOhneKommentare = (quelltext) =>
  quelltext
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((zeile) => {
      let inZeichenkette = null;
      for (let i = 0; i < zeile.length; i += 1) {
        const z = zeile[i];
        if (inZeichenkette) {
          if (z === "\\") i += 1;
          else if (z === inZeichenkette) inZeichenkette = null;
        } else if (z === '"' || z === "'" || z === "`") {
          inZeichenkette = z;
        } else if (z === "/" && zeile[i + 1] === "/") {
          return zeile.slice(0, i);
        }
      }
      return zeile;
    })
    .join("\n");

const V97 = "supabase/migrations/20260829220000_v97_terminfindung_verwaltung.sql";
const v97 = sqlOhneKommentare(lies(V97));

/* Genau EINEN Funktionsrumpf herausschneiden - dieselbe Vorsichtsmassnahme
   wie in api-sicherheit.test.js. Eine Pruefung ueber die ganze Datei
   bliebe gruen, sobald irgendeine andere Funktion dieselbe Zeile enthaelt,
   und bewachte damit nichts mehr. */
function rumpf(sql, name) {
  const anfang = sql.indexOf(`create function public.${name}(`);
  assert.ok(anfang >= 0, `${name} wird in v97 nicht angelegt`);
  const ende = sql.indexOf("$function$;", anfang);
  assert.ok(ende > anfang, `Ende von ${name} nicht gefunden`);
  return sql.slice(anfang, ende);
}

const NEUE_FUNKTIONEN = [
  "obmann_terminfindung_bearbeiten",
  "obmann_terminfindung_vorschlag_ergaenzen",
  "obmann_terminfindung_vorschlag_entfernen",
  "obmann_terminfindung_stand",
];

// ============================================================
//  1. Datenbank
// ============================================================

test("die Migration v97 liegt im Repository", () => {
  assert.equal(existsSync(new URL("../" + V97, import.meta.url)), true, V97 + " fehlt");
});

test("jede neue Funktion prüft Passwort, Verein und Status", () => {
  for (const name of ["obmann_terminfindung_bearbeiten", "obmann_terminfindung_vorschlag_ergaenzen"]) {
    const koerper = rumpf(v97, name);
    assert.match(koerper, /obmann_verein\(p_passwort\)/, name + " prüft das Passwort nicht");
    // Ohne die Vereinspruefung koennte ein Obmann in der Terminsuche
    // eines fremden Vereins schreiben.
    assert.match(koerper, /f\.verein_id = v_verein/, name + " prüft den Verein nicht");
    assert.match(koerper, /v_status <> 'offen'/, name + " schreibt auch in abgeschlossene Suchen");
  }

  const entfernen = rumpf(v97, "obmann_terminfindung_vorschlag_entfernen");
  assert.match(entfernen, /obmann_verein\(p_passwort\)/);
  assert.match(entfernen, /f\.verein_id = v_verein/);
  assert.match(entfernen, /v_status <> 'offen'/);
});

test("die Untergrenze zwei und die Obergrenze acht gelten auch beim Nachpflegen", () => {
  // Dieselben Grenzen wie beim Anlegen in v91. Ohne sie liesse sich eine
  // laufende Abstimmung auf einen einzigen Vorschlag zusammenstreichen.
  assert.match(rumpf(v97, "obmann_terminfindung_vorschlag_ergaenzen"), /if v_anzahl >= 8 then/);
  assert.match(rumpf(v97, "obmann_terminfindung_vorschlag_entfernen"), /if v_anzahl <= 2 then/);
});

test("Bearbeiten unterscheidet „nicht angefasst“ von „geleert“", () => {
  const koerper = rumpf(v97, "obmann_terminfindung_bearbeiten");
  // null laesst stehen - sonst wuerde eine aeltere App-Version, die ein
  // Feld gar nicht kennt, es beim Speichern still loeschen.
  assert.match(koerper, /when p_beschreibung is null then beschreibung/);
  assert.match(koerper, /when trim\(p_beschreibung\) = '' then null/);
  assert.match(koerper, /coalesce\(trim\(p_titel\), titel\)/);
  // Ein Datum hat keinen leeren Text, deshalb der eigene Schalter.
  assert.match(koerper, /when coalesce\(p_frist_entfernen, false\) then null/);
});

test("der Personenstand gibt Namen heraus, aber keine PINs", () => {
  const koerper = rumpf(v97, "obmann_terminfindung_stand");
  assert.match(koerper, /from schiedsrichter s/);
  assert.match(koerper, /s\.aktiv/);
  assert.match(koerper, /not s\.ist_test/);
  // Die Funktion laeuft als security definer und koennte jede Spalte der
  // Tabelle herausgeben. Sie darf es nicht.
  assert.doesNotMatch(koerper, /s\.pin/, "der Stand gibt PINs heraus");
  assert.doesNotMatch(koerper, /s\.geburtsdatum/);
  assert.doesNotMatch(koerper, /s\.bemerkungen/);
});

test("neue Funktionen werden erst gelöscht und dann angelegt", () => {
  // create or replace kann eine geaenderte Signatur nicht ersetzen; die
  // alte Fassung bliebe stehen, PostgREST faende zwei Kandidaten und
  // meldete PGRST202.
  assert.doesNotMatch(v97, /create or replace function/);
  for (const name of NEUE_FUNKTIONEN) {
    assert.match(v97, new RegExp(`drop function if exists public\\.${name}\\(`));
  }
});

test("jede neue Funktion verliert die Standardrechte und wird einzeln freigegeben", () => {
  for (const name of NEUE_FUNKTIONEN) {
    assert.match(v97, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public;`),
      name + " behält Rechte für public");
    assert.match(v97, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to anon, authenticated;`),
      name + " ist nicht freigegeben");
  }
  // Kein direkter Tabellenzugriff an den Funktionen vorbei.
  assert.doesNotMatch(v97, /grant\s+(?:select|insert|update|delete)[^;]*on table/i);
  assert.doesNotMatch(v97, /create policy/i);
});

// ============================================================
//  2. Auswertung
// ============================================================

const vorschlag = (id, datum, ja, vielleicht, nein) => ({ id, datum, ja, vielleicht, nein });

test("die Empfehlung nimmt zuerst die meisten festen Zusagen", () => {
  const gewinner = empfehlung([
    vorschlag("a", "2026-10-10", 2, 4, 0),
    vorschlag("b", "2026-10-03", 3, 0, 1),
  ]);
  assert.equal(gewinner.id, "b");
});

test("bei gleich vielen Zusagen entscheidet „vielleicht“, dann das frühere Datum", () => {
  assert.equal(empfehlung([
    vorschlag("a", "2026-10-10", 2, 3, 0),
    vorschlag("b", "2026-10-03", 2, 0, 0),
  ]).id, "a");

  assert.equal(empfehlung([
    vorschlag("spaet", "2026-10-24", 2, 1, 0),
    vorschlag("frueh", "2026-10-03", 2, 1, 0),
  ]).id, "frueh");
});

test("ohne eine einzige mögliche Stimme gibt es keine Empfehlung", () => {
  // Sonst stuende bei einer Terminsuche, an der niemand kann, trotzdem
  // ein Vorschlag als "Empfehlung" da.
  assert.equal(empfehlung([vorschlag("a", "2026-10-10", 0, 0, 4)]), null);
  assert.equal(empfehlung([]), null);
});

test("offen ist, wer zu keinem einzigen Vorschlag geantwortet hat", () => {
  const stand = [
    { name: "Anna", hat_geantwortet: true },
    { name: "Ben", hat_geantwortet: false },
    { name: "Chris", hat_geantwortet: false },
  ];
  assert.deepEqual(offeneNamen(stand), ["Ben", "Chris"]);
});

test("der Erinnerungstext nennt die offenen Namen und die Frist", () => {
  const text = erinnerungsText({
    findung: { titel: "Saison-Einstiegsfeier", antwort_bis: "2026-09-20" },
    offene: ["Ben", "Chris"],
  });
  assert.match(text, /Saison-Einstiegsfeier/);
  assert.match(text, /Ben, Chris/);
  assert.match(text, /20\.09\.2026/);
});

test("Datum und Vorschlagsbeschriftung sind deutsch und ohne Sekunden", () => {
  assert.equal(datumZahlen("2026-10-03"), "03.10.2026");
  assert.equal(vorschlagLabel({ datum: "2026-10-10", beginn_zeit: "18:00:00" }), "10.10.2026 18:00");
  assert.equal(vorschlagLabel({ datum: "2026-10-10", beginn_zeit: null }), "10.10.2026");
});

test("der CSV-Export hat eine Zeile je Person und eine Spalte je Vorschlag", () => {
  const vorschlaege = [
    { id: "v1", datum: "2026-10-03", beginn_zeit: null },
    { id: "v2", datum: "2026-10-10", beginn_zeit: "18:00:00" },
  ];
  const stand = [
    { name: "Anna", hat_geantwortet: true, antworten: { v1: "ja", v2: "nein" } },
    { name: "Ben; Meier", hat_geantwortet: false, antworten: {} },
  ];
  const csv = csvAusStand({ vorschlaege, stand });
  const zeilen = csv.split("\r\n");

  // BOM und Semikolon, sonst legt Excel im deutschen Gebietsschema alles
  // in eine einzige Spalte.
  assert.equal(zeilen[0], "﻿Name;03.10.2026;10.10.2026 18:00");
  assert.equal(zeilen[1], "Anna;Ja;Nein");
  // Wer nichts gesagt hat, taucht trotzdem auf - das ist der Punkt.
  assert.equal(zeilen[2], '"Ben; Meier";keine Antwort;keine Antwort');
  assert.equal(zeilen.length, 3);
});

test("Semikolon und Anführungszeichen zerlegen die CSV-Datei nicht", () => {
  assert.equal(csvFeld("harmlos"), "harmlos");
  assert.equal(csvFeld('mit "Zitat"'), '"mit ""Zitat"""');
  assert.equal(csvFeld("a;b"), '"a;b"');
  assert.equal(csvFeld(null), "");
});

test("der Dateiname bleibt ohne Umlaute und Sonderzeichen", () => {
  assert.equal(csvDateiname({ titel: "Saison-Einstiegsfeier Grünau" }),
    "terminsuche-saison-einstiegsfeier-gruenau.csv");
  assert.equal(csvDateiname({}), "terminsuche-terminsuche.csv");
});

// ============================================================
//  3. Das zweite Schloss
// ============================================================

test("ein falsches Passwort hinterlässt keinen Zustand", async () => {
  const schloss = erstellePasswortSchloss({
    pruefe: async (kandidat) => {
      if (kandidat !== "richtig") throw new Error("Das Obmann-Passwort stimmt nicht.");
    },
  });

  assert.equal(schloss.istOffen(), false);
  await assert.rejects(() => schloss.oeffnen("falsch"), /stimmt nicht/);
  assert.equal(schloss.istOffen(), false);
  assert.equal(schloss.wert(), null);

  await schloss.oeffnen("richtig");
  assert.equal(schloss.istOffen(), true);
  assert.equal(schloss.wert(), "richtig");

  schloss.schliessen();
  assert.equal(schloss.wert(), null);
  await assert.rejects(() => schloss.oeffnen(""), /Obmann-Passwort/);
});

test("das Obmann-Passwort verlässt den Arbeitsspeicher nicht", () => {
  // localStorage ueberlebt das Schliessen des Browsers, sessionStorage
  // jedes Neuladen. Beides waere fuer ein Passwort, das privilegierte
  // Datenbankfunktionen oeffnet, der falsche Ort.
  for (const pfad of [
    "src/admin/obmann-passwort.js",
    "src/admin/terminfindung-editor.js",
    "src/admin/terminfindung-daten.js",
  ]) {
    const quelle = jsOhneKommentare(lies(pfad));
    assert.doesNotMatch(quelle, /localStorage/, pfad + " legt etwas in localStorage ab");
    assert.doesNotMatch(quelle, /sessionStorage/, pfad + " legt etwas in sessionStorage ab");
    assert.doesNotMatch(quelle, /document\.cookie/, pfad + " schreibt ein Cookie");
  }
});

// ============================================================
//  4. Oberfläche
// ============================================================

test("der Obmann-Zugang hat einen fünften Bereich für die Terminsuche", () => {
  const html = lies("obmann.html");
  assert.match(html, /data-bereich-knopf="terminsuche"/);
  assert.match(html, /data-admin-bereich="terminsuche"/);

  const seite = lies("src/admin/obmann-page.js");
  assert.match(seite, /erstelleTerminfindungEditor/);
});

test("Rechnen und Oberfläche bleiben getrennt", () => {
  // Hausregel: nach Funktion getrennte Module. Die Auswertung muss ohne
  // Browser testbar bleiben, sonst wandert sie in den Editor zurueck.
  const daten = jsOhneKommentare(lies("src/admin/terminfindung-daten.js"));
  assert.doesNotMatch(daten, /document\./, "terminfindung-daten.js fasst das DOM an");
  assert.doesNotMatch(daten, /window\./);

  const editor = jsOhneKommentare(lies("src/admin/terminfindung-editor.js"));
  assert.doesNotMatch(editor, /\.rpc\(\s*["']obmann_terminfindung_(?:anlegen|entscheiden|abbrechen|stand)/,
    "der Editor ruft an der Datenschicht vorbei");
});

test("die Empfehlung entscheidet nicht selbst", () => {
  // Sie faerbt eine Zeile ein und schlaegt im Auswahlfeld etwas vor -
  // festgelegt wird der Termin erst nach einer ausdruecklichen Rückfrage.
  const editor = lies("src/admin/terminfindung-editor.js");
  const anfang = editor.indexOf("function entscheidung(");
  const ende = editor.indexOf("\n  function karte(", anfang);
  assert.ok(anfang >= 0 && ende > anfang, "entscheidung() nicht gefunden");
  const block = editor.slice(anfang, ende);
  assert.match(block, /window\.confirm\(/, "der Termin wird ohne Rückfrage festgelegt");
  assert.match(block, /zugriff\.entscheiden\(/);
});
