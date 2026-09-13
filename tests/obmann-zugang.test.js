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

test("der Editor trennt Inhalte und Sichtbarkeit statt sie als Endlosseite zu zeigen", () => {
  for (const bereich of ["sichtbarkeit", "spesen", "regeln", "vorlagen", "unterlagen"]) {
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

// Diese Tests pruefen ausdruecklich den Authorization-Header. Genau der
// hat am 13.09.2026 gefehlt (GoTrue: 401 no_authorization), obwohl eine
// gueltige Sitzung vorlag - deshalb rufen wir die MFA-Endpunkte selbst
// auf statt ueber client.auth.mfa, und deshalb wird hier gemessen und
// nicht nur "kein Fehler geworfen" geprueft.
const ZUGANG = { adresse: "https://db.example.invalid", schluessel: "sb_publishable_test" };

function bauePruefClient({ token = "zugangstoken-aal1" } = {}) {
  const protokoll = [];
  const client = {
    auth: {
      getSession: async () => ({ data: { session: token ? { access_token: token } : null }, error: null }),
      setSession: async (wert) => { protokoll.push(["setSession", wert]); return { data: {}, error: null }; },
    },
  };
  return { client, protokoll };
}

test("TOTP-Verifikation schickt bei beiden Anfragen das Zugangstoken mit", async () => {
  const { client, protokoll } = bauePruefClient();
  const urspruenglich = globalThis.fetch;
  globalThis.fetch = async (adresse, optionen) => {
    protokoll.push([adresse, optionen.headers.Authorization, optionen.headers.apikey, optionen.body]);
    const antwort = adresse.endsWith("/challenge")
      ? { id: "c1" }
      : { access_token: "neu-aal2", refresh_token: "erneuerung" };
    return { ok: true, status: 200, json: async () => antwort };
  };
  try {
    await totpBestaetigen(client, "f1", "123 456", ZUGANG);
  } finally {
    globalThis.fetch = urspruenglich;
  }

  assert.deepEqual(protokoll[0], [
    "https://db.example.invalid/auth/v1/factors/f1/challenge",
    "Bearer zugangstoken-aal1",
    "sb_publishable_test",
    "{}",
  ]);
  assert.deepEqual(protokoll[1], [
    "https://db.example.invalid/auth/v1/factors/f1/verify",
    "Bearer zugangstoken-aal1",
    "sb_publishable_test",
    JSON.stringify({ challenge_id: "c1", code: "123456" }),
  ]);
  // Die neue Sitzung auf Stufe aal2 muss zurueck in den Client, sonst
  // arbeitet der Rest der Seite weiter auf aal1.
  assert.deepEqual(protokoll[2], [
    "setSession", { access_token: "neu-aal2", refresh_token: "erneuerung" },
  ]);
});

test("TOTP-Verifikation geht ohne Sitzung gar nicht erst hinaus", async () => {
  const { client } = bauePruefClient({ token: null });
  const urspruenglich = globalThis.fetch;
  let gerufen = false;
  globalThis.fetch = async () => { gerufen = true; throw new Error("darf nicht passieren"); };
  try {
    await assert.rejects(() => totpBestaetigen(client, "f1", "123456", ZUGANG), /abgelaufen/);
  } finally {
    globalThis.fetch = urspruenglich;
  }
  assert.equal(gerufen, false);
});

test("TOTP-Verifikation prueft Code und Zugangsdaten vor der Anfrage", async () => {
  const { client } = bauePruefClient();
  await assert.rejects(() => totpBestaetigen(client, "f1", "1234", ZUGANG), /sechsstelligen/);
  await assert.rejects(() => totpBestaetigen(client, "f1", "123456", {}), /nicht vollständig/);
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
