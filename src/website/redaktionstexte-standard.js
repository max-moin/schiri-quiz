// ============================================================
//  Ausgangsstand der redaktionellen Texte
// ------------------------------------------------------------
//  ERZEUGT - nicht von Hand aendern. Diese Datei wird aus den
//  data-text-Haken im HTML gebaut (werkzeuge/texte-erzeugen.py)
//  und von tests/redaktionstexte.test.js gegen das HTML geprueft.
//  Wer hier tippt, erzeugt genau die Abweichung, die der Test
//  verhindern soll: im Editor stuende dann ein anderer Text als
//  auf der Seite.
// ============================================================

export const TEXTE_STANDARD = Object.freeze({
  "regeln.titel": "Regelübersicht",
  "schiri-werden.fragen": "Was uns am häufigsten gefragt wird",
  "schiri-werden.kicker": "Ab 12 Jahren",
  "schiri-werden.pate": "Am Anfang läuft ein Pate mit",
  "schiri-werden.schluss": "Bereit? Dann melde dich.",
  "schiri-werden.titel": "Steh mitten im Spiel,<br />statt danebenzustehen",
  "schiri-werden.unter": "Sieben Abende Lehrgang – danach gehörst du zu denen, ohne die kein Spiel stattfindet.",
  "schiri-werden.warum": "Die beste Sicht aufs Spiel hat der, der es leitet",
  "schiri-werden.weg": "Der Weg zur Pfeife",
  "spesen.schritt-1": "Was für ein Spiel, und wer spielt?",
  "spesen.schritt-2": "In welcher Liga?",
  "spesen.schritt-3": "Wer pfeift?",
  "spesen.schritt-4": "Fahrtkosten",
  "spesen.titel": "Spesenrechner",
  "spesen.unter": "Vier Schritte bis zur Berechnung. Jeden Betrag rechts kannst du von Hand überschreiben.",
  "start.bereich-schiris": "Für unsere Schiedsrichter",
  "start.kicker": "Schiedsrichter · FV Löbtauer Kickers",
  "start.knopf-links": "Schiri werden",
  "start.knopf-rechts": "Dein Fußballwissen testen",
  "start.titel": "Ohne uns geht<br />kein Spiel",
  "unterlagen.titel": "Unterlagen",
  "unterlagen.unter": "Die offiziellen Dokumente von Stadtverband, Landesverband und DFB – nach Anlass sortiert und schnell auffindbar.",
});

// Gruppierung fuer den Editor: eine Karte je Seite, in der
// Reihenfolge, in der die Texte auf der Seite stehen.
export const TEXT_SEITEN = Object.freeze([
  Object.freeze({
    schluessel: "start",
    titel: "Startseite",
    datei: "index.html",
    felder: Object.freeze([
      Object.freeze({ schluessel: "start.kicker", beschriftung: "Kleinzeile über der Überschrift" }),
      Object.freeze({ schluessel: "start.titel", beschriftung: "Große Überschrift" }),
      Object.freeze({ schluessel: "start.knopf-links", beschriftung: "Linker Knopf" }),
      Object.freeze({ schluessel: "start.knopf-rechts", beschriftung: "Rechter Knopf" }),
      Object.freeze({ schluessel: "start.bereich-schiris", beschriftung: "Überschrift „Für unsere Schiedsrichter“" }),
    ]),
  }),
  Object.freeze({
    schluessel: "schiri-werden",
    titel: "Schiri werden",
    datei: "schiri-werden.html",
    felder: Object.freeze([
      Object.freeze({ schluessel: "schiri-werden.kicker", beschriftung: "Kleinzeile über der Überschrift" }),
      Object.freeze({ schluessel: "schiri-werden.titel", beschriftung: "Große Überschrift" }),
      Object.freeze({ schluessel: "schiri-werden.unter", beschriftung: "Zeile darunter" }),
      Object.freeze({ schluessel: "schiri-werden.warum", beschriftung: "Überschrift des Warum-Abschnitts" }),
      Object.freeze({ schluessel: "schiri-werden.weg", beschriftung: "Überschrift „Der Weg zur Pfeife“" }),
      Object.freeze({ schluessel: "schiri-werden.pate", beschriftung: "Überschrift Patenabschnitt" }),
      Object.freeze({ schluessel: "schiri-werden.fragen", beschriftung: "Überschrift Fragenabschnitt" }),
      Object.freeze({ schluessel: "schiri-werden.schluss", beschriftung: "Überschrift am Seitenende" }),
    ]),
  }),
  Object.freeze({
    schluessel: "spesen",
    titel: "Spesenrechner",
    datei: "spesenrechner.html",
    felder: Object.freeze([
      Object.freeze({ schluessel: "spesen.titel", beschriftung: "Große Überschrift" }),
      Object.freeze({ schluessel: "spesen.unter", beschriftung: "Zeile darunter" }),
      Object.freeze({ schluessel: "spesen.schritt-1", beschriftung: "Überschrift Schritt 1" }),
      Object.freeze({ schluessel: "spesen.schritt-2", beschriftung: "Überschrift Schritt 2" }),
      Object.freeze({ schluessel: "spesen.schritt-3", beschriftung: "Überschrift Schritt 3" }),
      Object.freeze({ schluessel: "spesen.schritt-4", beschriftung: "Überschrift Schritt 4" }),
    ]),
  }),
  Object.freeze({
    schluessel: "unterlagen",
    titel: "Unterlagen",
    datei: "informationen.html",
    felder: Object.freeze([
      Object.freeze({ schluessel: "unterlagen.titel", beschriftung: "Große Überschrift" }),
      Object.freeze({ schluessel: "unterlagen.unter", beschriftung: "Zeile darunter" }),
    ]),
  }),
  Object.freeze({
    schluessel: "regeln",
    titel: "Regelübersicht",
    datei: "regeluebersicht.html",
    felder: Object.freeze([
      Object.freeze({ schluessel: "regeln.titel", beschriftung: "Große Überschrift" }),
    ]),
  }),
]);
