import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { filter, katalog, suche } from "../src/website/hilfe-suche.js";

test("alltägliche Formulierungen, Synonyme, Umlaute und Tippfehler", () => {
  for (const [frage, seite] of [
    ["der Schiri ist nicht aufgetaucht","hilfe.html#nichtantritt"],
    ["Schiedsrichter taucht nicht auf","hilfe.html#nichtantritt"],
    ["sonderbreicht","rote-karte.html"],["rot vor anpfiff","rote-karte.html"],["Weltraumrakete",""],
    ["Quittung D-Jugend","spesenrechner.html"],["religiöse Beleidigung","hilfe.html#diskriminierung"],
    ["trainer bedraengt","hilfe.html#bedraengt"],["spertermin","sperrtermine.html"],
    ["aufwaermen","https://www.meinfussball.de/schiris/aktive/warm-up"],
  ]) assert.equal(suche(frage,{}, {spesen:true})[0]?.href || "",seite,frage);
});
test("Regeln und Spesen erscheinen nur nach bestehender Funktionsfreigabe",()=>{
  for (const [frage,seite,freigabe] of [["Quittung D-Jugend","spesenrechner.html","spesen"],["Regelübersicht","regeluebersicht.html","regeln"]]) {
    assert.ok(!suche(frage).some(e=>e.href===seite));
    assert.equal(suche(frage,{}, {[freigabe]:true})[0].href,seite);
  }
});
test("Filter sind kombinierbar und decken den vorhandenen Katalog ab",()=>{
  assert.ok(suche("",{thema:"dfbnet",rolle:"trainer",phase:"danach"}).some(e=>e.href.endsWith("#nichtantritt")));
  assert.deepEqual(suche("Sperrtermin",{thema:"dfbnet",rolle:"trainer",phase:"dabei"}),[]);
  for (const e of katalog) {
    for(const [k,werte] of Object.entries(filter)) assert.ok(e[k].length && e[k].every(v=>Object.hasOwn(werte,v)));
    if(!e.href.startsWith("https:")) assert.ok(existsSync(new URL("../"+e.href,import.meta.url)),e.href);
  }
});
