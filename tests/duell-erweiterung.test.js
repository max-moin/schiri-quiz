// Tests fuer den Duell-Umbau vom 05.09.2026 (Vergleich, Auswertung,
// Nachbessern, Reaktionen-Gimmick). tests/duell-modus.test.js bleibt
// unangetastet und prueft weiterhin die Grundregeln der ersten Fassung
// (Trennung vom Wochenquiz, PIN-Pruefung, keine Loesungen vor der
// Antwort). Diese Datei kommt fuer alles Neue dazu.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { baueNachbesserungsPrompt } from "../api/freitext-bewerten.js";
import { symbolUndKlasseFuerStatus, formatiereAntwort } from "../src/website/duell-verlauf-ansicht.js";
import { findeLetzteFremdeReaktion } from "../src/website/duell-reaktionen.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

test("baueNachbesserungsPrompt ist jetzt oeffentlich - der neue Duell-Ergänzungs-Endpunkt braucht ihn", () => {
  const prompt = baueNachbesserungsPrompt(
    { frage_text: "Wie reagierst du?", musterantwort: "Gelbe Karte.", bewertungshinweise: null, erster_freitext: "Es gibt eine Karte.", ki_nachfrage: "Welche Karte?" },
    "Gelbe Karte."
  );
  assert.match(prompt, /Erste Antwort: Es gibt eine Karte\./);
  assert.match(prompt, /Gestellte Rückfrage: Welche Karte\?/);
  assert.match(prompt, /Gegebene Antwort \(Ergänzung\): Gelbe Karte\./);
  assert.match(prompt, /"nachbessern" ist hier NICHT erlaubt/);
});

test("Statussymbole/-klassen fuer den Duell-Vergleich (richtig/nachbessern/falsch)", () => {
  assert.deepEqual(symbolUndKlasseFuerStatus("richtig"), { symbol: "✓", klasse: "richtig" });
  assert.deepEqual(symbolUndKlasseFuerStatus("nachbessern"), { symbol: "🟠", klasse: "teilweise" });
  assert.deepEqual(symbolUndKlasseFuerStatus("falsch"), { symbol: "✕", klasse: "falsch" });
});

test("formatiereAntwort liest Mehrfachauswahl-Texte und Freitext inkl. Ergänzung", () => {
  const frageMc = { antworttyp: "mehrfachauswahl", antwortoptionen: [{ schluessel: "a", text: "Gelbe Karte" }, { schluessel: "b", text: "Feldverweis" }] };
  assert.equal(formatiereAntwort(frageMc, { auswahl: ["a", "b"] }), "Gelbe Karte, Feldverweis");
  assert.equal(formatiereAntwort({ antworttyp: "freitext" }, { freitext: "Foul", zweiter_freitext: "und Gelbe Karte" }), "Foul · Ergänzung: und Gelbe Karte");
  assert.equal(formatiereAntwort({ antworttyp: "freitext" }, {}), "–");
});

test("findeLetzteFremdeReaktion nimmt nur die letzte Reaktion einer ANDEREN Person", () => {
  assert.equal(findeLetzteFremdeReaktion([{ name: "Ich", emoji: "⚽", ist_ich: true }]), null);
  assert.deepEqual(
    findeLetzteFremdeReaktion([{ name: "Lisa", emoji: "👏", ist_ich: false }, { name: "Lisa", emoji: "😂", ist_ich: false }]),
    { name: "Lisa", emoji: "😂", ist_ich: false }
  );
  assert.equal(findeLetzteFremdeReaktion(null), null);
});

test("duell-zugriff.js trennt Zeilen-Auspacken (table) von Rohwert (jsonb)", () => {
  // Ohne diese Trennung wuerde die neue Reaktionsliste (jsonb-Array statt
  // Zaehl-Objekt, Migration v120) durch dieselbe Array-Auspack-Heuristik,
  // die "duell_erstellen"/"duell_beitreten" brauchen, auf ihr erstes
  // Element zusammengestutzt.
  const zugriff = lies("src/website/duell-zugriff.js");
  assert.match(zugriff, /rufeZeile\("duell_erstellen"/);
  assert.match(zugriff, /rufeZeile\("duell_beitreten"/);
  assert.match(zugriff, /fetchRpc\("duell_reaktionen_fuer_frage"/);
  assert.match(zugriff, /fetchRpc\("duell_verlauf"/);
  assert.match(zugriff, /fetchRpc\("duell_meine_liste"/);
  assert.doesNotMatch(zugriff, /rufeZeile\("duell_verlauf"/);
  assert.doesNotMatch(zugriff, /rufeZeile\("duell_reaktionen_fuer_frage"/);
  assert.match(zugriff, /\/api\/duell-freitext-ergaenzung/);
});

test("api/duell-freitext.js erlaubt jetzt \"nachbessern\" und übergibt Status/Nachfrage an die RPC", () => {
  const quelle = lies("api/duell-freitext.js");
  assert.match(quelle, /baueErstversuchPrompt\(kontext,\s*text,\s*true\)/);
  assert.match(quelle, /p_status/);
  assert.match(quelle, /p_nachfrage/);
});

test("neuer Endpunkt für den zweiten Freitext-Versuch im Duell existiert und nutzt die passenden Bausteine", () => {
  const quelle = lies("api/duell-freitext-ergaenzung.js");
  assert.match(quelle, /baueNachbesserungsPrompt/);
  assert.match(quelle, /duell_freitext_ergaenzung_kontext/);
  assert.match(quelle, /duell_freitext_ergaenzung_speichern/);
});

test("duell-seite.js baut auf den ausgelagerten Fachmodulen auf und nutzt keine Browser-Dialoge", () => {
  const seite = lies("src/website/duell-seite.js");
  assert.match(seite, /from "\.\/duell-verlauf-ansicht\.js"/);
  assert.match(seite, /from "\.\/duell-reaktionen\.js"/);
  assert.match(seite, /schiriDuellVerlauf/);
  assert.doesNotMatch(seite, /\balert\(|\bconfirm\(|\bwindow\.prompt\(/);
});

test("die Duell-Seite lädt den Zeichenzähler-Baustein (kein hartes maxlength mehr bei Freitext)", () => {
  assert.match(lies("duell.html"), /src="src\/ui\/zeichen-zaehler\.js"/);
});

test("Emoji-Gimmick bleibt als Gimmick gekennzeichnet und beschriftet die Reaktionsknöpfe nicht mit Wörtern", () => {
  const reaktionen = lies("src/website/duell-reaktionen.js");
  assert.match(reaktionen, /Gimmick/);
  assert.doesNotMatch(reaktionen, />\s*\d+\s*<\/span>/);
});
