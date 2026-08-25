const kopie = (wert) => JSON.parse(JSON.stringify(wert));

export const INHALTSBEREICHE = Object.freeze(["regeln", "vorlagen", "unterlagen"]);

const text = (wert, fallback = "", max = 12000) => {
  const kandidat = typeof wert === "string" ? wert.trim() : "";
  return kandidat ? kandidat.slice(0, max) : fallback;
};

const optionalerText = (wert, fallback = "", max = 12000) => {
  if (typeof wert !== "string") return fallback;
  return wert.trim().slice(0, max);
};

const REGEL_PFLICHTFELDER = Object.freeze({
  svfdMeister: ["a", "k", "zeit", "feld", "max", "min", "w", "wieder", "gr", "t"],
  svfdPokal: ["a", "k", "zeit", "verl", "elfer"],
  sfvMeister: ["a", "k", "feld", "sr", "tore", "ball", "spieler", "zeit", "abseits", "elfer", "match", "temp"],
  sfvPokal: ["a", "k", "feld", "sr", "tore", "ball", "spieler", "zeit", "verl", "abseits", "elfer", "match", "temp"],
});

const link = (wert, fallback = "") => {
  const kandidat = text(wert, "", 2000);
  if (!kandidat) return fallback;
  try {
    const url = new URL(kandidat, "https://vereinsseite.invalid/");
    return ["http:", "https:"].includes(url.protocol) ? kandidat : fallback;
  } catch {
    return fallback;
  }
};

function normalisiereVorlagen(roh, fallback) {
  const normalisiere = (schluessel) => {
    const wert = roh?.[schluessel] || {};
    const standard = fallback[schluessel];
    return {
      titel: text(wert.titel, standard.titel, 160),
      text: text(wert.text, standard.text, 20000),
      hinweis: optionalerText(wert.hinweis, standard.hinweis, 4000),
      quelle: optionalerText(wert.quelle, standard.quelle, 4000),
      entwurf: Boolean(wert.entwurf),
    };
  };
  return { schemaVersion: 1, spiel: normalisiere("spiel"), lehrabend: normalisiere("lehrabend") };
}

function istText(wert) {
  return typeof wert === "string" && Boolean(wert.trim());
}

function istLink(wert) {
  if (!istText(wert)) return false;
  try {
    return ["http:", "https:"].includes(new URL(wert).protocol);
  } catch {
    return false;
  }
}

/**
 * Prüft den bearbeiteten Rohstand vor dem Normalisieren. So werden unvollständige
 * Zeilen oder ungültige Links nicht stillschweigend verworfen und öffentlich.
 */
export function validiereWebsiteInhalt(bereich, roh) {
  const fehler = [];
  if (!INHALTSBEREICHE.includes(bereich) || !roh || typeof roh !== "object" || Array.isArray(roh)) {
    return ["Der Inhaltsbereich hat kein gültiges Datenformat."];
  }

  if (bereich === "vorlagen") {
    for (const [key, name] of [["spiel", "Spielabsage"], ["lehrabend", "Regellehrabend"]]) {
      if (!istText(roh[key]?.titel)) fehler.push(`${name}: Titel fehlt.`);
      if (!istText(roh[key]?.text)) fehler.push(`${name}: E-Mail-Text fehlt.`);
    }
  }

  if (bereich === "unterlagen") {
    const gruppen = Array.isArray(roh.gruppen) ? roh.gruppen : [];
    const gruppenIds = gruppen.map((gruppe) => gruppe?.id).filter(istText);
    if (!gruppenIds.length) fehler.push("Unterlagen: Mindestens eine Gruppe ist erforderlich.");
    if (new Set(gruppenIds).size !== gruppenIds.length) fehler.push("Unterlagen: Gruppenkennungen müssen eindeutig sein.");
    const dokumentIds = new Set();
    for (const [index, dokument] of (Array.isArray(roh.dokumente) ? roh.dokumente : []).entries()) {
      const name = istText(dokument?.titel) ? dokument.titel.trim() : `Eintrag ${index + 1}`;
      if (!istText(dokument?.id)) fehler.push(`${name}: interne Kennung fehlt.`);
      else if (dokumentIds.has(dokument.id)) fehler.push(`${name}: interne Kennung ist doppelt.`);
      else dokumentIds.add(dokument.id);
      if (!istText(dokument?.titel)) fehler.push(`Unterlagen, Eintrag ${index + 1}: Titel fehlt.`);
      if (!gruppenIds.includes(dokument?.g)) fehler.push(`${name}: Anlass ist ungültig.`);
      if (!istLink(dokument?.href)) fehler.push(`${name}: Link muss vollständig mit https:// oder http:// beginnen.`);
    }
  }

  if (bereich === "regeln") {
    for (const [quelle, name] of [["svfd", "Stadtverband"], ["sfv", "Landesverband"]]) {
      if (!istText(roh.quellen?.[quelle]?.titel)) fehler.push(`${name}: Quellentitel fehlt.`);
      if (!istLink(roh.quellen?.[quelle]?.link)) fehler.push(`${name}: Quellenlink ist ungültig.`);
    }
    for (const [liste, pflichtfelder] of Object.entries(REGEL_PFLICHTFELDER)) {
      const zeilen = Array.isArray(roh[liste]) ? roh[liste] : [];
      if (!zeilen.length) fehler.push(`${liste}: Mindestens eine Regelzeile ist erforderlich.`);
      zeilen.forEach((zeile, index) => {
        const name = istText(zeile?.a) && istText(zeile?.k) ? `${zeile.a} · ${zeile.k}` : `${liste}, Zeile ${index + 1}`;
        for (const feld of pflichtfelder) {
          const wert = zeile?.[feld];
          const istZahl = typeof wert === "number" && Number.isFinite(wert) && wert >= 0;
          const darfLeerSein = feld === "min" && wert === null;
          if (!istText(wert) && !istZahl && !darfLeerSein) fehler.push(`${name}: „${feld}“ fehlt.`);
        }
      });
    }
  }

  return fehler;
}

function normalisiereUnterlagen(roh, fallback) {
  const gruppenStandard = new Map(fallback.gruppen.map((gruppe) => [gruppe.id, gruppe]));
  const gruppen = (Array.isArray(roh?.gruppen) ? roh.gruppen : fallback.gruppen)
    .map((gruppe) => {
      const standard = gruppenStandard.get(gruppe?.id) || {};
      return {
        id: text(gruppe?.id, standard.id, 50).replace(/[^a-z0-9-]/g, ""),
        titel: text(gruppe?.titel, standard.titel, 160),
        kurz: text(gruppe?.kurz, standard.kurz, 80),
      };
    })
    .filter((gruppe) => gruppe.id && gruppe.titel && gruppe.kurz);
  const erlaubteGruppen = new Set(gruppen.map((gruppe) => gruppe.id));
  const dokumente = (Array.isArray(roh?.dokumente) ? roh.dokumente : fallback.dokumente)
    .map((dokument, index) => ({
      id: text(dokument?.id, `dokument-${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, ""),
      g: erlaubteGruppen.has(dokument?.g) ? dokument.g : gruppen[0]?.id,
      titel: text(dokument?.titel, "Dokument", 220),
      sub: text(dokument?.sub, "", 1200),
      href: link(dokument?.href, ""),
      q: ["hier", "svfd", "sfv"].includes(dokument?.q) ? dokument.q : "svfd",
      aktiv: dokument?.aktiv !== false,
    }))
    .filter((dokument) => dokument.id && dokument.g && dokument.titel && dokument.href);
  return {
    schemaVersion: 1,
    herkunft: kopie(fallback.herkunft),
    gruppen,
    dokumente,
  };
}

function normalisiereRegeln(roh, fallback) {
  const quellen = {};
  for (const schluessel of ["svfd", "sfv"]) {
    const wert = roh?.quellen?.[schluessel] || {};
    const standard = fallback.quellen[schluessel];
    quellen[schluessel] = {
      titel: text(wert.titel, standard.titel, 200),
      stand: text(wert.stand, standard.stand, 300),
      warnung: Boolean(wert.warnung),
      hinweis: text(wert.hinweis, standard.hinweis, 6000),
      link: link(wert.link, standard.link),
      linkText: text(wert.linkText, standard.linkText, 180),
    };
  }
  const listen = {};
  for (const schluessel of ["svfdMeister", "svfdPokal", "sfvMeister", "sfvPokal"]) {
    const kandidat = Array.isArray(roh?.[schluessel]) ? roh[schluessel] : fallback[schluessel];
    listen[schluessel] = kandidat
      .filter((zeile) => zeile && typeof zeile === "object" && !Array.isArray(zeile))
      .map((zeile) => {
        const sauber = {};
        for (const [key, wert] of Object.entries(zeile)) {
          if (!/^[a-z][a-z0-9]*$/i.test(key)) continue;
          if (typeof wert === "string") sauber[key] = wert.trim().slice(0, 8000);
          else if (typeof wert === "number" || wert === null || typeof wert === "boolean") sauber[key] = wert;
          else if (key === "extra" && Array.isArray(wert)) {
            sauber.extra = wert.slice(0, 30).map((paar) => [text(paar?.[0], "", 120), text(paar?.[1], "", 800)]);
          }
        }
        return sauber;
      })
      .filter((zeile) => zeile.a && zeile.k);
  }
  return {
    schemaVersion: 1,
    quellen,
    ...listen,
    sfvWechselspieler: text(roh?.sfvWechselspieler, fallback.sfvWechselspieler, 300),
    sfvRueckwechsel: text(roh?.sfvRueckwechsel, fallback.sfvRueckwechsel, 300),
    bereiche: kopie(fallback.bereiche),
  };
}

export function normalisiereWebsiteInhalt(bereich, roh, fallback) {
  if (!INHALTSBEREICHE.includes(bereich) || !fallback) throw new Error("Unbekannter Inhaltsbereich.");
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return kopie(fallback);
  if (bereich === "vorlagen") return normalisiereVorlagen(roh, fallback);
  if (bereich === "unterlagen") return normalisiereUnterlagen(roh, fallback);
  return normalisiereRegeln(roh, fallback);
}

export async function ladeWebsiteInhalt({ datenbank, seitenschluessel, bereich, fallback, fetchImpl = globalThis.fetch }) {
  if (!datenbank?.adresse || !datenbank?.oeffentlicherSchluessel || !seitenschluessel) {
    return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
  }
  try {
    const site = encodeURIComponent(`eq.${seitenschluessel}`);
    const typ = encodeURIComponent(`eq.${bereich}`);
    const url = `${datenbank.adresse}/rest/v1/website_inhalte_konfiguration`
      + `?seitenschluessel=${site}&bereich=${typ}&select=konfiguration,updated_at&limit=1`;
    const antwort = await fetchImpl(url, {
      headers: {
        apikey: datenbank.oeffentlicherSchluessel,
        Authorization: `Bearer ${datenbank.oeffentlicherSchluessel}`,
      },
    });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const zeilen = await antwort.json();
    if (!Array.isArray(zeilen) || !zeilen[0]?.konfiguration) {
      return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
    }
    return {
      konfiguration: normalisiereWebsiteInhalt(bereich, zeilen[0].konfiguration, fallback),
      quelle: "datenbank",
      aktualisiertAm: zeilen[0].updated_at || null,
    };
  } catch (fehler) {
    console.warn(`${bereich}: veröffentlichte Konfiguration nicht erreichbar; statischer Stand wird verwendet.`, fehler);
    return { konfiguration: kopie(fallback), quelle: "statisch", aktualisiertAm: null };
  }
}
