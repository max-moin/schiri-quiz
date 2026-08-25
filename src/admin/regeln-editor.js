import { REGELN_STANDARD } from "../website/content-defaults.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

const DATENSAETZE = [
  ["svfdMeister", "Stadtverband · Meisterschaft"],
  ["svfdPokal", "Stadtverband · Pokal"],
  ["sfvMeister", "Landesverband · Meisterschaft"],
  ["sfvPokal", "Landesverband · Pokal"],
];

const FELDNAMEN = {
  a: "Altersklasse", k: "Spielklasse", zeit: "Spielzeit", feld: "Spielfeld",
  max: "Spieler maximal", min: "Spieler minimal", w: "Wechselspieler", wieder: "Rückwechsel",
  gr: "Gelb-Rot / Zeitstrafe", t: "Temperatur", verl: "Verlängerung", elfer: "Strafstoß / Entscheidungsschießen",
  sr: "Strafraum", tore: "Tore", ball: "Spielball", spieler: "Spielerzahl", abseits: "Abseits",
  match: "Matchstrafe", temp: "Temperaturbereich", bes: "Besonderheit", fuss: "Fußnote", warnung: "Warnhinweis",
};

const ZAHLFELDER = new Set(["max", "min", "w"]);

const NEUE_REGELZEILEN = Object.freeze({
  svfdMeister: { a: "", k: "", zeit: "", feld: "", max: null, min: null, w: null, wieder: "", gr: "", t: "" },
  svfdPokal: { a: "", k: "", zeit: "", verl: "", elfer: "" },
  sfvMeister: { a: "", k: "", feld: "", sr: "", tore: "", ball: "", spieler: "", zeit: "", abseits: "", elfer: "", match: "", temp: "" },
  sfvPokal: { a: "", k: "", feld: "", sr: "", tore: "", ball: "", spieler: "", zeit: "", verl: "", abseits: "", elfer: "", match: "", temp: "" },
});

function extraAlsText(extra) {
  return Array.isArray(extra) ? extra.map(([name, wert]) => `${name}: ${wert}`).join("\n") : "";
}

function textAlsExtra(wert) {
  return String(wert || "").split("\n").map((zeile) => zeile.trim()).filter(Boolean).map((zeile) => {
    const trenn = zeile.indexOf(":");
    return trenn < 0 ? [zeile, ""] : [zeile.slice(0, trenn).trim(), zeile.slice(trenn + 1).trim()];
  });
}

export function erstelleRegelnEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(REGELN_STANDARD);
  const speicher = erstelleInhaltsSpeicher({ client, verein, benutzer, bereich: "regeln", fallback: REGELN_STANDARD });
  wurzel.innerHTML = bereichsGeruest({
    titel: "Regelübersicht",
    untertitel: "Quellen und Regelzeilen getrennt nach Verband und Wettbewerb pflegen.",
    kennung: "Regeln",
    hinweis: "Fachliche Änderungen bitte nur anhand der angegebenen Originalquelle veröffentlichen.",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  function verschiebe(liste, index, richtung) {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    [liste[index], liste[ziel]] = [liste[ziel], liste[index]];
    rendern();
  }

  function regelKarte(zeile, liste, index) {
    const details = document.createElement("details");
    details.className = "admin-regel-zeile";
    const summary = document.createElement("summary");
    const titel = document.createElement("strong");
    const meta = document.createElement("span");
    const aktualisiereKopf = () => { titel.textContent = zeile.a || "Neue Altersklasse"; meta.textContent = zeile.k || "Spielklasse fehlt"; };
    summary.append(titel, meta);
    const felder = document.createElement("div");
    felder.className = "admin-regel-felder";
    Object.keys(zeile).filter((key) => key !== "extra").forEach((key) => {
      const label = document.createElement("label");
      label.textContent = FELDNAMEN[key] || key;
      const input = document.createElement(["fuss", "warnung"].includes(key) ? "textarea" : "input");
      if (ZAHLFELDER.has(key)) { input.type = "number"; input.min = "0"; }
      if (input.tagName === "TEXTAREA") input.rows = 3;
      input.value = zeile[key] ?? "";
      input.addEventListener("input", () => {
        zeile[key] = ZAHLFELDER.has(key) ? (input.value === "" ? null : Number(input.value)) : input.value;
        aktualisiereKopf();
      });
      label.appendChild(input);
      if (["fuss", "warnung"].includes(key)) label.classList.add("admin-breit");
      felder.appendChild(label);
    });
    if ("extra" in zeile) {
      const label = document.createElement("label");
      label.className = "admin-breit";
      label.textContent = "Zusatzangaben – eine Zeile je „Name: Wert“";
      const input = document.createElement("textarea");
      input.rows = 5; input.value = extraAlsText(zeile.extra);
      input.addEventListener("input", () => { zeile.extra = textAlsExtra(input.value); });
      label.appendChild(input); felder.appendChild(label);
    }
    const aktionen = document.createElement("div");
    aktionen.className = "admin-zeilen-aktionen";
    for (const [text, richtung] of [["↑ Nach oben", -1], ["↓ Nach unten", 1]]) {
      const knopf = document.createElement("button"); knopf.type = "button"; knopf.className = "admin-mini-knopf"; knopf.textContent = text;
      knopf.addEventListener("click", () => verschiebe(liste, index, richtung)); aktionen.appendChild(knopf);
    }
    const entfernen = document.createElement("button"); entfernen.type = "button"; entfernen.className = "admin-icon-knopf"; entfernen.innerHTML = '<span aria-hidden="true">×</span> Entfernen';
    entfernen.addEventListener("click", () => { if (window.confirm(`„${zeile.a} · ${zeile.k}“ entfernen?`)) { liste.splice(index, 1); rendern(); } });
    aktionen.appendChild(entfernen);
    details.append(summary, felder, aktionen); aktualisiereKopf();
    return details;
  }

  function quellenPanel() {
    const panel = document.createElement("section");
    panel.className = "admin-panel";
    panel.innerHTML = '<div class="admin-panel-kopf"><h2>Quellen und Stand</h2><p>Dieser Hinweis erscheint über der öffentlichen Übersicht.</p></div><div class="admin-quellen-raster"></div>';
    const raster = panel.querySelector(".admin-quellen-raster");
    for (const [key, titel] of [["svfd", "Stadtverband"], ["sfv", "Landesverband"]]) {
      const quelle = zustand.quellen[key];
      const karte = document.createElement("fieldset");
      karte.innerHTML = `<legend>${titel}</legend>
        <label>Titel<input data-q="titel" /></label><label>Stand<input data-q="stand" /></label>
        <label>Linktext<input data-q="linkText" /></label><label>Originalquelle<input data-q="link" type="url" /></label>
        <label class="admin-breit">Hinweis<textarea data-q="hinweis" rows="5"></textarea></label>
        <label class="admin-checkbox"><input data-q="warnung" type="checkbox" /> Als veraltet beziehungsweise warnend markieren</label>`;
      for (const feld of ["titel", "stand", "linkText", "link", "hinweis"]) {
        const input = karte.querySelector(`[data-q="${feld}"]`); input.value = quelle[feld]; input.addEventListener("input", () => { quelle[feld] = input.value; });
      }
      const warnung = karte.querySelector('[data-q="warnung"]'); warnung.checked = quelle.warnung; warnung.addEventListener("change", () => { quelle.warnung = warnung.checked; });
      raster.appendChild(karte);
    }
    return panel;
  }

  function rendern() {
    editor.replaceChildren(quellenPanel());
    DATENSAETZE.forEach(([key, titel], gruppenIndex) => {
      const liste = zustand[key];
      const details = document.createElement("details"); details.className = "admin-panel admin-inhalt-gruppe"; if (gruppenIndex === 0) details.open = true;
      details.innerHTML = `<summary><span><b>${titel}</b><small>${liste.length} Regelzeilen</small></span></summary><div class="admin-inhalt-liste"></div>`;
      const inhalt = details.querySelector(".admin-inhalt-liste");
      liste.forEach((zeile, index) => inhalt.appendChild(regelKarte(zeile, liste, index)));
      editor.appendChild(details);
    });
    const gemeinsam = document.createElement("section"); gemeinsam.className = "admin-panel";
    gemeinsam.innerHTML = `<div class="admin-panel-kopf"><h2>Gemeinsame Landeswerte</h2></div><div class="admin-text-form"><label>Wechselspieler<input data-gemeinsam="sfvWechselspieler" /></label><label>Rückwechsel<input data-gemeinsam="sfvRueckwechsel" /></label></div>`;
    for (const key of ["sfvWechselspieler", "sfvRueckwechsel"]) { const input = gemeinsam.querySelector(`[data-gemeinsam="${key}"]`); input.value = zustand[key]; input.addEventListener("input", () => { zustand[key] = input.value; }); }
    editor.appendChild(gemeinsam);
    const neu = document.createElement("details"); neu.className = "admin-panel admin-aufklapper";
    neu.innerHTML = `<summary><span><b>Neue Regelzeile ergänzen</b><small>Danach lassen sich alle angelegten Felder bearbeiten</small></span></summary><form class="admin-neue-liga">
      <label>Bereich<select name="datensatz">${DATENSAETZE.map(([key, titel]) => `<option value="${key}">${titel}</option>`).join("")}</select></label>
      <label>Altersklasse<input name="a" required /></label><label>Spielklasse<input name="k" required /></label><label>Spielzeit<input name="zeit" required /></label>
      <button class="knopf" type="submit">Regelzeile lokal ergänzen</button></form>`;
    neu.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const daten = new FormData(event.currentTarget);
      const datensatz = String(daten.get("datensatz"));
      zustand[datensatz].push({
        ...kopie(NEUE_REGELZEILEN[datensatz]),
        a: String(daten.get("a")),
        k: String(daten.get("k")),
        zeit: String(daten.get("zeit")),
      });
      rendern();
      setzeStatus(wurzel, "Regelzeile lokal ergänzt. Vor Veröffentlichung bitte vollständig ausfüllen und gegen die Quelle prüfen.");
    });
    editor.appendChild(neu);
  }

  bindeInhaltsAktionen({ wurzel, speicher, bereichName: "Diese Regelübersicht", aktuellerStand: () => zustand, setzeStand: (wert) => { zustand = wert; }, rendern });
  speicher.laden().then((ergebnis) => { zustand = kopie(ergebnis.konfiguration); rendern(); setzeStatus(wurzel, ergebnis.istFallback ? "Statischer Ausgangsstand – noch nicht aus der Redaktion veröffentlicht." : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`); }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
