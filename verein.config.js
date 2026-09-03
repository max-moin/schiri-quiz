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

  // ============================================================
  // Schlüssel für die Terminabfrage der Startseite.
  //
  // ACHTUNG, hier stand am 22.08.2026 kurzzeitig die Vereinskennung.
  // Sie wird hier absichtlich NICHT genannt - auch ein Kommentar wird
  // an jeden Besucher ausgeliefert. Das war ein Fehler, und zwar ein
  // ernster: Die
  // Vereinskennung ist im Quiz ein Zugangsgeheimnis. app.js verdeckt
  // das Eingabefeld absichtlich ("irgendwo trotzdem ein Passwort"),
  // und schiri_liste(p_kennung) gibt allein mit der Kennung, ohne PIN,
  // die Namen aller Schiedsrichter des Vereins heraus - bei einem
  // Einstiegsalter von 12 Jahren also auch die von Minderjährigen.
  // Diese Datei wird von jedem Besucher der Startseite geladen.
  //
  // Deshalb gibt es jetzt einen zweiten, ausdrücklich öffentlichen
  // Schlüssel (vereine.oeffentliche_kennung, Migration v84). Er öffnet
  // nichts außer den freigegebenen Terminen.
  //
  // Die Vereinskennung gehört NIE in diese Datei.
  // ============================================================
  seitenschluessel: "loebtauer-kickers",

  // Vorbelegung im Spesenrechner. Max, 21.08.2026: "Ich weiß auch nicht,
  // warum standardmäßig die 01159 hinterlegt ist." Sie stand fest im HTML -
  // 01159 ist Löbtau, also die Gegend des Vereins. Jetzt steht sie hier, wo
  // ein anderer Verein sie ändern kann, ohne den Rechner anzufassen.
  // Auf null setzen heißt: Feld bleibt leer.
  standortPlz: "01159",

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
//  Zugang zur Datenbank für den ÖFFENTLICHEN Teil
// ============================================================
//  Steht hier statt in index.html, weil diese Datei die einzige Stelle
//  mit Vereinsspezifischem sein soll - ein zweiter Verein soll nichts
//  anderes anfassen müssen.
//
//  Der Schlüssel ist ein "publishable key". Er ist dafür gemacht, im
//  Browser zu stehen; der Schutz kommt aus den Rechten in der Datenbank,
//  nicht aus seiner Geheimhaltung. Ein sb_secret_... oder ein
//  service_role-Schlüssel hat hier NICHTS zu suchen - der Test in
//  tests/api-sicherheit.test.js prüft das.
export const DATENBANK = {
  adresse: "https://ivwmixaicpmtvcjtnbjv.supabase.co",
  oeffentlicherSchluessel: "sb_publishable_ceeSGcYMSSLSdAJgqbC8mQ_W93x2oq8",
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
      { stufe: 6, kurz: "Landesklasse",  voll: "Landesklasse A-Junioren",  verband: "sfv",  sr: 25, sra: 20 },
      { stufe: 7, kurz: "Landesliga",    voll: "Landesliga A-Junioren",    verband: "sfv",  sr: 30, sra: 25 },
    ],
  },
  {
    name: "B-Junioren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse B-Junioren",   verband: "svfd", sr: 22, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga B-Junioren",     verband: "svfd", sr: 22, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga B-Junioren", verband: "svfd", sr: 22, sra: 20 },
      { stufe: 6, kurz: "Landesklasse",  voll: "Landesklasse B-Junioren",  verband: "sfv",  sr: 25, sra: 20 },
      { stufe: 7, kurz: "Landesliga",    voll: "Landesliga B-Junioren",    verband: "sfv",  sr: 30, sra: 25 },
    ],
  },
  {
    name: "C-Junioren",
    ligen: [
      { stufe: 1, kurz: "Stadtklasse",   voll: "Stadtklasse C-Junioren",     verband: "svfd", sr: 22, sra: 20 },
      { stufe: 3, kurz: "Stadtliga",     voll: "Stadtliga C-Junioren",       verband: "svfd", sr: 22, sra: 20 },
      { stufe: 5, kurz: "Stadtoberliga", voll: "Stadtoberliga C-Junioren",   verband: "svfd", sr: 22, sra: 20 },
      { stufe: 6, kurz: "Landesklasse",  voll: "Landesklasse C-Junioren",    verband: "sfv",  sr: 20, sra: 15 },
      { stufe: 7, kurz: "Landesliga",    voll: "Landesliga C-Junioren",      verband: "sfv",  sr: 25, sra: 20 },
    ],
  },
  {
    name: "D- bis G-Jugend",
    ligen: [
      { stufe: 1, kurz: "Alle Spielklassen", voll: "Sonstige Junioren im Stadtspielbetrieb", verband: "svfd", sr: 17, sra: null },
      // Auf Landesebene gibt es für D-Junioren keine Assistenten-Entschädigung
      // (Anlage 1 der SFV-Finanzordnung führt dort nur einen Satz).
      { stufe: 6, kurz: "Landesklasse D-Jun.", voll: "Landesklasse D-Junioren", verband: "sfv", sr: 15, sra: null },
    ],
  },
  // Juniorinnen fehlten bisher ganz. Aufgenommen sind nur die Klassen, die
  // in Anlage 1 der SFV-Finanzordnung stehen - also die Landesebene. Für den
  // Stadtspielbetrieb liegen mir keine Sätze vor; sobald Max sie hat, hier
  // mit verband: "svfd" ergaenzen.
  {
    name: "B-Juniorinnen",
    ligen: [
      { stufe: 6, kurz: "Landesklasse", voll: "Landesklasse B-Juniorinnen", verband: "sfv", sr: 18, sra: null },
      { stufe: 7, kurz: "Landesliga",   voll: "Landesliga B-Juniorinnen",   verband: "sfv", sr: 25, sra: 20 },
    ],
  },
  {
    name: "C-Juniorinnen",
    ligen: [
      { stufe: 6, kurz: "Landesklasse", voll: "Landesklasse C-Juniorinnen", verband: "sfv", sr: 16, sra: null },
      { stufe: 7, kurz: "Landesliga",   voll: "Landesliga C-Juniorinnen",   verband: "sfv", sr: 20, sra: 15 },
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

// ============================================================
//  Fahrtkosten - ZWEI Regelwerke, je nach Ebene des Spiels
// ============================================================
//  Max' Festlegung vom 21.08.2026: "Alle Spiele auf Landesebene werden
//  nach den Sachen, was der Sächsische Fußballverband veröffentlicht hat,
//  und alle auf Stadtebene von dem, was der Stadtverband Fußball Dresden
//  veröffentlicht hat, berechnet."
//
//  Welche Ebene gilt, steht an der Liga selbst (Feld "verband").
// ============================================================

export const FAHRTKOSTEN = {
  // --- Stadtebene: die Dresdner Regel, von Max zweimal bestätigt.
  //     Zwei Einzelkarten je durchfahrener Zone, hin und zurück.
  svfd: {
    preisJeKarte: 3.60,
    kartenJeZone: 2,
  },

  // --- Landesebene: § 8 der SFV-Finanzordnung, Fassung vom 31.07.2025.
  //
  //     Wörtlich zur Pauschale: "Bei Nutzung einer Jahres- oder Monatskarte
  //     für öffentliche Verkehrsmittel kann jeweils eine Pauschalgebühr
  //     i.H.v. 3,50 € pro Veranstaltung/Einsatz abgerechnet werden."
  //     "Pro Einsatz" heißt: einmal für das ganze Spiel, nicht je Richtung.
  sfv: {
    monatskartePauschale: 3.50,
    kmAuto: 0.35,
    kmZuschlagMitnahme: 0.04,
    kmFahrrad: 0.10,
  },
};

// Anlage 1 der SFV-Finanzordnung: "Schiedsrichter und Schiedsrichter-
// assistenten erhalten bei Spielausfall gleich aus welchem Grund 50 % der
// Entschädigungspauschale."
export const AUSFALL_ANTEIL = 0.5;

// ============================================================
//  Bilder - mit Rückfallebene
// ============================================================
//  Jedes Bild hat ZWEI Quellen: ein Foto und ein selbst gezeichnetes
//  Ersatzmotiv. Lädt das Foto nicht, bleibt das Motiv stehen - statt einer
//  leeren Fläche.
//
//  Der Grund (21.08.2026): Neun von zehn Foto-Adressen waren geraten und
//  zeigten ins Leere. Aus der Arbeitsumgebung heraus lassen sich diese
//  Adressen nicht prüfen. Das Ersatzmotiv macht einen solchen Fehler
//  folgenlos - schlimmstenfalls sieht man das Vereinsmotiv.
//
//  Eigenes Foto einbauen: "foto" auf den eigenen Dateinamen setzen, z. B.
//  "bilder/platz-abends.jpg". Sonst ändert sich nichts.
// ============================================================

// ------------------------------------------------------------------
//  Warum die meisten "foto"-Felder auf null stehen (22.08.2026)
//
//  Max hat entschieden: "trotzdem stockfotos einbinden". Die Mechanik
//  dafür steht - seite.js tauscht das Motiv gegen das Foto, sobald das
//  Foto tatsächlich geladen ist.
//
//  Nur: Ich habe am 21.08.2026 schon einmal neun von zehn
//  Pexels-Adressen GERATEN. Genau eine hat geladen, und Max' Rückmeldung
//  war "bei der Seite fehlen zwar immer noch in manchen Kästchen die
//  Bilder". Aus dieser Umgebung heraus komme ich an pexels.com nicht
//  heran, kann die Adressen also nicht nachprüfen. Sie ein zweites Mal
//  ungeprüft einzutragen hieße, denselben Fehler zu wiederholen - und
//  wegen der Rückfallebene würde man ihn nicht einmal sehen.
//
//  Deshalb: null, bis die Datei wirklich vorliegt. Die Kandidaten stehen
//  in bilder/QUELLEN.md.
//
//  Besser als eine Adresse ist ohnehin eine Datei in "bilder/": dann
//  geht beim Aufruf der Seite keine Anfrage an einen fremden Server,
//  und niemandes IP-Adresse wandert vor jeder Einwilligung nach außen.
// ------------------------------------------------------------------
export const BILDER = {
  aufmacher: {
    // Als einzige Adresse nachweislich geladen (im Rendering am
    // 21.08.2026 gesehen) - sie war wörtlich aus einem Suchergebnis
    // übernommen, nicht zusammengebaut.
    foto: "https://images.pexels.com/photos/47343/the-ball-stadion-horn-corner-47343.jpeg?auto=compress&cs=tinysrgb&w=1800",
    ersatz: "bilder/motiv-aufmacher.svg",
  },
  schiriWerden: { foto: null, ersatz: "bilder/motiv-regeln.svg" },
  quiz:         { foto: null, ersatz: "bilder/motiv-quiz.svg" },
  spesen:       { foto: null, ersatz: "bilder/motiv-spesen.svg" },
  vorlagen:     { foto: null, ersatz: "bilder/motiv-absage.svg" },
  unterlagen:   { foto: null, ersatz: "bilder/motiv-dokumente.svg" },
  melden:       { foto: null, ersatz: "bilder/motiv-ausruestung.svg" },
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
