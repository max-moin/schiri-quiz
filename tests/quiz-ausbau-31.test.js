import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baueErstversuchPrompt, extrahierePunktwertung, leiteKriterienBewertungAb, normalisiereKIBewertung } from "../api/freitext-bewerten.js";
import { vergleicheOrtLokal, vergleicheOrtMitGemini } from "../api/entscheidung-bewerten.js";
import { DOKUMENT_DOWNLOADS, lokalerDokumentDownload, dokumentZeile } from "../src/website/dokument-downloads.js";
import { normalisiereWebsiteInhalt, validiereWebsiteInhalt } from "../src/website/content-config.js";
import { UNTERLAGEN_STANDARD } from "../src/website/content-defaults.js";

const k = (id,plus=3,minus=5,folgen={}) => ({id,bezeichnung:id,erwartung:`Ziel ${id}`,pluspunkte:plus,minuspunkte:minus,bei_fehlen:"ignorieren",bei_widerspruch:"ignorieren",...folgen});
const rubrik = (kriterien, aktiv=true,schwelle=5) => `[[KI-KRITERIEN-JSON]]${JSON.stringify(kriterien)}[[/KI-KRITERIEN-JSON]]\n[[KI-PUNKTE-JSON]]${JSON.stringify({aktiv,schwelle})}[[/KI-PUNKTE-JSON]]`;
const antwort = (...status) => ({kriterien:status.map((s,i)=>({id:String(i+1),status:s})),feedback:"Testfeedback",status:"richtig"});

test("Punktegrenze ist strikt: fünf genügen nicht, sechs genügen",()=>{
  const a=antwort("erfuellt","fehlt");
  assert.equal(leiteKriterienBewertungAb(a,rubrik([k("a",5),k("b",1)]),true).status,"falsch");
  assert.equal(leiteKriterienBewertungAb(antwort("erfuellt","erfuellt"),rubrik([k("a",5),k("b",1)]),true).status,"richtig");
});
test("Minuspunkte zählen genau einmal, ein Veto bleibt auch bei vielen Pluspunkten rot",()=>{
  let h=rubrik([k("a",10),k("b",5,3)]);
  let a=antwort("erfuellt","widersprochen");
  const bewertet=leiteKriterienBewertungAb(a,h,true);
  assert.equal(bewertet.status,"richtig");
  assert.equal(bewertet.punktwertung.punkte,7);
  a.kriterien.push({id:"1",status:"erfuellt"});
  assert.equal(leiteKriterienBewertungAb(a,h,true).punktwertung.punkte,7);
  h=rubrik([k("a",20),k("b",3,1,{bei_widerspruch:"falsch"})]);
  assert.equal(leiteKriterienBewertungAb(a,h,true).status,"falsch");
});
test("fehlende Pflichtaussage bleibt nachfragbar, Unsinn oder Zusatzfehler nicht",()=>{
  const h=rubrik([k("a",10),k("b",3,5,{bei_fehlen:"nachfragen"})]);
  const a=antwort("erfuellt","fehlt");
  assert.equal(leiteKriterienBewertungAb(a,h,true).status,"nachbessern");
  assert.equal(leiteKriterienBewertungAb(a,h,false).status,"falsch");
  for(const flag of ["ungueltig","fachlicher_widerspruch"]){
    assert.equal(leiteKriterienBewertungAb({...a,[flag]:true},h,true).status,"falsch");
  }
  assert.equal(normalisiereKIBewertung({status:"richtig",fachlicher_widerspruch:true,feedback:"Zusatz falsch"},h,true).status,"falsch");
});
test("Punktemodus bleibt optional, ungültige oder unerreichbare Konfiguration scheitert sicher",()=>{
  assert.deepEqual(extrahierePunktwertung("alte Hinweise"),{aktiv:false,schwelle:5});
  assert.equal(leiteKriterienBewertungAb(antwort("erfuellt"),rubrik([k("a",1)],false),true).status,"richtig");
  assert.throws(()=>leiteKriterienBewertungAb(antwort("erfuellt"),rubrik([k("a",5)]),true),/nicht erreichbar/);
  assert.throws(()=>extrahierePunktwertung("[[KI-PUNKTE-JSON]]oops"),/unvollständig/);
  assert.throws(()=>extrahierePunktwertung("[[KI-PUNKTE-JSON]]{}[[/KI-PUNKTE-JSON]]"),/ungültig/);
});
test("nur falsche Aussagen, nicht serverseitige Punkte, gehen in den kompakten KI-Kontext",()=>{
  const h=rubrik([{...k("a",17,19),falsche_aussagen:"Abstoß statt direkter Freistoß"}]);
  const prompt=baueErstversuchPrompt({frage_text:"Situation",musterantwort:"DF",bewertungshinweise:h},"DF und Abstoß",true);
  assert.match(prompt,/Abstoß statt direkter Freistoß/);
  assert.match(prompt,/fachlicher_widerspruch/);
  assert.doesNotMatch(prompt,/pluspunkte|minuspunkte|KI-PUNKTE-JSON|"schwelle"/);
});
test("Ortsvarianten: Synonyme lokal, szenenabhängige Ballstopp-Stelle zur Kontextprüfung",()=>{
  for(const ort of ["Tatort","am Vergehensort","an der Stelle, an der das Foul passiert ist"]){
    assert.equal(vergleicheOrtLokal(ort,"Ort des Vergehens"),true,ort);
  }
  assert.equal(vergleicheOrtLokal("dort, wo der Ball aufgehalten wird","Ort des Vergehens"),null);
  assert.notEqual(vergleicheOrtLokal("nicht am Ort des Vergehens","Ort des Vergehens"),true);
});
test("KI-Ortsvergleich erhält Situation und unterscheidet Ballstopp von pauschaler Gleichsetzung",async()=>{
  const vorher=globalThis.fetch;
  try {
    let kontext="";
    globalThis.fetch=async (_url,optionen)=>{
      kontext=JSON.stringify(JSON.parse(optionen.body));
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"gleichwertig":true,"begruendung":"In dieser Szene dieselbe Stelle."}'}]}}]}));
    };
    const ergebnis=await vergleicheOrtMitGemini("test","gemini-test","Ein Spieler hält unerlaubt den Ball auf.","wo der Ball aufgehalten wird","Ort des Vergehens");
    assert.equal(ergebnis.gleichwertig,true);
    assert.match(kontext,/Ein Spieler hält unerlaubt den Ball auf/);
    assert.match(kontext,/nicht pauschal|nicht allgemein|nicht generell/i);
  } finally {globalThis.fetch=vorher;}
});
test("Dokumente: nur existierende lokale Dateien, Original separat, keine fremden Downloads",()=>{
  for(const d of DOKUMENT_DOWNLOADS){
    assert.equal(readFileSync(new URL(`..${d.pfad}`,import.meta.url)).subarray(0,5).toString(),"%PDF-");
  }
  for(const falsch of ["/dokumente/../private.pdf","//evil.test/a.pdf","https://evil.test/a.pdf","/dokumente/x.svg","/dokumente/%2e%2e/x.pdf"]){
    assert.equal(lokalerDokumentDownload(falsch),"");
  }
  const d=UNTERLAGEN_STANDARD.dokumente.find(d=>d.datei);
  const html=dokumentZeile({...d,titel:'<img onerror="boom">'},UNTERLAGEN_STANDARD.herkunft.svfd);
  assert.match(html,/download>Herunterladen/);
  assert.match(html,/Quelle:/);
  assert.doesNotMatch(html,/<img/);
  assert.doesNotMatch(html,/<a[^>]+download[^>]+target=/);
  const fremd=dokumentZeile({...d,datei:"https://evil.test/a.pdf"},UNTERLAGEN_STANDARD.herkunft.svfd);
  assert.doesNotMatch(fremd,/download>/);
  const roh=structuredClone(UNTERLAGEN_STANDARD);
  roh.dokumente=[{...d,stand:"Stand Test"}];
  assert.deepEqual(validiereWebsiteInhalt("unterlagen",roh),[]);
  const neu=normalisiereWebsiteInhalt("unterlagen",roh,UNTERLAGEN_STANDARD).dokumente[0];
  assert.equal(neu.datei,d.datei);assert.equal(neu.stand,"Stand Test");
  roh.dokumente[0].datei="/dokumente/unbekannt.pdf";
  assert.match(validiereWebsiteInhalt("unterlagen",roh).join(),/nicht auf dieser Website/);
});
