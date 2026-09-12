import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BILDER_STANDARD } from "../src/website/content-defaults.js";
import {
  BILD_MOTIVE,
  INHALTSBEREICHE,
  normalisiereWebsiteInhalt,
  validiereWebsiteInhalt,
} from "../src/website/content-config.js";
import { waehleBildmotiv } from "../src/website/bild-motive.js";
import { bildPfad, pruefeBilddatei, BILD_HOECHSTGROESSE } from "../src/admin/bilder-editor.js";

const editorQuelle = readFileSync(new URL("../src/admin/bilder-editor.js", import.meta.url), "utf8");

/* ============================================================
   Bilder als vierter Redaktionsbereich (12.09.2026)
   ============================================================
   Max soll die Motive der Startseite selbst austauschen koennen, statt
   dass sie in der ausgelieferten verein.config.js stehen. Die Tests hier
   sichern die drei Stellen, an denen das teuer schiefgehen kann: der
   Bereich muss im Baukasten registriert sein, aus der Datenbank darf nur
   eine https-Bildadresse ins HTML wandern, und ein neues Bild darf nie
   den Pfad des alten belegen.
   ============================================================ */

test("Bilder sind ein regulaerer Bereich des Redaktions-Baukastens", () => {
  assert.ok(INHALTSBEREICHE.includes("bilder"));
  assert.deepEqual(Object.keys(BILDER_STANDARD.motive), [...BILD_MOTIVE]);
  // Der Ausgangsstand muss selbst veroeffentlichbar sein, sonst koennte
  // man den Bereich nie leeren.
  assert.deepEqual(validiereWebsiteInhalt("bilder", BILDER_STANDARD), []);
});

test("der Normalisierer laesst nur die bekannten Motive mit ihren zwei Feldern durch", () => {
  const ergebnis = normalisiereWebsiteInhalt("bilder", {
    motive: {
      aufmacher: {
        url: "https://ablage.example/bild-1.jpg",
        alt: "Anstoss im Stadion",
        onerror: "alert(1)",
        breite: 4000,
      },
      erfundenesMotiv: { url: "https://ablage.example/fremd.jpg" },
    },
    schemaVersion: 99,
  }, BILDER_STANDARD);

  assert.deepEqual(Object.keys(ergebnis).sort(), ["motive", "schemaVersion"]);
  assert.equal(ergebnis.schemaVersion, 1);
  assert.deepEqual(Object.keys(ergebnis.motive), [...BILD_MOTIVE]);
  assert.deepEqual(Object.keys(ergebnis.motive.aufmacher).sort(), ["alt", "url"]);
  assert.equal(ergebnis.motive.aufmacher.url, "https://ablage.example/bild-1.jpg");
  assert.equal(ergebnis.motive.quiz.url, "");
});

test("ein zu langer Alternativtext wird gekappt statt abgelehnt", () => {
  const ergebnis = normalisiereWebsiteInhalt("bilder", {
    motive: { quiz: { url: "", alt: "x".repeat(5000) } },
  }, BILDER_STANDARD);
  assert.equal(ergebnis.motive.quiz.alt.length, 300);
});

test("eine Bildadresse ohne https wird verworfen und vorher gemeldet", () => {
  for (const boese of ["javascript:alert(1)", "http://ablage.example/bild.jpg", "data:image/png;base64,AAAA"]) {
    const entwurf = { motive: { ...BILDER_STANDARD.motive, aufmacher: { url: boese, alt: "" } } };
    assert.equal(
      normalisiereWebsiteInhalt("bilder", entwurf, BILDER_STANDARD).motive.aufmacher.url,
      "",
      `${boese} haette nicht durchkommen duerfen`,
    );
    const fehler = validiereWebsiteInhalt("bilder", entwurf);
    assert.ok(fehler.some((meldung) => meldung.includes("https://")), `${boese} wurde nicht gemeldet`);
  }
});

test("die Startseite nimmt veroeffentlicht vor Foto vor Ersatzgrafik", () => {
  const eintrag = { foto: "https://foto.example/aus-der-konfiguration.jpg", ersatz: "bilder/motiv-quiz.svg" };

  const veroeffentlicht = waehleBildmotiv(eintrag, { url: "https://ablage.example/neu.jpg", alt: "" });
  assert.equal(veroeffentlicht.quelle, "https://ablage.example/neu.jpg");

  const ohneVeroeffentlichung = waehleBildmotiv(eintrag, { url: "", alt: "" });
  assert.equal(ohneVeroeffentlichung.quelle, eintrag.foto);

  const nurErsatz = waehleBildmotiv({ foto: null, ersatz: "bilder/motiv-quiz.svg" }, undefined);
  assert.equal(nurErsatz.quelle, "");
  assert.equal(nurErsatz.ersatz, "bilder/motiv-quiz.svg");

  // Ohne gesetzten Alternativtext bleibt das alt="" der Seite stehen.
  assert.equal(veroeffentlicht.alt, "");
  assert.equal(waehleBildmotiv(eintrag, { url: "", alt: " Anstoss " }).alt, "Anstoss");
});

test("jedes hochgeladene Bild bekommt einen eigenen Pfad unter dem Seitenschluessel", () => {
  const datei = { type: "image/jpeg", size: 1000, name: "Mein Bild.JPG" };
  const erster = bildPfad({ seitenschluessel: "loebtauer-kickers", motiv: "aufmacher", datei, jetzt: 1_757_000_000_000 });
  const zweiter = bildPfad({ seitenschluessel: "loebtauer-kickers", motiv: "aufmacher", datei, jetzt: 1_757_000_009_999 });

  assert.match(erster, /^loebtauer-kickers\/aufmacher-\d{10,}\.jpg$/);
  assert.notEqual(erster, zweiter, "zwei Uploads duerfen nie denselben Pfad belegen");
  // Erster Abschnitt = Seitenschluessel: daran haengt das Schreibrecht.
  assert.equal(erster.split("/")[0], "loebtauer-kickers");
  assert.equal(bildPfad({ seitenschluessel: "x", motiv: "quiz", datei: { type: "image/webp" } }).split(".").pop(), "webp");

  // Und der Editor baut den Pfad nicht irgendwo daneben zusammen.
  assert.match(editorQuelle, /const pfad = bildPfad\(/);
  assert.match(editorQuelle, /\.upload\(pfad, datei, \{ upsert: false \}\)/);
  assert.doesNotMatch(editorQuelle, /upsert: true/);
});

test("Dateityp und Groesse werden im Browser in Worten beanstandet", () => {
  assert.equal(pruefeBilddatei({ type: "image/png", size: 500_000 }), "");
  assert.match(pruefeBilddatei({ type: "image/gif", size: 1000 }), /JPG, PNG und WebP/);
  const zuGross = pruefeBilddatei({ type: "image/jpeg", size: BILD_HOECHSTGROESSE + 1 });
  assert.match(zuGross, /3 MB/);
  assert.match(zuGross, /MB groß/);
});

test("nur Seiten mit Motiven fragen den veroeffentlichten Bilderstand ab", () => {
  const seite = readFileSync(new URL("../seite.js", import.meta.url), "utf8");
  assert.match(seite, /if \(document\.querySelector\("img\[data-bild\]"\)\) \{/);
  assert.match(seite, /bereich: "bilder"/);
  assert.match(seite, /ladeWebsiteInhalt/);
  assert.match(seite, /waehleBildmotiv/);
});

test("der Obmann-Bereich bietet Bilder als eigenen Reiter an", () => {
  const html = readFileSync(new URL("../obmann.html", import.meta.url), "utf8");
  assert.match(html, /data-bereich-knopf="bilder"/);
  assert.match(html, /data-admin-bereich="bilder"/);
  const page = readFileSync(new URL("../src/admin/obmann-page.js", import.meta.url), "utf8");
  assert.match(page, /erstelleBilderEditor/);
  // Gestaltung gehoert in stil/obmann.css, nicht in style.css.
  const stil = readFileSync(new URL("../stil/obmann.css", import.meta.url), "utf8");
  assert.match(stil, /\.admin-bild-zeile/);
});
