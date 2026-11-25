import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { terminKarte, terminAlsKalenderdatei, verbindeTerminSichten } from "../src/website/termine.js";
import { erstelleTerminstatusEditor } from "../src/admin/terminstatus-editor.js";

const basis={id:"test-treff",titel:"Schiri-Treff",datum:"2026-12-14",beginn_zeit:"18:00:00",art:"treff",
  pflicht:true,laeuft:true,rueckmeldung_erforderlich:true,mein_status:"zu"};
const abgesagt={...basis,abgesagt_am:"2026-11-25T10:00:00Z"};
test("Organisationsabsage bleibt mit Datum und Link sichtbar und verdrängt den Teilnahmestand",()=>{
  const html=terminKarte(abgesagt);
  assert.match(html, /Abgesagt/);
  assert.match(html, /Schiri-Treff/);
  assert.match(html, /14.12./);
  assert.match(html, /termine.html\?termin=test-treff/);
  assert.doesNotMatch(html, /Pflicht|Läuft gerade|Du bist dabei/);
  assert.match(terminKarte(basis), /Du bist dabei/);
});
test("Öffentlich bekannter Absagestatus hat Vorrang vor einer veralteten persönlichen Sicht",()=>{
  assert.equal(verbindeTerminSichten([abgesagt],[basis])[0].abgesagt_am,abgesagt.abgesagt_am);
});
test("Kalenderdatei hält die Termin-ID, verwendet aber keinen aktiven Status",()=>{
  assert.match(terminAlsKalenderdatei(abgesagt), /UID:test-treff@/);
  assert.match(terminAlsKalenderdatei(abgesagt), /STATUS:CANCELLED/);
  assert.doesNotMatch(terminAlsKalenderdatei(basis), /CANCELLED/);
});
test("Detail und Redaktion trennen Terminabsage von Teilnehmeraktionen",()=>{
  const lies=p=>readFileSync(new URL(p,import.meta.url),"utf8");
  assert.match(lies("../obmann.html"), /data-admin-unterbereich="feste-termine"/);
  const editor=lies("../src/admin/terminstatus-editor.js");
  assert.match(editor,/data-status-bestaetigen/);
  assert.match(editor,/client\.rpc\("website_terminstatus"/);
  assert.doesNotMatch(editor,/termin_loeschen|\.delete\(/);
  const detail=lies("../src/website/termine-seite.js");
  assert.match(detail,/!gestrichen && termin\.rueckmeldung_erforderlich === true/);
  assert.match(detail,/!gestrichen \? `<button[^>]*data-kalender/);
});

test("Web-Editor speichert erst nach ausdrücklicher Bestätigung", async () => {
  const events = new Map(), calls = [];
  const wurzel = {
    innerHTML: "",
    addEventListener: (name, cb) => events.set(name, cb),
    querySelector: () => null,
  };
  const client = { rpc: async (name, args) => {
    calls.push([name, args]);
    return { data: [args.p_absagen ? abgesagt : basis] };
  } };
  const click = key => events.get("click")({target: {
    closest: () => ({hasAttribute: name => name === "data-status-" + key}),
  }});
  const tick = () => new Promise(resolve => setImmediate(resolve));
  erstelleTerminstatusEditor({wurzel, client, verein:{seitenschluessel:"test"}});
  click("laden"); await tick();
  events.get("change")({target:{matches: () => true, value:basis.id}});
  click("absagen");
  assert.match(wurzel.innerHTML, /Schiri-Treff.*14\.12.*18:00 Uhr.*wirklich absagen/);
  click("zurueck"); click("bestaetigen");
  assert.equal(calls.length, 1);
  click("absagen"); click("bestaetigen"); await tick();
  assert.deepEqual(calls[1], ["website_terminstatus",{p_seitenschluessel:"test",p_absagen:basis.id}]);
  assert.match(wurzel.innerHTML, /Abgesagt/);
  assert.doesNotMatch(wurzel.innerHTML, /data-status-bestaetigen/);
});
