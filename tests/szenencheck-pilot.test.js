import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261107125701_szenencheck_pilot.sql");
const web = read("src/website/szenencheck-seite.js");

test("Szenencheck hat einen eigenen, nicht bewerteten Arbeitsraum", () => {
  assert.match(read("src/website/modus-seite.js"), /href="szenencheck.html"/);
  assert.match(read("szenencheck.html"), /content="noindex"/);
  assert.match(web, /gastErlaubt: false/);
  assert.match(web, /credentials: "omit"/);
  assert.doesNotMatch(web, /localStorage|sessionStorage|freitext-bewerten/);
});

test("Szenencheck-Gateway und privater Clip-Speicher sind getrennt vom Quiz", () => {
  assert.match(sql, /from public, anon, authenticated;/);
  assert.match(sql, /to service_role;/);
  assert.match(sql, /'szenencheck-clips', false, 50000000/);
  assert.match(sql, /schiri_pin_pruefen/);
  assert.match(sql, /fehl\.anzahl>=5/);
  assert.match(sql, /s\.antwort-'text'/);
  assert.match(sql, /s\.person=mitglied/);
  assert.match(sql, /clock_timestamp\(\)>=r\.schluss/);
  assert.match(read("supabase/functions/szenencheck/index.ts"), /clips\.createSignedUrl\(data\.pfad, 300\)/);
});
