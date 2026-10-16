// Nur Ansicht und Navigation; keine DFBnet-Aktion und kein lokaler Bearbeitungsstand.
export const ABSCHNITTE = Object.freeze(['vorbereiten','erfassen','abschliessen']);
const lebenszyklen = new WeakMap();
export function abschnittFuerAnker(wurzel, anker) {
  const id=String(anker||'').replace(/^#/,'');
  if(ABSCHNITTE.includes(id))return id;
  return [...wurzel.querySelectorAll('[data-sb-panel]')].find(p=>[...p.querySelectorAll('[id]')].some(n=>n.id===id))?.id || 'erfassen';
}
export function montiereSpielbericht(wurzel, ort=globalThis.location, verlauf=globalThis.history, fenster=globalThis.window) {
  if(!wurzel)return;
  lebenszyklen.get(wurzel)?.();
  const ab=[];
  const hoere=(el,typ,fn)=>{el.addEventListener(typ,fn);ab.push(()=>el.removeEventListener(typ,fn));};
  const panels=[...wurzel.querySelectorAll('[data-sb-panel]')], phasen=[...wurzel.querySelectorAll('[data-sb-phase]')], ansichten=[...wurzel.querySelectorAll('[data-sb-ansicht]')];
  const zeige=id=>{panels.forEach(p=>p.hidden=p.id!==id);phasen.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sbPhase===id)));};
  phasen.forEach(b=>hoere(b,'click',()=>{zeige(b.dataset.sbPhase);verlauf.replaceState(null,'',`#${b.dataset.sbPhase}`);}));
  ansichten.forEach(b=>hoere(b,'click',()=>{wurzel.dataset.ansicht=b.dataset.sbAnsicht;ansichten.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  ansichten.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sbAnsicht===wurzel.dataset.ansicht)));
  // Interne Links müssen das verborgene Panel vor dem nativen Ankersprung öffnen.
  hoere(wurzel,'click',e=>{
    const a=e.target.closest('a[href^="#"]');if(!a||e.defaultPrevented)return;
    const id=a.getAttribute('href').slice(1),ziel=[...wurzel.querySelectorAll('[id]')].find(n=>n.id===id);
    if(!ziel)return;
    zeige(abschnittFuerAnker(wurzel,id));
    // Anker auch per Tastatur erreichbar machen, ohne einen zusätzlichen Tabstopp.
    ziel.setAttribute('tabindex','-1');ziel.focus({preventScroll:true});
  });
  hoere(fenster,'hashchange',()=>{
    const id=ort.hash.slice(1);if([...wurzel.querySelectorAll('[id]')].some(n=>n.id===id))zeige(abschnittFuerAnker(wurzel,id));
  });
  zeige(abschnittFuerAnker(wurzel,ort.hash));
  wurzel.querySelector('[data-sb-werkzeuge]').hidden=false;
  const aufraeumen=()=>ab.forEach(fn=>fn());lebenszyklen.set(wurzel,aufraeumen);return aufraeumen;
}
if(typeof document!=='undefined')montiereSpielbericht(document.querySelector('[data-spielbericht]'));
