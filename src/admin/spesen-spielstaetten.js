/** Only public sports venues belong in this configuration, never home addresses. */
export function baueSpielstaettenEditor(wurzel, vereine) {
  const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const s=el('section'),h=el('h3','Öffentliche Spielstätten');
  const info=el('p','Pro Verein mehrere Plätze möglich. Nur öffentliche Sportstätten eintragen – keine Wohnadressen. Änderungen werden erst mit „Veröffentlichen“ gemeinsam gespeichert.');
  const vereinsWahl=el('select');vereinsWahl.setAttribute('aria-label','Verein für Spielstätten');
  vereine.forEach((v,i)=>{const o=el('option',v.name);o.value=i;vereinsWahl.append(o);});
  const liste=el('div');
  function feld(titel,wert,fn){const l=el('label',titel),i=el('input');i.type='text';i.maxLength=titel==='Adresse'?240:120;i.value=wert;i.oninput=()=>fn(i.value);l.className='admin-feld';l.append(i);return l;}
  function render(){
    liste.replaceChildren();const verein=vereine[Number(vereinsWahl.value)];if(!verein)return;
    for(const platz of verein.spielstaetten||[]){
      const box=el('div');box.className='admin-liga-zeile';
      box.append(feld('Bezeichnung',platz.name,v=>platz.name=v),feld('Adresse',platz.adresse||'',v=>{platz.adresse=v;delete platz.koordinaten;}));
      const loeschen=el('button','Spielstätte entfernen');loeschen.type='button';loeschen.onclick=()=>{if(!window.confirm('Diese Spielstätte aus dem nächsten Konfigurationsstand entfernen?'))return;verein.spielstaetten=verein.spielstaetten.filter(p=>p!==platz);render();};box.append(loeschen);liste.append(box);
    }
  }
  const add=el('button','＋ Spielstätte hinzufügen');add.type='button';add.onclick=()=>{const v=vereine[Number(vereinsWahl.value)];if(!v)return;const liste=v.spielstaetten||=[];if(liste.length>=30)return;liste.push({id:crypto.randomUUID(),name:'Neue Spielstätte',adresse:''});render();};
  vereinsWahl.onchange=render;s.append(h,info,vereinsWahl,liste,add);wurzel.append(s);render();return s;
}
