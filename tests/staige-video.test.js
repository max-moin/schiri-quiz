import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const quelle = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function hilfen() {
  const ctx = vm.createContext({ URL });
  vm.runInContext(quelle("src/core/quiz-utils.js"), ctx);
  return ctx.SchiriQuizUtils;
}
test("Staige-Links, Embed-Adressen und Highlightfassung erkennen", () => {
  const { extrahiereStaigeVideo: lesen, staigeEmbedUrl } = hilfen();
  const video = lesen("https://staige.tv/video/566569/90");
  assert.equal(video.id, "566569");
  assert.equal(video.start, 90);
  assert.equal(staigeEmbedUrl(video, null), "https://staige.tv/embed/video/566569/90");
  assert.equal(staigeEmbedUrl(video, 725), "https://staige.tv/embed/video/566569/725");
  const h = lesen("https://staige.tv/embed/video/566569/highlight");
  assert.equal(h.highlight, true);
  assert.equal(staigeEmbedUrl(h, 90), "https://staige.tv/embed/video/566569/highlight");
});
test("Staige akzeptiert keine fremden Hosts, Scripts oder zusätzliche Pfade", () => {
  const { extrahiereStaigeVideo: lesen } = hilfen();
  for (const s of ["http://staige.tv/video/566569", "https://staige.tv.evil.example/video/566569", "https://user@staige.tv/video/566569", "https://staige.tv:444/video/566569", "https://evil.example/?next=https://staige.tv/video/566569", "javascript:alert(1)", "<iframe src='https://staige.tv/video/566569'></iframe>", "https://staige.tv/video/566569/10/20", "https://staige.tv/video/566569/99999999999999999"]) assert.equal(lesen(s), null, s);
});

// Kleine echte DOM-Verhaltensattrappe, kein bloßer Quelltexttest.
function playerUmgebung() {
  const ids = new Map(), netz = [], timers = new Map(); let timerID = 0;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.attrs = {}; this.hidden = false; this.classList = { add() {}, remove() {} }; }
    append(...k) { for (const c of k) { this.children.push(c); c.parent = this; } }
    appendChild(c) { this.append(c); }
    replaceChildren(...k) { this.children = []; this.append(...k); }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, f) { this.listeners[k] = f; }
    click() { this.listeners.click?.({ target: this }); }
    focus() { this.focused = true; }
    remove() { this.removed = true; }
    set src(url) { this.attrs.src = url; netz.push(url); }
  }
  for (const id of ["video-gross-overlay", "video-gross-spieler-halter", "video-gross-schliessen-button"]) ids.set(id, new Element("div"));
  ids.get("video-gross-overlay").hidden = true;
  const events = {};
  const document = { getElementById: id => ids.get(id), createElement: tag => new Element(tag), addEventListener: (k, f) => { events[k] = f; }, contains: () => true, body: new Element("body") };
  const ctx = vm.createContext({ URL, document, window: { setTimeout: f => { timers.set(++timerID, f); return timerID; }, clearTimeout: id => timers.delete(id) } });
  vm.runInContext(quelle("src/core/quiz-utils.js"), ctx);
  vm.runInContext(quelle("src/features/video-player.js"), ctx);
  return { bauen: ctx.SchiriQuizVideoPlayer.baueVideoEinbettungModal, ids, netz, timers, events };
}
const finden = (e, tag) => e.tag === tag ? e : e.children.map(c => finden(c, tag)).find(Boolean);
test("kein Staige-Netzaufruf vor Klick; offizieller Player, Wiederholung und X räumen auf", () => {
  const u = playerUmgebung();
  const karte = u.bauen("https://staige.tv/video/566569", 725, 750, true, "Ein Foul");
  assert.equal(u.netz.length, 0);
  assert.match(karte.children[1].textContent, /12:30.*nicht automatisch/);
  const start = finden(karte, "button"); start.click();
  assert.equal(u.netz[0], "https://staige.tv/embed/video/566569/725");
  const halter = u.ids.get("video-gross-spieler-halter");
  const iframe = finden(halter, "iframe");
  assert.equal(iframe.title, "Staige-Video zur Regelfrage");
  finden(halter, "button").click(); assert.equal(u.netz.length, 2);
  u.ids.get("video-gross-schliessen-button").click();
  assert.equal(iframe.removed, true); assert.equal(u.timers.size, 0);
  assert.equal(u.ids.get("video-gross-overlay").hidden, true);
  assert.equal(start.focused, true);
});
test("Highlight-Startbeschränkung und manuelles Ende werden nicht versteckt", () => {
  const u = playerUmgebung();
  const karte = u.bauen("https://staige.tv/embed/video/566569/highlight", 90, 110, false);
  assert.match(karte.children[1].textContent, /1:30.*selbst ansteuern/);
  assert.match(karte.children[1].textContent, /1:50.*selbst pausieren/);
});
test("tatsächlich gespeicherte Dobritz-Frage rendert Zeitfenster und direkten Staige-Zugang", () => {
  const u = playerUmgebung();
  const karte = u.bauen("https://staige.tv/embed/video/566569", 1941, 2061, false);
  assert.match(karte.children[1].textContent, /32:21 bis 34:21/);
  const link = finden(karte, "a");
  assert.equal(link.href, "https://staige.tv/embed/video/566569/1941");
  assert.equal(link.rel, "noopener noreferrer");
  finden(karte, "button").click();
  assert.equal(u.netz[0], "https://staige.tv/embed/video/566569/1941");
});
test("nicht erkannte Video-Adresse verschwindet nicht mehr lautlos", () => {
  const u = playerUmgebung();
  assert.match(u.bauen("https://example.invalid/123", 0, null, false).textContent, /Video konnte nicht erkannt/);
  assert.equal(u.bauen(null, null, null, false), null);
});
test("Escape und Wechsel zu anderem Video beenden die alte Staige-Sitzung", () => {
  const u = playerUmgebung();
  const a = u.bauen("https://staige.tv/video/566569", 0, null, false);
  finden(a, "button").click();
  const alt = finden(u.ids.get("video-gross-spieler-halter"), "iframe");
  const b = u.bauen("https://staige.tv/video/566570", 0, null, false);
  finden(b, "button").click(); assert.equal(alt.removed, true);
  u.events.keydown({ key: "Escape" });
  assert.equal(u.ids.get("video-gross-overlay").hidden, true);
  assert.equal(u.timers.size, 0);
});
