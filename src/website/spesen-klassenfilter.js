/**
 * Grobfilter fuer die Altersklassen-Liste des Spesenrechners.
 *
 * Max am 30.08.2026: "Dass du halt schneller selektieren kannst: okay,
 * ich moechte ein Meisterschaftsspiel, ich moechte maennlich oder
 * weiblich, erwachsen oder nicht erwachsen - und dann halt die Jugend."
 * Und: "Wenn man zur F-Jugend muss, ist halt bisschen bloed." Die Liste
 * hat elf Eintraege; auf dem Handy scrollt man sie zweimal durch.
 *
 * Im selben Atemzug aber: "obwohl, na ja, wenn man direkt zugefahren
 * ist, ist auch halt besser." Deshalb ist der Filter hier eine
 * ABKUERZUNG und kein Pflichtweg. Zwei Eigenschaften halten das:
 *
 *   1. Der leere Filter (nichts angetippt) liefert die volle Liste in
 *      unveraenderter Reihenfolge. Wer seine Klasse kennt, waehlt sie
 *      im ersten Schritt - so wie vorher.
 *   2. Ein Filter, der nichts trifft, liefert ebenfalls die volle Liste
 *      statt eines leeren Auswahlkastens. Eine Sackgasse waere
 *      schlimmer als eine lange Liste.
 *
 * Die Einordnung wird aus dem NAMEN der Gruppe gelesen und nicht in
 * verein.config.js hinterlegt. Grund: Die Altersklassen kommen zur
 * Laufzeit aus der vom Obmann veroeffentlichten Konfiguration - eine
 * dort fehlende Angabe wuerde die Klasse sonst unerreichbar machen.
 * Was sich nicht einordnen laesst, gilt als "offen" und passt damit zu
 * JEDEM Filter. Ein Filter darf nie etwas verstecken, das er nicht
 * verstanden hat.
 */

export const OFFEN = "offen";

/* Weiblich zuerst pruefen: "Juniorinnen" enthaelt kein "Junioren"
   (jun-i-o-r-i-n-n-e-n), wohl aber "Junior" - wer nur auf den Stamm
   testet, sortiert die B-Juniorinnen unter "maennlich" ein. */
const WEIBLICH = /juniorinnen|frauen|damen|m(ä|ae)dchen/;
const MAENNLICH = /junioren|herren|senioren|m(ä|ae)nner/;

/* Jugend zuerst pruefen, weil "Altherren" das Wort "herren" enthaelt -
   umgekehrt enthaelt keine Erwachsenenklasse "junior" oder "jugend". */
const JUGEND = /junior|jugend|m(ä|ae)dchen|sch(ü|ue)ler/;
const ERWACHSEN = /herren|frauen|damen|m(ä|ae)nner|senioren/;

/**
 * Ordnet einen Gruppennamen grob ein.
 *
 * Rueckgabe: { geschlecht: "m" | "w" | "offen", stufe: "erwachsen" | "jugend" | "offen" }
 */
export function klasseEinordnen(name) {
  const text = String(name || "").toLowerCase();
  const geschlecht = WEIBLICH.test(text) ? "w" : MAENNLICH.test(text) ? "m" : OFFEN;
  const stufe = JUGEND.test(text) ? "jugend" : ERWACHSEN.test(text) ? "erwachsen" : OFFEN;
  return { geschlecht, stufe };
}

/**
 * Passt eine Gruppe zum gesetzten Filter?
 *
 * Ein nicht gesetzter Filterwert (null) laesst alles durch, und eine
 * Gruppe mit "offen" faellt durch jeden Filter hindurch - siehe oben.
 */
export function passtZuFilter(name, filter = {}) {
  const einordnung = klasseEinordnen(name);
  const gewuenschtGeschlecht = filter.geschlecht || null;
  const gewuenschteStufe = filter.stufe || null;
  if (gewuenschtGeschlecht
      && einordnung.geschlecht !== OFFEN
      && einordnung.geschlecht !== gewuenschtGeschlecht) return false;
  if (gewuenschteStufe
      && einordnung.stufe !== OFFEN
      && einordnung.stufe !== gewuenschteStufe) return false;
  return true;
}

/**
 * Die anzuzeigenden Altersklassen samt ihrem Platz in der Originalliste.
 *
 * "index" ist bewusst der Index in der UNGEFILTERTEN Liste. Der Rechner
 * benutzt ihn als Wert der Auswahloption; waere es die Position in der
 * gefilterten Liste, zeigte dieselbe gespeicherte Zahl nach jedem
 * Filterwechsel auf eine andere Altersklasse.
 *
 * "ausweich" sagt, dass der Filter nichts getroffen hat und deshalb
 * wieder alles dasteht - die Oberflaeche schreibt das dann hin, statt es
 * still zu tun.
 */
export function gefilterteKlassen(altersklassen, filter = {}) {
  const alle = (Array.isArray(altersklassen) ? altersklassen : [])
    .map((gruppe, index) => ({ index, gruppe }));
  const treffer = alle.filter((eintrag) => passtZuFilter(eintrag.gruppe?.name, filter));
  return treffer.length
    ? { eintraege: treffer, ausweich: false }
    : { eintraege: alle, ausweich: alle.length > 0 };
}
