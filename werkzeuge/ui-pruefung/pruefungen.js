// ============================================================
//  UI-Pruefung: was im Browser gemessen wird (laeuft IN der Seite)
// ============================================================
//  Wird von pruefen.py per page.evaluate() ausgefuehrt und gibt ein
//  Objekt mit Befunden zurueck. Massstab: WCAG 2.2 AA.
//   kontrast   1.4.3  Text 4,5:1, grosser Text 3:1
//   ziele      2.5.8  Tippflaechen mindestens 24 x 24 px
//   namenlos   4.1.2  Knopf/Link ohne zugaenglichen Namen
//   ohneLabel  3.3.2  Eingabefeld ohne Beschriftung
//   bilder     1.1.1  <img> ohne alt-Attribut
//   ueberlauf  1.4.10 Seite breiter als der Bildschirm (Pixel)
//   ids        4.1.1  doppelte id-Werte (brechen label/aria-Bezuege)
//   nurSymbol  Hausregel "Woerter statt blosser Icons": Knopf ohne
//              sichtbaren Text, nur mit aria-label/title
// ============================================================
() => {
  const erg = {kontrast: [], ziele: [], namenlos: [], ohneLabel: [], bilder: [], nurSymbol: [], ueberlauf: 0, h1: 0, lang: document.documentElement.lang, ueberschriften: [], ids: [], main: !!document.querySelector('main,[role=main]')};
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05 && !el.closest('[hidden],[aria-hidden=true],dialog:not([open]),details:not([open]) > :not(summary)'); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const lum = (c) => { const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
  const mische = (oben, unten) => ({r: oben.r*oben.a + unten.r*(1-oben.a), g: oben.g*oben.a + unten.g*(1-oben.a), b: oben.b*oben.a + unten.b*(1-oben.a), a: 1});
  // Liegt unter dem Text ein Bild/Video, laesst sich der Kontrast nicht
  // aus CSS-Farben berechnen -> nicht messen statt falsch melden.
  const ueberBild = (el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 10);
    if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return false;
    return document.elementsFromPoint(x, y).some((e) => /^(IMG|PICTURE|VIDEO|CANVAS)$/.test(e.tagName));
  };
  const hintergrund = (el) => {
    let schichten = []; let e = el;
    while (e && e.nodeType === 1) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('linear-gradient(160deg')) return null;
      const c = parse(s.backgroundColor); if (c && c.a > 0) { schichten.push(c); if (c.a >= 1) break; }
      e = e.parentElement;
    }
    let farbe = {r:246,g:247,b:249,a:1};
    for (let i = schichten.length - 1; i >= 0; i--) farbe = mische(schichten[i], farbe);
    return farbe;
  };
  const beschreibe = (el) => (el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).slice(0,2).join('.') : '')).slice(0,70);
  const gesehen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!sichtbar(el)) continue;
    const eigenerText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!eigenerText) continue;
    const s = getComputedStyle(el);
    const vg = parse(s.color); const hg = ueberBild(el) ? null : hintergrund(el);
    if (!vg || !hg) continue;
    const text = mische(vg, hg);
    const l1 = lum(text), l2 = lum(hg);
    const q = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
    const px = parseFloat(s.fontSize); const fett = parseInt(s.fontWeight) >= 700;
    const gross = px >= 24 || (px >= 18.66 && fett);
    const grenze = gross ? 3 : 4.5;
    if (el.closest('button:disabled,input:disabled,[aria-disabled=true]')) continue;
    if (q < grenze) {
      const schluessel = beschreibe(el) + s.color + s.backgroundColor;
      if (gesehen.has(schluessel)) continue; gesehen.add(schluessel);
      erg.kontrast.push({el: beschreibe(el), text: eigenerText.slice(0,40), q: +q.toFixed(2), px, fett, vg: s.color, hg: `rgb(${Math.round(hg.r)},${Math.round(hg.g)},${Math.round(hg.b)})`});
    }
  }
  // WCAG 2.5.8, Ausnahme "Abstand": Ein kleineres Ziel ist in Ordnung,
  // wenn ein Kreis von 24 px um seine Mitte kein anderes Ziel beruehrt.
  const ziele = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]')].filter(sichtbar);
  const genugAbstand = (el, r) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return ziele.every((o) => {
      if (o === el || o.contains(el) || el.contains(o)) return true;
      const q = o.getBoundingClientRect();
      const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom);
      return Math.hypot(dx, dy) >= 12;
    });
  };
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[tabindex]:not([tabindex="-1"])')) {
    if (!sichtbar(el)) continue;
    const r = el.getBoundingClientRect();
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p,li,td,dd,label,small');
    if (!inline && (r.width < 24 || r.height < 24) && !genugAbstand(el, r)) erg.ziele.push({el: beschreibe(el), w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText||el.value||el.getAttribute('aria-label')||'').trim().slice(0,30)});
    const name = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || (el.querySelector('img[alt]')?.alt) || '').trim();
    if (['A','BUTTON','SUMMARY'].includes(el.tagName) && !name) erg.namenlos.push(beschreibe(el));
    if (['A','BUTTON'].includes(el.tagName) && name && !(el.innerText || el.value || '').trim()) erg.nurSymbol.push(beschreibe(el) + ' "' + name.slice(0,30) + '"');
    if (['INPUT','SELECT','TEXTAREA'].includes(el.tagName) && !['submit','button','reset'].includes(el.type)) {
      const hatLabel = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!hatLabel) erg.ohneLabel.push(beschreibe(el) + (el.placeholder ? ' placeholder="'+el.placeholder+'"' : ''));
    }
  }
  for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) erg.bilder.push(img.src.split('/').pop());
  erg.ueberlauf = document.documentElement.scrollWidth - window.innerWidth;
  erg.h1 = [...document.querySelectorAll('h1')].filter(sichtbar).length;
  erg.ueberschriften = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(sichtbar).map(h => +h.tagName[1]);
  const idz = {}; for (const e of document.querySelectorAll('[id]')) idz[e.id] = (idz[e.id]||0)+1;
  erg.ids = Object.entries(idz).filter(([k,v]) => v > 1).map(([k]) => k);
  return erg;
}
