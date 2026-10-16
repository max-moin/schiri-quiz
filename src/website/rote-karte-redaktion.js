import { VEREIN, DATENBANK } from '../../verein.config.js';
import { montiereBlockeditor } from '../admin/blockeditor.js';
import { erstelleGuideAdapter } from './guide-redaktion.js';
const wurzel=document.querySelector('[data-rote-karte]');
if(window.supabase && wurzel){
  const client=window.supabase.createClient(DATENBANK.adresse,DATENBANK.oeffentlicherSchluessel);
  montiereBlockeditor({client,verein:VEREIN,wurzel,seite:'rote-karte',adapter:erstelleGuideAdapter(wurzel)}).catch(()=>{
    // Bei fehlender Verbindung bleibt der vollständige freigegebene Guide stehen.
  });
}
