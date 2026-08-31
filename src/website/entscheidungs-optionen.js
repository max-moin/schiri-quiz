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
    kurz: "Weiterspielen",
    ohneRichtung: true,
    icon: svg('<path d="M7 8l7 8-7 8"/><path d="M18 8l7 8-7 8"/>'),
  },
  {
    // Ein Ball, ein Pfeil: der Ball darf direkt ins Tor.
    schluessel: "direkter_freistoss",
    label: "Direkter Freistoß",
    kurz: "Dir. Freistoß",
    icon: svg('<circle cx="8" cy="16" r="5"/><path d="M16 16h12"/><path d="M24 12l4 4-4 4"/>'),
  },
  {
    // Derselbe Ball und derselbe Pfeil wie beim direkten Freistoss -
    // nur ist der Pfeil UNTERBROCHEN. Damit lesen sich die beiden als
    // Paar: durchgezogen heisst direkt, unterbrochen heisst, jemand muss
    // vorher ran. Die Fassung mit zwei Baellen war nicht falsch, aber
    // sie war ein eigenes Bild statt der Gegenprobe zum direkten.
    schluessel: "indirekter_freistoss",
    label: "Indirekter Freistoß",
    kurz: "Indir. Freistoß",
    icon: svg('<circle cx="7" cy="16" r="4.4"/><path d="M13 16h2.5M18 16h2.5"/>' +
              '<path d="M23 16h3"/><path d="M23.5 13l3 3-3 3"/>'),
  },
  {
    // Aus der Sicht des Schuetzen: Tor voraus, Strafstossmarke davor,
    // der Ball geht AUFS Tor. Max am 31.08.2026: "Beim Strafstoss aus
    // der Perspektive, dass du Tor, Ball und dann erst Spieler hast,
    // also dass du aufs Tor guckst."
    //
    // Der Unterschied zum Abstoss ist damit die Richtung: hier zum Tor
    // hin, dort vom Tor weg. Das ist der einzige Unterschied, der auch
    // bei 22 px noch traegt.
    schluessel: "strafstoss",
    label: "Strafstoß",
    kurz: "Strafstoß",
    icon: svg('<path d="M5 14V5h22v9"/><path d="M11 5v9M16 5v9M21 5v9" opacity=".3"/>' +
              '<circle cx="16" cy="26" r="2.4" fill="currentColor" stroke="none"/>' +
              '<path d="M16 22v-4"/><path d="M13 21l3-3 3 3"/>'),
  },
  {
    schluessel: "sr_ball",
    label: "Schiedsrichter-Ball",
    kurz: "SR-Ball",
    ohneRichtung: true,
    icon: svg('<path d="M16 3v7"/><path d="M12 7l4 4 4-4"/>' +
              '<circle cx="16" cy="18" r="6"/><path d="M5 28h22"/>'),
  },
  {
    // Die Fahne steht jetzt WIRKLICH auf der Ecke und ist geneigt.
    // Vorher stand der Mast bei x=20, also mitten im Feld - das Icon
    // zeigte eine Fahne irgendwo, nicht die Eckfahne. Max am 31.08.2026:
    // "Dass die Ecke so angewinkelt ist, damit die Fahne dann auch
    // wirklich auf der Ecke stehen kann und man die Fahne trotzdem
    // deutlich erkennt."
    schluessel: "eckstoss",
    label: "Eckstoß",
    kurz: "Eckstoß",
    icon: svg('<path d="M3 27h26"/><path d="M3 27V7"/><path d="M3 19a8 8 0 0 0 8 8"/>' +
              '<path d="M6 27L10 6"/><path d="M10 6l9 3.5-10 3z" fill="currentColor"/>'),
  },
  {
    // Tor an der Seite, Ball davor, Pfeil VOM Tor weg. Bewusst die
    // Seitenansicht und nicht dieselbe Frontalsicht wie beim Strafstoss:
    // zwei frontale Tore untereinander sind bei 22 px nicht mehr
    // auseinanderzuhalten, die Blickrichtung dagegen schon.
    schluessel: "abstoss",
    label: "Abstoß",
    kurz: "Abstoß",
    icon: svg('<path d="M4 14V5h13v9"/><path d="M9 5v9M13 5v9" opacity=".3"/>' +
              '<circle cx="10.5" cy="21" r="3.2"/><path d="M15 24h9"/><path d="M21 21l3 3-3 3"/>'),
  },
  {
    // Ball ueber dem Kopf in beiden Haenden - die Haltung, die den
    // Einwurf ausmacht. Max am 31.08.2026 zum alten Icon: "Das gefaellt
    // mir gar nicht, dass alles so ineinandergequetscht ist mit
    // irgendwie so einem halben Pfeil. Da hatten wir eigentlich mit der
    // Hand, das war eigentlich ganz gut."
    schluessel: "einwurf",
    label: "Einwurf",
    kurz: "Einwurf",
    icon: svg('<circle cx="16" cy="9" r="5.5"/>' +
              '<path d="M8 17c1.6 3.4 4.6 5.2 8 5.2s6.4-1.8 8-5.2"/>' +
              '<path d="M11 22v6M16 23.5v5M21 22v6"/>'),
  },
  {
    schluessel: "anstoss",
    label: "Anstoß",
    kurz: "Anstoß",
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

// Kurzform fuer die Knopfraster. Max am 31.08.2026: "Schiedsrichterball
// kann auch mit SR-Ball abgekuerzt werden, direkter und indirekter
// Freistoss koennte zur Not auch abgekuerzt werden, damit das besser in
// die Boxen passt."
//
// Der lange Name bleibt trotzdem erhalten und wird als title und
// aria-label gesetzt: abgekuerzt wird nur, was man sieht, nicht das, was
// ein Vorleseprogramm sagt.
export function fortsetzungKurz(schluessel) {
  const eintrag = FORTSETZUNGEN.find((f) => f.schluessel === schluessel);
  return eintrag?.kurz || eintrag?.label || "—";
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
