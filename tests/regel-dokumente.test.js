// Belege an der einzelnen Regelzeile statt einer Sammelliste am Seitenende.
//
// Max am 12.09.2026: "wenn man fuer jede Ausnahmeregelung das jeweilige
// Dokument angehaengt bekommt [...] und nicht einfach nur unten dasteht:
// Okay, aus diesen allen Quellen hatte ich das zusammengesucht."
//
// Der heikle Teil ist nicht die Darstellung, sondern die Zuordnung. Ein
// falsch angehaengtes Dokument an einer Regelzeile ist schlimmer als gar
// keines: es sieht aus wie ein Beleg. Diese Tests halten fest, dass jede
// Regel in regel-dokumente.js durch die Selbstbeschreibung des Dokuments
// gedeckt ist - und dass Max' eigenes Beispiel herauskommt.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { REGELN_STANDARD, UNTERLAGEN_STANDARD } from "../src/website/content-defaults.js";
import { passendeDokumente, wirksameQuelle } from "../src/website/regel-dokumente.js";

const DOKUMENTE = UNTERLAGEN_STANDARD.dokumente;
const finde = (liste, alter, klasseTeil) =>
  liste.find((r) => r.a === alter && String(r.k).includes(klasseTeil));
const ids = (zeile, ebene) => passendeDokumente(zeile, ebene, DOKUMENTE).map((d) => d.id);

test("Max' Beispiel: C-Junioren im Stadtverband bekommen die Handreichung", () => {
  const zeile = finde(REGELN_STANDARD.svfdMeister, "C-Junioren", "9 gegen 9");
  assert.ok(zeile, "die C-Junioren-Zeile des SVFD ist nicht mehr auffindbar");
  const belege = ids(zeile, "svfd");
  assert.ok(belege.includes("dokument-2"), "die Handreichung des SVFD fehlt");
  assert.ok(belege.includes("dokument-1"), "die Kurzuebersicht als Quelle der Tabelle fehlt");
  assert.ok(belege.includes("dokument-11"), "die Kleinfeldbestimmungen fehlen");
});

test("Max' Beispiel: C-Junioren auf Landesebene bekommen die SFV-Fassung", () => {
  const zeile = finde(REGELN_STANDARD.sfvMeister, "C-Junioren", "Sachsenliga");
  assert.ok(zeile, "die C-Junioren-Zeile des SFV ist nicht mehr auffindbar");
  const belege = ids(zeile, "sfv");
  assert.ok(belege.includes("dokument-10"), "die Regelungsuebersicht Junioren fehlt");
  assert.doesNotMatch(belege.join(","), /dokument-2/,
    "die Dresdner Handreichung gehoert nicht an eine Landeszeile");
});

test("eine Zeile, die selbst auf die Landesebene zeigt, bekommt auch die Landesdokumente", () => {
  // Die D-Junioren-Landesklasse steht in der Stadtverbands-Liste, sagt
  // aber in ihrem eigenen Warnhinweis "Landesebene, also gilt der SFV".
  // Fuer die Belege zaehlt, was die Zeile sagt, nicht wo sie steht.
  const zeile = finde(REGELN_STANDARD.svfdMeister, "D-Junioren", "Landesklasse");
  assert.ok(zeile);
  assert.equal(wirksameQuelle(zeile, "svfd"), "sfv");
  const belege = ids(zeile, "svfd");
  assert.ok(belege.includes("dokument-10"), "die Landesfassung fehlt");
  assert.ok(!belege.includes("dokument-1"), "die Kurzuebersicht belegt diese Zeile nicht");
});

test("Frauen und Juniorinnen bekommen ihre eigene Landesfassung", () => {
  const zeile = finde(REGELN_STANDARD.svfdMeister, "Frauen", "Landesliga");
  assert.ok(zeile);
  const belege = ids(zeile, "svfd");
  assert.ok(belege.includes("dokument-13"), "die Spieldurchfuehrung Frauen/Juniorinnen fehlt");
  assert.ok(!belege.includes("dokument-10"), "die Junioren-Uebersicht gehoert nicht zu den Frauen");
});

test("die Kleinfeldbestimmungen haengen genau an den Kleinfeld-Altersklassen", () => {
  // Das Dokument sagt selbst "von G- bis C-Junioren". Genau daran haelt
  // sich die Zuordnung - bei den B-Junioren waere es geraten.
  for (const liste of [REGELN_STANDARD.svfdMeister, REGELN_STANDARD.sfvMeister]) {
    const ebene = liste === REGELN_STANDARD.sfvMeister ? "sfv" : "svfd";
    for (const zeile of liste) {
      const kleinfeld = /^(C|D|E|F|G)-Junior/i.test(zeile.a);
      const hat = ids(zeile, ebene).includes("dokument-11");
      assert.equal(hat, kleinfeld, `${zeile.a} · ${zeile.k}: Kleinfeldbestimmungen ${hat ? "zu viel" : "fehlen"}`);
    }
  }
});

test("keine Regelzeile bleibt ohne Beleg", () => {
  // Der ganze Punkt der Sache: wer auf eine Zeile schaut, soll sehen,
  // woher sie stammt - ohne unten in einer Liste von 23 Dokumenten zu
  // suchen.
  for (const [ebene, name] of [["svfd", "svfdMeister"], ["sfv", "sfvMeister"]]) {
    for (const zeile of REGELN_STANDARD[name]) {
      assert.ok(ids(zeile, ebene).length > 0, `${name}: ${zeile.a} · ${zeile.k} hat keinen Beleg`);
    }
  }
});

test("fehlende oder abgeschaltete Unterlagen lassen die Regeln stehen", () => {
  const zeile = REGELN_STANDARD.svfdMeister[0];
  assert.deepEqual(passendeDokumente(zeile, "svfd", null), []);
  assert.deepEqual(passendeDokumente(zeile, "svfd", []), []);
  assert.deepEqual(passendeDokumente(null, "svfd", DOKUMENTE), []);
  // Ein abgeschaltetes oder linkloses Dokument wird nicht angehaengt.
  const aus = DOKUMENTE.map((d) => (d.id === "dokument-1" ? { ...d, aktiv: false } : d));
  assert.ok(!passendeDokumente(zeile, "svfd", aus).some((d) => d.id === "dokument-1"));
});

test("jeder Beleg sagt, warum er dort steht", () => {
  const zeile = finde(REGELN_STANDARD.svfdMeister, "C-Junioren", "9 gegen 9");
  for (const beleg of passendeDokumente(zeile, "svfd", DOKUMENTE)) {
    assert.ok(beleg.grund && beleg.grund.length > 15,
      beleg.id + ": ein Titel allein sagt nicht, warum das Dokument hier steht");
    assert.ok(beleg.href, beleg.id + ": ohne Link ist der Beleg wertlos");
  }
});

test("die Regeluebersicht haengt die Belege wirklich in die Karte", () => {
  const html = readFileSync(new URL("../regeluebersicht.html", import.meta.url), "utf8");
  assert.match(html, /import \{ passendeDokumente \}/);
  assert.match(html, /bereich: "unterlagen"/);
  assert.match(html, /\$\{belegeHtml\(r\)\}/);
});
