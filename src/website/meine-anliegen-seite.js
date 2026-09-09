// ============================================================
//  Meine Anliegen: persoenlicher, datensparsamer Rueckkanal
// ============================================================
//  Diese Seite fuehrt nur persoenlich gefilterte RPCs zusammen. Antworten
//  des Obmanns werden als solche angezeigt; interne Verwaltungsnotizen,
//  Stammdaten und fremde Vorgaenge bleiben ausgeschlossen.

import { DATENBANK } from "../../verein.config.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const rpc = globalThis.SchiriRpc.erstelleRpc({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});
const $ = (id) => document.getElementById(id);

const STATUS = {
  offen: ["Eingegangen", "offen"],
  eingereicht: ["Eingegangen", "offen"],
  gelesen: ["Gesehen", "offen"],
  in_arbeit: ["In Prüfung", "in-pruefung"],
  in_pruefung: ["In Prüfung", "in-pruefung"],
  aenderung_erbeten: ["Rückfrage", "rueckfrage"],
  angenommen: ["Angenommen", "angenommen"],
  erledigt: ["Erledigt", "erledigt"],
  abgelehnt: ["Nicht übernommen", "abgelehnt"],
};
const FILTER = [
  ["alle", "Alle"],
  ["anliegen", "Anliegen"],
  ["quiz", "Quiz-Feedback"],
  ["frage", "Fragenideen"],
  ["termin", "Termine"],
];

let vorgaenge = [];
let aktiverFilter = "alle";

function datum(wert) {
  if (!wert) return "";
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}

function text(value) {
  return String(value ?? "").trim();
}

function alsListe(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function rufeListe(name, person) {
  const { data, error } = await rpc.rpc(name, {
    p_schiedsrichter_id: person.id,
    p_pin: person.pin,
  });
  if (error) throw new Error(name);
  return Array.isArray(data) ? data : [];
}

function statusVon(wert) {
  return STATUS[wert] || [text(wert) || "Eingegangen", "offen"];
}

function detailZeile(titel, wert) {
  if (!text(wert)) return null;
  const p = document.createElement("p");
  const stark = document.createElement("strong");
  stark.textContent = titel + ": ";
  p.append(stark, document.createTextNode(text(wert)));
  return p;
}

function vorgangElement(vorgang) {
  const details = document.createElement("details");
  details.className = "meine-vorgang";
  details.dataset.art = vorgang.art;

  const summary = document.createElement("summary");
  const titel = document.createElement("span");
  titel.className = "meine-vorgang-titel";
  const art = document.createElement("span");
  art.className = "meine-vorgang-art";
  art.textContent = vorgang.artName;
  const name = document.createElement("span");
  name.className = "meine-vorgang-name";
  name.textContent = vorgang.titel;
  titel.append(art, name);

  const meta = document.createElement("span");
  meta.className = "meine-vorgang-meta";
  const status = statusVon(vorgang.status);
  const statusBadge = document.createElement("span");
  statusBadge.className = "meine-status " + status[1];
  statusBadge.textContent = status[0];
  const zeit = document.createElement("span");
  zeit.className = "meine-vorgang-datum";
  zeit.textContent = datum(vorgang.zeit);
  meta.append(statusBadge, zeit);
  summary.append(titel, meta);

  const inhalt = document.createElement("div");
  inhalt.className = "meine-vorgang-inhalt";
  for (const zeile of vorgang.details || []) {
    const element = detailZeile(zeile[0], zeile[1]);
    if (element) inhalt.appendChild(element);
  }
  if (vorgang.bearbeiten) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "meine-bearbeiten";
    button.textContent = "Eigenen Hinweis bearbeiten";
    button.addEventListener("click", () => vorgang.bearbeiten(inhalt));
    inhalt.appendChild(button);
  }
  if (vorgang.link) {
    const a = document.createElement("a");
    a.className = "meine-textlink";
    a.href = vorgang.link;
    a.textContent = vorgang.linkText || "Öffnen";
    inhalt.appendChild(a);
  }
  details.append(summary, inhalt);
  return details;
}

function zeichneFilter() {
  const filter = $("meine-filter");
  filter.replaceChildren();
  for (const [wert, label] of FILTER) {
    const anzahl = wert === "alle" ? vorgaenge.length : vorgaenge.filter((v) => v.art === wert).length;
    if (wert !== "alle" && anzahl === 0) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.filter = wert;
    button.setAttribute("aria-pressed", String(wert === aktiverFilter));
    button.textContent = `${label} (${anzahl})`;
    button.addEventListener("click", () => {
      aktiverFilter = wert;
      zeichneFilter();
      zeichneVorgaenge();
    });
    filter.appendChild(button);
  }
  filter.hidden = vorgaenge.length === 0;
}

function zeichneVorgaenge() {
  const liste = $("meine-vorgangsliste");
  const sichtbar = aktiverFilter === "alle" ? vorgaenge : vorgaenge.filter((v) => v.art === aktiverFilter);
  liste.replaceChildren();
  if (!sichtbar.length) {
    const leer = document.createElement("p");
    leer.className = "meine-leer";
    leer.textContent = vorgaenge.length ? "In diesem Bereich gibt es noch nichts." : "Du hast noch keine persönlichen Vorgänge.";
    liste.appendChild(leer);
    return;
  }
  sichtbar.forEach((v) => liste.appendChild(vorgangElement(v)));
}

function ausAnfragen(zeilen) {
  return zeilen.filter((a) => a.typ === "anliegen").map((a) => ({
    art: "anliegen",
    artName: "Persönliches Anliegen",
    titel: text(a.anmerkung) || "Anliegen an den Obmann",
    status: a.status,
    zeit: a.erstellt_am,
    details: [["Dein Text", a.anmerkung]],
  }));
}

function ausQuizFeedback(zeilen) {
  return zeilen.map((m) => {
    const eintraege = alsListe(m.eintraege);
    const letzter = eintraege.at(-1);
    const frage = text(m.frage_text) || "Rückmeldung zu einer Quizfrage";
    const nummer = Number.isFinite(Number(m.frage_nummer)) ? `Frage ${m.frage_nummer}: ` : "";
    const editierbar = letzter?.id && ["offen", "gelesen"].includes(letzter?.status || m.status);
    return {
      art: "quiz",
      artName: "Quiz-Feedback",
      titel: nummer + frage,
      status: m.status,
      zeit: m.aktualisiert_am || m.erstellt_am,
      details: [
        ["Woche", m.runde_bezeichnung],
        ...eintraege.flatMap((e, index) => {
          const basis = [[eintraege.length > 1 ? `Dein Hinweis ${index + 1}` : "Dein Hinweis", e.text]];
          if (e.rueckmeldung_obmann) basis.push(["Antwort des Obmanns", e.rueckmeldung_obmann]);
          return basis;
        }),
      ],
      bearbeiten: editierbar ? (inhalt) => oeffneFeedbackBearbeitung(inhalt, m, letzter) : null,
    };
  });
}

function oeffneFeedbackBearbeitung(inhalt, meldung, eintrag) {
  if (inhalt.querySelector(".meine-bearbeitungsformular")) return;
  const formular = document.createElement("form");
  formular.className = "meine-bearbeitungsformular";
  const label = document.createElement("label");
  label.textContent = "Dein korrigierter Hinweis";
  const feld = document.createElement("textarea");
  feld.maxLength = 1000;
  feld.rows = 4;
  feld.value = text(eintrag.text);
  label.appendChild(feld);
  const aktionen = document.createElement("div");
  aktionen.className = "meine-formular-aktionen";
  const speichern = document.createElement("button");
  speichern.type = "submit";
  speichern.className = "meine-hauptknopf";
  speichern.textContent = "Änderung speichern";
  const abbrechen = document.createElement("button");
  abbrechen.type = "button";
  abbrechen.className = "meine-bearbeiten";
  abbrechen.textContent = "Abbrechen";
  abbrechen.addEventListener("click", () => formular.remove());
  const hinweis = document.createElement("p");
  hinweis.className = "meine-formular-hinweis";
  aktionen.append(speichern, abbrechen);
  formular.append(label, aktionen, hinweis);
  formular.addEventListener("submit", async (event) => {
    event.preventDefault();
    const person = anmeldung.lesen();
    const neuerText = feld.value.trim();
    if (!person || !neuerText) {
      hinweis.textContent = "Der Hinweis darf nicht leer sein.";
      return;
    }
    speichern.disabled = true;
    const { error } = await rpc.rpc("meine_frage_meldung_bearbeiten", {
      p_schiedsrichter_id: person.id,
      p_pin: person.pin,
      p_meldung_id: meldung.meldung_id,
      p_eintrag_id: eintrag.id,
      p_text: neuerText,
    });
    if (error) {
      speichern.disabled = false;
      hinweis.textContent = error.message || "Die Änderung konnte nicht gespeichert werden.";
      return;
    }
    hinweis.textContent = "Gespeichert.";
    await ladeVorgaenge(person);
  });
  inhalt.appendChild(formular);
  feld.focus();
}

function ausFragen(zeilen) {
  return zeilen.map((v) => ({
    art: "frage",
    artName: "Fragenidee",
    titel: text(v.frage_text) || "Frage ohne Kurztitel",
    status: v.status,
    zeit: v.aktualisiert_am || v.erstellt_am,
    details: [
      ["Deine Begründung", v.begruendung],
      ["Dein Regelbeleg", v.beleg],
      ["Rückmeldung", v.rueckmeldung_obmann],
    ],
    link: `frage-vorschlagen.html?vorschlag=${encodeURIComponent(v.id)}`,
    linkText: ["entwurf", "aenderung_erbeten"].includes(v.status) ? "Vorschlag weiterbearbeiten" : "Vorschlag ansehen",
  }));
}

function ausTerminen(zeilen) {
  return zeilen.map((v) => ({
    art: "termin",
    artName: "Terminvorschlag",
    titel: text(v.titel) || "Terminvorschlag",
    status: v.status,
    zeit: v.erstellt_am,
    details: [
      ["Vorgeschlagen für", [datum(v.datum), text(v.beginn_zeit).slice(0, 5), v.ort].filter(Boolean).join(" · ")],
      ["Deine Begründung", v.begruendung],
      ["Rückmeldung", v.obmann_rueckmeldung],
    ],
    link: "termine.html",
    linkText: "Zu den Terminen",
  }));
}

async function ladeVorgaenge(person) {
  const aufrufe = await Promise.allSettled([
    rufeListe("schiri_anfragen_liste", person),
    rufeListe("meine_frage_meldungen", person),
    rufeListe("schiri_fragenvorschlaege_liste", person),
    rufeListe("meine_termin_vorschlaege", person),
  ]);

  vorgaenge = [
    ...(aufrufe[0].status === "fulfilled" ? ausAnfragen(aufrufe[0].value) : []),
    ...(aufrufe[1].status === "fulfilled" ? ausQuizFeedback(aufrufe[1].value) : []),
    ...(aufrufe[2].status === "fulfilled" ? ausFragen(aufrufe[2].value) : []),
    ...(aufrufe[3].status === "fulfilled" ? ausTerminen(aufrufe[3].value) : []),
  ].sort((a, b) => new Date(b.zeit || 0) - new Date(a.zeit || 0));

  zeichneFilter();
  zeichneVorgaenge();

  if (aufrufe.some((ergebnis) => ergebnis.status === "rejected")) {
    const hinweis = document.createElement("p");
    hinweis.className = "meine-anonym-hinweis meine-fehler";
    hinweis.textContent = "Ein Teil deiner Vorgänge konnte gerade nicht geladen werden. Versuch es später noch einmal.";
    $("meine-vorgangsliste").appendChild(hinweis);
  }

  // Der vorhandene Neuigkeiten-Punkt bezieht sich auf Anfragen und alte
  // persoenliche Anliegen. Nach dem Oeffnen dieser Seite gilt beides als
  // gesehen. Andere Vorgaenge haben bewusst keinen versteckten Lesestatus.
  void rpc.rpc("schiri_anfragen_als_gesehen_markieren", {
    p_schiedsrichter_id: person.id,
    p_pin: person.pin,
  });
}

function starte() {
  const person = anmeldung.lesen();
  if (!person) {
    $("meine-zugang").hidden = false;
    $("meine-inhalt").hidden = true;
    return;
  }
  $("meine-zugang").hidden = true;
  $("meine-inhalt").hidden = false;
  void ladeVorgaenge(person);
}

$("meine-anmelden")?.addEventListener("click", async () => {
  if (!loginDialog) return;
  const ergebnis = await loginDialog.oeffne({
    grund: "Melde dich an, um deine persönlichen Vorgänge zu sehen.",
  });
  if (ergebnis.status === "angemeldet") starte();
});

starte();
