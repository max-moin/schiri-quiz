// ============================================================
//  Welches Bild ein Motiv der Startseite bekommt
// ============================================================
//  Eigenes kleines Modul, obwohl es nur eine Funktion ist: seite.js
//  laeuft im Browser und laesst sich im Test nicht laden, die
//  Reihenfolge der drei Quellen ist aber genau das, was schiefgehen
//  kann. Hier ist sie pruefbar - tests/bilder-redaktion.test.js.
// ============================================================

/**
 * Reihenfolge: veroeffentlichtes Bild aus der Redaktion, sonst das in
 * verein.config.js hinterlegte Foto, sonst das ausgelieferte SVG.
 *
 * Das SVG kommt getrennt zurueck ("ersatz") und nicht als dritter
 * Kandidat in "quelle": es steht bereits als src im HTML. Die beiden
 * anderen muessen erst nachweislich laden, bevor sie es ersetzen duerfen -
 * so kann aus einer toten Adresse hoechstens "kein Foto" werden, nie
 * "kein Bild".
 *
 * @param {{foto?: string|null, ersatz?: string}} eintrag  Stand aus verein.config.js
 * @param {{url?: string, alt?: string}} motiv             veroeffentlichter Stand
 */
export function waehleBildmotiv(eintrag = {}, motiv = {}) {
  const sauber = (wert) => (typeof wert === "string" ? wert.trim() : "");
  const veroeffentlicht = sauber(motiv?.url);
  const foto = sauber(eintrag?.foto);
  return {
    quelle: veroeffentlicht || foto || "",
    ersatz: sauber(eintrag?.ersatz),
    // Leer heisst: den Alternativtext der Seite so lassen, wie er ist.
    // Die Motive sind schmueckend, alt="" ist dort die richtige Angabe.
    alt: sauber(motiv?.alt),
  };
}
