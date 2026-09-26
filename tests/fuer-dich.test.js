// "Für dich" auf der Startseite (26.09.2026): nur echte Aufgaben zaehlen.
import test from "node:test";
import assert from "node:assert/strict";
import { fuerDichPunkte, offeneTermine, offeneAbstimmungen } from "../src/website/fuer-dich.js";

const termin = (x) => ({ id: "t", titel: "Treff", datum: "2026-10-01", rueckmeldung_erforderlich: true,
  mein_status: null, vergangen: false, zusage_moeglich: true, ...x });

test("Termin zaehlt nur, wenn eine Zusage noch moeglich ist", () => {
  assert.equal(offeneTermine([termin({})]).length, 1);
  assert.equal(offeneTermine([termin({ mein_status: "zu" })]).length, 0);
  assert.equal(offeneTermine([termin({ vergangen: true })]).length, 0);
  assert.equal(offeneTermine([termin({ zusage_moeglich: false })]).length, 0, "Frist abgelaufen ist keine Aufgabe");
  assert.equal(offeneTermine([termin({ rueckmeldung_erforderlich: false })]).length, 0);
  assert.deepEqual(offeneTermine(null), []);
});

test("Ein Termin verlinkt direkt, mehrere auf die Liste", () => {
  const eins = fuerDichPunkte({ termine: [termin({ id: "a b" })] });
  assert.equal(eins[0].href, "termine.html?termin=a%20b");
  assert.match(eins[0].titel, /„Treff“ wartet/);
  const zwei = fuerDichPunkte({ termine: [termin({ id: "2", datum: "2026-11-01", titel: "Spaeter" }), termin({ id: "1" })] });
  assert.equal(zwei[0].href, "termine.html");
  assert.equal(zwei[0].zusatz, "Als Nächstes: Treff");
});

test("Abstimmung nur offen, in Frist und mit fehlender eigener Antwort", () => {
  const f = (x) => ({ titel: "Weihnachten", status: "offen", frist_abgelaufen: false,
    vorschlaege: [{ meine_antwort: "ja" }, { meine_antwort: null }], ...x });
  assert.equal(offeneAbstimmungen([f({})]).length, 1);
  assert.equal(offeneAbstimmungen([f({ frist_abgelaufen: true })]).length, 0);
  assert.equal(offeneAbstimmungen([f({ status: "entschieden" })]).length, 0);
  assert.equal(offeneAbstimmungen([f({ vorschlaege: [{ meine_antwort: "nein" }] })]).length, 0);
});

test("Antwort vom Obmann und leerer Stand", () => {
  assert.equal(fuerDichPunkte({ neueAntworten: 2 })[0].href, "meine-anliegen.html");
  assert.deepEqual(fuerDichPunkte({ termine: [], findungen: [], neueAntworten: 0 }), []);
  assert.deepEqual(fuerDichPunkte(), []);
});
