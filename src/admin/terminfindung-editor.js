// ============================================================
//  Terminsuche verwalten (Obmann-Zugang)
// ============================================================
//  Die Terminfindung aus v91 hatte bisher nur eine Teilnehmerseite. Wer
//  eine Abstimmung anlegen, einen Tippfehler korrigieren oder nachsehen
//  wollte, wer noch nicht geantwortet hat, konnte es nirgends - der
//  offene Punkt "Terminfindung fuer den Obmann" aus dem Backlog.
//
//  Zuschnitt nach Max' Arbeitsweise: die Weboberflaeche benutzt er, wenn
//  ihn jemand auf einen Fehler hinweist; das Tagesgeschaeft laeuft in der
//  Swift-App. Deshalb liegt der Schwerpunkt hier auf Textpflege,
//  Uebersicht, Korrektur und Export - also genau dem, was mit Tastatur
//  und grossem Bildschirm leichter geht als am Handy.
//
//  Rechnen und Serverzugriff stehen bewusst nicht hier, sondern in
//  terminfindung-daten.js; diese Datei baut nur Oberflaeche.
// ============================================================

import { setzeStatus } from "./editor-ui.js";
import { erstellePasswortSchloss } from "./obmann-passwort.js";
import {
  bilanz,
  csvAusStand,
  csvDateiname,
  datumZahlen,
  empfehlung,
  erinnerungsText,
  erstelleTerminfindungZugriff,
  offeneNamen,
  vorschlagLangText,
} from "./terminfindung-daten.js";

const ARTEN = [
  ["event", "Event"],
  ["treff", "Treff"],
  ["lehrabend", "Lehrabend"],
  ["lehrgang", "Lehrgang"],
  ["sonstiges", "Sonstiges"],
];

const STATUS_TEXT = {
  offen: "Läuft",
  entschieden: "Entschieden",
  abgebrochen: "Abgebrochen",
};

const GERUEST = `
  <div class="admin-bereich-einstieg">
    <div>
      <h2>Terminsuche</h2>
      <p>Abstimmungen anlegen, Texte korrigieren, Stand auswerten und den Termin festlegen.</p>
    </div>
    <span class="admin-bereich-status">Zusätzlich mit Obmann-Passwort</span>
  </div>
  <div class="admin-meldung" data-inhalt-status role="status"></div>

  <section class="admin-panel" data-tf-schloss>
    <div class="admin-panel-kopf">
      <h2>Obmann-Passwort</h2>
      <p>Die Terminsuche liegt in derselben Vereinsdatenbank wie die Swift-App und ist dort zusätzlich mit dem Obmann-Passwort geschützt. Es wird nur im Arbeitsspeicher gehalten und nach jedem Neuladen erneut abgefragt.</p>
    </div>
    <form class="admin-neue-liga" data-tf-schloss-form>
      <label>Obmann-Passwort<input name="passwort" type="password" autocomplete="off" required /></label>
      <button class="knopf knopf-primaer" type="submit">Terminsuche öffnen</button>
    </form>
  </section>

  <div data-tf-inhalt hidden>
    <div data-tf-liste></div>

    <details class="admin-panel admin-aufklapper">
      <summary><span><b>Neue Terminsuche anlegen</b><small>Zwei bis acht Vorschläge, über die abgestimmt wird</small></span></summary>
      <form data-tf-neu-form>
        <div class="admin-neue-liga">
          <label class="admin-breit">Titel<input name="titel" required /></label>
          <label class="admin-breit">Beschreibung<textarea name="beschreibung" rows="3"></textarea></label>
          <label>Antwort bis<input name="antwortBis" type="date" /></label>
        </div>
        <div class="admin-tf-vorschlagszeilen" data-tf-neu-zeilen></div>
        <div class="admin-tf-formularfuss">
          <button class="knopf" type="button" data-tf-zeile-mehr>Weiteren Vorschlag ergänzen</button>
          <button class="knopf knopf-primaer" type="submit">Terminsuche anlegen</button>
        </div>
      </form>
    </details>

    <div class="admin-aktionsleiste">
      <button class="knopf" type="button" data-tf-aktualisieren>Neu laden</button>
      <button class="knopf" type="button" data-tf-abmelden>Passwort vergessen</button>
    </div>
  </div>`;

// ---------- kleine Bausteine ----------

const el = (tag, klasse, text) => {
  const knoten = document.createElement(tag);
  if (klasse) knoten.className = klasse;
  if (text !== undefined) knoten.textContent = text;
  return knoten;
};

function knopf(text, klasse = "admin-mini-knopf") {
  const k = el("button", klasse, text);
  k.type = "button";
  return k;
}

function feld(beschriftung, eingabe) {
  const label = el("label");
  label.append(document.createTextNode(beschriftung), eingabe);
  return label;
}

/* Ankreuzfeld: Kaestchen zuerst, Beschriftung dahinter. Getrennt von
   feld(), weil dort die Beschriftung ueber dem Eingabefeld steht - bei
   einer Checkbox waere das eine leere Zeile mit einem Haken darunter. */
function ankreuzfeld(beschriftung) {
  const kasten = document.createElement("input");
  kasten.type = "checkbox";
  const label = el("label", "admin-checkbox");
  label.append(kasten, document.createTextNode(` ${beschriftung}`));
  return { label, kasten };
}

function eingabefeld(typ, wert = "") {
  const input = document.createElement("input");
  input.type = typ;
  input.value = wert ?? "";
  return input;
}

/* Eine Zeile des Vorschlagsformulars. Wird sowohl beim Anlegen (mehrfach)
   als auch beim Nachtragen (einmal) benutzt. */
function vorschlagsZeile({ mitEntfernen = true, beiEntfernen } = {}) {
  const zeile = el("div", "admin-tf-vorschlagszeile");
  const datum = eingabefeld("date");
  datum.required = true;
  datum.name = "datum";
  const zeit = eingabefeld("time");
  zeit.name = "beginnZeit";
  const ort = eingabefeld("text");
  ort.name = "ort";
  zeile.append(feld("Datum", datum), feld("Uhrzeit (optional)", zeit), feld("Ort (optional)", ort));
  if (mitEntfernen) {
    const weg = knopf("Zeile entfernen", "admin-icon-knopf");
    weg.addEventListener("click", () => beiEntfernen?.(zeile));
    zeile.append(weg);
  }
  return { zeile, datum, zeit, ort };
}

function textAusZeile({ datum, zeit, ort }) {
  return {
    datum: datum.value || null,
    beginn_zeit: zeit.value || null,
    ort: ort.value.trim() || null,
  };
}

// ---------- Editor ----------

export function erstelleTerminfindungEditor({ wurzel, client }) {
  wurzel.innerHTML = GERUEST;

  const schlossBereich = wurzel.querySelector("[data-tf-schloss]");
  const inhalt = wurzel.querySelector("[data-tf-inhalt]");
  const liste = wurzel.querySelector("[data-tf-liste]");

  const schloss = erstellePasswortSchloss({
    // Der Prueflauf ist derselbe lesende Aufruf, den die Liste ohnehin
    // braucht. So gibt es keinen zweiten Weg, der anders scheitern kann.
    pruefe: async (kandidat) => {
      const { error } = await client.rpc("obmann_terminfindungen", { p_passwort: kandidat });
      if (error) throw new Error(error.message || "Das Obmann-Passwort stimmt nicht.");
    },
  });

  const zugriff = erstelleTerminfindungZugriff({ client, passwort: () => schloss.wert() });

  let findungen = [];

  async function mitMeldung(text, arbeit) {
    try {
      setzeStatus(wurzel, text);
      await arbeit();
      return true;
    } catch (fehler) {
      setzeStatus(wurzel, fehler.message, "fehler");
      return false;
    }
  }

  async function neuLaden(meldung = "") {
    return mitMeldung("Terminsuchen werden geladen …", async () => {
      findungen = (await zugriff.liste()) || [];
      rendern();
      setzeStatus(wurzel, meldung || (findungen.length
        ? `${findungen.length} Terminsuche${findungen.length === 1 ? "" : "n"} geladen.`
        : "Noch keine Terminsuche angelegt."), meldung ? "erfolg" : "info");
    });
  }

  // ---------- Karte einer Terminsuche ----------

  function vorschlagsTabelle(findung, vorschlaege, empfohlen) {
    const huelle = el("div", "admin-tf-tabelle-huelle");
    const tabelle = el("table", "admin-tf-tabelle");
    const kopf = el("thead");
    const kopfzeile = el("tr");
    for (const titel of ["Vorschlag", "Ja", "Vielleicht", "Nein", ""]) {
      kopfzeile.append(el("th", null, titel));
    }
    kopf.append(kopfzeile);
    const koerper = el("tbody");

    vorschlaege.forEach((vorschlag) => {
      const zeile = el("tr");
      if (empfohlen && vorschlag.id === empfohlen.id) zeile.dataset.empfohlen = "ja";
      if (findung.gewaehlter_vorschlag === vorschlag.id) zeile.dataset.gewaehlt = "ja";

      const erste = el("td");
      erste.append(el("strong", null, vorschlagLangText(vorschlag)));
      const namen = Array.isArray(vorschlag.namen_ja) ? vorschlag.namen_ja : [];
      if (namen.length) erste.append(el("span", "admin-tf-namen", `Ja: ${namen.join(", ")}`));
      zeile.append(erste);

      const zahlen = bilanz(vorschlag);
      for (const wert of [zahlen.ja, zahlen.vielleicht, zahlen.nein]) {
        zeile.append(el("td", "admin-tf-zahl", String(wert)));
      }

      const aktion = el("td", "admin-tf-zeilenaktion");
      if (findung.status === "offen" && vorschlaege.length > 2) {
        const weg = knopf("Zurücknehmen", "admin-icon-knopf");
        weg.addEventListener("click", async () => {
          const stimmen = zahlen.ja + zahlen.vielleicht + zahlen.nein;
          const zusatz = stimmen
            ? `\n\nDabei gehen ${stimmen} bereits abgegebene Stimme${stimmen === 1 ? "" : "n"} zu diesem Vorschlag verloren.`
            : "";
          if (!window.confirm(`„${vorschlagLangText(vorschlag)}“ wirklich von der Wahl nehmen?${zusatz}`)) return;
          await mitMeldung("Vorschlag wird zurückgenommen …", async () => {
            await zugriff.vorschlagEntfernen(vorschlag.id);
            await neuLaden("Vorschlag zurückgenommen.");
          });
        });
        aktion.append(weg);
      }
      zeile.append(aktion);
      koerper.append(zeile);
    });

    tabelle.append(kopf, koerper);
    huelle.append(tabelle);
    return huelle;
  }

  function textePflege(findung) {
    const box = el("details", "admin-tf-werkzeug");
    box.append(el("summary", null, "Texte und Frist korrigieren"));
    const form = el("form", "admin-neue-liga");

    const titel = eingabefeld("text", findung.titel || "");
    titel.required = true;
    const beschreibung = document.createElement("textarea");
    beschreibung.rows = 3;
    beschreibung.value = findung.beschreibung || "";
    const frist = eingabefeld("date", findung.antwort_bis || "");

    const titelFeld = feld("Titel", titel);
    titelFeld.className = "admin-breit";
    const beschreibungFeld = feld("Beschreibung", beschreibung);
    beschreibungFeld.className = "admin-breit";

    form.append(titelFeld, beschreibungFeld, feld("Antwort bis", frist));
    const speichern = el("button", "knopf knopf-primaer", "Änderungen speichern");
    speichern.type = "submit";
    form.append(speichern);

    form.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      await mitMeldung("Änderungen werden gespeichert …", async () => {
        await zugriff.bearbeiten({
          findungId: findung.id,
          titel: titel.value,
          // Leerer Text heisst hier wirklich "leeren" - der Vertrag aus
          // v97. Deshalb wird der Wert ungefiltert durchgereicht.
          beschreibung: beschreibung.value,
          antwortBis: frist.value || null,
          fristEntfernen: !frist.value && !!findung.antwort_bis,
        });
        await neuLaden("Texte gespeichert.");
      });
    });

    box.append(form);
    return box;
  }

  function nachtragen(findung, anzahl) {
    const box = el("details", "admin-tf-werkzeug");
    box.append(el("summary", null, "Vorschlag nachtragen"));
    if (anzahl >= 8) {
      box.append(el("p", "admin-hinweis", "Es stehen bereits acht Vorschläge zur Wahl – mehr sind nicht vorgesehen."));
      return box;
    }
    const form = el("form", "admin-neue-liga");
    const { zeile, datum, zeit, ort } = vorschlagsZeile({ mitEntfernen: false });
    const hinzu = el("button", "knopf knopf-primaer", "Vorschlag ergänzen");
    hinzu.type = "submit";
    form.append(zeile, hinzu);
    form.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      await mitMeldung("Vorschlag wird ergänzt …", async () => {
        await zugriff.vorschlagErgaenzen({
          findungId: findung.id,
          datum: datum.value,
          beginnZeit: zeit.value || null,
          ort: ort.value.trim() || null,
        });
        await neuLaden("Vorschlag ergänzt. Bereits abgegebene Stimmen bleiben erhalten.");
      });
    });
    box.append(form);
    return box;
  }

  /* Wer fehlt noch - und der Export.
     Beides braucht dieselbe Abfrage (obmann_terminfindung_stand), deshalb
     stehen sie in einem Werkzeug zusammen. Geladen wird erst auf Klick:
     bei mehreren Terminsuchen waere sonst je Karte eine zusaetzliche
     Abfrage faellig, die meistens niemand ansieht. */
  function standWerkzeug(findung, vorschlaege) {
    const box = el("details", "admin-tf-werkzeug");
    box.append(el("summary", null, "Wer fehlt noch · Export"));
    const ziel = el("div", "admin-tf-stand");
    const laden = el("button", "knopf", "Stand laden");
    laden.type = "button";
    box.append(laden, ziel);

    laden.addEventListener("click", async () => {
      await mitMeldung("Stand wird geladen …", async () => {
        const stand = (await zugriff.stand(findung.id)) || [];
        ziel.replaceChildren();
        const offene = offeneNamen(stand);

        ziel.append(el("p", "admin-tf-standzeile",
          `${stand.length - offene.length} von ${stand.length} aktiven Schiedsrichtern haben geantwortet.`));

        if (offene.length) {
          ziel.append(el("p", "admin-tf-standzeile", `Es fehlt noch: ${offene.join(", ")}`));
          const text = erinnerungsText({ findung, offene });
          const bereich = document.createElement("textarea");
          bereich.rows = 4;
          bereich.readOnly = true;
          bereich.className = "admin-tf-erinnerung";
          bereich.value = text;
          const kopieren = el("button", "knopf", "Erinnerungstext kopieren");
          kopieren.type = "button";
          kopieren.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(text);
              setzeStatus(wurzel, "Erinnerungstext ist in der Zwischenablage.", "erfolg");
            } catch {
              // Ohne Zwischenablage-Recht bleibt der Text markierbar.
              bereich.select();
              setzeStatus(wurzel, "Bitte den markierten Text von Hand kopieren.");
            }
          });
          ziel.append(bereich, kopieren);
        }

        const export1 = el("button", "knopf", "Als CSV herunterladen");
        export1.type = "button";
        export1.addEventListener("click", () => {
          const csv = csvAusStand({ vorschlaege, stand });
          const adresse = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
          const verweis = document.createElement("a");
          verweis.href = adresse;
          verweis.download = csvDateiname(findung);
          verweis.click();
          URL.revokeObjectURL(adresse);
        });
        ziel.append(export1);
        setzeStatus(wurzel, "Stand geladen.", "erfolg");
      });
    });

    return box;
  }

  function entscheidung(findung, vorschlaege, empfohlen) {
    const box = el("details", "admin-tf-werkzeug");
    box.append(el("summary", null, "Termin festlegen"));
    box.append(el("p", "admin-hinweis",
      "Aus der Entscheidung entsteht ein echter Vereinstermin. Wer beim gewählten Vorschlag „Ja“ gesagt hat, bekommt die Zusage übertragen; „Vielleicht“ ausdrücklich nicht."));

    const form = el("form", "admin-neue-liga");
    const auswahl = document.createElement("select");
    vorschlaege.forEach((vorschlag) => {
      const option = new Option(vorschlagLangText(vorschlag), vorschlag.id);
      auswahl.add(option);
    });
    if (empfohlen) auswahl.value = empfohlen.id;

    const art = document.createElement("select");
    ARTEN.forEach(([wert, text]) => art.add(new Option(text, wert)));

    const oeffentlich = ankreuzfeld("Auf der öffentlichen Vereinsseite zeigen");
    const pflicht = ankreuzfeld("Pflichttermin");

    const auswahlFeld = feld("Gewählter Vorschlag", auswahl);
    auswahlFeld.className = "admin-breit";
    const festlegen = el("button", "knopf knopf-primaer", "Termin festlegen");
    festlegen.type = "submit";
    form.append(auswahlFeld, feld("Art", art), oeffentlich.label, pflicht.label, festlegen);

    form.addEventListener("submit", async (ereignis) => {
      ereignis.preventDefault();
      const gewaehlt = vorschlaege.find((v) => v.id === auswahl.value);
      if (!window.confirm(`„${vorschlagLangText(gewaehlt)}“ als Termin festlegen? Die Abstimmung wird damit geschlossen.`)) return;
      await mitMeldung("Termin wird angelegt …", async () => {
        await zugriff.entscheiden({
          findungId: findung.id,
          vorschlagId: auswahl.value,
          oeffentlich: oeffentlich.kasten.checked,
          art: art.value,
          pflicht: pflicht.kasten.checked,
        });
        await neuLaden("Termin angelegt. Die Abstimmung ist geschlossen.");
      });
    });

    box.append(form);
    return box;
  }

  function karte(findung) {
    const vorschlaege = Array.isArray(findung.vorschlaege) ? findung.vorschlaege : [];
    const empfohlen = findung.status === "offen" ? empfehlung(vorschlaege) : null;

    const artikel = el("article", "admin-tf-karte");
    artikel.dataset.status = findung.status;

    const kopf = el("header", "admin-tf-kopf");
    const links = el("div");
    links.append(el("strong", null, findung.titel || "Ohne Titel"));
    const teile = [];
    if (findung.antwort_bis) teile.push(`Antwort bis ${datumZahlen(findung.antwort_bis)}`);
    if (findung.status === "offen") {
      const offen = Number(findung.offen || 0);
      teile.push(offen ? `${offen} ohne Antwort` : "alle haben geantwortet");
    }
    links.append(el("span", "admin-tf-meta", teile.join(" · ")));
    if (findung.beschreibung) links.append(el("p", "admin-tf-beschreibung", findung.beschreibung));
    kopf.append(links, el("span", "admin-tf-marke", STATUS_TEXT[findung.status] || findung.status));
    artikel.append(kopf);

    artikel.append(vorschlagsTabelle(findung, vorschlaege, empfohlen));

    if (empfohlen) {
      artikel.append(el("p", "admin-tf-empfehlung",
        `Empfehlung: ${vorschlagLangText(empfohlen)} – die meisten festen Zusagen.`));
    }

    if (findung.status === "offen") {
      const werkzeuge = el("div", "admin-tf-werkzeuge");
      werkzeuge.append(
        textePflege(findung),
        nachtragen(findung, vorschlaege.length),
        standWerkzeug(findung, vorschlaege),
        entscheidung(findung, vorschlaege, empfohlen),
      );
      artikel.append(werkzeuge);

      const fuss = el("div", "admin-tf-kartenfuss");
      const abbrechen = knopf("Abstimmung abbrechen", "admin-icon-knopf");
      abbrechen.addEventListener("click", async () => {
        if (!window.confirm(`„${findung.titel}“ wirklich abbrechen? Die Abstimmung verschwindet dann von der Teilnehmerseite.`)) return;
        await mitMeldung("Abstimmung wird abgebrochen …", async () => {
          await zugriff.abbrechen(findung.id);
          await neuLaden("Abstimmung abgebrochen.");
        });
      });
      fuss.append(abbrechen);
      artikel.append(fuss);
    } else if (findung.erstellter_termin) {
      const verweis = document.createElement("a");
      verweis.className = "admin-tf-verweis";
      verweis.href = `termine.html?termin=${encodeURIComponent(findung.erstellter_termin)}`;
      verweis.textContent = "Zum entstandenen Termin";
      artikel.append(verweis);
    }

    return artikel;
  }

  function rendern() {
    liste.replaceChildren();
    if (!findungen.length) {
      liste.append(el("p", "admin-hinweis",
        "Noch keine Terminsuche angelegt. Unten lässt sich die erste anlegen."));
      return;
    }
    findungen.forEach((findung) => liste.append(karte(findung)));
  }

  // ---------- Formular für eine neue Terminsuche ----------

  const neuForm = wurzel.querySelector("[data-tf-neu-form]");
  const neuZeilen = wurzel.querySelector("[data-tf-neu-zeilen]");
  const zeilen = [];

  function zeileErgaenzen() {
    if (zeilen.length >= 8) return;
    const eintrag = vorschlagsZeile({
      beiEntfernen: (knoten) => {
        // Unter zwei Vorschlaegen waere es keine Abstimmung mehr - dieselbe
        // Regel wie in der Datenbank, hier nur frueher sichtbar.
        if (zeilen.length <= 2) return;
        const stelle = zeilen.findIndex((z) => z.zeile === knoten);
        if (stelle >= 0) zeilen.splice(stelle, 1);
        knoten.remove();
      },
    });
    zeilen.push(eintrag);
    neuZeilen.append(eintrag.zeile);
  }

  zeileErgaenzen();
  zeileErgaenzen();
  wurzel.querySelector("[data-tf-zeile-mehr]").addEventListener("click", zeileErgaenzen);

  neuForm.addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault();
    const daten = new FormData(neuForm);
    const vorschlaege = zeilen.map(textAusZeile).filter((v) => v.datum);
    if (vorschlaege.length < 2) {
      setzeStatus(wurzel, "Bitte mindestens zwei Vorschläge mit Datum angeben.", "fehler");
      return;
    }
    await mitMeldung("Terminsuche wird angelegt …", async () => {
      await zugriff.anlegen({
        titel: String(daten.get("titel") || "").trim(),
        beschreibung: String(daten.get("beschreibung") || "").trim() || null,
        antwortBis: String(daten.get("antwortBis") || "") || null,
        vorschlaege,
      });
      neuForm.reset();
      await neuLaden("Terminsuche angelegt. Sie steht jetzt auf der Teilnehmerseite.");
    });
  });

  // ---------- Schloss ----------

  wurzel.querySelector("[data-tf-schloss-form]").addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault();
    const eingabe = ereignis.currentTarget.elements.passwort;
    const senden = ereignis.currentTarget.querySelector("button");
    senden.disabled = true;
    try {
      setzeStatus(wurzel, "Passwort wird geprüft …");
      await schloss.oeffnen(eingabe.value);
      eingabe.value = "";
      schlossBereich.hidden = true;
      inhalt.hidden = false;
      await neuLaden();
    } catch (fehler) {
      setzeStatus(wurzel, fehler.message, "fehler");
    } finally {
      senden.disabled = false;
    }
  });

  wurzel.querySelector("[data-tf-aktualisieren]").addEventListener("click", () => neuLaden());

  wurzel.querySelector("[data-tf-abmelden]").addEventListener("click", () => {
    schloss.schliessen();
    findungen = [];
    liste.replaceChildren();
    inhalt.hidden = true;
    schlossBereich.hidden = false;
    setzeStatus(wurzel, "Das Obmann-Passwort ist wieder vergessen.");
  });

  setzeStatus(wurzel, "Bitte einmalig das Obmann-Passwort eingeben.");
}
