import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const regeln = lies("regeluebersicht.html");
const regelCss = lies("stil/regeln.css");
const melden = lies("src/website/melden-seite.js");
const modus = lies("src/website/modus-seite.js");
const migration = lies("supabase/migrations/20260910001000_v132_treff_themenvorschlaege.sql");
const detailsMigration = lies("supabase/migrations/20260910003500_v133_treff_details_beschriften.sql");

test("Regelkarten zeigen die fuenf wichtigsten Angaben immer in derselben Reihenfolge", () => {
  const anfang = regeln.indexOf("function kernwerteFuer");
  const ende = regeln.indexOf("function kernwertHtml");
  assert.ok(anfang >= 0 && ende > anfang, "die Kerndaten werden nicht zentral aufgebaut");
  const block = regeln.slice(anfang, ende);
  const positionen = ["zeit", "feld", "spieler", "wechsel", "wieder"].map((typ) =>
    block.indexOf('typ: "' + typ + '"')
  );
  positionen.forEach((position, index) =>
    assert.ok(position >= 0, "Kerndatum " + (index + 1) + " fehlt"));
  assert.deepEqual([...positionen].sort((a, b) => a - b), positionen,
    "die Kerndaten stehen nicht in der vereinbarten Reihenfolge");
});

test("Feldtyp ist die Hauptinfo und Masse sind nur die Randinfo", () => {
  assert.match(regeln, /haupt: "Großfeld", rand: wert/);
  assert.match(regeln, /haupt: "verkleinertes Großfeld", rand: wert/);
  assert.match(regeln, /haupt: "Kleinfeld", rand: wert/);
  assert.match(regelCss, /\.rk-kerntext small\s*\{[^}]*color: var\(--muted\)/s);
});

test("Wiedereinwechslung wird nur als gruener Haken oder rotes X dargestellt", () => {
  assert.match(regeln, /eintrag\.jaNein \? "✓" : "×"/);
  assert.match(regeln, /const symbol = IKONEN\[eintrag\.typ\]/);
  assert.doesNotMatch(regeln, /wieder:\s*'<svg/,
    "Wiedereinwechslung hat neben Haken oder X noch ein zweites Symbol");
  assert.match(regelCss, /\.rk-ja-nein\.ja\s*\{[^}]*#15803d/s);
  assert.match(regelCss, /\.rk-ja-nein\.nein\s*\{[^}]*#b91c1c/s);
});

test("Regelfinder fuehrt mit drei Entscheidungen zu genau einem Spiel", () => {
  assert.match(regeln, /Auf welcher Ebene findet das Spiel statt\?/);
  assert.match(regeln, /Was für ein Spiel ist es\?/);
  assert.match(regeln, /Welche Mannschaft oder Spielklasse\?/);
  assert.match(regeln, /id="spielklasseFilter"/);
  assert.match(regeln, /spielklasse !== ""[\s\S]*\[alle\[index\]\]/);
  assert.doesNotMatch(regeln, /id="gruppeFilter"/);
  assert.doesNotMatch(regeln, /id="regelSuche"/);
});

test("Freundschaftsspiele werden eingeordnet und Freizeitliga bleibt entfernt", () => {
  assert.match(regeln, /data-art="freundschaft"/);
  assert.match(regeln, /IFAB-Regel 3/);
  assert.match(regeln, /\/freizeitliga\/i/);
  assert.doesNotMatch(lies("src/website/content-defaults.js"), /Freizeitliga\/\-klassen SVFD/);
});

test("Absagen erklaert erst den Ablauf und bietet danach die Vorlage", () => {
  const absagen = lies("vorlagen.html");
  const ablauf = absagen.indexOf('class="weg absage-weg"');
  const vorlage = absagen.indexOf('id="email-spiel"');
  assert.ok(ablauf > -1 && vorlage > ablauf);
  for (const text of ["Spieldaten bereithalten", "Absage per E-Mail senden",
    "Absetzung kontrollieren", "Nach 24 Stunden anrufen"]) {
    assert.match(absagen, new RegExp(text));
  }
});

test("Treff-Idee und ausfuehrlicher Fragenvorschlag liegen in einem gemeinsamen Bereich", () => {
  assert.match(melden, /Treff mitgestalten/);
  assert.match(melden, /gruppe === gruppe/);
  assert.match(melden, /href = "frage-vorschlagen\.html"/);
  assert.match(melden, /art === "treff"/);
});

test("die einzelne Fragenvorschlag-Kachel ist aus dem Quizmenue entfernt", () => {
  assert.doesNotMatch(modus, /frage-vorschlagen\.html/);
  assert.match(modus, /href="melden\.html">Ideen &amp; Feedback/);
});

test("v132 erweitert Constraint, Abgabe und Eingang gemeinsam", () => {
  assert.match(migration, /check \(art in \('treff','regelfall','vorfall','gespraech','website'\)\)/);
  assert.match(migration, /p_art not in \('treff','regelfall','vorfall','gespraech','website'\)/);
  assert.match(migration, /when 'treff'\s+then 'Thema fuer Schiri-Treff'/);
  assert.match(migration, /revoke all on function public\.meldebogen_abgeben/);
  assert.match(migration, /grant execute on function public\.meldebogen_abgeben[\s\S]*to anon, authenticated/);
});

test("v133 beschriftet auch die Detailansicht im Obmann-Eingang", () => {
  assert.match(detailsMigration, /obmann_meldung_details/);
  assert.match(detailsMigration, /when 'treff'\s+then 'Thema fuer Schiri-Treff'/);
  assert.match(detailsMigration, /revoke all on function public\.obmann_meldung_details/);
});
