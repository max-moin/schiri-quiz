import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const basisUrl = "https://www.schiri-loebtauer-kickers.com";
const seiten = {
  "index.html": `${basisUrl}/`,
  "termine.html": `${basisUrl}/termine.html`,
  "vorlagen.html": `${basisUrl}/vorlagen.html`,
  "informationen.html": `${basisUrl}/informationen.html`,
  "hilfe.html": `${basisUrl}/hilfe.html`,
  "installieren.html": `${basisUrl}/installieren.html`,
  "schiri-werden.html": `${basisUrl}/schiri-werden.html`,
  "impressum.html": `${basisUrl}/impressum.html`,
  "datenschutz.html": `${basisUrl}/datenschutz.html`,
  "nutzungsbedingungen.html": `${basisUrl}/nutzungsbedingungen.html`,
};

const lesen = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), "utf8");

test("öffentliche Seiten nennen genau ihre kanonische neue Domain", () => {
  for (const [datei, url] of Object.entries(seiten)) {
    const html = lesen(datei);
    assert.match(html, new RegExp(`<link rel="canonical" href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), datei);
  }
});

test("Startseite liefert Suchmaschinen und geteilten Links eindeutige Vereinsdaten", () => {
  const html = lesen("index.html");
  assert.match(html, /<title>Schiedsrichter FV Löbtauer Kickers Dresden \| Quiz &amp; Termine<\/title>/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /type="application\/ld\+json"/);
  assert.match(html, /"@type": "WebSite"/);
  assert.match(html, /"@type": "SportsOrganization"/);
  assert.match(html, /"alternateName": "Schiri Löbtauer Kickers"/);
});

test("robots.txt verweist auf eine Sitemap der kanonischen Domain", () => {
  const robots = lesen("robots.txt");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, new RegExp(`Sitemap: ${basisUrl}/sitemap\\.xml`));
});

test("Sitemap enthält nur die festgelegten öffentlichen kanonischen Seiten", () => {
  const sitemap = lesen("sitemap.xml");
  for (const url of Object.values(seiten)) assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  assert.doesNotMatch(sitemap, /obmann|meine-|duell|frage-vorschlagen|regeluebersicht|spesenrechner/);
});
