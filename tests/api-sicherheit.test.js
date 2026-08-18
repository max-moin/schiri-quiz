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

// Seit dem Umbau zur Vereinsseite (18.08.2026) liegt das Quiz in
// "quiz.html"; unter "index.html" steht die neue Startseite, die keine
// Supabase-Bibliothek einbindet. Der Test hat den Umzug korrekt bemerkt
// und zeigt jetzt auf die richtige Datei.
test("die Browserbibliothek ist auf die geprüfte Version festgelegt", () => {
  const html = readFileSync(new URL("../quiz.html", import.meta.url), "utf8");
  assert.match(html, /@supabase\/supabase-js@2\.112\.2/);
  assert.match(html, /integrity="sha384-[^"]+"/);
});

// Gegenprobe zum Umzug: Die öffentliche Startseite darf gar keine
// Datenbank-Anbindung haben. Sonst wäre versehentlich Quiz-Code in den
// offenen Bereich gerutscht.
test("die Startseite bindet keine Datenbank-Bibliothek ein", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /supabase/i);
  assert.doesNotMatch(html, /config\.js/);
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

test("die zweite Sicherheitsmigration entfernt die fünf öffentlichen Alt-Views", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260811221524_v79_legacy_views_und_search_path.sql",
      import.meta.url
    ),
    "utf8"
  );
  const views = [
    "scoreboard",
    "schiedsrichter_oeffentlich",
    "trend_wochen",
    "fragen_oeffentlich",
    "fragen_erfolgsquote",
  ];

  for (const view of views) {
    assert.match(migration, new RegExp(`drop view if exists public\\.${view}`));
  }

  assert.match(
    migration,
    /alter function public\.ausruestungs_anfragen_touch\(\)\s+set search_path = pg_catalog, public/
  );
  assert.doesNotMatch(migration, /drop\s+view[^;]*\bcascade\b/i);
});

test("interne und veraltete RPCs bleiben nicht als öffentliche Endpunkte zurück", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260811221906_v81_interne_rpc_flaeche_verkleinern.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(migration, /drop function if exists public\.pin_pruefen\(uuid, text\)/);
  assert.match(migration, /drop function if exists public\.vereinskennung_pruefen\(text\)/);
  assert.match(
    migration,
    /revoke execute on function public\.historie_fortschritt_auffuellen\(uuid\)/
  );
  assert.match(
    migration,
    /revoke execute on function public\.frage_ist_sichtbar\(boolean, uuid, boolean\)/
  );
  assert.match(
    migration,
    /revoke execute on function public\.obmann_verein\(text\)/
  );
  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke execute on functions from public/
  );
  assert.doesNotMatch(migration, /drop\s+function[^;]*\bcascade\b/i);
});

test("neue Datenbankfunktionen erhalten keine automatischen Browserrechte", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260811224313_v82_standardrechte_fuer_funktionen_sperren.sql",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    migration,
    /alter default privileges for role postgres in schema public\s+revoke execute on functions from public, anon, authenticated/
  );
});
