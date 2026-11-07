import { DATENBANK } from "../../verein.config.js";

const root = document.getElementById("szenencheck");
const anmeldung = globalThis.SchiriAnmeldung.erstelleAnmeldung(DATENBANK);
const login = globalThis.SchiriLoginDialog.erstelleLoginDialog({ anmeldung, maskierung: globalThis.SchiriQuizMaskedInputs });
const escape = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const datum = x => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(x));
const namen = { foul: "Foul", weiterspielen: "Weiterspielen", keine: "Keine Karte", gelb: "Gelbe Karte", gelb_rot: "Gelb-Rote Karte", rot: "Rote Karte" };
const fehler = { zugang: "Zugang nicht möglich. Prüfe Pilotcode und Anmeldung.", warte: "Zu viele Versuche. Bitte warte 15 Minuten.", geschlossen: "Die Abstimmung ist beendet. Lade die Runde neu.", runde: "Diese Runde ist nicht mehr verfügbar.", clip: "Das Video ist gerade nicht verfügbar.", antwort: "Bitte vervollständige deine Antwort." };
let person, code = "", stand, archivRunde, position = 0, generation = 0, busy = false;

async function api(aktion, zusatz = {}) {
  const res = await fetch(`${DATENBANK.adresse}/functions/v1/szenencheck`, {
    method: "POST", cache: "no-store", credentials: "omit",
    headers: { "content-type": "application/json", apikey: DATENBANK.oeffentlicherSchluessel },
    body: JSON.stringify({ aktion, person: person?.id, pin: person?.pin, code, ...zusatz }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(fehler[data.fehler] || "Der Szenencheck ist gerade nicht erreichbar."), { grund: data.fehler });
  return data;
}

function status(text, istFehler = false) {
  const el = root.querySelector("[data-status]");
  if (el) { el.textContent = text; el.classList.toggle("sc-fehler", istFehler); }
}
function option(name, value, label, checked, symbol = "") {
  const icons = { foul: "✋", weiterspielen: "▶", keine: "–" };
  return `<label class="sc-option"><input type="radio" name="${name}" value="${escape(value)}"${checked ? " checked" : ""}>${symbol ? `<span class="sc-icon" data-symbol="${symbol}" aria-hidden="true">${icons[symbol] || ""}</span>` : ""}<span>${escape(label)}</span></label>`;
}
function feld(name, label, values, answer, icons) {
  return `<fieldset><legend>${label}</legend><div class="sc-auswahl">${values.map(value => option(name, value, icons ? namen[value] : value, answer[name] === value, icons ? value : "")).join("")}</div></fieldset>`;
}
function antwortText(a) {
  if (!a) return "Keine Antwort abgegeben";
  if (a.enthaltung) return "Nicht beurteilbar";
  if (a.text) return a.text;
  return a.wahl || [namen[a.pfiff], namen[a.karte]].filter(Boolean).join(" · ") || "Freitext abgegeben";
}
function szene() { return stand?.szenen?.[position]; }
function render() {
  const sc = szene(), offen = stand?.phase === "offen";
  const beschreibung = '<p>Szene ansehen, selbst entscheiden und später die Einschätzungen vergleichen. Ohne Punkte und ohne KI-Bewertung.</p>';
  const nachricht = '<p class="sc-status" data-status role="status"></p>';
  if (!person) {
    root.innerHTML = `<p class="sc-meta">Szenencheck</p><h1>Entscheiden</h1>${beschreibung}<button class="sc-primaer" data-action="login">Mit Vereinskennung anmelden</button>${nachricht}`;
  } else if (!stand) {
    root.innerHTML = `<p class="sc-meta">Vereinsinterner Pilot</p><h1>Entscheiden</h1>${beschreibung}<form id="sc-code"><label for="sc-pin">Pilotcode</label><input id="sc-pin" name="code" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" maxlength="4" required><button class="sc-primaer">Entsperren</button></form>${nachricht}`;
  } else if (!sc) {
    root.innerHTML = `<p class="sc-meta">Szenencheck</p><h1>Entscheiden</h1><p>${stand.phase === "geplant" ? `Die erste Runde startet am ${datum(stand.beginn)} Uhr.` : "Der Modus ist freigeschaltet. Es wurde noch keine Runde angesetzt."}</p><button data-action="aktuell">Aktualisieren</button>${nachricht}`;
  } else {
    const a = stand.stimmen[sc.id] || {};
    const beantwortet = Object.keys(stand.stimmen).length;
    let antwort = "";
    if (offen) {
      if (["pfiff", "detail"].includes(sc.art)) antwort += feld("pfiff", "Dein Pfiff", ["foul", "weiterspielen"], a, true);
      if (["karte", "detail"].includes(sc.art)) antwort += feld("karte", "Persönliche Strafe", ["keine", "gelb", "gelb_rot", "rot"], a, true);
      if (sc.art === "multipleChoice") antwort += feld("wahl", "Deine Entscheidung", sc.optionen, a, false);
      if (sc.art === "freitext") antwort += `<label for="sc-text">Deine Einschätzung</label><textarea id="sc-text" name="text" rows="4" maxlength="1200">${escape(a.text)}</textarea>`;
      antwort = `<form id="sc-stimme">${antwort}<div class="sc-zeile"><button class="sc-primaer">${stand.stimmen[sc.id] ? "Antwort ändern" : "Antwort speichern"}</button><button type="button" data-action="enthalten">Nicht beurteilbar</button></div></form>
        ${a.enthaltung ? "<p>Gespeichert: Nicht beurteilbar.</p>" : ""}`;
    } else {
      const zahlen = stand.recap[sc.id] || [];
      antwort = `<section class="sc-recap"><h3>Gruppenvergleich</h3><p>Deine Antwort: ${escape(antwortText(stand.stimmen[sc.id]))}</p>
        ${zahlen.length ? `<ul>${zahlen.map(row => `<li>${escape(antwortText(row.antwort))}: <strong>${Number(row.anzahl)}</strong></li>`).join("")}</ul>` : "<p>Keine Stimmen abgegeben.</p>"}
        ${sc.feld ? `<p><strong>Entscheidung auf dem Feld / Einordnung:</strong> ${escape(sc.feld)}</p>` : ""}<p>Die Abstimmung zeigt Einschätzungen, keine Musterlösung.</p></section>`;
    }
    const archiv = stand.archiv?.length ? `<form id="sc-archiv" class="sc-archiv"><label for="sc-runde">Runde auswählen</label><div><select id="sc-runde" name="runde"><option value="">Neueste Runde</option>
      ${stand.archiv.map(r => `<option value="${escape(r.id)}"${r.id === archivRunde ? " selected" : ""}>${escape(r.titel)}</option>`).join("")}</select><button>Öffnen</button></div></form>` : "";
    root.innerHTML = `<p class="sc-meta">${offen ? "Abstimmung offen" : "Rückblick"} · ${beantwortet} von ${stand.szenen.length} beantwortet</p><h1>${escape(stand.titel)}</h1>
      <p>${offen ? `Bis ${datum(stand.schluss)} Uhr änderbar. Danach sieht die Gruppe nur zusammengefasste Zahlen; Freitexte bleiben für andere verborgen.` : "Abstimmung beendet · Stimmen ohne Namen"}</p>
      <p class="sc-meta">Szene ${position + 1} / ${stand.szenen.length}</p><h2 tabindex="-1">${escape(sc.titel)}</h2>
      <div class="sc-video" data-video><button data-action="video">${sc.privat ? "Clip laden" : "YouTube-Clip laden"}</button></div>
      ${sc.privat ? "" : `<p><small>Ausschnitt: ${formatZeit(sc.start)}–${formatZeit(sc.ende)} · lädt Inhalte von YouTube.</small></p>`}
      ${sc.kontext ? `<p>${escape(sc.kontext)}</p>` : ""}${antwort}${nachricht}
      <nav class="sc-zeile" aria-label="Szenen wechseln"><button data-action="zurueck"${position === 0 ? " disabled" : ""}>Zurück</button><button data-action="aktuell">Aktualisieren</button><button data-action="weiter"${position >= stand.szenen.length - 1 ? " disabled" : ""}>Weiter</button></nav>${archiv}`;
  }
}
function formatZeit(x) { return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`; }
async function lade(runde = archivRunde) {
  const data = await api("laden", runde ? { runde } : {});
  return () => { if (data.id !== stand?.id) position = 0; stand = data; archivRunde = runde; render(); };
}
async function speichern(a) {
  const aktuelleSzene = szene();
  await api("stimme", { runde: stand.id, szene: aktuelleSzene.id, antwort: a });
  return () => {
    stand.stimmen[aktuelleSzene.id] = a;
    const player = root.querySelector("[data-video]")?.firstElementChild;
    render();
    if (player?.matches("video, iframe")) root.querySelector("[data-video]").replaceChildren(player);
    status("Antwort gespeichert.");
  };
}
async function video() {
  const sc = szene();
  if (sc.privat) {
    const data = await api("video", { runde: stand.id, szene: sc.id });
    const url = new URL(data.url);
    if (url.origin !== new URL(DATENBANK.adresse).origin || !url.pathname.startsWith("/storage/v1/object/sign/szenencheck-clips/")) throw new Error(fehler.clip);
    return () => {
      const v = document.createElement("video");
      v.controls = true; v.playsInline = true; v.preload = "metadata"; v.src = url.href;
      v.addEventListener("error", () => {
        if (!v.isConnected) return;
        const b = document.createElement("button"); b.dataset.action = "video"; b.textContent = "Clip neu laden"; v.replaceWith(b);
        status("Der Clip konnte nicht geladen werden.", true);
      }, { once: true });
      root.querySelector("[data-video]").replaceChildren(v);
    };
  }
  return () => {
    const f = document.createElement("iframe");
    const url = new URL(`https://www.youtube-nocookie.com/embed/${sc.youtube}`);
    url.search = new URLSearchParams({ start: sc.start, end: sc.ende, playsinline: "1", rel: "0" });
    f.src = url.href; f.title = "Video zur Szene"; f.allowFullscreen = true;
    root.querySelector("[data-video]").replaceChildren(f);
  };
}
async function ausfuehren(task, button) {
  if (busy) return;
  busy = true;
  const g = generation;
  if (button) button.disabled = true;
  try { const fertig = await task(); if (g === generation) fertig?.(); }
  catch (e) {
    if (g !== generation) return;
    if (e.grund === "zugang" || e.grund === "warte") { stand = null; code = ""; archivRunde = undefined; render(); }
    if (e.grund === "runde") { archivRunde = undefined; }
    status(e.message, true);
  } finally {
    if (g === generation) { busy = false; if (button?.isConnected) button.disabled = false; }
  }
}
root.addEventListener("submit", e => {
  e.preventDefault();
  if (busy) return;
  const f = new FormData(e.target);
  if (e.target.id === "sc-code") { code = String(f.get("code")); ausfuehren(lade, e.submitter); }
  if (e.target.id === "sc-archiv") ausfuehren(() => lade(String(f.get("runde"))), e.submitter);
  if (e.target.id === "sc-stimme") {
    const a = Object.fromEntries([...f.entries()].map(([k, v]) => [k, v.trim()]));
    const keys = { pfiff: ["pfiff"], karte: ["karte"], detail: ["pfiff", "karte"], multipleChoice: ["wahl"], freitext: ["text"] };
    if (!keys[szene().art].every(k => a[k])) { status(fehler.antwort, true); return; }
    ausfuehren(() => speichern(a), e.submitter);
  }
});
root.addEventListener("click", async e => {
  const b = e.target.closest("[data-action]");
  if (!b || busy) return;
  const action = b.dataset.action;
  if (action === "login") { await login.oeffne({ grund: "Melde dich für den vereinsinternen Szenencheck an.", gastErlaubt: false }); }
  if (action === "aktuell") ausfuehren(lade, b);
  if (action === "video") ausfuehren(video, b);
  if (action === "enthalten") ausfuehren(() => speichern({ enthaltung: true }), b);
  if (action === "weiter" || action === "zurueck") { position += action === "weiter" ? 1 : -1; render(); root.querySelector("h2").focus(); }
});
anmeldung.abonniere(p => { person = p; code = ""; stand = null; archivRunde = undefined; generation++; busy = false; position = 0; render(); });
