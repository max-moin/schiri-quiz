// ============================================================
//  Wege durch die Vereinsseite: Seitenname und "Zum Quiz"
// ============================================================
//  Zwei kleine Dinge, die beide dieselbe Frage beantworten: wo bin ich,
//  und wie komme ich zum Quiz - beides auf dem Handy schwerer als noetig.
//
//  Max am 30.08.2026:
//  - "Dass man zum Quiz nur ueber dieses Dropdown-Menue kommt, finde ich
//    auch noch irgendwie ein bisschen bloed. Auf dem PC sieht das geil aus
//    mit dem 'Zum Quiz' und dann dieses 'Angemeldet'."
//
//  Max am 03.09.2026:
//  - "dass man oben halt immer den Namen stehen hat, auf welcher Seite
//    man gerade ist"
//  - "dass wenn man auf das Wappen klickt, dass man zur Startseite
//    wiederkommt"
//
//  Beides wird hier eingesetzt statt in neun HTML-Dateien geschrieben -
//  aus demselben Grund wie beim Menue, beim Vereinsnamen und beim
//  Kontoknopf: sonst muesste man es in neun Dateien nachziehen. Und bei
//  spesenrechner.html geht es gar nicht anders, an der Datei arbeitet
//  gerade jemand anderes.
// ============================================================

const NAVIGATION = [
  { href: "termine.html", text: "Termine", seiten: ["termine.html"] },
  { href: "informationen.html", text: "Unterlagen", seiten: ["informationen.html"] },
  { href: "vorlagen.html", text: "Absagen", seiten: ["vorlagen.html"] },
  { href: "melden.html", text: "Etwas melden", seiten: ["melden.html"] },
  { href: "spesenrechner.html", text: "Spesen", seiten: ["spesenrechner.html"], funktion: "spesen" },
  { href: "regeluebersicht.html", text: "Regeln", seiten: ["regeluebersicht.html"], funktion: "regeln" },
];

function dateiname() {
  const teil = String(globalThis.location?.pathname || "").split("/").filter(Boolean).pop();
  return teil || "index.html";
}

// Die Navigationspunkte werden an einer Stelle aufgebaut. Damit bekommen
// auch Unterseiten wie "Meine Ausrüstung" und "Frage vorschlagen", die
// früher nur einen Text-Zurück-Link hatten, denselben Seitenkopf. Spesen und
// Regeln bleiben im Code erreichbar, werden bis zur fachlichen Prüfung aber
// bewusst nicht verlinkt.
export function vereinheitlicheHauptnavigation(kopfInnen) {
  if (!kopfInnen) return null;

  const marke = kopfInnen.querySelector("a.marken-knopf");
  if (marke) {
    marke.href = "index.html";
    marke.setAttribute("aria-label", "Zur Startseite");
    const titel = marke.querySelector(".marken-titel");
    if (titel) {
      titel.setAttribute("data-verein", "name");
      titel.textContent = "FV Löbtauer Kickers";
    }
  }

  const alterZurueckLink = Array.from(kopfInnen.querySelectorAll("a.sekundaer-button"))
    .find((link) => /zurück|vereinsseite/i.test(link.textContent || ""));
  if (alterZurueckLink) alterZurueckLink.remove();

  let navKnopf = kopfInnen.querySelector("#nav-knopf");
  if (!navKnopf) {
    navKnopf = document.createElement("button");
    navKnopf.id = "nav-knopf";
    navKnopf.className = "nav-knopf";
    navKnopf.type = "button";
    navKnopf.setAttribute("aria-expanded", "false");
    navKnopf.setAttribute("aria-controls", "haupt-nav");
    navKnopf.setAttribute("aria-label", "Menü öffnen");
    kopfInnen.appendChild(navKnopf);
  }
  navKnopf.innerHTML = '<span class="nav-striche" aria-hidden="true"><i></i><i></i><i></i></span>';

  let nav = kopfInnen.querySelector("#haupt-nav");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "haupt-nav";
    nav.className = "haupt-nav";
    nav.setAttribute("aria-label", "Hauptnavigation");
    kopfInnen.appendChild(nav);
  }

  nav.replaceChildren();
  const aktuell = dateiname();
  for (const eintrag of NAVIGATION) {
    if (eintrag.funktion) {
      const inaktiv = document.createElement("span");
      inaktiv.className = "nav-deaktiviert";
      inaktiv.dataset.funktion = eintrag.funktion;
      inaktiv.dataset.href = eintrag.href;
      inaktiv.dataset.text = eintrag.text;
      inaktiv.setAttribute("aria-disabled", "true");
      if (eintrag.seiten.includes(aktuell)) inaktiv.setAttribute("aria-current", "page");
      inaktiv.title = `${eintrag.text} wird noch fachlich geprüft`;
      inaktiv.innerHTML = `${eintrag.text}<small>In Prüfung</small>`;
      nav.appendChild(inaktiv);
      continue;
    }
    const link = document.createElement("a");
    link.href = eintrag.href;
    link.textContent = eintrag.text;
    if (eintrag.seiten.includes(aktuell)) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  }

  const quiz = document.createElement("a");
  quiz.href = "modus.html";
  quiz.className = "nav-anmelden";
  quiz.innerHTML = '<span class="nav-quiz-lang">Zum Quiz</span><span class="nav-quiz-kurz">Quiz</span>';
  nav.appendChild(quiz);
  return nav;
}

export function setzeFunktionsfreigaben(nav, freigaben = {}) {
  if (!nav) return;
  for (const element of Array.from(nav.querySelectorAll("[data-funktion]"))) {
    const funktion = element.dataset.funktion;
    const aktiv = freigaben[funktion] === true;
    const ersatz = document.createElement(aktiv ? "a" : "span");
    ersatz.dataset.funktion = funktion;
    ersatz.dataset.href = element.dataset.href;
    ersatz.dataset.text = element.dataset.text;
    if (aktiv) {
      ersatz.href = element.dataset.href;
      ersatz.textContent = element.dataset.text;
    } else {
      ersatz.className = "nav-deaktiviert";
      ersatz.setAttribute("aria-disabled", "true");
      ersatz.title = `${element.dataset.text} wird noch fachlich geprüft`;
      ersatz.innerHTML = `${element.dataset.text}<small>In Prüfung</small>`;
    }
    if (element.getAttribute("aria-current") === "page") ersatz.setAttribute("aria-current", "page");
    element.replaceWith(ersatz);
  }
}

// Der Aufruf-zum-Quiz sitzt im HTML in der Hauptnavigation. Auf breiten
// Bildschirmen ist das genau richtig - dort steht er sichtbar ganz rechts,
// und Max mag die Kombination aus "Zum Quiz" und dem Kontoknopf daneben.
// Auf schmalen Bildschirmen klappt die Hauptnavigation aber ins
// Burgermenue, und der wichtigste Knopf der Seite verschwindet mit ihr.
//
// Deshalb wandert er hier aus der Navigation heraus, direkt in die
// Kopfzeile. Dort gilt fuer ihn dasselbe wie fuer den Kontoknopf: immer
// sichtbar, ohne erst ein Menue zu oeffnen. Auf breiten Bildschirmen steht
// er danach an genau derselben Stelle wie vorher (die Navigation schiebt
// sich mit "margin-left: auto" nach rechts, der Knopf folgt ihr).
export function zeigeQuizKnopfImmer(kopfInnen) {
  const nav = kopfInnen.querySelector(".haupt-nav");
  const knopf = nav && nav.querySelector("a.nav-anmelden");
  if (!knopf) return null;
  kopfInnen.appendChild(knopf);
  return knopf;
}

// Woher der Name kommt. Zwei Quellen, in genau dieser Reihenfolge:
//
//  1. Der Reiter mit aria-current="page". Der Normalfall fuer die neun
//     Seiten mit Reiterleiste. Er gewinnt immer, denn er ist die Angabe,
//     die man daneben auch SIEHT - ein abweichendes data-seitenname waere
//     ein zweiter Name fuer dieselbe Seite.
//
//  2. data-seitenname am <body>. Fuer Seiten, die gar keinen eigenen
//     Reiter haben und auch keinen bekommen sollen: modus.html und
//     entscheiden.html liegen hinter "Zum Quiz", obmann.html hinter der
//     Fusszeile. Ausgerechnet auf den beiden Quizseiten landen die
//     Schiedsrichter - dort ist die Ortsangabe am noetigsten, und bis zum
//     03.09.2026 blieb sie leer.
//
// Der Umweg ueber das <body>-Attribut statt ueber einen unsichtbaren
// Reiter ist Absicht: die Navigation dafuer zu verbiegen hiesse, eine
// Angabe fuer Vorleseprogramme zu erfinden, die auf dem Bildschirm nicht
// existiert.
export function leseSeitenname(kopfInnen) {
  if (!kopfInnen) return "";

  // "Zum Quiz" ist ein Aufruf und kein Seitenschild. Er traegt auf
  // modus.html zwar aria-current="page", taugt aber nicht als
  // Ueberschrift - und er wandert ohnehin aus der Navigation in die
  // Kopfzeile. Deshalb faellt er hier heraus, und modus.html bekommt
  // seinen Namen aus der zweiten Quelle.
  const reiter = Array.from(kopfInnen.querySelectorAll('a[aria-current="page"]'))
    .find((eintrag) => !eintrag.classList.contains("nav-anmelden"));

  if (reiter) {
    // Startseite: geprueft wird das Ziel, nicht die Beschriftung - "Start"
    // koennte morgen anders heissen, index.html nicht. Bewusst OHNE
    // Rueckfall auf data-seitenname: auf der Startseite soll nichts
    // stehen, und zwar auch dann nicht, wenn jemand das Attribut setzt.
    const ziel = (reiter.getAttribute("href") || "").split("?")[0].split("#")[0];
    if (ziel === "" || ziel === "/" || ziel === "./" || ziel === "index.html") return "";
    return reiter.textContent.trim();
  }

  const vorgabe = document.body && document.body.getAttribute("data-seitenname");
  if (vorgabe) return vorgabe.trim();

  // Profil-Unterseiten haben keinen eigenen Reiter. Dort ist die erste
  // Überschrift die verlässlichste Ortsangabe; nur die Startseite soll
  // bewusst ohne ein zusätzliches Seitenschild bleiben.
  if (dateiname() !== "index.html") {
    const ueberschrift = document.querySelector("main h1");
    if (ueberschrift) return ueberschrift.textContent.trim();
  }
  return "";
}

// Der Name der Seite, auf der man gerade steht.
//
// Max am 03.09.2026: "dass man oben halt immer den Namen stehen hat, auf
// welcher Seite man gerade ist." Der Knopf, der bis dahin hier stand,
// beantwortete "wie komme ich weg" - das tut das Wappen laengst, es fuehrt
// zur Startseite. Offen war die Frage davor.
//
// Der Name steht NICHT in neun HTML-Dateien, sondern wird hier gelesen -
// aus demselben Grund wie beim Menue, beim Vereinsnamen und beim
// Kontoknopf. Wer die Reiterleiste umbenennt, benennt oben mit um.
//
// Zwei Quellen, in dieser Reihenfolge - siehe leseSeitenname().
//
// Zwei Faelle bleiben bewusst leer:
//  - Die Startseite. Dort ist man zu Hause; ein Schild "Start" unter dem
//    Vereinsnamen sagt nichts, was das Wappen daneben nicht schon sagt.
//  - Jede Seite, die weder einen eigenen Reiter noch ein data-seitenname
//    hat (vorlagen.html, schiri-werden.html). Lieber gar kein Name als
//    ein falscher.
export function zeigeSeitenname(kopfInnen) {
  if (!kopfInnen) return null;

  const name = leseSeitenname(kopfInnen);
  if (!name) return null;

  const wappenKnopf = kopfInnen.querySelector("a.marken-knopf");
  if (!wappenKnopf) return null;

  // Ein Block um Wappen-Knopf und Name: der Name gehoert UNTER den
  // Vereinsnamen, nicht daneben. Er steht bewusst ausserhalb des
  // Wappen-Links - er ist eine Angabe, kein zweites Ziel.
  const block = document.createElement("div");
  block.className = "marken-block";
  wappenKnopf.parentNode.insertBefore(block, wappenKnopf);
  block.appendChild(wappenKnopf);

  const schild = document.createElement("span");
  schild.className = "seiten-name";
  schild.textContent = name;
  block.appendChild(schild);
  kopfInnen.classList?.add?.("hat-seiten-name");
  return schild;
}
