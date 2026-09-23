// ============================================================
//  freigabe.html - die Seite für den Vorstand
// ------------------------------------------------------------
//  Die Person, die hier landet, ist KEIN Schiedsrichter, kennt
//  die Seite nicht und entscheidet über Vereinsgeld. Sie braucht
//  zweierlei: schnell entscheiden können - und sehen, worüber
//  sie entscheidet.
//
//  Bei einem persönlichen Dauerzugang stammt der Name serverseitig
//  aus dem Zugang. Er kann im Browser weder vertauscht noch
//  überschrieben werden. Alte befristete Links behalten das bisherige
//  Namensfeld und speichern es weiterhin nicht im Browser.
//
//  Die Begründung ist kein Beiwerk. Max gibt sie an den
//  Schiedsrichter weiter - deshalb steht sie bei einer Ablehnung
//  als Pflichtfeld da und nicht als "(freiwillig)".
//
//  Zwei Dinge gelten fuer die Datenansicht:
//
//  1. Befristete Links zeigen nur ihren Stapel. Ein persoenlicher
//     Dauerzugang ist dagegen ein lebendes Vorstandspostfach und zeigt
//     alle bereits vom Obmann vorgelegten Anfragen des Vereins. Der
//     Betrag je Zeile bleibt immer der beim Vorlegen eingefrorene Wert.
//
//  2. "Freigegeben" heißt freigegebenes Budget, nicht ausgegebenes
//     Geld. Deshalb gibt es unten einen zweiten Abschnitt: Vorgänge,
//     die der Obmann ausdrücklich zur Zahlung beauftragt hat.
//     Der Vereinsverantwortliche bestätigt die Ausführung; der
//     Schiedsrichter bestätigt anschließend den Geldeingang.
//
//  Der Bestand ist nur im namentlichen Dauerzugang sichtbar, automatisch
//  nach Gegenstandsgruppen sortiert und ohne PINs, Kontaktdaten oder
//  fremde Vereinsdaten. Person und Kategorie sind getrennt filterbar.
// ============================================================
import { DATENBANK } from "../../verein.config.js";
import {
  erstelleFreigabeZugriff, euro, betrag, datum, stueckText,
  QUELLE_TEXT, STAND_TEXT, summeMitLuecken, saisonKontext, gruppiereNachPerson,
} from "./freigabe-zugriff.js";
import {
  bestandsBezeichnung, bestandsFarbwert, bestandsgruppe, bestandsInhalt,
  bestandsKurztext, bestandsSymbol,
} from "./freigabe-bestand.js";

const bereich = document.getElementById("freigabeBereich");
const zugriff = erstelleFreigabeZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const token = new URLSearchParams(location.search).get("code") || "";
let name = "";
let stand = null;
let zugangsinfo = null;
let bestandsstand = { personen: [] };
let bestandsfilter = "alle";
let bestandsPerson = "";
let bestandsfehler = "";
let zahlungenFehler = "";
let bestandsOffen = false;
let buendelZuordnung = new Map();

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function meldung(text, art = "info") {
  const kasten = document.getElementById("freigabeMeldung");
  kasten.textContent = text;
  kasten.dataset.art = art;
  kasten.hidden = !text;
}

function nameFehlt() {
  if (String(name).trim().length >= 2) return false;
  meldung("Bitte trage oben zuerst deinen Namen ein.", "fehler");
  document.getElementById("fgName")?.focus();
  return true;
}

/* ---------------- Bausteine ---------------- */

function kachel(titel, wert, zusatz = "") {
  return `<div class="fg-kachel"><span>${sicher(titel)}</span><b>${wert}</b>
    ${zusatz ? `<small>${sicher(zusatz)}</small>` : ""}</div>`;
}

function verdrahteBestand() {
  const abschnitt = document.getElementById("fgBestandAbschnitt");
  if (abschnitt && !abschnitt.dataset.aufklappenVerdrahtet) {
    abschnitt.dataset.aufklappenVerdrahtet = "true";
    abschnitt.addEventListener("toggle", () => { bestandsOffen = abschnitt.open; });
  }
  document.querySelector("[data-bestand-person-filter]")?.addEventListener("change", (ereignis) => {
    bestandsPerson = ereignis.target.value;
    zeichneBestand();
  });
  document.querySelectorAll("[data-bestand-filter]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      bestandsfilter = knopf.dataset.bestandFilter;
      zeichneBestand();
    });
  });
  document.querySelector("[data-bestand-neuladen]")?.addEventListener("click", async (ereignis) => {
    const knopf = ereignis.currentTarget;
    knopf.disabled = true;
    knopf.textContent = "Wird geladen …";
    try {
      bestandsstand = await zugriff.bestand(token);
      bestandsfehler = "";
      bestandsOffen = true;
      zeichneBestand();
    } catch (fehler) {
      bestandsfehler = fehler.message || "Der Bestand konnte nicht geladen werden.";
      zeichneBestand();
    }
  });
}

function zeichneBestand() {
  const ziel = document.getElementById("fgBestand");
  if (!ziel) return;
  ziel.innerHTML = bestandsfehler
    ? `<div class="fg-bestand-fehler" role="alert"><b>Der Vereinsbestand konnte nicht geladen werden.</b>
       <p>${sicher(bestandsfehler)}</p>
       <button type="button" data-bestand-neuladen>Erneut laden</button></div>`
    : bestandsInhalt(bestandsstand, bestandsfilter, bestandsPerson);
  verdrahteBestand();
}

function anfrageAusstattung(zeile) {
  const gruppe = bestandsgruppe(zeile.kategorie);
  const farbwert = bestandsFarbwert(zeile.farbe);
  const merkmale = [
    zeile.farbe && `<span>${farbwert
      ? `<i class="fg-farbpunkt" style="--farbe:${farbwert}" aria-hidden="true"></i>` : ""}${sicher(zeile.farbe)}</span>`,
    zeile.groesse && `<span>Größe ${sicher(zeile.groesse)}</span>`,
    zeile.aermellaenge && `<span>${sicher(zeile.aermellaenge)}er Arm</span>`,
  ].filter(Boolean).join("");
  return `<div class="fg-anfrage-ausstattung">
    <span class="fg-bestand-icon">${bestandsSymbol(gruppe.symbol)}</span>
    <span class="fg-anfrage-ausstattung-text"><b>${sicher(bestandsBezeichnung(zeile))}</b>
      ${merkmale ? `<small>${merkmale}</small>` : ""}</span>
  </div>`;
}

function kopf() {
  const k = stand.kennzahlen;
  const persoenlich = zugangsinfo?.art === "dauerhaft" && zugangsinfo?.name;
  const luecke = k.offen_ohne_preis
    ? `${k.offen_ohne_preis === 1 ? "eine Zeile ohne Preis" : `${k.offen_ohne_preis} Zeilen ohne Preis`}`
    : "";
  return `
    <section class="fg-kopf">
      <p class="fg-kicker">${sicher(stand.verein)} · Saison ${sicher(stand.saison.bezeichnung)}</p>
      <h1>Ausrüstung freigeben</h1>
      <p class="fg-einstieg">Unsere Schiedsrichter fragen Ausrüstung an. Bitte entscheide
        je Zeile, ob der Verein das übernimmt. ${persoenlich
          ? "In deinem persönlichen Zugang erscheinen alle offenen Vorlagen des Vereins automatisch."
          : "Dieser befristete Link enthält nur den dafür zusammengestellten Stapel."}</p>

      <div class="fg-kacheln">
        ${kachel("Wartet auf dich", k.offen_anzahl, luecke)}
        ${kachel("Davon Summe", betrag(k.offen_cent, { nullIstNichts: true }))}
        ${kachel("Freigegeben", betrag(k.freigegeben_cent, { nullIstNichts: true }),
          `${k.freigegeben_anzahl} ${k.freigegeben_anzahl === 1 ? "Stück" : "Stücke"}`)}
        ${kachel("Zahlung offen", betrag(k.zahlung_cent, { nullIstNichts: true }),
          `${k.zahlung_anzahl} ${k.zahlung_anzahl === 1 ? "Vorgang" : "Vorgänge"}`)}
      </div>

      ${persoenlich ? `<div class="fg-identitaet">
        <span>Persönlicher Zugang</span>
        <b>${sicher(zugangsinfo.name)}</b>
        ${zugangsinfo.rolle ? `<small>${sicher(zugangsinfo.rolle)}</small>` : ""}
      </div>
      <p class="fg-hinweis">Dieser Zugang bleibt bis zum Widerruf gültig. Entscheidungen
        werden automatisch diesem Namen zugeordnet.</p>` : `<label class="fg-name">Dein Name
        <input id="fgName" type="text" autocomplete="name" placeholder="Vor- und Nachname"
               value="${sicher(name)}" />
      </label>
      <p class="fg-hinweis">Wird zu jeder Entscheidung gespeichert, damit später
        nachvollziehbar ist, wer sie getroffen hat.</p>`}
    </section>`;
}

function entscheidungsKarte(zeile) {
  const preis = euro(zeile.preis_cent);
  const weg = zeile.beschaffungsweg === "weg1_obmann_besorgt"
    ? "Der Verein bestellt es."
    : "Der Schiedsrichter kauft es selbst und reicht den Beleg ein.";
  return `
    <article class="fg-zeile" data-id="${sicher(zeile.id)}">
      <div class="fg-zeile-kopf">
        <div>
          ${anfrageAusstattung(zeile)}
          <span class="fg-person">für ${sicher(zeile.person)} · angefragt am ${datum(zeile.erstellt_am)}</span>
        </div>
        <div class="fg-preis">
          <b>${preis || "kein Preis"}</b>
          <span>${sicher(QUELLE_TEXT.vorgelegt)}</span>
        </div>
      </div>
      ${zeile.anmerkung ? `<p class="fg-anmerkung">„${sicher(zeile.anmerkung)}"</p>` : ""}
      <p class="fg-kontext">${sicher(saisonKontext(zeile))} ${sicher(weg)}</p>
      ${zugangsinfo?.art === "dauerhaft" ? `<button type="button" class="fg-bestand-sprung"
        data-bestand-oeffnen="${sicher(zeile.person)}" data-bestand-kategorie="${sicher(zeile.kategorie)}">
        Bestand von ${sicher(zeile.person)} ansehen</button>` : ""}
      <label class="fg-notiz">Begründung
        <input type="text" data-notiz maxlength="200"
               placeholder="Wird dem Schiedsrichter weitergegeben – bei einer Ablehnung bitte ausfüllen" />
      </label>
      <div class="fg-knoepfe">
        <button type="button" class="fg-ja" data-entscheidung="freigegeben">Übernimmt der Verein</button>
        <button type="button" class="fg-nein" data-entscheidung="abgelehnt">Geht nicht</button>
      </div>
    </article>`;
}

function zahlungsKarte(zeile) {
  return `
    <article class="fg-zeile" data-zahlung-id="${sicher(zeile.id)}">
      <div class="fg-zeile-kopf">
        <div>
          <b>${sicher(stueckText(zeile))}</b>
          <span class="fg-person">für ${sicher(zeile.person)} · beauftragt am ${datum(zeile.beauftragt_am)}</span>
        </div>
        <div class="fg-preis"><b>${euro(zeile.preis_cent) || "kein Betrag"}</b></div>
      </div>
      <p class="fg-kontext">Der Beleg wurde geprüft und die Zahlung beauftragt.
        Bitte bestätige erst nach der tatsächlichen Überweisung.</p>
      ${zeile.hinweis ? `<p class="fg-kontext"><b>Hinweis von Max:</b> ${sicher(zeile.hinweis)}</p>` : ""}
      <div class="fg-knoepfe">
        <button type="button" class="fg-ja" data-zahlung>Habe ich überwiesen</button>
      </div>
    </article>`;
}

function entscheidungsGruppe(gruppe) {
  const summe = gruppe.summe.cent ? euro(gruppe.summe.cent) : "kein Betrag";
  const luecke = gruppe.summe.ohnePreis
    ? ` · ${gruppe.summe.ohnePreis} ${gruppe.summe.ohnePreis === 1 ? "Preis fehlt" : "Preise fehlen"}`
    : "";
  const bestand = zugangsinfo?.art === "dauerhaft"
    ? `<p class="fg-person-bestand"><b>Vorhanden:</b> ${sicher(bestandsKurztext(bestandsstand, gruppe.person))}</p>`
    : "";
  const anfragen = new Map();
  for (const zeile of gruppe.eintraege) {
    const info = buendelZuordnung.get(String(zeile.id));
    const schluessel = info ? String(info.buendel_id) : String(zeile.id);
    if (!anfragen.has(schluessel)) anfragen.set(schluessel, { info, zeilen: [] });
    anfragen.get(schluessel).zeilen.push(zeile);
  }
  const karten = [...anfragen.values()].map(({ info, zeilen }) => {
    if (!info) return entscheidungsKarte(zeilen[0]);
    zeilen.sort((a, b) =>
      (buendelZuordnung.get(String(a.id))?.buendel_position || 0)
      - (buendelZuordnung.get(String(b.id))?.buendel_position || 0));
    return `<div class="fg-buendel">
      <div class="fg-buendel-kopf"><strong>Gemeinsame Anfrage · ${zeilen.length} ${zeilen.length === 1 ? "Stück" : "Stücke"}</strong>
        <small>vom ${datum(info.erstellt_am)}</small></div>
      ${info.gesamt_anmerkung ? `<p class="fg-buendel-notiz">Zur gesamten Anfrage: „${sicher(info.gesamt_anmerkung)}“</p>` : ""}
      ${zeilen.map(entscheidungsKarte).join("")}
    </div>`;
  }).join("");
  return `<section class="fg-anfrage-personengruppe">
    <header class="fg-anfrage-person-kopf">
      <div><h3>${sicher(gruppe.person)}</h3><small>${gruppe.eintraege.length}
        ${gruppe.eintraege.length === 1 ? "offene Anfrage" : "offene Anfragen"}</small></div>
      <strong>${summe}${sicher(luecke)}</strong>
    </header>
    ${bestand}
    <div class="fg-liste">${karten}</div>
  </section>`;
}

function verlaufZeile(z) {
  return `
    <li class="fg-mini" data-stand="${sicher(z.freigabe_status)}">
      <span class="fg-mini-punkt" aria-hidden="true"></span>
      <div>
        <b>${sicher(stueckText(z))} <span class="fg-person">· ${sicher(z.person)}</span></b>
        <small>${datum(z.freigabe_am)} · ${sicher(STAND_TEXT[z.freigabe_status])}${
          z.preis_cent != null ? ` · ${euro(z.preis_cent)}` : ""} · ${sicher(z.freigabe_name || "")}</small>
        ${z.freigabe_notiz ? `<small class="fg-mini-grund">„${sicher(z.freigabe_notiz)}"</small>` : ""}
      </div>
    </li>`;
}

/* ---------------- Aufbau ---------------- */

function zeichne() {
  const offen = stand.offen || [];
  const zahlungen = stand.zahlungen || [];
  const rechnung = summeMitLuecken(offen);
  const personengruppen = gruppiereNachPerson(offen);
  const verlauf = stand.verlauf || [];

  bereich.innerHTML = `
    ${kopf()}

    ${zugangsinfo?.art === "dauerhaft" ? `<details id="fgBestandAbschnitt" class="fg-abschnitt fg-bestand"${bestandsOffen ? " open" : ""}>
      <summary class="fg-abschnitt-kopf"><div><p class="fg-kicker">Vereinsbestand</p>
        <h2>Ausrüstung der Schiedsrichter</h2></div>
        <p>Aufklappen, nach Person und Kategorie filtern.</p></summary>
      <div id="fgBestand">${bestandsInhalt(bestandsstand, bestandsfilter, bestandsPerson)}</div>
    </details>` : ""}

    <details class="fg-abschnitt fg-anfragen-bereich" open>
      <summary class="fg-bereich-summary"><h2>Zu entscheiden${offen.length ? ` <span class="fg-anzahl">${offen.length}</span>` : ""}</h2>
        <span>${personengruppen.length} ${personengruppen.length === 1 ? "Person" : "Personen"}</span></summary>
      ${offen.length ? `
        ${rechnung.ohnePreis ? `<p class="fg-warnung">Bei ${rechnung.ohnePreis === 1
          ? "einer Anfrage" : `${rechnung.ohnePreis} Anfragen`} fehlt der Betrag.
          Die Summe oben ist deshalb unvollständig – bitte frag beim Obmann nach.</p>` : ""}
        <div class="fg-personengruppen">${personengruppen.map(entscheidungsGruppe).join("")}</div>`
        : `<p class="fg-leer">Zurzeit liegt nichts zur Entscheidung an. Danke!</p>`}
    </details>

    ${zahlungenFehler ? `<p class="fg-warnung">Zahlungsaufträge konnten nicht geladen werden:
      ${sicher(zahlungenFehler)} <button type="button" data-zahlungen-neuladen>Erneut laden</button></p>` : ""}
    ${zahlungen.length ? `
    <section class="fg-abschnitt">
      <h2>Zahlungsaufträge <span class="fg-anzahl">${zahlungen.length}</span></h2>
      <p class="fg-hinweis">Nur von Max beauftragte Zahlungen erscheinen hier.
        Nach deiner Überweisung bestätigt der Schiedsrichter den Eingang.</p>
      <div class="fg-liste">${zahlungen.map(zahlungsKarte).join("")}</div>
    </section>` : ""}

    ${verlauf.length ? `
    <section class="fg-abschnitt">
      <details class="fg-verlauf">
        <summary><h2>Deine Entscheidungen <span class="fg-anzahl">${verlauf.length}</span></h2></summary>
        <ul class="fg-mini-liste">${verlauf.map(verlaufZeile).join("")}</ul>
      </details>
    </section>` : ""}`;

  verdrahte();
  verdrahteBestand();
}

function verdrahte() {
  const feld = document.getElementById("fgName");
  if (feld) feld.addEventListener("input", () => { name = feld.value; });

  bereich.querySelectorAll("[data-entscheidung]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const artikel = knopf.closest(".fg-zeile");
      const entscheidung = knopf.dataset.entscheidung;
      const notizFeld = artikel.querySelector("[data-notiz]");
      const notiz = notizFeld?.value.trim() || "";

      if (nameFehlt()) return;
      // Eine Ablehnung ohne Grund ist für den Schiedsrichter wertlos -
      // und genau der bekommt sie weitergereicht. Der Server weist sie
      // ohnehin ab; hier steht es nur freundlicher da.
      if (entscheidung === "abgelehnt" && notiz.length < 3) {
        meldung("Bitte schreib kurz dazu, warum es nicht geht – das bekommt der Schiedsrichter zu lesen.", "fehler");
        notizFeld?.focus();
        return;
      }

      // Beide Knöpfe sperren: ein zweiter Klick währenddessen schickte
      // die Gegenentscheidung, und die wäre dann die, die zählt.
      artikel.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      meldung("Wird gespeichert …");
      try {
        await zugriff.entscheiden(token, artikel.dataset.id, entscheidung, name.trim(), notiz || null);
        await laden();
        meldung(entscheidung === "freigegeben" ? "Freigegeben." : "Abgelehnt.", "erfolg");
      } catch (fehler) {
        artikel.querySelectorAll("button").forEach((b) => { b.disabled = false; });
        meldung(fehler.message, "fehler");
      }
    });
  });

  bereich.querySelectorAll("[data-zahlung]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const artikel = knopf.closest(".fg-zeile");
      if (nameFehlt()) return;
      knopf.disabled = true;
      meldung("Wird gespeichert …");
      try {
        await zugriff.zahlungAngewiesen(token, artikel.dataset.zahlungId, name.trim());
        await laden();
        meldung("Als überwiesen eingetragen.", "erfolg");
      } catch (fehler) {
        knopf.disabled = false;
        meldung(fehler.message, "fehler");
      }
    });
  });

  bereich.querySelector("[data-zahlungen-neuladen]")?.addEventListener("click", () => {
    void laden();
  });

  bereich.querySelectorAll("[data-bestand-oeffnen]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      bestandsfilter = bestandsgruppe(knopf.dataset.bestandKategorie).id;
      bestandsPerson = knopf.dataset.bestandOeffnen;
      bestandsOffen = true;
      const abschnitt = document.getElementById("fgBestandAbschnitt");
      if (abschnitt) abschnitt.open = true;
      zeichneBestand();
      const ziel = document.getElementById("fgBestand");
      if (!ziel) return;
      const person = [...ziel.querySelectorAll("[data-bestand-person]")]
        .find((element) => element.dataset.bestandPerson === knopf.dataset.bestandOeffnen);
      if (person) person.open = true;
      person?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

async function laden() {
  try {
    [stand, zugangsinfo] = await Promise.all([
      zugriff.dashboard(token),
      zugriff.zugang(token),
    ]);
    // Die alte Dashboard-Aggregation enthält noch beleg_geprueft.
    // Solche Vorgänge dürfen Tom nicht als Zahlungsauftrag angeboten werden.
    stand.zahlungen = [];
    stand.kennzahlen.zahlung_anzahl = 0;
    stand.kennzahlen.zahlung_cent = 0;
    zahlungenFehler = "";
    try {
      const auftraege = await zugriff.zahlungen(token);
      stand.zahlungen = Array.isArray(auftraege) ? auftraege : [];
      stand.kennzahlen.zahlung_anzahl = stand.zahlungen.length;
      stand.kennzahlen.zahlung_cent = stand.zahlungen.reduce(
        (summe, zeile) => summe + (Number(zeile.preis_cent) || 0), 0);
    } catch (fehler) {
      zahlungenFehler = fehler.message || "Bitte später erneut laden.";
    }
    if (zugangsinfo?.art === "dauerhaft" && zugangsinfo?.name) name = zugangsinfo.name;
    try {
      const daten = await zugriff.buendelZuordnung(token);
      buendelZuordnung = new Map((Array.isArray(daten) ? daten : [])
        .map((eintrag) => [String(eintrag.anfrage_id), eintrag]));
    } catch {
      buendelZuordnung = new Map();
    }
    bestandsstand = { personen: [] };
    bestandsfehler = "";
    if (zugangsinfo?.art === "dauerhaft") {
      try {
        bestandsstand = await zugriff.bestand(token);
      } catch (fehler) {
        // Entscheidungen bleiben weiterhin möglich. Ein einzelner Fehler
        // der ergänzenden Bestandsansicht darf Toms ganzes Dashboard nicht
        // fälschlich als ungültigen Link darstellen.
        bestandsfehler = fehler.message || "Der Bestand konnte nicht geladen werden.";
      }
    }
    zeichne();
  } catch (fehler) {
    bereich.innerHTML = `
      <section class="fg-kopf">
        <h1>Der Link ist nicht mehr gültig</h1>
        <p class="fg-einstieg">${sicher(fehler.message)}</p>
        <p>Bitte melde dich beim Schiedsrichter-Obmann, dann bekommst du einen neuen.</p>
      </section>`;
  }
}

if (!token) {
  bereich.innerHTML = `
    <section class="fg-kopf">
      <h1>Diese Seite braucht einen Link</h1>
      <p class="fg-einstieg">Der Schiedsrichter-Obmann schickt dir einen persönlichen Link.
        Bitte öffne die Seite darüber – ohne ihn gibt es hier nichts zu sehen.</p>
    </section>`;
} else {
  void laden();
}
