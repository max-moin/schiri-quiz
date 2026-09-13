import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/migrations/20260913124641_termin_sichtbarkeit_und_app_terminfindung.sql', import.meta.url),
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

test('Antworten bleiben unabhängig von der Sichtbarkeit auf den eigenen Verein begrenzt', () => {
  const rueckmeldung = sql.match(
    /create function public\.termin_rueckmeldung_setzen[\s\S]*?-- -------------------------------------------------------------------------\n-- Obmann-App/
  )?.[0] ?? '';

  assert.match(rueckmeldung, /t\.verein_id = v_verein/);
  assert.match(rueckmeldung, /t\.sichtbarkeit in \('nur_verein', 'oeffentlich'\)/);
});

test('SR-Treff und Soccer-Golf werden gezielt vereinsintern statt global umgestellt', () => {
  assert.match(sql, /25f0d05e-efd0-4fc7-98d8-0fbe0b6b1a12/);
  assert.match(sql, /21ae7f16-5f55-4ae0-8f4f-449713294ae3/);
  assert.match(sql, /where id in/);
});
