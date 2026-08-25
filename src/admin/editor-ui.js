export const kopie = (wert) => JSON.parse(JSON.stringify(wert));

export function setzeStatus(wurzel, text, art = "info") {
  const status = wurzel.querySelector("[data-inhalt-status]");
  status.textContent = text;
  status.dataset.art = art;
}

export function datumText(wert) {
  return wert ? new Date(wert).toLocaleString("de-DE") : "noch nicht veröffentlicht";
}

export function bereichsGeruest({ titel, untertitel, kennung, hinweis = "Änderungen werden erst nach deiner Bestätigung öffentlich." }) {
  return `
    <div class="admin-bereich-einstieg"><div><h2>${titel}</h2><p>${untertitel}</p></div><span class="admin-bereich-status">Mit 2FAS geschützt</span></div>
    <div class="admin-meldung" data-inhalt-status role="status"></div>
    <div data-inhalt-editor></div>
    <section class="admin-versionen" data-versionen hidden>
      <h3>Vorherige Stände</h3>
      <p>Ein alter Stand wird zuerst nur in den Editor geladen. Öffentlich wird er erst nach erneutem Bestätigen.</p>
      <div data-versionen-liste></div>
    </section>
    <div class="admin-aktionsleiste">
      <button class="knopf" type="button" data-versionen-laden>Vorherige Stände</button>
      <button class="knopf" type="button" data-inhalt-verwerfen>Änderungen verwerfen</button>
      <button class="knopf knopf-primaer" type="button" data-inhalt-speichern>${kennung} veröffentlichen</button>
    </div>
    <p class="admin-hinweis">${hinweis}</p>`;
}

export function bindeInhaltsAktionen({ wurzel, speicher, bereichName, aktuellerStand, setzeStand, rendern }) {
  wurzel.querySelector("[data-inhalt-speichern]").addEventListener("click", async () => {
    if (!window.confirm(`${bereichName} jetzt auf der öffentlichen Vereinsseite veröffentlichen?`)) return;
    try {
      setzeStatus(wurzel, "Stand wird geprüft und veröffentlicht …");
      const ergebnis = await speicher.veroeffentlichen(aktuellerStand());
      setzeStand(kopie(ergebnis.konfiguration));
      rendern();
      setzeStatus(wurzel, `Veröffentlicht am ${datumText(ergebnis.aktualisiertAm)}.`, "erfolg");
    } catch (fehler) {
      setzeStatus(wurzel, `Veröffentlichen fehlgeschlagen: ${fehler.message}`, "fehler");
    }
  });

  wurzel.querySelector("[data-inhalt-verwerfen]").addEventListener("click", async () => {
    if (!window.confirm("Nicht veröffentlichte Änderungen verwerfen?")) return;
    try {
      const ergebnis = await speicher.laden();
      setzeStand(kopie(ergebnis.konfiguration));
      rendern();
      setzeStatus(wurzel, ergebnis.istFallback ? "Statischer Ausgangsstand geladen." : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)} geladen.`);
    } catch (fehler) {
      setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler");
    }
  });

  wurzel.querySelector("[data-versionen-laden]").addEventListener("click", async () => {
    const box = wurzel.querySelector("[data-versionen]");
    const liste = wurzel.querySelector("[data-versionen-liste]");
    box.hidden = false;
    liste.textContent = "Vorherige Stände werden geladen …";
    try {
      const versionen = await speicher.versionen();
      liste.replaceChildren();
      if (!versionen.length) {
        liste.textContent = "Noch kein vorheriger Stand vorhanden.";
        return;
      }
      versionen.forEach((version) => {
        const zeile = document.createElement("div");
        zeile.className = "admin-version-zeile";
        const text = document.createElement("span");
        text.textContent = `Archiviert ${datumText(version.archiviert_am)}`;
        const knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "knopf";
        knopf.textContent = "In Editor laden";
        knopf.addEventListener("click", () => {
          setzeStand(kopie(version.konfiguration));
          rendern();
          setzeStatus(wurzel, "Vorheriger Stand ist nur lokal geladen. Zum Zurücksetzen jetzt veröffentlichen.");
        });
        zeile.append(text, knopf);
        liste.appendChild(zeile);
      });
    } catch (fehler) {
      liste.textContent = `Versionen konnten nicht geladen werden: ${fehler.message}`;
    }
  });
}
