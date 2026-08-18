// ============================================================
//  Vereins-Konfiguration
// ============================================================
//  Diese Datei ist die EINZIGE Stelle, an der etwas Vereinsspezifisches
//  steht. Ein anderer Verein aus dem Stadtverband kopiert das Projekt,
//  ändert nur diese Datei und hat seine eigene Seite.
//
//  Die Regel dahinter (18.08.2026 mit Max festgelegt):
//  Ab jetzt kein Vereinsname, keine Farbe und kein Link mehr direkt im
//  übrigen Code. Sonst hat man am Ende doch wieder zwanzig Stellen zu
//  suchen - genau der Umbau, der vermieden werden soll.
// ============================================================

export const VEREIN = {
  name: "FV Löbtauer Kickers",
  kurz: "Löbtauer Kickers",
  abteilung: "Schiedsrichter-Abteilung",
  kuerzel: "FVLK",

  // Sobald Max ein Logo liefert, hier den Dateinamen eintragen.
  // Solange leer, zeigt die Seite das Kürzel als Textmarke.
  logo: null,

  farben: {
    // Anthrazit ist die Marke (Thema "Schiri-Schwarz", 07.08.2026).
    // Grün und Rot bleiben ausschließlich Rückmeldung im Quiz und werden
    // hier bewusst NICHT als Dekoration verwendet.
    marke: "#1f2937",
    akzent: "#16a34a",
  },

  kontakt: {
    obmann: "Max M.",
    // E-Mail bewusst noch leer - erst eintragen, wenn geklärt ist, ob eine
    // private oder eine Vereinsadresse auf die öffentliche Seite soll.
    email: null,
  },

  links: {
    verein: null,                                    // Vereins-Homepage, folgt
    stadtverband: "https://www.svf-dresden.de",
    stadtverbandDokumente: "https://www.svf-dresden.de/dokumente/kategorie/schiedsrichter/",
    dfbnet: "https://www.dfbnet.org",
  },
};

// ============================================================
//  Entschädigungssätze
// ============================================================
//  Quelle: "Entschädigungssätze im SFV", Stadtverband Fußball Dresden e.V.
//  Stand: von Max geliefert am 18.08.2026.
//
//  sra: null bedeutet ausdrücklich "in dieser Klasse gibt es keine
//  Assistenten". Die Oberfläche MUSS das abfangen und darf nicht
//  stillschweigend 0 Euro oder den Schiedsrichter-Satz anzeigen.
// ============================================================

export const ENTSCHAEDIGUNG = {
  svfd: {
    label: "Stadtverband Fußball Dresden",
    gruppen: [
      { alter: "Herren", klassen: [
        { n: "Sparkassenoberliga Herren", sr: 40, sra: 30 },
        { n: "brandible Stadtliga A Herren", sr: 30, sra: 25 },
        { n: "brandible Stadtliga B Herren", sr: 25, sra: 20 },
        { n: "brandible Stadtliga C Herren", sr: 25, sra: 20 },
        { n: "Stadtklassen Herren", sr: 25, sra: 20 },
      ]},
      { alter: "Frauen", klassen: [
        { n: "Mobilplus im O.D.C. Stadtliga Frauen", sr: 25, sra: 20 },
        { n: "Stadtklassen Frauen", sr: 25, sra: 20 },
      ]},
      { alter: "Senioren", klassen: [
        { n: "Stadtoberliga Senioren", sr: 25, sra: 20 },
        { n: "Stadtliga Senioren", sr: 25, sra: 20 },
        { n: "Stadtklasse Senioren", sr: 25, sra: 20 },
      ]},
      { alter: "A-Junioren", klassen: [
        { n: "Stadtoberliga A-Junioren", sr: 25, sra: 20 },
        { n: "Stadtliga A-Junioren", sr: 25, sra: 20 },
        { n: "Stadtklasse A-Junioren", sr: 25, sra: 20 },
      ]},
      { alter: "B-Junioren", klassen: [
        { n: "Stadtoberliga B-Junioren", sr: 22, sra: 20 },
        { n: "Stadtliga B-Junioren", sr: 22, sra: 20 },
        { n: "Stadtklasse B-Junioren", sr: 22, sra: 20 },
      ]},
      { alter: "C-Junioren", klassen: [
        { n: "Stadtoberliga C-Junioren", sr: 22, sra: 20 },
        { n: "Stadtliga C-Junioren", sr: 22, sra: 20 },
        { n: "Stadtklasse C-Junioren", sr: 22, sra: 20 },
      ]},
      { alter: "D- bis G-Jugend", klassen: [
        { n: "Sonstige Junioren im Stadtspielbetrieb", sr: 17, sra: null },
      ]},
      { alter: "Freizeitsport", klassen: [
        { n: "Freizeitsport (alle Ligen)", sr: 25, sra: 20 },
      ]},
      { alter: "Sonderfunktionen", klassen: [
        { n: "Schiedsrichter- und Spielbeobachter", sr: 30, sra: null },
        { n: "Schiedsrichter-Pate", sr: 20, sra: null },
      ]},
    ],
  },

  // Quelle: Finanzordnung Sächsischer Fußball-Verband, Stand 01.07.2025.
  // ACHTUNG: unvollständig - die Finanzordnung nennt weitere Nachwuchsklassen,
  // die hier noch fehlen. Vor dem Livegang ergänzen.
  sfv: {
    label: "Sächsischer Fußball-Verband",
    gruppen: [
      { alter: "Herren", klassen: [
        { n: "Landesliga Herren", sr: 55, sra: 45 },
        { n: "Landesklasse Herren", sr: 45, sra: 35 },
      ]},
      { alter: "Frauen", klassen: [
        { n: "Landesliga Frauen", sr: 35, sra: 30 },
        { n: "Landesklasse Frauen", sr: 30, sra: 25 },
      ]},
      { alter: "A-Junioren", klassen: [
        { n: "Landesliga A-Junioren", sr: 30, sra: 25 },
      ]},
      { alter: "C-Junioren", klassen: [
        { n: "Landesklasse C-Junioren", sr: 20, sra: 15 },
      ]},
      { alter: "Sonderfunktionen", klassen: [
        { n: "Beobachter (alle Klassen)", sr: 35, sra: null },
      ]},
    ],
  },
};

// Turnier-Sonderregel, gilt unabhängig von der Spielklasse.
export const TURNIER = { grundpauschale: 32, grundstunden: 4, jeWeitereStunde: 8 };

// ============================================================
//  Fahrtkosten
// ============================================================
//  Erstattungsregel laut Max (18.08.2026, ausdrücklich bestätigt):
//  Eine Einzelkarte JE DURCHFAHRENER TARIFZONE, hin und zurück.
//  Bei zwei Zonen also vier Einzelkarten.
//
//  Das weicht bewusst vom günstigeren VVO-Zwei-Zonen-Ticket ab - der
//  Verband erstattet nach Zonen, nicht nach dem gekauften Ticket.
//  Nicht "korrigieren".
//
//  Preise: VVO-Einzelfahrt, Stand 1. April 2026.
// ============================================================

export const FAHRTKOSTEN = {
  preisTarifzoneDresden: 3.60,
  preisEinzelzone: 3.30,
  hinweis: "Alle Angaben ohne Gewähr. Maßgeblich sind die Sätze des Stadtverbands.",
};

// ============================================================
//  Vereine des Stadtverbands
// ============================================================
//  Liste von Max geliefert (18.08.2026).
//
//  lage: "dd"   = liegt in der Tarifzone Dresden
//        "aus"  = außerhalb, zwei Tarifzonen
//        "frag" = Zone noch nicht geklärt, muss nachgesehen werden
//
//  ACHTUNG, noch offen: Ob die auswärtigen Orte im VVO wirklich direkt an
//  Dresden grenzen (also genau zwei Zonen ergeben), ist bislang eine
//  Annahme. Vor dem Livegang am VVO-Zonenplan abgleichen - sonst rechnet
//  der Rechner ausgerechnet die Fälle falsch, für die man ihn braucht.
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
  // Max, 18.08.2026: liegt nicht in Dresden, genaue Tarifzone aber noch offen.
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
  // Max, 18.08.2026: liegt nicht in Dresden, genaue Tarifzone aber noch offen.
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
