// ============================================================
//  Welches Dokument gehoert an welche Regelzeile
// ============================================================
//  Max am 12.09.2026:
//  "Was halt auch noch ganz cool waer, wenn man fuer jede
//   Ausnahmeregelung in der Regeluebersicht das jeweilige Dokument
//   angehaengt bekommt. [...] und dass da halt die jeweiligen Dokumente
//   angehaengt werden und nicht einfach nur unten dasteht: Okay, aus
//   diesen allen Quellen hatte ich das zusammengesucht."
//
//  Genau das war der Zustand: am Seitenende eine Liste aller Quellen.
//  Wer bei den C-Junioren steht und wissen will, WO das herkommt, muss
//  dort selbst heraussuchen, welches der 23 Dokumente gemeint ist.
//
//  Warum die Zuordnung hier abgeleitet wird und nicht an jeder Zeile
//  gepflegt: Die Regeldaten kommen aus dem Obmann-Bereich und koennen
//  jederzeit neu veroeffentlicht werden. Ein zusaetzliches Feld je Zeile
//  muesste im Editor gepflegt werden und waere bei jeder neuen Zeile
//  wieder leer. Die Ableitung greift dagegen sofort - auch fuer Zeilen,
//  die es heute noch nicht gibt.
//
//  WICHTIG - die Grenze dieser Datei: Jede Regel unten ist durch die
//  Selbstbeschreibung des Dokuments gedeckt, nicht durch eine fachliche
//  Annahme von mir. "Handreichung des SVFD" sagt selbst "Was in Dresden
//  bei C- und D-Junioren gilt", "Kleinfeldbestimmungen" sagt selbst "von
//  G- bis C-Junioren". Wo ein Dokument nichts ueber seinen Geltungs-
//  bereich sagt, wird es NICHT angehaengt - lieber keine Quelle als eine
//  falsche an einer Regelzeile.
// ============================================================

// Altersklassen, die auf dem Kleinfeld spielen. Steht so in der
// Selbstbeschreibung der Kleinfeldbestimmungen ("von G- bis C-Junioren").
const KLEINFELD = /^(C|D|E|F|G)-Junior/i;

// Die Handreichung nennt ausdruecklich C- und D-Junioren. Juniorinnen
// stehen dort nicht - also werden sie auch nicht mitgezogen.
const HANDREICHUNG = /^(C|D)-Junioren$/i;

const FRAUEN = /^(Frauen|[A-G]-Juniorinnen)$/i;
const JUNIOREN = /^[A-G]-Junioren$/i;

// Eine Zeile kann unter der Stadtverbands-Quelle stehen und trotzdem auf
// die Landesebene zeigen - die D-Junioren-Landesklasse tut genau das und
// sagt es in ihrem eigenen Warnhinweis ("Landesebene, also gilt der
// SFV"). Fuer die Dokumentenwahl zaehlt, was die Zeile SELBST sagt.
export function wirksameQuelle(zeile, ebene) {
  const klasse = String(zeile?.k || "");
  if (/Landes(klasse|liga)|Sachsen(liga|klasse)/i.test(klasse)) return "sfv";
  return ebene === "sfv" ? "sfv" : "svfd";
}

// EIN NEUES DOKUMENT ANHAENGEN:
//  1. Dokument im Obmann-Bereich unter "Unterlagen" anlegen. Es bekommt
//     dort eine Kennung (dokument-24, dokument-25, ...).
//  2. Hier einen Eintrag ergaenzen: Kennung, ein Satz Begruendung, und
//     wann er gilt. Fehlt das Dokument in der Datenbank, passiert nichts -
//     die Zeile bleibt einfach ohne diesen Beleg.
//  Noch NICHT hinterlegt (Stand 12.09.2026): die Regelung, dass eine
//  Mannschaft bei drei Toren Rueckstand einen zusaetzlichen Spieler
//  holen darf. Sie ist unter keinem der 23 Dokumente zu finden - erst
//  anlegen, dann hier eintragen. Nicht erfinden.
//
// Jeder Eintrag: welches Dokument, wann es gilt, und in einem Satz warum.
// Der Satz erscheint neben dem Link - ein Dokumententitel allein sagt
// nicht, warum er ausgerechnet hier steht.
const ZUORDNUNG = [
  {
    id: "dokument-1",
    grund: "Das Original, aus dem diese Tabelle stammt.",
    gilt: (zeile, quelle) => quelle === "svfd",
  },
  {
    id: "dokument-2",
    grund: "Gilt in Dresden vor der Kurzübersicht: 9 gegen 9, Viertel, Mittellinienregel.",
    gilt: (zeile, quelle) => quelle === "svfd" && HANDREICHUNG.test(String(zeile?.a || "")),
  },
  {
    id: "dokument-10",
    grund: "Die Landesfassung für Sachsenliga, Sachsenklasse und Landespokal.",
    gilt: (zeile, quelle) => quelle === "sfv" && JUNIOREN.test(String(zeile?.a || "")),
  },
  {
    id: "dokument-13",
    grund: "Die Landesfassung für Frauen und Juniorinnen.",
    gilt: (zeile, quelle) => quelle === "sfv" && FRAUEN.test(String(zeile?.a || "")),
  },
  {
    id: "dokument-11",
    grund: "Maße, Torgrößen und der kürzere Freistoßabstand auf dem Kleinfeld.",
    gilt: (zeile) => KLEINFELD.test(String(zeile?.a || "")),
  },
];

// Liefert die Dokumente, die an diese eine Regelzeile gehoeren.
// "dokumente" ist die Liste aus dem Bereich "unterlagen" - fehlt sie
// (Datenbank nicht erreichbar), kommt eine leere Liste zurueck und die
// Karte sieht aus wie vorher. Kein Grund, deshalb die Regeln zu
// verstecken.
export function passendeDokumente(zeile, ebene, dokumente) {
  if (!Array.isArray(dokumente) || !zeile) return [];
  const quelle = wirksameQuelle(zeile, ebene);
  const treffer = [];
  for (const regel of ZUORDNUNG) {
    if (!regel.gilt(zeile, quelle)) continue;
    const dokument = dokumente.find((d) => d?.id === regel.id && d?.aktiv !== false && d?.href);
    if (dokument) treffer.push({ ...dokument, grund: regel.grund });
  }
  return treffer;
}
