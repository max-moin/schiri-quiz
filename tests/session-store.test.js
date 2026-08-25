import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const quelltext = readFileSync(new URL("../src/core/session-store.js", import.meta.url), "utf8");

function ladeModul({ wirfFehler = false } = {}) {
  const daten = new Map();
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
  const kontext = { sessionStorage };
  kontext.globalThis = kontext;
  vm.runInNewContext(quelltext, kontext);
  return { ...kontext.SchiriQuizSessionStore, daten };
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
