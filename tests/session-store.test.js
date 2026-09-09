import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const quelltext = readFileSync(new URL("../src/core/session-store.js", import.meta.url), "utf8");

function ladeModul({ wirfFehler = false } = {}) {
  const daten = new Map();
  const dauerhaft = new Map();
  const sessionStorage = {
    setItem(schluessel, wert) {
      if (wirfFehler) throw new Error("gesperrt");
      daten.set(schluessel, String(wert));
    },
    getItem(schluessel) {
      if (wirfFehler) throw new Error("gesperrt");
      return daten.has(schluessel) ? daten.get(schluessel) : null;
    },
    removeItem(schluessel) {
      if (wirfFehler) throw new Error("gesperrt");
      daten.delete(schluessel);
    },
  };
  const localStorage = {
    setItem: (schluessel, wert) => dauerhaft.set(schluessel, String(wert)),
    getItem: (schluessel) => dauerhaft.has(schluessel) ? dauerhaft.get(schluessel) : null,
    removeItem: (schluessel) => dauerhaft.delete(schluessel),
  };
  const kontext = { sessionStorage, localStorage };
  kontext.globalThis = kontext;
  vm.runInNewContext(quelltext, kontext);
  return { ...kontext.SchiriQuizSessionStore, daten, dauerhaft };
}

test("Sessionwerte werden als JSON gespeichert, gelesen und gelöscht", () => {
  const { erstelleSessionSpeicher, daten } = ladeModul();
  const speicher = erstelleSessionSpeicher("mitglied");
  assert.equal(speicher.speichern({ id: 7, name: "Max" }), true);
  assert.deepEqual({ ...speicher.lesen() }, { id: 7, name: "Max" });
  speicher.loeschen();
  assert.equal(speicher.lesen(), null);
  assert.equal(daten.size, 0);
});

test("ein ausdrücklich gemerktes Gerät bleibt höchstens 30 Tage angemeldet", () => {
  const { erstelleSessionSpeicher, daten, dauerhaft } = ladeModul();
  const speicher = erstelleSessionSpeicher("mitglied", {
    dauerhafterSchluessel: "geraet",
    gueltigkeitMs: 1000,
  });
  speicher.speichern({ id: 7, pin: "1234" }, { dauerhaft: true });
  daten.clear();
  assert.deepEqual({ ...speicher.lesen() }, { id: 7, pin: "1234" });
  assert.ok(daten.has("mitglied"), "wiederhergestellter Zugang fehlt in der laufenden Sitzung");

  const paket = JSON.parse(dauerhaft.get("geraet"));
  paket.gueltigBis = Date.now() - 1;
  dauerhaft.set("geraet", JSON.stringify(paket));
  daten.clear();
  assert.equal(speicher.lesen(), null);
  assert.equal(dauerhaft.has("geraet"), false);
});

test("Abmelden entfernt Sitzung und gemerktes Gerät gemeinsam", () => {
  const { erstelleSessionSpeicher, dauerhaft } = ladeModul();
  const speicher = erstelleSessionSpeicher("mitglied", { dauerhafterSchluessel: "geraet" });
  speicher.speichern({ id: 7, pin: "1234" }, { dauerhaft: true });
  assert.ok(dauerhaft.has("geraet"));
  speicher.loeschen();
  assert.equal(speicher.lesen(), null);
  assert.equal(dauerhaft.has("geraet"), false);
});

test("alte unkodierte Vereinskennungen bleiben lesbar", () => {
  const { erstelleSessionSpeicher, daten } = ladeModul();
  daten.set("kennung", "vereinsname");
  assert.equal(erstelleSessionSpeicher("kennung", { altesRohformatLesen: true }).lesen(), "vereinsname");
  assert.equal(erstelleSessionSpeicher("kennung").lesen(), null);
});

test("gesperrter sessionStorage legt das Quiz nicht lahm", () => {
  const { erstelleSessionSpeicher } = ladeModul({ wirfFehler: true });
  const speicher = erstelleSessionSpeicher("mitglied");
  assert.equal(speicher.speichern({ id: 1 }), false);
  assert.equal(speicher.lesen(), null);
  assert.doesNotThrow(() => speicher.loeschen());
});
