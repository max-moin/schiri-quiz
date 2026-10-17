import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { SPIELBERICHT_THEMEN,spielberichtThema } from '../src/website/spielbericht-themen.js';
const lies=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Alle 15 Spielberichtsschritte haben genau eine sichere Themenadresse',()=>{
 assert.equal(new Set(SPIELBERICHT_THEMEN.map(t=>t.id)).size,15);
 assert.deepEqual(SPIELBERICHT_THEMEN.map(t=>t.schritt),Array.from({length:15},(_,i)=>i));
 for(const t of SPIELBERICHT_THEMEN)assert.equal(spielberichtThema('?thema='+t.id),t);
 for(const s of ['','?thema=<script>','?thema=unbekannt','?thema=__proto__'])assert.equal(spielberichtThema(s),null);
});
test('Originalbilder existieren, Quellenstand und fehlende heutige Masken werden benannt',()=>{
 const bilder=SPIELBERICHT_THEMEN.flatMap(t=>t.bilder||[]);assert.equal(bilder.length,8);
 for(const [name,seite,titel] of bilder){assert.ok(existsSync(new URL('../bilder/dfbnet/'+name+'.webp',import.meta.url)));assert.ok(seite>=20&&seite<=30);assert.ok(titel.length>12);}
 const js=lies('src/website/spielbericht-uebersicht.js');assert.match(js,/Stand 03.06.2019/);assert.match(js,/Originalquelle/);assert.match(js,/sb-bildmarke/);
 assert.doesNotMatch(js,/innerHTML|eval\(|insertAdjacentHTML/);
 assert.ok(SPIELBERICHT_THEMEN.find(t=>t.id==='vorkommnisse').hinweise.some(h=>h[1].includes('STOPP-Abfrage nicht ab')));
});
test('Redaktionsadapter entfernt Projektion, nicht die kanonischen 39 Inhaltsblöcke',()=>{
 const js=lies('src/website/spielbericht-redaktion.js');assert.match(js,/data-sb-ansichts-chrome/);assert.match(js,/data-dfb-chrome/);
 const html=lies('spielbericht.html');assert.equal([...html.matchAll(/data-sb-inhalt="/g)].length,39);
 assert.doesNotMatch(html,/data-sb-phase=|data-sb-ansicht=/);
 assert.match(lies('src/ui/wegweiser.js'),/"spielbericht.html": \{[^\n]+eltern: "dfbnet.html"/);
});
test('Hauptanleitung bindet Original-Teilen-Symbol ein, nicht nur die Ersatzanleitung',()=>{
 const js=lies('src/website/installieren-seite.js');assert.match(js,/icon.src='bilder\/apple-teilen.png'/);assert.match(js,/Originalanleitung von Apple/);
 assert.match(lies('src/website/installationswege.js'),/Seitenmenü/);
});
test('Serienjoker ist knapp benannt und Flamme ist nicht alleiniger Statusträger',()=>{
 const js=lies('src/website/wochenserie-ansicht.js');assert.match(lies('src/website/joker-vorrat.js'),/'Deine Joker'/);assert.doesNotMatch(js,/'Dein Geburtstagsjoker'/);
 assert.match(js,/serie-flamme/);assert.match(js,/aria-hidden/);assert.match(js,/'Wochen in Folge'/);
});
test('Themen nutzen nur den Titel-Link, feste Hotbar und nicht anklickbare Bilder',()=>{
 const js=lies('src/website/spielbericht-uebersicht.js');
 assert.doesNotMatch(js,/sb-detail-link|Originalausschnitt in voller Größe/);assert.match(js,/sb-hotbar/);assert.match(js,/SPIELBERICHT_THEMEN\[index-1\]/);assert.match(js,/sb-hinweisnummer/);
 assert.match(js,/el\(d,'div','sb-bildflaeche'\)/);assert.match(js,/Weitere Hinweise/);
});
