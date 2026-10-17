import { DATENBANK } from '../../verein.config.js';
import { erstelleSerienSteuerung } from './wochenserie-ansicht.js';
const anmeldung=globalThis.SchiriSeitenAnmeldung?.anmeldung || globalThis.SchiriAnmeldung.erstelleAnmeldung({adresse:DATENBANK.adresse,oeffentlicherSchluessel:DATENBANK.oeffentlicherSchluessel});
const loginDialog=globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const rpc=globalThis.SchiriRpc.erstelleRpc({adresse:DATENBANK.adresse,oeffentlicherSchluessel:DATENBANK.oeffentlicherSchluessel});
const $=id=>document.getElementById(id),steuerung=erstelleSerienSteuerung({ziel:$('meine-wochenserie'),rpc,anmeldung});
function starten(){const person=anmeldung.lesen();$('meine-zugang').hidden=!!person;$('meine-inhalt').hidden=!person;void steuerung.laden(person);}
$('meine-anmelden').addEventListener('click',async()=>{if(!loginDialog)return;const ergebnis=await loginDialog.oeffne({grund:'Melde dich an, um deine eigene Sammlung zu sehen.'});if(ergebnis.status==='angemeldet')starten();});
anmeldung.abonniere(starten);
window.addEventListener('pageshow',e=>{if(e.persisted)starten();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)starten();});
