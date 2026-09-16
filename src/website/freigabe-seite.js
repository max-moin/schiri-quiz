// ============================================================
//  freigabe.html - die Ansicht für den Vorstand
// ------------------------------------------------------------
//  Die Person, die hier landet, ist KEIN Schiedsrichter, kennt
//  die Seite nicht und will das in fünf Minuten erledigt haben.
//  Deshalb: keine Navigation, kein Konto, keine Fachbegriffe.
//  Eine Liste, zwei Knöpfe, eine Summe.
//
//  Der Name wird einmal oben eingetragen und für die Sitzung
//  behalten - sonst tippt man ihn bei acht Anfragen achtmal.
//  Er wird bewusst NICHT im Browser gespeichert: der Link kann
//  weitergegeben werden, und dann stünde der falsche Name da.
// ============================================================
import { DATENBANK, VEREIN } from "../../verein.config.js";
import {
  erstelleFreigabeZugriff, euro, summe, ohnePreis, QUELLE_TEXT, stueckText,
} from "./freigabe-zugriff.js";

const bereich = document.getElementById("freigabeBereich");
const zugriff = erstelleFreigabeZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const token = new URLSearchParams(location.search).get("code") || "";
let name = "";

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

function meldung(text, art = "info") {
  const kasten = document.getElementById("freigabeMeldung");
  kasten.textContent = text;
  kasten.dataset.art = art;
  kasten.hidden = !text;
}

function kopfHtml(offen, erledigt) {
  const gesamt = summe(offen);
  const fehlend = ohnePreis(offen);
  return `
    <section class="fg-kopf">
      <h1>Ausrüstung freigeben</h1>
      <p>Die Schiedsrichter der <strong>${sicher(VEREIN.name)}</strong> haben Ausrüstung
        angefragt. Bitte entscheide je Zeile, ob der Verein das übernimmt.</p>
      <div class="fg-summe">
        <div><span>Offen</span><b>${offen.length}</b></div>
        <div><span>Summe</span><b>${offen.length ? euro(gesamt) : "–"}</b></div>
        ${erledigt.length ? `<div><span>Erledigt</span><b>${erledigt.length}</b></div>` : ""}
      </div>
      ${fehlend ? `<p class="fg-hinweis">Bei ${fehlend === 1 ? "einer Anfrage" : `${fehlend} Anfragen`}
        ist kein Preis hinterlegt – die Summe ist entsprechend unvollständig.</p>` : ""}
      <label class="fg-name">Dein Name
        <input id="fgName" type="text" autocomplete="name" placeholder="Vor- und Nachname"
               value="${sicher(name)}" />
      </label>
      <p class="fg-hinweis">Der Name wird zu jeder Entscheidung gespeichert, damit später
        nachvollziehbar ist, wer sie getroffen hat.</p>
    </section>`;
}

function zeileHtml(zeile) {
  const offen = zeile.freigabe_status === "vorgelegt";
  const preis = euro(zeile.preis_cent);
  return `
    <article class="fg-zeile${offen ? "" : " ist-erledigt"}" data-id="${sicher(zeile.id)}">
      <div class="fg-zeile-kopf">
        <div>
          <b>${sicher(stueckText(zeile))}</b>
          <span class="fg-person">für ${sicher(zeile.person)}</span>
        </div>
        <div class="fg-preis">
          <b>${preis || "kein Preis"}</b>
          <span>${sicher(QUELLE_TEXT[zeile.preis_quelle] || "")}</span>
        </div>
      </div>
      ${zeile.anmerkung ? `<p class="fg-anmerkung">„${sicher(zeile.anmerkung)}"</p>` : ""}
      ${offen ? `
        <label class="fg-notiz">Notiz (freiwillig)
          <input type="text" data-notiz placeholder="z. B. nur eins statt zwei" />
        </label>
        <div class="fg-knoepfe">
          <button type="button" class="fg-ja" data-entscheidung="freigegeben">Übernimmt der Verein</button>
          <button type="button" class="fg-nein" data-entscheidung="abgelehnt">Geht nicht</button>
        </div>`
      : `
        <p class="fg-ergebnis" data-stand="${sicher(zeile.freigabe_status)}">
          ${zeile.freigabe_status === "freigegeben" ? "Übernimmt der Verein" : "Abgelehnt"}
          – ${sicher(zeile.freigabe_name || "")}
          ${zeile.freigabe_notiz ? `<br /><em>${sicher(zeile.freigabe_notiz)}</em>` : ""}
        </p>`}
    </article>`;
}

function verdrahte(zeilen) {
  const feld = document.getElementById("fgName");
  if (feld) feld.addEventListener("input", () => { name = feld.value; });

  bereich.querySelectorAll("[data-entscheidung]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const artikel = knopf.closest(".fg-zeile");
      const id = artikel.dataset.id;
      const entscheidung = knopf.dataset.entscheidung;
      if (String(name).trim().length < 2) {
        meldung("Bitte trage oben zuerst deinen Namen ein.", "fehler");
        document.getElementById("fgName")?.focus();
        return;
      }
      // Beide Knöpfe sperren: ein zweiter Klick währenddessen würde die
      // Gegenentscheidung schicken und wäre dann die, die zählt.
      artikel.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      meldung("Wird gespeichert …");
      try {
        const notiz = artikel.querySelector("[data-notiz]")?.value || null;
        await zugriff.entscheiden(token, id, entscheidung, name.trim(), notiz);
        await laden();
        meldung(entscheidung === "freigegeben" ? "Freigegeben." : "Abgelehnt.", "erfolg");
      } catch (fehler) {
        artikel.querySelectorAll("button").forEach((b) => { b.disabled = false; });
        meldung(fehler.message, "fehler");
      }
    });
  });
  void zeilen;
}

async function laden() {
  try {
    const daten = await zugriff.uebersicht(token);
    const zeilen = Array.isArray(daten) ? daten : [];
    const offen = zeilen.filter((z) => z.freigabe_status === "vorgelegt");
    const erledigt = zeilen.filter((z) => z.freigabe_status !== "vorgelegt");

    bereich.innerHTML = `
      ${kopfHtml(offen, erledigt)}
      ${offen.length
        ? `<div class="fg-liste">${offen.map(zeileHtml).join("")}</div>`
        : `<p class="fg-leer">Zurzeit liegt nichts zur Entscheidung an. Danke!</p>`}
      ${erledigt.length ? `<details class="fg-erledigt">
        <summary>Schon entschieden (${erledigt.length})</summary>
        <div class="fg-liste">${erledigt.map(zeileHtml).join("")}</div>
      </details>` : ""}`;
    verdrahte(zeilen);
  } catch (fehler) {
    bereich.innerHTML = `
      <section class="fg-kopf">
        <h1>Der Link ist nicht mehr gültig</h1>
        <p>${sicher(fehler.message)}</p>
        <p>Bitte melde dich beim Schiedsrichter-Obmann, dann bekommst du einen neuen.</p>
      </section>`;
  }
}

if (!token) {
  bereich.innerHTML = `
    <section class="fg-kopf">
      <h1>Diese Seite braucht einen Link</h1>
      <p>Der Schiedsrichter-Obmann schickt dir einen persönlichen Link. Bitte öffne die
        Seite über diesen Link – ohne ihn gibt es hier nichts zu sehen.</p>
    </section>`;
} else {
  void laden();
}
