// ============================================================
//  termine.html - Liste und Einzelansicht
// ============================================================
//  Der Aufbau steckt in termine.js (Formate, Karten, Serverzugriff),
//  hier steht nur, was die Seite daraus macht. Getrennt, damit die
//  Startseite spaeter dieselben Bausteine benutzen kann, ohne diese
//  Seite zu laden.
// ============================================================

import { DATENBANK, VEREIN } from "../../verein.config.js";
import {
  erstelleTerminZugriff, terminKarte, findungKarte, nachMonatenGruppiert,
  teileVergangenheitAb, datumLang, zeitspanne, sicher, GRUENDE, ARTEN,
} from "./termine.js";

const bereich = document.getElementById("terminBereich");
const zugriff = erstelleTerminZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const gewaehlteId = new URLSearchParams(location.search).get("termin");

// Die Anmeldung stellt seite.js bereit. Sie kann fehlen, wenn ein
// Skript nicht geladen hat - dann laeuft die Seite im oeffentlichen
// Modus weiter, statt gar nichts zu zeigen.
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;

function person() {
  return anmeldung?.lesen() || null;
}

async function ladeTermine() {
  const ich = person();
  if (ich) {
    try {
      return await zugriff.alleFuerMitglied(ich);
    } catch {
      // Eine abgelaufene oder geaenderte PIN darf nicht dazu fuehren,
      // dass die Seite leer bleibt. Dann eben die oeffentliche Sicht.
      return zugriff.alleOeffentlich(VEREIN.seitenschluessel);
    }
  }
  return zugriff.alleOeffentlich(VEREIN.seitenschluessel);
}

// ---------- Liste ----------

function zeichneListe(termine, findungen) {
  const ich = person();
  const { kuenftig, vergangen } = teileVergangenheitAb(termine);

  const offen = kuenftig.filter((t) => ich && t.mein_status == null).length;

  const kopf = `
    <h1 class="seiten-titel">Termine</h1>
    <p class="seiten-unter">
      Lehrabende, Lehrgänge und Treffen der Schiedsrichter-Abteilung.
      ${ich
        ? (offen > 0
            ? `<strong>${offen} ${offen === 1 ? "Termin wartet" : "Termine warten"} noch auf deine Rückmeldung.</strong>`
            : "Du hast auf alles geantwortet.")
        : "Melde dich an, um zu- oder abzusagen."}
    </p>
    ${ich ? "" : `
      <div class="hinweisbalken ruhig">
        <span class="sym-wort">Hinweis</span>
        <span>Hier stehen nur die öffentlich freigegebenen Termine.
          <button type="button" class="verweis-knopf" data-anmelden>Melde dich an</button>,
          um auch interne Termine zu sehen und zuzusagen.</span>
      </div>`}`;

  if (!kuenftig.length && !vergangen.length) {
    bereich.innerHTML = `${kopf}<p class="keine">Zurzeit steht kein Termin an.</p>`;
    return;
  }

  const kuenftigHtml = nachMonatenGruppiert(kuenftig).map((gruppe) => `
    <section class="terminmonat">
      <h2 class="terminmonat-titel">${sicher(gruppe.titel)}</h2>
      ${gruppe.termine.map((t) => terminKarte(t)).join("")}
    </section>`).join("");

  const vergangenHtml = vergangen.length ? `
    <details class="termin-vergangen">
      <summary>Vergangene Termine zeigen (${vergangen.length})</summary>
      ${nachMonatenGruppiert(vergangen).map((gruppe) => `
        <section class="terminmonat">
          <h2 class="terminmonat-titel">${sicher(gruppe.titel)}</h2>
          ${gruppe.termine.map((t) => terminKarte(t)).join("")}
        </section>`).join("")}
    </details>` : "";

  // Terminsuchen stehen UEBER den Terminen: dort ist noch etwas zu
  // entscheiden, bei den Terminen nur noch zur Kenntnis zu nehmen.
  const offeneFindungen = (findungen || []).filter((f) => f.status === "offen");
  const findungHtml = offeneFindungen.length ? `
    <section class="terminmonat">
      <h2 class="terminmonat-titel">Zur Abstimmung</h2>
      ${offeneFindungen.map((f) => findungKarte(f)).join("")}
    </section>` : "";

  bereich.innerHTML = `${kopf}
    ${findungHtml}
    ${kuenftig.length ? kuenftigHtml : '<p class="keine">Zurzeit steht kein Termin an.</p>'}
    ${vergangenHtml}`;

  if (offeneFindungen.length) bindeStimmen();
}

// Die drei Knoepfe je Vorschlag. Der Stand wird nach dem Klick nicht neu
// vom Server geholt: das waere ein zweiter Rundlauf fuer eine Zahl, die
// sich um genau eins aendert.
function bindeStimmen() {
  bereich.querySelectorAll("[data-antwort]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const karte = knopf.closest(".terminfindung");
      const meldung = karte.querySelector("[data-tf-meldung]");
      const vorschlag = knopf.dataset.vorschlag;
      try {
        await zugriff.stimmen(person(), vorschlag, knopf.dataset.antwort);
      } catch (fehler) {
        meldung.textContent = `Konnte nicht gespeichert werden: ${fehler.message}`;
        meldung.dataset.art = "fehler";
        meldung.hidden = false;
        return;
      }
      karte.querySelectorAll(`[data-vorschlag="${CSS.escape(vorschlag)}"]`).forEach((k) =>
        k.classList.toggle("an", k === knopf));
      meldung.textContent = "Antwort gespeichert.";
      meldung.dataset.art = "erfolg";
      meldung.hidden = false;
    });
  });
}

// ---------- Einzelansicht ----------

function zeichneDetail(termin, zusagen) {
  const ich = person();
  const zeit = zeitspanne(termin);

  const marken = [
    termin.pflicht ? '<span class="wortmarke gelb">Pflicht</span>' : "",
    `<span class="wortmarke hell">${sicher(ARTEN[termin.art] || ARTEN.sonstiges)}</span>`,
  ].filter(Boolean).join("");

  const zeilen = [
    zeit ? ["Wann", `${sicher(datumLang(termin.datum))}<br><span class="td-neben">${sicher(zeit)}</span>`]
         : ["Wann", sicher(datumLang(termin.datum))],
    termin.ort ? ["Ort", sicher(termin.ort)] : null,
    termin.rueckmeldung_bis && !termin.vergangen
      ? ["Antwort bis", sicher(datumLang(termin.rueckmeldung_bis))] : null,
    termin.beschreibung ? ["Thema", sicher(termin.beschreibung)] : null,
  ].filter(Boolean).map(([titel, wert]) =>
    `<div class="td-zeile"><div class="td-l">${titel}</div><div class="td-v">${wert}</div></div>`
  ).join("");

  // Der Antwortbereich haengt an drei Bedingungen. Sie hier einmal
  // auszuformulieren ist klarer als drei ineinandergeschachtelte Fragen
  // im Markup.
  let antwort;
  if (termin.vergangen) {
    antwort = '<p class="td-abgelaufen">Dieser Termin ist vorbei.</p>';
  } else if (!ich) {
    antwort = `
      <p class="td-frage">Bist du dabei?</p>
      <button type="button" class="td-senden" data-anmelden>
        Zum Antworten anmelden
      </button>`;
  } else {
    const jaAn = termin.mein_status === "zu" ? " an" : "";
    const neinAn = termin.mein_status === "ab" ? " an" : "";
    antwort = `
      <p class="td-frage">Bist du dabei?</p>
      <div class="td-knopfpaar">
        <button type="button" class="td-knopf ja${jaAn}" data-status="zu">Ja, ich komme</button>
        <button type="button" class="td-knopf nein${neinAn}" data-status="ab">Kann nicht</button>
      </div>
      <div class="td-grundbox" data-grundbox ${termin.mein_status === "ab" ? "" : "hidden"}>
        <p class="td-grundtitel">Warum nicht?</p>
        <div class="td-gruende">
          ${GRUENDE.map(([wert, text]) => `
            <button type="button" class="td-grund${termin.mein_grund === wert ? " an" : ""}"
                    data-grund="${wert}">${text}</button>`).join("")}
        </div>
        <label class="td-kommentar">
          <span>Dazuschreiben (freiwillig)</span>
          <textarea rows="2" data-kommentar maxlength="300"
                    placeholder="z. B. eigene Ansetzung">${sicher(termin.mein_kommentar || "")}</textarea>
        </label>
        <button type="button" class="td-senden" data-absage-senden>
          Absage abschicken
        </button>
      </div>
      <p class="td-meldung" data-meldung hidden role="status"></p>`;
  }

  // Namen nur fuer Angemeldete - fuer Besucher der oeffentlichen Seite
  // sind die Namen der Vereinsmitglieder nichts. Max' Entscheidung vom
  // 29.08.2026: Zusagen mit Namen, Absagegruende nur fuer ihn.
  const teilnehmer = ich && zusagen.length ? `
    <div class="td-teilnehmer">
      <p class="td-teilnehmer-titel">Dabei · ${zusagen.length}</p>
      <div class="td-namen">${zusagen.map((z) =>
        `<span class="td-name">${sicher(z.name)}</span>`).join("")}</div>
    </div>` : "";

  bereich.innerHTML = `
    <a class="zurueck-link" href="termine.html">← Alle Termine</a>
    <article class="termindetail">
      <header class="td-kopf">
        <p class="td-wann">${sicher(datumLang(termin.datum))}</p>
        <h1>${sicher(termin.titel)}</h1>
        ${marken ? `<div class="td-marken">${marken}</div>` : ""}
      </header>
      <div class="td-body">
        ${zeilen}
        ${antwort}
        ${teilnehmer}
      </div>
    </article>`;

  if (ich && !termin.vergangen) bindeAntwort(termin);
}

function bindeAntwort(termin) {
  const grundbox = bereich.querySelector("[data-grundbox]");
  const meldung = bereich.querySelector("[data-meldung]");
  let gewaehlterGrund = termin.mein_grund || null;

  const zeige = (text, art = "info") => {
    meldung.textContent = text;
    meldung.dataset.art = art;
    meldung.hidden = false;
  };

  async function sende(status, grund, kommentar) {
    try {
      await zugriff.melden(person(), termin.id, status, grund, kommentar);
      // Den lokalen Stand mitziehen, damit ein zweiter Klick nicht mit
      // veralteten Werten arbeitet.
      termin.mein_status = status;
      termin.mein_grund = status === "ab" ? grund : null;
      termin.mein_kommentar = status === "ab" ? kommentar : null;
      return true;
    } catch (fehler) {
      zeige(`Konnte nicht gespeichert werden: ${fehler.message}`, "fehler");
      return false;
    }
  }

  bereich.querySelectorAll("[data-status]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const status = knopf.dataset.status;
      if (status === "ab") {
        // Erst den Grund fragen, dann senden. Eine Absage ohne Grund
        // wuerde die Datenbank ohnehin ablehnen (Regel aus v90) - besser,
        // die Oberflaeche fragt vorher, statt einen Serverfehler zu zeigen.
        grundbox.hidden = false;
        grundbox.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      grundbox.hidden = true;
      if (await sende("zu", null, null)) {
        markiereKnoepfe("zu");
        zeige("Zusage gespeichert.", "erfolg");
      }
    });
  });

  bereich.querySelectorAll("[data-grund]").forEach((knopf) => {
    knopf.addEventListener("click", () => {
      gewaehlterGrund = knopf.dataset.grund;
      bereich.querySelectorAll("[data-grund]").forEach((k) =>
        k.classList.toggle("an", k === knopf));
    });
  });

  bereich.querySelector("[data-absage-senden]")?.addEventListener("click", async () => {
    if (!gewaehlterGrund) {
      zeige("Bitte wähle noch einen Grund aus.", "fehler");
      return;
    }
    const kommentar = bereich.querySelector("[data-kommentar]").value.trim();
    if (await sende("ab", gewaehlterGrund, kommentar)) {
      markiereKnoepfe("ab");
      zeige("Absage gespeichert.", "erfolg");
    }
  });

  function markiereKnoepfe(status) {
    bereich.querySelectorAll("[data-status]").forEach((k) =>
      k.classList.toggle("an", k.dataset.status === status));
  }
}

// ---------- Start ----------

function bindeAnmeldeKnoepfe() {
  bereich.querySelectorAll("[data-anmelden]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      if (!loginDialog) return;
      const ergebnis = await loginDialog.oeffne({
        grund: "Zum Zu- und Absagen brauchst du deine Anmeldung.",
      });
      // Nach erfolgreicher Anmeldung neu laden: die Sicht wechselt von
      // "oeffentlich" auf "Mitglied", das sind andere Daten.
      if (ergebnis.status === "angemeldet") location.reload();
    });
  });
}

async function start() {
  let termine;
  try {
    termine = await ladeTermine();
  } catch (fehler) {
    bereich.innerHTML = `
      <h1 class="seiten-titel">Termine</h1>
      <div class="hinweisbalken">
        <span class="sym-wort">Achtung</span>
        <span>Die Termine konnten gerade nicht geladen werden. Bitte später noch einmal versuchen.</span>
      </div>`;
    return;
  }

  // Terminsuchen gibt es nur fuer Angemeldete. Scheitert der Abruf,
  // bleibt die Terminliste trotzdem stehen.
  let findungen = [];
  if (person() && !gewaehlteId) {
    try { findungen = await zugriff.terminfindungen(person()); } catch { findungen = []; }
  }

  if (gewaehlteId) {
    const termin = termine.find((t) => t.id === gewaehlteId);
    if (!termin) {
      bereich.innerHTML = `
        <a class="zurueck-link" href="termine.html">← Alle Termine</a>
        <div class="hinweisbalken ruhig">
          <span class="sym-wort">Hinweis</span>
          <span>Diesen Termin gibt es nicht (mehr) – oder er ist nicht öffentlich.
            ${person() ? "" : '<button type="button" class="verweis-knopf" data-anmelden>Vielleicht hilft eine Anmeldung.</button>'}</span>
        </div>`;
      bindeAnmeldeKnoepfe();
      return;
    }

    let zusagen = [];
    const ich = person();
    if (ich) {
      // Scheitert das, ist der Termin trotzdem anzeigbar - nur die
      // Namensliste fehlt dann.
      try { zusagen = await zugriff.zusagen(ich, termin.id); } catch { zusagen = []; }
    }
    zeichneDetail(termin, zusagen);
    bindeAnmeldeKnoepfe();
    return;
  }

  zeichneListe(termine, findungen);
  bindeAnmeldeKnoepfe();
}

void start();
