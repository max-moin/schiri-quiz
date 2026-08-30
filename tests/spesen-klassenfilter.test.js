import assert from "node:assert/strict";
import test from "node:test";

import { ALTERSKLASSEN } from "../verein.config.js";
import {
  OFFEN,
  gefilterteKlassen,
  klasseEinordnen,
} from "../src/website/spesen-klassenfilter.js";

/* ============================================================
   Grobfilter fuer die Altersklassen des Spesenrechners
   ============================================================
   Max am 30.08.2026: "Dass du halt schneller selektieren kannst: okay,
   ich moechte ein Meisterschaftsspiel, ich moechte maennlich oder
   weiblich, erwachsen oder nicht erwachsen - und dann halt die Jugend."

   Und im selben Atemzug: "obwohl, na ja, wenn man direkt zugefahren
   ist, ist auch halt besser." Die Zusage, an der der Entwurf haengt,
   ist deshalb nicht "der Filter kuerzt", sondern "der Filter versteckt
   nichts, ohne dass man es zurueckdrehen kann". Genau darum drehen sich
   die letzten drei Tests.
   ============================================================ */

test("die Namen aus der Vereinskonfiguration werden richtig eingeordnet", () => {
  const erwartet = {
    "Herren": ["m", "erwachsen"],
    "Frauen": ["w", "erwachsen"],
    "A-Junioren": ["m", "jugend"],
    "B-Junioren": ["m", "jugend"],
    "C-Junioren": ["m", "jugend"],
    "D- bis G-Jugend": [OFFEN, "jugend"],
    "B-Juniorinnen": ["w", "jugend"],
    "C-Juniorinnen": ["w", "jugend"],
    "Senioren / Altherren": ["m", "erwachsen"],
    "Freizeitsport": [OFFEN, OFFEN],
    "Sonderfunktionen": [OFFEN, OFFEN],
  };
  // Erst gegen die echte Liste: waechst sie um eine Klasse, faellt hier
  // auf, dass fuer die noch niemand entschieden hat, wo sie hingehoert.
  assert.deepEqual(ALTERSKLASSEN.map((g) => g.name), Object.keys(erwartet));

  for (const [name, [geschlecht, stufe]] of Object.entries(erwartet)) {
    assert.deepEqual(klasseEinordnen(name), { geschlecht, stufe }, name);
  }
});

test("Juniorinnen werden nicht als maennlich gelesen", () => {
  // Die Falle, wegen der zuerst auf "weiblich" geprueft wird: wer nur
  // auf den Stamm "junior" testet, sortiert die B-Juniorinnen unter
  // "maennlich" ein - und dann findet sie unter "weiblich" niemand.
  assert.equal(klasseEinordnen("B-Juniorinnen").geschlecht, "w");
  assert.equal(klasseEinordnen("C-Juniorinnen").geschlecht, "w");
  // Gegenprobe in die andere Richtung: "Altherren" enthaelt "herren",
  // ist aber trotzdem keine Jugend.
  assert.equal(klasseEinordnen("Senioren / Altherren").stufe, "erwachsen");
});

test("der Filter kuerzt die Liste, ohne die Indizes zu verschieben", () => {
  const { eintraege, ausweich } = gefilterteKlassen(
    ALTERSKLASSEN, { geschlecht: "m", stufe: "jugend" });
  assert.equal(ausweich, false);

  const namen = eintraege.map((e) => e.gruppe.name);
  for (const jugend of ["A-Junioren", "B-Junioren", "C-Junioren", "D- bis G-Jugend"]) {
    assert.ok(namen.includes(jugend), `${jugend} fehlt in der gekuerzten Liste`);
  }
  for (const erwachsen of ["Herren", "Frauen", "Senioren / Altherren"]) {
    assert.ok(!namen.includes(erwachsen), `${erwachsen} steht noch in der Jugendliste`);
  }
  assert.ok(eintraege.length < ALTERSKLASSEN.length, "der Filter kuerzt gar nichts");

  /* Der Index ist der Platz in der UNGEFILTERTEN Liste. Waere es die
     Position in der gekuerzten, zeigte der gespeicherte Wert des
     Auswahlfeldes nach jedem Filterwechsel auf eine andere Klasse. */
  for (const eintrag of eintraege) {
    assert.equal(ALTERSKLASSEN[eintrag.index], eintrag.gruppe,
      `Index ${eintrag.index} zeigt auf eine andere Altersklasse`);
  }
});

test("ohne Filter steht die volle Liste unveraendert da", () => {
  // Die Abkuerzung darf kein Pflichtweg sein: wer seine Klasse kennt,
  // waehlt sie im ersten Schritt - so wie vor dem 30.08.2026.
  for (const filter of [{}, { geschlecht: null, stufe: null }]) {
    const { eintraege, ausweich } = gefilterteKlassen(ALTERSKLASSEN, filter);
    assert.equal(ausweich, false);
    assert.deepEqual(eintraege.map((e) => e.index), ALTERSKLASSEN.map((_, i) => i));
    assert.deepEqual(eintraege.map((e) => e.gruppe.name), ALTERSKLASSEN.map((g) => g.name));
  }
});

test("was sich nicht einordnen laesst, wird nie weggefiltert", () => {
  /* Die Altersklassen kommen zur Laufzeit aus der vom Obmann
     veroeffentlichten Konfiguration. Ein Name, den diese Datei nicht
     kennt, darf nicht unerreichbar werden - sonst versteckt ein Filter
     etwas, das er gar nicht verstanden hat. */
  const liste = [{ name: "Herren" }, { name: "Beach-Soccer-Turnierserie" }];
  assert.deepEqual(klasseEinordnen("Beach-Soccer-Turnierserie"),
    { geschlecht: OFFEN, stufe: OFFEN });

  for (const geschlecht of [null, "m", "w"]) {
    for (const stufe of [null, "erwachsen", "jugend"]) {
      const { eintraege } = gefilterteKlassen(liste, { geschlecht, stufe });
      assert.ok(eintraege.some((e) => e.gruppe.name === "Beach-Soccer-Turnierserie"),
        `bei ${geschlecht} / ${stufe} ist der unbekannte Eintrag verschwunden`);
    }
  }
});

test("ein Filter ohne Treffer laesst die volle Liste stehen", () => {
  /* Eine leere Auswahlliste waere eine Sackgasse: das Feld zeigt nichts
     an, der Rechner haette keine Liga und die Quittung bliebe leer -
     ohne dass man saehe, woran es liegt. Lieber wieder alles zeigen und
     es danebenschreiben (das macht "ausweich"). */
  const liste = [{ name: "Herren" }, { name: "Senioren / Altherren" }];
  const { eintraege, ausweich } = gefilterteKlassen(liste, { geschlecht: "w" });
  assert.equal(ausweich, true);
  assert.equal(eintraege.length, liste.length);
});
