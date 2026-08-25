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
  const status = wurzel.querySelector('[data-bereich-status="spesen"]');
  const ligenWurzel = wurzel.querySelector("[data-ligen]");

  const melde = (text, art = "info") => {
    status.textContent = text;
    status.dataset.art = art;
  };

  function rendereLigen() {
    ligenWurzel.replaceChildren();
    zustand.altersklassen.forEach((gruppe, gruppenIndex) => {
      const abschnitt = document.createElement("details");
      abschnitt.className = "admin-liga-gruppe";
      if (gruppenIndex === 0) abschnitt.open = true;
      const titel = document.createElement("summary");
      const titelText = document.createElement("span");
      titelText.textContent = gruppe.name;
      const anzahl = document.createElement("span");
      anzahl.className = "admin-anzahl";
      anzahl.textContent = `${gruppe.ligen.length} ${gruppe.ligen.length === 1 ? "Eintrag" : "Einträge"}`;
      titel.append(titelText, anzahl);
      const inhalt = document.createElement("div");
      inhalt.className = "admin-liga-inhalt";
      abschnitt.append(titel, inhalt);

      gruppe.ligen.forEach((liga, ligaIndex) => {
        const zeile = document.createElement("article");
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
        const aktualisiereSraAnsicht = () => {
          sra.hidden = haken.checked;
          werte.classList.toggle("ohne-sra", haken.checked);
        };
        haken.addEventListener("change", () => {
          liga.sra = haken.checked ? null : Number(sra.querySelector("input").value);
          aktualisiereSraAnsicht();
        });
        const hakenText = document.createElement("span");
        hakenText.textContent = "Keine Assistenten vorgesehen";
        keinSra.append(haken, hakenText);

        const loeschen = document.createElement("button");
        loeschen.type = "button";
        loeschen.className = "admin-icon-knopf";
        loeschen.innerHTML = '<span aria-hidden="true">×</span> Entfernen';
        loeschen.setAttribute("aria-label", `${liga.kurz} entfernen`);
        loeschen.addEventListener("click", () => {
          if (!window.confirm(`„${liga.kurz}“ wirklich aus dem Rechner entfernen?`)) return;
          gruppe.ligen.splice(ligaIndex, 1);
          if (!gruppe.ligen.length) zustand.altersklassen.splice(gruppenIndex, 1);
          rendereLigen();
        });
        const werte = document.createElement("div");
        werte.className = "admin-liga-werte";
        werte.append(sr, sra);
        aktualisiereSraAnsicht();
        const aktionen = document.createElement("div");
        aktionen.className = "admin-liga-aktionen";
        aktionen.append(keinSra, loeschen);
        zeile.append(name, werte, aktionen);
        inhalt.appendChild(zeile);
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
      const vorhanden = await client.from("website_spesen_konfiguration")
        .select("seitenschluessel").eq("seitenschluessel", verein.seitenschluessel).maybeSingle();
      if (vorhanden.error) throw vorhanden.error;
      const neueWerte = {
        konfiguration: sicher,
        updated_at: new Date().toISOString(),
        updated_by: benutzer.id,
      };
      const ergebnis = vorhanden.data
        ? await client.from("website_spesen_konfiguration").update(neueWerte)
          .eq("seitenschluessel", verein.seitenschluessel)
        : await client.from("website_spesen_konfiguration").insert({
          seitenschluessel: verein.seitenschluessel,
          ...neueWerte,
        });
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
