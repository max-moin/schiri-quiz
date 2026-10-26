import { SEITENHILFE, EINRICHTUNG, tourSchritte, tourAdresse, leseTour, leseFortschritt, speichereFortschritt } from '../website/hilfe-inhalte.js';
import { tourRahmen } from './tour-position.js';

export function montiereSeitenhilfe({ anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung } = {}) {
  const seite = location.pathname.split('/').pop() || 'index.html';
  const main = document.querySelector('main');
  if (!main || !SEITENHILFE[seite] || document.querySelector('[data-seitenhilfe]')) return;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('../../stil/seitenhilfe.css', import.meta.url).href;
  document.head.append(css);
  // Speicher kann in privaten/gesperrten Browsern fehlen. Dann bleibt die
  // Hilfe benutzbar; seitenuebergreifende Tour wird ausdruecklich abgelehnt.
  const speicher = art => { try { return globalThis[art]; } catch { return null; } };
  const local = speicher('localStorage'); const session = speicher('sessionStorage');
  const lesen = () => anmeldung?.lesen()?.id || null;
  let konto = lesen(); let stand = leseFortschritt(local, konto);
  let tour = null; let dialog = null; let fokusZurueck = null; let animation = 0;
  let geaendert = false; let liste = null;
  const knopf = document.createElement('button');
  knopf.type = 'button'; knopf.className = 'seitenhilfe-knopf'; knopf.dataset.seitenhilfe = '';
  knopf.innerHTML = '<span aria-hidden="true">?</span> Hilfe';
  knopf.setAttribute('aria-label', 'Hilfe zu dieser Seite');
  const werkzeuge = document.createElement('div');
  werkzeuge.className = 'seiten-werkzeuge';
  const weg = main.querySelector('.wegweiser');
  if (weg) werkzeuge.append(weg);
  werkzeuge.append(knopf); main.prepend(werkzeuge);
  const el = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
  const button = (text, label, aktion) => {
    const b = el('button', text); b.type = 'button'; if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', aktion); return b;
  };
  const notiz = el('p'); notiz.setAttribute('role', 'status');
  const entfernen = () => { try { session?.removeItem('schiriTour.v1'); } catch {} };
  function speichernTour() {
    try { session.setItem('schiriTour.v1', JSON.stringify({ ...tour, zeit: Date.now(), konto })); return true; }
    catch { return false; }
  }
  function schliessen() {
    entfernen(); tour = null;
    if (dialog) { dialog.close(); dialog.remove(); dialog = null; }
    const rueckkehr = fokusZurueck?.isConnected && fokusZurueck !== document.body ? fokusZurueck : knopf;
    rueckkehr.focus();
  }
  function neuesDialog(klasse) {
    if (!dialog) fokusZurueck = document.activeElement;
    else { dialog.close(); dialog.remove(); }
    dialog = el('dialog'); dialog.className = `seitenhilfe-dialog ${klasse || ''}`;
    dialog.setAttribute('aria-labelledby', 'seitenhilfe-titel');
    dialog.addEventListener('cancel', e => { e.preventDefault(); schliessen(); });
    document.body.append(dialog); return dialog;
  }
  function hilfeOeffnen() {
    tour = null; entfernen();
    const d = neuesDialog();
    d.append(button('×', 'Hilfe schließen', schliessen)); d.firstChild.className = 'seitenhilfe-schliessen';
    const h = el('h2', SEITENHILFE[seite].titel); h.id = 'seitenhilfe-titel'; d.append(h);
    for (const s of SEITENHILFE[seite].schritte) {
      d.append(el('h3', s.titel), el('p', s.text));
    }
    const aktionen = el('div'); aktionen.className = 'seitenhilfe-links';
    aktionen.append(button('Diese Seite zeigen', null, () => starten('seite')),
      button('Einführungstour', null, () => starten('einstieg')));
    const link = el('a', 'Alle Hilfen'); link.href = 'hilfe.html'; aktionen.append(link);
    d.append(aktionen); d.showModal();
  }
  knopf.addEventListener('click', hilfeOeffnen);
  document.querySelectorAll('[data-einstieg-starten]').forEach(b => b.addEventListener('click', () => starten('einstieg')));

  function starten(art) {
    // Andere Formulare nicht hinter einem zweiten modalen Fenster verstecken.
    if (document.querySelector('dialog[open]:not(.seitenhilfe-dialog)')) {
      globalThis.alert('Schließe zuerst das geöffnete Formular. Deine Eingaben bleiben erhalten.'); return;
    }
    konto = lesen(); stand = leseFortschritt(local, konto);
    tour = { art, seite, index: 0, konto }; zeigeSchritt();
  }
  function wechseln(index) {
    const schritte = tourSchritte(tour.art, tour.seite);
    if (index >= schritte.length) {
      if (tour.art === 'einstieg' && konto) {
        stand.tour = 'angesehen'; speichereFortschritt(local, konto, stand); zeichneListe();
      }
      schliessen();
      const d = neuesDialog();
      const h = el('h2', 'Tour abgeschlossen'); h.id = 'seitenhilfe-titel';
      d.append(h,el('p','Die wichtigsten Wege kennst du jetzt. Das Fragezeichen erklärt dir bei Bedarf die jeweilige Seite.'),button('Fertig',null,schliessen));
      d.showModal();
      return;
    }
    const s = schritte[index];
    const adresse = tour.art === 'seite' ? seite + location.search : tourAdresse(s);
    const woanders = adresse !== seite + location.search;
    if (woanders && geaendert && !globalThis.confirm('Für den nächsten Schritt wird die Seite gewechselt. Ungespeicherte Eingaben können verloren gehen. Trotzdem wechseln?')) return;
    tour.index = index;
    if (woanders) {
      if (!speichernTour()) { globalThis.alert('Der Browser erlaubt keinen Sitzungsspeicher. Nutze stattdessen „Diese Seite zeigen“ in der Seitenhilfe.'); return; }
      location.assign(adresse); return;
    }
    zeigeSchritt();
  }
  function sichtbaresZiel(s) {
    for (const selector of s.ziel.split(',')) {
      const ziel = [...document.querySelectorAll(selector.trim())].find(e => {
        const geschlossen = e.closest('details:not([open])');
        return e.getClientRects().length && !e.closest('[hidden]')
          && (!geschlossen || geschlossen.querySelector('summary')?.contains(e))
          && (typeof e.checkVisibility !== 'function' || e.checkVisibility({ checkVisibilityCSS: true }));
      });
      if (ziel) return ziel;
    }
    return knopf;
  }
  function platzieren() {
    if (!tour || !dialog?.open) return;
    const s = tourSchritte(tour.art, tour.seite)[tour.index];
    const ziel = sichtbaresZiel(s); const rect = ziel.getBoundingClientRect();
    const viewport = globalThis.visualViewport;
    const w = viewport?.width || innerWidth; const h = viewport?.height || innerHeight;
    const ox = viewport?.offsetLeft || 0; const oy = viewport?.offsetTop || 0;
    const spot = dialog.querySelector('.seitenhilfe-spot'); const karte = dialog.querySelector('.seitenhilfe-karte');
    const rahmen = tourRahmen(rect, { width: w, height: h, offsetLeft: ox, offsetTop: oy });
    Object.assign(spot.style, Object.fromEntries(Object.entries(rahmen).map(([key, value]) => [key, `${value}px`])));
    karte.style.maxHeight = `${h - 24}px`;
    const kw = karte.offsetWidth; const kh = karte.offsetHeight;
    let x = ox + w - kw - 12; let y = oy + h - kh - 12;
    if (w > 700 && rect.right + kw + 28 <= ox + w) { x = rect.right + 16; y = Math.max(oy + 12, Math.min(rect.top, oy + h - kh - 12)); }
    else if (rect.bottom + kh + 28 < oy + h) { x = Math.max(ox + 12, Math.min(rect.left, ox + w - kw - 12)); y = rect.bottom + 16; }
    else if (rect.top - kh - 28 > oy) { x = Math.max(ox + 12, Math.min(rect.left, ox + w - kw - 12)); y = rect.top - kh - 16; }
    Object.assign(karte.style, { left: `${x}px`, top: `${y}px` });
  }
  function aktualisieren() { cancelAnimationFrame(animation); animation = requestAnimationFrame(platzieren); }
  function zeigeSchritt() {
    const s = tourSchritte(tour.art, tour.seite)[tour.index];
    if ((tour.art === 'seite' ? seite + location.search : tourAdresse(s)) !== seite + location.search) { wechseln(tour.index); return; }
    const d = neuesDialog('seitenhilfe-tour');
    const spot = el('div'); spot.className = 'seitenhilfe-spot'; spot.setAttribute('aria-hidden', 'true');
    const karte = el('div'); karte.className = 'seitenhilfe-karte';
    const zu = button('×', 'Tour beenden', schliessen); zu.className = 'seitenhilfe-schliessen';
    const schritte = tourSchritte(tour.art, tour.seite);
    const zaehler = el('p', `${tour.index + 1} / ${schritte.length} · ${SEITENHILFE[s.seite].titel}`); zaehler.className = 'seitenhilfe-zaehler';
    const h = el('h2', s.titel); h.id = 'seitenhilfe-titel'; h.tabIndex = -1;
    const text = el('p', s.text); text.id = 'seitenhilfe-beschreibung'; d.setAttribute('aria-describedby', text.id);
    const steuerung = el('div'); steuerung.className = 'seitenhilfe-steuerung';
    const zurueck = button('←', 'Vorheriger Schritt', () => wechseln(tour.index - 1)); zurueck.disabled = tour.index === 0;
    const weiter = button(tour.index === schritte.length - 1 ? '✓' : '→', tour.index === schritte.length - 1 ? 'Tour abschließen' : 'Nächster Schritt', () => wechseln(tour.index + 1)); weiter.className = 'seitenhilfe-haupt';
    steuerung.append(zurueck, weiter); karte.append(zu, zaehler, h, text, steuerung); d.append(spot, karte);
    sichtbaresZiel(s).scrollIntoView({ block: 'center', behavior: 'instant' });
    d.showModal(); platzieren(); h.focus({ preventScroll: true }); speichernTour();
  }
  window.addEventListener('resize', aktualisieren); window.addEventListener('scroll', aktualisieren, { passive: true });
  globalThis.visualViewport?.addEventListener('resize', aktualisieren);
  globalThis.visualViewport?.addEventListener('scroll', aktualisieren);
  // Datenlisten werden asynchron ersetzt. Nur Aenderungen ausserhalb des
  // Dialogs beobachten, damit die Positionspflege keine Schleife ausloest.
  new MutationObserver(aktualisieren).observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  main.addEventListener('input', e => { if (e.target.closest('form')) geaendert = true; });
  main.addEventListener('change', e => { if (e.target.closest('form')) geaendert = true; });

  function zeichneListe() {
    const ziel = document.querySelector('#einstellungen-inhalt');
    if (!ziel || !konto) { liste?.remove(); liste = null; return; }
    if (!liste) {
      liste = el('details'); liste.className = 'einrichtung'; liste.dataset.einrichtung = ''; liste.open = true; ziel.append(liste);
    }
    const offen = liste.open; liste.replaceChildren(); liste.open = offen;
    const fertig = EINRICHTUNG.filter(s => stand[s.id] === 'angesehen').length;
    const ausgelassen = EINRICHTUNG.filter(s => stand[s.id] === 'ausgelassen').length;
    const kopf = el('summary');
    kopf.append(el('strong', 'Dein Einstieg'));
    const zaehler = el('span', `${fertig + ausgelassen} / ${EINRICHTUNG.length}`); zaehler.className = 'einrichtung-zaehler';
    zaehler.setAttribute('aria-label', `${fertig} von ${EINRICHTUNG.length} angesehen${ausgelassen ? `, ${ausgelassen} ausgelassen` : ''}`);
    kopf.append(zaehler); liste.append(kopf);
    const offenZahl = EINRICHTUNG.length - fertig - ausgelassen;
    const info = el('p', offenZahl ? `${offenZahl} offen · in deinem Tempo.` : 'Alles durchgesehen.'); info.className = 'seitenhilfe-hinweis'; liste.append(info);
    const fortschritt = el('progress'); fortschritt.max = EINRICHTUNG.length; fortschritt.value = fertig + ausgelassen;
    fortschritt.setAttribute('aria-label','Einrichtung: erledigt oder ausgelassen'); liste.append(fortschritt);
    const ul = el('ul'); ul.className = 'einrichtung-liste';
    const erledigt = el('details'); erledigt.className = 'einrichtung-archiv';
    erledigt.append(el('summary',`Abgeschlossen oder ausgelassen · ${fertig + ausgelassen}`));
    const archiv = el('ul'); archiv.className = 'einrichtung-liste'; erledigt.append(archiv);
    const icons = {tour:'compass',daten:'user',bestand:'shirt',quiz:'check',termine:'calendar',push:'bell'};
    const pfade = {compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',shirt:'<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',check:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zm5 4h4"/>'};
    for (const s of EINRICHTUNG) {
      const li = el('li'); const status = stand[s.id];
      li.className = status === 'angesehen' ? 'einrichtung-erledigt' : status === 'ausgelassen' ? 'einrichtung-ausgelassen' : '';
      const inhalt = el('div'); inhalt.className = 'einrichtung-schritt';
      const icon = el('span'); icon.className = 'einrichtung-icon'; icon.setAttribute('aria-hidden','true');
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pfade[icons[s.id]]}</svg>`;
      const titel = el('strong', s.titel); inhalt.append(icon,titel);
      if (status) inhalt.append(el('small',status==='angesehen'?'✓ Erledigt':'– Ausgelassen'));
      li.append(inhalt);
      const aktionen = el('div'); aktionen.className = 'einrichtung-aktionen';
      if (!status && s.tour) aktionen.append(button('Tour starten', null, () => starten('einstieg')));
      else if (!status) { const a = el('a', 'Öffnen'); a.href = s.href; aktionen.append(a); }
      for (const [wert, wort] of status ? [[status,'Wieder öffnen']] : [['angesehen', '✓ Erledigt'], ['ausgelassen', 'Auslassen']]) {
        const b = button(wort, `${s.titel}: ${wort}`, () => {
          if (stand[s.id] === wert) delete stand[s.id]; else stand[s.id] = wert;
          const gespeichert = speichereFortschritt(local, konto, stand);
          zeichneListe(); notiz.textContent = gespeichert ? 'Einrichtungsstand gespeichert.' : 'Nur für diese Seite gemerkt; der Browser erlaubt keinen dauerhaften Speicher.';
          liste.querySelector('.einrichtung-liste button, .einrichtung-liste a, summary')?.focus({preventScroll:true});
        }); b.dataset.schritt = s.id; b.dataset.zustand = wert;
        b.setAttribute('aria-pressed', String(status === wert)); aktionen.append(b);
      }
      li.append(aktionen); (status ? archiv : ul).append(li);
    }
    liste.append(ul);
    if (fertig + ausgelassen) liste.append(erledigt);
    liste.append(notiz,el('p','Freiwillig · nur in diesem Browser gespeichert.'));
  }
  anmeldung?.abonniere?.(p => {
    const neueId = p?.id || null;
    if (neueId !== konto) { schliessen(); konto = neueId; stand = leseFortschritt(local, konto); notiz.textContent = ''; }
    zeichneListe();
  });
  zeichneListe();
  const fortsetzen = leseTour(session);
  if (fortsetzen && (fortsetzen.konto || null) === konto
      && tourSchritte(fortsetzen.art, fortsetzen.seite)[fortsetzen.index].seite === seite) { tour = fortsetzen; zeigeSchritt(); }
  else entfernen();
  return Object.freeze({ hilfeOeffnen, starten });
}
