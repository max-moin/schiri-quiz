// ============================================================
//  Redaktionelle Texte auf die Seite legen
// ------------------------------------------------------------
//  Jeder Text, den der Obmann aendern darf, steht im HTML mit
//  einem Haken: <h1 data-text="start.titel">Ohne uns geht …</h1>.
//
//  Der Text im HTML ist der Ausgangsstand und bleibt stehen. Diese
//  Datei ersetzt ihn NUR dann, wenn im Obmann-Bereich etwas anderes
//  veroeffentlicht wurde. Faellt die Datenbank aus, laedt das Skript
//  nicht oder ist ein Schluessel unbekannt, sieht der Besucher genau
//  das, was heute dasteht - nie eine leere Ueberschrift.
//
//  Warum ueberhaupt HTML und nicht nur Text: in zwei Ueberschriften
//  steht ein gewolltes <br />, das den Umbruch setzt. Damit daraus
//  kein Einfallstor wird, laesst SAUBERE_TAGS genau die harmlosen
//  Auszeichnungen durch und wirft alles andere weg - auch bei einem
//  uebernommenen Redaktionszugang.
// ============================================================

const SAUBERE_TAGS = /<(?!\/?(?:br|strong|em|b|i|span)\b)[^>]*>/gi;

export function saeubereText(wert) {
  return String(wert == null ? "" : wert).replace(SAUBERE_TAGS, "");
}

/**
 * Legt die veroeffentlichten Texte ueber die Vorgaben im HTML.
 * Gibt zurueck, wie viele Stellen tatsaechlich ersetzt wurden -
 * die Tests pruefen darueber, dass die Haken greifen.
 */
export function wendeTexteAn(dokument, texte) {
  if (!dokument || !texte || typeof texte !== "object") return 0;
  let ersetzt = 0;
  for (const element of dokument.querySelectorAll("[data-text]")) {
    const schluessel = element.dataset.text;
    const wert = texte[schluessel];
    // Nur ein nicht-leerer String ersetzt. Ein versehentlich geleertes
    // Feld darf keine Ueberschrift verschwinden lassen.
    if (typeof wert !== "string" || !wert.trim()) continue;
    const sauber = saeubereText(wert);
    if (!sauber.trim()) continue;
    element.innerHTML = sauber;
    ersetzt += 1;
  }
  return ersetzt;
}
