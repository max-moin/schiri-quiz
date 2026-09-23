// ============================================================
//  Die Prozesslinie einer Ausruestungsanfrage
// ------------------------------------------------------------
//  Ein Modul fuer beide Seiten des Schiedsrichters: den
//  Ausruestungsbestand und "Meine Anliegen". Vorher hat jede
//  Seite ihre eigene Kette aus Status und Booleans gebaut -
//  und deshalb stand auf der einen Seite etwas anderes als auf
//  der anderen.
//
//  Hier wird nichts abgeleitet. Die Schritte, ihr Stand und die
//  erlaubten Aktionen kommen fertig aus "schiri_prozess_liste"
//  (Migration v153, intern ausruestung_prozess_jsonb) - also aus
//  derselben Quelle, aus der auch die Obmann-App und die
//  Vorstandsseite zeichnen.
// ============================================================

/** Rollen der Datenbank auf die drei Spuren der Anliegen-Seite. */
export const WER_AUS_ROLLE = Object.freeze({
  schiri: "du",
  obmann: "obmann",
  vorstand: "stand",
  system: "stand",
});

/** Beschriftung der Knoepfe, die ein Schiedsrichter selbst druecken darf. */
export const SCHRITT_KNOPF = Object.freeze({
  gekauft: "Gekauft · Beleg folgt",
  geld_erhalten: "Das Geld ist angekommen",
  zurueckgezogen: "Anfrage zurückziehen",
});

const alsListe = (wert) => (Array.isArray(wert) ? wert : []);

/**
 * Wer ist gerade dran - in einem Satz. Bewusst aus der Sicht des
 * Schiedsrichters formuliert: "Du bist dran" ist etwas anderes als
 * "der Verein prueft noch".
 */
export function naechsterSchrittText(vorgang) {
  if (!vorgang) return "";
  if (vorgang.prozess_status === "abgelehnt") return "Abgelehnt.";
  if (vorgang.prozess_status === "zurueckgezogen") return "Zurückgezogen.";
  if (vorgang.prozess_status === "abgeschlossen") return "Abgeschlossen.";
  const naechster = vorgang.naechster_schritt;
  if (!naechster) return "";
  if (naechster.rolle === "schiri") return "Du bist dran: " + naechster.titel;
  if (naechster.rolle === "vorstand") return "Wartet auf den Vorstand: " + naechster.titel;
  return "Wartet auf den Obmann: " + naechster.titel;
}

/**
 * Die Schritte als Verlaufseintraege fuer "Meine Anliegen"
 * ({ wer, titel, zeit, text }). Erledigte Schritte und der gerade
 * faellige - was noch kommt, steht bewusst nicht drin: es waere eine
 * Ankuendigung, kein Verlauf.
 */
export function verlaufAusProzess(vorgang) {
  const schritte = alsListe(vorgang && vorgang.schritte);
  const eintraege = [];
  for (const schritt of schritte) {
    if (schritt.stand === "wartet" || schritt.stand === "entfaellt") continue;
    if (schritt.stand === "dran") {
      eintraege.push({
        wer: "stand",
        titel: "Aktueller Stand: " + schritt.titel,
        text: naechsterSchrittText(vorgang),
      });
      continue;
    }
    eintraege.push({
      wer: WER_AUS_ROLLE[schritt.rolle] || "stand",
      titel: schritt.titel,
      zeit: schritt.zeitpunkt || "",
      text: schritt.wert || "",
    });
  }
  // Eine Ablehnung ohne den Grund waere die halbe Nachricht.
  if (vorgang && vorgang.prozess_status === "abgelehnt" && vorgang.freigabe_notiz) {
    eintraege.push({
      wer: "obmann",
      titel: "Begründung",
      text: vorgang.freigabe_notiz,
    });
  }
  return eintraege;
}

/**
 * Die Prozesslinie als HTML. "esc" wird von der aufrufenden Seite
 * mitgegeben, damit dieses Modul keine eigene Maskierung erfindet.
 */
export function prozessLinieHtml(vorgang, esc) {
  const schritte = alsListe(vorgang && vorgang.schritte);
  if (!schritte.length) return "";
  const zeilen = schritte.map((schritt) => {
    const warSchonFaellig = schritt.stand === "erledigt" || schritt.stand === "gestoppt";
    const zusatz = [warSchonFaellig ? schritt.wert : "",
      warSchonFaellig ? kurzesDatum(schritt.zeitpunkt) : ""].filter(Boolean).join(" · ");
    return `<li class="prozess-schritt" data-stand="${esc(schritt.stand)}">
      <span class="prozess-punkt" aria-hidden="true"></span>
      <span class="prozess-wort">${esc(schritt.titel)}</span>
      ${zusatz ? `<span class="prozess-zusatz">${esc(zusatz)}</span>` : ""}
    </li>`;
  }).join("");
  return `<ol class="prozess-linie">${zeilen}</ol>`;
}

function kurzesDatum(wert) {
  if (!wert) return "";
  const tag = String(wert).slice(0, 10).split("-");
  return tag.length === 3 ? `${tag[2]}.${tag[1]}.${tag[0]}` : "";
}

/**
 * Die Schritte, die der Schiedsrichter gerade selbst setzen darf - so,
 * wie der Server sie in "meine_aktionen" mitgibt. Die Seite entscheidet
 * das nicht selbst; sie zeigt nur, was erlaubt ist.
 *
 * "zurueckgezogen" bleibt hier bewusst aussen vor: eine Anfrage
 * zurueckzuziehen ist eine folgenreiche Sache und gehoert nicht neben
 * die alltaeglichen Knoepfe.
 */
export function schiriAktionen(vorgang) {
  return alsListe(vorgang && vorgang.meine_aktionen)
    .filter((a) => a.schritt === "gekauft" || a.schritt === "geld_erhalten")
    .map((a) => ({ schritt: a.schritt, wort: SCHRITT_KNOPF[a.schritt] || a.titel }));
}

/** Ein noch ungeprüfter Beleg darf ersetzt werden, ohne den Prozess
 * künstlich auf „gekauft“ zurückzusetzen. Die Aktion wird serverseitig
 * durch schiri_anfrage_rechnung_hochladen geprüft. */
export function belegAktion(vorgang) {
  if (vorgang?.prozess_status === "beleg_hochgeladen") return "Beleg ersetzen";
  return alsListe(vorgang?.meine_aktionen).some((a) => a.schritt === "beleg_hochgeladen")
    ? "Beleg hochladen" : null;
}

/** Aus einer Prozessliste eine Zuordnung nach Anfrage-Id. */
export function nachId(liste) {
  const karte = new Map();
  for (const vorgang of alsListe(liste)) {
    if (vorgang && vorgang.id) karte.set(String(vorgang.id), vorgang);
  }
  return karte;
}
