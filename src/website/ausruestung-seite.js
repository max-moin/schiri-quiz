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
const AUS = globalThis.SchiriAusruestung;

// Der Schrank: feste Reihenfolge, damit die Seite bei jedem Laden gleich
// aussieht. Die Schluessel sind die Werte, die die Datenbank erlaubt.
const SCHRANK = AUS.KATEGORIEN;

const ZUSTAND_WORT = {
  einsatzbereit: "Einsatzbereit",
  ersatz: "Ersatz",
  verschlissen: "Verschlissen",
  fehlt: "Fehlt",
};
const AERMEL_WORT = { kurz: "Kurzarm", lang: "Langarm" };
const STATUS_WORT = { offen: "Offen", angenommen: "Angenommen", abgelehnt: "Abgelehnt", erledigt: "Erledigt" };

const datum = (iso) => globalThis.SchiriQuizUtils?.formatiereAnfrageDatum?.(iso) || "";
const fach = (schluessel) => AUS.findeKategorie(schluessel);

function symbolHtml(icon) {
  const innen = {
    shirt: '<path d="M8 6 5 8l2 4 2-1v8h6v-8l2 1 2-4-3-2c-.6 1-1.4 1.5-3 1.5S10.6 7 10 6Z"/>',
    shorts: '<path d="M7 6h10l1 12-5-2-1 2-1-2-5 2Z"/>',
    socks: '<path d="M8 5v8l-2 3c-.5 1 0 2 1.5 2H11l2-3V5m2 0v8l-1 2"/>',
    shoe: '<path d="M5 14c3 0 5-2 6-5 1 3 3 5 7 6v3H6c-2 0-2-4-1-4Z"/>',
    notes: '<path d="M7 4h10v16H7zM10 8h4m-4 4h4m-4 4h3"/>',
    receipt: '<path d="M7 4h10v16l-2-1-2 1-2-1-2 1-2-1Zm3 5h4m-4 4h4"/>',
    folder: '<path d="M4 7h6l2 2h8v10H4Z"/>',
    whistle: '<circle cx="15" cy="13" r="4"/><path d="M11 13H5l2-5h5m7 3 2-1"/>',
    headset: '<path d="M5 14v-3a7 7 0 0 1 14 0v3M5 13h3v6H6c-1 0-1-1-1-2Zm14 0h-3v6h2c1 0 1-1 1-2Z"/>',
    flag: '<path d="M7 21V4m1 1h10l-2 4 2 4H8"/>',
    bag: '<path d="M5 9h14v11H5Zm4 0V7c0-2 6-2 6 0v2"/>',
    equipment: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8"/>',
  }[icon];
  if (icon === "card-yellow" || icon === "card-red") {
    return `<span class="bestand-karten-symbol ${icon}" aria-hidden="true"></span>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${innen || innen === "" ? innen : '<circle cx="12" cy="12" r="8"/>'}</svg>`;
}

// Im Usability-Test konnte die Testperson nicht erkennen, ob sie eine
// Farbe gewaehlt hatte: der Auswahlzustand steckte allein in einem
// blassen Rahmen und ein paar Pixeln Groesse. Er haengt jetzt an drei
// Merkmalen - Rahmen, Haekchen (beides in stil/ausruestung.css) und
// dieser ausgeschriebenen Zeile. Kein Merkmal davon ist Farbe oder
// Groesse allein (WCAG 1.4.1).
function zeigeGewaehlteFarbe() {
  const wert = $("bestand-farbe").value.trim();
  const andereGewaehlt = document.querySelector('input[name="bestand-farbton"][value="__andere__"]')?.checked;
  const zeile = $("bestand-farbe-gewaehlt");
  zeile.textContent = wert
    ? "Gewählt: " + wert
    : (andereGewaehlt ? "Gewählt: Andere Farbe – bitte unten eintragen" : "Noch keine Farbe gewählt");
  zeile.classList.toggle("bestand-farbe-gewaehlt-aktiv", Boolean(wert) || Boolean(andereGewaehlt));
}

function setzeFarbe(wert) {
  const bekannt = AUS.FARBEN.find((x) => x.wert.toLocaleLowerCase("de") === String(wert || "").toLocaleLowerCase("de"));
  const radio = document.querySelector(`input[name="bestand-farbton"][value="${bekannt ? bekannt.wert : "__andere__"}"]`);
  document.querySelectorAll('input[name="bestand-farbton"]').forEach((input) => { input.checked = false; });
  if (wert && radio) radio.checked = true;
  $("bestand-andere-farbe").hidden = !wert || !!bekannt;
  $("bestand-andere-farbe").value = bekannt ? "" : (wert || "");
  $("bestand-farbe").value = wert || "";
  zeigeGewaehlteFarbe();
}

// Solange nichts gewaehlt ist, gibt es auch keine passenden Zusatzfelder:
// "fach()" faellt bei einem unbekannten Schluessel auf "Sonstiges" zurueck
// und wuerde sonst Bezeichnung und Farbe anbieten, bevor ueberhaupt eine
// Kategorie feststeht.
function aktualisiereFormularFelder() {
  const kategorie = $("bestand-kategorie").value ? fach($("bestand-kategorie").value) : {};
  $("bestand-bezeichnung-bereich").hidden = !kategorie.bezeichnung;
  $("bestand-farbe-bereich").hidden = !kategorie.farbe;
  $("bestand-groesse-bereich").hidden = !kategorie.groesse;
  $("bestand-aermel-bereich").hidden = !kategorie.aermel;
  $("bestand-anzahl-bereich").hidden = !kategorie.verbrauch;
  if (!kategorie.bezeichnung) $("bestand-bezeichnung").value = "";
  if (!kategorie.farbe) setzeFarbe("");
  if (!kategorie.groesse) $("bestand-groesse").value = "";
  if (!kategorie.aermel) $("bestand-aermel").value = "";
  if (!kategorie.verbrauch) $("bestand-anzahl").value = "1";
}

// "Trikot" war vorausgewaehlt - die Testperson nahm das Feld deshalb gar
// nicht als Auswahl wahr und haette am Ende ein Trikot eingetragen, das
// sie nie gewaehlt hat. Der leere Eintrag steht vorn und ist die Vorgabe.
$("bestand-kategorie").innerHTML = '<option value="">Bitte wählen …</option>' + AUS.kategorienOptionen();
$("bestand-farbwahl").innerHTML = AUS.farbwahlHtml("bestand-farbton");
$("bestand-kategorie").addEventListener("change", aktualisiereFormularFelder);
$("bestand-farbwahl").addEventListener("change", (event) => {
  if (!event.target?.value) return;
  const andere = event.target.value === "__andere__";
  $("bestand-andere-farbe").hidden = !andere;
  $("bestand-farbe").value = andere ? "" : event.target.value;
  zeigeGewaehlteFarbe();
  if (andere) $("bestand-andere-farbe").focus();
});
$("bestand-andere-farbe").addEventListener("input", () => {
  $("bestand-farbe").value = $("bestand-andere-farbe").value.trim();
  zeigeGewaehlteFarbe();
});

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
  setzeFarbe("");
  aktualisiereFormularFelder();
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
  $("bestand-speichern-weiter").hidden = false;
}

function oeffneEintrag(id) {
  const x = eintraege.find((e) => e.id === id);
  if (!x) return;
  $("bestand-id").value = x.id;
  $("bestand-kategorie").value = x.kategorie;
  $("bestand-bezeichnung").value = x.bezeichnung || "";
  setzeFarbe(x.farbe || "");
  $("bestand-groesse").value = x.groesse || "";
  $("bestand-aermel").value = x.aermellaenge || "";
  $("bestand-anzahl").value = x.anzahl || 1;
  $("bestand-zustand").value = x.zustand;
  $("bestand-anmerkung").value = x.anmerkung || "";
  aktualisiereFormularFelder();
  meldung("", false);
  loeschStandZuruecksetzen();
  zeigeFormular("Eintrag bearbeiten");
  $("bestand-speichern-weiter").hidden = true;
  $("bestand-formular").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Der Schrank ----------

function plakette(text, klasse) {
  return `<span class="bestand-plakette${klasse ? " " + esc(klasse) : ""}">${esc(text)}</span>`;
}

function farbPlakette(farbe) {
  const eintrag = AUS.FARBEN.find((x) => x.wert.toLocaleLowerCase("de") === String(farbe).toLocaleLowerCase("de"));
  const stil = eintrag ? ` style="--ausruestungs-farbe:${eintrag.hex}"` : "";
  return `<span class="bestand-plakette bestand-farbplakette"><i${stil} aria-hidden="true"></i>${esc(farbe)}</span>`;
}

function eintragHtml(x) {
  const plaketten = [];
  if (x.groesse) plaketten.push(plakette("Größe " + x.groesse));
  if (x.farbe) plaketten.push(farbPlakette(x.farbe));
  if (x.aermellaenge) plaketten.push(plakette(AERMEL_WORT[x.aermellaenge] || x.aermellaenge));
  if (Number(x.anzahl) > 1) plaketten.push(plakette(x.anzahl + "×"));
  plaketten.push(plakette(ZUSTAND_WORT[x.zustand] || x.zustand, "zustand-" + x.zustand));
  const name = x.bezeichnung || fach(x.kategorie)?.wort || x.kategorie;
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
  return ["Bekleidung", "Equipment"].map((bereich) => {
    const faecher = SCHRANK.filter((x) => x.gruppe === bereich).map((gruppe) => {
      const stuecke = eintraege.filter((x) => x.kategorie === gruppe.schluessel
        || (gruppe.schluessel === "sonstiges" && !BEKANNT.has(x.kategorie)));
      if (!stuecke.length) return "";
      const anzahl = stuecke.reduce((summe, x) => summe + (Number(x.anzahl) || 0), 0);
      return '<div class="bestand-fach"><h3 class="bestand-gruppe-kopf">'
        + `<span class="bestand-gruppe-symbol">${symbolHtml(gruppe.icon)}</span>${esc(gruppe.mehrzahl)}`
        + `<span class="bestand-gruppe-zahl">${anzahl}</span></h3>`
        + stuecke.map(eintragHtml).join("") + "</div>";
    }).join("");
    if (!faecher) return "";
    return `<section class="bestand-gruppe"><h2 class="bestand-bereich-titel">${bereich}</h2>${faecher}</section>`;
  }).join("");
}

// Wer noch nichts eingetragen hat, soll nicht vor einer leeren Flaeche
// stehen, sondern vor einer Einladung - mit dem Plus gleich daneben.
function leerHtml() {
  return '<div class="bestand-leer">'
    + `<div class="bestand-leer-symbol" aria-hidden="true">${symbolHtml("shirt")}${symbolHtml("whistle")}${symbolHtml("flag")}</div>`
    + "<h2>Dein Schrank ist noch leer</h2>"
    + "<p>Trag Bekleidung und Equipment ein. Dann siehst du auf einen Blick, was vorhanden, knapp oder verschlissen ist.</p>"
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
    const name = fach(a.kategorie)?.wort || a.kategorie || "Ausrüstung";
    const merkmale = [];
    if (a.groesse) merkmale.push(plakette("Größe " + a.groesse));
    if (a.farbe) merkmale.push(farbPlakette(a.farbe));
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
  const weiterenAnlegen = e.submitter?.id === "bestand-speichern-weiter";
  const ausgewaehlteKategorie = $("bestand-kategorie").value;
  if (!ausgewaehlteKategorie) {
    meldung("Bitte wähle zuerst aus, um was für ein Stück es geht.", true);
    $("bestand-kategorie").focus();
    return;
  }
  const kategorie = fach(ausgewaehlteKategorie);
  if (kategorie.bezeichnung && $("bestand-bezeichnung").value.trim().length < 2) {
    meldung("Bitte beschreibe, welches Equipment du eintragen möchtest.", true);
    $("bestand-bezeichnung").focus();
    return;
  }
  const p = ich();
  meldung("Wird gespeichert …", false);
  const { error } = await rpc.rpc("schiri_ausruestungsbestand_speichern", {
    p_schiedsrichter_id: p.id,
    p_pin: p.pin,
    p_kategorie: $("bestand-kategorie").value,
    p_bezeichnung: $("bestand-bezeichnung").value.trim() || null,
    p_farbe: $("bestand-farbe").value.trim() || null,
    p_groesse: $("bestand-groesse").value.trim() || null,
    p_aermellaenge: kategorie.aermel ? ($("bestand-aermel").value || null) : null,
    p_anzahl: kategorie.verbrauch ? Number($("bestand-anzahl").value) : 1,
    p_zustand: $("bestand-zustand").value,
    p_anmerkung: $("bestand-anmerkung").value.trim() || null,
    p_id: $("bestand-id").value || null,
  });
  if (error) {
    meldung("Speichern fehlgeschlagen: " + error.message, true);
    return;
  }
  neu();
  await ladeBestand();
  if (weiterenAnlegen) {
    $("bestand-kategorie").value = ausgewaehlteKategorie;
    aktualisiereFormularFelder();
    zeigeFormular("Weiteren Eintrag hinzufügen");
    const erstesFeld = kategorie.bezeichnung ? $("bestand-bezeichnung") : (kategorie.farbe ? $("bestand-farbwahl") : $("bestand-zustand"));
    erstesFeld.focus();
  } else {
    verbergeFormular();
  }
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
