// ============================================================
//  Mein Ausruestungsbestand (ausruestung.html)
// ============================================================
//  Max am 08.09.2026, woertlich: "Man sieht ja eigentlich nur seinen
//  Bestand, also meine Eintraege, und die sind vielleicht auch ein
//  bisschen kategorisiert, so wie ein Kleiderschrank, wo man ein
//  T-Shirt-Symbol, ein Hosen-Symbol, ein Schuhsymbol hat ... Dass man da
//  diesen Eintrag, den man da hinzufuegen kann, erst mit einem Plus
//  anlegen muss."
//
//  Daraus folgen die drei Entscheidungen dieser Datei:
//
//  1. Beim Oeffnen steht NUR der Bestand da. Das Formular war vorher
//     dauerhaft sichtbar und hat die Seite zu einem Formularwerkzeug
//     gemacht - jetzt kommt es auf Wunsch, inline und nicht als Pop-up.
//  2. Die Eintraege sind nach Kategorie gruppiert, jede Gruppe mit
//     Symbol UND Wort (Hausregel: ein Symbol darf begleiten, nie allein
//     stehen) und mit der Stueckzahl der Gruppe.
//  3. Die Ausruestungsanfragen stehen auf derselben Seite. Max: "sodass
//     man da auch sieht: Ok, das ist mein Stand. Das habe ich angefragt."
//
//  Die Anfrage-Maske wird hier BEWUSST NICHT nachgebaut. Der Knopf
//  "Ausruestung anfragen" oeffnet dasselbe Fenster, das frueher im
//  Kontomenue hing - src/features/profile-requests.js, bereitgestellt
//  ueber globalThis.SchiriSeitenProfil aus seite.js. Ein zweites
//  Formular samt Rechnungs-Upload waere genau die Doppelung, die spaeter
//  auseinander laeuft.
// ============================================================

import { DATENBANK } from "../../verein.config.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });

const rpc = globalThis.SchiriRpc.erstelleRpc({
  adresse: DATENBANK.adresse,
  oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
});

const $ = (id) => document.getElementById(id);
const ich = () => anmeldung?.lesen();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

let eintraege = [];

// Der Schrank: feste Reihenfolge, damit die Seite bei jedem Laden gleich
// aussieht. Die Schluessel sind die Werte, die die Datenbank erlaubt.
const SCHRANK = [
  { schluessel: "trikot", wort: "Trikots", einzeln: "Trikot", symbol: "\u{1F455}" },
  { schluessel: "hose", wort: "Hosen", einzeln: "Hose", symbol: "\u{1FA73}" },
  { schluessel: "stutzen", wort: "Stutzen", einzeln: "Stutzen", symbol: "\u{1F9E6}" },
  { schluessel: "schuhe", wort: "Schuhe", einzeln: "Schuhe", symbol: "\u{1F45F}" },
  { schluessel: "sonstiges", wort: "Sonstiges", einzeln: "Sonstiges", symbol: "\u{1F392}" },
];

const ZUSTAND_WORT = {
  einsatzbereit: "Einsatzbereit",
  ersatz: "Ersatz",
  verschlissen: "Verschlissen",
  fehlt: "Fehlt",
};
const AERMEL_WORT = { kurz: "Kurzarm", lang: "Langarm" };
const STATUS_WORT = { offen: "Offen", angenommen: "Angenommen", abgelehnt: "Abgelehnt", erledigt: "Erledigt" };

const datum = (iso) => globalThis.SchiriQuizUtils?.formatiereAnfrageDatum?.(iso) || "";
const fach = (schluessel) => SCHRANK.find((g) => g.schluessel === schluessel);

// ---------- Das Formular ----------

function zeigeFormular(titel) {
  $("bestand-formular-titel").textContent = titel;
  $("bestand-formular").hidden = false;
}

function verbergeFormular() {
  $("bestand-formular").hidden = true;
  $("bestand-meldung").textContent = "";
  $("bestand-meldung").classList.remove("bestand-fehler");
}

function neu() {
  $("bestand-formular").reset();
  $("bestand-id").value = "";
  $("bestand-anzahl").value = "1";
  $("bestand-meldung").textContent = "";
  $("bestand-meldung").classList.remove("bestand-fehler");
  loeschStandZuruecksetzen();
}

function meldung(text, istFehler) {
  $("bestand-meldung").textContent = text;
  $("bestand-meldung").classList.toggle("bestand-fehler", !!istFehler);
}

// Loeschen ohne Browserdialog (Hausregel): der Knopf fragt selbst nach,
// indem er beim ersten Druck zur Rueckfrage wird. Ein zweiter Druck
// loescht, jede andere Aktion setzt ihn zurueck.
function loeschStandZuruecksetzen() {
  const k = $("bestand-loeschen");
  if (!k) return;
  k.hidden = !$("bestand-id").value;
  k.dataset.sicher = "";
  k.textContent = "Eintrag löschen";
}

function oeffneNeuenEintrag() {
  neu();
  zeigeFormular("Neuer Eintrag");
  $("bestand-formular").scrollIntoView({ behavior: "smooth", block: "start" });
  $("bestand-kategorie").focus();
}

function oeffneEintrag(id) {
  const x = eintraege.find((e) => e.id === id);
  if (!x) return;
  $("bestand-id").value = x.id;
  $("bestand-kategorie").value = x.kategorie;
  $("bestand-bezeichnung").value = x.bezeichnung || "";
  $("bestand-farbe").value = x.farbe || "";
  $("bestand-groesse").value = x.groesse || "";
  $("bestand-aermel").value = x.aermellaenge || "";
  $("bestand-anzahl").value = x.anzahl || 1;
  $("bestand-zustand").value = x.zustand;
  $("bestand-anmerkung").value = x.anmerkung || "";
  meldung("", false);
  loeschStandZuruecksetzen();
  zeigeFormular("Eintrag bearbeiten");
  $("bestand-formular").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Der Schrank ----------

function plakette(text, klasse) {
  return `<span class="bestand-plakette${klasse ? " " + esc(klasse) : ""}">${esc(text)}</span>`;
}

function eintragHtml(x) {
  const plaketten = [];
  if (x.groesse) plaketten.push(plakette("Größe " + x.groesse));
  if (x.farbe) plaketten.push(plakette(x.farbe));
  if (x.aermellaenge) plaketten.push(plakette(AERMEL_WORT[x.aermellaenge] || x.aermellaenge));
  if (Number(x.anzahl) > 1) plaketten.push(plakette(x.anzahl + "×"));
  plaketten.push(plakette(ZUSTAND_WORT[x.zustand] || x.zustand, "zustand-" + x.zustand));
  const name = x.bezeichnung || fach(x.kategorie)?.einzeln || x.kategorie;
  return `<button type="button" class="bestand-eintrag" data-id="${esc(x.id)}">`
    + `<span class="bestand-eintrag-name">${esc(name)}</span>`
    + `<span class="bestand-plaketten">${plaketten.join("")}</span>`
    + (x.anmerkung ? `<span class="bestand-eintrag-anmerkung">${esc(x.anmerkung)}</span>` : "")
    + "</button>";
}

// Sollte je eine Kategorie dazukommen, die diese Seite noch nicht kennt,
// faellt sie in "Sonstiges" statt lautlos aus dem Schrank zu verschwinden.
const BEKANNT = new Set(SCHRANK.map((g) => g.schluessel));

function schrankHtml() {
  return SCHRANK.map((gruppe) => {
    const stuecke = eintraege.filter((x) => x.kategorie === gruppe.schluessel
      || (gruppe.schluessel === "sonstiges" && !BEKANNT.has(x.kategorie)));
    if (!stuecke.length) return "";
    const anzahl = stuecke.reduce((summe, x) => summe + (Number(x.anzahl) || 0), 0);
    return '<section class="bestand-gruppe">'
      + '<h2 class="bestand-gruppe-kopf">'
      + `<span class="bestand-gruppe-symbol" aria-hidden="true">${gruppe.symbol}</span>`
      + `${esc(gruppe.wort)}`
      + `<span class="bestand-gruppe-zahl">${anzahl} Stück</span>`
      + "</h2>"
      + stuecke.map(eintragHtml).join("")
      + "</section>";
  }).join("");
}

// Wer noch nichts eingetragen hat, soll nicht vor einer leeren Flaeche
// stehen, sondern vor einer Einladung - mit dem Plus gleich daneben.
function leerHtml() {
  return '<div class="bestand-leer">'
    + `<p class="bestand-leer-symbol" aria-hidden="true">${SCHRANK[0].symbol} ${SCHRANK[1].symbol} ${SCHRANK[3].symbol}</p>`
    + "<h2>Dein Schrank ist noch leer</h2>"
    + "<p>Trag ein, was du schon hast - Trikots, Hosen, Stutzen, Schuhe. "
    + "Dann siehst du auf einen Blick, was fehlt oder verschlissen ist.</p>"
    + '<button id="bestand-leer-hinzufuegen" type="button" class="bestand-knopf-haupt">'
    + '<span class="bestand-plus" aria-hidden="true">+</span> Eintrag hinzufügen</button>'
    + "</div>";
}

async function ladeBestand() {
  const p = ich();
  const { data, error } = await rpc.rpc("schiri_ausruestungsbestand_liste", {
    p_schiedsrichter_id: p.id,
    p_pin: p.pin,
  });
  if (error) {
    $("bestand-liste").innerHTML = '<p class="bestand-leer-zeile">Bestand konnte nicht geladen werden.</p>';
    return;
  }
  eintraege = Array.isArray(data) ? data : [];
  $("bestand-liste").innerHTML = eintraege.length ? schrankHtml() : leerHtml();
  $("bestand-liste").querySelectorAll(".bestand-eintrag").forEach((knopf) => {
    knopf.addEventListener("click", () => oeffneEintrag(knopf.dataset.id));
  });
  const leerKnopf = $("bestand-leer-hinzufuegen");
  if (leerKnopf) leerKnopf.addEventListener("click", oeffneNeuenEintrag);
}

// ---------- Meine Ausruestungsanfragen ----------

async function ladeAnfragen() {
  const p = ich();
  const { data, error } = await rpc.rpc("schiri_anfragen_liste", {
    p_schiedsrichter_id: p.id,
    p_pin: p.pin,
  });
  if (error) {
    $("bestand-anfragen").innerHTML = '<p class="bestand-leer-zeile">Anfragen konnten nicht geladen werden.</p>';
    return;
  }
  // Anliegen gehoeren nicht hierher - die stehen im Kontomenue unter
  // "Meine Anliegen". Geprueft wird auf "nicht anliegen" statt auf
  // "ausruestung", weil aeltere Zeilen keinen Typ tragen muessen; genauso
  // filtert es src/features/profile-requests.js.
  const anfragen = (Array.isArray(data) ? data : []).filter((a) => a.typ !== "anliegen");
  if (!anfragen.length) {
    $("bestand-anfragen").innerHTML = '<p class="bestand-leer-zeile">Du hast noch nichts angefragt.</p>';
    return;
  }
  $("bestand-anfragen").innerHTML = anfragen.map((a) => {
    const name = fach(a.kategorie)?.einzeln || a.kategorie || "Ausrüstung";
    const merkmale = [];
    if (a.groesse) merkmale.push(plakette("Größe " + a.groesse));
    if (a.farbe) merkmale.push(plakette(a.farbe));
    if (a.aermellaenge) merkmale.push(plakette(AERMEL_WORT[a.aermellaenge] || a.aermellaenge));
    const rechnungMoeglich = a.status === "angenommen" && a.beschaffungsweg === "weg2_schiri_besorgt" && !a.rechnung_hochgeladen_am;
    return '<article class="bestand-anfrage">'
      + '<div class="bestand-anfrage-kopf">'
      + `<span class="bestand-anfrage-titel">${esc(name)}</span>`
      + plakette(STATUS_WORT[a.status] || a.status, "status-" + a.status)
      + `<span class="bestand-anfrage-datum">${esc(datum(a.erstellt_am))}</span>`
      + "</div>"
      + (merkmale.length ? `<div class="bestand-plaketten">${merkmale.join("")}</div>` : "")
      + (a.anmerkung ? `<p class="bestand-anfrage-anmerkung">„${esc(a.anmerkung)}“</p>` : "")
      + (rechnungMoeglich ? `<button type="button" class="bestand-knopf-sekundaer" data-rechnung="${esc(a.id)}">Rechnung hochladen</button>` : "")
      + "</article>";
  }).join("");
  const profil = globalThis.SchiriSeitenProfil?.holeProfil() || null;
  $("bestand-anfragen").querySelectorAll("[data-rechnung]").forEach((knopf) => {
    if (!profil?.oeffneRechnungUpload) {
      knopf.hidden = true;
      return;
    }
    knopf.addEventListener("click", () => profil.oeffneRechnungUpload(knopf.dataset.rechnung));
  });
}

// Der Knopf oeffnet die vorhandene Maske aus dem Profil-Modul. Gibt es
// sie auf dieser Seite nicht, verschwindet der Knopf: ein Knopf, der beim
// Druck nichts tut, waere schlechter als keiner.
function richteAnfrageKnopfEin() {
  const knopf = $("bestand-anfrage-stellen");
  if (!knopf) return;
  const profil = globalThis.SchiriSeitenProfil?.holeProfil() || null;
  if (!profil) {
    knopf.hidden = true;
    return;
  }
  knopf.addEventListener("click", () => profil.oeffneAusruestungsAnfrage());
  // Nach dem Schliessen der Maske die Anfrageliste neu einlesen - sonst
  // stuende die frische Anfrage erst beim naechsten Seitenaufruf da.
  for (const kennung of ["anfrage-formular-schliessen-button", "anfrage-formular-erfolg-schliessen-button"]) {
    const schluss = $(kennung);
    if (schluss) schluss.addEventListener("click", () => { void ladeAnfragen(); });
  }
}

// ---------- Speichern und Loeschen ----------

$("bestand-formular").onsubmit = async (e) => {
  e.preventDefault();
  const p = ich();
  meldung("Wird gespeichert …", false);
  const { error } = await rpc.rpc("schiri_ausruestungsbestand_speichern", {
    p_schiedsrichter_id: p.id,
    p_pin: p.pin,
    p_kategorie: $("bestand-kategorie").value,
    p_bezeichnung: $("bestand-bezeichnung").value.trim() || null,
    p_farbe: $("bestand-farbe").value.trim() || null,
    p_groesse: $("bestand-groesse").value.trim() || null,
    p_aermellaenge: $("bestand-aermel").value || null,
    p_anzahl: Number($("bestand-anzahl").value),
    p_zustand: $("bestand-zustand").value,
    p_anmerkung: $("bestand-anmerkung").value.trim() || null,
    p_id: $("bestand-id").value || null,
  });
  if (error) {
    meldung("Speichern fehlgeschlagen: " + error.message, true);
    return;
  }
  neu();
  verbergeFormular();
  await ladeBestand();
};

$("bestand-hinzufuegen").onclick = oeffneNeuenEintrag;

$("bestand-abbrechen").onclick = () => {
  neu();
  verbergeFormular();
};

$("bestand-loeschen").onclick = async (e) => {
  const k = e.currentTarget;
  const id = $("bestand-id").value;
  if (!id) return;
  if (k.dataset.sicher !== "ja") {
    k.dataset.sicher = "ja";
    k.textContent = "Wirklich löschen?";
    return;
  }
  const p = ich();
  meldung("Wird gelöscht …", false);
  const { error } = await rpc.rpc("schiri_ausruestungsbestand_loeschen", {
    p_schiedsrichter_id: p.id,
    p_pin: p.pin,
    p_id: id,
  });
  if (error) {
    meldung("Löschen fehlgeschlagen: " + error.message, true);
    loeschStandZuruecksetzen();
    return;
  }
  neu();
  verbergeFormular();
  await ladeBestand();
};

// ---------- Start ----------

if (ich()) {
  $("bestand-inhalt").hidden = false;
  richteAnfrageKnopfEin();
  void ladeBestand();
  void ladeAnfragen();
} else {
  $("bestand-zugang").hidden = false;
}
