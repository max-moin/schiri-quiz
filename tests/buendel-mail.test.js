import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { betreffFuer } from '../supabase/functions/obmann-benachrichtigungen/betreff.js';
test('Gemischte Bündelentscheidung verspricht nicht die Freigabe aller Teile', () => {
  const text = betreffFuer('ausruestung.freigegeben',{buendel_phase:'entscheidung',anzeigename:'Max M.',anzahl:2,freigegeben:1,abgelehnt:1});
  assert.match(text,/Bündel entschieden/); assert.match(text,/2 Teile/); assert.doesNotMatch(text,/Anfrage freigegeben/);
});
test('Komplett abgelehntes Bündel bleibt eine gemeinsame Entscheidung', () => {
  assert.match(betreffFuer('ausruestung.abgelehnt',{buendel_phase:'entscheidung',anzahl:3}),/Bündel entschieden.*3 Teile/);
});
test('Einzelanfragen behalten ihre bisherigen Benachrichtigungen', () => {
  assert.match(betreffFuer('ausruestung.freigegeben'),/Anfrage freigegeben/);
});
test('Bündelabschluss wird vor dem Claim geprüft; interne Prüfliste ist privat', () => {
  const sql=readFileSync(new URL('../supabase/migrations/20261011205153_buendel_entscheidung_eine_benachrichtigung.sql',import.meta.url),'utf8');
  assert.match(sql,/if v_offen>0 then continue/);
  assert.match(sql,/for update skip locked limit 50/);
  assert.match(sql,/perform public.benachrichtigung_buendel_pruefen\(\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on function public.benachrichtigung_buendel_pruefen\(\) from public,anon,authenticated/);
  assert.match(sql,/a.prozess_runde::text/);
  const nachlauf=readFileSync(new URL('../supabase/migrations/20261011211129_buendel_mail_pruefungen_fair_durchlaufen.sql',import.meta.url),'utf8');
  assert.match(nachlauf,/set erstellt_am=clock_timestamp\(\)/);
});
