// Eigene Detailansichten; bisherige geteilte #dfbnet/#sonderbericht-Links bleiben gültig.
const themen = ['dfbnet', 'sonderbericht', 'schiri-treff'];
const titel = document.getElementById('hilfe-seitentitel');
const uebersicht = ['hilfe-einstieg', 'hilfe-uebersicht'];
function zeichne({ fokus = false } = {}) {
  const thema = location.hash.slice(1);
  const detail = themen.includes(thema) ? document.getElementById(thema) : null;
  for (const id of uebersicht) document.getElementById(id).hidden = Boolean(detail);
  for (const id of themen) document.getElementById(id).hidden = !detail || id !== thema;
  titel.hidden = Boolean(detail);
  const zurueck = document.querySelector('.wegweiser-zurueck');
  if (zurueck) {
    zurueck.href = detail ? 'hilfe.html' : 'index.html';
    zurueck.setAttribute('aria-label', detail ? 'Zurück zu Hilfe' : 'Zurück zu Start');
    zurueck.querySelector('.wegweiser-ziel').textContent = detail ? 'Hilfe' : 'Start';
  }
  if (fokus && detail) {
    const heading = detail.querySelector('h2'); heading.tabIndex = -1; heading.focus({ preventScroll: true });
    document.querySelector('main').scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
zeichne({ fokus: Boolean(location.hash) });
// Beim direkt geöffneten Fragment kann der Browser erst nach den Modulen
// zum Anker springen. Danach einmal den Rückweg unter der Kopfzeile zeigen.
if (location.hash) window.addEventListener('load', () => zeichne({ fokus: true }), { once: true });
window.addEventListener('hashchange', () => zeichne({ fokus: true }));
