// ============================================================
//  Vergleichs- und Auswertungsdarstellung fuer den Duell-Modus (Teile B/D)
// ============================================================
//  Ausgelagert aus duell-seite.js, nach dem Vorbild von
//  melden-seite.js/melden-arten.js: eine grosse Fachverantwortung, ein
//  eigenes Modul. Alles hier baut nur DOM aus den Daten von
//  "duell_verlauf" - keine eigenen Serveraufrufe, die bleiben in
//  duell-seite.js/duell-zugriff.js.
//
//  WICHTIGE SPERRE aus der RPC (Migration v120): bei einem ANDEREN
//  Teilnehmer sind status/auswahl/freitext/zweiter_freitext nur dann
//  gefuellt, wenn man diese Frage selbst schon beantwortet hat -
//  "beantwortet" ist aber immer sichtbar. Diese Datei geht davon aus,
//  dass der Server das schon durchsetzt, und unterscheidet nur noch die
//  drei Faelle, die daraus entstehen: noch nicht beantwortet, beantwortet
//  aber (noch) gesperrt, beantwortet und sichtbar.
// ============================================================

import { fortsetzungLabel, mannschaftLabel, strafeLabel, ROLLEN } from "./entscheidungs-optionen.js";

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));

// Reine Funktion, absichtlich exportiert - direkt testbar ohne DOM.
export function symbolUndKlasseFuerStatus(status) {
  if (status === "richtig") return { symbol: "✓", klasse: "richtig" };
  if (status === "nachbessern") return { symbol: "🟠", klasse: "teilweise" };
  return { symbol: "✕", klasse: "falsch" };
}

// Ebenfalls reine Funktion: liest aus einer Verlauf-Frage die lesbare
// Antwort eines Teilnehmers heraus (Multiple-Choice-Schluessel -> Text,
// Freitext inkl. Ergaenzung).
export function formatiereAntwort(frageEintrag, teilnehmer) {
  if (frageEintrag.antworttyp === "freitext") {
    let text = teilnehmer.freitext || "";
    if (teilnehmer.zweiter_freitext) text += (text ? " · Ergänzung: " : "Ergänzung: ") + teilnehmer.zweiter_freitext;
    return text || "–";
  }
  if (frageEintrag.antworttyp === "zahl") {
    const d = teilnehmer.details || {};
    const wert = Number.isFinite(Number(d.wert))
      ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(Number(d.wert)) : d.wert;
    return `${wert ?? "–"} ${d.einheit || ""}`.trim();
  }
  if (frageEintrag.antworttyp === "entscheidung") {
    const a = teilnehmer.details?.antwort || {};
    const teile = [];
    if (a.spielfortsetzung) {
      let fort = fortsetzungLabel(a.spielfortsetzung);
      if (a.fortsetzung_fuer) fort += ` für ${mannschaftLabel(a.fortsetzung_fuer)}`;
      if (a.fortsetzung_ort) fort += ` · ${a.fortsetzung_ort}`;
      teile.push(fort);
    }
    const strafen = Array.isArray(a.strafen) ? a.strafen : [];
    if (strafen.length) {
      teile.push(strafen.map((s) => `${strafeLabel(s.strafe)}${s.fuer_mannschaft ? ` für ${mannschaftLabel(s.fuer_mannschaft)}` : ""}${s.strafe_fuer_rolle ? ` (${ROLLEN[s.strafe_fuer_rolle] || s.strafe_fuer_rolle}${s.rueckennummer ? `, Nr. ${s.rueckennummer}` : ""})` : ""}`).join("; "));
    } else if (a.persoenliche_strafe === "keine" || a.strafen) {
      teile.push("Keine persönliche Strafe");
    }
    return teile.join(" · ") || "–";
  }
  const optionen = frageEintrag.antwortoptionen || [];
  const gewaehlt = teilnehmer.auswahl || [];
  const texte = gewaehlt.map((schluessel) => optionen.find((o) => o.schluessel === schluessel)?.text || schluessel);
  return texte.length ? texte.join(", ") : "–";
}

function baueTeilnehmerZeile(frageEintrag, teilnehmer) {
  const zeile = document.createElement("div");
  zeile.className = "duell-vergleich-zeile" + (teilnehmer.ist_ich ? " mir" : "");
  zeile.dataset.teilnehmerName = teilnehmer.name;

  if (!teilnehmer.beantwortet) {
    zeile.classList.add("wartend");
    zeile.innerHTML = `<span class="duell-vergleich-name">${esc(teilnehmer.name)}</span>
      <p class="duell-vergleich-warten">Wartet noch auf ${teilnehmer.ist_ich ? "deine" : "ihre/seine"} Antwort …</p>`;
    return zeile;
  }

  // Beantwortet, aber der Server haelt Details zurueck (siehe Kommentar
  // oben) - man hat diese Frage selbst noch nicht beantwortet.
  if (!teilnehmer.ist_ich && teilnehmer.status == null) {
    zeile.classList.add("gesperrt");
    zeile.innerHTML = `<span class="duell-vergleich-name">${esc(teilnehmer.name)}</span>
      <p class="duell-vergleich-gesperrt">Hat schon geantwortet – sichtbar, sobald du selbst antwortest.</p>`;
    return zeile;
  }

  const { symbol, klasse } = symbolUndKlasseFuerStatus(teilnehmer.status);
  zeile.classList.add(klasse);
  zeile.innerHTML = `<div class="duell-vergleich-kopf"><span class="duell-vergleich-name">${esc(teilnehmer.name)}</span>
      <span class="duell-vergleich-symbol">${symbol}</span></div>
    <p class="duell-vergleich-antwort">${esc(formatiereAntwort(frageEintrag, teilnehmer))}</p>`;
  return zeile;
}

// Der Vergleichsblock fuer EINE Frage: die eigene Zeile zuerst, danach
// jede weitere Person. Trägt eine Fade-Klasse fürs erste Aufdecken -
// rein CSS (duell.css), keine Bibliothek noetig.
export function baueVergleichsBlock(frageEintrag) {
  const wrap = document.createElement("div");
  wrap.className = "duell-vergleich duell-einblenden";
  const teilnehmer = [...(frageEintrag.teilnehmer || [])].sort((a, b) => (a.ist_ich ? -1 : 1) - (b.ist_ich ? -1 : 1));
  for (const t of teilnehmer) wrap.appendChild(baueTeilnehmerZeile(frageEintrag, t));
  return wrap;
}

// Findet im gerade gebauten Vergleichsblock die Zeile einer bestimmten
// Person - genutzt, um dort spaeter eine Reaktions-Pille anzuhaengen
// (Teil F, siehe duell-reaktionen.js).
export function findeTeilnehmerZeile(vergleichsBlock, name) {
  return vergleichsBlock?.querySelector(`[data-teilnehmer-name="${CSS.escape(name)}"]`) || null;
}

// Eigener Stand ueber alle Fragen: X von 5 beantwortet, davon Y richtig.
// Bei einer anderen Person zaehlt nur, was gerade sichtbar ist (siehe
// Kommentar oben) - das ist ehrlich weniger aussagekraeftig, aber es
// gibt keine Moeglichkeit, mehr zu wissen, ohne die Sperre zu umgehen.
function eigenerStand(fragen, name) {
  let beantwortet = 0, richtig = 0, sichtbar = 0;
  for (const f of fragen) {
    const t = f.teilnehmer.find((x) => x.name === name);
    if (!t?.beantwortet) continue;
    beantwortet += 1;
    if (t.status == null) continue;
    sichtbar += 1;
    if (t.status === "richtig") richtig += 1;
  }
  return { beantwortet, richtig, sichtbar, gesamt: fragen.length };
}

function baueStandKachel(name, istIch, fragen) {
  const stand = eigenerStand(fragen, name);
  const kachel = document.createElement("div");
  kachel.className = "duell-stand-kachel";
  const zeile = istIch || stand.sichtbar === stand.beantwortet
    ? `${stand.richtig} von ${stand.beantwortet} richtig · ${stand.beantwortet}/${stand.gesamt} gespielt`
    : `${stand.richtig} von ${stand.sichtbar} sichtbar richtig · ${stand.beantwortet}/${stand.gesamt} gespielt`;
  kachel.innerHTML = `<strong>${esc(name)}${istIch ? " (du)" : ""}</strong><span>${esc(zeile)}</span>`;
  return kachel;
}

function baueErgebnisBanner(fragen, namen) {
  const staende = namen.map((name) => ({
    name,
    istIch: fragen.some((f) => f.teilnehmer.find((t) => t.name === name)?.ist_ich),
    ...eigenerStand(fragen, name),
  }));
  const ich = staende.find((stand) => stand.istIch);
  if (!ich?.beantwortet) return null;

  const alleFertig = staende.every((stand) => stand.beantwortet >= stand.gesamt);
  const banner = document.createElement("section");
  banner.className = "duell-ergebnis-banner";

  if (!alleFertig) {
    const offene = staende.filter((stand) => stand.beantwortet < stand.gesamt && !stand.istIch).length;
    banner.classList.add("laeuft");
    banner.innerHTML = `<span>⏳</span><div><strong>${ich.beantwortet >= ich.gesamt ? "Du bist fertig" : "Duell läuft"}</strong>
      <p>${offene ? `${offene} ${offene === 1 ? "Person spielt" : "Personen spielen"} noch.` : "Spiele die offenen Fragen weiter."}</p></div>`;
    return banner;
  }

  const hoechsterStand = Math.max(...staende.map((stand) => stand.richtig));
  const gewinner = staende.filter((stand) => stand.richtig === hoechsterStand);
  const ichGewinne = gewinner.some((stand) => stand.istIch);
  const unentschieden = gewinner.length > 1;
  banner.classList.add(ichGewinne && !unentschieden ? "gewonnen" : unentschieden ? "unentschieden" : "verloren");
  const titel = unentschieden ? "Unentschieden" : ichGewinne ? "Du gewinnst das Duell" : `${gewinner[0].name} gewinnt`;
  const punktText = `${ich.richtig} von ${ich.gesamt} Fragen richtig`;
  banner.innerHTML = `<span>${unentschieden ? "🤝" : ichGewinne ? "🏆" : "⚔️"}</span><div><strong>${esc(titel)}</strong><p>${esc(punktText)}</p></div>`;
  return banner;
}

// Der komplette Auswertungsscreen (Teil D): Gesamtstand oben, darunter
// jede der 5 Fragen mit ihrem Vergleichsblock. "aufWeiterspielen" bleibt
// weg, wenn das Duell fuer diese Person schon fertig ist.
export function baueUebersicht(verlauf, {
  weiterspielenErlaubt = false, aufWeiterspielen, aufNeuesDuell, aufDuellListe,
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "duell-uebersicht";

  const kopf = document.createElement("div");
  kopf.className = "duell-uebersicht-kopf";
  kopf.innerHTML = `<div class="historie-kopf"><button type="button" class="sekundaer-button" data-duell-liste>Duellübersicht</button>
    <button type="button" class="historie-neu-laden-button" data-neues-duell>Neues Duell</button></div>
    <h1>Auswertung</h1><p>Duell ${esc(verlauf.code)} · Runde für Runde im Vergleich.</p>`;
  wrap.appendChild(kopf);

  const namen = [...new Set((verlauf.fragen || []).flatMap((f) => f.teilnehmer.map((t) => t.name)))];
  const ergebnis = baueErgebnisBanner(verlauf.fragen || [], namen);
  if (ergebnis) wrap.appendChild(ergebnis);
  const standReihe = document.createElement("div");
  standReihe.className = "historie-scoreboard duell-stand-reihe";
  for (const name of namen) {
    const istIch = verlauf.fragen.some((f) => f.teilnehmer.find((t) => t.name === name)?.ist_ich);
    standReihe.appendChild(baueStandKachel(name, istIch, verlauf.fragen));
  }
  wrap.appendChild(standReihe);

  for (const frageEintrag of verlauf.fragen || []) {
    const block = document.createElement("section");
    block.className = "frage-karte frage-karte-historie duell-uebersicht-frage";
    block.dataset.frageId = frageEintrag.frage_id;
    const kopfZeile = document.createElement("div");
    kopfZeile.className = "duell-uebersicht-frage-kopf";
    kopfZeile.innerHTML = `<span class="badge">Frage ${frageEintrag.position}</span>
      <p class="duell-uebersicht-frage-text">${esc(frageEintrag.frage_text)}</p>`;
    block.appendChild(kopfZeile);
    block.appendChild(baueVergleichsBlock(frageEintrag));
    wrap.appendChild(block);
  }

  if (weiterspielenErlaubt && typeof aufWeiterspielen === "function") {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "historie-weiter-button";
    knopf.textContent = "Weiterspielen";
    knopf.addEventListener("click", aufWeiterspielen);
    wrap.appendChild(knopf);
  }

  const zurueck = document.createElement("a");
  zurueck.className = "duell-zurueck";
  zurueck.href = "modus.html";
  zurueck.textContent = "← Zurück zu den Modi";
  wrap.appendChild(zurueck);

  kopf.querySelector("[data-neues-duell]")?.addEventListener("click", () => aufNeuesDuell?.());
  kopf.querySelector("[data-duell-liste]")?.addEventListener("click", () => aufDuellListe?.());

  return wrap;
}
