// ============================================================
//  Vereins-Konfiguration
// ============================================================
//  Die EINZIGE Stelle mit Vereinsspezifischem. Ein anderer Verein aus
//  dem Stadtverband kopiert das Projekt, ändert nur diese Datei und hat
//  seine eigene Seite.
//
//  Regel dahinter: kein Vereinsname, keine Farbe und kein Link direkt im
//  übrigen Code.
// ============================================================

export const VEREIN = {
  name: "FV Löbtauer Kickers",
  kurz: "Löbtauer Kickers",
  abteilung: "Schiedsrichter-Abteilung",
  kuerzel: "FVLK",

  // Von Max geliefert (18.08.2026): saubere Version mit flachen Farben und
  // transparentem Hintergrund, deutlich besser als das Pin-Foto.
  // "logoGross" ist die vierfach hochgerechnete Fassung für große
  // Darstellungen - im Original nur 99 px.
  logo: "bilder/logo.png",
  logoGross: "bilder/logo@4x.png",

  farben: { marke: "#1f2937", akzent: "#00A03B" },

  // email bewusst null: Sobald hier eine Adresse steht, erscheint sie im
  // Klartext auf der öffentlichen Vorlagenseite und ist für Spam-Sammler
  // lesbar. Das ist eine Entscheidung, die Max treffen muss, nicht ich.
  // Solange null, steht dort "[E-Mail eures Obmanns]".
  kontakt: { obmann: "Max M.", email: null },

  links: {
    verein: null,
    stadtverband: "https://www.svf-dresden.de",
    // Max' Vorgabe: lieber direkt in den Schiedsrichter-Bereich statt auf
    // die allgemeine Startseite - von dort muss man erst suchen.
    stadtverbandSchiri: "https://www.svf-dresden.de/schiedsrichter/",
    stadtverbandDokumente: "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
    dfbnet: "https://www.dfbnet.org",
  },
};

// ============================================================
//  Spielklassen mit Entschädigungssätzen
// ============================================================
//  Grundlegend umgebaut (18.08.2026) nach Max' Kritik:
//
//  1. "Wenn Herren bei der Altersklasse ausgewählt ist, ist es halt nur
//     noch Stadtliga A, B, C" - die Sponsorennamen ("brandible",
//     "Sparkassen-", "Mobilplus im O.D.C.") und die Wiederholung der
//     Altersklasse sind raus. Sie stehen als "voll" weiterhin drin, damit
//     man den offiziellen Namen nachschlagen kann.
//
//  2. Die Reihenfolge folgt jetzt der SPIELSTÄRKE von unten nach oben,
//     wie Max sie vorgegeben hat: Stadtklasse, Stadtliga C, B, A,
//     Stadtoberliga, Landesklasse, Landesliga, Oberliga, Regionalliga.
//     Vorher standen sie in der Reihenfolge des PDFs - fachlich willkürlich.
//
//  3. Stadtverband und Landesebene sind in EINER Liste zusammengeführt.
//     Vorher musste man vorher die "Ebene" wählen, obwohl die sich aus der
//     Liga ohnehin ergibt. Ein Bedienschritt weniger.
//
//  "stufe" bestimmt die Sortierung, "verband" nur die Anzeige und die
//  Fahrtkostenregel. sra: null heißt ausdrücklich "hier gibt es keine
//  Assistenten" - die Oberfläche MUSS das abfangen.
//
//  Quellen: Entschädigungssätze SVFD (Max, 18.08.2026) und Finanzordnung
//  Sächsischer Fußball-Verband, Stand 01.07.2025.
// ============================================================

export const ALTERSKLASSEN = [
  {
    name: "Herren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",    voll: "Stadtklassen Herren",            verband: "svfd", sr: 25, sra: 20 },
      { stufe: 2, kurz: "Stadtliga C",    voll: "brandible Stadtliga C Herren",   verband: "svfd", sr: 25, sra: 20 },
      { stufe: 3, kurz: "Stadtliga B",    voll: "brandible Stadtliga B Herren",   verband: "svfd", sr: 25, sra: 20 },
      { stufe: 4, kurz: "Stadtliga A",    voll: "brandible Stadtliga A Herren",   verband: "svfd", sr: 30, sra: 25 },
      { stufe: 5, kurz: "Stadtoberliga",  voll: "Sparkassenoberliga Herren",      verband: "svfd", sr: 40, sra: 30 },
      { stufe: 6, kurz: "Landesklasse",   voll: "Landesklasse Herren",            verband: "sfv",  sr: 45, sra: 35 },
      { stufe: 7, kurz: "Landesliga",     voll: "Landesliga Herren",              verband: "sfv",  sr: 55, sra: 45 },
    ],
  },
  {
    name: "Frauen",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",  voll: "Stadtklassen Frauen",                    verband: "svfd", sr: 25, sra: 20 },
      { stufe: 2, kurz: "Stadtliga",    voll: "Mobilplus im O.D.C. Stadtliga Frauen",   verband: "svfd", sr: 25, sra: 20 },
      { stufe: 6, kurz: "Landesklasse", voll: "Landesklasse Frauen",                    verband: "sfv",  sr: 30, sra: 25 },
      { stufe: 7, kurz: "Landesliga",   voll: "Landesliga Frauen",                      verband: "sfv",  sr: 35, sra: 30 },
    ],
  },
  {
    name: "A-Junioren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse A-Junioren",   verband: "svfd", sr: 25, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga A-Junioren",     verband: "svfd", sr: 25, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga A-Junioren", verband: "svfd", sr: 25, sra: 20 },
      { stufe: 7, kurz: "Landesliga",    voll: "Landesliga A-Junioren",    verband: "sfv",  sr: 30, sra: 25 },
    ],
  },
  {
    name: "B-Junioren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse B-Junioren",   verband: "svfd", sr: 22, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga B-Junioren",     verband: "svfd", sr: 22, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga B-Junioren", verband: "svfd", sr: 22, sra: 20 },
    ],
  },
  {
    name: "C-Junioren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse C-Junioren",     verband: "svfd", sr: 22, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga C-Junioren",       verband: "svfd", sr: 22, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga C-Junioren",   verband: "svfd", sr: 22, sra: 20 },
      { stufe: 6, kurz: "Landesklasse",  voll: "Landesklasse C-Junioren",    verband: "sfv",  sr: 20, sra: 15 },
    ],
  },
  {
    name: "D- bis G-Jugend",
    ligen: [
      { stufe: 1, kurz: "Alle Spielklassen", voll: "Sonstige Junioren im Stadtspielbetrieb", verband: "svfd", sr: 17, sra: null },
    ],
  },
  {
    name: "Senioren / Altherren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse Senioren",   verband: "svfd", sr: 25, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga Senioren",     verband: "svfd", sr: 25, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga Senioren", verband: "svfd", sr: 25, sra: 20 },
    ],
  },
  {
    name: "Freizeitsport",
    ligen: [
      { stufe: 1, kurz: "Alle Ligen", voll: "Freizeitsport (alle Ligen)", verband: "svfd", sr: 25, sra: 20 },
    ],
  },
  {
    name: "Sonderfunktionen",
    ligen: [
      { stufe: 1, kurz: "Schiedsrichter-Pate",  voll: "Schiedsrichter-Pate",                   verband: "svfd", sr: 20, sra: null },
      { stufe: 2, kurz: "Beobachter (Stadt)",   voll: "Schiedsrichter- und Spielbeobachter",   verband: "svfd", sr: 30, sra: null },
      { stufe: 3, kurz: "Beobachter (Land)",    voll: "Beobachter, alle Klassen",              verband: "sfv",  sr: 35, sra: null },
    ],
  },
];

export const VERBAENDE = {
  svfd: { kurz: "Stadtverband", voll: "Stadtverband Fußball Dresden" },
  sfv:  { kurz: "Landesebene",  voll: "Sächsischer Fußball-Verband" },
};

// Turnier-Sonderregel, unabhängig von der Spielklasse.
export const TURNIER = { grundpauschale: 32, grundstunden: 4, jeWeitereStunde: 8 };

// ============================================================
//  Fahrtkosten
// ============================================================
//  KORRIGIERT nach Max' Rückmeldung (18.08.2026). Vorher rechnete der
//  Rechner bei zwei Zonen "3,60 € + 3,30 €" - also den Dresden-Preis für
//  die eine und den günstigeren Nachbarzonen-Preis für die andere Zone.
//
//  Max wörtlich: "es sind einfach viermal 3,60". Also: Der Preis pro
//  Einzelkarte ist IMMER derselbe, und man braucht zwei Karten je
//  durchfahrener Zone (hin und zurück).
//
//    1 Zone  ->  2 Karten  ->  7,20 €
//    2 Zonen ->  4 Karten  -> 14,40 €
//
//  Preis: VVO-Einzelfahrt Tarifzone Dresden, Stand 1. April 2026.
// ============================================================

export const FAHRTKOSTEN = {
  preisJeKarte: 3.60,
  kartenJeZone: 2,
};

// ============================================================
//  Vereine des Stadtverbands
// ============================================================
//  Liste von Max (18.08.2026).
//  lage: "dd" = Tarifzone Dresden · "aus" = außerhalb, zwei Zonen
//        "frag" = außerhalb, genaue Zone noch nicht geprüft
//
//  🔴 Offen: Ob die auswärtigen Orte im VVO wirklich direkt an Dresden
//  grenzen, ist bislang eine Annahme. Vor dem Livegang am Zonenplan
//  abgleichen.
// ============================================================

export const VEREINE = [
  { name: "FFC Fortuna Dresden e.V.", lage: "dd" },
  { name: "BSV Lockwitzgrund", lage: "dd" },
  { name: "Dresdner SC 1898", lage: "dd" },
  { name: "Dresdner SSV", lage: "dd" },
  { name: "FC Dresden e.V.", lage: "dd" },
  { name: "FSG Wacker 90 Dresden-Leuben", lage: "dd" },
  { name: "FSV Lokomotive Dresden", lage: "dd" },
  { name: "Fußball Campus Dresden e.V.", lage: "dd" },
  { name: "FV Blau-Weiß Zschachwitz", lage: "dd" },
  { name: "FV Dresden 06 Laubegast", lage: "dd" },
  { name: "FV Dresden Süd-West", lage: "dd" },
  { name: "FV Hafen Dresden", lage: "dd" },
  { name: "FV Löbtauer Kickers 93", lage: "dd" },
  { name: "IntegraLES e.V.", lage: "dd" },
  { name: "Postsportverein Dresden", lage: "dd" },
  { name: "Racket- und Ballsport Dresden", lage: "dd" },
  { name: "Radeberger SV", lage: "aus", ort: "Radeberg" },
  { name: "Radebeuler BC 08", lage: "aus", ort: "Radebeul" },
  { name: "SC Borea Dresden", lage: "dd" },
  { name: "Serkowitzer FSV", lage: "aus", ort: "Serkowitz (Radebeul)" },
  { name: "SG Bühlau 2009 e.V.", lage: "dd" },
  { name: "SG Dölzschen 1928", lage: "dd" },
  { name: "SG Dresden Striesen", lage: "dd" },
  { name: "SG Dresdner Verkehrsbetriebe e.V.", lage: "dd" },
  { name: "SG Dynamo Dresden", lage: "dd" },
  { name: "SG Einheit Dresden-Mitte", lage: "dd" },
  { name: "SG Gebergrund Goppeln", lage: "aus", ort: "Goppeln (Bannewitz)" },
  { name: "SG Gittersee", lage: "dd" },
  { name: "SG Motor Dresden-Mitte", lage: "dd" },
  { name: "SG Motor Dresden-Trachenberge", lage: "dd" },
  { name: "SG Ullersdorf", lage: "frag", ort: "außerhalb Dresdens, Zone offen" },
  { name: "SG Weißig", lage: "dd" },
  { name: "SG Weixdorf", lage: "dd" },
  { name: "Soccer for Kids Dresden", lage: "dd" },
  { name: "Sportfreunde 01 Dresden-Nord", lage: "dd" },
  { name: "SpVgg. Dresden-Löbtau", lage: "dd" },
  { name: "SSV Turbine Dresden", lage: "dd" },
  { name: "SV Dresden-Mitte 1950", lage: "dd" },
  { name: "SV Dresden-Neustadt", lage: "dd" },
  { name: "SV Dresden-Pillnitz", lage: "dd" },
  { name: "SV Eintracht Dobritz 1950", lage: "dd" },
  { name: "SV Eintracht Strehlen", lage: "dd" },
  { name: "SV Fortuna Dresden-Rähnitz", lage: "dd" },
  { name: "SV Freital 06", lage: "aus", ort: "Freital" },
  { name: "SV FS Rossendorf", lage: "frag", ort: "außerhalb Dresdens, Zone offen" },
  { name: "SV Helios 24 Dresden", lage: "dd" },
  { name: "SV Johannstadt 90", lage: "dd" },
  { name: "SV Loschwitz", lage: "dd" },
  { name: "SV Sachsenwerk Dresden", lage: "dd" },
  { name: "TSV Cossebaude", lage: "dd" },
  { name: "TSV Reichenberg-Boxdorf", lage: "aus", ort: "Boxdorf (Moritzburg)" },
  { name: "TSV Rotation Dresden 1990", lage: "dd" },
  { name: "USV TU Dresden", lage: "dd" },
  { name: "VfB Hellerau-Klotzsche", lage: "dd" },
  { name: "Sonstige", lage: "frag", ort: "Ort bitte selbst angeben" },
];
