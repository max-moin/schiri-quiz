// ============================================================
//  Die Antwortmoeglichkeiten des Entscheidungs-Modus
// ============================================================
//  Nur Daten und Zeichnungen, kein Serverzugriff und keine Seite. Der
//  Modus auf der Website und spaeter die Auswertung benutzen dieselbe
//  Liste - sonst driften Beschriftung und Datenbankwert auseinander.
//
//  Die Schluessel sind woertlich die CHECK-Werte aus v93. Wer hier
//  etwas umbenennt, muss die Migration mitziehen.
//
//  ------------------------------------------------------------
//  Zwei Achsen, mehr gibt es nicht
//  ------------------------------------------------------------
//  Eine Schiedsrichter-Entscheidung besteht immer aus genau zwei
//  Teilen: wie es weitergeht, und ob jemand bestraft wird. Das ist der
//  ganze Lerneffekt - "Strafstoss + Gelb" ist richtig, "Strafstoss +
//  Rot" der Klassikerfehler.
//
//  Neun Spielfortsetzungen, mehr gibt es im Regelwerk nicht.
//  Vier persoenliche Strafen. Max am 29.08.2026 zur Zeitstrafe: "Das
//  gibt es im Profifussball nicht, und die Fragen sind alle an
//  Profifussball orientiert." Damit sind es vier statt fuenf.
//
//  ------------------------------------------------------------
//  Warum jedes Icon ein Textlabel behaelt
//  ------------------------------------------------------------
//  Hausregel seit dem 10.07.2026. Ein Icon allein ist eine Vermutung -
//  bei "Abstoss" und "Strafstoss" sieht man beide Male ein Rechteck mit
//  einem Ball. Das Icon macht schnell, der Text macht sicher.
// ============================================================

// Gemeinsame Strichfuehrung. Alle Icons sind dieselbe Bildsprache aus
// Spielfeldmarkierungen und Schiedsrichter-Zeichen: bei direktem und
// indirektem Freistoss ist das Icon genau das Armzeichen, wer das Icon
// lernt, lernt das Zeichen mit.
const STRICH = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const svg = (inneres) =>
  `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g ${STRICH}>${inneres}</g></svg>`;

export const FORTSETZUNGEN = [
  {
    schluessel: "weiterspielen",
    label: "Weiterspielen",
    ohneRichtung: true,
    icon: svg('<path d="M7 8l7 8-7 8"/><path d="M18 8l7 8-7 8"/>'),
  },
  {
    // Ein Ball, ein Pfeil: der Ball darf direkt ins Tor.
    schluessel: "direkter_freistoss",
    label: "Direkter Freistoß",
    icon: svg('<circle cx="8" cy="16" r="5"/><path d="M16 16h12"/><path d="M24 12l4 4-4 4"/>'),
  },
  {
    // Max' Einfall: der zweite Ball ist die zweite Beruehrung. Genau
    // das ist der Unterschied - indirekt heisst, jemand muss vorher ran.
    schluessel: "indirekter_freistoss",
    label: "Indirekter Freistoß",
    icon: svg('<circle cx="5" cy="16" r="3.4"/><path d="M10 16h3"/>' +
              '<circle cx="16" cy="16" r="3.4"/><path d="M21 16h5"/><path d="M23 13l3 3-3 3"/>'),
  },
  {
    // Strafraumbogen mit Punkt. Der Bogen ist die einzige Form, die es
    // sonst nirgends auf dem Platz gibt - deshalb kein Rechteck mehr,
    // das mit dem Tor beim Abstoss verwechselt wurde.
    schluessel: "strafstoss",
    label: "Strafstoß",
    icon: svg('<path d="M3 20h6"/><path d="M9 20a7 7 0 0 0 14 0"/><path d="M23 20h6"/>' +
              '<circle cx="16" cy="12" r="2.6" fill="currentColor" stroke="none"/>'),
  },
  {
    schluessel: "sr_ball",
    label: "Schiedsrichter-Ball",
    ohneRichtung: true,
    icon: svg('<path d="M16 3v7"/><path d="M12 7l4 4 4-4"/>' +
              '<circle cx="16" cy="18" r="6"/><path d="M5 28h22"/>'),
  },
  {
    schluessel: "eckstoss",
    label: "Eckstoß",
    icon: svg('<path d="M4 28h24"/><path d="M4 28V6"/><path d="M4 20a8 8 0 0 0 8 8"/>' +
              '<path d="M20 28V5"/><path d="M20 6l8 3-8 3z" fill="currentColor"/>'),
  },
  {
    // Echtes Tor mit Pfosten und Latte, Ball davor, Pfeil weg vom Tor.
    schluessel: "abstoss",
    label: "Abstoß",
    icon: svg('<path d="M5 17V6h22v11"/><path d="M10 6v11M16 6v11M22 6v11" opacity=".3"/>' +
              '<circle cx="10" cy="24" r="3.4"/><path d="M16 24h11"/><path d="M23 21l4 3-4 3"/>'),
  },
  {
    // Seitenlinie senkrecht, Ball ausserhalb, Bogen darueber ins Feld.
    schluessel: "einwurf",
    label: "Einwurf",
    icon: svg('<path d="M9 3v26"/><circle cx="5" cy="21" r="3"/>' +
              '<path d="M6 17C8 7 20 6 25 13"/><path d="M21 12l4 1-1 4"/>'),
  },
  {
    schluessel: "anstoss",
    label: "Anstoß",
    icon: svg('<path d="M16 3v26"/><circle cx="16" cy="16" r="9"/>' +
              '<circle cx="16" cy="16" r="2.2" fill="currentColor" stroke="none"/>'),
  },
];

// Die Karten sind bewusst KEINE SVG-Strichzeichnungen, sondern Flaechen
// in der echten Farbe. Eine gelbe Karte erkennt man an Gelb, nicht an
// ihrer Kontur - ein Umriss waere hier schlechter als das Original.
export const STRAFEN = [
  { schluessel: "keine",    label: "Keine",         art: "keine" },
  { schluessel: "gelb",     label: "Gelbe Karte",   art: "gelb" },
  { schluessel: "gelb_rot", label: "Gelb-Rot",      art: "gelbrot" },
  { schluessel: "rot",      label: "Rote Karte",    art: "rot" },
];

export const ROLLEN = {
  feldspieler: "Feldspieler",
  torwart: "Torwart",
  auswechselspieler: "Auswechselspieler",
  trainer: "Trainer oder Betreuer",
};

// Nur diese beiden brauchen keine Mannschaft. Dieselbe Liste steht als
// CHECK in szenario_loesungen (v93) - zwei Orte, weil die Datenbank sich
// nicht auf den Browser verlassen darf und umgekehrt.
export const OHNE_RICHTUNG = FORTSETZUNGEN
  .filter((f) => f.ohneRichtung)
  .map((f) => f.schluessel);

export function fortsetzungLabel(schluessel) {
  return FORTSETZUNGEN.find((f) => f.schluessel === schluessel)?.label || "—";
}

export function strafeLabel(schluessel) {
  return STRAFEN.find((s) => s.schluessel === schluessel)?.label || "—";
}

export function brauchtRichtung(schluessel) {
  return schluessel != null && !OHNE_RICHTUNG.includes(schluessel);
}

// "heim" und "gast" sind Datenbankwerte; angezeigt wird die Trikotfarbe
// des Szenarios. Max: die beiden Farben gehoeren ans Szenario, nicht
// fest gelb/blau - sonst tippt man auf "gelb" und meint das blaue Team.
export function mannschaftLabel(schluessel) {
  return schluessel === "heim" ? "Heim" : schluessel === "gast" ? "Gast" : "—";
}
