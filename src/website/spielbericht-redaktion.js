import { VEREIN, DATENBANK } from '../../verein.config.js';
import { montiereBlockeditor } from '../admin/blockeditor.js';
import { pruefeBlockseite, sichereBlockURL } from './block-inhalte.js';
import { gleicherGuideBlock } from './guide-redaktion.js';
import { montiereSpielbericht } from './spielbericht.js';

// Stabile Inhalts-IDs: feste Fachseite, kein freier Phasen-/Modus-Baukasten.
export function erstelleSpielberichtAdapter(wurzel, { kennung = 'spielbericht-v1' } = {}) {
  const vorlage=wurzel.cloneNode(true),d=wurzel.ownerDocument;
  vorlage.querySelectorAll(':scope > .seiten-werkzeuge,:scope > .wegweiser,[data-sb-ansichts-chrome],[data-dfb-chrome]').forEach(n=>n.remove());
  const klar=n=>(n?.textContent||'').trim();
  const knoten=[...vorlage.querySelectorAll('[data-sb-inhalt]')];
  const definitionen=knoten.map(n=>({id:n.dataset.sbInhalt,typ:n.matches('.rk-schritt')?'schritte':n.matches('a')?'link':n.matches('ul')?'liste':'absatz',titel:n.matches('.rk-schritt')?`Schritt ${n.dataset.sbInhalt.slice(8)}: ${klar(n.querySelector('h3'))}`:klar(n).slice(0,85)}));
  const finde=(r,id)=>[...r.querySelectorAll('[data-sb-inhalt]')].find(n=>n.dataset.sbInhalt===id);
  const lies=(n,s)=>{
    const b={id:s.id,typ:s.typ,layout:'normal',titel:'',text:'',url:'',alt:'',beschriftung:'',stand:'',eintraege:[]};
    if(s.typ==='schritte'){
      b.titel=klar(n.querySelector('h3'));
      b.text=[...n.querySelectorAll(':scope > .rk-lang')].map(x=>x.matches('p')?klar(x):[...x.querySelectorAll('p')].map(klar).join('\n\n')).join('\n\n');
      b.eintraege=[...n.querySelectorAll(':scope > .rk-fokus li')].map(x=>({titel:'',text:klar(x)}));
    }else if(s.typ==='link'){b.titel=klar(n);b.url=n.getAttribute('href');}
    else if(s.typ==='liste')b.eintraege=[...n.children].map(x=>({titel:'',text:klar(x)}));
    else b.text=klar(n);
    return b;
  };
  const standard={version:1,vorlage:kennung,bloecke:definitionen.map((s,i)=>lies(knoten[i],s))};
  const pruefe=inhalt=>{
    const fehler=pruefeBlockseite(inhalt);if(fehler.length)return fehler;
    if(inhalt.vorlage!==standard.vorlage||inhalt.bloecke.length!==definitionen.length||definitionen.some(s=>!inhalt.bloecke.some(b=>b.id===s.id&&b.typ===s.typ)))return ['Die feste Guide-Struktur ist unvollständig. Bitte neu laden.'];
    if(inhalt.bloecke.some(b=>['schritte','link'].includes(b.typ)&&!String(b.titel||'').trim()))return ['Schritte und Links brauchen eine aussagekräftige Überschrift.'];
    return [];
  };
  function liste(n,eintraege){n.replaceChildren(...eintraege.map(x=>{const li=d.createElement('li');li.textContent=x.text;return li;}));}
  return {festeStruktur:true,textlisten:true,extrahiere:()=>structuredClone(standard),pruefe,titel:b=>definitionen.find(s=>s.id===b.id)?.titel,
    zeichne(ziel,inhalt,{bearbeiten}={}){
      const fehler=pruefe(inhalt);if(fehler.length)throw new Error(fehler.join(' '));
      const chrome=[...ziel.children].filter(n=>n.matches('.seiten-werkzeuge,.wegweiser'));
      ziel.replaceChildren(...chrome,...[...vorlage.childNodes].map(n=>n.cloneNode(true)));
      definitionen.forEach((s,i)=>{
        const n=finde(ziel,s.id),b=inhalt.bloecke.find(x=>x.id===s.id);
        if(!gleicherGuideBlock(b,standard.bloecke[i])){
          if(s.typ==='schritte'){
            n.querySelector('h3').textContent=b.titel;liste(n.querySelector('.rk-fokus'),b.eintraege);
            const lang=[...n.querySelectorAll(':scope > .rk-lang')],block=d.createElement('div');block.className='rk-lang';
            b.text.split(/\n\s*\n/).filter(Boolean).forEach(t=>{const p=d.createElement('p');p.textContent=t;block.append(p);});
            if(lang[0]){lang[0].replaceWith(block);lang.slice(1).forEach(x=>x.remove());}
          }else if(s.typ==='link'){n.textContent=b.titel;n.setAttribute('href',sichereBlockURL(b.url));}
          else if(s.typ==='liste')liste(n,b.eintraege);
          else n.textContent=b.text;
        }
        if(bearbeiten){
          const knopf=d.createElement('button');knopf.type='button';knopf.className='red-block-bearbeiten';knopf.textContent='Bearbeiten';knopf.setAttribute('aria-label',`Bearbeiten: ${s.titel}`);knopf.addEventListener('click',()=>bearbeiten(s.id));
          if(s.typ==='schritte'){n.dataset.blockId=s.id;n.prepend(knopf);}
          else {const rahmen=d.createElement('div');rahmen.dataset.blockId=s.id;n.before(rahmen);rahmen.append(knopf,n);}
        }
      });
      montiereSpielbericht(ziel);
    },
  };
}
if(typeof document!=='undefined'){
  const wurzel=document.querySelector('[data-spielbericht]');
  if(window.supabase&&wurzel){
    const client=window.supabase.createClient(DATENBANK.adresse,DATENBANK.oeffentlicherSchluessel);
    montiereBlockeditor({client,verein:VEREIN,wurzel,seite:'spielbericht',adapter:erstelleSpielberichtAdapter(wurzel)}).catch(()=>{
      // Der vollständige statische Guide bleibt auch ohne Redaktionsverbindung lesbar.
    });
  }
}
