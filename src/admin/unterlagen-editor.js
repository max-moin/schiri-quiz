import { UNTERLAGEN_STANDARD } from "../website/content-defaults.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

export function erstelleUnterlagenEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(UNTERLAGEN_STANDARD);
  const speicher = erstelleInhaltsSpeicher({ client, verein, benutzer, bereich: "unterlagen", fallback: UNTERLAGEN_STANDARD });
  wurzel.innerHTML = bereichsGeruest({
    titel: "Unterlagen",
    untertitel: "Links nach Anlass gruppieren, beschreiben, sortieren oder ausblenden.",
    kennung: "Unterlagen",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  function verschiebe(index, richtung) {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= zustand.dokumente.length) return;
    [zustand.dokumente[index], zustand.dokumente[ziel]] = [zustand.dokumente[ziel], zustand.dokumente[index]];
    rendern();
  }

  function dokumentKarte(dokument, index) {
    const karte = document.createElement("article");
    karte.className = "admin-dokument-zeile";
    karte.innerHTML = `
      <div class="admin-dokument-kopf"><strong></strong><span></span></div>
      <div class="admin-dokument-felder">
        <label>Titel<input data-feld="titel" /></label>
        <label>Anlass<select data-feld="g"></select></label>
        <label>Herkunft<select data-feld="q"><option value="svfd">Stadtverband</option><option value="sfv">Landesverband</option><option value="hier">Bei uns</option></select></label>
        <label class="admin-breit">Kurzbeschreibung<textarea data-feld="sub" rows="3"></textarea></label>
        <label class="admin-breit">Link<input data-feld="href" type="url" /></label>
      </div>
      <div class="admin-zeilen-aktionen">
        <label class="admin-checkbox"><input data-feld="aktiv" type="checkbox" /> Öffentlich anzeigen</label>
        <button class="admin-mini-knopf" type="button" data-hoch aria-label="Nach oben">↑</button>
        <button class="admin-mini-knopf" type="button" data-runter aria-label="Nach unten">↓</button>
        <button class="admin-icon-knopf" type="button" data-entfernen><span aria-hidden="true">×</span> Entfernen</button>
      </div>`;
    const kopfTitel = karte.querySelector(".admin-dokument-kopf strong");
    const kopfMeta = karte.querySelector(".admin-dokument-kopf span");
    const aktualisiereKopf = () => {
      kopfTitel.textContent = dokument.titel || "Neues Dokument";
      kopfMeta.textContent = zustand.gruppen.find((g) => g.id === dokument.g)?.titel || dokument.g;
    };
    const gruppenSelect = karte.querySelector('[data-feld="g"]');
    zustand.gruppen.forEach((gruppe) => {
      const option = document.createElement("option");
      option.value = gruppe.id;
      option.textContent = gruppe.titel;
      gruppenSelect.appendChild(option);
    });
    for (const feld of ["titel", "g", "q", "sub", "href"]) {
      const input = karte.querySelector(`[data-feld="${feld}"]`);
      input.value = dokument[feld];
      input.addEventListener("input", () => { dokument[feld] = input.value; aktualisiereKopf(); });
    }
    const aktiv = karte.querySelector('[data-feld="aktiv"]');
    aktiv.checked = dokument.aktiv !== false;
    aktiv.addEventListener("change", () => { dokument.aktiv = aktiv.checked; });
    karte.querySelector("[data-hoch]").addEventListener("click", () => verschiebe(index, -1));
    karte.querySelector("[data-runter]").addEventListener("click", () => verschiebe(index, 1));
    karte.querySelector("[data-entfernen]").addEventListener("click", () => {
      if (!window.confirm(`„${dokument.titel}“ wirklich entfernen?`)) return;
      zustand.dokumente.splice(index, 1);
      rendern();
    });
    aktualisiereKopf();
    return karte;
  }

  function rendern() {
    editor.replaceChildren();
    zustand.gruppen.forEach((gruppe, gruppenIndex) => {
      const details = document.createElement("details");
      details.className = "admin-panel admin-inhalt-gruppe";
      if (gruppenIndex === 0) details.open = true;
      const dokumente = zustand.dokumente.map((d, index) => ({ d, index })).filter(({ d }) => d.g === gruppe.id);
      details.innerHTML = `<summary><span><b>${gruppe.titel}</b><small>${dokumente.length} Einträge</small></span></summary><div class="admin-inhalt-liste"></div>`;
      const liste = details.querySelector(".admin-inhalt-liste");
      dokumente.forEach(({ d, index }) => liste.appendChild(dokumentKarte(d, index)));
      editor.appendChild(details);
    });
    const neu = document.createElement("details");
    neu.className = "admin-panel admin-aufklapper";
    neu.innerHTML = `<summary><span><b>Neuen Link ergänzen</b><small>Wird erst nach dem Veröffentlichen sichtbar</small></span></summary>
      <form class="admin-neue-liga" data-neues-dokument>
        <label>Titel<input name="titel" required /></label>
        <label>Anlass<select name="g"></select></label>
        <label>Herkunft<select name="q"><option value="svfd">Stadtverband</option><option value="sfv">Landesverband</option><option value="hier">Bei uns</option></select></label>
        <label class="admin-breit">Kurzbeschreibung<textarea name="sub" rows="3" required></textarea></label>
        <label class="admin-breit">Link<input name="href" type="url" required /></label>
        <button class="knopf" type="submit">Link lokal ergänzen</button>
      </form>`;
    const select = neu.querySelector('select[name="g"]');
    zustand.gruppen.forEach((gruppe) => select.add(new Option(gruppe.titel, gruppe.id)));
    neu.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const daten = new FormData(event.currentTarget);
      zustand.dokumente.push({
        id: `dokument-${Date.now()}`,
        aktiv: true,
        titel: String(daten.get("titel") || "").trim(),
        g: String(daten.get("g") || ""), q: String(daten.get("q") || "svfd"),
        sub: String(daten.get("sub") || "").trim(), href: String(daten.get("href") || "").trim(),
      });
      rendern();
      setzeStatus(wurzel, "Link ist lokal ergänzt. Erst Veröffentlichen ändert die Vereinsseite.");
    });
    editor.appendChild(neu);
  }

  bindeInhaltsAktionen({
    wurzel, speicher, bereichName: "Diese Unterlagen",
    aktuellerStand: () => zustand, setzeStand: (wert) => { zustand = wert; }, rendern,
  });
  speicher.laden().then((ergebnis) => {
    zustand = kopie(ergebnis.konfiguration); rendern();
    setzeStatus(wurzel, ergebnis.istFallback ? "Statischer Ausgangsstand – noch nicht aus der Redaktion veröffentlicht." : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`);
  }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
