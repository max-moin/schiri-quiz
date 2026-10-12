import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SEITENHILFE, EINRICHTUNG, tourSchritte, leseTour, leseFortschritt, speichereFortschritt } from '../src/website/hilfe-inhalte.js';
const speicher = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k,v) => m.set(k,v) }; };
test('Einstieg erklärt Funktionen ausführlich, in stabiler Reihenfolge', () => {
  const s = tourSchritte('einstieg', 'hilfe.html');
  assert.equal(s.length, 18);
  assert.equal(s[0].seite, 'index.html');
  assert.equal(s.at(-1).seite, 'einstellungen.html');
  assert.equal(new Set(s.map(x => `${x.seite}:${x.id}`)).size, s.length);
  assert.ok(s.filter(x => x.seite === 'termine.html').length >= 3);
});
test('Seitentouren verweisen ausschließlich auf vorhandene lokale Seiten', () => {
  for (const [datei, hilfe] of Object.entries(SEITENHILFE)) {
    assert.ok(existsSync(new URL(`../${datei}`, import.meta.url)), datei);
    for (const s of tourSchritte('seite', datei)) {
      assert.equal(s.seite, datei); assert.ok(s.text.length > 40); assert.ok(s.ziel);
    }
    assert.ok(hilfe.titel);
  }
});
test('Mitteilungshilfe trennt Gerät, Themen, Geräteverwaltung und Terminausnahmen', () => {
  const s = tourSchritte('seite', 'mitteilungen.html');
  assert.deepEqual(s.map(x => x.id), ['push', 'wahl', 'geraete', 'termine']);
  assert.match(s[0].text, /nicht schon die automatischen Erinnerungen/);
  assert.match(s[1].text, /Auswahl speichern/);
  assert.match(s[2].text, /Nichtstörmodus/);
  assert.match(s[3].text, /Zulassen allein/);
  const html = readFileSync(new URL('../mitteilungen.html', import.meta.url), 'utf8');
  for (const schritt of s) {
    const anker = schritt.ziel.split(',')[0].trim();
    assert.ok(anker.startsWith('#') ? html.includes(`id="${anker.slice(1)}"`)
      : new RegExp(`class="[^"]*\\b${anker.slice(1)}\\b`).test(html), anker);
    assert.match(schritt.ziel, /#einstellungen-zugang/);
  }
});
test('Einrichtungsstand bleibt kontogetrennt und enthält nur bekannte Zustände', () => {
  const storage = speicher();
  assert.equal(speichereFortschritt(storage, 'a', { bestand:'angesehen', push:'ausgelassen', fremd:'angesehen', daten:'falsch' }), true);
  assert.deepEqual(leseFortschritt(storage, 'a'), { bestand:'angesehen', push:'ausgelassen' });
  assert.deepEqual(leseFortschritt(storage, 'b'), {});
  assert.deepEqual(leseFortschritt(storage, null), {});
});
test('Blockierter und defekter Browserspeicher blockiert keine Hilfe', () => {
  assert.deepEqual(leseFortschritt(null, 'a'), {});
  assert.equal(speichereFortschritt(null, 'a', {}), false);
  assert.equal(leseTour(null), null);
  assert.deepEqual(leseFortschritt({getItem: () => '['}, 'a'), {});
  assert.deepEqual(leseFortschritt({getItem: () => '[]'}, 'a'), {});
});
test('Tourzustand validiert Ziel, Zeitfenster und Schrittgrenzen', () => {
  const storage = speicher(); const jetzt = 10000000;
  const set = t => storage.setItem('schiriTour.v1', JSON.stringify(t));
  const ok = {art:'einstieg',seite:'hilfe.html',index:3,zeit:jetzt,konto:'a'};
  set(ok); assert.deepEqual(leseTour(storage,jetzt),ok);
  for (const patch of [{art:'extern'},{seite:'https://evil.example'},{index:-1},{index:18},{index:1.5},{zeit:jetzt-1800001},{zeit:jetzt+1}]) {
    set({...ok,...patch}); assert.equal(leseTour(storage,jetzt),null);
  }
});
test('Checkliste verlangt weder Kontaktdaten noch Push-Erlaubnis', () => {
  assert.equal(EINRICHTUNG.length,6);
  assert.match(EINRICHTUNG.find(x => x.id === 'push').titel,/optional/);
  assert.ok(!EINRICHTUNG.some(x => /Bank|bestätigen.*Mail/.test(x.titel)));
});
test('Tour versendet keine Fachaktionen und hat beschriftete Tastatursteuerung', () => {
  const js = readFileSync(new URL('../src/ui/seitenhilfe.js', import.meta.url),'utf8');
  assert.doesNotMatch(js,/\bfetch\s*\(|\.rpc\s*\(|\.submit\s*\(|\.click\s*\(/);
  assert.match(js,/Vorheriger Schritt/); assert.match(js,/Nächster Schritt/);
  assert.match(js,/Tour beenden/); assert.match(js,/addEventListener\('cancel'/);
  assert.match(js,/Ungespeicherte Eingaben/);
});
