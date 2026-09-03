// Vereinsseite und Quiz wachsen zusammen (30.08.2026).
//
// Max: "irgendwie muessen wir halt die beiden Seiten auch ein bisschen mehr
// verschmelzen lassen." Diese Tests halten die Entscheidungen dieser Runde
// fest - vor allem die, die man beim Weiterbauen leicht wieder aufmacht,
// ohne dass irgendetwas laut kaputtgeht.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");

/* Kommentare wegwerfen, bevor auf Verbotenes geprueft wird - sonst trifft
   jede Suche den Erklaertext, der genau beschreibt, was hier NICHT mehr
   stehen darf. Derselbe Fehler steckte schon einmal in
   api-sicherheit.test.js und in tests/seitenweite-anmeldung.test.js. */
const ohneHtmlKommentare = (html) => html.replace(/<!--[\s\S]*?-->/g, " ");
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

// spesenrechner.html fehlt hier bewusst: an der Datei arbeitet gerade
// jemand anderes, sie wurde in dieser Runde nicht angefasst.
const EIGENE_SEITEN = [
  "index.html", "termine.html", "regeluebersicht.html", "informationen.html",
  "vorlagen.html", "schiri-werden.html", "modus.html", "entscheiden.html",
  "quiz.html",
];

/* ============================================================
   1. Abmelden fuehrt nicht zurueck in die Quiz-Anmeldemaske
   ============================================================ */

test("die Quizseite hat keinen eigenen Abmelden-Knopf mehr", () => {
  // Max: "Wenn du dich angemeldet hast, dann ins Quiz gehst, Fragen dieser
  // Woche, und dann auf den Button Abmelden klickst, kommst du auf das
  // Login-Menue von der Quizseite. Das soll halt nicht passieren."
  //
  // Der Knopf loeschte die Sitzung und lud die Seite neu - und damit
  // zwangslaeufig die quiz-eigene Anmeldemaske. Abgemeldet wird jetzt nur
  // noch im Kontomenue der Kopfleiste.
  const quiz = ohneHtmlKommentare(lies("quiz.html"));
  assert.doesNotMatch(quiz, /id="wechseln-button"/);
  assert.doesNotMatch(quiz, />Abmelden</);

  const access = ohneJsKommentare(lies("src/features/access.js"));
  assert.doesNotMatch(access, /wechseln-button/);
  // Der eigentliche Fehler war das Neuladen nach dem Abmelden. Kein
  // location.reload() mehr im Zugangsmodul.
  assert.doesNotMatch(access, /location\.reload/);
});

test("es gibt genau eine Stelle, die abmeldet", () => {
  const konto = ohneJsKommentare(lies("src/ui/konto-bereich.js"));
  assert.match(konto, /anmeldung\.abmelden\(\)/);
  // Und sie laedt die Seite nicht neu - eine Vereinsseite ist ohne
  // Anmeldung vollstaendig lesbar, man bleibt einfach stehen.
  assert.doesNotMatch(ohneJsKommentare(konto), /location\.(reload|href)/);
  assert.doesNotMatch(ohneJsKommentare(lies("seite.js")), /anmeldung\.abmelden\(\)/);
});

/* ============================================================
   2. Das Profil-Menue gehoert auf jede Seite
   ============================================================ */

const PROFIL_BAUSTEINE = [
  "src/core/quiz-utils.js",
  "src/core/rpc.js",
  "src/ui/profil-fenster.js",
  "src/features/profile-requests.js",
];

test("das Markup der Profil-Fenster gibt es nur noch einmal", () => {
  // Vorher stand es fest in quiz.html und war damit ausschliesslich dort
  // erreichbar. Max: "Das hat ja mit dem Quiz gar nichts mehr zu tun."
  const fenster = lies("src/ui/profil-fenster.js");
  const quizHtml = ohneHtmlKommentare(lies("quiz.html"));
  for (const kennung of ["anfrage-formular-overlay", "anliegen-formular-overlay",
                         "meine-anfragen-overlay", "rechnung-upload-overlay"]) {
    assert.match(fenster, new RegExp(`id="${kennung}"`), kennung + " fehlt im Modul");
    assert.doesNotMatch(quizHtml, new RegExp(`id="${kennung}"`),
      kennung + " steht wieder fest in quiz.html");
  }
});

test("jede Vereinsseite laedt die Profil-Bausteine vor seite.js", () => {
  // Klassische Skripte laufen vor den Modulen. Steht einer dahinter,
  // faellt das nicht auf - die Profil-Punkte verschwinden dann einfach
  // lautlos aus dem Kontomenue.
  for (const seite of EIGENE_SEITEN.filter((s) => s !== "quiz.html")) {
    const html = lies(seite);
    const seiteJs = html.indexOf('src="seite.js"');
    assert.ok(seiteJs > -1, seite + " laedt seite.js nicht");
    for (const baustein of PROFIL_BAUSTEINE) {
      const stelle = html.indexOf(`src="${baustein}"`);
      assert.ok(stelle > -1, `${seite} laedt ${baustein} nicht`);
      assert.ok(stelle < seiteJs, `${seite}: ${baustein} steht hinter seite.js`);
    }
    assert.match(html, /href="stil\/profil\.css"/, seite + " laedt stil/profil.css nicht");
  }
});

test("das Kontomenue benutzt dieselbe Logik wie das Quiz, kein zweites Modul", () => {
  // Ohne den Kommentar-Abzug faende die Suche nach "Anliegen melden" den
  // Erklaertext daraeber, warum es diesen Punkt gibt - der Test waere dann
  // gruen geblieben, auch wenn der Punkt selbst fehlt. Genau so ist er bei
  // der Sabotageprobe am 30.08.2026 zuerst durchgerutscht.
  const seiteJs = ohneJsKommentare(lies("seite.js"));
  assert.match(seiteJs, /SchiriQuizProfileRequests/);
  assert.match(seiteJs, /erstelleProfilAnfragen/);
  for (const punkt of ["Ausrüstung anfragen", "Anliegen melden", "Meine Anfragen"]) {
    assert.ok(seiteJs.includes(punkt), "Punkt fehlt im Kontomenue: " + punkt);
  }
  // Der Ausloeser im Quiz und der auf der Vereinsseite rufen dieselben
  // Funktionen auf - deshalb muessen sie exportiert sein.
  // Bewusst gegen den RUECKGABEWERT geprueft und nicht gegen die ganze
  // Datei: eine Funktion, die es zwar gibt, die das Modul aber nicht mehr
  // herausgibt, ist fuer das Kontomenue genauso weg. Bei der
  // Sabotageprobe am 30.08.2026 ist genau das zuerst durchgerutscht.
  const anfragen = ohneJsKommentare(lies("src/features/profile-requests.js"));
  const rueckgabe = anfragen.match(/return Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(rueckgabe, "profile-requests.js gibt nichts mehr heraus");
  for (const name of ["oeffneAusruestungsAnfrage", "oeffneAnliegen", "oeffneMeineAnfragen"]) {
    assert.ok(rueckgabe[1].includes(name), name + " wird nicht bereitgestellt");
  }
});

test("stil/profil.css laesst keine Elementregel auf die Seite durch", () => {
  // Dieselbe Falle wie bei spesen.css: eine Regel "label { ... }" wuerde
  // jedes Formular jeder Vereinsseite mit einfaerben.
  const css = lies("stil/profil.css").replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const block of css.split("}")) {
    const selektor = block.split("{")[0].trim();
    if (!selektor) continue;
    for (const einzeln of selektor.split(",")) {
      const s = einzeln.trim();
      if (!s || s.startsWith("@") || s.startsWith("/")) continue;
      assert.ok(s.startsWith(".profil-fenster") || s.startsWith(".konto-"),
        `stil/profil.css: "${s}" ist nicht auf die Profil-Fenster eingegrenzt`);
    }
  }
});

/* ============================================================
   3. Ein Name fuer das Quiz
   ============================================================ */

test("das Quiz heisst ueberall nur Quiz", () => {
  // Max: "Regel-Quiz wuerde ich einfach nur Quiz nennen, weil es muss
  // einen einheitlichen Namen haben, es muss alles einheitlich sein.
  // Damit die Schiris nicht mehr wissen, okay, was war jetzt was."
  for (const seite of EIGENE_SEITEN) {
    const sichtbar = ohneHtmlKommentare(lies(seite));
    for (const falsch of ["Regelquiz", "Regel-Quiz", "Schiri-Quiz", "Quiz der Woche"]) {
      assert.ok(!sichtbar.includes(falsch), `${seite} nennt es "${falsch}"`);
    }
  }
});

/* ============================================================
   4. Kein Zurueck-Knopf mehr, dafuer der Name der Seite
   ============================================================ */

test("der Zurueck-Knopf ist weg - und kommt nicht heimlich zurueck", () => {
  // Max am 03.09.2026: "zurueck rausnehmen." Der Knopf beantwortete "wie
  // komme ich weg" - das tut das Wappen laengst, es fuehrt zur Startseite.
  // Die offene Frage war "wo bin ich"; die beantwortet jetzt der Seitenname.
  //
  // Diese Pruefung ist bewusst umgedreht statt geloescht: der Knopf war
  // einmal eine gute Idee und waere beim naechsten "auf dem Handy fehlt
  // was"-Gefuehl schnell wieder da, ohne dass jemand die Entscheidung von
  // heute noch kennt.
  const nav = ohneJsKommentare(lies("src/ui/kopf-navigation.js"));
  assert.doesNotMatch(nav, /montiereZurueckKnopf/);
  assert.doesNotMatch(nav, /history\.back/);
  assert.doesNotMatch(nav, /zurueck-knopf/);
  assert.doesNotMatch(ohneJsKommentare(lies("seite.js")), /montiereZurueckKnopf/);
  assert.doesNotMatch(lies("stil/kopf-fuss.css"), /\.zurueck-knopf/);
});

test("der Quiz-Knopf steht nicht im Burgermenue", () => {
  // Max: "Dass man zum Quiz nur ueber dieses Dropdown-Menue kommt, finde
  // ich auch noch irgendwie ein bisschen bloed."
  assert.match(ohneJsKommentare(lies("src/ui/kopf-navigation.js")), /zeigeQuizKnopfImmer/);
  assert.match(ohneJsKommentare(lies("seite.js")), /zeigeQuizKnopfImmer\(kopfInnen\)/);
});

/* ============================================================
   5. iPhone: das Anmeldefenster
   ============================================================ */

test("kein Eingabefeld im Anmeldefenster loest den iOS-Auto-Zoom aus", () => {
  // Unter 16 px zoomt iOS Safari beim Antippen eines Feldes ungefragt in
  // die ganze Seite - und zoomt danach nicht wieder heraus. Genau das war
  // Max' "Allgemein ist irgendwie sehr rangezoomt".
  const css = lies("stil/anmeldung.css");
  const feldRegel = css.match(/\.anmelde-feld input,\s*\n\.anmelde-feld select \{[^}]*\}/);
  assert.ok(feldRegel, "die Feldregel in stil/anmeldung.css ist nicht mehr auffindbar");
  assert.match(feldRegel[0], /font-size:\s*16px/);
  assert.doesNotMatch(feldRegel[0], /font-size:\s*\.\d+rem/);
});

test("das Anmeldefenster passt auf einen kleinen Bildschirm", () => {
  // Ohne Hoehengrenze und ohne dvh rutscht das senkrecht zentrierte
  // Fenster unter die iOS-Tastatur, sobald sie aufgeht ("das Fenster sieht
  // halt irgendwie verschoben aus").
  const css = lies("stil/anmeldung.css");
  const dialogRegel = css.match(/\.anmeldedialog \{[^}]*\}/);
  assert.ok(dialogRegel, "die .anmeldedialog-Regel ist nicht mehr auffindbar");
  assert.match(dialogRegel[0], /max-height:\s*calc\(100dvh/);
  assert.match(dialogRegel[0], /overflow-y:\s*auto/);
  assert.match(dialogRegel[0], /env\(safe-area-inset-top\)/);
});

/* ============================================================
   6. Startseite: "Schiri werden" traegt die Einstiegs-Infos
   ============================================================ */

test("die Einstiegs-Infos stehen hinter Schiri werden, nicht auf der Startseite", () => {
  // Max: "Ich finde es gut, dass 'Schiri werden' das erste ist. Dann kommt
  // 'Steh mitten im Spiel, statt daneben zu stehen'. Das wuerde ich eher
  // machen, wenn du auf 'Schiri werden' klickst."
  const start = ohneHtmlKommentare(lies("index.html"));
  assert.ok(!start.includes("Steh mitten im Spiel"),
    "die Bildzeile steht wieder auf der Startseite");
  assert.match(start, /href="schiri-werden\.html"/,
    "von der Startseite fuehrt kein Weg mehr zu Schiri werden");

  const werden = lies("schiri-werden.html");
  assert.match(werden, /Steh mitten im Spiel/);
  // Die Zahlen aus dem entfernten Absatz muessen dort weiterhin stehen -
  // sonst waere Inhalt verloren gegangen statt verschoben.
  for (const angabe of ["ab&nbsp;12", "7–8", "rund 25&nbsp;€", "frei rein"]) {
    assert.ok(werden.includes(angabe), "auf schiri-werden.html fehlt: " + angabe);
  }
});

test("die neuen Bausteine liegen als eigene Dateien vor", () => {
  for (const datei of [...PROFIL_BAUSTEINE, "src/ui/konto-bereich.js",
                       "src/ui/kopf-navigation.js", "stil/profil.css"]) {
    assert.equal(existsSync(new URL("../" + datei, import.meta.url)), true, datei + " fehlt");
  }
});
