import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lese = (datei) => readFileSync(new URL(`../${datei}`, import.meta.url), "utf8");
const sql = lese("supabase/migrations/20260904225515_duell_modus.sql");
const seite = lese("src/website/duell-seite.js");

test("Duell-Antworten bleiben vom Wochenquiz und Scoreboard getrennt", () => {
  assert.match(sql, /create table public\.duell_antworten/);
  assert.doesNotMatch(sql, /insert into public\.antworten/i);
});

test("nur ein angemeldeter aktiver Schiedsrichter kann einen Code erstellen", () => {
  assert.match(sql, /s\.id=p_schiedsrichter_id and s\.pin=p_pin and coalesce\(s\.aktiv,false\)/);
  assert.match(sql, /höchstens drei offene Duelle/);
});

test("Gäste treten nur mit Code und Anzeigename bei", () => {
  assert.match(sql, /duell_beitreten\(p_code text,p_anzeigename text,p_schiedsrichter_id uuid default null/);
  assert.match(seite, /Dein Anzeigename/);
  assert.doesNotMatch(seite, /mail|passwort/i);
});

test("Lösungen verlassen den Server erst nach der Antwort", () => {
  const frage = sql.slice(sql.indexOf("function public.duell_frage"), sql.indexOf("function public.duell_reaktionen_fuer_frage"));
  assert.doesNotMatch(frage, /musterantwort|richtige_option|ist_richtig/);
  assert.match(sql, /Erst antworten, dann Reaktionen ansehen/);
});

test("offene und geschlossene Duelle werden begrenzt aufbewahrt", () => {
  assert.match(sql, /status='geschlossen' and geschlossen_am < now\(\)-interval '30 days'/);
  assert.match(sql, /status='offen' and erstellt_am < now\(\)-interval '14 days'/);
});
