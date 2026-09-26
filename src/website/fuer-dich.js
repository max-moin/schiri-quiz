// ============================================================
//  "Für dich" - was ein angemeldeter Schiri gerade tun sollte
// ============================================================
//  26.09.2026, Kernanalyse der Website aus Nutzersicht: Wer angemeldet
//  auf die Startseite kam, sah dasselbe wie ein Fremder - Aufmacher,
//  drei Kacheln, fertig. Dass zwei Termine auf seine Zusage warten oder
//  der Obmann auf sein Feedback geantwortet hat, erfuhr er erst, wenn
//  er zufaellig die richtige Unterseite oeffnete.
//
//  Dieser Baustein rechnet nur aus, WAS offen ist. Keine Oberflaeche,
//  kein Netz - so laesst er sich ohne Browser pruefen
//  (tests/fuer-dich.test.js). Die Verdrahtung steht in
//  startseite-fuer-dich.js.
//
//  Regeln, bewusst dieselben wie auf termine.html:
//   - Ein Termin zaehlt nur, wenn er eine Rueckmeldung verlangt, noch
//     nicht vorbei ist, man noch nichts gesagt hat UND eine Zusage noch
//     geht. "Frist abgelaufen" ist keine Aufgabe, nur ein Vorwurf.
//   - Eine Abstimmung zaehlt nur, solange sie offen ist, die Frist nicht
//     abgelaufen ist und bei mindestens einem Vorschlag die eigene
//     Antwort fehlt.
// ============================================================

export function offeneTermine(termine) {
  return (Array.isArray(termine) ? termine : [])
    .filter((t) => t && t.rueckmeldung_erforderlich === true
      && (t.mein_status === null || t.mein_status === undefined)
      && t.vergangen !== true
      && t.zusage_moeglich !== false)
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

export function offeneAbstimmungen(findungen) {
  return (Array.isArray(findungen) ? findungen : [])
    .filter((f) => f && f.status === "offen" && f.frist_abgelaufen !== true
      && Array.isArray(f.vorschlaege)
      && f.vorschlaege.some((v) => v.meine_antwort === null || v.meine_antwort === undefined));
}

const anfuehrung = (text) => `„${text}“`;

/** Liste der Punkte fuer die Startseite, hoechstens einer je Art. */
export function fuerDichPunkte({ termine, findungen, neueAntworten } = {}) {
  const punkte = [];
  const t = offeneTermine(termine);
  if (t.length === 1) {
    punkte.push({
      art: "termin",
      titel: `${anfuehrung(t[0].titel)} wartet auf deine Zu- oder Absage`,
      href: `termine.html?termin=${encodeURIComponent(t[0].id)}`,
    });
  } else if (t.length > 1) {
    punkte.push({
      art: "termin",
      titel: `${t.length} Termine warten auf deine Zu- oder Absage`,
      zusatz: `Als Nächstes: ${t[0].titel}`,
      href: "termine.html",
    });
  }
  const a = offeneAbstimmungen(findungen);
  if (a.length) {
    punkte.push({
      art: "abstimmung",
      titel: a.length === 1
        ? `Stimm ab: ${anfuehrung(a[0].titel)}`
        : `${a.length} Terminabstimmungen warten auf dich`,
      zusatz: "Welcher Termin passt dir?",
      href: "termine.html",
    });
  }
  if (Number(neueAntworten) > 0) {
    punkte.push({
      art: "antwort",
      titel: "Der Obmann hat dir geantwortet",
      zusatz: "Auf dein Feedback oder Anliegen",
      href: "meine-anliegen.html",
    });
  }
  return punkte;
}
