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
  const sammlung = basis.sammlung;
  const zahl = n => Number.isInteger(n) && n >= 0 ? n : null;
  const hatDaten = sammlung?.version === 1 && zahl(sammlung.treffer) !== null && zahl(sammlung.vorschlaege) !== null
    && sammlung.regeln && sammlung.wochen_richtig;
  let perfekt = 0, perfektFolge = 0, perfektBeste = 0, kopfHoch = 0;
  if (hatDaten) for (const w of wochen) {
    const richtig = zahl(sammlung.wochen_richtig[w.runde_id]);
    if (richtig === null) { perfektFolge = 0; continue; }
    if (w.status === 'abgeschlossen' && richtig === w.fragen_gesamt) {
      perfekt++; perfektFolge++; perfektBeste = Math.max(perfektBeste, perfektFolge);
    } else if (w.status !== 'offen') {
      perfektFolge = 0;
      if (w.status === 'abgeschlossen' && richtig === 0) kopfHoch++;
    }
  }
  const regeln = Array.from({length:17},(_,i)=>({nummer:i+1,stand:hatDaten ? zahl(sammlung.regeln[String(i+1)]) ?? 0 : 0}));
  const neu = [
    {id:'weisse-weste',titel:'Weiße Weste',text:'Ein Wochenquiz vollständig und richtig beantwortet.',art:'perfekt',ziel:1,stand:perfekt},
    {id:'hattrick',titel:'Hattrick',text:'Drei perfekte Quizwochen in Folge. Rettungen ersetzen keine richtige Antwort.',art:'perfekt-serie',ziel:3,stand:perfektBeste},
    {id:'praezision',titel:'Präzision',text:'Zehn perfekte Wochenquiz insgesamt.',art:'perfekt',ziel:10,stand:perfekt},
    ...[[3,'wechselprofi','Wechselprofi'],[11,'abseitsblick','Abseitsblick'],[12,'fingerspitzengefuehl','Fingerspitzengefühl'],[14,'elfmeterpunkt','Elfmeterpunkt']].map(([regel,id,titel])=>({id,titel,text:`Zehn verschiedene Fragen zu Regel ${regel} richtig beantwortet.`,art:'regel',regel,ziel:10,stand:regeln[regel-1].stand})),
    {id:'regelkompass',titel:'Regelkompass',text:'Zu jeder der 17 Regeln mindestens eine Frage richtig beantwortet.',art:'kompass',ziel:17,stand:regeln.filter(r=>r.stand>0).length},
    {id:'hundert-treffer',titel:'Hundert Treffer',text:'100 verschiedene Fragen richtig beantwortet.',art:'treffer',ziel:100,stand:hatDaten?sammlung.treffer:0},
    {id:'regelarchiv',titel:'Regelarchiv',text:'250 verschiedene Fragen richtig beantwortet.',art:'treffer',ziel:250,stand:hatDaten?sammlung.treffer:0},
    {id:'kopf-hoch',titel:'Kopf hoch',text:'Eine Woche ganz beantwortet, auch wenn nichts richtig war. Danke, dass du drangeblieben bist! Keine Zusatzpunkte oder Joker.',art:'mut',ziel:1,stand:kopfHoch},
    {id:'aus-unserer-mitte',titel:'Aus unserer Mitte',text:'Ein eigener Fragenvorschlag wurde nach Prüfung als Frage übernommen.',art:'vorschlag',ziel:1,stand:hatDaten?sammlung.vorschlaege:0},
  ].map(b=>({...b,datenFehlen:!hatDaten}));
  return { serie, beste, abgeschlossen, gerettet, aktuell, rettungen, wochen,
    regeln, sammlungVerfuegbar:!!hatDaten,
    abzeichen: [
      { id:'erste-woche', titel:'Anpfiff', text:'Ein Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:1, stand:abgeschlossen },
      { id:'fuenf-wochen', titel:'Stammgast', text:'Fünf Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:5, stand:abgeschlossen },
      { id:'zehn-wochen', titel:'Zweistellig', text:'Zehn Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:10, stand:abgeschlossen },
      { id:'25-wochen', titel:'Viertelhundert', text:'25 Wochenquiz vollständig beantwortet.', art:'teilnahme', ziel:25, stand:abgeschlossen },
      { id:'vier-wochen', titel:'Drangeblieben', text:'Vier Quizwochen in einer Serie.', art:'serie', ziel:4, stand:beste },
      { id:'acht-wochen', titel:'Regelroutine', text:'Acht Quizwochen in einer Serie.', art:'serie', ziel:8, stand:beste },
      { id:'zwoelf-wochen', titel:'Dauerbrenner', text:'Zwölf Quizwochen in einer Serie.', art:'serie', ziel:12, stand:beste },
      { id:'wieder-da', titel:'Wieder da', text:'Eine verpasste Woche gerettet.', art:'rettung', ziel:1, stand:gerettet },
      ...neu,
    ].map(b=>({...b,verdient:!b.datenFehlen && b.stand>=b.ziel})) };
}
