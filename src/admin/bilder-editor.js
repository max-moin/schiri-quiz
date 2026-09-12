// ============================================================
//  Redaktionsbereich "Bilder"
// ============================================================
//  Die Motive der Startseite lagen bisher in verein.config.js, also in
//  einer ausgelieferten Datei - austauschen hiess: Code anfassen. Hier
//  tauscht sie der Obmann selbst.
//
//  Zwei Schritte, bewusst getrennt: Hochladen legt die Datei nur in die
//  Ablage, oeffentlich wird sie erst mit "Bilder veroeffentlichen" ueber
//  content-store.js - wie in den anderen Bereichen, samt Archiv des
//  vorherigen Stands.
// ============================================================

import { BILDER } from "../../verein.config.js";
import { BILD_MOTIVE } from "../website/content-config.js";
import { BILDER_STANDARD } from "../website/content-defaults.js";
import { erstelleInhaltsSpeicher } from "./content-store.js";
import { bereichsGeruest, bindeInhaltsAktionen, datumText, kopie, setzeStatus } from "./editor-ui.js";

export const BILD_ABLAGE = "website-bilder";

/* Dieselben Grenzen wie am Bucket (Migration v137). Die dort sind die
   Absicherung - sie melden sich erst nach dem Hochladen und in Englisch.
   Die hier sind die Hoeflichkeit: sie sagen vorher, was nicht geht. */
export const BILD_HOECHSTGROESSE = 3 * 1024 * 1024;
export const BILD_TYPEN = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

const MOTIV_TEXTE = Object.freeze({
  aufmacher: ["Aufmacher", "Das große Bild ganz oben auf der Startseite"],
  schiriWerden: ["Schiri werden", "Kachel zum Weg in die Schiedsrichterei"],
  quiz: ["Quiz", "Kachel zum Wochenquiz"],
  spesen: ["Spesen", "Kachel zum Spesenrechner"],
  vorlagen: ["Absagen", "Kachel zu den E-Mail-Vorlagen"],
  unterlagen: ["Unterlagen", "Kachel zu den Links und Dokumenten"],
  melden: ["Melden", "Kachel zum Melden von Vorfällen"],
});

function groesseInWorten(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 0.1) return `${mb.toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(bytes / 1024).toLocaleString("de-DE")} KB`;
}

/**
 * Prueft die Datei im Browser, bevor sie ueberhaupt losgeschickt wird.
 * Gibt einen fertigen deutschen Satz zurueck oder "" fuer "in Ordnung".
 */
export function pruefeBilddatei(datei) {
  if (!datei) return "Es ist keine Datei ausgewählt.";
  if (!BILD_TYPEN[datei.type]) {
    const name = datei.type || "unbekannt";
    return `Dieses Dateiformat (${name}) geht nicht. Erlaubt sind JPG, PNG und WebP.`;
  }
  if (datei.size > BILD_HOECHSTGROESSE) {
    return `Das Bild ist ${groesseInWorten(datei.size)} groß, erlaubt sind ${groesseInWorten(BILD_HOECHSTGROESSE)}.`;
  }
  return "";
}

/**
 * Der Pfad in der Ablage: "<seitenschluessel>/<motiv>-<zeitstempel>.<ext>".
 *
 * Der erste Abschnitt MUSS der Seitenschluessel sein - genau daran haengt
 * die Schreibberechtigung in der Datenbank (Migration v137).
 *
 * Der Zeitstempel ist kein Schmuck: wuerde jedes neue Bild denselben Pfad
 * belegen, zeigten Browser und Zwischenspeicher tagelang noch das alte.
 * Deshalb bekommt jeder Upload eine eigene Adresse - und deshalb laedt der
 * Editor auch mit upsert: false hoch, damit ein Versehen auffaellt statt
 * still zu ueberschreiben.
 */
export function bildPfad({ seitenschluessel, motiv, datei, jetzt = Date.now() }) {
  const endung = BILD_TYPEN[datei?.type] || "bin";
  return `${seitenschluessel}/${motiv}-${jetzt}.${endung}`;
}

export function erstelleBilderEditor({ wurzel, client, verein, benutzer }) {
  let zustand = kopie(BILDER_STANDARD);
  const speicher = erstelleInhaltsSpeicher({ client, verein, benutzer, bereich: "bilder", fallback: BILDER_STANDARD });
  wurzel.innerHTML = bereichsGeruest({
    titel: "Bilder",
    untertitel: "Die Motive der Startseite austauschen. Ohne eigenes Bild bleibt die mitgelieferte Grafik stehen.",
    kennung: "Bilder",
  });
  const editor = wurzel.querySelector("[data-inhalt-editor]");

  function motivZeile(name) {
    const motiv = zustand.motive[name];
    const [titel, beschreibung] = MOTIV_TEXTE[name] || [name, ""];
    const ersatz = BILDER?.[name]?.ersatz || "";
    const zeile = document.createElement("article");
    zeile.className = "admin-bild-zeile";
    zeile.innerHTML = `
      <div class="admin-bild-vorschau"><img alt="" /></div>
      <div class="admin-bild-text">
        <strong></strong>
        <small></small>
        <p class="admin-bild-quelle" data-quelle></p>
        <label>Alternativtext (optional)<input data-feld="alt" maxlength="300" /></label>
        <p class="admin-bild-hinweis">Leer lassen, solange das Bild nur schmückt. Ausfüllen nur, wenn es etwas zeigt, das sonst nirgends auf der Seite steht – dann in einem kurzen Satz beschreiben, was zu sehen ist.</p>
      </div>
      <div class="admin-bild-aktionen">
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-datei />
        <button class="knopf" type="button" data-auswaehlen>Bild auswählen</button>
        <button class="admin-icon-knopf" type="button" data-entfernen><span aria-hidden="true">&times;</span> Entfernen</button>
        <p class="admin-bild-fortschritt" data-fortschritt role="status"></p>
      </div>`;

    zeile.querySelector("strong").textContent = titel;
    zeile.querySelector("small").textContent = beschreibung;
    const bild = zeile.querySelector(".admin-bild-vorschau img");
    bild.src = motiv.url || ersatz;
    zeile.querySelector("[data-quelle]").textContent = motiv.url
      ? "Eigenes Bild"
      : "Mitgelieferte Grafik";

    const altFeld = zeile.querySelector('[data-feld="alt"]');
    altFeld.value = motiv.alt;
    altFeld.addEventListener("input", () => { motiv.alt = altFeld.value; });

    const fortschritt = zeile.querySelector("[data-fortschritt]");
    const dateiFeld = zeile.querySelector("[data-datei]");
    const auswahlKnopf = zeile.querySelector("[data-auswaehlen]");
    auswahlKnopf.addEventListener("click", () => dateiFeld.click());

    const entfernen = zeile.querySelector("[data-entfernen]");
    entfernen.hidden = !motiv.url;
    entfernen.addEventListener("click", () => {
      if (!window.confirm(`Beim Motiv „${titel}“ wieder die mitgelieferte Grafik zeigen?`)) return;
      // Nur die Adresse loeschen. Die Datei bleibt in der Ablage: sie
      // koennte in einem archivierten Stand noch gebraucht werden.
      motiv.url = "";
      rendern();
      setzeStatus(wurzel, `„${titel}“ zeigt wieder die mitgelieferte Grafik – öffentlich erst nach dem Veröffentlichen.`);
    });

    dateiFeld.addEventListener("change", async () => {
      const datei = dateiFeld.files?.[0];
      dateiFeld.value = "";
      if (!datei) return;
      const beanstandung = pruefeBilddatei(datei);
      if (beanstandung) {
        fortschritt.textContent = beanstandung;
        fortschritt.dataset.art = "fehler";
        return;
      }
      auswahlKnopf.disabled = true;
      fortschritt.dataset.art = "info";
      fortschritt.textContent = `„${datei.name}“ (${groesseInWorten(datei.size)}) wird hochgeladen …`;
      try {
        const pfad = bildPfad({ seitenschluessel: verein.seitenschluessel, motiv: name, datei });
        const hochgeladen = await client.storage.from(BILD_ABLAGE).upload(pfad, datei, { upsert: false });
        if (hochgeladen.error) throw hochgeladen.error;
        const adresse = client.storage.from(BILD_ABLAGE).getPublicUrl(pfad)?.data?.publicUrl;
        if (!adresse) throw new Error("Die Ablage hat keine öffentliche Adresse zurückgegeben.");
        motiv.url = adresse;
        rendern();
        setzeStatus(wurzel, `„${titel}“ ist hochgeladen. Auf der Vereinsseite steht es erst nach „Bilder veröffentlichen“.`);
      } catch (fehler) {
        fortschritt.dataset.art = "fehler";
        fortschritt.textContent = `Hochladen fehlgeschlagen: ${fehler.message}`;
      } finally {
        auswahlKnopf.disabled = false;
      }
    });

    return zeile;
  }

  function rendern() {
    editor.replaceChildren();
    const panel = document.createElement("section");
    panel.className = "admin-panel";
    panel.innerHTML = `<div class="admin-panel-kopf"><h2>Motive der Startseite</h2>
      <p>JPG, PNG oder WebP bis 3 MB. Jedes Bild bekommt beim Hochladen eine eigene Adresse – so zeigt niemand nach dem Wechsel noch tagelang das alte Motiv.</p></div>`;
    const liste = document.createElement("div");
    liste.className = "admin-bild-liste";
    BILD_MOTIVE.forEach((name) => liste.appendChild(motivZeile(name)));
    panel.appendChild(liste);
    editor.appendChild(panel);
  }

  bindeInhaltsAktionen({
    wurzel, speicher, bereichName: "Diese Bilder",
    aktuellerStand: () => zustand, setzeStand: (wert) => { zustand = wert; }, rendern,
  });
  speicher.laden().then((ergebnis) => {
    zustand = kopie(ergebnis.konfiguration); rendern();
    setzeStatus(wurzel, ergebnis.istFallback ? "Statischer Ausgangsstand – noch kein eigenes Bild veröffentlicht." : `Veröffentlichter Stand vom ${datumText(ergebnis.aktualisiertAm)}.`);
  }).catch((fehler) => setzeStatus(wurzel, `Laden fehlgeschlagen: ${fehler.message}`, "fehler"));
}
