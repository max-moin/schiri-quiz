import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatiereAntwort } from "../src/website/duell-verlauf-ansicht.js";

const lese = (pfad) => readFile(new URL(`../${pfad}`, import.meta.url), "utf8");

test("der Duellmodus nutzt den echten Quiz-/Üben-Kopf statt der Vereinsnavigation", async () => {
  const html = await lese("duell.html");
  assert.match(html, /class="kopf kopf-uebung"/);
  assert.match(html, /class="wrap duell-seite"/);
  assert.match(html, /href="style\.css"/);
  assert.doesNotMatch(html, /class="seiten-kopf"/);
  assert.doesNotMatch(html, /FV Löbtauer Kickers<\/span>/);
});

test("ein gespeichertes altes Duell öffnet nicht mehr automatisch", async () => {
  const js = await lese("src/website/duell-seite.js");
  assert.match(js, /sitzung = lesenSitzung\(\);[\s\S]*startAnsicht\(\);/);
  assert.doesNotMatch(js, /if \(sitzung\?\.zugang\)[^{\n]*einstiegInLaufendesDuell/);
  assert.match(js, /data-neues-duell/);
  assert.match(js, /neuesDuellStarten/);
});

test("Zahl und Icon sind im Duell echte serverseitige Antwortwege", async () => {
  const sql = await lese("supabase/migrations/20260905110000_v122_duell_alle_antworttypen.sql");
  const zugriff = await lese("src/website/duell-zugriff.js");
  assert.match(sql, /f\.antworttyp='zahl'/);
  assert.match(sql, /f\.antworttyp='entscheidung'/);
  assert.match(sql, /create or replace function public\.duell_antwort_zahl/);
  assert.match(sql, /create or replace function public\.duell_entscheidung_speichern/);
  assert.match(sql, /grant execute on function public\.duell_entscheidung_kontext[\s\S]*to service_role/);
  assert.match(zugriff, /duell_antwort_zahl/);
  assert.match(zugriff, /\/api\/duell-entscheidung/);
});

test("die Duell-Auswertung formatiert Zahl und strukturierte Entscheidung", () => {
  assert.equal(formatiereAntwort({ antworttyp: "zahl" }, { details: { wert: 2.5, einheit: "m" } }), "2,5 m");
  const text = formatiereAntwort({ antworttyp: "entscheidung" }, { details: { antwort: {
    spielfortsetzung: "direkter_freistoss", fortsetzung_fuer: "gast", fortsetzung_ort: "Ort des Vergehens",
    strafen: [{ strafe: "gelb", fuer_mannschaft: "heim", strafe_fuer_rolle: "feldspieler", rueckennummer: 7 }],
  } } });
  assert.match(text, /Direkter Freistoß für Gast/);
  assert.match(text, /Gelbe Karte für Heim/);
  assert.match(text, /Nr\. 7/);
});
