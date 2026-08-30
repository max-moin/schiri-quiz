// ============================================================
//  Wege durch die Vereinsseite: Zurueck-Knopf und "Zum Quiz"
// ============================================================
//  Zwei kleine Dinge, die beide dasselbe Problem haben: auf dem Handy war
//  der Weg zurueck bzw. zum Quiz laenger als noetig.
//
//  Max am 30.08.2026:
//  - "Dann brauchst du auf der Website auch irgendwie einen Zurueck-Button,
//    weil sonst muss ich die von Safari selber nutzen."
//  - "Dass man zum Quiz nur ueber dieses Dropdown-Menue kommt, finde ich
//    auch noch irgendwie ein bisschen bloed. Auf dem PC sieht das geil aus
//    mit dem 'Zum Quiz' und dann dieses 'Angemeldet'."
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

// Ein Zurueck-Knopf, der nur dann erscheint, wenn er auch etwas tut.
//
// "history.back()" fuehrt nur dann verlaesslich auf die vorige Seite
// DIESER Seite, wenn man auch von hier gekommen ist. Wer den Link aus
// WhatsApp oeffnet, hat keinen Verlauf in diesem Tab - ein Knopf, der
// dann aus der Seite hinausfuehrt oder gar nichts tut, ist schlechter als
// keiner. Deshalb: nur bei einem Verweis von der eigenen Herkunft.
export function montiereZurueckKnopf(ziel) {
  if (!ziel) return null;

  let kamVonHier = false;
  try {
    kamVonHier = !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch {
    kamVonHier = false;
  }
  if (!kamVonHier || history.length <= 1) return null;

  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "zurueck-knopf";
  // Wort statt Symbol allein (Hausregel "Woerter statt Icons"). Der Pfeil
  // bleibt als Beigabe, er ist auf dem Handy das, was man zuerst sieht.
  knopf.innerHTML = '<span aria-hidden="true">←</span> Zur&uuml;ck';
  knopf.addEventListener("click", () => history.back());
  ziel.insertBefore(knopf, ziel.firstChild);
  return knopf;
}
