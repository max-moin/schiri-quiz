import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { istPushDienst, nachrichtFuer, vapidKonfiguration } from "../server/schiri-push.js";
import { vapidSchluesselpaarErzeugen } from "../server/webpush.js";
import testHandler from "../api/push-test.js";
import dispatchHandler from "../api/push-auftraege.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const migration = lies("supabase/migrations/20260925220500_schiri_push_antworten.sql");
const id = "11111111-1111-1111-1111-111111111111";

function antwort() {
  return { code: 0, headers: {}, setHeader(k,v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("ohne geheime Konfiguration verweigern beide Server-Endpunkte den Betrieb", async () => {
  const t = antwort();
  await testHandler({ method: "POST", body: { schiedsrichterId: id, pin: "1234", endpunkt: "https://web.push.apple.com/x" } }, t);
  assert.equal(t.code, 503);
  const d = antwort();
  await dispatchHandler({ method: "POST", headers: {} }, d);
  assert.equal(d.code, 401);
});

test("Push-URLs sind auf echte Dienste beschraenkt; keine SSRF-Adresse", () => {
  for (const gut of [
    "https://web.push.apple.com/abc", "https://fcm.googleapis.com/fcm/send/a",
    "https://updates.push.services.mozilla.com/wpush/v2/a",
  ]) assert.equal(istPushDienst(gut), true, gut);
  for (const schlecht of [
    "http://localhost/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.evil.test/a",
    "https://user:pass@web.push.apple.com/a", "https://web.push.apple.com:8443/a",
    "https://example.org/a", "javascript:alert(1)",
  ]) assert.equal(istPushDienst(schlecht), false, schlecht);
});

test("Pilotbereitschaft setzt ein gueltiges VAPID-Kontaktziel voraus", () => {
  const paar = vapidSchluesselpaarErzeugen();
  assert.equal(vapidKonfiguration({ VAPID_PRIVATER_SCHLUESSEL: paar.privat,
    VAPID_SUB: "falscher-kontakt" }), null);
  assert.ok(vapidKonfiguration({ VAPID_PRIVATER_SCHLUESSEL: paar.privat,
    VAPID_SUB: "mailto:push@example.org" }));
});

test("fachliche Nachricht hat nur neutrale Vorschau und eigenes Fragmentziel", () => {
  const payload = JSON.parse(nachrichtFuer("frage_feedback.antwort", id, `feedback_${id}`));
  assert.equal(payload.ziel, `/meine-anliegen.html#feedback=${id}`);
  assert.match(payload.text, /Fragenfeedback/);
  assert.doesNotMatch(JSON.stringify(payload), /PIN|Lösung|Antworttext|Schiedsrichter-ID/);
  assert.equal(nachrichtFuer("meldung.vorfall", id), null);
  assert.equal(nachrichtFuer("frage_feedback.antwort", "../boese"), null);
});

test("Datenbank: Opt-in default aus, PIN-Grenze, nur eigener Empfaenger", () => {
  assert.match(migration, /feedback_antwort boolean not null default false/);
  assert.match(migration, /schiedsrichter_id uuid primary key references public\.schiedsrichter\(id\) on delete cascade/);
  for (const name of ["schiri_push_einstellungen", "schiri_push_feedback_setzen", "schiri_push_geraet_entfernen"]) {
    const teil = migration.slice(migration.indexOf(`function public.${name}(`));
    assert.match(teil.split("end $function$;")[0], /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/, name);
  }
  assert.match(migration, /if v_person is null then return new/);
  assert.match(migration, /p\.schiedsrichter_id = v_person and p\.feedback_antwort/);
  assert.match(migration, /a\.empfaenger_schluessel = 's_' \|\| m\.schiedsrichter_id::text/);
  assert.doesNotMatch(migration, /insert into public\.benachrichtigungs_ereignisse[\s\S]*?rueckmeldung_obmann[^\s;]/,
    "Der Antworttext darf nicht im Versandereignis liegen");
});

test("Datenbank: Auftraege sind idempotent, verfallen und nur service_role claimt", () => {
  assert.match(migration, /on conflict\(schluessel\) do nothing/);
  assert.match(migration, /on conflict\(ereignis_id,empfaenger_schluessel,kanal\) do nothing/);
  assert.match(migration, /e\.erstellt_am < now\(\) - interval '24 hours'/);
  assert.match(migration, /for update of a skip locked/);
  assert.match(migration, /grant execute on function public\.schiri_push_auftraege_beanspruchen\(integer\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.schiri_push_auftraege_beanspruchen\(integer\) to anon/);
});

test("Service Worker oeffnet nur erlaubte Ziele, nie fremde Urspruenge", async () => {
  const handler = new Map();
  const angezeigt = [];
  const self = { addEventListener: (name, fn) => handler.set(name, fn),
    skipWaiting() {}, clients: { claim() {}, matchAll: async () => [], openWindow: async (ziel) => angezeigt.push(ziel) },
    registration: { showNotification: async (_titel, optionen) => angezeigt.push(optionen.data.ziel) } };
  vm.runInNewContext(lies("sw.js"), { self });
  const push = handler.get("push");
  const ereignis = (ziel) => ({ data: { json: () => ({ ziel }) }, waitUntil: (p) => p });
  await push(ereignis("//evil.test/"));
  await push(ereignis(`/meine-anliegen.html#feedback=${id}`));
  assert.deepEqual(angezeigt, ["/", `/meine-anliegen.html#feedback=${id}`]);
});

test("Abmelden entkoppelt Push vor dem Loeschen der PIN", async () => {
  const sitzung = new Map([["schiriQuizSession", JSON.stringify({ id, pin: "1234", name: "Test" })]]);
  const geloescht = [];
  let unsubscribed = false;
  const context = {
    AbortController, setTimeout, clearTimeout,
    sessionStorage: { getItem: (k) => sitzung.get(k) ?? null,
      setItem: (k,v) => sitzung.set(k,v), removeItem: (k) => { geloescht.push(k); sitzung.delete(k); } },
    localStorage: { getItem: () => null, removeItem: () => {} },
    navigator: { serviceWorker: { getRegistration: async () => ({
      pushManager: { getSubscription: async () => ({ endpoint: "https://web.push.apple.com/a",
        unsubscribe: async () => { unsubscribed = true; return true; } }) },
    }) } },
    fetch: async (_url, optionen) => {
      assert.equal(JSON.parse(optionen.body).p_schiedsrichter_id, id);
      assert.equal(sitzung.has("schiriQuizSession"), true);
      return { ok: true, json: async () => ({ geloescht: true }) };
    },
  };
  vm.runInNewContext(lies("src/core/anmeldung.js"), context);
  const anmeldung = context.SchiriAnmeldung.erstelleAnmeldung({ adresse: "https://db.example", oeffentlicherSchluessel: "pub" });
  await anmeldung.abmelden();
  assert.equal(unsubscribed, true);
  assert.equal(sitzung.has("schiriQuizSession"), false);
  assert.ok(geloescht.includes("schiriQuizSession"));
});
