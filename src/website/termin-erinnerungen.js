import { DATENBANK } from "../../verein.config.js";

async function rpc(name, person, werte = {}) {
  const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json",
      apikey: DATENBANK.oeffentlicherSchluessel,
      Authorization: `Bearer ${DATENBANK.oeffentlicherSchluessel}` },
    body: JSON.stringify({ p_schiedsrichter_id: person.id, p_pin: person.pin, ...werte }),
  });
  if (!antwort.ok) throw new Error("Die Terminauswahl konnte nicht geladen oder gespeichert werden.");
  return antwort.json();
}

export function erinnerungsHinweis(termin, globalAktiv) {
  if (!termin.ausgewaehlt) return "Für dich ausgeschaltet";
  if (!globalAktiv) return "Terminerinnerungen in deiner Themenauswahl noch ausgeschaltet";
  if (termin.erinnerung_modus === "aus") return "Der Obmann hat für diesen Termin keine Erinnerung aktiviert";
  if (!termin.berechtigt) return "Erinnert wirst du nach deiner Zusage";
  return { vortag: "Vortag · 18:00 Uhr", tag: "Termintag · 09:00 Uhr",
    beide: "Vortag · 18:00 Uhr und Termintag · 09:00 Uhr" }[termin.erinnerung_modus] || "Keine Erinnerung eingerichtet";
}

// Alle Daten als Textknoten, keine Titel in HTML einsetzen. Dieselbe
// Steuerung arbeitet im Mitteilungsmenü und direkt am einzelnen Termin.
export async function montiereTerminerinnerungen(container, person, {
  status, istAktuell = () => true, terminId = null,
} = {}) {
  if (!container || !person) return;
  const melde = (text, zustand = "") => {
    if (!istAktuell() || !status) return;
    status.textContent = text; status.dataset.zustand = zustand;
  };
  try {
    const daten = await rpc("schiri_push_terminwahl", person);
    if (!istAktuell()) return;
    const termine = (Array.isArray(daten?.termine) ? daten.termine : [])
      .filter((t) => !terminId || t.id === terminId);
    container.replaceChildren();
    if (!termine.length) { melde("Keine kommenden Termine verfügbar."); return; }
    for (const t of termine) {
      const zeile = document.createElement("li");
      const text = document.createElement("span");
      const titel = document.createElement("strong"); titel.textContent = t.titel;
      const datum = document.createElement("small");
      datum.textContent = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
        .format(new Date(`${t.datum}T12:00:00`));
      const hinweis = document.createElement("small");
      const knopf = document.createElement("button"); knopf.type = "button";
      const zeichne = () => {
        knopf.textContent = t.ausgewaehlt ? "Nicht ausgeschlossen" : "Ausgeschlossen";
        knopf.setAttribute("aria-pressed", String(t.ausgewaehlt));
        knopf.setAttribute("aria-label", `${t.titel}: persönliche Erinnerung ${t.ausgewaehlt ? "ausschalten" : "einschalten"}`);
        hinweis.textContent = erinnerungsHinweis(t, daten.termine_aktiv);
      };
      zeichne();
      knopf.addEventListener("click", async () => {
        if (knopf.disabled || !istAktuell()) return;
        const aktiviert = !t.ausgewaehlt; knopf.disabled = true;
        melde("Terminauswahl wird gespeichert …");
        try {
          await rpc("schiri_push_termin_setzen", person, { p_termin_id: t.id, p_aktiv: aktiviert });
          if (!istAktuell()) return;
          t.ausgewaehlt = aktiviert; zeichne();
          melde(aktiviert ? "Persönliche Erinnerung eingeschaltet. Die Voraussetzungen am Termin gelten weiterhin."
            : "Für diesen Termin wirst du nicht erinnert.", "erfolg");
        } catch (fehler) { melde(fehler.message, "fehler"); }
        finally { if (istAktuell()) knopf.disabled = false; }
      });
      text.append(titel, datum, hinweis); zeile.append(text, knopf); container.append(zeile);
    }
  } catch (fehler) { melde(fehler.message, "fehler"); }
}
