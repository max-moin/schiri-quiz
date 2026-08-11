import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  ExternerDienstTimeout,
  ServerkonfigurationFehlt,
  antworteMitSicheremFehler,
  fetchMitZeitlimit,
  istSupabaseServerSchluesselKonfiguriert,
  supabaseRpc,
} from "../server/api-helpers.js";

test("der alte öffentliche KI-Testendpunkt ist entfernt", () => {
  assert.equal(existsSync(new URL("../api/ki-test.js", import.meta.url)), false);
});

test("die Browserbibliothek ist auf die geprüfte Version festgelegt", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /@supabase\/supabase-js@2\.112\.2/);
  assert.match(html, /integrity="sha384-[^"]+"/);
});

test("API-Fehler geben keine internen Details an den Browser", () => {
  const urspruenglichesConsoleError = console.error;
  console.error = () => {};

  try {
    const antwort = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };

    antworteMitSicheremFehler(
      antwort,
      502,
      "Öffentliche Meldung",
      new Error("interne Datenbank-Information")
    );

    assert.equal(antwort.statusCode, 502);
    assert.deepEqual(antwort.body, { fehler: "Öffentliche Meldung" });
    assert.equal("details" in antwort.body, false);
  } finally {
    console.error = urspruenglichesConsoleError;
  }
});

test("die API-Dateien enthalten keine technischen Detailfelder mehr", () => {
  for (const datei of ["../api/erklaerung.js", "../api/freitext-bewerten.js"]) {
    const inhalt = readFileSync(new URL(datei, import.meta.url), "utf8");
    assert.doesNotMatch(inhalt, /details\s*:/);
    assert.doesNotMatch(inhalt, /GEMINI_API_KEY ist auf Vercel nicht gesetzt/);
  }
});

test("externe Aufrufe werden nach dem Zeitlimit abgebrochen", async () => {
  const urspruenglichesFetch = globalThis.fetch;
  globalThis.fetch = (_url, optionen) =>
    new Promise((_resolve, reject) => {
      optionen.signal.addEventListener("abort", () => {
        const fehler = new Error("abgebrochen");
        fehler.name = "AbortError";
        reject(fehler);
      });
    });

  try {
    await assert.rejects(
      fetchMitZeitlimit("https://example.invalid", {}, 5, "Testdienst"),
      (fehler) =>
        fehler instanceof ExternerDienstTimeout &&
        fehler.code === "UPSTREAM_TIMEOUT"
    );
  } finally {
    globalThis.fetch = urspruenglichesFetch;
  }
});

test("serverseitige Supabase-Aufrufe bevorzugen den geheimen Vercel-Schlüssel", async () => {
  const vorherigerFetch = globalThis.fetch;
  const vorherigerSecretKey = process.env.SUPABASE_SECRET_KEY;
  const vorherigerServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testSchluessel = "sb_secret_nur_fuer_diesen_test";
  let gesendeteHeader;

  process.env.SUPABASE_SECRET_KEY = testSchluessel;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async (_url, optionen) => {
    gesendeteHeader = optionen.headers;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    assert.equal(istSupabaseServerSchluesselKonfiguriert(), true);
    await supabaseRpc("test_funktion", { test: true });
    assert.equal(gesendeteHeader.apikey, testSchluessel);
    assert.equal("Authorization" in gesendeteHeader, false);
  } finally {
    globalThis.fetch = vorherigerFetch;
    if (vorherigerSecretKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = vorherigerSecretKey;
    }
    if (vorherigerServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = vorherigerServiceRoleKey;
    }
  }
});

test("serverseitige Supabase-Aufrufe fallen nie auf den öffentlichen Schlüssel zurück", async () => {
  const vorherigerSecretKey = process.env.SUPABASE_SECRET_KEY;
  const vorherigerServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    assert.equal(istSupabaseServerSchluesselKonfiguriert(), false);
    await assert.rejects(
      supabaseRpc("test_funktion", { test: true }),
      (fehler) =>
        fehler instanceof ServerkonfigurationFehlt &&
        fehler.code === "SERVER_CONFIGURATION_MISSING"
    );
  } finally {
    if (vorherigerSecretKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = vorherigerSecretKey;
    }
    if (vorherigerServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = vorherigerServiceRoleKey;
    }
  }
});

test("die Sperrmigration umfasst alle sieben KI-nahen RPCs", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260811190000_v78_ki_rpc_nur_server.sql",
      import.meta.url
    ),
    "utf8"
  );
  const funktionsnamen = [
    "erklaerung_kontext_laden",
    "freitext_kontext_laden",
    "historie_freitext_kontext_laden",
    "freitext_nachbesserung_kontext",
    "freitext_antwort_speichern",
    "historie_freitext_antwort_speichern",
    "freitext_ergaenzung_speichern",
  ];

  for (const name of funktionsnamen) {
    assert.match(migration, new RegExp(`revoke execute on function public\\.${name}`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}`));
  }
});
