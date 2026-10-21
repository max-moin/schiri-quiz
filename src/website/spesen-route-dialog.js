const el = (tag, text, klasse) => { const n = document.createElement(tag); if (text) n.textContent = text; if (klasse) n.className = klasse; return n; };
const knopf = (text, fn) => { const b = el('button', text); b.type = 'button'; b.onclick = fn; return b; };
let nummer = 0;
let bibliothek;
function leaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  return bibliothek ||= new Promise((resolve, reject) => {
    const css = el('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.append(css);
    const s = el('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => resolve(globalThis.L);
    s.onerror = () => { bibliothek = null; reject(new Error('Die Kartenbibliothek konnte nicht geladen werden. Die Adresseingabe funktioniert weiterhin.')); }; document.head.append(s);
  });
}

/** All coordinates, labels and geometry live only inside this open dialog. */
export function oeffneRoutenhilfe({ ziel, uebernehmen, fetchImpl = fetch }) {
  const vorher = document.activeElement, d = el('dialog', '', 'spesen-route-dialog'), id = `route-${++nummer}`;
  const h = el('h2', 'Routenhilfe · öffentlicher Test'); h.id = id; d.setAttribute('aria-labelledby', id);
  const x = knopf('Schließen', () => d.close()); x.className = 'spesen-route-schliessen';
  const info = el('p', 'Testbetrieb: nur öffentliche Orte wie Bahnhof und Sportplatz verwenden. Keine Wohnadresse oder privaten Kartenpunkte eingeben. Wohnort-Routing ist noch nicht freigegeben; dafür Kilometer bitte selbst eintragen.');
  const hinweis = el('p', 'Bei der Ortssuche und Routenberechnung erhält openrouteservice die eingegebenen Orte. Eine zusätzlich geladene OpenStreetMap-Karte erhält IP-Adresse und sichtbaren Kartenausschnitt. Keine automatische Standortabfrage.');
  const zustimmung = el('input'); zustimmung.type = 'checkbox';
  const label = el('label', '', 'spesen-zustimmung'); label.append(zustimmung, ' Ich verwende ausschließlich öffentliche Orte ohne Personenbezug und erlaube die externe Berechnung für diese Sitzung.');
  const status = el('p', '', 'spesen-route-status'); status.setAttribute('role', 'status');
  const felder = el('div', '', 'spesen-team-raster');
  let geschlossen = false, karte, L, linien, marker = [], version = 0, route = null;
  const controller = new AbortController();
  const punkte = { start: null, ziel: ziel?.koordinaten ? [...ziel.koordinaten] : null };
  const eingaben = {}, auswahl = {}, ergebnisse = {};
  const ergebnis = el('section', '', 'spesen-route-ergebnis'); ergebnis.hidden = true;
  const akzeptieren = knopf('Geprüfte Gesamt-km übernehmen', () => { if (route) { uebernehmen(Math.round(route.kilometer * 10) / 10); d.close(); } });
  const berechnen = knopf('Kürzeste Autoroute berechnen', rechnen);
  const kartenmodus = el('select'); kartenmodus.setAttribute('aria-label', 'Mit Kartenklick setzen');
  for (const [v, t] of [['start','Kartenklick setzt Start'], ['ziel','Kartenklick setzt Ziel']]) { const o = el('option', t); o.value = v; kartenmodus.append(o); }
  const kartenkasten = el('div', '', 'spesen-routenkarte'); kartenkasten.hidden = true;
  kartenkasten.setAttribute('aria-label', 'Optionale Karte; alternativ Orte über die Adresseingabe wählen');
  function invalidieren() { version++; route = null; ergebnis.hidden = true; linien?.clearLayers(); }
  function zeichnen() {
    if (!karte) return;
    marker.forEach(m => m.remove()); marker = [];
    for (const [art, p] of Object.entries(punkte)) if (p) marker.push(L.marker([p[1], p[0]], { title: art === 'start' ? 'Start' : 'Ziel' }).addTo(karte));
    if (marker.length) karte.fitBounds(L.featureGroup(marker).getBounds().pad(.3), { maxZoom: 15 });
  }
  async function api(body) {
    if (!zustimmung.checked) throw new Error('Bitte zuerst die externe Berechnung erlauben.');
    const z = globalThis.SchiriSeitenAnmeldung?.anmeldung.lesen();
    if (!z?.id || !z.pin) throw new Error('Bitte zuerst oben über dein Konto anmelden. Manuelle Kilometer brauchen keine Anmeldung.');
    const r = await fetchImpl('/api/website-feedback?funktion=spesen-route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: controller.signal,
      body: JSON.stringify({ ...body, schiedsrichterId: z.id, pin: z.pin, einverstanden: true, nurOeffentlicheOrte: true }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.fehler || 'Routenhilfe nicht verfügbar.'); return data;
  }
  for (const [art, titel] of [['start', 'Öffentlicher Startpunkt'], ['ziel', 'Spielstätte / öffentliches Ziel']]) {
    const box = el('div'), l = el('label', titel), input = el('input'); input.type = 'text'; input.maxLength = 180;
    input.autocomplete = 'off'; input.id = `${id}-${art}`; l.htmlFor = input.id;
    input.placeholder = 'Zum Beispiel Bahnhof oder öffentliche Sportstätte'; input.value = art === 'ziel' ? ziel?.adresse || ziel?.name || '' : '';
    const gewaehlt = el('p', punkte[art] ? 'Hinterlegter Spielstättenpunkt gewählt' : 'Noch kein Punkt gewählt', 'spesen-route-auswahl');
    const liste = el('div', '', 'spesen-route-treffer');
    input.oninput = () => { punkte[art] = null; gewaehlt.textContent = 'Bitte neuen Treffer wählen'; liste.replaceChildren(); invalidieren(); zeichnen(); };
    const suche = knopf('Adresse suchen', async () => {
      suche.disabled = true; const text = input.value; status.textContent = 'Ort wird gesucht …';
      try {
        const data = await api({ aktion: 'suche', text });
        if (geschlossen || input.value !== text) return;
        liste.replaceChildren(); status.textContent = data.orte?.length ? 'Bitte den passenden Treffer wählen.' : 'Kein Treffer. Adresse genauer eingeben oder Kartenpunkt setzen.';
        for (const ort of data.orte || []) liste.append(knopf(ort.label, () => { punkte[art] = [...ort.koordinaten]; input.value = ort.label; gewaehlt.textContent = 'Punkt gewählt'; liste.replaceChildren(); invalidieren(); zeichnen(); }));
      } catch (e) { if (!geschlossen) status.textContent = e.message; } finally { suche.disabled = false; }
    });
    box.append(l, input, suche, gewaehlt, liste); felder.append(box); eingaben[art] = input; auswahl[art] = gewaehlt; ergebnisse[art] = liste;
  }
  const kartenknopf = knopf('Optionale Karte laden', async () => {
    if (!zustimmung.checked) { status.textContent = 'Bitte zuerst die externe Berechnung erlauben.'; return; }
    kartenknopf.disabled = true;
    try {
      L = await leaflet(); if (geschlossen || !zustimmung.checked) return;
      kartenkasten.hidden = false; karte = L.map(kartenkasten).setView([51.05,13.74], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(karte);
      linien = L.layerGroup().addTo(karte);
      karte.on('click', e => { const art = kartenmodus.value; punkte[art] = [e.latlng.lng,e.latlng.lat]; eingaben[art].value = ''; auswahl[art].textContent = `Kartenpunkt: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`; ergebnisse[art].replaceChildren(); invalidieren(); zeichnen(); }); zeichnen();
      status.textContent = 'Kartenklick setzt den ausgewählten Punkt. Adressen können weiterhin über die Suchfelder gewählt werden.';
    } catch (e) { status.textContent = e.message; kartenknopf.disabled = false; }
  });
  zustimmung.onchange = () => { if (!zustimmung.checked) { invalidieren(); if (karte) { karte.remove(); karte = null; linien = null; marker = []; kartenkasten.hidden = true; } kartenknopf.disabled = false; } };
  async function rechnen() {
    if (!punkte.start || !punkte.ziel) { status.textContent = 'Bitte Start und Ziel als Suchtreffer oder Kartenpunkt auswählen.'; return; }
    const lauf = ++version; berechnen.disabled = true; status.textContent = 'Hin- und Rückweg werden getrennt berechnet …';
    try {
      const data = await api({ aktion: 'route', start: punkte.start, ziel: punkte.ziel });
      if (geschlossen || lauf !== version || !zustimmung.checked) return;
      route = data; const t = el('p', `Hinweg ${(data.hin.meter/1000).toLocaleString('de-DE',{maximumFractionDigits:1})} km · Rückweg ${(data.zurueck.meter/1000).toLocaleString('de-DE',{maximumFractionDigits:1})} km · Gesamt ${data.kilometer.toLocaleString('de-DE',{maximumFractionDigits:1})} km`);
      const q = el('p', 'Kürzeste berechnete Autoroute. Tatsächliche Strecke, Befahrbarkeit und Abrechnungsregeln prüfen. Keine automatische Erstattung.');
      const quelle = el('p', '© openrouteservice by HeiGIT | Data from '), osm = el('a', 'OpenStreetMap'), lizenz = el('a', 'CC-BY-SA 4.0');
      osm.href = 'https://www.openstreetmap.org/copyright'; lizenz.href = 'https://creativecommons.org/licenses/by-sa/4.0/';
      for (const a of [osm,lizenz]) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      quelle.append(osm, ' · ', lizenz);
      ergebnis.replaceChildren(t, q, quelle, akzeptieren); ergebnis.hidden = false; status.textContent = 'Vorschlag berechnet. Bitte prüfen und bewusst übernehmen.';
      if (karte) { linien.clearLayers(); for (const teil of [data.hin, data.zurueck]) L.polyline(teil.linie.map(p => [p[1],p[0]]), { color: '#173f9e' }).addTo(linien); zeichnen(); }
    } catch (e) { if (!geschlossen) status.textContent = e.message; } finally { berechnen.disabled = false; }
  }
  d.append(x,h,info,hinweis,label,felder,kartenknopf,kartenmodus,kartenkasten,berechnen,status,ergebnis);
  document.body.append(d); d.addEventListener('close', () => { geschlossen = true; controller.abort(); karte?.remove(); punkte.start = punkte.ziel = null; route = null; d.remove(); if (vorher?.isConnected) vorher.focus(); }, { once: true });
  d.showModal(); x.focus();
  return d;
}
