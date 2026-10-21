import { euroText } from './spesen-rechnung.js';
import { rechneTeam } from './spesen-team-rechnung.js';
import { oeffneRoutenhilfe } from './spesen-route-dialog.js';

const el = (tag, text, klasse) => { const n=document.createElement(tag); if(text)n.textContent=text; if(klasse)n.className=klasse; return n; };
const button = (text, fn) => { const b=el('button',text); b.type='button'; b.onclick=fn; return b; };
let nummer=0;
export function baueTeamRechner({ wurzel, konfiguration:c }) {
  // The legacy calculator stays in the source for compatibility, not as a second visible calculation.
  [...wurzel.children].forEach(e => { e.hidden=true; });
  const root=el('section','','spesen-team'), id=`spesen-team-${++nummer}`;
  const state={ ebene:'svfd', gruppe:0, liga:0, verein:0, platz:0, personen:[] };
  let naechstePerson=0;
  const person=()=>({id:`p${++naechstePerson}`,name:'',art:state.ebene==='svfd'?'zonen':'auto',zonen:'',km:'',betrag:'',fahrer:''});
  state.personen.push(person());
  const kopf=el('div','','spesen-team-kopf'); kopf.append(el('h2','Ein Spiel. Dein Schiri-Team.'),el('p','Spesen gemeinsam einordnen · Fahrtkosten je Person'));
  const pruefhinweis=el('p','Berechnungshilfe aus den hinterlegten Sätzen, keine verbindliche Abrechnung. Stadt und Land bleiben getrennt. Für Pokal, Freundschaft, Turnier und Sonderfälle bitte die verlinkte Ordnung prüfen.','spesen-team-hinweis');
  const spiel=el('div','','spesen-team-raster'), ziel=el('div','','spesen-team-raster'), personen=el('div','','spesen-team-personen'), summe=el('section','','spesen-team-summe');
  const live=el('p'); live.setAttribute('role','status');
  function select(titel, items, wert, change) {
    const l=el('label',titel), s=el('select'); s.id=`${id}-${++nummer}`; l.htmlFor=s.id;s.setAttribute('aria-label',titel);
    for(const [v,t] of items){const o=el('option',t);o.value=String(v);s.append(o);}s.value=String(wert);s.onchange=()=>change(s.value);l.append(s);return l;
  }
  function input(titel, wert, change, numerisch=false) {
    const l=el('label',titel), i=el('input');i.type='text';i.value=wert;i.maxLength=numerisch?12:80;i.setAttribute('aria-label',titel);
    if(numerisch)i.inputMode='decimal';i.oninput=()=>{change(i.value);ergebnis();};l.append(i);return l;
  }
  const gruppen=()=>c.altersklassen.map((g,i)=>[i,g]).filter(([,g])=>g.ligen.some(l=>l.verband===state.ebene));
  const ligen=()=>c.altersklassen[state.gruppe]?.ligen.filter(l=>l.verband===state.ebene)||[];
  const liga=()=>ligen()[state.liga];
  const spielstaette=()=>c.vereine[state.verein]?.spielstaetten?.[state.platz];
  function spielFelder() {
    const gs=gruppen();if(!gs.some(([i])=>i===state.gruppe))state.gruppe=gs[0]?.[0]??0;
    if(!ligen()[state.liga])state.liga=0;
    spiel.replaceChildren(
      select('Ebene', [['svfd','Stadt Dresden · SVFD'],['sfv','Land Sachsen · SFV']],state.ebene,v=>{state.ebene=v;state.liga=0;state.personen.forEach(p=>{p.art=v==='svfd'?'zonen':'auto';p.zonen='';p.betrag='';});render();}),
      select('Mannschaft / Altersklasse',gs.map(([i,g])=>[i,g.name]),state.gruppe,v=>{state.gruppe=Number(v);state.liga=0;render();}),
      select('Spielklasse · Meisterschaft',ligen().map((l,i)=>[i,l.kurz]),state.liga,v=>{state.liga=Number(v);render();})
    );
    const plaetze=c.vereine[state.verein]?.spielstaetten||[];
    ziel.replaceChildren(select('Heimverein',c.vereine.map((v,i)=>[i,v.name]),state.verein,v=>{state.verein=Number(v);state.platz=0;render();}),
      plaetze.length ? select('Spielstätte',plaetze.map((s,i)=>[i,s.name]),state.platz,v=>{state.platz=Number(v);render();})
        : el('p','Noch keine Spielstätte hinterlegt. In der Routenhilfe kannst du das Ziel für diese Berechnung selbst eingeben.'));
    if(spielstaette()?.adresse)ziel.append(el('p',spielstaette().adresse));
  }
  function personFelder() {
    personen.replaceChildren();state.personen.forEach((p,index)=>{
      const box=el('article','','spesen-team-person'), h=el('h3',index?`Assistent ${index}`:'Schiedsrichter');
      const betrag=index?liga()?.sra:liga()?.sr;box.append(h,el('p',`Spesen: ${betrag==null?'Satz ungeklärt':euroText(betrag)}`,'spesen-team-pauschale'));
      const felder=el('div','','spesen-team-raster');felder.append(input('Name (optional, nur in dieser Abrechnung)',p.name,v=>p.name=v));
      const arten=state.ebene==='svfd'
        ? [['zonen','Tarifzonen · Stadtregel'],['manuell','Betrag selbst eintragen'],['keine','Keine Fahrtkosten']]
        : [['auto','Eigenes Auto · Gesamt-km'],['rad','Fahrrad · Gesamt-km'],['karte','Monats-/Jahreskarte'],['ticket','Fahrscheine laut Beleg'],['mitfahrt','Mitfahrt im Team'],['manuell','Betrag selbst eintragen'],['keine','Keine Fahrtkosten']];
      felder.append(select('Fahrtkosten',arten,p.art,v=>{p.art=v;personFelder();ergebnis();}));
      if(p.art==='zonen')felder.append(select('Durchfahrene Tarifzonen (hin und zurück)',[['','Bitte prüfen'],['1','1 Zone'],['2','2 Zonen'],['3','3 Zonen'],['4','Mehr als 3 · gesondert klären']],p.zonen,v=>{p.zonen=v;ergebnis();}));
      if(['auto','rad'].includes(p.art)) {
        felder.append(input('Gesamt-km für Hin- und Rückweg',p.km,v=>p.km=v,true));
        if(p.art==='auto')felder.append(button('Adresse / Karte → Kilometer',()=>oeffneRoutenhilfe({ziel:spielstaette(),uebernehmen:km=>{p.km=String(km).replace('.',',');personFelder();ergebnis();live.textContent='Kilometervorschlag übernommen. Du kannst ihn weiterhin korrigieren.';}})));
      }
      // Also usable on city level as a distance aid; it never converts km to a city entitlement.
      if(state.ebene==='svfd')felder.append(button('Strecke ansehen (ohne Erstattung zu ändern)',()=>oeffneRoutenhilfe({ziel:spielstaette(),uebernehmen:km=>{live.textContent=`Streckenvorschlag: ${km.toLocaleString('de-DE')} km. Stadt-Fahrtkosten weiterhin nach Tarifzonen / bestätigtem Betrag.`;}})));
      if(['ticket','manuell'].includes(p.art))felder.append(input('Fahrtkostenbetrag (€)',p.betrag,v=>p.betrag=v,true));
      if(p.art==='mitfahrt')felder.append(select('Mitgefahren bei', [['','Fahrer/in auswählen'],...state.personen.filter(q=>q.id!==p.id&&q.art==='auto').map(q=>[q.id,q.name||`Fahrer/in ${state.personen.indexOf(q)+1}`])],p.fahrer,v=>{p.fahrer=v;ergebnis();}));
      box.append(felder);if(index)box.append(button('Assistent entfernen',()=>{state.personen.splice(index,1);render();}));personen.append(box);
    });
    hinzufuegen.disabled=state.personen.length>=3;
  }
  function ergebnis() {
    const r=rechneTeam({liga:liga(),personen:state.personen,saetze:c.fahrtkosten});
    summe.replaceChildren(el('h3',r.unsicher?'Zwischensumme · Angaben fehlen':'Deine Zusammenfassung'));
    for(const z of r.zeilen) {
      const zeile=el('div','','spesen-team-zeile');zeile.append(el('strong',`${z.name} · ${z.funktion}`),el('span',`Spesen ${euroText(z.spesen.betrag)} + Fahrt ${euroText(z.fahrt.betrag)} = ${euroText(z.gesamt)}`),el('small',z.fahrt.text));
      if(z.spesen.unsicher)zeile.append(el('small','Funktionssatz ungeklärt – nicht als 0-€-Freigabe verstehen.'));summe.append(zeile);
    }
    summe.append(el('p',`${r.unsicher?'Zwischensumme':'Gesamt'}: ${euroText(r.gesamt)}`,'spesen-team-gesamt'),el('p','Mitnahmezuschläge und gemeinsame Teilstrecken sind nicht automatisch eingerechnet. Ggf. nach Prüfung beim Fahrer als bestätigten Betrag erfassen.','spesen-team-klein'));
  }
  function render(){spielFelder();personFelder();ergebnis();}
  const hinzufuegen=button('＋ Assistent hinzufügen',()=>{if(state.personen.length<3){state.personen.push(person());render();personen.lastElementChild?.querySelector('input')?.focus();}});
  const drucken=button('Zusammenfassung drucken',()=>window.print());drucken.className='spesen-team-drucken';
  const reset=button('Abrechnung leeren',()=>{if(!window.confirm('Eingaben dieser Abrechnung verwerfen?'))return;state.personen=[person()];render();live.textContent='Abrechnung geleert.';});
  const quellen=el('p','','spesen-team-klein');
  for(const [text,href] of [['Finanzordnung SVFD','https://www.svf-dresden.de/dokumente/finanzordnung/'],['Ordnungen SFV','https://www.sfv-online.de/vereinsservice/downloads/']]){const a=el('a',text);a.href=href;a.target='_blank';a.rel='noopener';quellen.append(a,' ');}
  root.append(kopf,pruefhinweis,spiel,el('h3','Wohin geht’s?'),ziel,personen,hinzufuegen,summe,drucken,reset,live,quellen);
  wurzel.append(root);render();return {root};
}
