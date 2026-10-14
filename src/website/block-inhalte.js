// Gemeinsames, bewusst begrenztes Format für öffentliche Ansicht und Redaktion.
export const BLOCKTYPEN = Object.freeze({
  absatz: 'Text', ueberschrift: 'Überschrift', liste: 'Liste', hinweis: 'Infobox',
  bild: 'Bild', schritte: 'Screenshot-Schrittfolge', link: 'Link / Dokument', quelle: 'Quelle mit Stand',
});
export const BLOCKSEITEN = Object.freeze(['dfbnet', 'sonderbericht', 'schiri-treff']);
export function sichereBlockURL(wert, bild = false) {
  const s = String(wert ?? '').trim();
  if (!s || /[\s\\\u0000-\u001f\u007f]/u.test(s) || s.startsWith('//')) return null;
  if (/^https:\/\//i.test(s)) {
    try { const u = new URL(s); return u.username || u.password ? null : u.href; } catch { return null; }
  }
  if (!bild && /^tel:\+?\d{5,20}$/.test(s)) return s;
  if (/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+(?:#[a-zA-Z0-9_-]+)?$/.test(s)
      && !s.split('/').includes('..')) return s;
  if (!bild && /^#[a-zA-Z0-9_-]+$/.test(s)) return s;
  return null;
}
export function pruefeBlockseite(inhalt) {
  if (!inhalt || inhalt.version !== 1 || !Array.isArray(inhalt.bloecke)
      || inhalt.bloecke.length < 1 || inhalt.bloecke.length > 60) return ['Eine Seite braucht 1–60 Blöcke.'];
  const fehler = [], ids = new Set();
  inhalt.bloecke.forEach((b, i) => {
    const name = `Block ${i + 1}`;
    if (!b || !BLOCKTYPEN[b.typ] || !/^[a-zA-Z0-9_-]{1,80}$/.test(b.id || '') || ids.has(b.id)) {
      fehler.push(`${name}: Typ oder Kennung ungültig.`); return;
    }
    ids.add(b.id);
    if (!['normal', 'zweispaltig', 'bild-neben-text'].includes(b.layout)) fehler.push(`${name}: Layout ungültig.`);
    for (const k of ['titel', 'text', 'url', 'alt', 'beschriftung', 'stand']) {
      if (b[k] != null && (typeof b[k] !== 'string' || b[k].length > 12000)) fehler.push(`${name}: Text zu lang.`);
    }
    if (['absatz', 'ueberschrift', 'hinweis'].includes(b.typ) && !String(b.text || '').trim()) fehler.push(`${name}: Text fehlt.`);
    if (['bild', 'link', 'quelle'].includes(b.typ) && !sichereBlockURL(b.url, b.typ === 'bild')) fehler.push(`${name}: Sichere URL fehlt.`);
    if (b.typ === 'bild' && !String(b.alt || '').trim()) fehler.push(`${name}: Bildbeschreibung fehlt.`);
    if (b.typ === 'quelle' && !/^\d{4}-\d{2}-\d{2}$/.test(b.stand || '')) fehler.push(`${name}: Quellenstand fehlt.`);
    if (['liste', 'schritte'].includes(b.typ)) {
      if (!Array.isArray(b.eintraege) || !b.eintraege.length || b.eintraege.length > 30) fehler.push(`${name}: 1–30 Einträge nötig.`);
      else b.eintraege.forEach(e => {
        if (!e || !String(e.text || '').trim() || String(e.text).length > 12000 || String(e.titel || '').length > 1000) fehler.push(`${name}: Eintrag unvollständig.`);
        if (e.url && (!sichereBlockURL(e.url, true) || !String(e.alt || '').trim())) fehler.push(`${name}: Screenshot braucht URL und Bildbeschreibung.`);
      });
    }
  });
  if (JSON.stringify(inhalt).length > 200000) fehler.push('Die Seite ist zu groß.');
  return fehler;
}

export function neuerBlock(typ = 'absatz') {
  return { id: globalThis.crypto.randomUUID(), typ, layout: 'normal', titel: '', text: '', url: '', alt: '',
    beschriftung: '', stand: '', eintraege: ['liste', 'schritte'].includes(typ) ? [{ titel: '', text: '' }] : [] };
}

export function zeichneBloecke(ziel, inhalt, { bearbeiten } = {}) {
  const d = ziel.ownerDocument;
  const el = (tag, text, klasse) => { const e = d.createElement(tag); if (text) e.textContent = text; if (klasse) e.className = klasse; return e; };
  const link = (url, text) => {
    const a = el('a', text || url); a.href = sichereBlockURL(url) || '#';
    if (a.href.startsWith('https:')) a.rel = 'noopener noreferrer';
    return a;
  };
  const bild = (url, alt, beschriftung) => {
    const f = el('figure'); const img = el('img');
    const src = sichereBlockURL(url, true);
    if (src) { img.src = src; img.alt = alt || ''; img.loading = 'lazy'; f.append(img); }
    if (beschriftung) f.append(el('figcaption', beschriftung));
    return f;
  };
  ziel.replaceChildren();
  for (const b of inhalt.bloecke) {
    const block = el('div', '', `red-block red-${b.typ} red-layout-${b.layout}`);
    block.dataset.blockId = b.id;
    if (b.typ === 'ueberschrift') block.append(el('h2', b.text));
    if (b.typ === 'absatz') block.append(el('p', b.text));
    if (b.typ === 'hinweis') { if (b.titel) block.append(el('h3', b.titel)); block.append(el('p', b.text)); }
    if (b.typ === 'bild') { block.append(bild(b.url, b.alt, b.beschriftung)); if (b.text) block.append(el('p', b.text)); }
    if (b.typ === 'liste' || b.typ === 'schritte') {
      if (b.titel) block.append(el('h3', b.titel));
      const l = el(b.typ === 'liste' ? 'ul' : 'ol');
      for (const e of b.eintraege || []) {
        const li = el('li'); if (e.titel) li.append(el('strong', e.titel));
        li.append(el('p', e.text)); if (e.url) li.append(bild(e.url, e.alt)); l.append(li);
      }
      block.append(l);
    }
    if (b.typ === 'link' || b.typ === 'quelle') {
      block.append(link(b.url, b.titel || b.url));
      if (b.text) block.append(el('p', b.text));
      if (b.typ === 'quelle') block.append(el('small', `Stand: ${b.stand}`));
    }
    if (bearbeiten) {
      const knopf = el('button', 'Abschnitt bearbeiten', 'red-block-bearbeiten'); knopf.type = 'button';
      knopf.addEventListener('click', () => bearbeiten(b.id)); block.prepend(knopf);
      block.addEventListener('click', e => {
        if (!e.target.closest('button')) { e.preventDefault(); bearbeiten(b.id); }
      });
    }
    ziel.append(block);
  }
}

// Übernimmt den vorhandenen Leitfaden als bearbeitbaren Startentwurf.
// Auch Links in Fließtext/Listen gehen nicht verloren; kein HTML wird gespeichert.
export function ausVorhandenerSeite(ziel) {
  const bloecke = [];
  const text = e => (e.textContent || '').trim();
  for (const e of ziel.children) {
    const typ = /^H[1-6]$/.test(e.tagName) ? 'ueberschrift' : ['OL', 'UL'].includes(e.tagName) ? 'schritte' : 'absatz';
    if (e.tagName === 'DETAILS') {
      const b = neuerBlock('hinweis'); b.titel = text(e.querySelector('summary')); b.text = text(e).replace(b.titel, '').trim(); bloecke.push(b);
    } else {
      const b = neuerBlock(typ); b.text = text(e);
      if (typ === 'schritte') b.eintraege = [...e.children].map(li => {
        const kopie = li.cloneNode(true); const titel = text(kopie.querySelector('strong') || { textContent: '' });
        kopie.querySelector('strong')?.remove();
        return { titel, text: text(kopie) || titel };
      });
      if (b.text) bloecke.push(b);
    }
    for (const a of [...(e.matches('a') ? [e] : []), ...e.querySelectorAll('a')]) {
      if (sichereBlockURL(a.getAttribute('href'))) bloecke.push({ ...neuerBlock('link'), titel: text(a), url: a.getAttribute('href') });
    }
  }
  return { version: 1, bloecke };
}
