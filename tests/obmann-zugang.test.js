import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authentifizierungsStand,
  mitPasswortAnmelden,
  totpBestaetigen,
} from "../src/admin/obmann-auth.js";

const html = readFileSync(new URL("../obmann.html", import.meta.url), "utf8");
const seite = readFileSync(new URL("../seite.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260825121425_v86_website_redaktion_mit_totp_mfa.sql", import.meta.url),
  "utf8",
) + readFileSync(
  new URL("../supabase/migrations/20260825122111_v87_website_rls_initplan_und_index.sql", import.meta.url),
  "utf8",
) + readFileSync(
  new URL("../supabase/migrations/20260825143000_v88_website_inhalte_mit_versionen.sql", import.meta.url),
  "utf8",
);

test("Obmann-Zugang kombiniert Passwort und TOTP statt einer kurzen PIN", () => {
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /2FAS-Code/);
  assert.doesNotMatch(html, /value="1234"/);
  assert.match(seite, /Obmann-Zugang/);
});

test("RLS bindet Schreibrechte an Benutzerzuordnung und AAL2", () => {
  assert.match(migration, /auth\.jwt\(\)->>'aal'\) = 'aal2'/);
  assert.match(migration, /\(\(select auth\.jwt\(\)\)->>'aal'\) = 'aal2'/);
  assert.match(migration, /wr\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /grant select \(seitenschluessel, konfiguration, updated_at\)/);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]+to\s+anon/i);
  assert.doesNotMatch(migration, /security definer/i);
});

test("die drei weiteren Inhaltsbereiche sind versioniert und nur mit AAL2 beschreibbar", () => {
  assert.match(migration, /website_inhalte_konfiguration/);
  assert.match(migration, /website_inhalte_versionen/);
  assert.match(migration, /bereich in \('regeln', 'vorlagen', 'unterlagen'\)/);
  assert.match(migration, /archiviert_von = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete)[^;]+to\s+anon/i);
  assert.doesNotMatch(migration, /grant\s+delete/i);
});

test("die RLS-Prüfung darf die eigene Redakteurszuordnung lesen", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260825152000_v89_redakteurszuordnung_fuer_rls_lesbar.sql", import.meta.url), "utf8");
  assert.match(sql, /grant select \(user_id, seitenschluessel\)[\s\S]*website_redakteure to authenticated/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("der Editor trennt die vier Arbeitsbereiche statt sie als Endlosseite zu zeigen", () => {
  for (const bereich of ["spesen", "regeln", "vorlagen", "unterlagen"]) {
    assert.match(html, new RegExp(`data-bereich-knopf="${bereich}"`));
    assert.match(html, new RegExp(`data-admin-bereich="${bereich}"`));
  }
  const spesenEditor = readFileSync(new URL("../src/admin/spesen-editor.js", import.meta.url), "utf8");
  assert.match(spesenEditor, /admin-liga-gruppe/);
  assert.match(html, /Neue Liga ergänzen/);
});

test("Passwortanmeldung verwendet Supabase Auth", async () => {
  let eingabe = null;
  const client = {
    auth: {
      signInWithPassword: async (wert) => {
        eingabe = wert;
        return { data: { user: { id: "u1" } }, error: null };
      },
    },
  };
  await mitPasswortAnmelden(client, " max@example.org ", "sicheres-passwort");
  assert.deepEqual(eingabe, { email: "max@example.org", password: "sicheres-passwort" });
});

test("TOTP-Verifikation erzeugt Challenge und prueft sechsstelligen Code", async () => {
  const aufrufe = [];
  const client = {
    auth: {
      mfa: {
        challenge: async ({ factorId }) => {
          aufrufe.push(["challenge", factorId]);
          return { data: { id: "c1" }, error: null };
        },
        verify: async (wert) => {
          aufrufe.push(["verify", wert]);
          return { data: {}, error: null };
        },
      },
    },
  };
  await totpBestaetigen(client, "f1", "123 456");
  assert.deepEqual(aufrufe, [
    ["challenge", "f1"],
    ["verify", { factorId: "f1", challengeId: "c1", code: "123456" }],
  ]);
  await assert.rejects(() => totpBestaetigen(client, "f1", "1234"), /sechsstelligen/);
});

test("AAL2 wird aus der Supabase-Sitzung gelesen", async () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1" } } }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null,
        }),
        listFactors: async () => ({ data: { totp: [{ id: "f1", status: "verified" }] }, error: null }),
      },
    },
  };
  const stand = await authentifizierungsStand(client);
  assert.equal(stand.aal2, true);
  assert.equal(stand.faktor.id, "f1");
});
