import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { erinnerungsHinweis } from "../src/website/termin-erinnerungen.js";
import { vapidSchluesselpaarErzeugen } from "../server/webpush.js";
import bereitschaft from "../api/push-bereitschaft.js";

test("Terminhinweise behaupten weder Freigabe noch Zusage; persönliche Abwahl hat Vorrang", () => {
  const t = { ausgewaehlt: true, erinnerung_modus: "beide", berechtigt: true };
  assert.match(erinnerungsHinweis(t, true), /18:00.*09:00/);
  assert.match(erinnerungsHinweis(t, false), /noch ausgeschaltet/);
  assert.match(erinnerungsHinweis({ ...t, erinnerung_modus: "aus" }, true), /Obmann/);
  assert.match(erinnerungsHinweis({ ...t, berechtigt: false }, true), /Zusage/);
  assert.match(erinnerungsHinweis({ ...t, ausgewaehlt: false }, true), /Für dich ausgeschaltet/);
});

test("Allgemeine Gerätefreigabe erzwingt PIN und schaltet den Dispatcher nicht frei", async () => {
  const alt = { ...process.env }; const fetchAlt = globalThis.fetch;
  const paar = vapidSchluesselpaarErzeugen();
  const res = () => ({ code: 0, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
  try {
    Object.assign(process.env, { PUSH_ANMELDUNG_AKTIV: "true", PUSH_TEST_AKTIV: "false", PUSH_DISPATCH_AKTIV: "false",
      VAPID_PRIVATER_SCHLUESSEL: paar.privat, VAPID_OEFFENTLICHER_SCHLUESSEL: paar.oeffentlich,
      VAPID_SUB: "mailto:push@example.org", SUPABASE_SECRET_KEY: "test-secret" });
    const req = { method: "POST", body: { schiedsrichterId: "11111111-1111-1111-1111-111111111111", pin: "test" } };
    let aufrufe = 0;
    globalThis.fetch = async (url) => { aufrufe++; assert.match(String(url), /schiri_push_einstellungen/); return new Response("{}", { status: 200 }); };
    const gut = res(); await bereitschaft(req, gut);
    assert.equal(gut.code, 200); assert.equal(gut.body.modus, "einrichtung");
    assert.equal(gut.body.bereit, true); assert.equal(aufrufe, 1);
    globalThis.fetch = async () => new Response("{}", { status: 400 });
    const falsch = res(); await bereitschaft(req, falsch); assert.equal(falsch.code, 403);
  } finally {
    globalThis.fetch = fetchAlt;
    for (const k of Object.keys(process.env)) if (!(k in alt)) delete process.env[k];
    Object.assign(process.env, alt);
  }
});

test("Ein gemeinsamer persönlicher Terminbaustein, keine doppelte Erklärung oder Breadcrumbs", () => {
  const lies = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
  assert.match(lies("mitteilungen.html"), /data-wegweiser="kompakt"/);
  assert.doesNotMatch(lies("mitteilungen.html"), /Wofür Hinweise gedacht sind/);
  assert.match(lies("mitteilungen.html"), /Auswahl speichern/);
  for (const p of ["src/website/mitteilungen-steuerung.js", "src/website/termine-seite.js"]) {
    assert.match(lies(p), /montiereTerminerinnerungen/);
  }
});

test("Icon-Abgabe erklärt offene Pflichtfelder statt stumm zu blockieren", () => {
  const code = readFileSync(new URL("../src/features/decision-answers.js", import.meta.url), "utf8");
  assert.match(code, /Noch nicht abgeschickt:/);
  assert.match(code, /fehlendeAngaben\(wahl, frage\)\.map/);
});
