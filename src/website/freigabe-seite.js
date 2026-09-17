// ============================================================
//  freigabe.html - das Dashboard für den Vorstand
// ------------------------------------------------------------
//  Die Person, die hier landet, ist KEIN Schiedsrichter, kennt
//  die Seite nicht und entscheidet über Vereinsgeld. Sie braucht
//  deshalb zweierlei: schnell entscheiden können - und sehen,
//  worüber sie entscheidet. Also erst die offenen Punkte, dann
//  der Zusammenhang je Person, dann der Verlauf.
//
//  Der Name wird einmal oben eingetragen und für die Sitzung
//  behalten. Bewusst NICHT im Browser gespeichert: der Link kann
//  weitergegeben werden, und dann stünde der falsche Name unter
//  einer fremden Entscheidung.
//
//  Die Begründung ist kein Beiwerk. Max gibt sie an den
//  Schiedsrichter weiter - deshalb steht sie bei einer Ablehnung
//  als Pflichtfeld da und nicht als "(freiwillig)".
// ============================================================
import { DATENBANK } from "../../verein.config.js";
import {
  erstelleFreigabeZugriff, euro, betrag, datum, stueckText,
  QUELLE_TEXT, STAND_TEXT, summeMitLuecken, personZusammenfassung, bestandText,
} from "./freigabe-zugriff.js";

const bereich = document.getElementById("freigabeBereich");
const zugriff = erstelleFreigabeZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const token = new URLSearchParams(location.search).get("code") || "";
let name = "";
let stand = null;

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function meldung(text, art = "info") {
  const kasten = document.getElementById("freigabeMeldung");
  kasten.textContent = text;
  kasten.dataset.art = art;
  kasten.hidden = !text;
}

/* ---------------- Bausteine ---------------- */

function kachel(titel, wert, zusatz = "") {
  return `<div class="fg-kachel"><span>${sicher(titel)}</span><b>${wert}</b>
    ${zusatz ? `<small>${sicher(zusatz)}</small>` : ""}</div>`;
}

function kopf() {
  const k = stand.kennzahlen;
  const luecke = k.offen_ohne_preis
    ? `${k.offen_ohne_preis === 1 ? "eine Zeile ohne Preis" : `${k.offen_ohne_preis} Zeilen ohne Preis`}`
    : "";
  return `
    <section class="fg-kopf">
      <p class="fg-kicker">${sicher(stand.verein)} · Saison ${sicher(stand.saison.bezeichnung)}</p>
      <h1>Ausrüstung freigeben</h1>
      <p class="fg-einstieg">Unsere Schiedsrichter fragen Ausrüstung an. Bitte entscheide
        je Zeile, ob der Verein das übernimmt. Darunter siehst du, was die einzelnen
        Schiedsrichter in dieser Saison schon bekommen haben.</p>

      <div class="fg-kacheln">
        ${kachel("Wartet auf dich", k.offen_anzahl, luecke)}
        ${kachel("Davon Summe", betrag(k.offen_cent, { nullIstNichts: true }))}
        ${kachel("Freigegeben in der Saison", betrag(k.freigegeben_cent, { nullIstNichts: true }),
          `${k.freigegeben_anzahl} ${k.freigegeben_anzahl === 1 ? "Stück" : "Stücke"}`)}
        ${kachel("Abgelehnt", k.abgelehnt_anzahl)}
      </div>

      <label class="fg-name">Dein Name
        <input id="fgName" type="text" autocomplete="name" placeholder="Vor- und Nachname"
               value="${sicher(name)}" />
      </label>
      <p class="fg-hinweis">Wird zu jeder Entscheidung gespeichert, damit später
        nachvollziehbar ist, wer sie getroffen hat.</p>
    </section>`;
}

function entscheidungsKarte(zeile) {
  const preis = euro(zeile.preis_cent);
  return `
    <article class="fg-zeile" data-id="${sicher(zeile.id)}">
      <div class="fg-zeile-kopf">
        <div>
          <b>${sicher(stueckText(zeile))}</b>
          <span class="fg-person">für ${sicher(zeile.person)} · angefragt am ${datum(zeile.erstellt_am)}</span>
        </div>
        <div class="fg-preis">
          <b>${preis || "kein Preis"}</b>
          <span>${sicher(QUELLE_TEXT[zeile.preis_quelle] || "")}</span>
        </div>
      </div>
      ${zeile.anmerkung ? `<p class="fg-anmerkung">„${sicher(zeile.anmerkung)}"</p>` : ""}
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

function anfrageZeile(z) {
  return `
    <li class="fg-mini" data-stand="${sicher(z.freigabe_status)}">
      <span class="fg-mini-punkt" aria-hidden="true"></span>
      <div>
        <b>${sicher(stueckText(z))}</b>
        <small>${datum(z.erstellt_am)} · ${sicher(STAND_TEXT[z.freigabe_status])}${
          z.preis_cent != null ? ` · ${euro(z.preis_cent)}` : ""}</small>
        ${z.freigabe_notiz ? `<small class="fg-mini-grund">„${sicher(z.freigabe_notiz)}"
          – ${sicher(z.freigabe_name || "")}</small>` : ""}
      </div>
    </li>`;
}

function personKarte(person) {
  return `
    <details class="fg-person-karte">
      <summary>
        <span class="fg-person-name">${sicher(person.name)}</span>
        <span class="fg-person-zahl">${sicher(personZusammenfassung(person))}</span>
        ${person.offen ? `<span class="fg-punkt-offen" title="wartet auf dich"></span>` : ""}
      </summary>
      <div class="fg-person-inhalt">
        <p class="fg-bestand"><b>Hat schon:</b> ${sicher(bestandText(person.bestand))}</p>
        <ul class="fg-mini-liste">${(person.anfragen || []).map(anfrageZeile).join("")}</ul>
      </div>
    </details>`;
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
  const rechnung = summeMitLuecken(offen);
  const personen = stand.schiedsrichter || [];
  const verlauf = stand.verlauf || [];

  bereich.innerHTML = `
    ${kopf()}

    <section class="fg-abschnitt">
      <h2>Zu entscheiden${offen.length ? ` <span class="fg-anzahl">${offen.length}</span>` : ""}</h2>
      ${offen.length ? `
        ${rechnung.ohnePreis ? `<p class="fg-warnung">Bei ${rechnung.ohnePreis === 1
          ? "einer Anfrage" : `${rechnung.ohnePreis} Anfragen`} ist kein Preis hinterlegt.
          Die Summe oben ist deshalb unvollständig – frag im Zweifel beim Obmann nach.</p>` : ""}
        <div class="fg-liste">${offen.map(entscheidungsKarte).join("")}</div>`
        : `<p class="fg-leer">Zurzeit liegt nichts zur Entscheidung an. Danke!</p>`}
    </section>

    <section class="fg-abschnitt">
      <h2>Die Schiedsrichter</h2>
      <p class="fg-hinweis">Was jeder in dieser Saison angefragt bekommen hat – und was er
        laut eigener Angabe schon besitzt.</p>
      ${personen.length ? `<div class="fg-personen">${personen.map(personKarte).join("")}</div>`
        : `<p class="fg-leer">Noch keine Anfragen.</p>`}
    </section>

    ${verlauf.length ? `
    <section class="fg-abschnitt">
      <details class="fg-verlauf">
        <summary><h2>Alle Entscheidungen <span class="fg-anzahl">${verlauf.length}</span></h2></summary>
        <ul class="fg-mini-liste">${verlauf.map(verlaufZeile).join("")}</ul>
      </details>
    </section>` : ""}`;

  verdrahte();
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

      if (String(name).trim().length < 2) {
        meldung("Bitte trage oben zuerst deinen Namen ein.", "fehler");
        document.getElementById("fgName")?.focus();
        return;
      }
      // Eine Ablehnung ohne Grund ist für den Schiedsrichter wertlos -
      // und genau der bekommt sie weitergereicht.
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
}

async function laden() {
  try {
    stand = await zugriff.dashboard(token);
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
