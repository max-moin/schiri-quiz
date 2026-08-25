import {
  normalisiereSpesenKonfiguration,
} from "../website/spesen-config.js";

const kopie = (wert) => JSON.parse(JSON.stringify(wert));
const geld = (wert) => Number(wert).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function feld({ titel, wert, schritt = "0.01", onChange }) {
  const label = document.createElement("label");
  label.className = "admin-feld";
  const text = document.createElement("span");
  text.textContent = titel;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = schritt;
  input.value = String(wert);
  input.addEventListener("input", () => onChange(Number(input.value)));
  label.append(text, input);
  return label;
}

export function erstelleSpesenEditor({ wurzel, client, verein, fallback, benutzer }) {
  let zustand = kopie(fallback);
  const status = wurzel.querySelector("[data-admin-status]");
  const ligenWurzel = wurzel.querySelector("[data-ligen]");

  const melde = (text, art = "info") => {
    status.textContent = text;
    status.dataset.art = art;
  };

  function rendereLigen() {
    ligenWurzel.replaceChildren();
    zustand.altersklassen.forEach((gruppe, gruppenIndex) => {
      const abschnitt = document.createElement("section");
      abschnitt.className = "admin-liga-gruppe";
      const titel = document.createElement("h3");
      titel.textContent = gruppe.name;
      abschnitt.appendChild(titel);

      gruppe.ligen.forEach((liga, ligaIndex) => {
        const zeile = document.createElement("div");
        zeile.className = "admin-liga-zeile";
        const name = document.createElement("div");
        name.className = "admin-liga-name";
        const stark = document.createElement("strong");
        stark.textContent = liga.kurz;
        const meta = document.createElement("span");
        meta.textContent = `${liga.verband === "sfv" ? "Land" : "Stadt"} · ${liga.voll}`;
        name.append(stark, meta);

        const sr = feld({ titel: "SR (€)", wert: liga.sr, onChange: (v) => { liga.sr = v; } });
        const sra = feld({
          titel: "SRA (€)",
          wert: liga.sra ?? 0,
          onChange: (v) => { liga.sra = v; },
        });
        const keinSra = document.createElement("label");
        keinSra.className = "admin-kein-sra";
        const haken = document.createElement("input");
        haken.type = "checkbox";
        haken.checked = liga.sra === null;
        haken.addEventListener("change", () => {
          liga.sra = haken.checked ? null : Number(sra.querySelector("input").value);
          sra.hidden = haken.checked;
        });
        const hakenText = document.createElement("span");
        hakenText.textContent = "ohne SRA";
        keinSra.append(haken, hakenText);
        sra.hidden = haken.checked;

        const loeschen = document.createElement("button");
        loeschen.type = "button";
        loeschen.className = "admin-icon-knopf";
        loeschen.textContent = "Entfernen";
        loeschen.setAttribute("aria-label", `${liga.kurz} entfernen`);
        loeschen.addEventListener("click", () => {
          if (!window.confirm(`„${liga.kurz}“ wirklich aus dem Rechner entfernen?`)) return;
          gruppe.ligen.splice(ligaIndex, 1);
          if (!gruppe.ligen.length) zustand.altersklassen.splice(gruppenIndex, 1);
          rendereLigen();
        });
        zeile.append(name, sr, sra, keinSra, loeschen);
        abschnitt.appendChild(zeile);
      });
      ligenWurzel.appendChild(abschnitt);
    });
  }

  function bindeGrundwerte() {
    const zuordnung = {
      turnierGrund: ["turnier", "grundpauschale"],
      turnierStunden: ["turnier", "grundstunden"],
      turnierWeiter: ["turnier", "jeWeitereStunde"],
      stadtKarte: ["fahrtkosten", "svfd", "preisJeKarte"],
      stadtKartenZone: ["fahrtkosten", "svfd", "kartenJeZone"],
      landMonatskarte: ["fahrtkosten", "sfv", "monatskartePauschale"],
      landAuto: ["fahrtkosten", "sfv", "kmAuto"],
      landMitnahme: ["fahrtkosten", "sfv", "kmZuschlagMitnahme"],
      landRad: ["fahrtkosten", "sfv", "kmFahrrad"],
      ausfall: ["ausfallAnteil"],
    };
    for (const [id, pfad] of Object.entries(zuordnung)) {
      const input = wurzel.querySelector(`#${id}`);
      let ziel = zustand;
      for (const teil of pfad.slice(0, -1)) ziel = ziel[teil];
      const schluessel = pfad.at(-1);
      input.value = String(ziel[schluessel]);
      input.oninput = () => { ziel[schluessel] = Number(input.value); };
    }
  }

  async function laden() {
    const ergebnis = await client
      .from("website_spesen_konfiguration")
      .select("konfiguration,updated_at")
      .eq("seitenschluessel", verein.seitenschluessel)
      .maybeSingle();
    if (ergebnis.error) throw ergebnis.error;
    if (ergebnis.data?.konfiguration) {
      zustand = normalisiereSpesenKonfiguration(ergebnis.data.konfiguration, fallback);
      const datum = new Date(ergebnis.data.updated_at).toLocaleString("de-DE");
      melde(`Veröffentlichter Stand vom ${datum}.`);
    } else {
      zustand = kopie(fallback);
      melde("Noch kein Datenbankstand: Der Rechner nutzt momentan die statische Konfiguration.");
    }
    bindeGrundwerte();
    rendereLigen();
  }

  wurzel.querySelector("[data-liga-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const daten = new FormData(event.currentTarget);
    const gruppenname = String(daten.get("altersklasse") || "").trim();
    const kurz = String(daten.get("kurz") || "").trim();
    const voll = String(daten.get("voll") || "").trim();
    if (!gruppenname || !kurz || !voll) return;
    let gruppe = zustand.altersklassen.find((eintrag) => eintrag.name === gruppenname);
    if (!gruppe) {
      gruppe = { name: gruppenname, ligen: [] };
      zustand.altersklassen.push(gruppe);
    }
    gruppe.ligen.push({
      stufe: Number(daten.get("stufe")) || 1,
      kurz,
      voll,
      verband: daten.get("verband") === "sfv" ? "sfv" : "svfd",
      sr: Number(daten.get("sr")) || 0,
      sra: daten.get("ohneSra") ? null : Number(daten.get("sra")) || 0,
    });
    event.currentTarget.reset();
    rendereLigen();
    melde("Neue Liga ist lokal ergänzt. Erst „Veröffentlichen“ schreibt sie in den Rechner.");
  });

  wurzel.querySelector("[data-speichern]").addEventListener("click", async () => {
    if (!window.confirm("Diese Werte jetzt im öffentlichen Spesenrechner veröffentlichen?")) return;
    try {
      melde("Werte werden geprüft und veröffentlicht …");
      const sicher = normalisiereSpesenKonfiguration(zustand, fallback);
      const ergebnis = await client.from("website_spesen_konfiguration").upsert({
        seitenschluessel: verein.seitenschluessel,
        konfiguration: sicher,
        updated_at: new Date().toISOString(),
        updated_by: benutzer.id,
      }, { onConflict: "seitenschluessel" });
      if (ergebnis.error) throw ergebnis.error;
      zustand = sicher;
      melde("Veröffentlicht. Der öffentliche Rechner lädt die neuen Werte beim nächsten Aufruf.", "erfolg");
    } catch (fehler) {
      melde(`Speichern fehlgeschlagen: ${fehler.message}`, "fehler");
    }
  });

  wurzel.querySelector("[data-zuruecksetzen]").addEventListener("click", () => {
    if (!window.confirm("Nicht gespeicherte Änderungen verwerfen und den veröffentlichten Stand neu laden?")) return;
    laden().catch((fehler) => melde(`Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
  });

  laden().catch((fehler) => melde(`Laden fehlgeschlagen: ${fehler.message}`, "fehler"));

  return Object.freeze({
    zusammenfassung: () => `${zustand.altersklassen.length} Altersklassen, Turnier ab ${geld(zustand.turnier.grundpauschale)} €`,
  });
}

