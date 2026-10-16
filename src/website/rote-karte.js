// Nur lokale Ansicht. Keine Anmeldung, API, Speicherung oder Fachaktion.
export const PHASEN = Object.freeze(['vor-dem-spiel', 'im-spiel', 'nach-dem-spiel']);
export function phaseFuerAnker(anker) {
  const id = String(anker || '').replace(/^#/, '');
  if (PHASEN.includes(id)) return id;
  return id === 'sonderbericht-schreiben' ? 'nach-dem-spiel' : 'im-spiel';
}
export function montiereRoteKarte(wurzel, ort = globalThis.location, verlauf = globalThis.history, fenster = globalThis.window) {
  if (!wurzel) return;
  const panel = [...wurzel.querySelectorAll('[data-rk-panel]')];
  const knoepfe = [...wurzel.querySelectorAll('[data-rk-phase]')];
  const umfang = [...wurzel.querySelectorAll('[data-rk-ansicht]')];
  function zeige(phase) {
    for (const p of panel) p.hidden = p.id !== phase;
    for (const b of knoepfe) b.setAttribute('aria-pressed', String(b.dataset.rkPhase === phase));
  }
  for (const b of knoepfe) b.addEventListener('click', () => {
    zeige(b.dataset.rkPhase);
    // Kein Scrollsprung und kein automatischer Fokus-/Animierungszyklus.
    verlauf.replaceState(null, '', `#${b.dataset.rkPhase}`);
  });
  for (const b of umfang) b.addEventListener('click', () => {
    wurzel.dataset.ansicht = b.dataset.rkAnsicht;
    for (const x of umfang) x.setAttribute('aria-pressed', String(x === b));
  });
  zeige(phaseFuerAnker(ort.hash));
  wurzel.querySelector('[data-rk-werkzeuge]').hidden = false;
  fenster.addEventListener('hashchange', () => zeige(phaseFuerAnker(ort.hash)));
}
if (typeof document !== 'undefined') montiereRoteKarte(document.querySelector('[data-rote-karte]'));
