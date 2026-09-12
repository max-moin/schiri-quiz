// Benachrichtigungen: die Zusagen, die man spaeter nicht mehr sieht.
//
// Ein Service Worker ist das schaerfste Werkzeug im Browser. Diese
// Tests halten die drei Entscheidungen fest, die ihn hier harmlos
// machen - und die beim naechsten "ich baue schnell Offline-Betrieb
// ein" still verschwinden wuerden.

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const ohneKommentare = (js) => js
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").filter((z) => !z.trimStart().startsWith("//")).join("\n");

test("der Service Worker faengt KEINE Anfragen ab", () => {
  // Der ganze Grund, warum er zwei Tage vor dem Start ueberhaupt
  // gebaut werden durfte: ohne fetch-Zuhoerer ist er fuer das Laden
  // der Seite unsichtbar. Mit einem waere er eine Auslieferungsschicht,
  // die bei einem Fehler wochenlang alte Staende festhaelt.
  const sw = ohneKommentare(lies("sw.js"));
  assert.doesNotMatch(sw, /addEventListener\(\s*["']fetch["']/,
    "sw.js faengt jetzt Anfragen ab - dann ist es kein reiner Benachrichtigungs-Worker mehr");
  assert.doesNotMatch(sw, /caches\./, "sw.js legt jetzt einen Zwischenspeicher an");
  assert.match(sw, /addEventListener\(\s*["']push["']/);
  assert.match(sw, /addEventListener\(\s*["']notificationclick["']/);
});

test("nichts wird beim Laden der Seite registriert oder abonniert", () => {
  // Wer den Schalter nie anfasst, bekommt keinen Service Worker und
  // keine Erlaubnisabfrage. Registriert wird erst in "einschalten".
  const js = ohneKommentare(lies("src/features/push-anmeldung.js"));

  // Registriert wird an genau EINER Stelle, in workerBereit - und die
  // wird nur aus einschalten heraus gerufen. Nicht die Reihenfolge im
  // Text zaehlt (Funktionen werden hochgezogen), sondern wer ruft.
  assert.equal((js.match(/serviceWorker\.register/g) || []).length, 1,
    "es gibt mehr als eine Stelle, die den Worker registriert");
  const bereit = js.slice(js.indexOf("async function workerBereit"));
  assert.match(bereit.slice(0, 400), /serviceWorker\.register/,
    "register steht nicht mehr in workerBereit");
  const rufer = [...js.matchAll(/await workerBereit\(\)/g)];
  assert.equal(rufer.length, 1, "workerBereit wird an mehreren Stellen gerufen");
  const einschaltenAb = js.indexOf("export async function einschalten");
  assert.ok(einschaltenAb > -1 && rufer[0].index > einschaltenAb,
    "workerBereit wird ausserhalb von einschalten gerufen");

  // Die Erlaubnisabfrage ebenso: genau einmal, und in einschalten.
  const fragen = [...js.matchAll(/requestPermission\(\)/g)];
  assert.equal(fragen.length, 1, "die Erlaubnis wird an mehreren Stellen gefragt");
  assert.ok(fragen[0].index > einschaltenAb,
    "die Erlaubnis wird gefragt, bevor jemand den Schalter anfasst");

  // Und beim Seitenaufbau passiert nichts davon.
  assert.doesNotMatch(ohneKommentare(lies("seite.js")), /serviceWorker|requestPermission/);
});

test("jede Zustellung wird sichtbar - sonst entzieht iOS die Erlaubnis", () => {
  const js = lies("src/features/push-anmeldung.js");
  assert.match(js, /userVisibleOnly:\s*true/);
  assert.match(ohneKommentare(lies("sw.js")), /showNotification/);
});

test("ohne hinterlegten Schluessel gibt es den Schalter gar nicht", () => {
  // Das ist die Sperre vor dem Start am 14.09. Bewusst kein zweites
  // Ja/Nein-Feld: ohne Absender kein Schalter.
  const config = lies("verein.config.js");
  assert.match(config, /push:\s*\{\s*oeffentlicherSchluessel:\s*""/,
    "in verein.config.js steht jetzt ein Schluessel - dann ist der Schalter oeffentlich sichtbar");
  const schalter = lies("src/website/push-schalter.js");
  assert.match(schalter, /if \(!halter \|\| !SCHLUESSEL\) return null;/,
    "der Schalter baut sich jetzt auch ohne Schluessel auf");
  assert.match(lies("installieren.html"), /id="push-schalter"[^>]*hidden/,
    "der Abschnitt ist im HTML nicht mehr versteckt");
});

test("der PRIVATE VAPID-Schluessel steht nirgends im Browser-Code", () => {
  // verein.config.js wird an jeden Besucher ausgeliefert.
  for (const datei of ["verein.config.js", "src/website/push-schalter.js",
                       "src/features/push-anmeldung.js", "sw.js", "config.js"]) {
    const inhalt = lies(datei);
    assert.doesNotMatch(inhalt, /VAPID_PRIVATER_SCHLUESSEL\s*[:=]\s*["'][^"']+["']/,
      datei + " enthaelt einen privaten Schluessel");
    assert.doesNotMatch(inhalt, /PUSH_SENDE_SCHLUESSEL/,
      datei + " nennt das Sendegeheimnis");
  }
});

test("die Versand-RPCs sind fuer den Browser tabu", () => {
  // "push_abos_holen" gibt die Push-Adressen ALLER Mitglieder heraus.
  // Sie darf nur der Serverschluessel aufrufen - im Browser-Code darf
  // der Name deshalb gar nicht erst vorkommen.
  for (const datei of ["src/website/push-schalter.js", "src/features/push-anmeldung.js", "sw.js"]) {
    assert.doesNotMatch(lies(datei), /push_abos_holen|push_abo_entfernen/,
      datei + " ruft eine Versandfunktion auf");
  }
  const migration = lies("supabase/migrations/20260912120000_v136_push_abos.sql");
  assert.match(migration, /grant execute on function public\.push_abos_holen\(boolean, uuid\[\]\) to service_role;/);
  assert.doesNotMatch(migration, /grant execute on function public\.push_abos_holen[^;]*to anon/);
  assert.doesNotMatch(migration, /grant execute on function public\.push_abo_entfernen[^;]*to anon/);
  // Und die Tabelle selbst bleibt gesperrt.
  assert.match(migration, /alter table public\.push_abos enable row level security;/);
  assert.doesNotMatch(migration, /create policy/i);
});

test("der Sende-Endpunkt ist nicht oeffentlich", () => {
  const api = lies("api/push-senden.js");
  assert.match(api, /timingSafeEqual/, "der Schluessel wird nicht zeitkonstant verglichen");
  assert.match(api, /PUSH_SENDE_SCHLUESSEL/);
});

test("das Symbol zeigt auf eine Datei, die es gibt", () => {
  // Ein Verweis ins Leere faellt erst auf, wenn die erste Mitteilung
  // auf einem Android-Geraet ohne Symbol ankommt.
  const sw = lies("sw.js");
  for (const treffer of sw.matchAll(/(?:icon|badge):\s*"([^"]+)"/g)) {
    const pfad = treffer[1].replace(/^\//, "");
    assert.ok(existsSync(new URL("../" + pfad, import.meta.url)),
      `sw.js verweist auf ${treffer[1]}, das es nicht gibt`);
  }
});
