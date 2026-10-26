// Code is complete and testable, but no new provider use is silently enabled.
// Google API terms (2026-03-23) exclude API clients likely accessed under 18.
// Open only after a suitable provider/contract route has been agreed with Max.
export const ICON_NACHFRAGE_FREIGEGEBEN = false;

export function nachfrageAntwort(antwort, kontext) {
  if (!kontext.nachfrage_offen || !kontext.erste_antwort) return antwort;
  const {_begruendung, ...erste} = kontext.erste_antwort;
  return {...erste,begruendung:antwort.begruendung};
}
export function offeneNachfrage(kontext) {
  return {nachbesserung_offen:true,bewertungsstatus:'nachbessern',ki_nachfrage:kontext.nachfrage,
    antwort:Object.fromEntries(Object.entries(kontext.erste_antwort || {}).filter(([k])=>!k.startsWith('_')))};
}
export function begruendungsStatus(result, ortRichtig, erlauben) {
  const status=result.begruendung_status;
  if (result.ungueltig === true || !ortRichtig) return {richtig:false,status:'falsch',nachfrage:null};
  if (erlauben && status==='nachbessern' && typeof result.nachfrage==='string'
      && result.nachfrage.trim().length>=8 && result.nachfrage.length<=240) {
    return {richtig:false,status:'nachbessern',nachfrage:result.nachfrage.trim()};
  }
  return {richtig:result.begruendung_richtig===true,status:result.begruendung_richtig===true?'richtig':'falsch',nachfrage:null};
}
