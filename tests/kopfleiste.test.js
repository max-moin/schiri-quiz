// Die Kopfleiste sagt, wo man ist - und die Reiterleiste wird kuerzer
// (03.09.2026).
//
// Max an diesem Tag, in drei Saetzen:
//  - "zurueck rausnehmen"
//  - "dass man oben halt immer den Namen stehen hat, auf welcher Seite man
//     gerade ist"
//  - "dass wenn man auf das Wappen klickt, dass man zur Startseite
//     wiederkommt"
//
// Der Zurueck-Knopf beantwortete "wie komme ich weg". Das tat das Wappen
// laengst. Offen war die Frage davor: "wo bin ich".
//
// Diese Tests halten vor allem das fest, was in NEUN Dateien gleich sein
// muss. Genau das laeuft sonst auseinander: jemand baut einen Reiter auf
// einer Seite dazu, und acht Seiten wissen nichts davon.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { leseSeitenname, zeigeSeitenname } from "../src/ui/kopf-navigation.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

const ohneJsKommentare = (js) =>
  js
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((zeile) => {
      let inZeichenkette = null;
      for (let i = 0; i < zeile.length; i += 1) {
        const z = zeile[i];
        if (inZeichenkette) {
          if (z === "\\") i += 1;
          else if (z === inZeichenkette) inZeichenkette = null;
        } else if (z === '"' || z === "'" || z === "`") {
          inZeichenkette = z;
        } else if (z === "/" && zeile[i + 1] === "/") {
          return zeile.slice(0, i);
        }
      }
      return zeile;
    })
    .join("\n");

const ohneCssKommentare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, " ");

// Alle Seiten mit Reiterleiste. spesenrechner.html steht hier bewusst MIT
// drin: die Leiste ist genau das, was auf allen Seiten gleich sein muss -
// eine Ausnahme waere hier eine Luecke, kein Schutz.
const SEITEN_MIT_LEISTE = [
  "index.html", "termine.html", "regeluebersicht.html", "spesenrechner.html",
  "vorlagen.html", "informationen.html", "modus.html", "entscheiden.html",
  "schiri-werden.html",
];

// Die verbindliche Reihenfolge, in Max' Worten: Termine, Spesen, Regeln,
// Unterlagen, und ganz hinten der Aufruf zum Quiz.
const REITER = [
  { ziel: "termine.html", text: "Termine" },
  { ziel: "spesenrechner.html", text: "Spesen" },
  { ziel: "regeluebersicht.html", text: "Regeln" },
  { ziel: "informationen.html", text: "Unterlagen" },
  { ziel: "modus.html", text: "Zum Quiz" },
];

// Schneidet die Reiterleiste aus einer Seite heraus. Bewusst ueber die
// Zeilen und nicht mit einem Ausdruck ueber mehrere Zeilen: an genau der
// Stelle ist in diesem Projekt schon zweimal Inhalt verdoppelt worden.
function leiste(seite) {
  const zeilen = lies(seite).split("\n");
  const a = zeilen.findIndex((z) => z.includes('<nav class="haupt-nav"'));
  const b = zeilen.findIndex((z) => z.includes("</nav>"));
  assert.ok(a > -1, seite + " hat keine Reiterleiste");
  assert.ok(b > a, seite + " hat keinen sauberen Abschluss der Reiterleiste");
  return zeilen.slice(a + 1, b).map((z) => z.trim());
}

function reiterAus(zeile) {
  const ziel = zeile.match(/href="([^"]+)"/);
  const text = zeile.match(/>([^<]*)<\/a>/);
  const strom = zeile.match(/aria-current="([^"]+)"/);
  assert.ok(ziel, "kein Ziel in: " + zeile);
  assert.ok(text, "keine Beschriftung in: " + zeile);
  return { ziel: ziel[1], text: text[1].trim(), strom: strom ? strom[1] : null };
}

/* ============================================================
   1. Neun Seiten, eine Leiste
   ============================================================ */

test("alle neun Seiten tragen dieselbe Reiterleiste in derselben Reihenfolge", () => {
  for (const seite of SEITEN_MIT_LEISTE) {
    const zeilen = leiste(seite);
    assert.equal(zeilen.length, REITER.length,
      `${seite} hat ${zeilen.length} Reiter statt ${REITER.length}`);
    zeilen.forEach((zeile, i) => {
      const ist = reiterAus(zeile);
      assert.equal(ist.ziel, REITER[i].ziel,
        `${seite}, Reiter ${i + 1}: Ziel "${ist.ziel}" statt "${REITER[i].ziel}"`);
      assert.equal(ist.text, REITER[i].text,
        `${seite}, Reiter ${i + 1}: "${ist.text}" statt "${REITER[i].text}"`);
    });
  }
});

test("die Leiste ist kuerzer geworden: kein Start, keine Vorlagen", () => {
  // "Start" faellt weg, weil das Wappen daneben schon zur Startseite fuehrt -
  // zwei Wege zum selben Ziel nebeneinander sind einer zu viel.
  // "Vorlagen" faellt weg, weil die Seite jetzt unter Unterlagen steht.
  for (const seite of SEITEN_MIT_LEISTE) {
    const zeilen = leiste(seite);
    for (const zeile of zeilen) {
      const ist = reiterAus(zeile);
      assert.notEqual(ist.text, "Start", seite + ' hat wieder einen Reiter "Start"');
      assert.notEqual(ist.text, "Vorlagen", seite + ' hat wieder einen Reiter "Vorlagen"');
      assert.notEqual(ist.ziel, "vorlagen.html", seite + " verlinkt vorlagen.html wieder in der Leiste");
      assert.notEqual(ist.ziel, "index.html", seite + " verlinkt index.html wieder in der Leiste");
    }
  }
});

test('der Spesenrechner heisst in der Leiste nur noch "Spesen"', () => {
  // Max' Wunsch. Das Ziel bleibt spesenrechner.html - der Reiter wird
  // kuerzer, nicht die Seite eine andere.
  for (const seite of SEITEN_MIT_LEISTE) {
    const spesen = leiste(seite).map(reiterAus).find((r) => r.ziel === "spesenrechner.html");
    assert.ok(spesen, seite + " verlinkt den Spesenrechner nicht mehr");
    assert.equal(spesen.text, "Spesen",
      `${seite}: der Reiter heisst "${spesen.text}" statt "Spesen"`);
  }
});

test("der Aufruf zum Quiz bleibt der letzte Eintrag und behaelt seine Klasse", () => {
  // Er wird von src/ui/kopf-navigation.js aus der Leiste in die Kopfzeile
  // gehoben. Ohne die Klasse findet ihn diese Funktion nicht mehr, und er
  // verschwindet auf dem Handy im Burgermenue.
  for (const seite of SEITEN_MIT_LEISTE) {
    const zeilen = leiste(seite);
    const letzte = zeilen[zeilen.length - 1];
    assert.match(letzte, /class="nav-anmelden"/, seite + ": letzter Reiter ohne nav-anmelden");
    assert.equal(reiterAus(letzte).text, "Zum Quiz", seite + ": letzter Reiter heisst anders");
  }
});

test('"Schiri werden" bleibt aus der Leiste heraus, steht aber auf der Startseite', () => {
  // Die Leiste ist fuer die, die schon dabei sind. Nachwuchs kommt ueber
  // die Startseite - dort ist es der erste Knopf im Aufmacher.
  for (const seite of SEITEN_MIT_LEISTE) {
    for (const zeile of leiste(seite)) {
      assert.notEqual(reiterAus(zeile).ziel, "schiri-werden.html",
        seite + ' hat "Schiri werden" in die Leiste geholt');
    }
  }
  assert.match(lies("index.html"), /class="knopf-haupt" href="schiri-werden\.html"/,
    "der Einstieg zu schiri-werden.html fehlt auf der Startseite");
});

/* ============================================================
   2. aria-current: wo bin ich, und wo nur ungefaehr
   ============================================================ */

test("jede Seite markiert genau den Reiter, auf dem sie steht", () => {
  const ERWARTET = {
    "index.html": null,
    "termine.html": ["termine.html", "page"],
    "regeluebersicht.html": ["regeluebersicht.html", "page"],
    "spesenrechner.html": ["spesenrechner.html", "page"],
    "informationen.html": ["informationen.html", "page"],
    "modus.html": ["modus.html", "page"],
    // entscheiden.html ist NICHT modus.html. Bis zum 03.09.2026 stand hier
    // "page" - eine Behauptung, die Vorleseprogramme als "aktuelle Seite"
    // vorlesen. Wo man ist, sagt dort jetzt das data-seitenname.
    "entscheiden.html": ["modus.html", "true"],
    // Die Vorlagen haben keinen eigenen Reiter mehr. "true" statt "page"
    // sagt: du bist in diesem Bereich, aber nicht auf dieser Seite. Ein
    // "page" waere hier schlicht gelogen.
    "vorlagen.html": ["informationen.html", "true"],
    "schiri-werden.html": null,
  };

  for (const seite of SEITEN_MIT_LEISTE) {
    const markiert = leiste(seite).map(reiterAus).filter((r) => r.strom);
    const erwartet = ERWARTET[seite];
    if (erwartet === null) {
      assert.equal(markiert.length, 0,
        `${seite} markiert einen Reiter, obwohl es keinen passenden gibt`);
      continue;
    }
    assert.equal(markiert.length, 1, seite + " markiert nicht genau einen Reiter");
    assert.equal(markiert[0].ziel, erwartet[0], seite + ": falscher Reiter markiert");
    assert.equal(markiert[0].strom, erwartet[1], seite + ": falscher aria-current-Wert");
  }
});

test("beide Werte von aria-current sind auch sichtbar", () => {
  // "true" wurde bis zum 03.09.2026 nur von der Regel fuer "page" NICHT
  // getroffen. Damit war es eine Angabe, die Vorleseprogramme vorlasen und
  // sehende Leute nicht sahen - also die Haelfte dessen, wofuer es gesetzt
  // wurde ("damit erkennbar bleibt, wo man sich befindet").
  const css = ohneCssKommentare(lies("stil/kopf-fuss.css"));
  assert.match(css, /\.haupt-nav a\[aria-current="page"\]/,
    'die Markierung fuer "page" fehlt');
  assert.match(css, /\.haupt-nav a\[aria-current="true"\]/,
    'die Markierung fuer "true" fehlt - sie waere unsichtbar');
  // Aber nicht gleich stark: "hier bist du" und "hier herum" sind zwei
  // verschiedene Aussagen.
  const stark = css.match(/\.haupt-nav a\[aria-current="page"\][^;{]*\{[^}]*\}/);
  const schwach = css.match(/\.haupt-nav a\[aria-current="true"\][^;{]*\{[^}]*\}/);
  assert.ok(stark && schwach, "die beiden Regeln sind nicht mehr auffindbar");
  assert.notEqual(stark[0].replace(/page/, ""), schwach[0].replace(/true/, ""),
    "beide Werte sehen gleich aus - dann behauptet \"true\" doch dieselbe Seite");
});

/* ============================================================
   3. Der Name der Seite steht oben
   ============================================================ */

test("der Seitenname wird aus der Leiste gelesen und nicht in neun Dateien geschrieben", () => {
  const nav = ohneJsKommentare(lies("src/ui/kopf-navigation.js"));
  assert.match(nav, /export function zeigeSeitenname\(/);
  assert.match(nav, /aria-current="page"/, "der Name wird nicht aus dem markierten Reiter gelesen");
  assert.match(ohneJsKommentare(lies("seite.js")), /zeigeSeitenname\(kopfInnen\)/,
    "seite.js ruft zeigeSeitenname nicht auf");

  // Und er steht wirklich nirgends fest im HTML - sonst muesste man ihn in
  // neun Dateien nachziehen, genau das soll die Funktion verhindern.
  for (const seite of SEITEN_MIT_LEISTE) {
    assert.doesNotMatch(lies(seite), /class="seiten-name"/,
      seite + " schreibt den Seitennamen fest ins HTML");
  }
});

test("auf der Startseite steht kein Seitenname", () => {
  // Dort ist man zu Hause. Ein Schild "Start" unter dem Vereinsnamen sagt
  // nichts, was das Wappen daneben nicht schon sagt.
  //
  // Zwei Schloesser, weil eins zu leicht aufgeht: index.html markiert gar
  // keinen Reiter mehr, UND die Funktion lehnt index.html ausdruecklich ab.
  assert.equal(leiste("index.html").map(reiterAus).filter((r) => r.strom).length, 0,
    "index.html markiert wieder einen Reiter");
  const nav = ohneJsKommentare(lies("src/ui/kopf-navigation.js"));
  assert.match(nav, /"index\.html"/,
    "zeigeSeitenname erkennt die Startseite nicht mehr als Sonderfall");
});

test('"Zum Quiz" wird nicht als Seitenname missbraucht', () => {
  // Er traegt auf modus.html aria-current="page", ist aber ein Aufruf und
  // keine Ueberschrift - und er wandert ohnehin aus der Leiste heraus.
  //
  // Bewusst NUR im Teil ab zeigeSeitenname geprueft: "nav-anmelden" steht
  // in derselben Datei auch in zeigeQuizKnopfImmer, wo es hingehoert. Gegen
  // die ganze Datei geprueft blieb dieser Test bei der Sabotageprobe am
  // 03.09.2026 gruen, obwohl der Filter entfernt war.
  const nav = ohneJsKommentare(lies("src/ui/kopf-navigation.js"));
  const stelle = nav.indexOf("export function leseSeitenname(");
  assert.ok(stelle > -1, "leseSeitenname ist nicht mehr auffindbar");
  const teil = nav.slice(stelle);
  assert.doesNotMatch(teil, /zeigeQuizKnopfImmer/,
    "der Ausschnitt umfasst mehr als zeigeSeitenname - die Pruefung waere wertlos");
  assert.match(teil, /nav-anmelden/,
    "zeigeSeitenname filtert den Aufruf-zum-Quiz nicht mehr heraus");
});

test("der Vereinsname kuerzt, der Seitenname nicht", () => {
  // Auf dem Handy ist der Seitenname das Wichtigere: der Vereinsname steht
  // auf jeder Seite derselbe.
  const css = ohneCssKommentare(lies("stil/kopf-fuss.css"));
  const titel = css.match(/\.marken-titel \{[^}]*\}/);
  assert.ok(titel, ".marken-titel ist nicht mehr auffindbar");
  assert.match(titel[0], /text-overflow:\s*ellipsis/);
  assert.match(titel[0], /overflow:\s*hidden/);

  const name = css.match(/\.seiten-name \{[^}]*\}/);
  assert.ok(name, ".seiten-name fehlt in stil/kopf-fuss.css");
  assert.match(name[0], /white-space:\s*nowrap/);
  assert.doesNotMatch(name[0], /text-overflow/, "der Seitenname darf nicht kuerzen");

  // Der Block um beide darf keine Mindestbreite von 0 haben - sonst
  // schrumpft er unter den Seitennamen und der wird doch abgeschnitten.
  const block = css.match(/\.marken-block \{[^}]*\}/);
  assert.ok(block, ".marken-block fehlt in stil/kopf-fuss.css");
  assert.doesNotMatch(block[0], /min-width/);
});

test("das Wappen ist und bleibt der Weg zur Startseite", () => {
  // Max: "dass wenn man auf das Wappen klickt, dass man zur Startseite
  // wiederkommt." Das war schon so - diese Pruefung haelt es fest, denn
  // seit "Start" aus der Leiste raus ist, ist es der einzige Weg im Kopf.
  for (const seite of [...SEITEN_MIT_LEISTE, "obmann.html"]) {
    assert.match(lies(seite), /<a class="marken-knopf" href="index\.html"/,
      seite + ": das Wappen fuehrt nicht mehr zur Startseite");
  }
});

/* ============================================================
   4. Der Zurueck-Knopf ist weg
   ============================================================ */

test("es gibt keinen Zurueck-Knopf mehr", () => {
  const nav = ohneJsKommentare(lies("src/ui/kopf-navigation.js"));
  assert.doesNotMatch(nav, /montiereZurueckKnopf/);
  assert.doesNotMatch(ohneJsKommentare(lies("seite.js")), /montiereZurueckKnopf/);
  assert.doesNotMatch(ohneCssKommentare(lies("stil/kopf-fuss.css")), /\.zurueck-knopf/);
});

/* ============================================================
   5. Unterlagen: eigene Sachen zuerst und als eigene erkennbar
   ============================================================ */

test("die Unterlagen trennen eigene Sachen von fremden", () => {
  // Max: "Bei Unterlagen wuerde ich das irgendwie als Erstes so verlinken,
  // dass das auch von uns ist bzw. von mir als Vorlage."
  //
  // Stehen eigene Vorlagen und fremde Weiterleitungen ununterschieden
  // untereinander, weiss niemand mehr, wer fuer welchen Inhalt
  // geradesteht - und das macht beide Sorten weniger vertrauenswuerdig.
  const html = lies("informationen.html");
  const eigen = html.indexOf('class="eigene-sachen"');
  const fremd = html.indexOf("Von den Verbänden");
  assert.ok(eigen > -1, "die eigene Gruppe fehlt auf informationen.html");
  assert.ok(fremd > -1, "die Verbandsgruppe ist nicht mehr benannt");
  assert.ok(eigen < fremd, "die eigenen Sachen stehen nicht mehr zuerst");

  // Als eigene erkennbar: Wappen UND Wortmarke, nicht nur ein Symbol.
  assert.match(html, /class="wappen eigen-wappen"/, "der eigenen Gruppe fehlt das Wappen");
  assert.match(html, /Von uns – <span data-verein="name">/, "der eigenen Gruppe fehlt die Wortmarke");

  // Die Vorlagen haben ihren Reiter verloren und muessen hier stehen.
  assert.ok(html.indexOf('class="lz" href="vorlagen.html"') > -1,
    "vorlagen.html ist von den Unterlagen aus nicht verlinkt");
  assert.ok(html.indexOf('class="lz" href="vorlagen.html"') < fremd,
    "die Vorlagen stehen unter den Verbandsdokumenten statt darueber");
});

/* ============================================================
   6. Rechtliches: erreichbar, aber leise
   ============================================================ */

test("Impressum, Datenschutz und Nutzungsbedingungen stehen in jeder Fusszeile", () => {
  const ALLE_SEITEN = [...SEITEN_MIT_LEISTE, "quiz.html", "obmann.html",
    "impressum.html", "datenschutz.html", "nutzungsbedingungen.html"];
  for (const seite of ALLE_SEITEN) {
    const html = lies(seite);
    for (const ziel of ["impressum.html", "datenschutz.html", "nutzungsbedingungen.html"]) {
      if (seite === ziel) continue;
      assert.ok(html.includes(`href="${ziel}"`), `${seite} verlinkt ${ziel} nicht`);
    }
  }
});

/* ============================================================
   7. Quiz verlassen: eine Rueckfrage, die nur kommt, wenn sie muss
   ============================================================ */

test("das Quiz fragt nach, bevor angefangene Antworten verloren gehen", () => {
  const dialog = ohneJsKommentare(lies("src/ui/verlassen-dialog.js"));

  // Sie haengt am Zustand, den das Quiz ohnehin fuehrt: eine abgeschickte
  // Karte traegt "beantwortet". Erfunden wird hier nichts.
  assert.match(dialog, /const OFFENE_KARTE = "\.frage-karte:not\(\.beantwortet\)"/);

  // Nur wenn wirklich etwas verloren ginge. Eine Rueckfrage, die immer
  // kommt, wird nach dreimal blind weggetippt.
  assert.match(dialog, /if \(anzahl === 0\) return;/,
    "die Rueckfrage kommt auch dann, wenn nichts verloren geht");

  // Beschriftungen sagen, was passiert.
  assert.ok(dialog.includes("Quiz verlassen"), 'die Beschriftung "Quiz verlassen" fehlt');
  assert.ok(dialog.includes("Weiter beantworten"), 'die Beschriftung "Weiter beantworten" fehlt');
  assert.doesNotMatch(dialog, />OK</);

  // Und sie ist verdrahtet.
  assert.match(lies("quiz.html"), /src="src\/ui\/verlassen-dialog\.js"/,
    "quiz.html laedt den Dialog nicht");
  assert.match(ohneJsKommentare(lies("app.js")), /montiereQuizVerlassen\(\)/,
    "app.js verdrahtet den Dialog nicht");
  assert.match(lies("quiz.html"), /class="heim-knopf"/, "quiz.html hat keinen Heim-Knopf mehr");
});

test("kein Browser-Dialog irgendwo im Frontend", () => {
  // confirm(), alert() und prompt() sind in dieser Umgebung verboten - und
  // sie erlauben ohnehin keine eigenen Beschriftungen. "OK"/"Abbrechen"
  // sagt an dieser Stelle nicht, was passiert.
  const dateien = ["src/ui/verlassen-dialog.js", "app.js", "seite.js",
    "src/ui/kopf-navigation.js", "quiz.html"];
  for (const datei of dateien) {
    const text = datei.endsWith(".html") ? lies(datei) : ohneJsKommentare(lies(datei));
    for (const verboten of ["confirm(", "alert(", "prompt("]) {
      assert.ok(!text.includes(verboten), `${datei} benutzt ${verboten}`);
    }
    // beforeunload kann seine Frage auch nicht selbst beschriften.
    assert.ok(!text.includes("beforeunload"), datei + " benutzt beforeunload");
  }
});

test("das Fenster benutzt die Formsprache der Seite und nicht eine zweite", () => {
  const css = ohneCssKommentare(lies("style.css"));
  assert.match(css, /\.verlassen-overlay \{/);
  assert.match(css, /\.verlassen-bleiben \{/);
  assert.match(css, /\.verlassen-gehen \{/);
});

/* ============================================================
   8. Die zweite Quelle: data-seitenname
   ============================================================
   Bis zum 03.09.2026 kam der Seitenname nur aus dem Reiter mit
   aria-current="page". Ausgerechnet modus.html und entscheiden.html - die
   beiden Seiten, auf denen die Schiedsrichter tatsaechlich landen - haben
   keinen eigenen Reiter und blieben deshalb leer. Genau dort ist die
   Ortsangabe am noetigsten.

   Diese Pruefungen laufen gegen einen winzigen Test-DOM statt gegen den
   Dateitext. Ob die REIHENFOLGE der beiden Quellen stimmt, laesst sich an
   Zeichenketten nicht ablesen - man kann beide Zeilen im Code haben und
   trotzdem die falsche zuerst nehmen.
   ============================================================ */

// Nur so viel DOM, wie leseSeitenname und zeigeSeitenname anfassen.
// Unbekannte Waehler werfen absichtlich: aendert jemand den Waehler in der
// Funktion, wird dieser Test rot statt still gruen zu bleiben.
class TestElement {
  constructor(tag, { klassen = [], attribute = {}, text = "" } = {}) {
    this.tag = tag;
    this.klassen = new Set(klassen);
    this.attribute = attribute;
    this.textContent = text;
    this.kinder = [];
    this.parentNode = null;
    this.classList = { contains: (name) => this.klassen.has(name) };
  }

  set className(wert) { this.klassen = new Set(String(wert).split(" ").filter(Boolean)); }
  get className() { return [...this.klassen].join(" "); }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attribute, name) ? this.attribute[name] : null;
  }

  appendChild(kind) {
    if (kind.parentNode) kind.parentNode.kinder = kind.parentNode.kinder.filter((k) => k !== kind);
    kind.parentNode = this;
    this.kinder.push(kind);
    return kind;
  }

  insertBefore(kind, vor) {
    if (kind.parentNode) kind.parentNode.kinder = kind.parentNode.kinder.filter((k) => k !== kind);
    kind.parentNode = this;
    const stelle = this.kinder.indexOf(vor);
    this.kinder.splice(stelle < 0 ? this.kinder.length : stelle, 0, kind);
    return kind;
  }

  nachfahren() {
    return this.kinder.flatMap((k) => [k, ...k.nachfahren()]);
  }

  querySelectorAll(waehler) {
    const teile = waehler.match(/^([a-z]+)?(?:\.([\w-]+))?(?:\[([\w-]+)="([^"]*)"\])?$/);
    if (!teile || waehler === "") {
      throw new Error("Der Test-DOM kennt diesen Waehler nicht: " + waehler);
    }
    const [, tag, klasse, attr, wert] = teile;
    if (!tag && !klasse && !attr) {
      throw new Error("Der Test-DOM kennt diesen Waehler nicht: " + waehler);
    }
    return this.nachfahren().filter((el) => {
      if (tag && el.tag !== tag) return false;
      if (klasse && !el.klassen.has(klasse)) return false;
      if (attr && el.getAttribute(attr) !== wert) return false;
      return true;
    });
  }

  querySelector(waehler) { return this.querySelectorAll(waehler)[0] || null; }
}

// Baut eine Kopfzeile wie die echte: Wappen-Knopf plus Reiterleiste.
function baueKopf(reiter, koerperName) {
  const kopfInnen = new TestElement("div", { klassen: ["kopf-innen"] });
  kopfInnen.appendChild(new TestElement("a", {
    klassen: ["marken-knopf"], attribute: { href: "index.html" },
  }));
  const nav = kopfInnen.appendChild(new TestElement("nav", { klassen: ["haupt-nav"] }));
  for (const r of reiter) {
    const attribute = { href: r.ziel };
    if (r.strom) attribute["aria-current"] = r.strom;
    nav.appendChild(new TestElement("a", {
      klassen: r.klassen || [], attribute, text: r.text,
    }));
  }

  const koerper = new TestElement("body");
  if (koerperName !== null && koerperName !== undefined) {
    koerper.attribute["data-seitenname"] = koerperName;
  }
  globalThis.document = {
    body: koerper,
    createElement: (tag) => new TestElement(tag),
  };
  return kopfInnen;
}

test("der markierte Reiter gewinnt gegen data-seitenname", () => {
  // Beide Quellen da: es gilt die, die man daneben auch SIEHT. Ein
  // abweichendes data-seitenname waere ein zweiter Name fuer dieselbe
  // Seite - und dann stimmt spaetestens einer von beiden nicht mehr.
  const kopf = baueKopf([
    { ziel: "termine.html", text: "Termine", strom: "page" },
    { ziel: "modus.html", text: "Zum Quiz", klassen: ["nav-anmelden"] },
  ], "Etwas ganz anderes");
  assert.equal(leseSeitenname(kopf), "Termine");
});

test("ohne markierten Reiter zaehlt data-seitenname", () => {
  // Der Fall von modus.html und entscheiden.html.
  const kopf = baueKopf([
    { ziel: "termine.html", text: "Termine" },
    { ziel: "modus.html", text: "Zum Quiz", klassen: ["nav-anmelden"] },
  ], "Modus wählen");
  assert.equal(leseSeitenname(kopf), "Modus wählen");
});

test('ein markiertes "Zum Quiz" laesst data-seitenname trotzdem zum Zug kommen', () => {
  // Genau die Lage auf modus.html: der einzige markierte Eintrag ist der
  // Aufruf-zum-Quiz. Der ist ein Knopf und kein Ortsschild - er darf die
  // zweite Quelle nicht blockieren.
  const kopf = baueKopf([
    { ziel: "termine.html", text: "Termine" },
    { ziel: "modus.html", text: "Zum Quiz", klassen: ["nav-anmelden"], strom: "page" },
  ], "Modus wählen");
  assert.equal(leseSeitenname(kopf), "Modus wählen");
});

test("die Startseite bleibt leer, auch mit data-seitenname", () => {
  // Kein Rueckfall auf die zweite Quelle: auf der Startseite soll nichts
  // stehen, und zwar auch dann nicht, wenn jemand das Attribut setzt.
  const kopf = baueKopf([
    { ziel: "index.html", text: "Start", strom: "page" },
  ], "Start");
  assert.equal(leseSeitenname(kopf), "");
});

test("ohne beide Quellen bleibt es leer", () => {
  // vorlagen.html und schiri-werden.html: lieber gar kein Name als ein
  // falscher.
  const kopf = baueKopf([
    { ziel: "termine.html", text: "Termine" },
    { ziel: "informationen.html", text: "Unterlagen", strom: "true" },
  ], null);
  assert.equal(leseSeitenname(kopf), "");
});

test("der Name landet als Text unter dem Wappen, nicht als zweiter Link", () => {
  const kopf = baueKopf([
    { ziel: "termine.html", text: "Termine", strom: "page" },
  ], null);
  const schild = zeigeSeitenname(kopf);
  assert.ok(schild, "es wurde gar kein Schild gebaut");
  assert.equal(schild.tag, "span", "der Seitenname ist ein " + schild.tag + " statt eines span");
  assert.equal(schild.textContent, "Termine");

  const block = schild.parentNode;
  assert.equal(block.className, "marken-block");
  // Das Wappen steckt im Block und bleibt der Link zur Startseite.
  const wappen = block.querySelector("a.marken-knopf");
  assert.ok(wappen, "der Wappen-Knopf ist nicht mit in den Block gewandert");
  assert.equal(wappen.getAttribute("href"), "index.html");
  // Und der Name steht NICHT im Wappen-Link.
  assert.equal(wappen.querySelectorAll("span").length, 0,
    "der Seitenname sitzt im Wappen-Link und ist damit anklickbar");
});

/* ============================================================
   9. Wer traegt ein data-seitenname - und wer nicht
   ============================================================ */

test("die Seiten hinter der Leiste tragen ihren Namen am body", () => {
  const ERWARTET = {
    // Hinter "Zum Quiz". Name nach dem <title> und Max' eigenem Wort.
    "modus.html": "Modus wählen",
    // Hinter der Kachel "Entscheiden" auf modus.html - der Name
    // bestaetigt den Klick davor.
    "entscheiden.html": "Entscheiden",
    // Hinter der Fusszeile. <title> und <h1> heissen beide so.
    "obmann.html": "Obmann-Zugang",
  };
  for (const [seite, name] of Object.entries(ERWARTET)) {
    assert.match(lies(seite), new RegExp(`<body[^>]*data-seitenname="${name}"`),
      `${seite} traegt nicht data-seitenname="${name}"`);
  }
});

test("die Seiten mit eigenem Reiter tragen KEIN data-seitenname", () => {
  // Sonst gaebe es zwei Namen fuer dieselbe Seite, und der zweite faellt
  // beim Umbenennen des Reiters hinten runter.
  for (const seite of SEITEN_MIT_LEISTE) {
    if (seite === "modus.html" || seite === "entscheiden.html") continue;
    assert.doesNotMatch(lies(seite), /data-seitenname/,
      seite + " hat einen zweiten Namen am body, obwohl es einen Reiter gibt");
  }
});

test("Quiz und die Rechtstexte bekommen bewusst keinen Namen", () => {
  // quiz.html hat gar keine Vereins-Kopfleiste, sondern einen eigenen Kopf
  // mit <h1>Quiz</h1> - der Name ist dort schon die groesste Schrift der
  // Seite. Die drei Rechtstexte haben ebenfalls keine Kopfleiste und laden
  // seite.js nicht; ein Attribut waere dort totes Markup.
  for (const seite of ["quiz.html", "impressum.html", "datenschutz.html",
                       "nutzungsbedingungen.html"]) {
    const html = lies(seite);
    assert.doesNotMatch(html, /data-seitenname/, seite + " traegt ein wirkungsloses data-seitenname");
    assert.doesNotMatch(html, /class="kopf-innen"/,
      seite + " hat jetzt doch eine Vereins-Kopfleiste - dann braucht es dort einen Namen");
  }
});
