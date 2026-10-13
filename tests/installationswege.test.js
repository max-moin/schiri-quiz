import test from 'node:test';
import assert from 'node:assert/strict';
import { erkenneGeraet, installationsweg } from '../src/website/installationswege.js';
test('Samsung wird nicht wegen Chrome-Unterstring als Chrome erkannt',()=>{
  assert.deepEqual(erkenneGeraet({userAgent:'Android Chrome/100 Safari/500 SamsungBrowser/27'}),{system:'android',browser:'samsung'});
});
test('iPad-Desktopkennung und Edge-/Firefox-Varianten bleiben richtig',()=>{
  assert.deepEqual(erkenneGeraet({userAgent:'Macintosh Safari/600',maxTouchPoints:5}),{system:'ios',browser:'safari'});
  assert.deepEqual(erkenneGeraet({userAgent:'Windows Chrome/100 Edg/140'}),{system:'windows',browser:'edge'});
  assert.deepEqual(erkenneGeraet({userAgent:'iPhone Safari/600 FxiOS/100'}),{system:'ios',browser:'firefox'});
});
test('Alle Auswahlkombinationen liefern eine Anleitung ohne Installationsversprechen',()=>{
  for(const os of ['ios','android','mac','windows','andere']) for(const browser of ['safari','chrome','samsung','firefox','edge','andere']) {
    const w=installationsweg(os,browser);assert.ok(w.titel);assert.ok(w.schritte.length>=3);assert.ok(w.hinweis);
  }
  assert.match(installationsweg('android','samsung').schritte.join(' '),/Startbildschirm/);
  assert.match(installationsweg('mac','safari').schritte.join(' '),/Dock/);
  assert.match(installationsweg('android','firefox').schritte.join(' '),/Installieren/);
});
