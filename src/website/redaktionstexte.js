// ============================================================
//  Redaktionelle Texte auf die Seite legen
// ------------------------------------------------------------
//  Jeder Text, den der Obmann aendern darf, steht im HTML mit
//  einem Haken: <h1 data-text="start.titel">Ohne uns geht …</h1>.
//
//  Der Text im HTML ist der Ausgangsstand und bleibt stehen. Diese
//  Datei ersetzt ihn NUR, wenn im Obmann-Bereich etwas anderes
//  veroeffentlicht wurde. Faellt die Datenbank aus, laedt das
//  Skript nicht oder ist ein Feld leer, sieht der Besucher genau
//  das, was heute dasteht - nie eine leere Ueberschrift.
//
//  Warum ueberhaupt HTML und nicht nur Text: in zwei Ueberschriften
//  steht ein gewolltes <br />, das den Umbruch setzt, im Weg zur
//  Pfeife ein <span data-verein="name"> und im Haftungshinweis ein
//  <b>. Damit daraus kein Einfallstor wird, laesst die Saeuberung
//  nur diese wenigen Auszeichnungen durch UND wirft dabei alle
//  Attribute weg - bis auf data-verein am span und ein geprueftes
//  href am Link. Ohne das Wegwerfen der Attribute waere ein
//  <b onmouseover="..."> durchgekommen; erlaubter Tag, beliebiger
//  Code. Das ist der Grund fuer den Umbau am 13.09.2026.
// ============================================================

const ERLAUBTE_TAGS = new Set(["br", "strong", "em", "b", "i", "span", "a"]);

// Ziele, die ein Link haben darf: eine Seite von uns, ein Sprungpunkt,
// http(s) oder eine Mailadresse. Damit sind javascript: und data: aus.
const ERLAUBTES_ZIEL = /^(https?:\/\/|mailto:|#|[a-z0-9._-]+\.html)/i;

function saubereAttribute(name, roh) {
  if (name === "span") {
    const treffer = /\bdata-verein\s*=\s*"([a-zA-Z]+)"/.exec(roh);
    return treffer ? ` data-verein="${treffer[1]}"` : "";
  }
  if (name === "a") {
    const treffer = /\bhref\s*=\s*"([^"]*)"/.exec(roh);
    const ziel = treffer ? treffer[1].trim() : "";
    if (!ERLAUBTES_ZIEL.test(ziel)) return "";
    const extern = /^https?:/i.test(ziel);
    return ` href="${ziel}"` + (extern ? ' target="_blank" rel="noopener noreferrer"' : "");
  }
  return "";
}

export function saeubereText(wert) {
  return String(wert == null ? "" : wert).replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g,
    (_ganz, schluss, tag, attribute) => {
      const name = tag.toLowerCase();
      if (!ERLAUBTE_TAGS.has(name)) return "";
      if (schluss) return `</${name}>`;
      if (name === "br") return "<br />";
      return `<${name}${saubereAttribute(name, attribute)}>`;
    },
  );
}

/**
 * Legt die veroeffentlichten Texte ueber die Vorgaben im HTML.
 *
 * "nachbearbeiten" bekommt jedes ersetzte Element. seite.js traegt
 * darueber den Vereinsnamen in ein frisch eingesetztes
 * <span data-verein="name"> ein - sonst stuende im Weg zur Pfeife
 * nach einer Veroeffentlichung eine leere Luecke, weil die
 * Vereinsnamen schon beim Laden gesetzt wurden.
 *
 * Gibt zurueck, wie viele Stellen ersetzt wurden.
 */
export function wendeTexteAn(dokument, texte, nachbearbeiten = null) {
  if (!dokument || !texte || typeof texte !== "object") return 0;
  let ersetzt = 0;
  for (const element of dokument.querySelectorAll("[data-text]")) {
    const wert = texte[element.dataset.text];
    // Nur ein nicht-leerer Text ersetzt. Ein versehentlich geleertes
    // Feld darf keine Ueberschrift verschwinden lassen.
    if (typeof wert !== "string" || !wert.trim()) continue;
    const sauber = saeubereText(wert);
    if (!sauber.trim()) continue;
    if (sauber === element.innerHTML) continue;
    element.innerHTML = sauber;
    if (nachbearbeiten) nachbearbeiten(element);
    ersetzt += 1;
  }
  return ersetzt;
}
