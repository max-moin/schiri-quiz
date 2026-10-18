import '../core/rpc.js';
import {DATENBANK} from '../../verein.config.js';
import {berechneWochenserie} from './wochenserie.js';
const ziel=document.getElementById('quiz-serienzaehler');
const speicher=globalThis.SchiriQuizSessionStore.erstelleSessionSpeicher('schiriQuizSession',{dauerhafterSchluessel:'schiriQuizGemerktesGeraet'});
const rpc=globalThis.SchiriRpc.erstelleRpc({adresse:DATENBANK.adresse,oeffentlicherSchluessel:DATENBANK.oeffentlicherSchluessel});
let version=0,timer;
async function laden(){
 const lauf=++version,person=speicher.lesen();
 if(!ziel)return;
 if(!person?.id||!person.pin||document.body.classList.contains('quiz-gastmodus')){ziel.hidden=true;return;}
 try{
  const {data,error}=await rpc.rpc('meine_wochenserie_mit_joker',{p_schiedsrichter_id:person.id,p_pin:person.pin});
  const aktuell=speicher.lesen();
  if(lauf!==version||aktuell?.id!==person.id||aktuell?.pin!==person.pin||document.body.classList.contains('quiz-gastmodus'))return;
  if(error)throw error;
  const n=berechneWochenserie(data).serie;
  ziel.querySelector('[data-serienzahl]').textContent=String(n);
  ziel.setAttribute('aria-label',`${n} ${n===1?'Woche':'Wochen'} in deiner Serie. Zur Wochenserie.`);
  ziel.title=`Deine Wochenserie: ${n}`;ziel.hidden=false;
 }catch{if(lauf===version)ziel.hidden=true;}
}
function vormerken(){clearTimeout(timer);timer=setTimeout(laden,250);}
window.addEventListener('schiri:quiz-zugang',vormerken);
window.addEventListener('pageshow',vormerken);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)vormerken();});
const fortschritt=document.getElementById('fortschritt-text');
if(fortschritt)new MutationObserver(vormerken).observe(fortschritt,{childList:true,characterData:true,subtree:true});
void laden();
