import { VEREIN, DATENBANK } from '../../verein.config.js';
import { montiereBlockeditor } from '../admin/blockeditor.js';
import { erstelleSpielberichtAdapter } from './spielbericht-redaktion.js';
import { montiereSpielbericht } from './spielbericht.js';

export const DFB_GUIDES = Object.freeze(['sperrtermine','schiri-beobachtung','spielersperren']);
if(typeof document!=='undefined'){
  const wurzel=document.querySelector('[data-dfbnet-guide]'),seite=wurzel?.dataset.dfbnetGuide;
  if(wurzel&&DFB_GUIDES.includes(seite)){
    montiereSpielbericht(wurzel);
    if(window.supabase){
      const client=window.supabase.createClient(DATENBANK.adresse,DATENBANK.oeffentlicherSchluessel);
      montiereBlockeditor({client,verein:VEREIN,wurzel,seite,adapter:erstelleSpielberichtAdapter(wurzel,{kennung:`${seite}-v1`})}).catch(()=>{
        // Netzfehler lassen den vollständigen statischen Leitfaden stehen.
      });
    }
  }
}
