// ============================================================
//  entscheiden.html - der Entscheidungs-Modus
// ============================================================
//  Max am 29.08.2026: "dass du halt nur diese gelben Karte- und roten
//  Karte-Buttons hast, dann direkt indirekter Freistoss, sonstiges
//  Spielfortsetzung."
//
//  ------------------------------------------------------------
//  Variante A: alles auf einem Bild
//  ------------------------------------------------------------
//  Ein Klick je Achse, ein Abschicken. Die Schritt-fuer-Schritt-Fassung
//  fuehlt sich nach Formular an und braucht dreimal so viele Klicks -
//  auf dem Platz entscheidet man auch nicht in drei Dialogseiten.
//
//  ------------------------------------------------------------
//  Das Bild ist die Aufgabe, nicht die Verzierung
//  ------------------------------------------------------------
//  Max hat meinen ersten Entwurf ("erstmal nur Text") ausdruecklich
//  verworfen: "Ich wollte ja eigentlich gerade nicht, dass das
//  geschrieben ist, sondern dass du ein Bild hast, das du schnell
//  erkennen musst." Der Beschreibungstext steht trotzdem im Markup -
//  als Alternativtext und als Ersatz, wenn das Bild nicht laedt. Er ist
//  die Rueckfallebene, nicht die Hauptsache.
//
//  ------------------------------------------------------------
//  Die Auswertung passiert auf dem Server
//  ------------------------------------------------------------
//  Diese Datei kennt die richtige Antwort erst, nachdem sie geantwortet
//  hat. Absicht: die Loesung kommt aus szenario_antwort_pruefen mit dem
//  Ergebnis zurueck, nicht vorher mit dem Bild.
// ============================================================

import { DATENBANK } from "../../verein.config.js";
import { erstelleSzenarioZugriff } from "./szenario-zugriff.js";
import {
  FORTSETZUNGEN, STRAFEN, ROLLEN,
  fortsetzungLabel, strafeLabel, brauchtRichtung, mannschaftLabel,
} from "./entscheidungs-optionen.js";

const bereich = document.getElementById("entscheidenBereich");
const zugriff = erstelleSzenarioZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;

const person = () => anmeldung?.lesen() || null;
const sicher = (t) => String(t ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// Der laufende Stand. Bewusst ein einziges Objekt: die Seite zeichnet
// sich aus ihm neu, statt einzelne Knoepfe von Hand umzufaerben.
let szene = null;
let letzteId = null;
let wahl = leereWahl();

function leereWahl() {
  return { fortsetzung: null, fortsetzungFuer: null, strafe: null, strafeFuer: null, zusatz: {} };
}

// ---------- Bausteine ----------

function trikot(seite) {
  const farbe = seite === "heim" ? szene?.trikot_heim : szene?.trikot_gast;
  return `<span class="trikot" style="--trikot:${sicher(farbe || "#888")}"></span>`;
}

function mannschaftsWahl(name, gewaehlt, beschriftung) {
  return `
    <fieldset class="ent-richtung">
      <legend>${beschriftung}</legend>
      <div class="ent-zeile zwei">
        ${["heim", "gast"].map((s) => `
          <button class="ent-knopf mannschaft${gewaehlt === s ? " an" : ""}" type="button"
                  data-feld="${name}" data-wert="${s}" aria-pressed="${gewaehlt === s}">
            ${trikot(s)}<span>${mannschaftLabel(s)}</span>
          </button>`).join("")}
      </div>
    </fieldset>`;
}

function zusatzfragenMarkup() {
  const fragen = Array.isArray(szene?.zusatzfragen) ? szene.zusatzfragen : [];
  if (!fragen.length) return "";
  return fragen.map((f) => `
    <fieldset class="ent-block">
      <legend>${sicher(f.frage_text)}</legend>
      <div class="ent-zeile zusatz">
        ${(f.optionen || []).map((o) => `
          <button class="ent-knopf text${wahl.zusatz[f.id] === o.schluessel ? " an" : ""}"
                  type="button" data-zusatz="${sicher(f.id)}" data-wert="${sicher(o.schluessel)}"
                  aria-pressed="${wahl.zusatz[f.id] === o.schluessel}">
            ${sicher(o.label)}
          </button>`).join("")}
      </div>
    </fieldset>`).join("");
}

function bildMarkup() {
  const text = sicher(szene.beschreibung);
  if (!szene.bild_base64) {
    // Kein Bild: dann traegt der Text die Szene allein. Das ist der
    // Notfall, nicht der Normalfall - aktive Szenarien haben eins.
    return `<p class="ent-szene-text">${text}</p>`;
  }
  return `
    <figure class="ent-bild">
      <img src="data:${sicher(szene.bild_mime)};base64,${sicher(szene.bild_base64)}"
           alt="${text}" />
      <figcaption class="ent-bild-text">${text}</figcaption>
    </figure>`;
}

// ---------- Frageansicht ----------

function zeichneFrage() {
  const bereitsGespielt = szene.schon_gespielt;

  bereich.innerHTML = `
    <div class="ent-kopf">
      <a class="ent-zurueck" href="modus.html">← Modus wechseln</a>
      ${bereitsGespielt ? '<span class="ent-hinweis-pille">Schon gespielt</span>' : ""}
    </div>

    ${bildMarkup()}

    <form class="ent-form" novalidate>
      <fieldset class="ent-block">
        <legend>Wie geht es weiter?</legend>
        <div class="ent-zeile raster">
          ${FORTSETZUNGEN.map((f) => `
            <button class="ent-knopf icon${wahl.fortsetzung === f.schluessel ? " an" : ""}"
                    type="button" data-feld="fortsetzung" data-wert="${f.schluessel}"
                    aria-pressed="${wahl.fortsetzung === f.schluessel}">
              ${f.icon}<span>${f.label}</span>
            </button>`).join("")}
        </div>
      </fieldset>

      ${brauchtRichtung(wahl.fortsetzung)
        ? mannschaftsWahl("fortsetzungFuer", wahl.fortsetzungFuer, "Für welche Mannschaft?")
        : ""}

      <fieldset class="ent-block">
        <legend>Persönliche Strafe?</legend>
        <div class="ent-zeile vier">
          ${STRAFEN.map((s) => `
            <button class="ent-knopf karte-knopf${wahl.strafe === s.schluessel ? " an" : ""}"
                    type="button" data-feld="strafe" data-wert="${s.schluessel}"
                    aria-pressed="${wahl.strafe === s.schluessel}">
              <span class="karte ${s.art}"></span><span>${s.label}</span>
            </button>`).join("")}
        </div>
      </fieldset>

      ${wahl.strafe && wahl.strafe !== "keine"
        ? mannschaftsWahl("strafeFuer", wahl.strafeFuer, "Wen trifft sie?")
        : ""}

      ${zusatzfragenMarkup()}

      <button class="ent-senden" type="submit" ${vollstaendig() ? "" : "disabled"}>
        Entscheidung abgeben
      </button>
      <p class="ent-fusshinweis">
        ${vollstaendig()
          ? "Beide Entscheidungen zählen einzeln."
          : "Wähle die Spielfortsetzung und die persönliche Strafe."}
      </p>
    </form>`;

  bereich.querySelectorAll("[data-feld]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      const feld = knopf.dataset.feld;
      wahl[feld] = knopf.dataset.wert;
      // Eine neue Spielfortsetzung macht die alte Richtung ungueltig,
      // eine neue Strafe den alten Betroffenen. Ohne dieses Aufraeumen
      // schickt die Seite eine Richtung mit, die niemand mehr gewaehlt
      // hat - und der Server bewertet sie.
      if (feld === "fortsetzung") wahl.fortsetzungFuer = null;
      if (feld === "strafe") wahl.strafeFuer = null;
      zeichneFrage();
    });
  });

  bereich.querySelectorAll("[data-zusatz]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      wahl.zusatz[knopf.dataset.zusatz] = knopf.dataset.wert;
      zeichneFrage();
    });
  });

  bereich.querySelector(".ent-form").addEventListener("submit", (e) => {
    e.preventDefault();
    schickeAb();
  });
}

function vollstaendig() {
  if (!wahl.fortsetzung || !wahl.strafe) return false;
  if (brauchtRichtung(wahl.fortsetzung) && !wahl.fortsetzungFuer) return false;
  if (wahl.strafe !== "keine" && !wahl.strafeFuer) return false;
  const fragen = Array.isArray(szene?.zusatzfragen) ? szene.zusatzfragen : [];
  return fragen.every((f) => wahl.zusatz[f.id]);
}

// ---------- Ergebnisansicht ----------

function zeile(beschriftung, richtig, deins, loesung) {
  return `
    <li class="ent-zeile-ergebnis ${richtig ? "gut" : "schlecht"}">
      <span class="ent-marke" aria-hidden="true">${richtig ? "✓" : "✗"}</span>
      <span class="ent-was">${beschriftung}</span>
      <span class="ent-wert">
        ${sicher(deins)}
        ${richtig ? "" : `<em>richtig: ${sicher(loesung)}</em>`}
      </span>
    </li>`;
}

function zeichneErgebnis(e) {
  const l = e.loesung || {};
  const fortsetzungOk = e.fortsetzung_richtig && e.richtung_richtig;
  const strafeOk = e.strafe_richtig && e.strafe_ziel_richtig;

  const deinsFortsetzung = fortsetzungLabel(wahl.fortsetzung)
    + (wahl.fortsetzungFuer ? ` für ${mannschaftLabel(wahl.fortsetzungFuer)}` : "");
  const loesungFortsetzung = fortsetzungLabel(l.spielfortsetzung)
    + (l.fortsetzung_fuer ? ` für ${mannschaftLabel(l.fortsetzung_fuer)}` : "");
  const deinsStrafe = strafeLabel(wahl.strafe)
    + (wahl.strafeFuer ? ` (${mannschaftLabel(wahl.strafeFuer)})` : "");
  const loesungStrafe = strafeLabel(l.persoenliche_strafe)
    + (l.strafe_fuer_mannschaft ? ` (${mannschaftLabel(l.strafe_fuer_mannschaft)}` +
        (l.strafe_fuer_rolle ? `, ${ROLLEN[l.strafe_fuer_rolle] || l.strafe_fuer_rolle}` : "") +
        (l.strafe_rueckennummer ? `, Nr. ${l.strafe_rueckennummer}` : "") + ")" : "");

  const zusatz = Array.isArray(e.zusatz_ergebnis) ? e.zusatz_ergebnis : [];

  const ueberschrift = {
    komplett: "Komplett richtig",
    teilweise: "Halb richtig",
    falsch: "Daneben",
  }[e.bewertung] || "Ergebnis";

  bereich.innerHTML = `
    <div class="ent-ergebnis ${sicher(e.bewertung)}">
      <div class="ent-ergebnis-kopf">
        <h2>${ueberschrift}</h2>
        ${Number(e.serie) > 0
          ? `<span class="ent-serie">${e.serie} in Serie</span>`
          : ""}
      </div>

      <ul class="ent-ergebnis-liste">
        ${zeile("Spielfortsetzung", fortsetzungOk, deinsFortsetzung, loesungFortsetzung)}
        ${zeile("Persönliche Strafe", strafeOk, deinsStrafe, loesungStrafe)}
        ${zusatz.map((z) => zeile(z.frage_text, z.ok,
            labelAusZusatz(z.id, z.gewaehlt), labelAusZusatz(z.id, z.richtig))).join("")}
      </ul>

      ${e.erklaerung ? `<p class="ent-erklaerung">${sicher(e.erklaerung)}</p>` : ""}

      <div class="ent-weiter">
        <button class="ent-senden" type="button" data-weiter>Nächste Szene</button>
        <a class="ent-zurueck" href="modus.html">Zurück zur Auswahl</a>
      </div>
    </div>`;

  bereich.querySelector("[data-weiter]").addEventListener("click", () => lade());
}

// Der Server schickt bei den Zusatzfragen nur die Schluessel zurueck.
// Die Beschriftung steht im Szenario, das noch im Speicher liegt.
function labelAusZusatz(frageId, schluessel) {
  const frage = (szene?.zusatzfragen || []).find((f) => String(f.id) === String(frageId));
  const option = (frage?.optionen || []).find((o) => o.schluessel === schluessel);
  return option?.label || "—";
}

// ---------- Ablauf ----------

function meldung(titel, text, mitAnmeldeKnopf = false) {
  bereich.innerHTML = `
    <div class="ent-meldung">
      <h1 class="seiten-titel">${sicher(titel)}</h1>
      <p class="seiten-unter">${sicher(text)}</p>
      ${mitAnmeldeKnopf
        ? '<button class="ent-senden" type="button" data-anmelden>Anmelden</button>'
        : '<a class="ent-zurueck" href="modus.html">Zurück zur Auswahl</a>'}
    </div>`;

  bereich.querySelector("[data-anmelden]")?.addEventListener("click", async () => {
    const ergebnis = await loginDialog?.oeffne({
      grund: "Für den Entscheidungs-Modus brauchst du deine Anmeldung.",
      gastErlaubt: false,
    });
    if (ergebnis?.status === "angemeldet") lade();
  });
}

async function schickeAb() {
  const ich = person();
  if (!ich) return;
  const knopf = bereich.querySelector(".ent-senden");
  if (knopf) { knopf.disabled = true; knopf.textContent = "Wird geprüft …"; }
  try {
    const ergebnis = await zugriff.pruefe(ich, szene.id, wahl);
    zeichneErgebnis(ergebnis);
  } catch {
    if (knopf) { knopf.disabled = false; knopf.textContent = "Entscheidung abgeben"; }
    meldung("Das hat nicht geklappt",
      "Die Antwort konnte nicht gespeichert werden. Versuch es gleich noch einmal.");
  }
}

async function lade() {
  const ich = person();
  if (!ich) {
    meldung("Nur für angemeldete Schiedsrichter",
      "Im Entscheidungs-Modus zählen deine Serie und dein Stand mit – dafür brauchst du deine Vereinskennung.",
      true);
    return;
  }

  bereich.innerHTML = '<p class="ent-laedt">Szene wird geladen …</p>';
  wahl = leereWahl();

  try {
    // Dieselbe Szene nicht zweimal hintereinander - bei wenigen
    // freigegebenen Szenarien waere das sonst der Normalfall.
    szene = await zugriff.naechstes(ich, letzteId);
    if (!szene && letzteId) szene = await zugriff.naechstes(ich, null);
  } catch {
    meldung("Verbindung fehlgeschlagen", "Die Szene konnte nicht geladen werden.");
    return;
  }

  if (!szene) {
    meldung("Noch keine Szenen da",
      "Sobald der Obmann Szenarien freigegeben hat, geht es hier los.");
    return;
  }

  letzteId = szene.id;
  zeichneFrage();
}

lade();
