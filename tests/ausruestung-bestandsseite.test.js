import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ============================================================
//  Die Bestandsseite als Kleiderschrank (08.09.2026)
// ============================================================
//  Max: "Man sieht ja eigentlich nur seinen Bestand ... so wie ein
//  Kleiderschrank ... Dass man da diesen Eintrag, den man da hinzufuegen
//  kann, erst mit einem Plus anlegen muss." Und zum Kontomenue: "Wenn man
//  auf diesen Konto-Button klickt, wird da nicht so viel aufgelistet."
//
//  Diese Zusagen haelt die Datei hier fest. Statische Quelltextpruefungen
//  wie im Rest des Projekts: es gibt keinen Browser im Test, aber genau
//  diese Kennungen und Woerter sind das, was die Umgestaltung ausmacht.
// ============================================================

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const ohneJsKommentare = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const html = lies("ausruestung.html");
const seite = lies("src/website/ausruestung-seite.js");
const stil = lies("stil/ausruestung.css");
const seiteJs = lies("seite.js");

test("beim Oeffnen steht nur der Bestand da - das Formular kommt auf Wunsch", () => {
  assert.match(html, /<form id="bestand-formular"[^>]*hidden/,
    "Das Formular muss im Ausgangszustand verborgen sein.");
  assert.match(html, /id="bestand-hinzufuegen"/,
    "Ohne Hinzufuegen-Knopf kaeme man nie an das verborgene Formular.");
  assert.ok(html.includes("Eintrag hinzufügen"),
    "Hausregel: Woerter statt blosser Symbole - das Plus braucht sein Wort.");
  assert.match(seite, /zeigeFormular\(/,
    "Das Formular wird beim Hinzufuegen und beim Antippen eines Stuecks eingeblendet.");
  // Inline, kein Pop-up: das Formular steht in der Seite und wird nicht
  // als Fenster darueber gelegt.
  assert.doesNotMatch(seite, /overlay/i,
    "Das Bestandsformular soll inline erscheinen, nicht als Pop-up.");
});

test("der Bestand ist wie ein Kleiderschrank nach Kategorien geordnet", () => {
  for (const schluessel of ["trikot", "hose", "stutzen", "schuhe", "sonstiges"]) {
    assert.match(seite, new RegExp('schluessel: "' + schluessel + '"'),
      "Kategorie fehlt im Schrank: " + schluessel);
  }
  for (const wort of ["Trikots", "Hosen", "Stutzen", "Schuhe", "Sonstiges"]) {
    assert.ok(seite.includes(wort), "Das Wort zur Gruppe fehlt: " + wort);
  }
  assert.match(seite, /bestand-gruppe-symbol/,
    "Jede Gruppe traegt ein Symbol - aber immer neben dem Wort.");
  assert.match(seite, /Stück/, "Die Stueckzahl der Gruppe fehlt.");
  // Der Zustand muss auf einen Blick lesbar sein.
  for (const zustand of ["einsatzbereit", "ersatz", "verschlissen", "fehlt"]) {
    assert.match(stil, new RegExp("zustand-" + zustand),
      "Der Zustand " + zustand + " hebt sich nicht ab.");
  }
});

test("ein leerer Schrank laedt zum Eintragen ein statt leer zu bleiben", () => {
  assert.match(seite, /function leerHtml\(/);
  assert.match(seite, /id="bestand-leer-hinzufuegen"/,
    "Im leeren Zustand fehlt der Plus-Knopf.");
  assert.match(stil, /\.bestand-leer\b/, "Der leere Zustand hat keine Gestaltung.");
});

test("die Ausruestungsanfragen stehen auf derselben Seite", () => {
  assert.ok(html.includes("Meine Ausrüstungsanfragen"));
  assert.match(html, /id="bestand-anfragen"/);
  assert.match(html, /id="bestand-anfrage-stellen"/);
  assert.ok(html.includes("Ausrüstung anfragen"),
    "Der Knopf zum Anfragen fehlt auf der Bestandsseite.");
  assert.match(seite, /schiri_anfragen_liste/,
    "Die Anfragen werden nicht wirklich geladen.");
});

test("die Anfrage-Maske wird benutzt und nicht nachgebaut", () => {
  assert.match(seite, /oeffneAusruestungsAnfrage\(\)/,
    "Die Bestandsseite muss die vorhandene Maske aufrufen.");
  assert.match(seite, /SchiriSeitenProfil/,
    "Der Weg zur vorhandenen Maske fuehrt ueber seite.js.");
  assert.match(ohneJsKommentare(seiteJs), /SchiriSeitenProfil = Object\.freeze/,
    "seite.js stellt das Profil-Modul nicht bereit.");
  assert.doesNotMatch(seite, /schiri_anfrage_erstellen|schiri_anfrage_rechnung_hochladen/,
    "Das Anfrage-Formular samt Rechnungs-Upload darf nicht nachgebaut werden.");
});

test("die Seite hat eine eigene Gestaltung und borgt sich nichts mehr", () => {
  assert.match(html, /href="stil\/ausruestung\.css"/);
  assert.doesNotMatch(html, /href="stil\/frage-vorschlagen\.css"/,
    "Die Bestandsseite leiht sich wieder die Klassen der Vorschlagsseite.");
  assert.doesNotMatch(html, /vorschlag-/,
    "Es stehen wieder Klassen der Vorschlagsseite im Markup.");
  assert.match(html, /href="stil\/profil\.css"/,
    "Ohne profil.css saehen die Anfrage-Fenster nackt aus.");
  // Farben nur aus den Tokens von stil/basis.css. Weiss auf dunklem Grund
  // ist die einzige Ausnahme - so haelt es auch stil/melden.css.
  const hexwerte = [...stil.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((t) => t[0]);
  assert.deepEqual([...new Set(hexwerte)].filter((h) => h !== "#fff"), [],
    "stil/ausruestung.css erfindet eigene Farben statt der Tokens aus basis.css");
  assert.match(stil, /min-height: 44px/,
    "Die Trefferflaechen von 44 px fehlen.");
});

test("der Loeschweg mit zweistufiger Rueckfrage bleibt erhalten", () => {
  assert.match(html, /id="bestand-loeschen"[^>]*hidden/);
  assert.doesNotMatch(seite, /\b(confirm|alert|prompt)\s*\(/,
    "Hausregel: keine Browserdialoge - der Knopf fragt selbst nach.");
  assert.match(seite, /dataset\.sicher !== "ja"/);
});

test("das Kontomenue listet nur noch zwei persoenliche Punkte", () => {
  const ohne = ohneJsKommentare(seiteJs);
  const punkte = [...ohne.matchAll(/\{ text: "([^"]+)"/g)].map((t) => t[1]);
  assert.deepEqual(punkte, ["Mein Ausrüstungsbestand", "Meine Anliegen"],
    "Max: \"Wenn man auf diesen Konto-Button klickt, wird da nicht so viel aufgelistet.\"");
  assert.match(ohne, /punkt: true/,
    "Der blaue Neuigkeiten-Punkt ist verschwunden.");
  assert.match(ohne, /window\.location\.href = "meine-anliegen\.html"/,
    '"Meine Anliegen" oeffnet die eigene Seite statt eines kleinen Pop-ups.');
});

test('"Zum Quiz" wird im Kontomenue nicht doppelt angeboten', () => {
  const konto = ohneJsKommentare(lies("src/ui/konto-bereich.js"));
  assert.doesNotMatch(konto, /href="modus\.html"/,
    "Der Quiz-Knopf steht bereits direkt neben dem Kontoknopf.");
});
