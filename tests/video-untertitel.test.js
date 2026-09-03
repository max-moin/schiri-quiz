import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* ============================================================
   Keine Untertitel im Video-Player (02.09.2026)
   ============================================================
   Max: "im videoplayer den untertitel nicht anzeigen zu lassen, auch wenn
   kein ton kommt".

   Warum das mehr als Kosmetik ist: Video-Fragen laufen oft stumm, damit der
   Kommentar die Loesung nicht verraet. Genau bei stummen Videos schaltet
   YouTube automatische Untertitel zu - und dann steht der Kommentar als Text
   im Bild. Die Schutzmassnahme kehrt sich also um, wenn niemand hinschaut.

   Ein kaputter Schalter faellt hier nicht auf: Das Video laeuft weiter, die
   Frage laesst sich beantworten, nur die Antwort steht mit im Bild. Deshalb
   diese Tests.
   ============================================================ */

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const ohneJsKommentare = (js) =>
  js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// video-player.js fasst beim Laden "document" an (Overlay-Init). Ein
// minimaler Ersatz genuegt: Der Init-Block steigt aus, wenn kein Overlay da
// ist. Damit laesst sich das Modul ohne Browser laden.
globalThis.document = {
  getElementById: () => null,
  addEventListener: () => {},
  createElement: () => ({
    setAttribute() {}, addEventListener() {}, append() {}, appendChild() {},
    replaceChildren() {}, classList: { toggle() {}, add() {}, remove() {} }, style: {},
  }),
};
globalThis.window = { setTimeout: () => 0, clearTimeout: () => {}, location: { protocol: "https:", origin: "https://x" } };
globalThis.SchiriQuizUtils = { extrahiereYoutubeId: () => "abc" };

await import("../src/features/video-player.js");
const { unterdrueckeUntertitel } = globalThis.SchiriQuizVideoPlayer;

function bauePlayerAttrappe({ unloadWirft = false, ohneSetOption = false } = {}) {
  const protokoll = { entladen: [], optionen: [] };
  const player = {
    unloadModule(modul) {
      protokoll.entladen.push(modul);
      if (unloadWirft) throw new Error("Modul nicht geladen");
    },
  };
  if (!ohneSetOption) {
    player.setOption = (modul, name, wert) => protokoll.optionen.push([modul, name, wert]);
  }
  return { player, protokoll };
}

test("beide Modulnamen werden entladen - captions UND cc", () => {
  const { player, protokoll } = bauePlayerAttrappe();
  assert.equal(unterdrueckeUntertitel(player), true);
  // Der Modulname unterscheidet sich je nach Player-Generation. Nur einen zu
  // entladen liesse die andere Haelfte der Geraete mit Untertiteln zurueck.
  assert.deepEqual(protokoll.entladen, ["captions", "cc"]);
});

test("zusaetzlich wird die Untertitelspur ausdruecklich geleert", () => {
  const { player, protokoll } = bauePlayerAttrappe();
  unterdrueckeUntertitel(player);
  assert.deepEqual(protokoll.optionen, [["captions", "track", {}]]);
});

test("ein werfendes unloadModule bricht nichts ab", () => {
  // Ein nicht geladenes Modul zu entladen wirft - das ist der Normalfall,
  // wenn der Nutzer gar keine Untertitel an hat. Wuerde der Fehler
  // durchschlagen, riesse er die Wiedergabe mit.
  const { player, protokoll } = bauePlayerAttrappe({ unloadWirft: true });
  assert.doesNotThrow(() => unterdrueckeUntertitel(player));
  assert.deepEqual(protokoll.entladen, ["captions", "cc"], "nach dem ersten Fehler wird weitergemacht");
  assert.deepEqual(protokoll.optionen, [["captions", "track", {}]], "und der zweite Weg wird trotzdem versucht");
});

test("ein Player ohne die erwarteten Methoden fuehrt nicht zum Absturz", () => {
  assert.equal(unterdrueckeUntertitel(null), false);
  assert.equal(unterdrueckeUntertitel({}), false);
  const { player } = bauePlayerAttrappe({ ohneSetOption: true });
  assert.equal(unterdrueckeUntertitel(player), true);
});

test("die Unterdrueckung haengt an onReady UND am Abspielstart", () => {
  const quelle = ohneJsKommentare(lies("src/features/video-player.js"));

  // Nur bei onReady zu entladen genuegt nicht: YouTube laedt das Modul beim
  // tatsaechlichen Abspielstart teilweise neu. Faellt einer der beiden
  // Aufrufe weg, sieht man im Test nichts und im Video die Untertitel.
  const onReadyBlock = quelle.slice(quelle.indexOf("onReady:"), quelle.indexOf("onAutoplayBlocked:"));
  assert.match(onReadyBlock, /unterdrueckeUntertitel\(/, "onReady unterdrueckt nicht");
  assert.match(onReadyBlock, /ziehUntertitelUnterdrueckungNach\(/, "onReady zieht nicht nach");

  const synchronisiere = quelle.slice(quelle.indexOf("function synchronisiereZustand"));
  const beimAbspielen = synchronisiere.slice(0, synchronisiere.indexOf("BUFFERING"));
  assert.match(beimAbspielen, /ziehUntertitelUnterdrueckungNach\(/, "beim Abspielstart wird nicht nachgezogen");
  assert.match(beimAbspielen, /untertitelBeimAbspielenNachgezogen/, "fehlende Einmal-Sperre: liefe 5x pro Sekunde");
});

test("die Nachzieh-Zeitgeber werden beim Aufraeumen gestoppt", () => {
  const quelle = ohneJsKommentare(lies("src/features/video-player.js"));
  const stoppe = quelle.slice(quelle.indexOf("function stoppeIntervall"), quelle.indexOf("function raeumePlayerAuf"));
  // Sonst laeuft ein Zeitgeber auf einen zerstoerten Player.
  assert.match(stoppe, /untertitelZeitgeber\.splice\(0\)/);
  assert.match(stoppe, /clearTimeout/);
});

test("cc_load_policy steht auf 0 und wird nicht auf 1 gesetzt", () => {
  const quelle = ohneJsKommentare(lies("src/features/video-player.js"));
  assert.match(quelle, /cc_load_policy:\s*0/);
  assert.doesNotMatch(quelle, /cc_load_policy:\s*1/, "1 wuerde Untertitel erzwingen");
});
