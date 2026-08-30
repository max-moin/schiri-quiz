// ============================================================
//  Terminfindung: Serverzugriff und reine Auswertung
// ============================================================
//  Bewusst ohne DOM. Alles, was hier drin steht, laesst sich in
//  node --test pruefen; die Oberflaeche liegt daneben in
//  terminfindung-editor.js.
//
//  Die vier Auswertungen (Bilanz, Empfehlung, Erinnerungsliste, CSV)
//  sind der eigentliche Grund, warum die Terminfindung am Rechner
//  gepflegt wird und nicht am Handy: sie beantworten "welcher Termin
//  gewinnt", "wer fehlt noch" und "wie kriege ich das in eine Tabelle".
// ============================================================

import { datumLang, uhrzeit } from "../website/termine.js";

const ANTWORT_TEXT = { ja: "Ja", vielleicht: "Vielleicht", nein: "Nein" };

// ---------- Reine Auswertung ----------

/** "2026-10-03" -> "03.10.2026". Fuer CSV und Kurzbeschriftungen. */
export function datumZahlen(iso) {
  const teile = String(iso || "").slice(0, 10).split("-");
  if (teile.length !== 3) return String(iso || "");
  return `${teile[2]}.${teile[1]}.${teile[0]}`;
}

/** Beschriftung eines Vorschlags, wie sie in Tabellenkopf und CSV steht. */
export function vorschlagLabel(vorschlag) {
  const zeit = uhrzeit(vorschlag?.beginn_zeit);
  const datum = datumZahlen(vorschlag?.datum);
  return zeit ? `${datum} ${zeit}` : datum;
}

/** Dieselbe Angabe ausgeschrieben, fuer die Bildschirmdarstellung. */
export function vorschlagLangText(vorschlag) {
  const zeit = uhrzeit(vorschlag?.beginn_zeit);
  const teile = [datumLang(vorschlag?.datum)];
  if (zeit) teile.push(`${zeit} Uhr`);
  if (vorschlag?.ort) teile.push(vorschlag.ort);
  return teile.join(" · ");
}

export function bilanz(vorschlag) {
  return {
    ja: Number(vorschlag?.ja || 0),
    vielleicht: Number(vorschlag?.vielleicht || 0),
    nein: Number(vorschlag?.nein || 0),
  };
}

/* Welcher Vorschlag gewinnt.
   Die Reihenfolge der Kriterien ist eine fachliche Aussage, keine
   Geschmacksfrage: zuerst zaehlt, wer sicher kann. Erst wenn zwei
   Vorschlaege gleich viele feste Zusagen haben, entscheidet, an welchem
   ueberhaupt noch jemand koennte ("vielleicht"), danach der mit den
   wenigsten Absagen, zuletzt der fruehere Termin.

   Nur ein Vorschlag - entschieden wird von Hand. Deshalb heisst es in
   der Oberflaeche "Empfehlung" und nicht "Ergebnis". */
export function empfehlung(vorschlaege = []) {
  const liste = Array.isArray(vorschlaege) ? vorschlaege.filter(Boolean) : [];
  if (!liste.length) return null;
  const bewertet = liste.map((v) => {
    const b = bilanz(v);
    return { vorschlag: v, ja: b.ja, moeglich: b.ja + b.vielleicht, nein: b.nein };
  });
  bewertet.sort((a, b) =>
    b.ja - a.ja
    || b.moeglich - a.moeglich
    || a.nein - b.nein
    || String(a.vorschlag.datum).localeCompare(String(b.vorschlag.datum)));
  // Wenn niemand irgendwo kann, gibt es nichts zu empfehlen.
  if (bewertet[0].moeglich === 0) return null;
  return bewertet[0].vorschlag;
}

/** Namen der Personen, die zu keinem einzigen Vorschlag geantwortet haben. */
export function offeneNamen(stand = []) {
  return (Array.isArray(stand) ? stand : [])
    .filter((zeile) => !zeile?.hat_geantwortet)
    .map((zeile) => zeile.name)
    .filter(Boolean);
}

/* Erinnerungstext zum Kopieren.

   Aus dem Backlog, Abschnitt "Teilnahme und Erinnerungen": offene
   Personen anzeigen und einen kurzen Text kopierbar machen - aber
   ausdruecklich KEINE automatisch verschickten Nachrichten. Deshalb
   liefert diese Funktion nur Text; verschickt wird von Hand.

   Die Namen stehen im Text, weil Max ihn einzeln oder in die
   Vereinsgruppe schreibt. Auf der oeffentlichen Seite taucht diese
   Liste nirgends auf. */
export function erinnerungsText({ findung, offene = [] }) {
  const zeilen = [
    `Erinnerung: Bitte noch bei „${findung?.titel || "der Terminsuche"}“ abstimmen.`,
  ];
  if (offene.length) {
    zeilen.push(`Es fehlt noch: ${offene.join(", ")}.`);
  }
  if (findung?.antwort_bis) {
    zeilen.push(`Antwort bitte bis ${datumZahlen(findung.antwort_bis)}.`);
  }
  zeilen.push("Die Abstimmung steht auf der Vereinsseite unter „Termine“.");
  return zeilen.join("\n");
}

/* Ein Feld fuer die CSV-Datei.
   Semikolon statt Komma und BOM davor, weil die Datei in Excel geoeffnet
   wird und Excel im deutschen Gebietsschema sonst alles in eine Spalte
   legt. */
export function csvFeld(wert) {
  const text = wert === null || wert === undefined ? "" : String(wert);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Eine Zeile je Person, eine Spalte je Vorschlag. */
export function csvAusStand({ vorschlaege = [], stand = [] }) {
  const spalten = Array.isArray(vorschlaege) ? vorschlaege : [];
  const kopf = ["Name", ...spalten.map(vorschlagLabel)];
  const zeilen = (Array.isArray(stand) ? stand : []).map((person) => {
    const antworten = person?.antworten || {};
    return [
      person?.name || "",
      ...spalten.map((v) => ANTWORT_TEXT[antworten[v.id]] || "keine Antwort"),
    ];
  });
  return "\ufeff" + [kopf, ...zeilen]
    .map((zeile) => zeile.map(csvFeld).join(";"))
    .join("\r\n");
}

/** Dateiname mit Datum, damit mehrere Ausgaben nebeneinander liegen. */
export function csvDateiname(findung) {
  const titel = String(findung?.titel || "terminsuche")
    .toLowerCase()
    .replace(/[äöüß]/g, (z) => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[z]))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "terminsuche";
  return `terminsuche-${titel}.csv`;
}

// ---------- Serverzugriff ----------

/* Alle Aufrufe laufen ueber gepruefte SECURITY-DEFINER-Funktionen. Auf
   terminfindungen, terminfindung_vorschlaege und terminfindung_stimmen
   ist RLS an und es gibt keine Policy - ein direkter Tabellenzugriff
   gaebe hier immer null Zeilen zurueck. */
export function erstelleTerminfindungZugriff({ client, passwort }) {
  async function rufe(name, parameter = {}) {
    const { data, error } = await client.rpc(name, { p_passwort: passwort(), ...parameter });
    if (error) throw new Error(error.message || "Die Datenbank hat den Aufruf abgelehnt.");
    return data;
  }

  return Object.freeze({
    liste: () => rufe("obmann_terminfindungen"),

    stand: (findungId) => rufe("obmann_terminfindung_stand", { p_findung_id: findungId }),

    anlegen: ({ titel, beschreibung, antwortBis, vorschlaege }) =>
      rufe("obmann_terminfindung_anlegen", {
        p_titel: titel,
        p_vorschlaege: vorschlaege,
        p_beschreibung: beschreibung || null,
        p_antwort_bis: antwortBis || null,
      }),

    // null heisst "nicht angefasst", leerer Text heisst "leeren" - siehe
    // Kopfkommentar der Migration v97. Die Oberflaeche schickt deshalb
    // wirklich nur die Felder, die der Obmann angefasst hat.
    bearbeiten: ({ findungId, titel, beschreibung, antwortBis, fristEntfernen }) =>
      rufe("obmann_terminfindung_bearbeiten", {
        p_findung_id: findungId,
        p_titel: titel ?? null,
        p_beschreibung: beschreibung ?? null,
        p_antwort_bis: antwortBis || null,
        p_frist_entfernen: !!fristEntfernen,
      }),

    vorschlagErgaenzen: ({ findungId, datum, beginnZeit, ort }) =>
      rufe("obmann_terminfindung_vorschlag_ergaenzen", {
        p_findung_id: findungId,
        p_datum: datum,
        p_beginn_zeit: beginnZeit || null,
        p_ort: ort || null,
      }),

    vorschlagEntfernen: (vorschlagId) =>
      rufe("obmann_terminfindung_vorschlag_entfernen", { p_vorschlag_id: vorschlagId }),

    entscheiden: ({ findungId, vorschlagId, oeffentlich, art, pflicht }) =>
      rufe("obmann_terminfindung_entscheiden", {
        p_findung_id: findungId,
        p_vorschlag_id: vorschlagId,
        p_oeffentlich: !!oeffentlich,
        p_art: art || "event",
        p_pflicht: !!pflicht,
      }),

    abbrechen: (findungId) =>
      rufe("obmann_terminfindung_abbrechen", { p_findung_id: findungId }),
  });
}
