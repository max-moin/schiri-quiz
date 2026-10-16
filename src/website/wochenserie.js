// Nur eigene Motivation. Die Daten kommen PIN-geprueft aus den bestehenden
// Antwortlogs; keine lokalen Zaehler als angeblich bestaetigten Erfolg speichern.
export function berechneWochenserie(basis) {
  const jetzt = Date.parse(basis?.jetzt);
  if (!Number.isFinite(jetzt) || !Array.isArray(basis?.wochen)) throw new Error('Ungültiger Serienstand');
  const ids = new Set();
  const wochen = basis.wochen.map(w => {
    const start = Date.parse(w.startet_am), ende = Date.parse(w.endet_am), bis = Date.parse(w.retten_bis);
    if (!w.runde_id || ids.has(w.runde_id) || !Number.isFinite(start) || !Number.isFinite(ende)
      || !Number.isFinite(bis) || start >= ende || bis <= ende || start > jetzt
      || ![w.fragen_gesamt,w.beantwortet,w.uebung_richtig].every(n => Number.isInteger(n) && n >= 0))
      throw new Error('Ungültige Quizwoche');
    ids.add(w.runde_id);
    return { ...w, start, ende, bis };
  }).filter(w => w.fragen_gesamt > 0).sort((a,b) => a.start-b.start || a.runde_id.localeCompare(b.runde_id));
  let serie = 0, beste = 0, abgeschlossen = 0, gerettet = 0;
  const rettungen = [];
  for (const w of wochen) {
    if (w.beantwortet >= w.fragen_gesamt) {
      w.status = 'abgeschlossen'; abgeschlossen++; serie++;
    } else if (jetzt < w.ende) {
      w.status = 'offen'; // Laufende Woche unterbricht noch nichts.
    } else if (w.uebung_richtig >= 5 || w.joker_gerettet === true) {
      w.status = 'gerettet'; gerettet++; serie++;
    } else {
      w.status = jetzt < w.bis ? 'rettbar' : 'verpasst';
      if (w.status === 'rettbar') rettungen.push({ ...w, serieDavor: serie, fehlen: 5-w.uebung_richtig });
      serie = 0; // Keine Abzeichen fuer eine noch nicht erfolgreiche Rettung.
    }
    beste = Math.max(beste,serie);
  }
  const aktuell = wochen.filter(w => w.start <= jetzt && jetzt < w.ende).at(-1) || null;
  return { serie, beste, abgeschlossen, gerettet, aktuell, rettungen, wochen,
    abzeichen: [
      { id:'erste-woche', titel:'Anpfiff', text:'Ein Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:1, stand:abgeschlossen },
      { id:'fuenf-wochen', titel:'Stammgast', text:'Fünf Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:5, stand:abgeschlossen },
      { id:'zehn-wochen', titel:'Zweistellig', text:'Zehn Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:10, stand:abgeschlossen },
      { id:'25-wochen', titel:'Viertelhundert', text:'25 Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:25, stand:abgeschlossen },
      { id:'vier-wochen', titel:'Drangeblieben', text:'Vier Quizwochen in einer Serie.', art:'serie', ziel:4, stand:beste },
      { id:'acht-wochen', titel:'Regelroutine', text:'Acht Quizwochen in einer Serie.', art:'serie', ziel:8, stand:beste },
      { id:'zwoelf-wochen', titel:'Dauerbrenner', text:'Zwölf Quizwochen in einer Serie.', art:'serie', ziel:12, stand:beste },
      { id:'wieder-da', titel:'Wieder da', text:'Eine verpasste Woche gerettet.', art:'rettung', ziel:1, stand:gerettet },
    ].map(b=>({...b,verdient:b.stand>=b.ziel})) };
}
