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
  return vorgabe ? vorgabe.trim() : "";
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
  return schild;
}
