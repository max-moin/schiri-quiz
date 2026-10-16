import { pruefeBlockseite, sichereBlockURL } from './block-inhalte.js';
import { montiereRoteKarte } from './rote-karte.js';

// Inhaltsadapter statt neuer Seitenarchitektur: dieselben Blöcke, RPCs und Rechte.
// Das geprüfte Gerüst mit Icons/Phasen bleibt unverändert; kein gespeichertes HTML.
export function gleicherGuideBlock(a,b) {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&gleicherGuideBlock(a[k],b[k]));
}
export function erstelleGuideAdapter(wurzel) {
  const vorlage = wurzel.cloneNode(true), definitionen = [];
  vorlage.querySelectorAll(':scope > .seiten-werkzeuge, :scope > .wegweiser').forEach(e=>e.remove());
  const d = wurzel.ownerDocument;
  const klar = e => (e?.textContent || '').trim();
  const leer = (id, typ) => ({ id, typ, layout:'normal', titel:'', text:'', url:'', alt:'', beschriftung:'', stand:'', eintraege:[] });
  function slot(id, typ, titel, finde, lesen, setzen) {
    definitionen.push({ id, typ, titel, finde, lesen, setzen });
  }
  function textSlot(id, titel, finde) {
    slot(id, 'absatz', titel, finde, e => ({ text:klar(e) }), (e,b) => {
      const svg = e.querySelector(':scope > svg')?.cloneNode(true);
      e.replaceChildren(...(svg ? [svg] : []), d.createTextNode(b.text));
    });
  }
  textSlot('kopftitel', 'Seitentitel', r => r.querySelector('h1'));
  textSlot('untertitel', 'Untertitel', r => r.querySelector('.rk-untertitel'));
  for (let i=0; i<8; i++) {
    slot(`schritt-${i}`, 'schritte', `Schritt ${i}: Titel, Fokuspunkte und Erklärung`, r => r.querySelectorAll('.rk-schritt')[i], e => ({
      titel:klar(e.querySelector('h3')),
      text:[...e.querySelectorAll('.rk-lang')].map(n => n.matches('p') ? klar(n) : [...n.querySelectorAll('p')].map(klar).join('\n\n')).join('\n\n'),
      eintraege:[...e.querySelectorAll(':scope > .rk-fokus li, :scope > div > div > .rk-fokus li')].map(n => ({titel:'',text:klar(n)})),
    }), (e,b) => {
      e.querySelector('h3').textContent=b.titel;
      const liste=e.querySelector('.rk-fokus');
      liste.replaceChildren(...b.eintraege.map(x=>{const li=d.createElement('li');li.textContent=x.text;return li;}));
      const lang=[...e.querySelectorAll('.rk-lang')];
      const ziel=lang[0];
      if (ziel) {
        const block=d.createElement('div');block.className='rk-lang';
        for(const p of b.text.split(/\n\s*\n/).filter(Boolean)){const n=d.createElement('p');n.textContent=p;block.append(n);}
        ziel.replaceWith(block);lang.slice(1).forEach(n=>n.remove());
      }
    });
  }
  const texte=[...vorlage.querySelectorAll('p')].filter(e=>!e.closest('.rk-lang')&&!e.matches('.rk-oberzeile,.rk-untertitel'));
  for (const [i,e] of texte.entries()) textSlot(`text-${i}`, klar(e).slice(0,80), r=>[...r.querySelectorAll('p')].filter(n=>!n.closest('.rk-lang')&&!n.matches('.rk-oberzeile,.rk-untertitel'))[i]);
  for (const [i,e] of [...vorlage.querySelectorAll('.rk-quellen span, details summary')].entries()) {
    textSlot(`hinweis-${i}`, klar(e).slice(0,80), r=>r.querySelectorAll('.rk-quellen span, details summary')[i]);
  }
  const links=r=>[...r.querySelectorAll('a')].filter(a=>!a.querySelector('img'));
  for(const [i,e] of links(vorlage).entries()) slot(`link-${i}`,'link',`Link: ${klar(e).slice(0,70)}`,r=>links(r)[i], a=>({
    titel:[...a.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim() || klar(a),
    url:a.getAttribute('href'),text:klar(a.querySelector('span')),
  }), (a,b)=>{
    a.setAttribute('href',sichereBlockURL(b.url));
    const svg=a.querySelector('svg')?.cloneNode(true), zusatz=a.querySelector('span')?.cloneNode(true);
    if(zusatz)zusatz.textContent=b.text;
    a.replaceChildren(...(svg?[svg]:[]),d.createTextNode(b.titel),...(zusatz?[zusatz]:[]));
  });
  slot('musterbild','bild','Vollständiges DFBnet-Muster',r=>r.querySelector('.rk-muster'),e=>({
    url:e.querySelector('img').getAttribute('src'),alt:e.querySelector('img').alt,
    beschriftung:klar(e.querySelector('figcaption')).replace('Bild größer öffnen ↗','').trim(),
  }),(e,b)=>{
    const img=e.querySelector('img');img.src=sichereBlockURL(b.url,true);img.alt=b.alt;
    e.querySelectorAll('a').forEach(a=>a.href=sichereBlockURL(b.url,true));
    const caption=e.querySelector('figcaption'),zoom=caption.querySelector('a');
    caption.replaceChildren(d.createTextNode(b.beschriftung+' '),zoom);
  });
  const standard={version:1,vorlage:'rote-karte-v1',bloecke:definitionen.map(s=>({...leer(s.id,s.typ),...s.lesen(s.finde(vorlage))}))};
  function pruefe(inhalt) {
    const fehler=pruefeBlockseite(inhalt);
    if(fehler.length)return fehler;
    if(inhalt.vorlage!==standard.vorlage || inhalt.bloecke.length!==definitionen.length || definitionen.some(s=>!inhalt.bloecke.some(b=>b.id===s.id&&b.typ===s.typ))) return ['Die feste Guide-Struktur ist unvollständig. Bitte neu laden.'];
    if(inhalt.bloecke.some(b=>['link','schritte'].includes(b.typ)&&!String(b.titel||'').trim())) return ['Links und Schritte brauchen eine aussagekräftige Überschrift.'];
    return [];
  }
  return {
    festeStruktur:true,textlisten:true,
    extrahiere:()=>structuredClone(standard),pruefe,
    titel:b=>definitionen.find(s=>s.id===b.id)?.titel,
    zeichne(ziel,inhalt,{bearbeiten}={}) {
      if(pruefe(inhalt).length)throw new Error(pruefe(inhalt).join(' '));
      // Globale Navigation/Hilfe sind lebende Komponenten, keine klonbaren Inhalte.
      const werkzeuge=[...ziel.children].filter(e=>e.matches('.seiten-werkzeuge,.wegweiser'));
      ziel.replaceChildren(...werkzeuge,...[...vorlage.childNodes].map(n=>n.cloneNode(true)));
      // Erst alle Zielknoten erfassen. Textänderungen dürfen ihre Indizes nicht verschieben.
      const ziele=definitionen.map(s=>s.finde(ziel));
      definitionen.forEach((s,i)=>{
        const b=inhalt.bloecke.find(n=>n.id===s.id),e=ziele[i];
        // Postgres JSONB ordnet Objektschlüssel um. Das ist keine Inhaltsänderung.
        if(!gleicherGuideBlock(b,standard.bloecke[i]))s.setzen(e,b);
      });
      if(bearbeiten) definitionen.forEach((s,i)=>{
        const e=ziele[i]; if(!e.isConnected)return;
        const knopf=d.createElement('button');knopf.type='button';knopf.className='red-block-bearbeiten';
        knopf.textContent='Bearbeiten';knopf.setAttribute('aria-label',`Bearbeiten: ${s.titel}`);
        knopf.addEventListener('click',()=>bearbeiten(s.id));
        if(e.matches('summary')) {
          const details=e.parentElement,rahmen=d.createElement('div');rahmen.dataset.blockId=s.id;
          details.before(rahmen);rahmen.append(knopf,details);
        } else if(e.matches('a,p,h1,h2,h3,span,figcaption')) {
          const rahmen=d.createElement('div');rahmen.dataset.blockId=s.id;e.before(rahmen);rahmen.append(knopf,e);
        } else {e.dataset.blockId=s.id;e.prepend(knopf);}
      });
      montiereRoteKarte(ziel);
    },
  };
}
