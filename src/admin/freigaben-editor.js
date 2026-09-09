const STANDARD = Object.freeze({ spesen_aktiv: false, regeln_aktiv: false });

export function erstelleFreigabenEditor({ wurzel, client, verein, benutzer }) {
  let zustand = { ...STANDARD };

  wurzel.innerHTML = `
    <div class="admin-bereich-einstieg">
      <div><h2>Sichtbarkeit</h2><p>Regelübersicht und Spesenrechner unabhängig freigeben oder wieder sperren.</p></div>
      <span class="admin-bereich-status">Mit 2FAS geschützt</span>
    </div>
    <div class="admin-meldung" data-freigabe-status role="status"></div>
    <section class="admin-panel admin-freigaben-panel">
      <label class="admin-freigabe-zeile">
        <span><strong>Spesenrechner</strong><small>Bei „aus“ bleibt der Reiter sichtbar und trägt „In Prüfung“.</small></span>
        <input type="checkbox" data-freigabe-schalter="spesen_aktiv" role="switch" />
      </label>
      <label class="admin-freigabe-zeile">
        <span><strong>Regelübersicht</strong><small>Bei „aus“ ist auch ein Direktaufruf der Seite gesperrt.</small></span>
        <input type="checkbox" data-freigabe-schalter="regeln_aktiv" role="switch" />
      </label>
    </section>
    <div class="admin-aktionsleiste">
      <button class="knopf knopf-primaer" type="button" data-freigaben-speichern>Sichtbarkeit speichern</button>
    </div>`;

  const status = wurzel.querySelector("[data-freigabe-status]");
  const schalter = Array.from(wurzel.querySelectorAll("[data-freigabe-schalter]"));
  const speichern = wurzel.querySelector("[data-freigaben-speichern]");

  function melde(text, art = "info") {
    status.textContent = text;
    status.dataset.art = art;
  }

  function zeichne() {
    schalter.forEach((feld) => { feld.checked = zustand[feld.dataset.freigabeSchalter] === true; });
  }

  async function laden() {
    const ergebnis = await client.from("website_funktionsfreigaben")
      .select("spesen_aktiv,regeln_aktiv,updated_at")
      .eq("seitenschluessel", verein.seitenschluessel)
      .maybeSingle();
    if (ergebnis.error) throw ergebnis.error;
    zustand = {
      spesen_aktiv: ergebnis.data?.spesen_aktiv === true,
      regeln_aktiv: ergebnis.data?.regeln_aktiv === true,
    };
    zeichne();
    melde(ergebnis.data
      ? `Gespeicherter Stand vom ${new Date(ergebnis.data.updated_at).toLocaleString("de-DE")}.`
      : "Noch kein Stand gespeichert – beide Funktionen sind gesperrt.");
  }

  schalter.forEach((feld) => {
    feld.addEventListener("change", () => { zustand[feld.dataset.freigabeSchalter] = feld.checked; });
  });

  speichern.addEventListener("click", async () => {
    speichern.disabled = true;
    try {
      melde("Sichtbarkeit wird gespeichert …");
      const vorhanden = await client.from("website_funktionsfreigaben")
        .select("seitenschluessel")
        .eq("seitenschluessel", verein.seitenschluessel)
        .maybeSingle();
      if (vorhanden.error) throw vorhanden.error;
      const werte = {
        spesen_aktiv: zustand.spesen_aktiv,
        regeln_aktiv: zustand.regeln_aktiv,
        updated_at: new Date().toISOString(),
        updated_by: benutzer.id,
      };
      const ergebnis = vorhanden.data
        ? await client.from("website_funktionsfreigaben").update(werte)
          .eq("seitenschluessel", verein.seitenschluessel)
        : await client.from("website_funktionsfreigaben").insert({
          seitenschluessel: verein.seitenschluessel,
          ...werte,
        });
      if (ergebnis.error) throw ergebnis.error;
      melde("Gespeichert. Neue Seitenaufrufe übernehmen den Stand sofort.", "erfolg");
    } catch (fehler) {
      melde(`Speichern fehlgeschlagen: ${fehler.message}`, "fehler");
    } finally {
      speichern.disabled = false;
    }
  });

  laden().catch((fehler) => melde(`Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
