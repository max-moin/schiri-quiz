/**
 * Reine Rechenregeln des Spesenrechners.
 *
 * Warum eine eigene Datei: Die Betraege wurden bisher mitten im
 * Modulskript von spesenrechner.html ausgerechnet. Dorthin kommt kein
 * Test - und genau dort sind am 22.08.2026 drei Rechenfehler tagelang
 * unbemerkt geblieben. Hier hat jede Regel eine pruefbare Signatur:
 * Werte rein, Werte raus, kein Zugriff auf das Dokument.
 *
 * Jede Regel liefert dieselbe Form:
 *
 *   { betrag, text, unsicher }
 *
 * "unsicher" heisst: Die Zahl steht da, taugt aber nicht als
 * Endergebnis. Daran haengt in der Quittung "Gesamt, unvollstaendig".
 * Eine erfundene Zahl auf einem Formular waere schlimmer als eine
 * sichtbare Luecke - das ist die Leitlinie dieser Datei.
 */

/** Betrag deutsch schreiben. */
export const euroText = (n) =>
  Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Zahl deutsch schreiben - "48.5 km" sah neben "0,39 €" falsch aus. */
export const zahlText = (n) =>
  Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });

/**
 * Auf Cent runden. Muss VOR dem Summieren passieren, sonst zeigt die
 * Quittung gerundete Zeilen und darunter eine Summe, die um einen Cent
 * danebenliegt (0,35 €/km x 48,5 km = 16,975).
 */
export const aufCent = (n) =>
  /* Der Umweg ueber toFixed ist kein Zierrat. 48,5 km x 0,35 € ergibt
     als Gleitkommazahl 16.974999999999998; Math.round(n * 100) machte
     daraus 16,97, waehrend 16,975 kaufmaennisch auf 16,98 aufrundet -
     und 16,975 ist genau das Beispiel, mit dem diese Rundung im
     Rechner begruendet ist. toFixed(6) bringt die Zahl vorher auf ihre
     gemeinte Dezimalform zurueck. */
  Math.round(Number((Number(n) * 100).toFixed(6))) / 100;

/**
 * Liest eine Zahl so, wie Leute sie tatsaechlich eintippen: mit Komma,
 * mit Tausenderpunkt, mit angehaengtem Euro-Zeichen. "12,40 €" und
 * "1.234,56" ergaben vorher stillschweigend 0.
 *
 * Rueckgabe null, wenn nichts Lesbares dasteht - dann kann der Aufrufer
 * "noch eintragen" von "nicht lesbar" unterscheiden.
 *
 * Die Schlusspruefung ist ein Muster und nicht Number(): Number("1e3")
 * ist 1000 und Number("Infinity") ist unendlich. Auf einer Quittung ist
 * beides keine Eingabe, sondern ein Vertipper.
 */
export function leseZahl(rohtext) {
  const roh = String(rohtext ?? "").trim();
  if (!roh) return null;
  const bereinigt = roh
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")   // Tausenderpunkt
    .replace(/,/g, ".");
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(bereinigt)) return null;
  const wert = Number(bereinigt);
  return Number.isFinite(wert) ? wert : null;
}

/* Dresdner Zustell-Postleitzahlen laufen von 01067 bis 01329. */
const DRESDEN_MUSTER = /^(0106[7-9]|010[7-9]\d|01[12]\d{2}|013[0-2]\d)$/;

/**
 * Vier Zustaende statt zwei.
 *
 * Vorher gab es nur "Dresden" und "nicht Dresden". Eine geleerte oder
 * halb eingetippte Postleitzahl fiel damit in "nicht Dresden" - und das
 * heisst zwei Tarifzonen statt einer, also den doppelten Betrag, ohne
 * dass irgendwo ein Hinweis stand. Genau das passiert jedes Mal, wenn
 * jemand die Vorbelegung loescht, um seine eigene einzutragen.
 */
export function plzZustand(plz) {
  const roh = String(plz ?? "").trim();
  if (!roh) return "leer";
  if (!/^\d{5}$/.test(roh)) return "ungueltig";
  return DRESDEN_MUSTER.test(roh) ? "dresden" : "auswaerts";
}

/**
 * Fahrtkosten nach der Regel des Stadtverbands, von Max zweimal
 * ausdruecklich bestaetigt: zwei Einzelkarten je durchfahrener Zone
 * (hin und zurueck), jede zum selben Preis.
 *
 *   1 Zone  -> 2 Karten ->  7,20 €
 *   2 Zonen -> 4 Karten -> 14,40 €
 *
 * Fruehere Fassung rechnete bei zwei Zonen "3,60 + 3,30" und lag damit
 * falsch - Max: "es sind einfach viermal 3,60".
 *
 * lage: "dd" | "aus" | "frag" | null. null heisst "kein Verein
 * ausgewaehlt"; dann wird weiter mit einem Spielort in Dresden
 * gerechnet, aber nur dann ohne Vorbehalt, wenn auch nichts eingetippt
 * wurde. Steht dort ein Name, den die Liste nicht kennt, ist die
 * Annahme eine Wette - und die gehoert in die Zeile.
 */
export function stadtFahrtkosten({ plz, lage = null, vereinEingetippt = false, saetze }) {
  const wohnort = plzZustand(plz);
  const zielInDresden = lage === null ? true : lage === "dd";
  const zonen = (zielInDresden && wohnort === "dresden") ? 1 : 2;
  const karten = zonen * saetze.kartenJeZone;

  const zusatz =
    lage === "frag" ? " – Zone des Spielorts ungeprüft"
      : (lage === null && vereinEingetippt) ? " – Verein nicht in der Liste, Spielort Dresden angenommen"
        : wohnort === "leer" ? " – ohne Postleitzahl mit zwei Zonen gerechnet"
          : wohnort === "ungueltig" ? " – Postleitzahl unvollständig, mit zwei Zonen gerechnet"
            : "";

  return {
    betrag: aufCent(karten * saetze.preisJeKarte),
    text: `${zonen} ${zonen === 1 ? "Tarifzone" : "Tarifzonen"} · ${karten} Einzelkarten à ${euroText(saetze.preisJeKarte)}${zusatz}`,
    unsicher: zusatz !== "",
  };
}

/**
 * Landesebene: Paragraf 8 der SFV-Finanzordnung.
 *
 * Die Pauschale gilt laut Wortlaut "pro Veranstaltung/Einsatz" - also
 * einmal fuer das ganze Spiel und nicht je Richtung. Genau das war Max'
 * offene Frage am 21.08.2026.
 *
 * Die Kilometerangabe ist ausdruecklich die GESAMTE gefahrene Strecke,
 * deshalb wird sie nicht verdoppelt.
 */
export function landFahrtkosten({ art, ticketRoh = "", kmRoh = "", mitnahme = false, saetze }) {
  if (art === "karte") {
    return {
      betrag: aufCent(saetze.monatskartePauschale),
      text: "Pauschale bei Monats- oder Jahreskarte, einmal je Einsatz",
      unsicher: false,
    };
  }

  if (art === "ticket") {
    const betrag = leseZahl(ticketRoh);
    if (betrag == null) {
      return {
        betrag: 0,
        text: String(ticketRoh).trim() ? "Betrag nicht lesbar" : "Betrag laut Fahrausweis noch eintragen",
        unsicher: true,
      };
    }
    return { betrag: aufCent(betrag), text: "Einzelfahrscheine, Belege beilegen", unsicher: false };
  }

  const km = leseZahl(kmRoh);
  if (km == null || km === 0) {
    return {
      betrag: 0,
      text: String(kmRoh).trim() ? "Kilometer nicht lesbar" : "Kilometer noch eintragen",
      unsicher: true,
    };
  }
  if (art === "rad") {
    return {
      betrag: aufCent(km * saetze.kmFahrrad),
      text: `${zahlText(km)} km à ${euroText(saetze.kmFahrrad)}`,
      unsicher: false,
    };
  }
  const satzProKm = saetze.kmAuto + (mitnahme ? saetze.kmZuschlagMitnahme : 0);
  return {
    betrag: aufCent(km * satzProKm),
    text: `${zahlText(km)} km à ${euroText(satzProKm)}` + (mitnahme ? " (mit Mitnahmezuschlag)" : ""),
    unsicher: false,
  };
}

/**
 * Turnierpauschale: fester Betrag fuer die ersten Stunden, danach ein
 * Zuschlag je ANGEFANGENE weitere Stunde.
 *
 * Die Turniersaetze stammen aus dem Blatt des Stadtverbands. Fuer eine
 * Landesklasse sind sie nicht belegt - der Landesverband fuehrt eigene
 * Turniersaetze. Deshalb dort als unsicher markiert statt
 * stillschweigend uebernommen.
 */
export function turnierEntschaedigung({ stundenRoh, turnier, aufLandesverband = false }) {
  const grundstunden = Math.max(1, Math.round(Number(turnier.grundstunden) || 1));
  const landZusatz = aufLandesverband
    ? " · Satz des Stadtverbands, für Landesturniere ungeprüft"
    : "";
  const stunden = leseZahl(stundenRoh);

  /* Ein leeres Feld heisst nicht "vier Stunden". Vorher wurde still mit
     der Grunddauer weitergerechnet, und die Quittung sah fertig aus. */
  if (stunden == null || stunden === 0) {
    return {
      betrag: aufCent(turnier.grundpauschale),
      text: `Dauer noch eintragen – gerechnet mit den ersten ${grundstunden} Stunden${landZusatz}`,
      unsicher: true,
    };
  }

  const extra = Math.max(0, Math.ceil(stunden) - grundstunden);
  return {
    betrag: aufCent(turnier.grundpauschale + extra * turnier.jeWeitereStunde),
    text: (extra > 0
      ? `${euroText(turnier.grundpauschale)} + ${extra} × ${euroText(turnier.jeWeitereStunde)}`
      : `${euroText(turnier.grundpauschale)} für die ersten ${grundstunden} Stunden`) + landZusatz,
    unsicher: aufLandesverband,
  };
}

/**
 * Entschaedigung fuer ein einzelnes Spiel.
 *
 * Absicherung: Ligen ohne Assistenten haben sra === null. Ueber die
 * Oberflaeche ist das nicht erreichbar, weil das Haekchen vorher
 * gesperrt wird - aber ein Betrag "null" wuerde die ganze Quittung
 * mitten im Aufbau abbrechen.
 *
 * Der Prozentsatz im Text kommt aus dem Anteil selbst. Vorher stand
 * dort fest "50 %", waehrend der Anteil aus der Konfiguration kam -
 * veroeffentlicht der Obmann einen anderen Wert, log der Text.
 */
export function spielEntschaedigung({ liga, alsAssistent = false, ausgefallen = false, ausfallAnteil }) {
  const voll = alsAssistent ? liga.sra : liga.sr;
  if (voll == null || !Number.isFinite(Number(voll))) {
    return { betrag: 0, text: "Für diese Klasse ist kein Satz hinterlegt", unsicher: true };
  }

  if (ausgefallen) {
    /* Anlage 1 der SFV-Finanzordnung: bei Spielausfall 50 % der
       Entschaedigungspauschale, gleich aus welchem Grund. Fuer reine
       Stadtspiele ist dieselbe Regel nicht belegt - dort deshalb als
       unsicher gekennzeichnet statt als feste Zahl. */
    return {
      betrag: aufCent(voll * ausfallAnteil),
      text: `${liga.voll} · Spielausfall, ${zahlText(ausfallAnteil * 100)} % von ${euroText(voll)}`
        + (liga.verband === "svfd" ? " · Regel des Landesverbands, für Stadtspiele ungeprüft" : ""),
      unsicher: liga.verband === "svfd",
    };
  }

  return { betrag: aufCent(voll), text: liga.voll, unsicher: false };
}
