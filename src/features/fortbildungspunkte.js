export const PUNKTE_ARTEN = Object.freeze({rla: "Regellehrabend", hrt: "Hausregeltest", jhv: "Jahreshauptversammlung", u18: "U18-Schulung"});
export function aktuelleSaison(jetzt = new Date()) {
  const teile = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Berlin",year:"numeric",month:"2-digit"}).formatToParts(jetzt);
  const jahr = Number(teile.find(t => t.type === "year").value);
  const monat = Number(teile.find(t => t.type === "month").value);
  const start = monat >= 7 ? jahr : jahr - 1;
  return `${start}/${String(start + 1).slice(-2)}`;
}
export function punkteStand(daten) {
  const termine = daten?.termine || [];
  const bestaetigt = termine.filter(t => t.gewertet === true);
  return {bestaetigt, anzahl:bestaetigt.length, regulaer:bestaetigt.filter(t => t.punkte_art !== "u18").length,
    bonus:bestaetigt.filter(t => t.punkte_art === "u18").length, ziel:daten?.ziel ?? 5, gelegenheiten:daten?.gelegenheiten ?? 8};
}
