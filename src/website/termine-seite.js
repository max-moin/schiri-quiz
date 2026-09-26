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
  teileVergangenheitAb, datumLang, datumKurz, zeitspanne, sicher, GRUENDE, ARTEN, verbindeTerminSichten,
  ladeTerminInKalender,
} from "./termine.js";

const bereich = document.getElementById("terminBereich");
const zugriff = erstelleTerminZugriff({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const gewaehlteId = new URLSearchParams(location.search).get("termin");

// In der Einzelansicht ist die naechste Ebene nicht die Startseite,
// sondern die Terminliste. Dadurch braucht es keinen zweiten Textlink
// „Alle Termine“ direkt unter dem Wegweiser.
function richteDetailRueckwegEin() {
  if (!gewaehlteId) return;
  const link = document.querySelector?.(".wegweiser-zurueck");
  if (!link) return;
  link.href = "termine.html";
  link.setAttribute("aria-label", "Zurück zu allen Terminen");
  const ziel = link.querySelector(".wegweiser-ziel");
  if (ziel) ziel.textContent = "Alle Termine";
}

// Die Anmeldung stellt seite.js bereit. Sie kann fehlen, wenn ein
// Skript nicht geladen hat - dann laeuft die Seite im oeffentlichen
// Modus weiter, statt gar nichts zu zeigen.
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;

function person() {
  return anmeldung?.lesen() || null;
}

async function protokollPdfLink(terminId, ich) {
  const antwort = await fetch("/api/protokoll-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ terminId, schiedsrichterId: ich.id, pin: ich.pin }),
  });
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error("PDF-Protokoll ist gerade nicht erreichbar.");
  return antwort.json();
}

async function zeigePdfProtokoll(terminId, ich) {
  const ziel = document.getElementById("termin-pdf");
  if (!ziel?.querySelector?.("[data-pdf-name]")
      || !ziel.querySelector("[data-pdf-fehler]")
      || !ziel.querySelector("iframe")) return;
  try {
    const pdf = await protokollPdfLink(terminId, ich);
    if (!pdf) return;
    ziel.hidden = false;
    ziel.querySelector("[data-pdf-name]").textContent = pdf.name || "Protokoll.pdf";
    const rahmen = ziel.querySelector("iframe");
    rahmen.src = pdf.vorschau;
    const herunterladen = ziel.querySelector("[data-pdf-download]");
    herunterladen.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const aktuell = await protokollPdfLink(terminId, ich);
        if (!aktuell) throw new Error("PDF-Protokoll wurde entfernt.");
        window.location.assign(aktuell.download);
      } catch (fehler) {
        ziel.querySelector("[data-pdf-fehler]").textContent = fehler.message;
      }
    });
    ziel.querySelector("[data-pdf-neuer-tab]").addEventListener("click", async (event) => {
      event.preventDefault();
      // Das Fenster muss in derselben Tippgeste entstehen; Safari blockiert
      // ein erst nach dem asynchronen Signieren geoeffnetes Fenster.
      const fenster = window.open("about:blank", "_blank");
      try {
        const aktuell = await protokollPdfLink(terminId, ich);
        if (!aktuell) throw new Error("PDF-Protokoll wurde entfernt.");
        if (fenster) {
          fenster.opener = null;
          fenster.location.replace(aktuell.vorschau);
        } else {
          window.location.assign(aktuell.vorschau);
        }
      } catch (fehler) {
        fenster?.close();
        ziel.querySelector("[data-pdf-fehler]").textContent = fehler.message;
      }
    });
  } catch (fehler) {
    ziel.hidden = false;
    ziel.querySelector("[data-pdf-fehler]").textContent = fehler.message;
  }
}

// Eine Terminantwort veraendert den verbindlichen Stand. Vor dem Senden
// steht deshalb noch einmal klar da, was gespeichert wird. Das Dialog-
// Element bleibt auf der aktuellen Seite und ist auch per Escape schliessbar.
function bestaetigeTerminantwort({ titel, text, bestaetigen }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "termin-dialog termin-bestaetigung";
    dialog.innerHTML = `<div class="dialog-kopf"><h2>${sicher(titel)}</h2><button type="button" class="dialog-schliessen" aria-label="Schließen">×</button></div>
      <p>${sicher(text)}</p>
      <div class="td-knopfpaar">
        <button type="button" class="td-knopf" data-nein>Zurück</button>
        <button type="button" class="td-senden" data-ja>${sicher(bestaetigen)}</button>
      </div>`;
    document.body.append(dialog);
    const fertig = (wert) => {
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(wert);
    };
    dialog.querySelector(".dialog-schliessen").addEventListener("click", () => fertig(false));
    dialog.querySelector("[data-nein]").addEventListener("click", () => fertig(false));
    dialog.querySelector("[data-ja]").addEventListener("click", () => fertig(true));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); fertig(false); });
    dialog.addEventListener("click", (event) => { if (event.target === dialog) fertig(false); });
    dialog.showModal();
  });
}

async function ladeTermine() {
  const ich = person();
  const [oeffentlich, eigene] = await Promise.allSettled([
    zugriff.alleOeffentlich(VEREIN.seitenschluessel),
    ich ? zugriff.alleFuerMitglied(ich, VEREIN.seitenschluessel) : Promise.resolve([]),
  ]);
  if (oeffentlich.status === "rejected" && (!ich || eigene.status === "rejected")) {
    throw new Error("Termine konnten nicht geladen werden");
  }
  return verbindeTerminSichten(
    oeffentlich.status === "fulfilled" ? oeffentlich.value : [],
    eigene.status === "fulfilled" ? eigene.value : [],
  );
}

// ---------- Liste ----------

function zeichneListe(termine, findungen, vorschlaege = []) {
  const ich = person();
  const { kuenftig, vergangen } = teileVergangenheitAb(termine);
  const hatAntworttermine = kuenftig.some((t) =>
    t.rueckmeldung_erforderlich === true);

  // Seit 25.09.2026 zaehlen nur Termine, auf die man wirklich noch
  // antworten kann - nicht mehr ein laufender Termin.
  const offen = kuenftig.filter((t) => t.mitgliedSicht
    && t.rueckmeldung_erforderlich === true && t.mein_status == null
    && t.absage_moeglich !== false).length;

  const kopf = `
    <h1 class="seiten-titel">Termine</h1>
    <p class="seiten-unter">
      Lehrabende, Lehrgänge und Treffen der Schiedsrichter-Abteilung.
      ${ich
        ? (offen > 0
            ? `<strong>${offen} ${offen === 1 ? "Termin wartet" : "Termine warten"} noch auf deine Rückmeldung.</strong>`
            : "Keine offenen Terminrückmeldungen.")
        : (hatAntworttermine
            ? "Melde dich an, um bei freigegebenen Terminen zu- oder abzusagen."
            : "Hier findest du die öffentlich freigegebenen Termine.")}
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

  const vorschlagHtml = ich ? `
    <section class="termin-aktionen" aria-labelledby="termin-mitgestalten">
      <div><h2 id="termin-mitgestalten">Einen Termin vorschlagen</h2><p>Du wünschst dir einen zusätzlichen Regelabend oder Treff? Schlag hier einen Tag dafür vor – der Obmann prüft ihn.</p></div>
      <button type="button" class="td-senden" data-vorschlag-oeffnen>Termin vorschlagen</button>
    </section>
    ${vorschlaege.length ? `<details class="eigene-vorschlaege"><summary>Meine Vorschläge (${vorschlaege.length})</summary>
      <div>${vorschlaege.map(v => `<div class="vorschlag-zeile"><span><strong>${sicher(v.titel)}</strong><small>${sicher(datumKurz(v.datum))}</small></span><span class="wortmarke">${sicher(({eingereicht:"Eingereicht",in_pruefung:"In Prüfung",angenommen:"Angenommen",abgelehnt:"Abgelehnt"})[v.status] || v.status)}</span>${v.obmann_rueckmeldung ? `<p>${sicher(v.obmann_rueckmeldung)}</p>` : ""}</div>`).join("")}</div></details>` : ""}` : "";

  bereich.innerHTML = `${kopf}
    ${vorschlagHtml}
    ${findungHtml}
    ${kuenftig.length ? kuenftigHtml : '<p class="keine">Zurzeit steht kein Termin an.</p>'}
    ${vergangenHtml}`;

  if (offeneFindungen.length) bindeStimmen();
  if (ich) bindeVorschlag();
}

function bindeVorschlag() {
  bereich.querySelector("[data-vorschlag-oeffnen]")?.addEventListener("click", () => {
    const dialog = document.createElement("dialog");
    dialog.className = "termin-dialog";
    dialog.innerHTML = `<form method="dialog" class="termin-vorschlag-form">
      <div class="dialog-kopf"><div><span class="wortmarke blau">Vorschlag</span><h2>Termin vorschlagen</h2></div><button type="button" class="dialog-schliessen" aria-label="Schließen">×</button></div>
      <p class="dialog-hilfe">Der Vorschlag wird nicht sofort veröffentlicht. Der Obmann prüft ihn zuerst.</p>
      <label><span>Titel</span><input name="titel" required minlength="3" maxlength="120" autocomplete="off"></label>
      <div class="formular-reihe"><label><span>Datum</span><input name="datum" type="date" required></label><label><span>Beginn (optional)</span><input name="zeit" type="time"></label></div>
      <label><span>Ort (optional)</span><input name="ort" maxlength="160"></label>
      <label><span>Warum ist der Termin sinnvoll?</span><textarea name="begruendung" required minlength="10" maxlength="1200" rows="4"></textarea></label>
      <p role="status" data-vorschlag-meldung></p><button type="submit" value="senden" class="td-senden">Zur Prüfung senden</button>
    </form>`;
    document.body.append(dialog); dialog.showModal();
    dialog.querySelector(".dialog-schliessen").addEventListener("click", () => dialog.close("abbrechen"));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("abbrechen");
    });
    dialog.addEventListener("close", () => dialog.remove());
    let sendet = false;
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      if (event.submitter?.value !== "senden") return;
      event.preventDefault();
      if (sendet) return;
      sendet = true;
      const senden = event.submitter;
      senden.disabled = true;
      const form = new FormData(event.currentTarget); const meldung = dialog.querySelector("[data-vorschlag-meldung]");
      try {
        await zugriff.vorschlagen(person(), { titel: form.get("titel"), datum: form.get("datum"), beginnZeit: form.get("zeit"), ort: form.get("ort"), begruendung: form.get("begruendung") });
        meldung.textContent = "Vorschlag gesendet. Danke fürs Mitdenken."; meldung.dataset.art = "erfolg";
        setTimeout(() => location.reload(), 700);
      } catch (fehler) {
        sendet = false;
        senden.disabled = false;
        meldung.textContent = `Vorschlag konnte nicht gesendet werden: ${fehler.message}`;
        meldung.dataset.art = "fehler";
      }
    });
  });
}

// Die drei Knoepfe je Vorschlag. Der Stand wird nach dem Klick nicht neu
// vom Server geholt: das waere ein zweiter Rundlauf fuer eine Zahl, die
// sich um genau eins aendert.
function bindeStimmen() {
  bereich.querySelectorAll("[data-antwort]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const karte = knopf.closest(".terminfindung");
      if (karte.dataset.sendet === "ja") return;
      karte.dataset.sendet = "ja";
      const meldung = karte.querySelector("[data-tf-meldung]");
      const vorschlag = knopf.dataset.vorschlag;
      const knoepfe = [...karte.querySelectorAll(`[data-vorschlag="${CSS.escape(vorschlag)}"]`)];
      knoepfe.forEach((k) => { k.disabled = true; });
      try {
        await zugriff.stimmen(person(), vorschlag, knopf.dataset.antwort);
      } catch (fehler) {
        meldung.textContent = `Antwort konnte nicht gespeichert werden: ${fehler.message}`;
        meldung.dataset.art = "fehler";
        meldung.hidden = false;
        delete karte.dataset.sendet;
        knoepfe.forEach((k) => { k.disabled = false; });
        return;
      }
      knoepfe.forEach((k) =>
        k.classList.toggle("an", k === knopf));
      meldung.textContent = "Antwort gespeichert.";
      meldung.dataset.art = "erfolg";
      meldung.hidden = false;
      delete karte.dataset.sendet;
      knoepfe.forEach((k) => { k.disabled = false; });
    });
  });
}

// ---------- Einzelansicht ----------

function zeichneDetail(termin, zusagen, protokoll = null) {
  const ich = person();
  // Nur ein ausdrueckliches `true` schaltet die Rueckmeldung frei. Damit
  // koennen ein fehlendes Feld, alte Datensaetze oder `null` niemals
  // versehentlich eine Zu-/Absage-Abfrage einblenden.
  const brauchtAntwort = termin.rueckmeldung_erforderlich === true;
  const darfAntworten = Boolean(ich && termin.mitgliedSicht && brauchtAntwort);
  const darfInterneDatenSehen = Boolean(darfAntworten && termin.eigenerVerein);
  const zeit = zeitspanne(termin);

  const marken = [
    termin.pflicht ? '<span class="wortmarke gelb">Pflicht</span>' : "",
    `<span class="wortmarke hell">${sicher(ARTEN[termin.art] || ARTEN.sonstiges)}</span>`,
  ].filter(Boolean).join("");

  const zeilen = [
    zeit ? ["Wann", `${sicher(datumLang(termin.datum))}<br><span class="td-neben">${sicher(zeit)}</span>`]
         : ["Wann", sicher(datumLang(termin.datum))],
    termin.ort ? ["Ort", sicher(termin.ort)] : null,
    brauchtAntwort && termin.rueckmeldung_bis && !termin.vergangen
      ? ["Antwort bis", sicher(datumLang(termin.rueckmeldung_bis))
          + (termin.rueckmeldefrist_abgelaufen === true ? ' <span class="td-neben">(abgelaufen)</span>' : "")]
      : null,
    termin.beschreibung ? ["Thema", sicher(termin.beschreibung)] : null,
  ].filter(Boolean).map(([titel, wert]) =>
    `<div class="td-zeile"><div class="td-l">${titel}</div><div class="td-v">${wert}</div></div>`
  ).join("");

  // Der Antwortbereich haengt an drei Bedingungen. Sie hier einmal
  // auszuformulieren ist klarer als drei ineinandergeschachtelte Fragen
  // im Markup.
  let antwort;
  if (!brauchtAntwort) {
    antwort = '<p class="td-abgelaufen">Dieser Termin dient nur zur Information. Eine Zu- oder Absage ist nicht erforderlich.</p>';
  } else if (termin.vergangen) {
    antwort = '<p class="td-abgelaufen">Dieser Termin ist vorbei.</p>';
  } else if (darfAntworten && termin.absage_moeglich === false) {
    antwort = '<p class="td-abgelaufen">Der Termin hat bereits begonnen. Eine Zu- oder Absage ist nicht mehr möglich.</p>';
  } else if (!ich) {
    antwort = `
      <p class="td-frage">Bist du dabei?</p>
      <button type="button" class="td-senden" data-anmelden>
        Zum Antworten anmelden
      </button>`;
  } else if (!darfAntworten) {
    // Es liegt zwar noch eine lokale Anmeldung vor, der Server konnte sie
    // aber nicht als personalisierte Terminsicht bestaetigen (z. B. alte
    // PIN). Ohne diese Bestaetigung darf kein Schreibweg angeboten werden.
    antwort = `
      <p class="td-abgelaufen">Deine Anmeldung konnte für diesen Termin nicht bestätigt werden.</p>
      <button type="button" class="td-senden" data-anmelden>Erneut anmelden</button>`;
  } else {
    const jaAn = termin.mein_status === "zu" ? " an" : "";
    const neinAn = termin.mein_status === "ab" ? " an" : "";
    // Nach der Rueckmeldefrist nimmt der Server keine neue Zusage mehr an;
    // absagen geht bis zum Beginn. Der Knopf verschwindet nicht
    // kommentarlos, sondern bleibt mit Begruendung sichtbar.
    const zusageZu = zusageGesperrt(termin);
    antwort = `
      <p class="td-frage">Bist du dabei?</p>
      <p class="td-frist-hinweis" data-frist-hinweis ${zusageZu ? "" : "hidden"}>Die Rückmeldefrist ist abgelaufen. Absagen geht weiterhin; für eine Zusage sprich bitte direkt den Obmann an.</p>
      <div class="td-knopfpaar">
        <button type="button" class="td-knopf ja${jaAn}" data-status="zu"${zusageZu ? " disabled" : ""}>Ja, ich komme</button>
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
  const teilnehmer = darfInterneDatenSehen && zusagen.length ? `
    <div class="td-teilnehmer">
      <p class="td-teilnehmer-titel">Dabei · ${zusagen.length}</p>
      <div class="td-namen">${zusagen.map((z) =>
        `<span class="td-name">${sicher(z.name)}</span>`).join("")}</div>
    </div>` : "";

  const protokollHtml = protokoll?.inhalt ? `<section class="termin-protokoll"><span class="wortmarke blau">Für Mitglieder</span><h2>${sicher(protokoll.titel || "Protokoll")}</h2><div class="protokoll-text">${sicher(protokoll.inhalt).replace(/\n/g,"<br>")}</div></section>` : "";
  const pdfHtml = ich && termin.mitgliedSicht && termin.eigenerVerein
    ? `<section id="termin-pdf" class="termin-protokoll termin-pdf" hidden>
        <span class="wortmarke blau">Für Mitglieder</span><h2>Protokoll als PDF</h2>
        <p data-pdf-name></p><p data-pdf-fehler role="status"></p>
        <div class="termin-pdf-aktionen"><a href="#" data-pdf-neuer-tab>In neuem Tab öffnen</a>
          <a href="#" data-pdf-download>PDF herunterladen</a></div>
        <iframe title="Vorschau des Terminprotokolls" loading="lazy"></iframe>
      </section>` : "";
  bereich.innerHTML = `
    <article class="termindetail">
      <header class="td-kopf">
        <p class="td-wann">${sicher(datumLang(termin.datum))}</p>
        <h1>${sicher(termin.titel)}</h1>
        ${marken ? `<div class="td-marken">${marken}</div>` : ""}
      </header>
      <div class="td-body">
        ${zeilen}
        <button type="button" class="td-kalender" data-kalender>
          <span aria-hidden="true">＋</span> Zum Kalender hinzufügen
        </button>
      ${antwort}
      ${protokollHtml}
      ${pdfHtml}
        ${teilnehmer}
      </div>
    </article>`;

  bereich.querySelector("[data-kalender]")?.addEventListener("click", () =>
    ladeTerminInKalender(termin, location.href));
  if (pdfHtml) void zeigePdfProtokoll(termin.id, ich);
  if (darfAntworten && !termin.vergangen && termin.absage_moeglich !== false) bindeAntwort(termin);
}

// Eine eigene, bereits bestehende Zusage darf man nach der Frist erneut
// bestaetigen - nur eine NEUE Zusage ist gesperrt.
function zusageGesperrt(termin) {
  return termin.zusage_moeglich === false && termin.mein_status !== "zu";
}

function bindeAntwort(termin) {
  const grundbox = bereich.querySelector("[data-grundbox]");
  const meldung = bereich.querySelector("[data-meldung]");
  let gewaehlterGrund = termin.mein_grund || null;
  let sendet = false;

  const zeige = (text, art = "info") => {
    meldung.textContent = text;
    meldung.dataset.art = art;
    meldung.hidden = false;
  };

  async function sende(status, grund, kommentar) {
    if (sendet) return false;
    sendet = true;
    const knoepfe = [...bereich.querySelectorAll("[data-status], [data-absage-senden]")];
    knoepfe.forEach((k) => { k.disabled = true; });
    try {
      await zugriff.melden(person(), termin.id, status, grund, kommentar);
      // Den lokalen Stand mitziehen, damit ein zweiter Klick nicht mit
      // veralteten Werten arbeitet.
      termin.mein_status = status;
      termin.mein_grund = status === "ab" ? grund : null;
      termin.mein_kommentar = status === "ab" ? kommentar : null;
      // Wer nach der Frist absagt, kann nicht mehr selbst zusagen - genau
      // wie der Server es sieht.
      if (termin.rueckmeldefrist_abgelaufen === true && status === "ab") termin.zusage_moeglich = false;
      return true;
    } catch (fehler) {
      zeige(`Antwort konnte nicht gespeichert werden: ${fehler.message}`, "fehler");
      return false;
    } finally {
      sendet = false;
      const gesperrt = zusageGesperrt(termin);
      knoepfe.forEach((k) => { k.disabled = k.dataset.status === "zu" && gesperrt; });
      const hinweis = bereich.querySelector("[data-frist-hinweis]");
      if (hinweis) hinweis.hidden = !gesperrt;
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
      const bestaetigt = await bestaetigeTerminantwort({
        titel: "Zusage bestätigen",
        text: `Du sagst für „${termin.titel}“ verbindlich zu.`,
        bestaetigen: "Zusage speichern",
      });
      if (!bestaetigt) return;
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
    const bestaetigt = await bestaetigeTerminantwort({
      titel: "Absage bestätigen",
      text: `Du sagst für „${termin.titel}“ ab.`,
      bestaetigen: "Absage speichern",
    });
    if (!bestaetigt) return;
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
  richteDetailRueckwegEin();
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
  let findungen = [], vorschlaege = [];
  if (person() && !gewaehlteId) {
    try { findungen = await zugriff.terminfindungen(person()); } catch { findungen = []; }
    try { vorschlaege = await zugriff.eigeneVorschlaege(person()); } catch { vorschlaege = []; }
  }

  if (gewaehlteId) {
    const termin = termine.find((t) => t.id === gewaehlteId);
    if (!termin) {
      bereich.innerHTML = `
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
    if (ich && termin.mitgliedSicht && termin.eigenerVerein
        && termin.rueckmeldung_erforderlich === true) {
      // Scheitert das, ist der Termin trotzdem anzeigbar - nur die
      // Namensliste fehlt dann.
      try { zusagen = await zugriff.zusagen(ich, termin.id); } catch { zusagen = []; }
    }
    let protokoll = null;
    if (ich && termin.mitgliedSicht && termin.eigenerVerein) {
      try { protokoll = (await zugriff.protokoll(ich, termin.id))[0] || null; } catch {}
    }
    zeichneDetail(termin, zusagen, protokoll);
    bindeAnmeldeKnoepfe();
    return;
  }

  zeichneListe(termine, findungen, vorschlaege);
  bindeAnmeldeKnoepfe();
}

void start();
