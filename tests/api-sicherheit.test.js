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

// Bis zum 21.08.2026 stand hier "die Startseite bindet keine
// Datenbank-Bibliothek ein" - eine Gegenprobe zum Umzug des Quiz nach
// quiz.html. Seit dem 22.08.2026 holt die Startseite die freigegebenen
// Vereinstermine, also stimmt der Satz nicht mehr.
//
// Der Test wurde deshalb NICHT geloescht, sondern verschaerft. Die
// Entscheidung war "genau ein Datenweg, und zwar lesend": die Startseite
// darf die eine oeffentliche RPC rufen und sonst nichts. Ein blosses
// Streichen des Tests haette genau die Luecke geoeffnet, die er bewachen
// sollte - dass irgendwann Quiz-Code in den offenen Bereich rutscht.
test("die Startseite spricht nur die eine öffentliche Termin-Funktion an", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  // Kein Quizbereich im offenen Teil: keine Supabase-Bibliothek, kein
  // Client, nicht die Quiz-Konfiguration, nicht die Quiz-Anwendung.
  assert.doesNotMatch(html, /@supabase\/supabase-js/);
  assert.doesNotMatch(html, /createClient/);
  assert.doesNotMatch(html, /["'/]config\.js/);
  assert.doesNotMatch(html, /["'/]app\.js/);

  // Ein geheimer Schluessel hat im Browser nichts zu suchen. Der
  // veroeffentlichbare (sb_publishable_...) ist dagegen dafuer gemacht.
  assert.doesNotMatch(html, /sb_secret_/);
  assert.doesNotMatch(html, /service_role/);
  assert.doesNotMatch(html, /eyJ[A-Za-z0-9_-]{20,}/); // alter JWT-Schluessel

  // Und genau ein RPC-Aufruf, naemlich der lesende.
  const rpcAufrufe = html.match(/\/rest\/v1\/rpc\/[a-z_]+/g) || [];
  assert.deepEqual(rpcAufrufe, ["/rest/v1/rpc/oeffentliche_termine"]);

  // Kein direkter Tabellenzugriff an der Funktion vorbei.
  assert.doesNotMatch(html, /\/rest\/v1\/(?!rpc\/)/);
});

/* Kommentare wegwerfen, bevor geprueft wird.
   Der Review am 22.08.2026 hat vorgefuehrt, warum: /security definer/
   stand auch im Kopfkommentar der Migration. Nimmt man die Zeile aus dem
   eigentlichen DDL heraus, bleibt der Test gruen - und bewacht nichts
   mehr. Die Funktion liefe dann als "anon", RLS auf "termine" griffe,
   sie gaebe immer null Zeilen zurueck, und weil der Abschnitt sich bei
   leerem Ergebnis ohnehin versteckt, waere es niemandem aufgefallen. */
const ohneKommentare = (sql) => sql.replace(/--[^\n]*/g, "");

const migration = (datei) =>
  ohneKommentare(
    readFileSync(new URL(`../supabase/migrations/${datei}`, import.meta.url), "utf8")
  );

/* Genau EINEN Funktionsrumpf herausschneiden.

   Warum das noetig ist, hat ein Sabotage-Test am 29.08.2026 gezeigt: Die
   Pruefung "and t.oeffentlich kommt vor" lief ueber die ganze Datei. Nimmt
   man den Filter aus "oeffentliche_termine" heraus, steht dieselbe Zeile
   immer noch in "oeffentliche_termine_alle" - der Test blieb gruen,
   waehrend interne Termine oeffentlich geworden waeren. Der schwerste
   denkbare Fehler, und er wurde nicht bemerkt. Seitdem wird jede
   Bedingung im Rumpf ihrer eigenen Funktion geprueft. */
function funktionsRumpf(sql, name) {
  const anfang = sql.indexOf(`function public.${name}(`);
  if (anfang < 0) throw new Error(`Funktion ${name} steht nicht in der Migration`);
  const koerperStart = sql.indexOf("$function$", anfang);
  const koerperEnde = sql.indexOf("$function$", koerperStart + 10);
  if (koerperStart < 0 || koerperEnde < 0) throw new Error(`Rumpf von ${name} nicht gefunden`);
  return sql.slice(anfang, koerperEnde);
}

// Die Funktion selbst ist die eigentliche Absicherung: auf "termine" ist
// RLS an und es gibt keine Policy, die Tabelle ist von aussen also
// unlesbar. Alles haengt daran, dass diese eine Funktion nicht mehr
// herausgibt als sie soll.
//
// ACHTUNG BEIM WEITERBAUEN: Diese Pruefung MUSS auf die Migration zeigen,
// die die Funktion zuletzt angelegt hat - sonst bewacht sie eine Fassung,
// die es gar nicht mehr gibt. Genau das drohte am 29.08.2026: v90 hat
// "oeffentliche_termine" geloescht und neu angelegt (ID und Uhrzeit kamen
// dazu, die Obergrenze ging von 6 auf 4), waehrend der Test noch die
// v84-Datei las. Er waere gruen geblieben, egal was in der neuen Fassung
// steht.
test("die öffentliche Termin-Funktion gibt nur freigegebene Termine heraus", () => {
  const sql = migration("20260829150000_v90_termine_mit_rueckmeldungen.sql");
  const rumpf = funktionsRumpf(sql, "oeffentliche_termine");

  assert.match(rumpf, /security definer/i);
  assert.match(rumpf, /set search_path to public/i);

  // Die drei Bedingungen, ohne die interne, vergangene oder fremde
  // Termine nach aussen kaemen - im Rumpf DIESER Funktion, nicht
  // irgendwo in der Datei.
  assert.match(rumpf, /and t\.oeffentlich\b/);
  assert.match(rumpf, /and t\.datum >= \(now\(\) at time zone 'Europe\/Berlin'\)::date/);
  assert.match(rumpf, /where v\.oeffentliche_kennung = p_seitenschluessel/);

  // Keine ausufernde Ausgabe und keine internen Spalten. Die Startseite
  // zeigt vier Termine (Max' Entscheidung vom 29.08.2026).
  assert.match(rumpf, /limit 4\b/);
  assert.doesNotMatch(rumpf, /select\s+t\.\*/);

  // Rechte: erst wegnehmen, dann gezielt geben - und niemals an public.
  assert.match(
    sql,
    /revoke all on function public\.oeffentliche_termine\(text\) from public/
  );
  assert.match(
    sql,
    /grant execute on function public\.oeffentliche_termine\(text\) to anon, authenticated/
  );
  assert.doesNotMatch(sql, /grant execute[^;]*to public\b/i);
});

// Die zweite oeffentliche Terminfunktion (vollstaendige Liste fuer
// termine.html). Sie darf mehr Zeilen liefern als die Startseite, aber
// unter GENAU denselben Bedingungen - ausser der Vergangenheit, die hier
// bewusst mitkommt, damit man nachschlagen kann, wann etwas war.
test("die vollständige Terminliste bleibt auf freigegebene Termine begrenzt", () => {
  const sql = migration("20260829150000_v90_termine_mit_rueckmeldungen.sql");
  const rumpf = funktionsRumpf(sql, "oeffentliche_termine_alle");

  assert.match(rumpf, /security definer/i);
  assert.match(rumpf, /and t\.oeffentlich\b/);
  assert.match(rumpf, /where v\.oeffentliche_kennung = p_seitenschluessel/);
  assert.doesNotMatch(rumpf, /select\s+t\.\*/);

  assert.match(
    sql,
    /revoke all on function public\.oeffentliche_termine_alle\(text\) from public/
  );
  assert.match(
    sql,
    /grant execute on function public\.oeffentliche_termine_alle\(text\) to anon, authenticated/
  );
});

// Jede Funktion, die persoenliche Termindaten anfasst, muss die PIN
// pruefen. Ohne diese Pruefung koennte jeder mit einer geratenen
// Schiedsrichter-ID fremde Zusagen setzen oder Namen abfragen.
test("die Termin-Funktionen mit Personenbezug prüfen die PIN", () => {
  const sql = migration("20260829150000_v90_termine_mit_rueckmeldungen.sql");

  for (const name of ["termine_fuer_schiri", "termin_zusagen", "termin_rueckmeldung_setzen"]) {
    const rumpf = funktionsRumpf(sql, name);
    assert.match(rumpf, /v_pin <> p_pin/, `${name} vergleicht die PIN nicht`);
    assert.match(rumpf, /raise exception 'PIN ungueltig'/, `${name} bricht bei falscher PIN nicht ab`);
    assert.match(rumpf, /security definer/i);
  }
});

// Max' Entscheidung vom 29.08.2026: eine Absage braucht einen Grund. Die
// Regel steht in der Datenbank und nicht nur in der Oberflaeche - sonst
// koennte ein direkter Aufruf sie umgehen.
test("eine Absage ohne Grund ist in der Datenbank verboten", () => {
  const sql = migration("20260829150000_v90_termine_mit_rueckmeldungen.sql");

  assert.match(sql, /constraint absage_braucht_grund/);
  assert.match(sql, /check \(status = 'zu' or grund is not null\)/);

  // Feste Gruende statt Freitext - sonst ist die Auswertung wertlos.
  assert.match(sql, /'arbeit', 'eigenes_spiel', 'urlaub', 'krank', 'familie', 'sonstiges'/);

  // RLS an, keine Policy: die Tabelle ist von aussen unlesbar, alles
  // laeuft ueber die geprueften Funktionen.
  assert.match(sql, /alter table public\.termin_rueckmeldungen enable row level security/);
  assert.doesNotMatch(sql, /create policy[^;]*termin_rueckmeldungen/i);
});

// Absagegruende sind persoenlich. Sie duerfen ausschliesslich ueber die
// Obmann-Funktion herauskommen, nie ueber die Mitgliedersicht.
test("Absagegründe kommen nur über den Obmann-Zugang heraus", () => {
  const sql = migration("20260829150000_v90_termine_mit_rueckmeldungen.sql");

  // Diese Funktion gibt anderen Mitgliedern die Namen. Sie darf nur
  // Zusagen kennen und keine Gruende ausgeben.
  const rumpf = funktionsRumpf(sql, "termin_zusagen");
  assert.match(rumpf, /returns table \(name text\)/);
  assert.match(rumpf, /r\.status = 'zu'/);
  assert.doesNotMatch(rumpf, /r\.grund/);
  assert.doesNotMatch(rumpf, /r\.kommentar/);

  // Der Obmann-Weg dagegen darf beides.
  const obmann = funktionsRumpf(sql, "obmann_termin_rueckmeldungen");
  assert.match(obmann, /obmann_verein\(p_passwort\)/);
  assert.match(obmann, /r\.grund/);
});

/* ------------------------------------------------------------------
   Der wichtigste Test dieser Runde.

   In der ersten Fassung vom 22.08.2026 stand die VEREINSKENNUNG in
   verein.config.js, weil die Terminfunktion sie als Schluessel nahm.
   Die Kennung ist aber ein Zugangsgeheimnis: app.js verdeckt das
   Eingabefeld absichtlich, und schiri_liste(p_kennung) gibt allein mit
   ihr, ohne PIN, die Namen aller Schiedsrichter des Vereins heraus -
   bei einem Einstiegsalter von 12 Jahren also auch die von
   Minderjaehrigen. verein.config.js laedt jeder Besucher der
   Startseite.

   Seit v84 gibt es dafuer einen eigenen, harmlosen Schluessel. Dieser
   Test sorgt dafuer, dass die Kennung nicht wieder hineinrutscht.
   ------------------------------------------------------------------ */
test("die Vereinskennung steht in keiner öffentlichen Datei", () => {
  const oeffentlich = [
    "../verein.config.js",
    "../seite.js",
    "../index.html",
    "../schiri-werden.html",
    "../regeluebersicht.html",
    "../spesenrechner.html",
    "../vorlagen.html",
    "../informationen.html",
  ];

  for (const datei of oeffentlich) {
    const inhalt = readFileSync(new URL(datei, import.meta.url), "utf8");

    /* Die Kennung selbst wird OHNE Kommentarfilter geprueft. Ein
       Kommentar wird genauso an jeden Besucher ausgeliefert wie der
       Code darunter - "steht ja nur im Kommentar" hilft niemandem.
       (Beim Gegenlesen der ausgelieferten Dateien am 22.08.2026
       aufgefallen: Der erklaerende Kommentar zur Behebung nannte die
       Kennung im Klartext und veroeffentlichte damit genau das, was er
       schuetzen sollte.) */
    assert.doesNotMatch(inhalt, /\b456789\b/, `Vereinskennung steht in ${datei}`);

    /* Der Feldname und der alte RPC-Parameter dagegen duerfen im
       Kommentar erklaert werden - sie sind kein Geheimnis, nur ein
       falscher Weg. Deshalb hier ohne Kommentare pruefen. */
    const code = inhalt
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
      .replace(/<!--[\s\S]*?-->/g, "");
    assert.doesNotMatch(code, /\bkennung\s*:/, `Feld "kennung" steht in ${datei}`);
    assert.doesNotMatch(code, /p_kennung/, `p_kennung wird in ${datei} benutzt`);
  }
});

// Ohne diesen Schalter haette die Freigabe keine Wirkung - und ein
// "default true" haette rueckwirkend jeden bestehenden Termin
// veroeffentlicht.
test("der Freigabeschalter für Termine ist standardmäßig aus", () => {
  const sql = migration("20260822074620_v82_termine_oeffentlich.sql");

  assert.match(
    sql,
    /add column if not exists oeffentlich boolean not null default false/
  );
  assert.doesNotMatch(sql, /default true/i);
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
