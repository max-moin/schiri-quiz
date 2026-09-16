import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/migrations/20260913124641_termin_sichtbarkeit_und_app_terminfindung.sql', import.meta.url),
  'utf8'
);
const antworten = readFileSync(
  new URL('../supabase/migrations/20260916102447_v143_terminantworten_nach_sichtbarkeit_und_verein.sql', import.meta.url),
  'utf8'
);
const legacy = readFileSync(
  new URL('../supabase/migrations/20260916104500_v144_termin_rueckmeldeschalter_legacy_web.sql', import.meta.url),
  'utf8'
);

test('Termine besitzen genau die drei vereinbarten Sichtbarkeiten', () => {
  assert.match(sql, /check \(sichtbarkeit in \('nur_app', 'nur_verein', 'oeffentlich'\)\)/);
  assert.match(sql, /alter column sichtbarkeit set default 'nur_verein'/);
});

test('nur öffentliche Termine gelangen ohne Anmeldung auf die Website', () => {
  const oeffentlicheFunktionen = sql.match(
    /create function public\.oeffentliche_termine[\s\S]*?create function public\.termine_fuer_schiri/
  )?.[0] ?? '';

  assert.equal((oeffentlicheFunktionen.match(/t\.sichtbarkeit = 'oeffentlich'/g) ?? []).length, 2);
});

test('Mitglieder sehen nur Web-Termine ihres eigenen Vereins und nie reine App-Termine', () => {
  const mitglied = sql.match(
    /create function public\.termine_fuer_schiri[\s\S]*?drop function if exists public\.termin_zusagen/
  )?.[0] ?? '';

  assert.match(mitglied, /t\.verein_id = v_verein/);
  assert.match(mitglied, /t\.sichtbarkeit in \('nur_verein', 'oeffentlich'\)/);
  assert.doesNotMatch(mitglied, /'nur_app'\s*\)/);
});

test('Rückmeldungsschalter wird in beiden Website-Sichten geliefert', () => {
  const oeffentlich = antworten.match(
    /create function public\.oeffentliche_termine_alle[\s\S]*?revoke all on function public\.oeffentliche_termine_alle/
  )?.[0] ?? '';
  const personalisiert = antworten.match(
    /create or replace function public\.termine_fuer_schiri_v2[\s\S]*?revoke all on function public\.termine_fuer_schiri_v2/
  )?.[0] ?? '';
  assert.match(oeffentlich, /rueckmeldung_erforderlich boolean/);
  assert.match(oeffentlich, /t\.rueckmeldung_erforderlich/);
  assert.match(personalisiert, /rueckmeldung_erforderlich boolean/);
  assert.match(personalisiert, /t\.rueckmeldung_erforderlich/);
  assert.match(legacy, /rueckmeldung_erforderlich boolean/);
  assert.match(legacy, /t\.rueckmeldung_erforderlich/);
});

test('interne Antworten bleiben im Verein, öffentliche erlauben jeden angemeldeten Schiri', () => {
  const rueckmeldung = antworten.match(
    /create or replace function public\.termin_rueckmeldung_setzen[\s\S]*?revoke all on function public\.termin_rueckmeldung_setzen/
  )?.[0] ?? '';
  assert.match(rueckmeldung, /t\.sichtbarkeit = 'nur_verein' and t\.verein_id = v_verein/);
  assert.match(rueckmeldung, /or t\.sichtbarkeit = 'oeffentlich'/);
  assert.match(rueckmeldung, /and t\.rueckmeldung_erforderlich/);
});

test('Obmann-Stand zählt den eigenen Verein und trennt fremde Antworten nach Verein', () => {
  assert.match(antworten, /z\.verein_id = v_verein/);
  assert.match(antworten, /verein_name text, ist_eigener_verein boolean/);
  assert.match(antworten, /s\.verein_id <> v_verein/);
});

test('SR-Treff und Soccer-Golf werden gezielt vereinsintern statt global umgestellt', () => {
  assert.match(sql, /25f0d05e-efd0-4fc7-98d8-0fbe0b6b1a12/);
  assert.match(sql, /21ae7f16-5f55-4ae0-8f4f-449713294ae3/);
  assert.match(sql, /where id in/);
});
