import {sichereApiAntwort,supabaseRpc} from './api-helpers.js';
import {sucheOrte,berechneRoute,koordinaten} from './spesen-routing.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 sichereApiAntwort(res);
 if(req.method==='GET')return res.status(200).json({eingerichtet:Boolean(process.env.ORS_API_KEY),modus:'oeffentliche-orte-test'});
 if(req.method!=='POST')return res.status(405).json({fehler:'Nur POST erlaubt.'});
 const b=req.body||{},key=process.env.ORS_API_KEY;
 if(!key)return res.status(503).json({code:'ROUTING_NOT_CONFIGURED',fehler:'Die Kartenberechnung ist noch nicht eingerichtet. Kilometer kannst du von Hand eintragen.'});
 if(!UUID.test(String(b.schiedsrichterId||''))||typeof b.pin!=='string'||b.pin.length>32)return res.status(400).json({fehler:'Bitte zuerst anmelden.'});
 if(b.einverstanden!==true)return res.status(400).json({fehler:'Bitte bestätige die Übermittlung der Orte an openrouteservice.'});
 // Declaration of the test scope, NOT an automatic personal-data detector.
 if(b.nurOeffentlicheOrte!==true)return res.status(400).json({code:'ROUTING_PUBLIC_TEST_ONLY',fehler:'Diese Routenhilfe ist vorerst nur für Tests mit öffentlichen Orten freigegeben. Keine Wohnadressen oder privaten Startpunkte übermitteln.'});
 // Validate before quota reservation. Never accept provider URLs from the client.
 try{if(b.aktion==='route'){koordinaten(b.start);koordinaten(b.ziel);}else if(b.aktion==='suche'){if(typeof b.text!=='string'||b.text.trim().length<4||b.text.length>180)throw new Error();}else throw new Error();}
 catch{return res.status(400).json({fehler:'Bitte gültige Orte im europäischen Reisegebiet eingeben.'});}
 try{const limit=await supabaseRpc('spesen_routing_erlauben',{p_schiedsrichter_id:b.schiedsrichterId,p_pin:b.pin,p_einheiten:b.aktion==='route'?2:1});if(limit!==true)return res.status(429).json({fehler:'Das Berechnungslimit ist erreicht. Bitte später erneut versuchen oder Kilometer manuell eintragen.'});}
 catch(e){return res.status(e.code==='SERVER_CONFIGURATION_MISSING'?503:401).json({fehler:e.code==='SERVER_CONFIGURATION_MISSING'?'Die Routenhilfe ist noch nicht eingerichtet. Kilometer bitte manuell eintragen.':'Anmeldung oder Routingfreigabe ist nicht gültig. Bitte erneut anmelden.'});}
 try{return res.status(200).json(b.aktion==='suche'?{orte:await sucheOrte(b.text,key)}:await berechneRoute(b.start,b.ziel,key));}
 catch(e){
  // Deliberately do not log e, req.body or upstream URL: they may contain a home address.
  return res.status(e.message==='KONTINGENT'?429:502).json({fehler:'Die Routenhilfe ist gerade nicht verfügbar. Deine Eingaben bleiben erhalten; Kilometer sind weiterhin manuell eintragbar.'});
 }
}
