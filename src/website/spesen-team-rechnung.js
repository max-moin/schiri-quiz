import { aufCent, leseZahl, landFahrtkosten } from './spesen-rechnung.js';

/** Shared competition, separate functions and travel; no origin/address data. */
export function rechneTeam({ liga, personen, saetze }) {
  const zeilen = personen.map((p, i) => {
    const pauschale = i === 0 ? liga?.sr : liga?.sra;
    const spesen = { betrag: aufCent(pauschale ?? 0), unsicher: pauschale == null };
    let fahrt;
    if (p.art === 'mitfahrt') {
      const fahrer = personen.find(q => q.id === p.fahrer && q.id !== p.id && q.art === 'auto');
      fahrt = { betrag: 0, unsicher: !fahrer, text: fahrer ? `Mitfahrt bei ${fahrer.name || 'Fahrer/in'} · keine zweite Autofahrt` : 'Fahrer/in auswählen' };
    } else if (p.art === 'keine') {
      fahrt = { betrag: 0, unsicher: false, text: 'Keine Fahrtkosten' };
    } else if (liga?.verband === 'svfd' && p.art === 'zonen') {
      const z = Number(p.zonen);
      const gueltig = Number.isInteger(z) && z >= 1 && z <= 3;
      fahrt = { betrag: gueltig ? aufCent(z * saetze.svfd.kartenJeZone * saetze.svfd.preisJeKarte) : 0,
        unsicher: !gueltig, text: gueltig ? `${z} Tarifzone(n) · Hin- und Rückfahrt` : '1–3 Tarifzonen bestätigen; darüber gesondert klären' };
    } else if (p.art === 'manuell') {
      const betrag = leseZahl(p.betrag);
      fahrt = { betrag: aufCent(betrag ?? 0), unsicher: betrag == null, text: 'Selbst eingetragener Betrag · Berechtigung/Belege prüfen' };
    } else if (liga?.verband === 'sfv' && ['auto', 'rad', 'karte', 'ticket'].includes(p.art)) {
      fahrt = landFahrtkosten({ art: p.art, kmRoh: p.km, ticketRoh: p.betrag, mitnahme: false, saetze: saetze.sfv });
      // No automatic surcharge: joint route portions must be verified, not inferred.
    } else fahrt = { betrag: 0, unsicher: true, text: 'Fahrtkosten für diese Ebene neu auswählen' };
    return { id: p.id, name: p.name || (i ? `Assistent ${i}` : 'Schiedsrichter'), funktion: i ? 'SRA' : 'SR', spesen, fahrt,
      gesamt: aufCent(spesen.betrag + fahrt.betrag), unsicher: spesen.unsicher || fahrt.unsicher };
  });
  return { zeilen, gesamt: aufCent(zeilen.reduce((s, p) => s + p.gesamt, 0)), unsicher: !liga || zeilen.some(p => p.unsicher) };
}
