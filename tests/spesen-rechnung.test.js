import assert from "node:assert/strict";
import test from "node:test";

import {
  aufCent,
  landFahrtkosten,
  leseZahl,
  plzZustand,
  spielEntschaedigung,
  stadtFahrtkosten,
  turnierEntschaedigung,
} from "../src/website/spesen-rechnung.js";

/* Diese Datei bewacht die Betraege, die am Ende auf einer Quittung
   stehen und von Hand nachgerechnet werden. Jeder Fall hier ist einer,
   der in der Oberflaeche schon einmal falsch war oder in dem der
   Rechner still eine Annahme trifft, ohne sie hinzuschreiben. */

const STADT = { preisJeKarte: 3.60, kartenJeZone: 2 };
const LAND = { monatskartePauschale: 3.50, kmAuto: 0.35, kmZuschlagMitnahme: 0.04, kmFahrrad: 0.10 };
const TURNIER = { grundpauschale: 32, grundstunden: 4, jeWeitereStunde: 8 };
const STADTKLASSE = { voll: "Stadtklassen Herren", verband: "svfd", sr: 25, sra: 20 };
const LANDESLIGA = { voll: "Landesliga Herren", verband: "sfv", sr: 55, sra: 45 };

test("leseZahl versteht, wie Leute Betraege eintippen", () => {
  assert.equal(leseZahl("12,50"), 12.5);
  assert.equal(leseZahl("12.50"), 12.5);
  assert.equal(leseZahl("1.234,56"), 1234.56);
  assert.equal(leseZahl("12,40 €"), 12.4);
  assert.equal(leseZahl(",5"), 0.5);
});

test("leseZahl meldet Unlesbares als null statt als 0", () => {
  // Der Unterschied traegt die ganze Quittung: 0 ist ein Betrag,
  // null heisst "hier fehlt noch etwas".
  assert.equal(leseZahl(""), null);
  assert.equal(leseZahl("   "), null);
  assert.equal(leseZahl("12,,00"), null);   // Zwischenstand beim Tippen
  assert.equal(leseZahl("-5"), null);
  assert.equal(leseZahl("1e3"), null);      // Number() haette 1000 gesagt
  assert.equal(leseZahl("Infinity"), null);
});

test("aufCent rundet vor dem Summieren", () => {
  // 0,35 €/km x 48,5 km = 16,975. Ungerundet summiert stand darunter
  // ein Gesamtbetrag, der um einen Cent danebenlag.
  assert.equal(aufCent(16.975), 16.98);
  assert.equal(aufCent(0.1 + 0.2), 0.3);
});

test("plzZustand trennt 'auswaerts' von 'gar keine brauchbare Zahl'", () => {
  assert.equal(plzZustand("01067"), "dresden");   // untere Grenze
  assert.equal(plzZustand("01329"), "dresden");   // obere Grenze
  assert.equal(plzZustand(" 01159 "), "dresden");
  assert.equal(plzZustand("01066"), "auswaerts");
  assert.equal(plzZustand("01330"), "auswaerts");
  assert.equal(plzZustand("01445"), "auswaerts"); // Radebeul
  assert.equal(plzZustand(""), "leer");
  assert.equal(plzZustand("0115"), "ungueltig");  // noch im Tippen
  assert.equal(plzZustand("abcde"), "ungueltig");
});

test("Stadtebene: eine Zone kostet zwei Karten, zwei Zonen vier", () => {
  // Max, zweimal bestaetigt: "es sind einfach viermal 3,60".
  const inDresden = stadtFahrtkosten({ plz: "01159", lage: "dd", saetze: STADT });
  assert.equal(inDresden.betrag, 7.20);
  assert.equal(inDresden.unsicher, false);

  const auswaerts = stadtFahrtkosten({ plz: "01159", lage: "aus", saetze: STADT });
  assert.equal(auswaerts.betrag, 14.40);
  assert.equal(auswaerts.unsicher, false);
});

test("eine halbe Postleitzahl verdoppelt die Fahrtkosten nicht mehr stillschweigend", () => {
  // Der Fall tritt bei jedem auf, der die Vorbelegung loescht, um seine
  // eigene einzutragen: nach zwei Ziffern galt er als auswaertig.
  const halb = stadtFahrtkosten({ plz: "0115", lage: "dd", saetze: STADT });
  assert.equal(halb.betrag, 14.40);
  assert.equal(halb.unsicher, true);
  assert.match(halb.text, /Postleitzahl unvollständig/);

  const leer = stadtFahrtkosten({ plz: "", lage: "dd", saetze: STADT });
  assert.equal(leer.unsicher, true);
  assert.match(leer.text, /ohne Postleitzahl/);
});

test("ein eingetippter, aber unbekannter Verein macht die Zeile unsicher", () => {
  // Ohne Treffer wird mit einem Spielort in Dresden gerechnet - das ist
  // die Haelfte des Betrags, falls der Verein auswaerts spielt.
  const unbekannt = stadtFahrtkosten({
    plz: "01159", lage: null, vereinEingetippt: true, saetze: STADT,
  });
  assert.equal(unbekannt.betrag, 7.20);
  assert.equal(unbekannt.unsicher, true);
  assert.match(unbekannt.text, /nicht in der Liste/);

  // Gar nichts eingetippt ist dagegen eine bewusste Voreinstellung.
  const leerFeld = stadtFahrtkosten({ plz: "01159", lage: null, saetze: STADT });
  assert.equal(leerFeld.unsicher, false);
});

test("ein Spielort mit ungepruefter Zone bleibt als ungeprueft gekennzeichnet", () => {
  const frag = stadtFahrtkosten({ plz: "01159", lage: "frag", saetze: STADT });
  assert.equal(frag.betrag, 14.40);
  assert.equal(frag.unsicher, true);
});

test("Landesebene: Pauschale gilt je Einsatz, nicht je Richtung", () => {
  const karte = landFahrtkosten({ art: "karte", saetze: LAND });
  assert.equal(karte.betrag, 3.50);
  assert.equal(karte.unsicher, false);
});

test("Landesebene: Kilometer sind die Gesamtstrecke und werden nicht verdoppelt", () => {
  assert.equal(landFahrtkosten({ art: "auto", kmRoh: "48,5", saetze: LAND }).betrag, 16.98);
  assert.equal(landFahrtkosten({ art: "auto", kmRoh: "48,5", mitnahme: true, saetze: LAND }).betrag, 18.92);
  assert.equal(landFahrtkosten({ art: "rad", kmRoh: "20", saetze: LAND }).betrag, 2.00);
});

test("Landesebene: fehlende Angaben ergeben 0 und eine sichtbare Luecke", () => {
  const ohneKm = landFahrtkosten({ art: "auto", kmRoh: "", saetze: LAND });
  assert.equal(ohneKm.betrag, 0);
  assert.equal(ohneKm.unsicher, true);

  const krummerKm = landFahrtkosten({ art: "auto", kmRoh: "achtzig", saetze: LAND });
  assert.equal(krummerKm.unsicher, true);
  assert.match(krummerKm.text, /nicht lesbar/);

  const ohneBeleg = landFahrtkosten({ art: "ticket", ticketRoh: "", saetze: LAND });
  assert.equal(ohneBeleg.betrag, 0);
  assert.equal(ohneBeleg.unsicher, true);

  assert.equal(landFahrtkosten({ art: "ticket", ticketRoh: "12,40 €", saetze: LAND }).betrag, 12.40);
});

test("Turnier: 32 € fuer vier Stunden, danach 8 € je angefangene Stunde", () => {
  assert.equal(turnierEntschaedigung({ stundenRoh: "4", turnier: TURNIER }).betrag, 32);
  assert.equal(turnierEntschaedigung({ stundenRoh: "2", turnier: TURNIER }).betrag, 32);
  assert.equal(turnierEntschaedigung({ stundenRoh: "6", turnier: TURNIER }).betrag, 48);
  // "angefangene" Stunde: 4,5 Stunden sind bereits die fuenfte.
  assert.equal(turnierEntschaedigung({ stundenRoh: "4,5", turnier: TURNIER }).betrag, 40);
});

test("Turnier ohne Dauer rechnet nicht heimlich mit vier Stunden weiter", () => {
  const leer = turnierEntschaedigung({ stundenRoh: "", turnier: TURNIER });
  assert.equal(leer.betrag, 32);
  assert.equal(leer.unsicher, true);
  assert.match(leer.text, /Dauer noch eintragen/);
});

test("Turniersaetze des Stadtverbands gelten auf Landesebene als ungeprueft", () => {
  const land = turnierEntschaedigung({ stundenRoh: "4", turnier: TURNIER, aufLandesverband: true });
  assert.equal(land.unsicher, true);
  assert.match(land.text, /ungeprüft/);
});

test("Spielausfall halbiert die Entschaedigung", () => {
  const aus = spielEntschaedigung({ liga: LANDESLIGA, ausgefallen: true, ausfallAnteil: 0.5 });
  assert.equal(aus.betrag, 27.50);
  assert.match(aus.text, /50 % von 55,00 €/);
  assert.equal(aus.unsicher, false);   // Landesebene: die Regel steht dort
});

test("die Ausfallregel ist fuer reine Stadtspiele nicht belegt", () => {
  const stadt = spielEntschaedigung({ liga: STADTKLASSE, ausgefallen: true, ausfallAnteil: 0.5 });
  assert.equal(stadt.betrag, 12.50);
  assert.equal(stadt.unsicher, true);
});

test("der Prozentsatz im Text folgt dem eingestellten Anteil", () => {
  // Vorher stand dort fest "50 %", waehrend der Anteil aus der
  // veroeffentlichten Konfiguration kam - der Text konnte also luegen.
  const text = spielEntschaedigung({ liga: LANDESLIGA, ausgefallen: true, ausfallAnteil: 0.25 }).text;
  assert.match(text, /25 % von 55,00 €/);
});

test("Assistentensatz und fehlender Satz werden auseinandergehalten", () => {
  assert.equal(spielEntschaedigung({ liga: STADTKLASSE, alsAssistent: true, ausfallAnteil: 0.5 }).betrag, 20);

  // sra: null heisst "hier gibt es keine Assistenten". Frueher waere
  // daraus mitten im Aufbau der Quittung ein Abbruch geworden.
  const ohneAssistenten = { voll: "Sonstige Junioren", verband: "svfd", sr: 17, sra: null };
  const leer = spielEntschaedigung({ liga: ohneAssistenten, alsAssistent: true, ausfallAnteil: 0.5 });
  assert.equal(leer.betrag, 0);
  assert.equal(leer.unsicher, true);
});
