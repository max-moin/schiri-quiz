import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ladeFunktionsfreigaben,
  normalisiereFunktionsfreigaben,
} from "../src/website/funktionsfreigaben.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const migration = lies("supabase/migrations/20260909173000_v130_website_funktionsfreigaben.sql");

test("fehlende oder fehlerhafte Freigaben sperren beide Bereiche", async () => {
  assert.deepEqual(normalisiereFunktionsfreigaben(null), { spesen: false, regeln: false });
  assert.deepEqual(normalisiereFunktionsfreigaben({ spesen_aktiv: 1, regeln_aktiv: "true" }), {
    spesen: false,
    regeln: false,
  });
  const geladen = await ladeFunktionsfreigaben({
    datenbank: { adresse: "https://example.invalid", oeffentlicherSchluessel: "public" },
    seitenschluessel: "verein",
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.deepEqual(geladen, { spesen: false, regeln: false });
});

test("öffentliche Freigaben werden strikt als Boolean gelesen", async () => {
  const geladen = await ladeFunktionsfreigaben({
    datenbank: { adresse: "https://example.invalid", oeffentlicherSchluessel: "public" },
    seitenschluessel: "loebtauer-kickers",
    fetchImpl: async () => ({
      ok: true,
      json: async () => [{ spesen_aktiv: true, regeln_aktiv: false }],
    }),
  });
  assert.deepEqual(geladen, { spesen: true, regeln: false });
});

test("Direktaufrufe bleiben bis zur geladenen Freigabe verborgen", () => {
  assert.match(lies("spesenrechner.html"), /data-funktionsinhalt="spesen" hidden/);
  assert.match(lies("regeluebersicht.html"), /data-funktionsinhalt="regeln" hidden/);
  assert.match(lies("seite.js"), /zeigeGesperrteFunktion/);
  assert.match(lies("src/ui/kopf-navigation.js"), /setzeFunktionsfreigaben/);
});

test("nur ein zugeordneter AAL2-Redakteur darf Sichtbarkeit ändern", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant select \(seitenschluessel, spesen_aktiv, regeln_aktiv, updated_at\)[\s\S]*to anon, authenticated/i);
  assert.match(migration, /\(\(select auth\.jwt\(\)\)->>'aal'\) = 'aal2'/);
  assert.match(migration, /wr\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /with check[\s\S]*updated_by = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]+to\s+anon/i);
  assert.doesNotMatch(migration, /security definer/i);
});

test("der Obmann-Zugang hat einen eigenen Sichtbarkeitsbereich", () => {
  assert.match(lies("obmann.html"), /data-bereich-knopf="sichtbarkeit"/);
  assert.match(lies("obmann.html"), /data-admin-bereich="sichtbarkeit"/);
  assert.match(lies("src/admin/obmann-page.js"), /erstelleFreigabenEditor/);
  assert.match(lies("src/admin/freigaben-editor.js"), /Sichtbarkeit speichern/);
});
