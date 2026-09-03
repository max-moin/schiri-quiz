// ============================================================
//  Der Meldebogen: welche Art fragt was
// ============================================================
//  Hier steht nur die Regel, keine Darstellung und kein Serveraufruf.
//  Genau deshalb: An dieser Regel haengt, ob jemand ein Feld sieht, das
//  fuer seine Meldung gar nicht gedacht ist - und ob das
//  Veroeffentlichungs-Ankreuzfeld an einem Vorfall auftaucht, wo es nie
//  hingehoert. Sowas prueft man besser an einer Funktion als an einem
//  Bildschirmfoto (tests/rueckkanal.test.js).
//
//  ------------------------------------------------------------
//  ERST DIE ART, DANN DIE FELDER
//  ------------------------------------------------------------
//  Ein Formular mit allen Feldern gleichzeitig waere fuer den haeufigsten
//  Fall - "ich moechte einfach mal reden" - eine Wand aus Fragen, die
//  keine davon beantwortet werden muss. Wer sich unwohl fuehlt, fuellt
//  keinen Fragebogen aus. Deshalb: erst die Art waehlen, dann erscheinen
//  die Felder, die zu ihr gehoeren, und sonst keine.
//
//  ------------------------------------------------------------
//  WAS DIE DATENBANK OHNEHIN ERZWINGT
//  ------------------------------------------------------------
//  Diese Datei ist die freundliche Haelfte. Die harte Haelfte steht in
//  v111 und gilt unabhaengig davon, was der Browser schickt:
//   - Bei "vorfall" wird die Veroeffentlichungsfreigabe serverseitig auf
//     "nein" gesetzt; ein Vorfall mit Freigabe laesst sich gar nicht
//     speichern (CHECK).
//   - Bei "anonym" verwirft der Server die Personenkennung, bevor der
//     Datensatz angelegt wird.
//   - Bei "website" werden Spielklasse, eigene Entscheidung und
//     Beteiligte verworfen.
//  baueParameter() schickt trotzdem schon nichts anderes hin. Nicht weil
//  der Server es braeuchte, sondern damit hier ablesbar bleibt, was die
//  Seite ueberhaupt zu senden beabsichtigt.
// ============================================================

/** Die Obergrenze der Datenbank fuer das Situationsfeld (CHECK in v111). */
export const GRENZE_SITUATION = 4000;

/**
 * Die vier Arten in der Reihenfolge, in der sie auf der Seite stehen.
 *
 * Die Reihenfolge ist eine Entscheidung: "Regelfall" steht vorn, weil er
 * der haeufigste und harmloseste Fall ist. "Vorfall" direkt dahinter,
 * damit er nicht wie ein Sonderweg ganz unten wirkt, den man erst suchen
 * muss. "Website" steht zuletzt - Technik ist das kleinste Anliegen.
 */
export const MELDE_ARTEN = [
  {
    art: "regelfall",
    titel: "Regelfall",
    frage: "War das richtig so?",
    beschreibung: "Eine Spielsituation, bei der du dir nicht sicher bist.",
    felder: ["spielklasse", "situation", "eigene_entscheidung", "unsicher_warum", "veroeffentlichung"],
    anonymErlaubt: false,
    beschriftungen: { situation: "Die Situation" },
  },
  {
    art: "vorfall",
    titel: "Vorfall",
    frage: "Ich habe mich unwohl gefühlt",
    beschreibung: "Anfeindung, Bedrohung, Diskriminierung – alles, was nicht in Ordnung war.",
    felder: ["spielklasse", "situation", "beteiligte", "sonderbericht"],
    anonymErlaubt: true,
    beschriftungen: { situation: "Was ist passiert?" },
  },
  {
    art: "gespraech",
    titel: "Gespräch",
    frage: "Ich möchte einfach mal reden",
    beschreibung: "Kein Formular nötig – schreib in einem Satz, worum es geht.",
    felder: ["situation"],
    anonymErlaubt: true,
    beschriftungen: { situation: "Worum geht es?" },
  },
  {
    art: "website",
    titel: "Website",
    frage: "An der Seite passt etwas nicht",
    beschreibung: "Fehler, Wunsch oder Hinweis zu dieser Website.",
    felder: ["situation"],
    anonymErlaubt: false,
    beschriftungen: { situation: "Was passt nicht?" },
  },
];

/**
 * Die Felder selbst. "art" ist hier die Art des Eingabefelds, nicht die
 * Art der Meldung - die beiden Woerter stossen leider aneinander.
 */
export const MELDE_FELDER = {
  spielklasse: {
    feldart: "text",
    beschriftung: "Spielklasse",
    platzhalter: "z. B. Stadtliga B, D-Junioren",
    parameter: "p_spielklasse",
  },
  situation: {
    feldart: "textarea",
    beschriftung: "Was ist passiert?",
    platzhalter: "Schildere die Situation so, wie du sie erlebt hast.",
    pflicht: true,
    grenze: GRENZE_SITUATION,
    parameter: "p_situation",
  },
  eigene_entscheidung: {
    feldart: "textarea",
    beschriftung: "Meine Entscheidung",
    platzhalter: "Was hast du gepfiffen?",
    parameter: "p_eigene_entscheidung",
  },
  unsicher_warum: {
    feldart: "textarea",
    beschriftung: "Warum ich unsicher bin",
    platzhalter: "Was hat dich hinterher zweifeln lassen?",
    parameter: "p_unsicher_warum",
  },
  beteiligte: {
    feldart: "textarea",
    beschriftung: "Wer war beteiligt?",
    platzhalter: "Nur so genau, wie es für die Sache nötig ist.",
    parameter: "p_beteiligte",
    // Genau hier landen Angaben ueber Menschen, die davon nichts wissen
    // und nicht zugestimmt haben. Der Hinweis steht deshalb AM FELD und
    // nicht unten im Kleingedruckten.
    datenschutzHinweis: true,
  },
  sonderbericht: {
    feldart: "ankreuz",
    beschriftung: "Ich habe einen Sonderbericht geschrieben",
    parameter: "p_sonderbericht_geschrieben",
  },
  veroeffentlichung: {
    feldart: "ankreuz",
    beschriftung: "Darf anonymisiert als Quizfrage verwendet werden",
    hinweis: "Ohne dieses Häkchen bleibt der Fall beim Obmann.",
    parameter: "p_veroeffentlichung_erlaubt",
  },
};

/** Die Beschreibung einer Art, oder null bei einem unbekannten Namen. */
export function findeArt(art) {
  return MELDE_ARTEN.find((eintrag) => eintrag.art === art) || null;
}

/** Die Feldnamen dieser Art, in der Reihenfolge des Formulars. */
export function felderFuer(art) {
  const eintrag = findeArt(art);
  return eintrag ? [...eintrag.felder] : [];
}

/**
 * Darf diese Art anonym abgegeben werden?
 *
 * Nur Vorfall und Gespraech. Beim Regelfall waere es sinnlos - die Frage
 * "war das richtig so?" braucht eine Antwort an jemanden, und ohne Person
 * gibt es keine. Bei einem Website-Hinweis ist nichts zu schuetzen.
 */
export function erlaubtAnonym(art) {
  const eintrag = findeArt(art);
  return Boolean(eintrag && eintrag.anonymErlaubt);
}

/** Die Beschriftung eines Feldes bei dieser Art (mit Sonderfaellen). */
export function beschriftungFuer(art, feld) {
  const eintrag = findeArt(art);
  const eigene = eintrag && eintrag.beschriftungen ? eintrag.beschriftungen[feld] : null;
  return eigene || (MELDE_FELDER[feld] ? MELDE_FELDER[feld].beschriftung : feld);
}

/**
 * Baut die Parameter fuer "meldebogen_abgeben".
 *
 * Reine Funktion, absichtlich ohne DOM: was am Ende zum Server geht,
 * laesst sich damit im Test durchspielen, statt es an einem Formular
 * abzulesen.
 */
export function baueParameter({ art, werte = {}, person = {}, anonym = false } = {}) {
  const erlaubteFelder = new Set(felderFuer(art));
  const nimm = (feld) => {
    if (!erlaubteFelder.has(feld)) return null;
    const wert = String(werte[feld] ?? "").trim();
    return wert === "" ? null : wert;
  };

  return {
    p_schiedsrichter_id: person.id || null,
    p_pin: person.pin || null,
    p_art: art,
    p_situation: String(werte.situation ?? "").trim(),
    // Anonym nur, wo es angeboten wird. Ein "true" bei einem Regelfall
    // waere hier ein stiller Datenverlust: der Server wuerfe die Kennung
    // weg und niemand koennte antworten.
    p_anonym: erlaubtAnonym(art) ? Boolean(anonym) : false,
    p_spielklasse: nimm("spielklasse"),
    p_eigene_entscheidung: nimm("eigene_entscheidung"),
    p_unsicher_warum: nimm("unsicher_warum"),
    p_beteiligte: nimm("beteiligte"),
    p_sonderbericht_geschrieben: erlaubteFelder.has("sonderbericht")
      ? Boolean(werte.sonderbericht)
      : null,
    // Nur der Regelfall bietet die Freigabe ueberhaupt an. Beim Vorfall
    // gibt es kein Feld dafuer, und hier geht deshalb hart false hinaus.
    p_veroeffentlichung_erlaubt: erlaubteFelder.has("veroeffentlichung")
      ? Boolean(werte.veroeffentlichung)
      : false,
  };
}
