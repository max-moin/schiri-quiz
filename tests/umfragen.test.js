import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { abschnitte, normalisiereAntwort, tage, version, zeitVerschieben } from "../src/shared/stimmungsbild.js";
import { sichereUmfrageAnfrage } from "../server/umfragen-handler.js";
import dispatcher from "../api/website-feedback.js";

const probe = () => ({
  konflikte:["Mittwoch"], tier:{Montag:"A",Dienstag:"A",Donnerstag:"B",Freitag:"E"},
  start:[960,1035], frequenz:5, quiz:4, verein:"na", quizAnzahl:"Genau richtig", vorstandIdee:"  Mehr Rückhalt  ",
});
test("gleiche Tiers möglich, E bleibt möglich, feste Konflikte nicht mitbewertet", () => {
  const p=probe();
  assert.equal(normalisiereAntwort(p).tier.Freitag,"E");
  assert.equal(normalisiereAntwort({...p,konflikte:undefined}),null);
  assert.equal(normalisiereAntwort({...p,konflikte:["Dienstag","Dienstag"]}),null);
  assert.equal(normalisiereAntwort({...p,tier:{...p.tier,Mittwoch:"E"}}),null);
  assert.equal(normalisiereAntwort({...p,tier:{...p.tier,Freitag:"F"}}),null);
  assert.equal(normalisiereAntwort({...p,tier:{Montag:"A"}}),null);
});
test("Startfenster rastet viertelstündlich, kreuzt nie und das Ende wird nicht als Start gespeichert", () => {
  assert.deepEqual(zeitVerschieben([960,1140],1,1037),[960,1035]);
  assert.deepEqual(zeitVerschieben([1020,1035],0,1090),[1035,1035]);
  assert.deepEqual(zeitVerschieben([1020,1035],1,1010),[1020,1020]);
  assert.deepEqual(zeitVerschieben([1020,1035],1,1260),[1020,1140]);
  assert.equal(normalisiereAntwort({...probe(),start:[960,1034]}),null);
  assert.equal(normalisiereAntwort({...probe(),start:[1035,960]}),null);
});
test("Likert enthält eine echte Mitte und getrennte nicht bewertbare Antworten", () => {
  const felder=normalisiereAntwort(probe()).felder;
  assert.equal(felder.find(f=>f.key==="quiz").wert,4);
  assert.equal(felder.find(f=>f.key==="verein").wert,undefined);
  assert.equal(felder.find(f=>f.key==="verein").text,"Kann ich nicht beurteilen");
  assert.equal(felder.find(f=>f.key==="vorstandIdee").text,"Mehr Rückhalt");
  assert.equal(normalisiereAntwort({...probe(),quiz:0}),null);
});
test("Rhythmus und Menge sind getrennt, keine widersprüchliche Unterstützungswahl", () => {
  const felder=abschnitte.flatMap(a=>a.felder);
  assert.ok(felder.some(f=>f.key==="quizOft"));
  assert.ok(felder.some(f=>f.key==="quizAnzahl"));
  assert.ok(felder.some(f=>f.key==="treffExtern") && felder.some(f=>f.key==="hrtExtern"));
  assert.equal(normalisiereAntwort({...probe(),hilfe:["Mir fehlt gerade nichts","Einfachere Abrechnung"]}),null);
});
test("der Server akzeptiert keine vom Mitglied behauptete Identität, Rolle oder Clubzuordnung", () => {
  const mitglied={version,aktion:"abgeben",person:"822df5eb-0755-4c9a-b59c-2f06abbe04c8",pin:"1234",antwort:probe()};
  const eingabe=sichereUmfrageAnfrage({...mitglied,verein:"fremd",rolle:"admin",schluessel:"A".repeat(43),name:"Fremder Name"});
  assert.deepEqual(Object.keys(eingabe),["aktion","person","pin","antwort"]);
  assert.equal(sichereUmfrageAnfrage({...mitglied,version:"falscher-vertrag"}),null);
  assert.equal(sichereUmfrageAnfrage({...mitglied,aktion:"obmann-stand",schluessel:"1234"}),null);
  assert.equal(sichereUmfrageAnfrage({...mitglied,antwort:{tier:Object.fromEntries(tage.map(t=>[t,"E"]))}}),null);
});
test("Vorschau nutzt weder Login noch das Abgabe-API", () => {
  const js=readFileSync(new URL("../src/website/umfragen-seite.js",import.meta.url),"utf8");
  assert.match(js,/vorschau \? null : globalThis\.SchiriAnmeldung/);
  assert.match(js,/if \(vorschau\) \{ stand="fertig"; antwort=leer\(\); refresh\(\); return; \}/);
});
test("Vercel-Route nutzt den vorhandenen Dispatcher und antwortet privat statt zu cachen", async () => {
  const cfg=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  assert.deepEqual(cfg.rewrites.find(r=>r.source==="/api/umfragen"),
    {source:"/api/umfragen",destination:"/api/website-feedback?funktion=umfragen"});
  const result={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(d){this.body=d;}};
  await dispatcher({url:cfg.rewrites[1].destination, method:"POST", headers:{"content-type":"application/json"}, body:{aktion:"obmann-stand"}},result);
  assert.equal(result.code,400);
  assert.equal(result.headers["Cache-Control"],"no-store");
  assert.deepEqual(result.body,{fehler:"eingabe"});
});
