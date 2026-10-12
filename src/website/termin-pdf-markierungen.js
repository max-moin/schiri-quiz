/** Nur berechtigte eigene Mitgliedertermine markieren. Keine PDF-URLs vorladen. */
export async function markiereTerminPdfs(termine, ich, bereich, {
  fetch = globalThis.fetch, person, dokument = globalThis.document,
} = {}) {
  if (!ich?.id || !ich.pin || !bereich?.querySelectorAll) return;
  const erlaubt = new Set(termine.filter(t => t.mitgliedSicht === true && t.eigenerVerein === true).map(t => t.id));
  const karten = [...bereich.querySelectorAll('.terminkarte[data-termin-id]')]
    .filter(k => erlaubt.has(k.getAttribute('data-termin-id')));
  let index = 0;
  async function naechste() {
    while (index < karten.length) {
      if (person?.()?.id !== ich.id) return;
      const karte = karten[index++];
      try {
        const antwort = await fetch('/api/protokoll-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminId: karte.getAttribute('data-termin-id'), schiedsrichterId: ich.id, pin: ich.pin, nurStatus: true }),
        });
        if (!antwort.ok || (await antwort.json()).vorhanden !== true) continue;
        if (!karte.isConnected || person?.()?.id !== ich.id) continue;
        const ziel = karte.querySelector('.tk-marken');
        if (!ziel || ziel.querySelector('[data-pdf-markierung]')) continue;
        const marke = dokument.createElement('span'); marke.className = 'wortmarke blau'; marke.dataset.pdfMarkierung = '';
        marke.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6v20h12V6Z M14 2v5h5M9 12h6M9 16h6"/></svg> PDF-Protokoll';
        ziel.append(marke);
      } catch { /* Kein Badge ist keine Behauptung, dass kein PDF existiert. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, karten.length) }, naechste));
}
