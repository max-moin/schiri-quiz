// Diese Themen sind keine zweite Rote-Karte-Phasenansicht. Alle Abschnitte
// bleiben sichtbar; Erklärungen sind je konkretem Schritt abrufbar.
export function montiereDfbnetNachschlagen(wurzel){
 const d=wurzel.ownerDocument;wurzel.classList.add('dfb-themen-guide');
 wurzel.querySelectorAll('[data-dfb-chrome]').forEach(n=>n.remove());
 wurzel.querySelectorAll('[data-sb-panel]').forEach(n=>n.hidden=false);
 const werkzeuge=wurzel.querySelector('[data-sb-werkzeuge]');if(werkzeuge)werkzeuge.hidden=true;
 wurzel.querySelectorAll('.rk-schritt').forEach((schritt,index)=>{
  const texte=[...schritt.querySelectorAll(':scope > .rk-lang')];if(!texte.length)return;
  texte.forEach((t,i)=>{t.hidden=true;t.id=`dfb-erklaerung-${index}-${i}`;});
  const b=d.createElement('button');b.type='button';b.className='dfb-erklaerung-knopf';b.dataset.dfbChrome='';
  b.textContent='Erklärung anzeigen';b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',texte.map(t=>t.id).join(' '));
  b.setAttribute('aria-label',`Erklärung: ${schritt.querySelector('h3')?.textContent||'Schritt'}`);
  b.onclick=()=>{const offen=b.getAttribute('aria-expanded')!=='true';texte.forEach(t=>t.hidden=!offen);b.setAttribute('aria-expanded',String(offen));b.textContent=offen?'Erklärung schließen':'Erklärung anzeigen';};
  schritt.append(b);
 });
}
