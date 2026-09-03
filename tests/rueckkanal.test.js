// ============================================================
//  Der Rueckkanal (03.09.2026): Frage melden und Meldebogen
// ============================================================
//  Zwei Wege zurueck zum Obmann, die es vorher nicht gab:
//
//  1. "Passt was nicht?" an einer Frage - ein Knopf BEI DER LOESUNG.
//  2. melden.html - Regelfall, Vorfall, Gespraech, Website.
//
//  Diese Tests pruefen nicht das Aussehen, sondern die Zusagen, an denen
//  beides haengt und die man beim Weiterbauen leicht kippt: wo der Knopf
//  sitzt, welche Kategorien es gibt, dass die Zeichengrenze WARNT statt
//  zu sperren, welche Felder zu welcher Meldungsart gehoeren, und dass
//  "anonym" nur dort angeboten wird, wo es auch etwas bedeutet.
//
//  Wo eine Zusage an einer Reihenfolge oder an einem Rechenweg haengt,
//  laufen die Pruefungen gegen einen winzigen Test-DOM und nicht gegen
//  den Dateitext - dieselbe Entscheidung wie in kopfleiste.test.js. An
//  Zeichenketten liesse sich nicht ablesen, ob der Zaehler bei 1001
//  Zeichen wirklich sperrt oder nur so aussieht.
// ============================================================

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  MELDE_ARTEN,
  MELDE_FELDER,
  GRENZE_SITUATION,
  felderFuer,
  erlaubtAnonym,
  beschriftungFuer,
  baueParameter,
} from "../src/website/melden-arten.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

/* Kommentare wegwerfen, bevor auf Verbotenes geprueft wird - sonst
   schlagen die Pruefungen auf die Erklaerungen an, warum es etwas hier
   gerade NICHT gibt. Dieselbe Falle wie in api-sicherheit.test.js und
   seitenweite-anmeldung.test.js. */
const ohneKommentare = (quelltext) =>
  quelltext
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

/* ============================================================
   Ein winziger Test-DOM
   ============================================================
   Nur so viel, wie die beiden geprueften Bausteine wirklich anfassen.
   Unbekannte Waehler werfen absichtlich: aendert jemand den Waehler im
   Code, wird der Test rot statt still gruen zu bleiben. */

let alleElemente = [];

class TestElement {
  constructor(tag) {
    this.tag = tag;
    this.klassen = new Set();
    this.attribute = {};
    this.dataset = {};
    this.kinder = [];
    this.parentNode = null;
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.zuhoerer = {};
    this.classList = {
      add: (...namen) => namen.forEach((n) => this.klassen.add(n)),
      remove: (...namen) => namen.forEach((n) => this.klassen.delete(n)),
      contains: (name) => this.klassen.has(name),
      toggle: (name, an) => {
        const soll = an === undefined ? !this.klassen.has(name) : Boolean(an);
        if (soll) this.klassen.add(name);
        else this.klassen.delete(name);
        return soll;
      },
    };
  }

  set className(wert) { this.klassen = new Set(String(wert).split(" ").filter(Boolean)); }
  get className() { return [...this.klassen].join(" "); }

  setAttribute(name, wert) { this.attribute[name] = String(wert); }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attribute, name) ? this.attribute[name] : null;
  }
  removeAttribute(name) { delete this.attribute[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attribute, name); }

  addEventListener(name, rueckruf) {
    (this.zuhoerer[name] = this.zuhoerer[name] || []).push(rueckruf);
  }
  ausloesen(name, ereignis) {
    (this.zuhoerer[name] || []).forEach((r) => r(ereignis || {}));
  }

  appendChild(kind) {
    if (kind.parentNode) kind.parentNode.kinder = kind.parentNode.kinder.filter((k) => k !== kind);
    kind.parentNode = this;
    this.kinder.push(kind);
    return kind;
  }
  append(...kinder) { kinder.forEach((k) => this.appendChild(k)); }
  remove() {
    if (this.parentNode) this.parentNode.kinder = this.parentNode.kinder.filter((k) => k !== this);
    this.parentNode = null;
  }
  focus() {}

  nachfahren() { return this.kinder.flatMap((k) => [k, ...k.nachfahren()]); }

  querySelectorAll(waehler) {
    const teile = String(waehler).match(/^\.([\w-]+)$/);
    if (!teile) throw new Error("Der Test-DOM kennt diesen Waehler nicht: " + waehler);
    return this.nachfahren().filter((el) => el.klassen.has(teile[1]));
  }
  querySelector(waehler) { return this.querySelectorAll(waehler)[0] || null; }

  /** Der sichtbare Text dieses Elements samt Kindern. */
  text() {
    return (this.textContent || "") + this.kinder.map((k) => k.text()).join("");
  }
}

function neuerDom() {
  alleElemente = [];
  const koerper = new TestElement("body");
  globalThis.document = {
    body: koerper,
    activeElement: null,
    createElement: (tag) => {
      const el = new TestElement(tag);
      alleElemente.push(el);
      return el;
    },
    createTextNode: (text) => {
      const el = new TestElement("#text");
      el.textContent = text;
      return el;
    },
    // Sucht ueber alles Gebaute, nicht nur ueber den body: die
    // Loesungszeilen haengen im echten Quiz an den Fragekarten, nicht am
    // Dokumentwurzelelement.
    querySelectorAll: (waehler) => {
      const teile = String(waehler).match(/^\.([\w-]+)$/);
      if (!teile) throw new Error("Der Test-DOM kennt diesen Waehler nicht: " + waehler);
      return alleElemente.filter((el) => el.klassen.has(teile[1]));
    },
    addEventListener: () => {},
  };
  return koerper;
}

/** Laedt ein klassisches Skript (IIFE auf globalThis) in diesen Prozess. */
function ladeKlassisch(pfad) {
  const quelle = lies(pfad);
  // eslint-disable-next-line no-new-func
  new Function(quelle)();
}

/* ============================================================
   1. Der Knopf "Passt was nicht?"
   ============================================================ */

const melden = ohneKommentare(lies("src/features/frage-melden.js"));
const app = ohneKommentare(lies("app.js"));

test("es gibt einen Knopf mit Fragezeichen UND Wort, nicht nur ein Symbol", () => {
  // Max: "so einen Button mit einem Fragezeichen oder Feedback - ein
  // Button sieht geiler aus als so ein Text mit Hyperlink."
  //
  // Hausregel: Woerter statt blosser Icons. Das Fragezeichen darf
  // begleiten, nie allein stehen - und es ist fuer Vorleseprogramme
  // ausgeblendet, sonst liest die Stimme "Fragezeichen" vor.
  neuerDom();
  ladeKlassisch("src/ui/zeichen-zaehler.js");
  ladeKlassisch("src/features/frage-melden.js");

  const meldung = globalThis.SchiriQuizFrageMeldung.erstelleFrageMeldung({
    sb: { rpc: async () => ({ data: [], error: null }) },
    getZugang: () => ({ schiedsrichterId: "s1", pin: "1234" }),
  });

  const warum = document.createElement("button");
  warum.className = "warum-button";
  const zeile = meldung.baueLoesungsAktionen(warum, "f1");

  assert.ok(zeile, "es wurde gar keine Loesungszeile gebaut");
  const knopf = zeile.querySelector(".melde-knopf");
  assert.ok(knopf, "der Melde-Knopf fehlt in der Loesungszeile");
  assert.equal(knopf.tag, "button", "der Melde-Knopf ist ein " + knopf.tag + " statt eines button");
  assert.ok(knopf.text().includes("Passt was nicht?"),
    'die Beschriftung "Passt was nicht?" fehlt - der Knopf steht als blosses Symbol da');

  const symbol = knopf.querySelector(".melde-symbol");
  assert.ok(symbol, "das Fragezeichen fehlt");
  assert.equal(symbol.getAttribute("aria-hidden"), "true",
    "das Symbol wird Vorleseprogrammen vorgelesen, obwohl das Wort daneben steht");
});

test("der Knopf hat eine Trefferflaeche von mindestens 44 Punkten", () => {
  const css = lies("style.css").replace(/\/\*[\s\S]*?\*\//g, " ");
  const regel = css.match(/\.melde-knopf \{[^}]*\}/);
  assert.ok(regel, ".melde-knopf fehlt in style.css");
  assert.match(regel[0], /min-height:\s*44px/, "der Knopf ist niedriger als 44 px");
  assert.match(regel[0], /min-width:\s*44px/, "der Knopf ist schmaler als 44 px");
});

test("der Melde-Knopf entsteht NUR mit der Loesung, nie an der offenen Frage", () => {
  // Max' Sorge: "die Frage ist, ob das dann zu ueberladen wird." An der
  // offenen Frage steht deshalb nichts.
  //
  // Drei Schloesser, weil eins zu leicht aufgeht:

  // (a) Das Modul gibt den Knopf ausschliesslich zusammen mit dem
  //     "Warum?"-Knopf heraus. Ohne Loesung gibt es keinen "Warum?" -
  //     und damit auch keinen Melde-Knopf.
  neuerDom();
  ladeKlassisch("src/ui/zeichen-zaehler.js");
  ladeKlassisch("src/features/frage-melden.js");
  const meldung = globalThis.SchiriQuizFrageMeldung.erstelleFrageMeldung({
    sb: { rpc: async () => ({ data: [], error: null }) },
    getZugang: () => ({ schiedsrichterId: "s1", pin: "1234" }),
  });
  assert.equal(meldung.baueLoesungsAktionen(null, "f1"), null,
    "ohne Loesung wird trotzdem eine Aktionszeile gebaut");
  assert.equal(typeof meldung.baueMeldeKnopf, "undefined",
    "baueMeldeKnopf ist nach draussen sichtbar - dann kann ihn jemand an eine offene Frage haengen");

  // (b) app.js verdrahtet ihn genau dort und nirgends sonst.
  assert.match(app, /frageMeldung\.baueLoesungsAktionen\(\s*erklaerungsDialog\.baueWarumButton\(/,
    "app.js baut die Loesungszeile nicht mehr um den Warum-Knopf herum");

  // (c) Die Antwortmodule kennen das Melde-Modul gar nicht - sie koennen
  //     den Knopf also nirgends selbst einsetzen.
  const ANTWORTMODULE = [
    "src/features/weekly-quiz.js",
    "src/features/freetext-answers.js",
    "src/features/decision-answers.js",
    "src/features/flexible-answers.js",
    "src/features/history-mode.js",
  ];
  for (const pfad of ANTWORTMODULE) {
    const quelle = ohneKommentare(lies(pfad));
    for (const verboten of ["SchiriQuizFrageMeldung", "baueMeldeKnopf", "melde-knopf", "Passt was nicht"]) {
      assert.ok(!quelle.includes(verboten),
        `${pfad} setzt den Melde-Knopf selbst ein (${verboten}) - dann kann er an einer offenen Frage landen`);
    }
  }
});

test("die Bauer der OFFENEN Fragekarten holen keine Loesungsaktionen", () => {
  // Der Knopf haengt am "Warum?"-Knopf. Solange keine Funktion, die eine
  // unbeantwortete Karte baut, diesen Knopf anfasst, kann er auch nicht
  // an einer offenen Frage stehen.
  const OFFENE_KARTEN_BAUER = {
    "src/features/weekly-quiz.js": ["baueFrageElement"],
    "src/features/freetext-answers.js": ["baueFreitextFrageElement"],
    "src/features/decision-answers.js": ["baueFrageElement"],
    "src/features/history-mode.js": ["baueHistorieFrageElement", "baueHistorieFreitextFrageElement"],
  };

  for (const [pfad, namen] of Object.entries(OFFENE_KARTEN_BAUER)) {
    const quelle = ohneKommentare(lies(pfad));
    for (const name of namen) {
      const start = quelle.indexOf("function " + name + "(");
      assert.ok(start > -1, `${pfad}: ${name} ist nicht mehr auffindbar`);
      // Bis zum Beginn der naechsten Funktion derselben Ebene.
      const rest = quelle.slice(start + 1);
      const naechste = rest.search(/\n {4}(?:async )?function /);
      const rumpf = naechste === -1 ? rest : rest.slice(0, naechste);
      assert.ok(!rumpf.includes("baueWarumButton"),
        `${pfad}: ${name} baut eine OFFENE Karte und holt trotzdem die Loesungsaktionen dazu`);
    }
  }

  // flexible-answers.js baut offene und beantwortete Karte in DERSELBEN
  // Funktion. Dort haengt der Knopf am Zweig "beantwortet".
  //
  // Ein Blick auf die Zeilen davor genuegt hier nicht: In der Schleife
  // ueber die Antwortoptionen steht weiter oben ein zweites
  // "if (beantwortet) {", und ein danebengeschobener Aufruf saehe damit
  // richtig aus. Bei der Sabotageprobe am 03.09.2026 blieb genau diese
  // Pruefung gruen. Deshalb wird jetzt die Klammerebene mitgezaehlt: Es
  // zaehlt der Block, in dem die Zeile WIRKLICH steht.
  const flexibel = ohneKommentare(lies("src/features/flexible-answers.js")).split("\n");
  const stapel = [];
  let gefunden = 0;
  for (const zeile of flexibel) {
    if (zeile.includes("baueWarumButton(")) {
      gefunden += 1;
      const umgebung = stapel.join(" | ");
      assert.ok(/if \(beantwortet\) \{/.test(umgebung) || /function zeigeErgebnis/.test(umgebung),
        "flexible-answers.js holt die Loesungsaktionen ausserhalb des Zweiges "
        + '"beantwortet" - dann stehen sie auch an einer offenen Karte. Umgebung: ' + umgebung);
    }
    const auf = (zeile.match(/\{/g) || []).length;
    const zu = (zeile.match(/\}/g) || []).length;
    for (let i = 0; i < auf - zu; i += 1) stapel.push(zeile.trim());
    for (let i = 0; i < zu - auf; i += 1) stapel.pop();
  }
  assert.ok(gefunden >= 2, "flexible-answers.js holt die Loesungsaktionen gar nicht mehr");
});

test("es gibt genau die fuenf Kategorien der Datenbank", () => {
  // Ein sechster Eintrag hier wuerde vom Server abgelehnt (v111 prueft
  // die Liste), ein fehlender waere ein Weg, den niemand mehr findet.
  const werte = globalThis.SchiriQuizFrageMeldung.KATEGORIEN.map((k) => k.wert);
  assert.deepEqual(werte, ["antwort", "feedback", "text_unklar", "video_technik", "sonstiges"]);

  const woerter = globalThis.SchiriQuizFrageMeldung.KATEGORIEN.map((k) => k.text);
  assert.deepEqual(woerter, ["Antwort", "Feedback", "Text unklar", "Video/Technik", "Sonstiges"]);

  // Jede Kategorie traegt ein Wort, keine steht als blosses Kuerzel da.
  for (const kategorie of globalThis.SchiriQuizFrageMeldung.KATEGORIEN) {
    assert.ok(kategorie.text.trim().length > 2, "Kategorie ohne lesbares Wort: " + kategorie.wert);
  }
});

test("schon gemeldete Fragen bekommen eine ruhige Marke", () => {
  // Ohne die Marke meldet dieselbe Person dieselbe Sache dreimal und
  // hoert dann ganz auf (Begruendung ausfuehrlich in v112).
  neuerDom();
  ladeKlassisch("src/ui/zeichen-zaehler.js");
  ladeKlassisch("src/features/frage-melden.js");

  const gerufen = [];
  const meldung = globalThis.SchiriQuizFrageMeldung.erstelleFrageMeldung({
    sb: {
      rpc: async (name, parameter) => {
        gerufen.push([name, parameter]);
        return {
          data: [
            { frage_id: "f1", status: "offen", anzahl_eintraege: 2 },
            { frage_id: "f2", status: "erledigt", anzahl_eintraege: 1 },
          ],
          error: null,
        };
      },
    },
    getZugang: () => ({ schiedsrichterId: "s1", pin: "1234" }),
  });

  const zeileEins = meldung.baueLoesungsAktionen(document.createElement("button"), "f1");
  const zeileZwei = meldung.baueLoesungsAktionen(document.createElement("button"), "f2");
  const zeileDrei = meldung.baueLoesungsAktionen(document.createElement("button"), "f3");

  assert.equal(zeileEins.querySelector(".melde-marke"), null,
    "vor dem Laden steht schon eine Marke da");

  return meldung.ladeEigeneMeldungen().then(() => {
    assert.equal(gerufen[0][0], "meine_frage_meldungen",
      "es wird eine andere Serverfunktion gefragt als die fuer die eigenen Meldungen");
    assert.deepEqual(gerufen[0][1], { p_schiedsrichter_id: "s1", p_pin: "1234" });

    assert.equal(zeileEins.querySelector(".melde-marke").textContent, "Gemeldet");
    assert.equal(zeileZwei.querySelector(".melde-marke").textContent, "Gemeldet · erledigt",
      "eine erledigte Meldung sieht aus wie eine offene");
    assert.equal(zeileDrei.querySelector(".melde-marke"), null,
      "eine nie gemeldete Frage bekommt trotzdem eine Marke");
  });
});

test("nach dem Abschicken sagt die Seite, ob neu angelegt oder ergaenzt wurde", () => {
  // Max: eine zweite Meldung erweitert die erste. Wer das nicht erfaehrt,
  // haelt seinen zweiten Hinweis fuer verschluckt.
  assert.match(melden, /ergebnis\.neu_angelegt/,
    "die Antwort des Servers wird gar nicht ausgewertet");
  assert.ok(melden.includes("deine Rückmeldung ist angekommen"),
    "die Bestaetigung fuer eine neue Meldung fehlt");
  assert.ok(melden.includes("ergänzt"),
    "die Rueckmeldung fuer eine ergaenzte Meldung fehlt");
  assert.match(melden, /meldung_frage_abgeben/, "die Meldung wird gar nicht abgeschickt");
});

/* ============================================================
   2. Die Zeichengrenze: warnen statt sperren
   ============================================================ */

test("der Zaehler taucht erst kurz vor der Grenze auf, warnt - und sperrt erst ab 1001", () => {
  // Max woertlich: "Auf jeden Fall wuerde ich sagen, eine maximale
  // Zeichenanzahl, aber dass da auch nicht so richtig gesperrt wird."
  neuerDom();
  ladeKlassisch("src/ui/zeichen-zaehler.js");

  const feld = document.createElement("textarea");
  feld.setAttribute("maxlength", "1000");
  const anzeige = document.createElement("p");
  anzeige.hidden = true;

  let zuletzt = null;
  const zaehlwerk = globalThis.SchiriZeichenZaehler.haengeZeichenZaehlerAn(feld, anzeige, {
    grenze: 1000,
    abZeigen: 900,
    beiAenderung: (stand) => { zuletzt = stand; },
  });
  assert.ok(zaehlwerk, "es wurde gar kein Zaehler angehaengt");

  // Ein maxlength waere genau das Sperren, das nicht sein soll: das
  // Tippen hoerte mitten im Wort auf, ohne ein Wort Erklaerung.
  assert.equal(feld.hasAttribute("maxlength"), false,
    "das Feld sperrt per maxlength - dann kommt die Warnung nie zum Zug");

  // Kurz vorher: noch unsichtbar.
  feld.value = "x".repeat(899);
  let stand = zaehlwerk.pruefe();
  assert.equal(anzeige.hidden, true, "der Zaehler steht schon bei 899 Zeichen da");
  assert.equal(stand.zuLang, false);

  // Ab 900: sichtbar, aber ruhig.
  feld.value = "x".repeat(900);
  stand = zaehlwerk.pruefe();
  assert.equal(anzeige.hidden, false, "der Zaehler bleibt bei 900 Zeichen unsichtbar");
  assert.ok(anzeige.textContent.includes("900"), "der Zaehler nennt die Zeichenzahl nicht");
  assert.equal(anzeige.klassen.has("zu-lang"), false, "der Zaehler warnt schon bei 900 Zeichen");
  assert.equal(stand.zuLang, false, "bei 900 Zeichen ist schon gesperrt");

  // Genau an der Grenze: noch erlaubt.
  feld.value = "x".repeat(1000);
  stand = zaehlwerk.pruefe();
  assert.equal(stand.zuLang, false, "genau 1000 Zeichen werden schon abgelehnt");
  assert.equal(anzeige.klassen.has("zu-lang"), false);

  // Ein Zeichen darueber: jetzt warnt er - und sagt, um WIE VIEL.
  feld.value = "x".repeat(1037);
  stand = zaehlwerk.pruefe();
  assert.equal(stand.zuLang, true, "ab 1001 Zeichen wird nicht gesperrt");
  assert.equal(stand.zuViel, 37);
  assert.ok(anzeige.klassen.has("zu-lang"), "der zu lange Text sieht aus wie ein erlaubter");
  assert.ok(anzeige.textContent.includes("37"),
    "die Warnung sagt nicht, wie viele Zeichen zu viel sind: " + anzeige.textContent);
  assert.equal(zuletzt.zuViel, 37, "der Aufrufer erfaehrt nicht, um wie viel zu kuerzen ist");

  // Und der Text steht immer noch vollstaendig im Feld - nichts wurde
  // abgeschnitten.
  assert.equal(feld.value.length, 1037, "der Text wurde gekuerzt statt gewarnt");
});

test("das Melde-Fenster sperrt das Abschicken erst ueber der Grenze", () => {
  assert.match(melden, /const GRENZE = 1000;/, "die Grenze von 1000 Zeichen steht nicht mehr fest");
  assert.match(melden, /abZeigen: 900/, "der Zaehler taucht nicht mehr ab 900 Zeichen auf");
  assert.match(melden, /senden\.disabled = stand\.zuLang/,
    "das Abschicken haengt nicht mehr daran, ob der Text zu lang ist");
  assert.match(melden, /stand\.zuViel/, "die Ansage nennt nicht, wie viele Zeichen zu viel sind");
});

/* ============================================================
   3. Der Meldebogen: je Art die richtigen Felder
   ============================================================ */

test("es gibt genau die vier Meldungsarten der Datenbank", () => {
  assert.deepEqual(MELDE_ARTEN.map((a) => a.art), ["regelfall", "vorfall", "gespraech", "website"]);
  // Jede Art traegt einen Satz in Max' Worten, kein blosses Schlagwort.
  for (const eintrag of MELDE_ARTEN) {
    assert.ok(eintrag.frage && eintrag.frage.length > 8, "der Art " + eintrag.art + " fehlt ihre Frage");
    assert.ok(eintrag.beschreibung && eintrag.beschreibung.length > 15,
      "der Art " + eintrag.art + " fehlt die Erklaerung");
  }
  assert.equal(GRENZE_SITUATION, 4000, "die Grenze weicht von der Datenbank ab");
});

test("jede Art zeigt genau ihre Felder", () => {
  assert.deepEqual(felderFuer("regelfall"),
    ["spielklasse", "situation", "eigene_entscheidung", "unsicher_warum", "veroeffentlichung"]);
  assert.deepEqual(felderFuer("vorfall"),
    ["spielklasse", "situation", "beteiligte", "sonderbericht"]);
  // Niedrigschwellig heisst: ein Feld. Jede weitere Frage ist eine
  // Huerde vor "ich moechte einfach mal reden".
  assert.deepEqual(felderFuer("gespraech"), ["situation"]);
  assert.deepEqual(felderFuer("website"), ["situation"]);

  // Jedes genannte Feld gibt es auch wirklich.
  for (const eintrag of MELDE_ARTEN) {
    for (const feld of eintrag.felder) {
      assert.ok(MELDE_FELDER[feld], `${eintrag.art} verlangt das unbekannte Feld ${feld}`);
    }
  }
});

test("ein Vorfall bekommt kein Veroeffentlichungsfeld - und schickt auch keins", () => {
  // Ein Vorfall wird nie zur Quizfrage. Die Datenbank erzwingt das
  // ohnehin (CHECK in v111); hier soll das Feld gar nicht erst auftauchen.
  assert.ok(!felderFuer("vorfall").includes("veroeffentlichung"),
    "der Vorfall zeigt ein Veroeffentlichungs-Ankreuzfeld");

  const parameter = baueParameter({
    art: "vorfall",
    werte: { situation: "Etwas ist passiert.", veroeffentlichung: true },
    person: { id: "s1", pin: "1234" },
  });
  assert.equal(parameter.p_veroeffentlichung_erlaubt, false,
    "ein Vorfall geht mit gesetzter Veroeffentlichungsfreigabe zum Server");

  // Der Regelfall dagegen bietet sie an - unangekreuzt.
  assert.ok(felderFuer("regelfall").includes("veroeffentlichung"),
    "beim Regelfall fehlt die Freigabe als Quizfrage");
  const ohneHaken = baueParameter({
    art: "regelfall", werte: { situation: "Frage." }, person: { id: "s1", pin: "1234" },
  });
  assert.equal(ohneHaken.p_veroeffentlichung_erlaubt, false, "die Freigabe ist von Haus aus gesetzt");
  const mitHaken = baueParameter({
    art: "regelfall",
    werte: { situation: "Frage.", veroeffentlichung: true },
    person: { id: "s1", pin: "1234" },
  });
  assert.equal(mitHaken.p_veroeffentlichung_erlaubt, true, "die Freigabe kommt nicht durch");
});

test("anonym gibt es nur bei Vorfall und Gespraech", () => {
  assert.equal(erlaubtAnonym("vorfall"), true);
  assert.equal(erlaubtAnonym("gespraech"), true);
  // Beim Regelfall waere es sinnlos: "war das richtig so?" braucht eine
  // Antwort an jemanden. Beim Website-Hinweis ist nichts zu schuetzen.
  assert.equal(erlaubtAnonym("regelfall"), false);
  assert.equal(erlaubtAnonym("website"), false);

  // Und ein untergeschobenes "anonym" bei einer Art, die es nicht
  // anbietet, kommt nicht durch - sonst waere das ein stiller
  // Datenverlust: der Server wuerfe die Kennung weg, und niemand koennte
  // mehr antworten.
  const geschmuggelt = baueParameter({
    art: "regelfall", werte: { situation: "Frage." }, person: { id: "s1", pin: "1234" }, anonym: true,
  });
  assert.equal(geschmuggelt.p_anonym, false, "ein Regelfall laesst sich anonym abgeben");

  const echt = baueParameter({
    art: "vorfall", werte: { situation: "Etwas." }, person: { id: "s1", pin: "1234" }, anonym: true,
  });
  assert.equal(echt.p_anonym, true, "ein Vorfall laesst sich nicht anonym abgeben");
});

test("ein Website-Hinweis schickt keine Spielangaben mit", () => {
  const parameter = baueParameter({
    art: "website",
    werte: {
      situation: "Der Knopf tut nichts.",
      spielklasse: "Stadtliga B",
      eigene_entscheidung: "Elfmeter",
      beteiligte: "Trainer Meier",
    },
    person: { id: "s1", pin: "1234" },
  });
  assert.equal(parameter.p_spielklasse, null);
  assert.equal(parameter.p_eigene_entscheidung, null);
  assert.equal(parameter.p_beteiligte, null);
  assert.equal(parameter.p_situation, "Der Knopf tut nichts.");
  assert.equal(parameter.p_art, "website");
});

test("die Beschriftung des Situationsfeldes passt zur Art", () => {
  // "Was ist passiert?" ist bei einem Gespraechswunsch die falsche Frage.
  assert.equal(beschriftungFuer("vorfall", "situation"), "Was ist passiert?");
  assert.equal(beschriftungFuer("gespraech", "situation"), "Worum geht es?");
  assert.equal(beschriftungFuer("regelfall", "situation"), "Die Situation");
  assert.equal(beschriftungFuer("website", "situation"), "Was passt nicht?");
});

/* ============================================================
   4. Die Seite melden.html
   ============================================================ */

const seite = lies("melden.html");
const seitenModul = ohneKommentare(lies("src/website/melden-seite.js"));

test("die Seite und ihre Bausteine existieren und sind verdrahtet", () => {
  for (const datei of ["melden.html", "src/website/melden-seite.js",
                       "src/website/melden-arten.js", "stil/melden.css"]) {
    assert.equal(existsSync(new URL("../" + datei, import.meta.url)), true, datei + " fehlt");
  }
  assert.match(seite, /src="src\/website\/melden-seite\.js"/, "melden.html laedt sein Modul nicht");
  assert.match(seite, /id="meldenBereich"/, "melden.html hat keinen Bereich zum Fuellen");
  assert.match(seite, /src="src\/ui\/zeichen-zaehler\.js"/,
    "melden.html laedt den Zeichenzaehler nicht - dann gibt es dort keine Warnung");
});

test("der Meldebogen ist von der Startseite und aus dem Quizbereich erreichbar", () => {
  assert.match(lies("index.html"), /href="melden\.html"/,
    "von der Startseite fuehrt kein Weg zum Meldebogen");
  assert.match(ohneKommentare(lies("src/website/modus-seite.js")), /href="melden\.html"/,
    "aus der Quiz-Auswahl fuehrt kein Weg zum Meldebogen");
});

test("die Felder kommen aus der Regel und nicht aus einer zweiten Liste im Formular", () => {
  // Sonst laufen Regel und Formular auseinander, und der Test oben prueft
  // eine Liste, die niemand mehr benutzt.
  assert.match(seitenModul, /for \(const name of felderFuer\(art\)\)/,
    "das Formular baut seine Felder nicht mehr aus felderFuer()");
  assert.match(seitenModul, /erlaubtAnonym\(art\)/,
    "das Anonym-Feld haengt nicht mehr an erlaubtAnonym()");
  assert.match(seitenModul, /baueParameter\(/, "die Parameter werden nicht mehr zentral gebaut");
  assert.match(seitenModul, /meldebogen_abgeben/, "die Meldung wird gar nicht abgeschickt");
});

test('"anonym" wird ehrlich beschrieben und nicht schoengeredet', () => {
  // Nicht "wird anonymisiert gespeichert" - das waere zu freundlich fuer
  // das, was passiert.
  assert.ok(seitenModul.includes("verwirft"),
    "es steht nicht da, dass die Personenkennung verworfen wird");
  assert.ok(seitenModul.includes("nicht wiederherstellbar"),
    "es steht nicht da, dass die Kennung danach nicht wiederherstellbar ist");
  assert.ok(seitenModul.includes("nicht antworten") || seitenModul.includes("nicht nachfragen"),
    "der Hinweis fehlt, dass dann keine Rueckfrage moeglich ist");
  assert.ok(!/anonymisiert gespeichert/.test(seitenModul),
    'die Seite behauptet, es werde "anonymisiert gespeichert"');
});

test("beim Feld Beteiligte steht ein Datenschutzhinweis mit Verweis statt Wiederholung", () => {
  assert.equal(MELDE_FELDER.beteiligte.datenschutzHinweis, true,
    "das Feld Beteiligte traegt keinen Datenschutzhinweis mehr");
  assert.ok(seitenModul.includes("Angaben über andere Menschen"),
    "der Hinweis sagt nicht, dass dort Angaben ueber Dritte landen");
  assert.ok(seitenModul.includes("Schiedsrichter-Obmann"),
    "der Hinweis sagt nicht, wer das liest");
  assert.ok(seitenModul.includes("zwei Jahre"),
    "der Hinweis sagt nicht, wie lange es bleibt");
  assert.match(seitenModul, /verweis\.href = "datenschutz\.html"/,
    "der Hinweis verlinkt die Datenschutzerklaerung nicht");
  assert.match(lies("datenschutz.html"), /<h2>13\. Der Meldebogen<\/h2>/,
    "der verlinkte Abschnitt 13 gibt es nicht mehr");
  assert.match(lies("datenschutz.html"), /<h2>14\. Angaben über andere Personen<\/h2>/,
    "der verlinkte Abschnitt 14 gibt es nicht mehr");
});

test("wer nicht angemeldet ist, bekommt den Weg zur Anmeldung - keine Fehlermeldung", () => {
  assert.match(seitenModul, /function zeichneAnmeldeAufforderung\(\)/,
    "es gibt keinen eigenen Bildschirm fuer nicht Angemeldete");
  assert.match(seitenModul, /loginDialog\?\.oeffne\(/,
    "der Knopf oeffnet nicht das vorhandene Anmeldefenster");
  assert.ok(seitenModul.includes("Anmelden"), "der Knopf traegt keine Beschriftung");
  assert.match(seitenModul, /if \(!person\(\) \|\| !server\) \{\s*zeichneAnmeldeAufforderung\(\);/,
    "ohne Anmeldung wird etwas anderes gezeigt als der Weg dorthin");
});

/* ============================================================
   5. Keine Browser-Dialoge, kein zweiter Zaehler
   ============================================================ */

test("kein Browser-Dialog in den neuen Bausteinen", () => {
  // confirm(), alert() und prompt() sind in dieser Umgebung verboten -
  // und sie erlauben ohnehin keine eigenen Beschriftungen.
  const dateien = [
    "src/features/frage-melden.js",
    "src/ui/zeichen-zaehler.js",
    "src/website/melden-seite.js",
    "src/website/melden-arten.js",
    "melden.html",
  ];
  for (const datei of dateien) {
    const text = datei.endsWith(".html") ? lies(datei) : ohneKommentare(lies(datei));
    for (const verboten of ["confirm(", "alert(", "prompt("]) {
      assert.ok(!text.includes(verboten), `${datei} benutzt ${verboten}`);
    }
    assert.ok(!text.includes("beforeunload"), datei + " benutzt beforeunload");
  }
});

test("Quiz und Vereinsseite benutzen denselben Zeichenzaehler", () => {
  // Zwei Kopien derselben Regel waeren die Stelle, an der die beiden
  // Formulare auseinanderlaufen - eins warnt dann noch, das andere sperrt.
  assert.match(melden, /SchiriZeichenZaehler/, "das Melde-Fenster hat einen eigenen Zaehler");
  assert.match(seitenModul, /SchiriZeichenZaehler/, "der Meldebogen hat einen eigenen Zaehler");
  const zaehler = ohneKommentare(lies("src/ui/zeichen-zaehler.js"));
  assert.match(zaehler, /removeAttribute\("maxlength"\)/,
    "der Zaehler laesst ein maxlength stehen - dann sperrt das Feld doch");
});
