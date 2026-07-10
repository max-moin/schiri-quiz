// ============================================================
// Schiri-Quiz - Frontend-Logik
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY = "schiriQuizSession";

const nameAuswahl = document.getElementById("name-auswahl");
const pinEingabe = document.getElementById("pin-eingabe");
const startButton = document.getElementById("start-button");
const nameSchritt = document.getElementById("name-schritt");
const angemeldetLeiste = document.getElementById("angemeldet-leiste");
const angemeldetName = document.getElementById("angemeldet-name");
const wechselnButton = document.getElementById("wechseln-button");
const fragenSchritt = document.getElementById("fragen-schritt");
const fragenListe = document.getElementById("fragen-liste");
const sammelAbsendenWrap = document.getElementById("sammel-absenden-wrap");
const sammelAbsendenButton = document.getElementById("sammel-absenden-button");
const keineFragenHinweis = document.getElementById("keine-fragen-hinweis");
const fertigHinweis = document.getElementById("fertig-hinweis");
const naechsteRundeText = document.getElementById("naechste-runde-text");
const fehlerHinweis = document.getElementById("fehler-hinweis");
const fortschrittWrap = document.getElementById("fortschritt-wrap");
const fortschrittText = document.getElementById("fortschritt-text");
const fortschrittProzent = document.getElementById("fortschritt-prozent");
const fortschrittFill = document.getElementById("fortschritt-fill");
const konfettiSchicht = document.getElementById("konfetti-schicht");

let ausgewaehlteSchiedsrichterId = null;
let eingegebenePin = null;
let gesamtFragenAnzahl = 0;
let beantworteFragenAnzahl = 0;
let countdownInterval = null;

function zeigeFehler(text) {
  fehlerHinweis.textContent = text;
  fehlerHinweis.hidden = false;
}

function versteckeFehler() {
  fehlerHinweis.hidden = true;
}

function speichereSession(id, pin, name) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, pin, name }));
  } catch (e) {
    // Falls sessionStorage mal nicht verfügbar ist (z.B. privates Fenster) -
    // kein Problem, dann bleibt man einfach ohne Session-Merken angemeldet.
  }
}

function leseGespeicherteSession() {
  try {
    const roh = sessionStorage.getItem(SESSION_KEY);
    return roh ? JSON.parse(roh) : null;
  } catch (e) {
    return null;
  }
}

function loescheGespeicherteSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    // ignorieren
  }
}

function zeigeAngemeldetenZustand(name) {
  nameSchritt.hidden = true;
  angemeldetName.textContent = name;
  angemeldetLeiste.hidden = false;
  fragenSchritt.hidden = false;
  fortschrittWrap.hidden = false;
}

async function ladeSchiedsrichter() {
  const { data, error } = await sb
    .from("schiedsrichter_oeffentlich")
    .select("id, name")
    .order("name");

  if (error) {
    zeigeFehler("Namensliste konnte nicht geladen werden: " + error.message);
    return;
  }

  for (const person of data) {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    nameAuswahl.appendChild(option);
  }
}

function pruefeEingabenVollstaendig() {
  startButton.disabled = !(nameAuswahl.value && pinEingabe.value.trim().length > 0);
}

nameAuswahl.addEventListener("change", pruefeEingabenVollstaendig);
pinEingabe.addEventListener("input", pruefeEingabenVollstaendig);

startButton.addEventListener("click", async () => {
  versteckeFehler();
  const schiedsrichterId = nameAuswahl.value;
  const pin = pinEingabe.value.trim();

  startButton.disabled = true;
  const buttonText = startButton.querySelector("span");
  const vorherigerText = buttonText ? buttonText.textContent : null;
  if (buttonText) buttonText.textContent = "Prüfe PIN ...";

  const { data: pinOk, error } = await sb.rpc("pin_pruefen", {
    p_schiedsrichter_id: schiedsrichterId,
    p_pin: pin,
  });

  if (buttonText && vorherigerText) buttonText.textContent = vorherigerText;

  if (error) {
    zeigeFehler("PIN konnte nicht geprüft werden: " + error.message);
    startButton.disabled = false;
    return;
  }

  if (!pinOk) {
    zeigeFehler("PIN ist falsch. Bitte nochmal versuchen.");
    startButton.disabled = false;
    pinEingabe.value = "";
    pinEingabe.focus();
    return;
  }

  ausgewaehlteSchiedsrichterId = schiedsrichterId;
  eingegebenePin = pin;

  const name = nameAuswahl.options[nameAuswahl.selectedIndex].textContent;
  speichereSession(schiedsrichterId, pin, name);
  zeigeAngemeldetenZustand(name);

  await ladeFragenUndAntworten();
});

wechselnButton.addEventListener("click", () => {
  loescheGespeicherteSession();
  location.reload();
});

async function ladeFragenUndAntworten() {
  const [fragenErgebnis, antwortenErgebnis] = await Promise.all([
    sb
      .from("fragen_oeffentlich")
      .select("id, frage_text, option_a, option_b, option_c, regel_nummer, regel_bezeichnung, schwierigkeit"),
    sb.rpc("meine_antworten", {
      p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
      p_pin: eingegebenePin,
    }),
  ]);

  if (fragenErgebnis.error) {
    zeigeFehler("Fragen konnten nicht geladen werden: " + fragenErgebnis.error.message);
    return;
  }

  const fragen = fragenErgebnis.data;

  if (!fragen || fragen.length === 0) {
    keineFragenHinweis.hidden = false;
    fortschrittWrap.hidden = true;
    return;
  }

  // Falls das Nachladen der bisherigen Antworten fehlschlägt, zeigt die Seite
  // trotzdem alle Fragen ganz normal als offen an - kein Blocker fürs Mitmachen.
  const antwortenNachFrageId = new Map();
  if (!antwortenErgebnis.error && antwortenErgebnis.data) {
    for (const eintrag of antwortenErgebnis.data) {
      antwortenNachFrageId.set(eintrag.frage_id, eintrag);
    }
  }

  gesamtFragenAnzahl = fragen.length;
  beantworteFragenAnzahl = 0;

  for (const frage of fragen) {
    const bisherigeAntwort = antwortenNachFrageId.get(frage.id);
    if (bisherigeAntwort && bisherigeAntwort.beantwortet) {
      beantworteFragenAnzahl += 1;
      fragenListe.appendChild(baueBeantworteteFrageElement(frage, bisherigeAntwort));
    } else {
      fragenListe.appendChild(baueFrageElement(frage));
    }
  }

  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
}

// Vorlese-Option (Text-to-Speech, 10.07.2026, Backlog-Idee "klein, schnell
// machbar"): nutzt die im Browser eingebaute Web Speech API, kein eigener
// Server/Dienst nötig. "unterstuetztVorlesen" wird einmal beim Laden geprüft
// - auf Browsern ohne Unterstützung erscheint der Button gar nicht erst,
// statt beim Klick wirkungslos zu bleiben.
const unterstuetztVorlesen = "speechSynthesis" in window;

function vorlesen(text) {
  if (!unterstuetztVorlesen) return;
  window.speechSynthesis.cancel(); // falls schon eine andere Frage vorgelesen wird
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  window.speechSynthesis.speak(utterance);
}

function baueVorlesenButton(text) {
  if (!unterstuetztVorlesen) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vorlesen-button";
  button.setAttribute("aria-label", "Frage vorlesen");
  button.title = "Frage vorlesen";
  button.textContent = "🔊";
  button.addEventListener("click", (e) => {
    e.preventDefault();
    vorlesen(text);
  });
  return button;
}

function schwierigkeitSterne(schwierigkeit) {
  if (!schwierigkeit) return null;
  const voll = "★".repeat(schwierigkeit);
  const leer = "☆".repeat(5 - schwierigkeit);
  return voll + leer;
}

function baueBadges(frage) {
  const wrap = document.createElement("div");
  wrap.className = "frage-badges";

  if (frage.regel_nummer && frage.regel_bezeichnung) {
    const regelBadge = document.createElement("span");
    regelBadge.className = "badge";
    regelBadge.textContent = "Regel " + frage.regel_nummer + " · " + frage.regel_bezeichnung;
    wrap.appendChild(regelBadge);
  }

  const sterne = schwierigkeitSterne(frage.schwierigkeit);
  if (sterne) {
    const schwierigkeitBadge = document.createElement("span");
    schwierigkeitBadge.className = "badge schwierigkeit";
    schwierigkeitBadge.textContent = sterne;
    wrap.appendChild(schwierigkeitBadge);
  }

  return wrap.childElementCount > 0 ? wrap : null;
}

function baueFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage-karte";
  container.dataset.frageId = frage.id;

  const badges = baueBadges(frage);
  if (badges) container.appendChild(badges);

  const titel = document.createElement("div");
  titel.className = "frage-text";
  titel.textContent = frage.frage_text;

  const titelZeile = document.createElement("div");
  titelZeile.className = "frage-text-zeile";
  titelZeile.appendChild(titel);
  const vorlesenButton = baueVorlesenButton(frage.frage_text);
  if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
  container.appendChild(titelZeile);

  const optionListe = document.createElement("div");
  optionListe.className = "option-liste";

  const optionen = [
    { key: "a", text: frage.option_a },
    { key: "b", text: frage.option_b },
    { key: "c", text: frage.option_c },
  ];

  for (const opt of optionen) {
    const label = document.createElement("label");
    label.className = "option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "frage-" + frage.id;
    radio.value = opt.key;
    radio.addEventListener("change", () => {
      optionListe.querySelectorAll(".option").forEach((el) => el.classList.remove("ausgewaehlt"));
      label.classList.add("ausgewaehlt");
    });

    label.appendChild(radio);
    label.append(opt.text);
    optionListe.appendChild(label);
  }

  container.appendChild(optionListe);

  const absendenButton = document.createElement("button");
  absendenButton.className = "absenden-button";
  absendenButton.textContent = "Antwort abschicken";
  absendenButton.addEventListener("click", () => antwortAbschicken(frage.id, container, absendenButton));
  container.appendChild(absendenButton);

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

function baueBeantworteteFrageElement(frage, antwort) {
  const container = document.createElement("div");
  container.className = "frage-karte beantwortet " + (antwort.korrekt ? "richtig-karte" : "falsch-karte");
  container.dataset.frageId = frage.id;

  const badges = baueBadges(frage);
  if (badges) container.appendChild(badges);

  const tag = document.createElement("div");
  tag.className = "beantwortet-tag";
  tag.textContent = "🔒 Bereits beantwortet";
  container.appendChild(tag);

  const titel = document.createElement("div");
  titel.className = "frage-text";
  titel.textContent = frage.frage_text;

  const titelZeile = document.createElement("div");
  titelZeile.className = "frage-text-zeile";
  titelZeile.appendChild(titel);
  const vorlesenButton = baueVorlesenButton(frage.frage_text);
  if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
  container.appendChild(titelZeile);

  const optionTexte = { a: frage.option_a, b: frage.option_b, c: frage.option_c };

  const ergebnis = document.createElement("p");
  ergebnis.className = "beantwortet-ergebnis " + (antwort.korrekt ? "richtig" : "falsch");

  if (antwort.korrekt) {
    ergebnis.textContent = "Richtig beantwortet: " + optionTexte[antwort.gegebene_option];
  } else {
    const richtigerText = optionTexte[antwort.richtige_option];
    ergebnis.textContent =
      "Damals geantwortet: " + optionTexte[antwort.gegebene_option] +
      " · Richtig gewesen wäre: " + richtigerText;
  }

  container.appendChild(ergebnis);

  return container;
}

async function antwortAbschicken(frageId, container, button) {
  const gewaehlt = container.querySelector('input[type="radio"]:checked');
  if (!gewaehlt) {
    zeigeFehler("Bitte erst eine Antwort auswählen.");
    return;
  }
  versteckeFehler();

  button.disabled = true;
  container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

  const { data, error } = await sb.rpc("antwort_abgeben", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_frage_id: frageId,
    p_gegebene_option: gewaehlt.value,
    p_pin: eingegebenePin,
  });

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;

  if (error) {
    feedback.textContent = "Fehler beim Speichern: " + error.message;
    feedback.classList.add("falsch");
    button.disabled = false;
    container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = false));
    return;
  }

  const ergebnis = data[0];

  if (ergebnis.bereits_beantwortet) {
    feedback.textContent =
      "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt: " +
      (ergebnis.korrekt ? "Richtig ✅" : "Falsch (richtig wäre " + ergebnis.richtige_option.toUpperCase() + " gewesen)");
    feedback.classList.add(ergebnis.korrekt ? "richtig" : "falsch");
  } else if (ergebnis.korrekt) {
    feedback.textContent = "Richtig! ✅";
    feedback.classList.add("richtig");
  } else {
    feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
    feedback.classList.add("falsch");
  }

  beantworteFragenAnzahl += 1;
  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
}

// Sammel-Button: schickt alle offenen Fragen ab, bei denen schon eine Antwort
// ausgewählt (aber noch nicht abgeschickt) wurde - vor allem am Desktop praktisch,
// wo man mehrere Fragen bequem nacheinander anklicken kann, statt jede einzeln
// abzuschicken. Die einzelnen "Antwort abschicken"-Buttons bleiben trotzdem nutzbar.
sammelAbsendenButton.addEventListener("click", async () => {
  const offeneMitAuswahl = Array.from(fragenListe.querySelectorAll(".frage-karte:not(.beantwortet)")).filter(
    (karte) => {
      const button = karte.querySelector(".absenden-button");
      return karte.querySelector('input[type="radio"]:checked') && button && !button.disabled;
    }
  );

  if (offeneMitAuswahl.length === 0) {
    zeigeFehler("Bitte wähle zuerst bei mindestens einer offenen Frage eine Antwort aus.");
    return;
  }

  versteckeFehler();
  sammelAbsendenButton.disabled = true;

  for (const karte of offeneMitAuswahl) {
    const frageId = karte.dataset.frageId;
    const button = karte.querySelector(".absenden-button");
    await antwortAbschicken(frageId, karte, button);
  }

  sammelAbsendenButton.disabled = false;
  aktualisiereSammelButtonSichtbarkeit();
});

function aktualisiereSammelButtonSichtbarkeit() {
  // "Offen" heißt hier: weder als bereits-beantwortet-Karte gerendert (beim Laden
  // erkannt) NOCH schon in dieser Sitzung abgeschickt (Button dann disabled) -
  // eine Karte, die man gerade eben abgeschickt hat, zählt also nicht mehr mit.
  const offeneAnzahl = Array.from(fragenListe.querySelectorAll(".frage-karte:not(.beantwortet)")).filter((karte) => {
    const button = karte.querySelector(".absenden-button");
    return button && !button.disabled;
  }).length;
  sammelAbsendenWrap.hidden = offeneAnzahl < 2;
}

function aktualisiereFortschritt() {
  const prozent = gesamtFragenAnzahl > 0
    ? Math.round((beantworteFragenAnzahl / gesamtFragenAnzahl) * 100)
    : 0;
  fortschrittText.textContent = beantworteFragenAnzahl + " von " + gesamtFragenAnzahl + " beantwortet";
  fortschrittProzent.textContent = prozent + "%";
  fortschrittFill.style.width = prozent + "%";
}

function spawnKonfetti() {
  const symbole = ["🎉", "⚽", "🏆", "✅", "🎊"];
  for (let i = 0; i < 24; i++) {
    const teil = document.createElement("span");
    teil.className = "konfetti-teil";
    teil.textContent = symbole[Math.floor(Math.random() * symbole.length)];
    teil.style.left = Math.random() * 100 + "vw";
    teil.style.animationDelay = Math.random() * 0.6 + "s";
    teil.style.fontSize = 1 + Math.random() * 0.8 + "rem";
    konfettiSchicht.appendChild(teil);
    setTimeout(() => teil.remove(), 3400);
  }
}

// Zeigt einen Live-Countdown bis zum Start der nächsten Fragen-Runde (aus der
// echten DB, keine feste Annahme wie "immer Montag"). Wird nur einmal gestartet,
// egal ob man schon fertig war beim Laden oder gerade eben fertig geworden ist.
async function zeigeNaechsteRundeCountdown() {
  if (countdownInterval) return;

  const { data, error } = await sb.rpc("naechste_runde_start");
  if (error || !data || data.length === 0) return;

  const zielZeit = new Date(data[0].startet_am).getTime();
  if (Number.isNaN(zielZeit)) return;

  function formatUndAktualisieren() {
    const restMs = zielZeit - Date.now();
    if (restMs <= 0) {
      naechsteRundeText.textContent = "Die nächste Runde müsste schon da sein - lade die Seite neu.";
      clearInterval(countdownInterval);
      return;
    }
    const tage = Math.floor(restMs / 86400000);
    const stunden = Math.floor((restMs % 86400000) / 3600000);
    const minuten = Math.floor((restMs % 3600000) / 60000);

    let dauer = "";
    if (tage > 0) dauer += tage + (tage === 1 ? " Tag, " : " Tagen, ");
    dauer += stunden + " Std. " + minuten + " Min.";

    naechsteRundeText.replaceChildren("Nächste Fragen in ", Object.assign(document.createElement("strong"), { textContent: dauer }));
  }

  naechsteRundeText.hidden = false;
  formatUndAktualisieren();
  countdownInterval = setInterval(formatUndAktualisieren, 30000);
}

async function start() {
  await ladeSchiedsrichter();

  const gespeichert = leseGespeicherteSession();
  if (gespeichert && gespeichert.id && gespeichert.pin) {
    ausgewaehlteSchiedsrichterId = gespeichert.id;
    eingegebenePin = gespeichert.pin;
    zeigeAngemeldetenZustand(gespeichert.name || "");
    await ladeFragenUndAntworten();
  }
}

start();
