const FESTE_BETREFFE = Object.freeze({
  "quiz.abgeschlossen": "— SR-OBMANN · QUIZ — Quiz abgeschlossen",
  "frage_feedback.neu": "— SR-OBMANN · FEEDBACK — Neue Rückmeldung",
  "meldung.regelfall": "— SR-OBMANN · MELDUNG — Neuer Regelfall",
  "meldung.vorfall": "— SR-OBMANN · MELDUNG — Neuer Vorfall",
  "meldung.gespraech": "— SR-OBMANN · MELDUNG — Neuer Gesprächswunsch",
  "meldung.website": "— SR-OBMANN · WEBSITE — Neues Feedback",
  "meldung.treff": "— SR-OBMANN · TREFF — Neuer Themenvorschlag",
  "fragenvorschlag.neu": "— SR-OBMANN · FRAGE — Neuer Vorschlag",
  "terminvorschlag.neu": "— SR-OBMANN · TERMIN — Neuer Vorschlag",
  "termin.absage": "— SR-OBMANN · TERMIN — Neue Absage",
  "ausruestung.eingereicht": "— SR-OBMANN · AUSRÜSTUNG — Neue Anfrage",
  "ausruestung.freigegeben": "— SR-OBMANN · AUSRÜSTUNG — Anfrage freigegeben",
  "ausruestung.abgelehnt": "— SR-OBMANN · AUSRÜSTUNG — Anfrage abgelehnt",
  "ausruestung.gekauft": "— SR-OBMANN · AUSRÜSTUNG — Kauf bestätigt",
  "ausruestung.beleg_hochgeladen": "— SR-OBMANN · AUSRÜSTUNG — Neuer Beleg",
  "ausruestung.zahlung_angewiesen": "— SR-OBMANN · AUSRÜSTUNG — Zahlung angewiesen",
  "ausruestung.geld_erhalten": "— SR-OBMANN · AUSRÜSTUNG — Zahlung erhalten",
});

const TYPEN_OHNE_PERSON = new Set([
  "meldung.regelfall",
  "meldung.vorfall",
  "meldung.gespraech",
  "meldung.website",
  "meldung.treff",
]);

export function saubererAnzeigename(wert) {
  if (typeof wert !== "string") return "";
  return wert.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function betreffFuer(typ, metadaten = {}) {
  const basis = FESTE_BETREFFE[typ] || "— SR-OBMANN · EINGANG — Neuer Eintrag";
  if (TYPEN_OHNE_PERSON.has(typ)) return basis;
  const name = saubererAnzeigename(metadaten?.anzeigename);
  const anzahl = Number(metadaten?.anzahl);
  const umfang = typ === "ausruestung.eingereicht" && Number.isInteger(anzahl) && anzahl > 1
    ? ` (${Math.min(anzahl, 12)} Teile)` : "";
  return name ? `${basis}: ${name}${umfang}` : basis + umfang;
}
