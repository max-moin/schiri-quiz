// Nur lokale Ansicht. Keine Anmeldung, API, Speicherung oder Fachaktion.
export const PHASEN = Object.freeze(['vor-dem-spiel', 'im-spiel', 'nach-dem-spiel']);
const lebenszyklen = new WeakMap();
export function phaseFuerAnker(anker) {
  const id = String(anker || '').replace(/^#/, '');
  if (PHASEN.includes(id)) return id;
  return id === 'sonderbericht-schreiben' ? 'nach-dem-spiel' : 'im-spiel';
}
export function montiereRoteKarte(wurzel, ort = globalThis.location, verlauf = globalThis.history, fenster = globalThis.window) {
  if (!wurzel) return;
  lebenszyklen.get(wurzel)?.();
  const abmeldungen = [];
  const hoere = (el, typ, fn) => { el.addEventListener(typ, fn); abmeldungen.push(() => el.removeEventListener(typ, fn)); };
  const panel = [...wurzel.querySelectorAll('[data-rk-panel]')];
  const knoepfe = [...wurzel.querySelectorAll('[data-rk-phase]')];
  const umfang = [...wurzel.querySelectorAll('[data-rk-ansicht]')];
  function zeige(phase) {
    for (const p of panel) p.hidden = p.id !== phase;
    for (const b of knoepfe) b.setAttribute('aria-pressed', String(b.dataset.rkPhase === phase));
  }
  for (const b of knoepfe) hoere(b, 'click', () => {
    zeige(b.dataset.rkPhase);
    // Kein Scrollsprung und kein automatischer Fokus-/Animierungszyklus.
    verlauf.replaceState(null, '', `#${b.dataset.rkPhase}`);
  });
  for (const b of umfang) hoere(b, 'click', () => {
    wurzel.dataset.ansicht = b.dataset.rkAnsicht;
    for (const x of umfang) x.setAttribute('aria-pressed', String(x === b));
  });
  for (const b of umfang) b.setAttribute('aria-pressed', String(b.dataset.rkAnsicht === wurzel.dataset.ansicht));
  zeige(phaseFuerAnker(ort.hash));
  wurzel.querySelector('[data-rk-werkzeuge]').hidden = false;
  hoere(fenster, 'hashchange', () => {
    if (PHASEN.includes(ort.hash.slice(1)) || ort.hash === '#sonderbericht-schreiben') zeige(phaseFuerAnker(ort.hash));
  });
  const aufraeumen = () => abmeldungen.forEach(fn => fn());
  lebenszyklen.set(wurzel, aufraeumen);
  return aufraeumen;
}
if (typeof document !== 'undefined') montiereRoteKarte(document.querySelector('[data-rote-karte]'));
