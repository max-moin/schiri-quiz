import { BLOCKTYPEN, neuerBlock, pruefeBlockseite, zeichneBloecke, ausVorhandenerSeite } from '../website/block-inhalte.js';
import { erstelleBlockseitenSpeicher } from './blockseiten-store.js';
import { pruefeBilddatei, BILD_ABLAGE, BILD_TYPEN } from './bilder-editor.js';

export async function montiereBlockeditor({ client, verein, wurzel, seite, adapter = null }) {
  const d = wurzel.ownerDocument;
  const fallback = wurzel.cloneNode(true);
  const extrahiere = adapter?.extrahiere || ausVorhandenerSeite;
  const rendern = adapter?.zeichne || zeichneBloecke;
  const pruefen = adapter?.pruefe || pruefeBlockseite;
  const titelId = fallback.getAttribute('aria-labelledby');
  let publiziert = null, zustand = null, entwurf = null, aktiv = false, vorschau = false, schmutzig = false, laeuft = false, redakteur = false;
  const speicher = erstelleBlockseitenSpeicher(client, verein.seitenschluessel, seite);
  const leiste = d.createElement('div'); leiste.className = 'red-werkzeuge'; leiste.hidden = true;
  const status = d.createElement('p'); status.className = 'red-status'; status.setAttribute('role', 'status');
  wurzel.before(leiste);
  const sichtbarkeit = () => { leiste.hidden = !redakteur || wurzel.hidden; };
  new MutationObserver(sichtbarkeit).observe(wurzel, { attributes: true, attributeFilter: ['hidden'] });
  const modal = d.createElement('dialog'); modal.className = 'red-dialog'; d.body.append(modal);
  const dialogTitel = `red-dialog-${crypto.randomUUID()}`;
  let fokusRueckkehr = null;
  modal.addEventListener('close', () => {
    (fokusRueckkehr?.isConnected ? fokusRueckkehr : leiste.querySelector('button'))?.focus();
  });
  function zeigeDialog(h) {
    h.id = dialogTitel; modal.setAttribute('aria-labelledby', dialogTitel);
    if (!modal.open) { fokusRueckkehr = d.activeElement; modal.showModal(); }
  }
  const meldung = text => { status.textContent = text; };
  const knopf = (text, tun, ziel = leiste) => {
    const b = d.createElement('button'); b.type = 'button'; b.textContent = text;
    b.addEventListener('click', tun); ziel.append(b); return b;
  };
  const kopie = wert => structuredClone(wert);
  function schliesseAbschnitt(id) {
    modal.close(); zeichne();
    const button = id ? wurzel.querySelector(`[data-block-id="${CSS.escape(id)}"] button`) : null;
    fokusRueckkehr = button || leiste.querySelector('button');
    fokusRueckkehr?.focus();
  }
  function zeichne() {
    wurzel.classList.toggle('red-vorschau', aktiv && vorschau);
    if (aktiv) rendern(wurzel, entwurf, { bearbeiten: vorschau ? undefined : bearbeite });
    else if (publiziert) rendern(wurzel, publiziert);
    else if (adapter) rendern(wurzel, extrahiere(fallback));
    else wurzel.replaceChildren(...[...fallback.childNodes].map(n => n.cloneNode(true)));
    if (adapter) return;
    // Der ursprüngliche Anker und sein zugänglicher Titel bleiben erhalten.
    const h = wurzel.querySelector('h2');
    if (h && titelId) {
      h.id = titelId; wurzel.setAttribute('aria-labelledby', titelId); wurzel.removeAttribute('aria-label');
    } else {
      wurzel.removeAttribute('aria-labelledby');
      wurzel.setAttribute('aria-label', fallback.querySelector('h2')?.textContent || seite);
    }
  }
  async function mitArbeit(tun) {
    if (laeuft) return;
    laeuft = true; [...leiste.querySelectorAll('button')].forEach(b => { b.disabled = true; });
    try { await tun(); } catch (e) { meldung(e.message || 'Speichern fehlgeschlagen. Dein Entwurf bleibt hier erhalten.'); }
    finally { laeuft = false; [...leiste.querySelectorAll('button')].forEach(b => { b.disabled = false; }); }
  }
  function toolbar() {
    leiste.replaceChildren();
    if (!aktiv) knopf('Seite bearbeiten', () => mitArbeit(async () => {
      zustand = await speicher.laden();
      entwurf = kopie(zustand.entwurf || zustand.veroeffentlicht || extrahiere(fallback));
      aktiv = true; schmutzig = false; vorschau = false; toolbar(); zeichne();
      meldung('Entwurf: Änderungen sind noch nicht öffentlich. Abschnitt anklicken oder Block hinzufügen.');
    }));
    else {
      if (!adapter?.festeStruktur) knopf('Block hinzufügen', () => {
        const b = neuerBlock(); entwurf.bloecke.push(b); schmutzig = true; bearbeite(b.id);
      });
      knopf('Entwurf speichern', () => mitArbeit(async () => {
        if (pruefen(entwurf).length) throw new Error(pruefen(entwurf).slice(0, 4).join(' '));
        zustand = await speicher.speichern(entwurf, zustand.revision);
        schmutzig = false; meldung('Entwurf gespeichert. Die öffentliche Seite ist unverändert.');
      }));
      knopf(vorschau ? 'Weiter bearbeiten' : 'Vorschau', () => {
        vorschau = !vorschau; toolbar(); zeichne(); meldung(vorschau ? 'Vorschau – noch nicht veröffentlicht.' : 'Entwurf bearbeiten.');
      });
      knopf('Handy / Desktop', () => { wurzel.toggleAttribute('data-mobil'); });
      knopf('Veröffentlichen', () => {
        if (pruefen(entwurf).length) { meldung(pruefen(entwurf).slice(0, 4).join(' ')); return; }
        if (!window.confirm('Diesen Entwurf jetzt für alle auf der Vereinsseite veröffentlichen? Quellen und personenbezogene Daten bitte vorher prüfen.')) return;
        mitArbeit(async () => {
          zustand = await speicher.speichern(entwurf, zustand.revision, true);
          publiziert = kopie(zustand.veroeffentlicht); schmutzig = false;
          meldung('Veröffentlicht.'); zeichne();
        });
      });
      knopf('Versionen', zeigeVersionen);
      knopf('Neu laden', () => {
        if (schmutzig && !window.confirm('Lokale, ungespeicherte Änderungen verwerfen und den aktuellen Serverstand laden?')) return;
        mitArbeit(async () => {
          zustand = await speicher.laden(); entwurf = kopie(zustand.entwurf || zustand.veroeffentlicht || extrahiere(fallback));
          schmutzig = false; zeichne(); meldung('Aktueller Entwurf geladen.');
        });
      });
      knopf('Bearbeiten beenden', () => {
        if (schmutzig && !window.confirm('Ungespeicherte Änderungen verwerfen? Gespeicherte Entwürfe bleiben erhalten.')) return;
        aktiv = false; schmutzig = false; vorschau = false; wurzel.removeAttribute('data-mobil'); toolbar(); zeichne();
      });
    }
    leiste.append(status);
  }
  function zeigeVersionen() {
    modal.replaceChildren(); const h = d.createElement('h2'); h.textContent = 'Frühere Veröffentlichungen'; modal.append(h);
    const p = d.createElement('p'); p.textContent = 'Eine frühere Version wird nur als Entwurf übernommen. Veröffentlichen musst du sie danach ausdrücklich.'; modal.append(p);
    for (const v of zustand.versionen || []) knopf(new Date(v.erstellt_am).toLocaleString('de-DE'), () => {
      if (schmutzig && !window.confirm('Lokalen Entwurf durch diese Version ersetzen?')) return;
      entwurf = kopie(v.inhalt); schmutzig = true; modal.close(); zeichne(); meldung('Frühere Version als lokalen Entwurf übernommen.');
    }, modal);
    if (!zustand.versionen?.length) p.textContent = 'Noch keine frühere Veröffentlichung vorhanden.';
    knopf('Schließen', () => modal.close(), modal); zeigeDialog(h);
  }
  function bearbeite(id) {
    const original = entwurf.bloecke.find(b => b.id === id); if (!original) return;
    let b = kopie(original);
    modal.replaceChildren(); const form = d.createElement('form'); modal.append(form);
    const h = d.createElement('h2'); h.textContent = adapter?.titel?.(b) || 'Abschnitt bearbeiten'; form.append(h);
    const fields = new Map();
    function feld(titel, wert, typ = 'input', ziel = form) {
      const l = d.createElement('label'); l.textContent = titel; const f = d.createElement(typ);
      f.value = wert || ''; l.append(f); ziel.append(l); return f;
    }
    const art = feld('Blocktyp', '', 'select');
    for (const [wert, text] of Object.entries(BLOCKTYPEN)) { const o = d.createElement('option'); o.value = wert; o.textContent = text; art.append(o); }
    art.value = b.typ;
    const layout = feld('Layout', '', 'select');
    for (const [wert, text] of [['normal', 'Eine Spalte'], ['zweispaltig', 'Liste zweispaltig'], ['bild-neben-text', 'Bild neben Text']]) {
      const o = d.createElement('option'); o.value = wert; o.textContent = text; layout.append(o);
    }
    layout.value = b.layout;
    art.parentElement.hidden = layout.parentElement.hidden = !!adapter?.festeStruktur;
    for (const [key, label, typ] of [['titel', 'Titel / Linktext'], ['text', 'Text', 'textarea'], ['url', 'Bild- oder Linkadresse (https://)'],
      ['alt', 'Bildbeschreibung (Pflicht bei Bildern)'], ['beschriftung', 'Bildunterschrift'], ['stand', 'Quellenstand (JJJJ-MM-TT)']]) {
      fields.set(key, feld(label, b[key], typ));
    }
    const hinweis = d.createElement('p'); hinweis.textContent = 'Screenshots vor dem Upload anonymisieren. Bilder liegen in der öffentlichen Bildablage; keine Namen, PINs oder vertraulichen Spielberichte hochladen.'; form.append(hinweis);
    const datei = feld('Bild hochladen (JPG, PNG, WebP, maximal 3 MB)', '', 'input'); datei.type = 'file'; datei.accept = 'image/jpeg,image/png,image/webp';
    let uploadZiel = fields.get('url');
    datei.addEventListener('change', async () => {
      const f = datei.files?.[0]; const fehler = pruefeBilddatei(f);
      if (fehler) { meldung(fehler); return; }
      datei.disabled = true;
      try {
        // Dekodieren + neu zeichnen entfernt Metadaten und prüft tatsächliche Bilddaten.
        const bitmap = await createImageBitmap(f); const canvas = d.createElement('canvas');
        const faktor = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * faktor)); canvas.height = Math.max(1, Math.round(bitmap.height * faktor));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .85));
        if (!blob || !BILD_TYPEN[blob.type] || blob.size > 3 * 1024 * 1024) throw new Error('Das Bild konnte nicht sicher aufbereitet werden.');
        const pfad = `${verein.seitenschluessel}/hilfe/${crypto.randomUUID()}.${BILD_TYPEN[blob.type]}`;
        const { error } = await client.storage.from(BILD_ABLAGE).upload(pfad, blob, { upsert: false, contentType: blob.type });
        if (error) throw error;
        uploadZiel.value = client.storage.from(BILD_ABLAGE).getPublicUrl(pfad).data.publicUrl;
        meldung('Bild hochgeladen. Abschnitt übernehmen und Entwurf speichern. Noch nicht auf der öffentlichen Seite verlinkt.');
      } catch (e) { meldung(e.message); }
      finally { datei.disabled = false; uploadZiel = fields.get('url'); }
    });
    const eintraege = [];
    for (const [index, e] of (b.eintraege || []).entries()) {
      const fs = d.createElement('fieldset'); const l = d.createElement('legend'); l.textContent = `Schritt / Listenpunkt ${index + 1}`; fs.append(l); form.append(fs);
      const row = Object.fromEntries([['titel', 'Titel'], ['text', 'Text'], ['url', 'Screenshot-URL (optional)'], ['alt', 'Bildbeschreibung']].map(([k, t]) => [k, feld(t, e[k], k === 'text' ? 'textarea' : 'input', fs)]));
      eintraege.push(row);
      if (adapter?.textlisten) for (const k of ['titel','url','alt']) row[k].parentElement.hidden = true;
      const screenshot = knopf('Screenshot für diesen Schritt hochladen', () => { uploadZiel = row.url; datei.value = ''; datei.click(); }, fs);
      screenshot.hidden = !!adapter?.textlisten;
      knopf('Diesen Listenpunkt entfernen', () => { row.entfernt = true; fs.hidden = true; }, fs);
    }
    function lesen() {
      b = { ...b, typ: art.value, layout: layout.value, ...Object.fromEntries([...fields].map(([k, f]) => [k, f.value])),
        eintraege: eintraege.filter(e => !e.entfernt).map(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'entfernt').map(([k, f]) => [k, f.value]))) };
      if (['liste', 'schritte'].includes(b.typ) && !b.eintraege.length) b.eintraege = [{ titel: '', text: '' }];
      return b;
    }
    const actions = d.createElement('div'); actions.className = 'red-aktionen'; form.append(actions);
    const hinzufuegen = knopf('Listenpunkt / Schritt hinzufügen', () => { lesen(); b.eintraege.push({ titel: '', text: '' }); Object.assign(original, b); schmutzig = true; bearbeite(id); }, actions);
    knopf('Übernehmen', () => { Object.assign(original, lesen()); schmutzig = true; schliesseAbschnitt(id); }, actions);
    if (!adapter?.festeStruktur) for (const [text, delta] of [['Nach oben', -1], ['Nach unten', 1]]) knopf(text, () => {
      Object.assign(original, lesen()); const index = entwurf.bloecke.indexOf(original); const neu = index + delta;
      if (neu >= 0 && neu < entwurf.bloecke.length) { entwurf.bloecke.splice(index, 1); entwurf.bloecke.splice(neu, 0, original); schmutzig = true; }
      schliesseAbschnitt(id);
    }, actions);
    const loeschen = knopf('Block löschen', () => {
      if (!window.confirm('Diesen Block aus dem Entwurf entfernen?')) return;
      entwurf.bloecke = entwurf.bloecke.filter(e => e.id !== id); schmutzig = true; schliesseAbschnitt();
    }, actions); loeschen.dataset.gefahr = '';
    loeschen.hidden = !!adapter?.festeStruktur;
    knopf('Abbrechen', () => modal.close(), actions);
    function typFelder() {
      const sichtbar = {
        absatz: ['text'], ueberschrift: ['text'], hinweis: ['titel', 'text'],
        bild: ['url', 'alt', 'beschriftung', 'text'], quelle: ['titel', 'url', 'stand', 'text'],
        link: ['titel', 'url', 'text'], liste: ['titel'], schritte: adapter?.festeStruktur ? ['titel', 'text'] : ['titel'],
      }[art.value];
      for (const [key, input] of fields) input.parentElement.hidden = !sichtbar.includes(key);
      datei.parentElement.hidden = art.value !== 'bild';
      hinweis.hidden = !['bild', 'schritte'].includes(art.value);
      hinzufuegen.hidden = !['liste', 'schritte'].includes(art.value);
      form.querySelectorAll('fieldset').forEach(fs => { fs.hidden = !['liste', 'schritte'].includes(art.value); });
      for (const o of layout.options) o.disabled = o.value === 'zweispaltig' ? !['liste', 'schritte'].includes(art.value)
        : o.value === 'bild-neben-text' ? art.value !== 'bild' : false;
      if (layout.selectedOptions[0]?.disabled) layout.value = 'normal';
    }
    art.addEventListener('change', typFelder); typFelder();
    form.addEventListener('submit', e => e.preventDefault());
    zeigeDialog(h);
    (adapter?.festeStruktur ? [...fields.values()].find(f => !f.parentElement.hidden) : art)?.focus();
  }
  // Nur veröffentlichte Spalten sind öffentlich lesbar; kein Entwurf im Browser eines Schiris.
  const publicResult = await client.from('website_blockseiten').select('veroeffentlicht')
    .eq('seitenschluessel', verein.seitenschluessel).eq('seite', seite).maybeSingle();
  if (!publicResult.error && publicResult.data?.veroeffentlicht && !pruefen(publicResult.data.veroeffentlicht).length) {
    publiziert = publicResult.data.veroeffentlicht; zeichne();
  }
  const { data } = await client.auth.getSession();
  if (data.session) {
    try { await speicher.laden(); redakteur = true; toolbar(); sichtbarkeit(); }
    catch { /* Normale Anmeldung/AAL1 ist kein Redaktionsrecht. */ }
  }
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') { aktiv = false; schmutzig = false; redakteur = false; sichtbarkeit(); modal.close(); zeichne(); }
  });
  window.addEventListener('beforeunload', e => { if (schmutzig) { e.preventDefault(); e.returnValue = ''; } });
}
