const sauber = (wert, max = 160) => String(wert ?? "")
  .replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const euro = (cent) => cent !== null && cent !== undefined && Number.isFinite(Number(cent))
  ? (Number(cent) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
  : "Preis offen";

export function vorstandMail(meta = {}) {
  const person = sauber(meta.person, 80) || "ein Schiedsrichter";
  const positionen = Array.isArray(meta.positionen) ? meta.positionen.slice(0, 12) : [];
  const anzahl = positionen.length || Math.max(1, Number(meta.anzahl) || 1);
  const betreff = `[SR-FREIGABE] ${person}: ${anzahl} Artikel zur Entscheidung`;
  const zeilen = [
    `${person} hat ${anzahl} ${anzahl === 1 ? "Ausrüstungsartikel" : "Ausrüstungsartikel"} angefragt.`,
    "Die Anfrage wurde dir zur Entscheidung vorgelegt.", "",
  ];
  positionen.forEach((teil, index) => {
    const beschreibung = [teil.bezeichnung, teil.farbe,
      teil.groesse && `Größe ${teil.groesse}`,
      teil.aermellaenge && `${teil.aermellaenge}er Arm`]
      .map((wert) => sauber(wert, 80)).filter(Boolean).join(" · ");
    zeilen.push(`${index + 1}. ${beschreibung || "Ausrüstungsartikel"} — ${euro(teil.preis_cent)}`);
    if (teil.anmerkung) zeilen.push(`   Hinweis: ${sauber(teil.anmerkung, 400)}`);
  });
  if (meta.gesamt_anmerkung) {
    zeilen.push("", `Hinweis zur gesamten Anfrage: ${sauber(meta.gesamt_anmerkung, 600)}`);
  }
  zeilen.push("", `Gesamtrichtwert: ${euro(meta.gesamt_cent)}`, "",
    "Bitte öffne deinen gespeicherten persönlichen Freigabe-Link und entscheide dort über die einzelnen Artikel.",
    "Diese Mail enthält bewusst keinen Zugangscode.");
  return { betreff, text: zeilen.join("\n") };
}

export function vorstandZahlungMail(meta = {}) {
  const person = sauber(meta.person, 80) || "ein Schiedsrichter";
  const gegenstand = [meta.bezeichnung, meta.farbe,
    meta.groesse && `Größe ${meta.groesse}`]
    .map((wert) => sauber(wert, 80)).filter(Boolean).join(" · ");
  const zeilen = [
    `Für ${person} wurde die Zahlung beauftragt.`,
    `Gegenstand: ${gegenstand || "Ausrüstung"}`,
    `Freigegebener Betrag: ${euro(meta.betrag_cent)}`,
  ];
  if (meta.hinweis) {
    zeilen.push(`Hinweis zum Beleg/Übergang: ${sauber(meta.hinweis, 500)}`);
  }
  zeilen.push("",
    "Bitte öffne deinen gespeicherten persönlichen Freigabe-Link.",
    "Bestätige dort erst nach der tatsächlichen Überweisung die Zahlung.",
    "Danach bestätigt der Schiedsrichter den Geldeingang.",
    "Diese Mail enthält bewusst keinen Zugangscode.");
  return {
    betreff: `[SR-ZAHLUNG] ${person}: ${euro(meta.betrag_cent)} beauftragt`,
    text: zeilen.join("\n"),
  };
}
