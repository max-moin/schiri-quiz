// ============================================================
//  Obmann-Bereich: Freigabe durch den Vorstand
// ------------------------------------------------------------
//  Drei Dinge an einer Stelle, in der Reihenfolge, in der man sie
//  braucht:
//    1. offene Anfragen - Preis prüfen, dem Vorstand vorlegen
//    2. der Freigabe-Link für das Vorstandsmitglied
//    3. die Richtpreise des Vereins
//
//  Diese Funktionen laufen über das gemeinsame Obmann-Passwort
//  (siehe obmann-passwort.js), nicht über Supabase Auth - dieselbe
//  Tür wie die Terminsuche und die Swift-App.
// ============================================================
import { erstellePasswortSchloss } from "./obmann-passwort.js";
import { setzeStatus } from "./editor-ui.js";
import { druckeListe } from "./freigabe-druck.js";

const sicher = (wert) => String(wert ?? "").replace(/[&<>"']/g,
  (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

const euro = (cent) => (cent === null || cent === undefined)
  ? null : (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

const datum = (wert) => wert ? new Date(wert).toLocaleDateString("de-DE") : "";

/** "12,50" oder "12.50" oder "12" -> 1250. Leer -> null. */
export function centAusEingabe(text) {
  const roh = String(text ?? "").trim().replace(/[€\s]/g, "").replace(",", ".");
  if (!roh) return null;
  const zahl = Number(roh);
  if (!Number.isFinite(zahl) || zahl < 0) throw new Error("Bitte einen Betrag wie 35 oder 35,50 eingeben.");
  return Math.round(zahl * 100);
}

const STAND = {
  nicht_vorgelegt: "noch nicht vorgelegt",
  vorgelegt: "beim Vorstand",
  freigegeben: "freigegeben",
  abgelehnt: "abgelehnt",
};

const GERUEST = `
  <div class="admin-bereich-einstieg">
    <div><h2>Freigabe durch den Vorstand</h2>
      <p>Anfragen vorlegen, Richtpreise pflegen und den Link für das Vorstandsmitglied verwalten.</p></div>
    <span class="admin-bereich-status">Mit Obmann-Passwort</span>
  </div>
  <div class="admin-meldung" data-inhalt-status role="status"></div>
  <form class="admin-passwort" data-passwort-form hidden>
    <label>Obmann-Passwort<input type="password" autocomplete="current-password" data-passwort /></label>
    <button class="knopf knopf-primaer" type="submit">Öffnen</button>
  </form>
  <div data-freigabe-inhalt hidden></div>
  <div class="druckblatt" data-druckblatt aria-hidden="true"></div>`;

export function erstelleFreigabeEditor({ wurzel, client, verein }) {
  wurzel.innerHTML = GERUEST;
  const inhalt = wurzel.querySelector("[data-freigabe-inhalt]");
  const form = wurzel.querySelector("[data-passwort-form]");

  const schloss = erstellePasswortSchloss({
    pruefe: async (kandidat) => {
      const { error } = await client.rpc("obmann_freigabe_anfragen", { p_passwort: kandidat });
      if (error) throw new Error(error.message || "Das Obmann-Passwort stimmt nicht.");
    },
  });

  const rufe = async (name, parameter) => {
    const { data, error } = await client.rpc(name, { p_passwort: schloss.wert(), ...parameter });
    if (error) throw new Error(error.message);
    return data;
  };

  let anfragen = [];
  let links = [];
  let preise = [];
  // Der frisch erzeugte Token steht genau einmal zur Verfügung. Er wird
  // deshalb hier gehalten, bis die Ansicht neu gebaut wird - danach ist
  // er weg, auch für uns.
  let neuerLink = null;

  async function laden() {
    [anfragen, links, preise] = await Promise.all([
      rufe("obmann_freigabe_anfragen"),
      rufe("obmann_freigabe_links"),
      rufe("obmann_ausruestung_preise"),
    ]);
    zeichne();
  }

  async function mit(text, arbeit) {
    try {
      setzeStatus(wurzel, text);
      await arbeit();
      await laden();
      setzeStatus(wurzel, "Gespeichert.", "erfolg");
    } catch (fehler) {
      setzeStatus(wurzel, fehler.message, "fehler");
    }
  }

  function anfrageHtml(a) {
    const stueck = [a.bezeichnung, a.farbe, a.groesse && `Größe ${a.groesse}`,
      a.aermellaenge && `${a.aermellaenge}er Arm`].filter(Boolean).join(" · ");
    const offen = a.freigabe_status === "nicht_vorgelegt";
    return `
      <tr data-id="${sicher(a.id)}">
        <td><strong>${sicher(stueck)}</strong><br /><small>${sicher(a.person)} · ${datum(a.erstellt_am)}</small>
          ${a.anmerkung ? `<br /><small><em>${sicher(a.anmerkung)}</em></small>` : ""}</td>
        <td><input class="admin-cent" data-preis value="${a.preis_cent != null ? (a.preis_cent / 100).toFixed(2).replace(".", ",") : ""}"
              placeholder="${a.preis_richtwert_cent != null ? (a.preis_richtwert_cent / 100).toFixed(2).replace(".", ",") : "—"}" />
          <small>${sicher({ obmann: "von dir", schiri: "vom Schiri", richtwert: "Richtwert", unbekannt: "kein Preis" }[a.preis_quelle])}</small></td>
        <td><span class="admin-stand" data-stand="${sicher(a.freigabe_status)}">${sicher(STAND[a.freigabe_status])}</span>
          ${a.freigabe_name ? `<br /><small>${sicher(a.freigabe_name)}, ${datum(a.freigabe_am)}</small>` : ""}
          ${a.freigabe_notiz ? `<br /><small><em>${sicher(a.freigabe_notiz)}</em></small>` : ""}</td>
        <td class="admin-tat">
          <button type="button" class="knopf" data-preis-speichern>Preis</button>
          ${offen ? `<button type="button" class="knopf knopf-primaer" data-vorlegen>Vorlegen</button>`
                  : a.freigabe_status === "vorgelegt"
                    ? `<button type="button" class="knopf" data-zurueckziehen>Zurückziehen</button>` : ""}
        </td>
      </tr>`;
  }

  function preisHtml(p) {
    return `
      <tr data-kategorie="${sicher(p.kategorie)}">
        <td>${sicher(p.bezeichnung)}</td>
        <td><input class="admin-cent" data-richtwert
              value="${p.richtwert_cent != null ? (p.richtwert_cent / 100).toFixed(2).replace(".", ",") : ""}"
              placeholder="—" /></td>
        <td class="admin-tat"><button type="button" class="knopf" data-richtwert-speichern>Sichern</button></td>
      </tr>`;
  }

  function linkHtml(l) {
    const dauerhaft = !l.gueltig_bis;
    const abgelaufen = !dauerhaft && new Date(l.gueltig_bis) < new Date();
    const tot = l.widerrufen_am || abgelaufen;
    return `
      <tr data-id="${sicher(l.id)}">
        <td>${sicher(l.beschriftung || "ohne Beschriftung")}<br />
          <small>erstellt ${datum(l.erstellt_am)}${l.zuletzt_genutzt_am ? ` · zuletzt benutzt ${datum(l.zuletzt_genutzt_am)}` : " · noch nie benutzt"}</small></td>
        <td>${l.widerrufen_am ? "widerrufen" : abgelaufen ? "abgelaufen"
          : dauerhaft ? "dauerhaft · bis zum Widerruf" : `gültig bis ${datum(l.gueltig_bis)}`}</td>
        <td class="admin-tat">${tot ? "" : `<button type="button" class="knopf" data-link-widerrufen>Widerrufen</button>`}</td>
      </tr>`;
  }

  function zeichne() {
    const offeneSumme = anfragen
      .filter((a) => a.freigabe_status === "vorgelegt")
      .reduce((s, a) => s + (a.preis_cent || 0), 0);

    inhalt.innerHTML = `
      <section class="admin-panel">
        <div class="admin-panel-kopf"><h2>Anfragen</h2>
          <p>${anfragen.length} offen · beim Vorstand liegen ${euro(offeneSumme)}</p></div>
        ${anfragen.length ? `<table class="admin-tabelle">
          <thead><tr><th>Stück</th><th>Preis</th><th>Stand</th><th></th></tr></thead>
          <tbody>${anfragen.map(anfrageHtml).join("")}</tbody></table>`
          : `<p class="admin-leer">Zurzeit keine offene Ausrüstungsanfrage.</p>`}
      </section>

      <section class="admin-panel">
        <div class="admin-panel-kopf"><h2>Zugang für Verantwortliche</h2>
          <p>Ein persönlicher Dauerzugang kann gespeichert werden und gilt, bis du ihn widerrufst.</p></div>
        <div class="admin-text-form">
          <label>Name<input data-dauer-name autocomplete="name" placeholder="z. B. Tom Mustermann" /></label>
          <label>Rolle<input data-dauer-rolle value="Finanzen / Vorstand" /></label>
          <div class="admin-breit"><button type="button" class="knopf knopf-primaer" data-dauer-erstellen>
            Persönlichen Dauerzugang erzeugen</button></div>
          ${neuerLink ? `<div class="admin-breit admin-token">
            <b>Diesen Link jetzt weitergeben – er wird nicht noch einmal angezeigt:</b>
            <code>${sicher(neuerLink)}</code>
          </div>` : ""}
        </div>
        <details class="admin-aufklapper">
          <summary><span><b>Befristeten Einmal-Link erzeugen</b><small>Für eine einzelne Übergabe oder Vertretung.</small></span></summary>
          <div class="admin-text-form">
            <label>Beschriftung<input data-link-name placeholder="z. B. Vertretung Kassenwart" /></label>
            <label>Gültig für … Tage<input data-link-tage type="number" min="1" max="365" value="30" /></label>
            <div class="admin-breit"><button type="button" class="knopf" data-link-erstellen>Befristeten Link erzeugen</button></div>
          </div>
        </details>
        ${links.length ? `<table class="admin-tabelle">
          <thead><tr><th>Link</th><th>Stand</th><th></th></tr></thead>
          <tbody>${links.map(linkHtml).join("")}</tbody></table>` : ""}
      </section>

      <section class="admin-panel">
        <div class="admin-panel-kopf"><h2>Liste zum Weitergeben</h2>
          <p>Wenn der Link nicht in Frage kommt: ein Blatt zum Ausdrucken oder als PDF sichern
            – mit Kästchen zum Ankreuzen und Unterschriftszeile.</p></div>
        <div class="admin-text-form">
          <div class="admin-breit">
            <button type="button" class="knopf" data-liste-drucken>Liste drucken oder als PDF sichern</button>
          </div>
          <p class="admin-hinweis admin-breit">Im Druckdialog gibt es unten links
            „PDF" → „Als PDF sichern". Gedruckt werden alle Anfragen, über die noch
            nicht entschieden wurde.</p>
        </div>
      </section>

      <!-- Zugeklappt voreingestellt (Max, 21.09.2026: "Ich muss das ja
           nicht immer sehen"). Die Richtwerte aendert man selten, die
           Anfragen darueber dagegen staendig. Gleiches Muster wie die
           anderen Aufklapper im Obmann-Bereich. -->
      <details class="admin-panel admin-aufklapper">
        <summary><span><b>Richtpreise</b><small>Werden beim Anlegen einer Anfrage als Hausnummer
          übernommen. Leer heißt: kein Richtwert.</small></span></summary>
        <table class="admin-tabelle">
          <thead><tr><th>Stück</th><th>Richtwert</th><th></th></tr></thead>
          <tbody>${preise.map(preisHtml).join("")}</tbody></table>
      </details>`;
    verdrahte();
  }

  function verdrahte() {
    inhalt.querySelectorAll("[data-preis-speichern]").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        const zeile = knopf.closest("tr");
        mit("Preis wird gesichert …", async () => {
          const cent = centAusEingabe(zeile.querySelector("[data-preis]").value);
          await rufe("obmann_anfrage_preis_setzen", { p_id: zeile.dataset.id, p_preis_final_cent: cent });
        });
      });
    });

    inhalt.querySelectorAll("[data-vorlegen], [data-zurueckziehen]").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        const zeile = knopf.closest("tr");
        const vorlegen = knopf.hasAttribute("data-vorlegen");
        // Seit v150 sind das zwei verschiedene Vorgänge: Vorlegen friert
        // den Betrag ein und bindet die Anfrage an genau einen
        // Freigabe-Link. Zurückziehen setzt sie auf "geprüft" zurück -
        // und macht damit eine spätere Freigabe wieder nötig.
        mit(vorlegen ? "Wird vorgelegt …" : "Wird zurückgezogen …", () =>
          vorlegen
            ? rufe("obmann_anfrage_vorlegen", { p_id: zeile.dataset.id })
            : rufe("obmann_anfrage_schritt", { p_id: zeile.dataset.id, p_schritt: "geprueft" }));
      });
    });

    inhalt.querySelectorAll("[data-richtwert-speichern]").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        const zeile = knopf.closest("tr");
        const kategorie = zeile.dataset.kategorie;
        const eintrag = preise.find((p) => p.kategorie === kategorie);
        mit("Richtwert wird gesichert …", async () => {
          const cent = centAusEingabe(zeile.querySelector("[data-richtwert]").value);
          await rufe("obmann_ausruestung_preis_speichern", {
            p_kategorie: kategorie, p_bezeichnung: eintrag.bezeichnung,
            p_richtwert_cent: cent, p_aktiv: eintrag.aktiv,
          });
        });
      });
    });

    inhalt.querySelector("[data-dauer-erstellen]")?.addEventListener("click", () => {
      const name = inhalt.querySelector("[data-dauer-name]").value.trim();
      const rolle = inhalt.querySelector("[data-dauer-rolle]").value.trim();
      if (name.length < 2 || rolle.length < 2) {
        setzeStatus(wurzel, "Bitte Name und Rolle des Verantwortlichen eintragen.", "fehler");
        return;
      }
      mit("Dauerzugang wird erzeugt …", async () => {
        const token = await rufe("obmann_verantwortlichen_zugang_erstellen", {
          p_name: name, p_rolle: rolle,
        });
        neuerLink = `${location.origin}/freigabe.html?code=${token}`;
      });
    });

    inhalt.querySelector("[data-link-erstellen]")?.addEventListener("click", () => {
      const beschriftung = inhalt.querySelector("[data-link-name]").value;
      const tage = Number(inhalt.querySelector("[data-link-tage]").value) || 30;
      mit("Link wird erzeugt …", async () => {
        const token = await rufe("obmann_freigabe_link_erstellen", {
          p_tage: tage, p_beschriftung: beschriftung,
        });
        neuerLink = `${location.origin}/freigabe.html?code=${token}`;
      });
    });

    inhalt.querySelector("[data-liste-drucken]")?.addEventListener("click", () => {
      const offene = anfragen.filter((a) => a.freigabe_status !== "freigegeben"
        && a.freigabe_status !== "abgelehnt");
      if (!offene.length) {
        setzeStatus(wurzel, "Es liegt gerade keine unentschiedene Anfrage vor.", "fehler");
        return;
      }
      druckeListe(wurzel.querySelector("[data-druckblatt]"), anfragen, verein?.name || "");
    });

    inhalt.querySelectorAll("[data-link-widerrufen]").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        const zeile = knopf.closest("tr");
        mit("Link wird widerrufen …", () =>
          rufe("obmann_freigabe_link_widerrufen", { p_id: zeile.dataset.id }));
      });
    });
  }

  form.hidden = false;
  form.addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault();
    const feld = form.querySelector("[data-passwort]");
    try {
      setzeStatus(wurzel, "Wird geprüft …");
      await schloss.oeffnen(feld.value);
      feld.value = "";
      form.hidden = true;
      inhalt.hidden = false;
      await laden();
      setzeStatus(wurzel, "");
    } catch (fehler) {
      setzeStatus(wurzel, fehler.message, "fehler");
    }
  });
}
