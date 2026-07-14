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

// Vereinskennung / Gast-Zugang (13.07.2026, Baustein A/B/C/D) - siehe
// eigener Block weiter unten für die Ablauf-Logik.
const kennungBereich = document.getElementById("kennung-bereich");
const kennungEingabe = document.getElementById("kennung-eingabe");
const kennungAugeButton = document.getElementById("kennung-auge-button");
const kennungWeiterButton = document.getElementById("kennung-weiter-button");
const kennungHinweis = document.getElementById("kennung-hinweis");
const gastWechselButton = document.getElementById("gast-wechsel-button");
const mitgliedBereich = document.getElementById("mitglied-bereich");
const gastBereich = document.getElementById("gast-bereich");
const gastNameEingabe = document.getElementById("gast-name-eingabe");
const gastZurueckButton = document.getElementById("gast-zurueck-button");
const gastQuizSchritt = document.getElementById("gast-quiz-schritt");
const gastNameAnzeige = document.getElementById("gast-name-anzeige");
const gastFortschrittAnzeige = document.getElementById("gast-fortschritt-anzeige");
const gastFrageBereich = document.getElementById("gast-frage-bereich");
const gastVerlassenButton = document.getElementById("gast-verlassen-button");
const interesseOverlay = document.getElementById("interesse-overlay");
const interesseJaButton = document.getElementById("interesse-ja-button");
const interesseNeinButton = document.getElementById("interesse-nein-button");
const interesseNeinOverlay = document.getElementById("interesse-nein-overlay");
const interesseNeinSchliessenButton = document.getElementById("interesse-nein-schliessen-button");
const interessentenFormularOverlay = document.getElementById("interessenten-formular-overlay");
const interessentenFormularInhalt = document.getElementById("interessenten-formular-inhalt");
const interessentenFormularErfolg = document.getElementById("interessenten-formular-erfolg");
const interessentEmailEingabe = document.getElementById("interessent-email-eingabe");
const interessentAbsendenButton = document.getElementById("interessent-absenden-button");
const interessentenFormularSchliessenButton = document.getElementById("interessenten-formular-schliessen-button");

// Profil-Panel & Anfragen-System (12.07.2026, Baustein 5a) - Nav-Konzept B
// aus der Brainstorm-Skizze: der Angemeldet-Badge wird zum Menü-Auslöser.
const angemeldetBadgeButton = document.getElementById("angemeldet-badge-button");
const profilPanel = document.getElementById("profil-panel");
const profilStatusPunkt = document.getElementById("profil-status-punkt");
const panelAnfrageStellenButton = document.getElementById("panel-anfrage-stellen-button");
const panelMeineAnfragenButton = document.getElementById("panel-meine-anfragen-button");
const panelAnfragenStatusPunkt = document.getElementById("panel-anfragen-status-punkt");

const anfrageFormularOverlay = document.getElementById("anfrage-formular-overlay");
const anfrageFormularSchliessenButton = document.getElementById("anfrage-formular-schliessen-button");
const anfrageFormularInhalt = document.getElementById("anfrage-formular-inhalt");
const anfrageFormularErfolg = document.getElementById("anfrage-formular-erfolg");
const anfrageFormularErfolgSchliessenButton = document.getElementById("anfrage-formular-erfolg-schliessen-button");
const anfrageKategorieAuswahl = document.getElementById("anfrage-kategorie-auswahl");
const anfrageFarbeEingabe = document.getElementById("anfrage-farbe-eingabe");
const anfrageGroesseEingabe = document.getElementById("anfrage-groesse-eingabe");
const anfrageAermellaengeBereich = document.getElementById("anfrage-aermellaenge-bereich");
const anfrageAermellaengeAuswahl = document.getElementById("anfrage-aermellaenge-auswahl");
const anfrageAnmerkungEingabe = document.getElementById("anfrage-anmerkung-eingabe");
const anfrageFormularHinweis = document.getElementById("anfrage-formular-hinweis");
const anfrageAbsendenButton = document.getElementById("anfrage-absenden-button");

const meineAnfragenOverlay = document.getElementById("meine-anfragen-overlay");
const meineAnfragenSchliessenButton = document.getElementById("meine-anfragen-schliessen-button");
const meineAnfragenListe = document.getElementById("meine-anfragen-liste");
const meineAnfragenLeerHinweis = document.getElementById("meine-anfragen-leer-hinweis");

// Anliegen-Formular & Rechnungs-Upload (12.07.2026, Baustein 5c: Baustein D
// + Baustein E). "Anliegen" ist Max' eigene Wortwahl statt "Sorgenkasten".
const panelAnliegenMeldenButton = document.getElementById("panel-anliegen-melden-button");
const anliegenFormularOverlay = document.getElementById("anliegen-formular-overlay");
const anliegenFormularSchliessenButton = document.getElementById("anliegen-formular-schliessen-button");
const anliegenFormularInhalt = document.getElementById("anliegen-formular-inhalt");
const anliegenFormularErfolg = document.getElementById("anliegen-formular-erfolg");
const anliegenFormularErfolgSchliessenButton = document.getElementById("anliegen-formular-erfolg-schliessen-button");
const anliegenTextEingabe = document.getElementById("anliegen-text-eingabe");
const anliegenFormularHinweis = document.getElementById("anliegen-formular-hinweis");
const anliegenAbsendenButton = document.getElementById("anliegen-absenden-button");

const rechnungUploadOverlay = document.getElementById("rechnung-upload-overlay");
const rechnungUploadSchliessenButton = document.getElementById("rechnung-upload-schliessen-button");
const rechnungUploadInhalt = document.getElementById("rechnung-upload-inhalt");
const rechnungUploadErfolg = document.getElementById("rechnung-upload-erfolg");
const rechnungUploadErfolgSchliessenButton = document.getElementById("rechnung-upload-erfolg-schliessen-button");
const rechnungDateiEingabe = document.getElementById("rechnung-datei-eingabe");
const rechnungVorschauBild = document.getElementById("rechnung-vorschau-bild");
const rechnungUploadHinweis = document.getElementById("rechnung-upload-hinweis");
const rechnungHochladenButton = document.getElementById("rechnung-hochladen-button");

// Historie ("Wiederholung alter Fragen", 11.07.2026) - eigener Bereich,
// erreichbar über einen Button in der bestehenden "Fertig"-Meldung
// (bewusst KEIN automatischer Redirect, Max' ausdrücklicher Wunsch).
const historieStartButton = document.getElementById("historie-start-button");
const historieSchritt = document.getElementById("historie-schritt");
const historieZurueckButton = document.getElementById("historie-zurueck-button");
const historieNeuLadenButton = document.getElementById("historie-neu-laden-button");
const historieNeuLadenIcon = historieNeuLadenButton ? historieNeuLadenButton.querySelector(".historie-neu-laden-icon") : null;
const historieFrageBereich = document.getElementById("historie-frage-bereich");
const historieLeerHinweis = document.getElementById("historie-leer-hinweis");

// Scoreboard (11.07.2026, drittes Feedback: ersetzt den reinen
// Fließtext-Fortschritt - siehe style.css für die Optik/Flip-Animation).
const historieScoreboard = document.getElementById("historie-scoreboard");
const historieScoreboardGesamt = document.getElementById("historie-scoreboard-gesamt");
const historieScoreboardRichtig = document.getElementById("historie-scoreboard-richtig");
const historieScoreboardGesamtHinweis = document.getElementById("historie-scoreboard-gesamt-hinweis");

// Kopf/Untertitel (11.07.2026, Update nach Max' Feedback): werden im
// "Üben"-Modus umgestaltet (andere Kopf-Farbe, anderer Untertitel-Text, die
// wöchentliche Fortschrittsleiste ausgeblendet), damit klar erkennbar ist,
// dass man sich nicht mehr im normalen Wochen-Quiz befindet. Der
// Original-Untertitel wird einmal beim Laden gemerkt, um beim Verlassen des
// Üben-Modus wieder exakt den ursprünglichen Text herzustellen.
const kopf = document.getElementById("kopf");
const kopfUntertitel = document.getElementById("kopf-untertitel");
const kopfUntertitelOriginal = kopfUntertitel ? kopfUntertitel.textContent : "";
const UEBEN_UNTERTITEL = "Übe hier so viele alte Fragen, wie du möchtest - ganz ohne Zeitdruck.";

let ausgewaehlteSchiedsrichterId = null;
let eingegebenePin = null;
let gesamtFragenAnzahl = 0;
let beantworteFragenAnzahl = 0;
let countdownInterval = null;
let historieAktuelleFrageId = null;

// Vereinskennung / Gast-Zugang (13.07.2026): "loginModus" steuert, welcher
// der drei Bereiche in der Login-Karte gerade aktiv ist, und wie der
// gemeinsame "Los geht's"-Button (startButton) reagiert.
const KENNUNG_SESSION_KEY = "schiriQuizVereinskennung";
// Nach wie vielen beantworteten Gast-Fragen das Interesse-Popup erscheint
// (Baustein C, Max' Vorschlag "z.B. drei") - hier zentral anpassbar.
const GAST_INTERESSE_TRIGGER_ANZAHL = 3;
let loginModus = "kennung"; // "kennung" | "mitglied" | "gast"
let gastName = null;
let gastFragenPool = [];
let gastFrageIndex = 0;
let gastBeantwortetAnzahl = 0;
let gastRichtigAnzahl = 0;
let gastInteressePopupGezeigt = false;

// Historie-Fortschritt (11.07.2026, Update nach Max' Feedback): wird nicht
// mehr nach jeder Antwort neu vom Server abgefragt (das ließ die Anzeige bei
// Test-Konten wie "Dummy" für immer bei "0" stehen, weil deren Antworten
// bewusst nicht in der DB landen, siehe Migration v43). Stattdessen wird der
// Server-Stand einmal beim Betreten des Üben-Modus als Basis geladen, und
// jede Antwort in dieser Sitzung wird direkt lokal draufgerechnet - so
// stimmt die Anzeige immer sofort, unabhängig vom Test-Konto-Sonderfall.
let historieBasisGesamt = 0;
let historieBasisRichtig = 0;
let historieSessionGesamt = 0;
let historieSessionRichtig = 0;
let historieAutoTimer = null;
// Merkt sich den zuletzt gerenderten Scoreboard-Stand, damit eine Flip-
// Animation nur bei einer TATSÄCHLICHEN Änderung abgespielt wird (siehe
// animiereScoreboardZiffer weiter unten).
let historieScoreboardLetzterGesamt = null;
let historieScoreboardLetzterRichtig = null;

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

// Vereinskennung-Session (13.07.2026, Baustein A) - gleiches Muster wie
// die Schiedsrichter-Session oben, eigener Key, damit ein "Abmelden" (das
// nur die Schiedsrichter-Session löscht) die bestätigte Kennung nicht
// mit wegwirft.
function speichereKennungSession(kennung) {
  try {
    sessionStorage.setItem(KENNUNG_SESSION_KEY, kennung);
  } catch (e) {
    // Falls sessionStorage nicht verfügbar ist, bleibt man einfach ohne
    // Merken angemeldet (wie beim bestehenden Schiedsrichter-Login oben).
  }
}

function leseGespeicherteKennung() {
  try {
    return sessionStorage.getItem(KENNUNG_SESSION_KEY);
  } catch (e) {
    return null;
  }
}

function loescheGespeicherteKennungSession() {
  try {
    sessionStorage.removeItem(KENNUNG_SESSION_KEY);
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
  // Baustein 5a: prüft im Hintergrund, ob es Neuigkeiten zu bestehenden
  // Anfragen gibt (Status-Punkt am Profil-Badge) - bewusst "fire and
  // forget", damit das Login nicht auf diesen Zusatz-Request warten muss.
  aktualisiereAnfragenStatusPunkt();
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
  // Update (13.07.2026, Baustein A/B): der gemeinsame "Los geht's"-Button
  // gilt je nach "loginModus" für unterschiedliche Felder - im
  // "kennung"-Zustand ist er ohnehin unsichtbar (siehe zeigeMitgliedBereich/
  // zeigeGastBereich), daher hier einfach dauerhaft deaktiviert lassen.
  if (loginModus === "gast") {
    startButton.disabled = !(gastNameEingabe.value.trim().length > 0);
  } else if (loginModus === "mitglied") {
    startButton.disabled = !(nameAuswahl.value && pinEingabe.value.trim().length > 0);
  } else {
    startButton.disabled = true;
  }
}

nameAuswahl.addEventListener("change", pruefeEingabenVollstaendig);
pinEingabe.addEventListener("input", pruefeEingabenVollstaendig);
gastNameEingabe.addEventListener("input", pruefeEingabenVollstaendig);

// ============================================================
// Vereinskennung / Gast-Zugang (13.07.2026, Baustein A/B) - siehe
// Kopf-Kommentar in index.html für den genauen Ablauf: die Vereinskennung
// bleibt sichtbar stehen, darunter poppt entweder der Mitglieder- oder der
// Gast-Bereich auf, "Los geht's" ganz unten gilt für beide Wege.
// ============================================================

function zeigeMitgliedBereich() {
  loginModus = "mitglied";
  kennungEingabe.disabled = true;
  kennungWeiterButton.hidden = true;
  gastWechselButton.hidden = true;
  gastBereich.hidden = true;
  mitgliedBereich.hidden = false;
  startButton.hidden = false;
  pruefeEingabenVollstaendig();
}

function zeigeGastBereich() {
  loginModus = "gast";
  kennungBereich.hidden = true;
  mitgliedBereich.hidden = true;
  gastBereich.hidden = false;
  startButton.hidden = false;
  pruefeEingabenVollstaendig();
  gastNameEingabe.focus();
}

function zeigeKennungBereich() {
  loginModus = "kennung";
  kennungBereich.hidden = false;
  kennungEingabe.disabled = false;
  kennungEingabe.type = "password";
  kennungWeiterButton.hidden = false;
  gastWechselButton.hidden = false;
  mitgliedBereich.hidden = true;
  gastBereich.hidden = true;
  startButton.hidden = true;
  pruefeEingabenVollstaendig();
}

async function pruefeVereinskennung(kennungWert, options) {
  const ausSession = !!(options && options.ausSession);
  const kennung = kennungWert.trim();
  if (!kennung) return;

  // Feld wieder verdecken, falls gerade per Augen-Button aufgedeckt (13.07.2026).
  kennungEingabe.type = "password";

  kennungHinweis.hidden = true;
  kennungHinweis.classList.remove("hinweis-fehler", "hinweis-erfolg");
  kennungWeiterButton.disabled = true;

  const { data: istOk, error } = await sb.rpc("vereinskennung_pruefen", { p_kennung: kennung });

  kennungWeiterButton.disabled = false;

  if (error) {
    kennungHinweis.textContent = "Kennung konnte nicht geprüft werden: " + error.message;
    kennungHinweis.classList.add("hinweis-fehler");
    kennungHinweis.hidden = false;
    return;
  }

  if (!istOk) {
    if (ausSession) {
      // Eine gespeicherte Kennung, die jetzt nicht mehr gültig ist (z.B.
      // zwischenzeitlich geändert) - Session verwerfen, normal von vorn
      // starten, kein Fehler-Hinweis nötig (Person hat ja nichts falsch
      // gemacht).
      loescheGespeicherteKennungSession();
      return;
    }
    kennungHinweis.textContent = "Diese Vereinskennung ist uns nicht bekannt.";
    kennungHinweis.classList.add("hinweis-fehler");
    kennungHinweis.hidden = false;
    kennungEingabe.value = "";
    kennungEingabe.focus();
    return;
  }

  speichereKennungSession(kennung);
  kennungHinweis.textContent = "✓ Vereinskennung bestätigt";
  kennungHinweis.classList.add("hinweis-erfolg");
  kennungHinweis.hidden = false;
  zeigeMitgliedBereich();
}

kennungWeiterButton.addEventListener("click", () => pruefeVereinskennung(kennungEingabe.value));
kennungEingabe.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    pruefeVereinskennung(kennungEingabe.value);
  }
});

// Augen-Button (13.07.2026, Max' Feedback): Vereinskennung ist "irgendwo
// trotzdem ein Passwort" - Eingabefeld deshalb standardmäßig verdeckt
// (siehe type="password" in index.html), per Klick auf das Auge kurz
// aufdeckbar. Sobald danach weitergetippt wird, verdeckt sich das Feld
// automatisch wieder ("aufgedeckt" ist bewusst nur ein kurzer Blick, kein
// dauerhafter Zustand).
if (kennungAugeButton) {
  kennungAugeButton.addEventListener("click", () => {
    kennungEingabe.type = kennungEingabe.type === "password" ? "text" : "password";
  });
  kennungEingabe.addEventListener("input", () => {
    if (kennungEingabe.type === "text") {
      kennungEingabe.type = "password";
    }
  });
}

gastWechselButton.addEventListener("click", () => {
  versteckeFehler();
  zeigeGastBereich();
});

gastZurueckButton.addEventListener("click", () => {
  versteckeFehler();
  zeigeKennungBereich();
});

startButton.addEventListener("click", async () => {
  if (loginModus === "gast") {
    await starteGastModus();
    return;
  }

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

// ============================================================
// Gast-Quiz (13.07.2026, Baustein B/C/D) - eigener, schlanker Ablauf statt
// Wiederverwendung von "ladeFragenUndAntworten": Gast-Fragen sind bewusst
// nur Multiple-Choice ohne Video/Freitext/KI, und nichts wird serverseitig
// gespeichert (Fortschritt lebt nur in den Variablen oben, siehe
// "AskUserQuestion"-Entscheidung im Backlog: "nur im Browser merken"). Baut
// bewusst auf demselben Options-/Feedback-Markup wie die echten Fragen auf
// (".option-liste"/".option"/".absenden-button"/".feedback"), damit sich der
// Gast-Modus optisch nicht wie ein Fremdkörper anfühlt.
// ============================================================

async function starteGastModus() {
  versteckeFehler();
  const name = gastNameEingabe.value.trim();
  if (!name) return;

  gastName = name;
  gastBeantwortetAnzahl = 0;
  gastRichtigAnzahl = 0;
  gastFrageIndex = 0;
  gastInteressePopupGezeigt = false;

  nameSchritt.hidden = true;
  gastQuizSchritt.hidden = false;
  gastNameAnzeige.textContent = gastName;
  aktualisiereGastFortschrittAnzeige();

  await ladeGastFragen();
}

async function ladeGastFragen() {
  const { data, error } = await sb.rpc("gast_fragen_liste");

  if (error) {
    zeigeFehler("Fragen konnten nicht geladen werden: " + error.message);
    return;
  }

  gastFragenPool = data || [];
  gastFrageIndex = 0;
  zeigeNaechsteGastFrage();
}

function zeigeNaechsteGastFrage() {
  gastFrageBereich.innerHTML = "";

  if (gastFrageIndex >= gastFragenPool.length) {
    const hinweis = document.createElement("p");
    hinweis.className = "hinweis card";
    hinweis.textContent = "Das waren erstmal alle Fragen – danke fürs Ausprobieren! 🎉";
    gastFrageBereich.appendChild(hinweis);
    return;
  }

  gastFrageBereich.appendChild(baueGastFrageElement(gastFragenPool[gastFrageIndex]));
}

function baueGastFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage-karte";
  container.dataset.frageId = frage.frage_id;

  const titel = document.createElement("div");
  titel.className = "frage-text";
  titel.textContent = frage.frage_text;
  const titelZeile = document.createElement("div");
  titelZeile.className = "frage-text-zeile";
  titelZeile.appendChild(titel);
  container.appendChild(titelZeile);

  const optionListe = document.createElement("div");
  optionListe.className = "option-liste";

  const optionen = [
    { key: "a", text: frage.option_a },
    { key: "b", text: frage.option_b },
    { key: "c", text: frage.option_c },
  ];

  for (const opt of optionen) {
    if (!opt.text) continue;
    const label = document.createElement("label");
    label.className = "option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "gast-frage-" + frage.frage_id;
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
  absendenButton.addEventListener("click", () => gastAntwortAbschicken(frage.frage_id, container, absendenButton));
  container.appendChild(absendenButton);

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

async function gastAntwortAbschicken(frageId, container, button) {
  const gewaehlt = container.querySelector('input[type="radio"]:checked');
  if (!gewaehlt) {
    zeigeFehler("Bitte erst eine Antwort auswählen.");
    return;
  }
  versteckeFehler();

  button.disabled = true;
  container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

  const { data, error } = await sb.rpc("gast_antwort_pruefen", {
    p_frage_id: frageId,
    p_option: gewaehlt.value,
  });

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;

  if (error || !data || !data[0]) {
    feedback.textContent = "Antwort konnte nicht geprüft werden" + (error ? ": " + error.message : ".");
    feedback.classList.add("falsch");
    button.disabled = false;
    container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = false));
    return;
  }

  const ergebnis = data[0];
  gastBeantwortetAnzahl += 1;
  if (ergebnis.korrekt) {
    gastRichtigAnzahl += 1;
    feedback.textContent = "Richtig! ✅";
    feedback.classList.add("richtig");
  } else {
    feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
    feedback.classList.add("falsch");
  }

  aktualisiereGastFortschrittAnzeige();

  const weiterButton = document.createElement("button");
  weiterButton.className = "historie-weiter-button";
  weiterButton.type = "button";
  weiterButton.textContent = "Nächste Frage →";
  weiterButton.addEventListener("click", () => {
    gastFrageIndex += 1;
    zeigeNaechsteGastFrage();
  });
  container.appendChild(weiterButton);

  // Baustein C: Interesse-Popup nach GAST_INTERESSE_TRIGGER_ANZAHL
  // beantworteten Fragen, nur einmal pro Sitzung.
  if (gastBeantwortetAnzahl === GAST_INTERESSE_TRIGGER_ANZAHL && !gastInteressePopupGezeigt) {
    gastInteressePopupGezeigt = true;
    interesseOverlay.hidden = false;
  }
}

function aktualisiereGastFortschrittAnzeige() {
  gastFortschrittAnzeige.textContent = gastRichtigAnzahl + " von " + gastBeantwortetAnzahl + " richtig";
}

// Ausstiegsweg aus dem Gast-Modus zurück zur Login-Karte (siehe Kommentar
// am Button in index.html) - setzt den kompletten Gast-Zustand zurück und
// zeigt wieder den Bereich, der zur gerade aktiven Vereinskennung passt.
gastVerlassenButton.addEventListener("click", () => {
  gastQuizSchritt.hidden = true;
  gastFrageBereich.innerHTML = "";
  gastName = null;
  gastFragenPool = [];
  gastFrageIndex = 0;
  gastBeantwortetAnzahl = 0;
  gastRichtigAnzahl = 0;
  gastInteressePopupGezeigt = false;
  gastNameEingabe.value = "";

  nameSchritt.hidden = false;
  if (leseGespeicherteKennung()) {
    zeigeMitgliedBereich();
  } else {
    zeigeKennungBereich();
  }
});

// ---------- Interesse-Popup + Interessenten-Formular (Baustein C/D/E) ----------

function schliesseInteressePopup() {
  interesseOverlay.hidden = true;
}

// "Schade"-Popup (13.07.2026, Max' Feedback): auch wer "Nein danke" klickt,
// soll noch die Möglichkeit bekommen, sich über den SVFD-Link zu
// informieren - vorher gab es dafür gar keinen erreichbaren Ort mehr.
function schliesseInteresseNeinOverlay() {
  interesseNeinOverlay.hidden = true;
}

interesseNeinButton.addEventListener("click", () => {
  schliesseInteressePopup();
  interesseNeinOverlay.hidden = false;
});
interesseOverlay.addEventListener("click", (event) => {
  if (event.target === interesseOverlay) schliesseInteressePopup();
});

interesseNeinSchliessenButton.addEventListener("click", schliesseInteresseNeinOverlay);
interesseNeinOverlay.addEventListener("click", (event) => {
  if (event.target === interesseNeinOverlay) schliesseInteresseNeinOverlay();
});

interesseJaButton.addEventListener("click", () => {
  schliesseInteressePopup();
  interessentenFormularInhalt.hidden = false;
  interessentenFormularErfolg.hidden = true;
  interessentEmailEingabe.value = "";
  interessentenFormularOverlay.hidden = false;
});

function schliesseInteressentenFormular() {
  interessentenFormularOverlay.hidden = true;
}

interessentenFormularSchliessenButton.addEventListener("click", schliesseInteressentenFormular);
interessentenFormularOverlay.addEventListener("click", (event) => {
  if (event.target === interessentenFormularOverlay) schliesseInteressentenFormular();
});

interessentAbsendenButton.addEventListener("click", async () => {
  interessentAbsendenButton.disabled = true;
  const email = interessentEmailEingabe.value.trim();

  const { error } = await sb.rpc("gast_interesse_melden", {
    p_gast_name: gastName || "Gast",
    p_email: email || null,
  });

  interessentAbsendenButton.disabled = false;

  if (error) {
    zeigeFehler("Konnte leider nicht gespeichert werden: " + error.message);
    return;
  }

  interessentenFormularInhalt.hidden = true;
  interessentenFormularErfolg.hidden = false;
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (interesseOverlay && !interesseOverlay.hidden) schliesseInteressePopup();
  if (interesseNeinOverlay && !interesseNeinOverlay.hidden) schliesseInteresseNeinOverlay();
  if (interessentenFormularOverlay && !interessentenFormularOverlay.hidden) schliesseInteressentenFormular();
  if (profilPanel && !profilPanel.hidden) schliesseProfilPanel();
  if (anfrageFormularOverlay && !anfrageFormularOverlay.hidden) schliesseAnfrageFormular();
  if (meineAnfragenOverlay && !meineAnfragenOverlay.hidden) schliesseMeineAnfragen();
  if (anliegenFormularOverlay && !anliegenFormularOverlay.hidden) schliesseAnliegenFormular();
  if (rechnungUploadOverlay && !rechnungUploadOverlay.hidden) schliesseRechnungUpload();
});

// ---------- Profil-Panel & Anfragen-System (Baustein 5a) ----------
// Nur relevant für echte (angemeldete) Schiedsrichter - im Gast-Modus wird
// die Angemeldet-Leiste ohnehin nie eingeblendet.

function schliesseProfilPanel() {
  profilPanel.hidden = true;
  angemeldetBadgeButton.setAttribute("aria-expanded", "false");
}

angemeldetBadgeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const istOffen = !profilPanel.hidden;
  if (istOffen) {
    schliesseProfilPanel();
  } else {
    profilPanel.hidden = false;
    angemeldetBadgeButton.setAttribute("aria-expanded", "true");
  }
});

// Klick außerhalb des Panels schließt es wieder (übliches Dropdown-
// Verhalten) - auf dem "document", damit auch Klicks außerhalb der
// Leiste erfasst werden.
document.addEventListener("click", (event) => {
  if (profilPanel.hidden) return;
  if (event.target === angemeldetBadgeButton || angemeldetBadgeButton.contains(event.target)) return;
  if (event.target === profilPanel || profilPanel.contains(event.target)) return;
  schliesseProfilPanel();
});

function setzeAnfrageFormularZurueck() {
  anfrageKategorieAuswahl.value = "";
  anfrageFarbeEingabe.value = "";
  anfrageGroesseEingabe.value = "";
  anfrageAermellaengeAuswahl.value = "";
  anfrageAermellaengeBereich.hidden = true;
  anfrageAnmerkungEingabe.value = "";
  anfrageFormularHinweis.hidden = true;
  anfrageFormularInhalt.hidden = false;
  anfrageFormularErfolg.hidden = true;
}

// Ärmellänge ist nur bei Trikots eine sinnvolle Angabe.
anfrageKategorieAuswahl.addEventListener("change", () => {
  anfrageAermellaengeBereich.hidden = anfrageKategorieAuswahl.value !== "trikot";
});

panelAnfrageStellenButton.addEventListener("click", () => {
  schliesseProfilPanel();
  setzeAnfrageFormularZurueck();
  anfrageFormularOverlay.hidden = false;
});

function schliesseAnfrageFormular() {
  anfrageFormularOverlay.hidden = true;
}

anfrageFormularSchliessenButton.addEventListener("click", schliesseAnfrageFormular);
anfrageFormularErfolgSchliessenButton.addEventListener("click", schliesseAnfrageFormular);
anfrageFormularOverlay.addEventListener("click", (event) => {
  if (event.target === anfrageFormularOverlay) schliesseAnfrageFormular();
});

anfrageAbsendenButton.addEventListener("click", async () => {
  const kategorie = anfrageKategorieAuswahl.value;
  if (!kategorie) {
    anfrageFormularHinweis.textContent = "Bitte wähle aus, was du brauchst.";
    anfrageFormularHinweis.hidden = false;
    return;
  }

  anfrageFormularHinweis.hidden = true;
  anfrageAbsendenButton.disabled = true;

  const { error } = await sb.rpc("schiri_anfrage_erstellen", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
    p_kategorie: kategorie,
    p_farbe: anfrageFarbeEingabe.value.trim() || null,
    p_groesse: anfrageGroesseEingabe.value.trim() || null,
    p_aermellaenge: anfrageAermellaengeBereich.hidden ? null : anfrageAermellaengeAuswahl.value || null,
    p_anmerkung: anfrageAnmerkungEingabe.value.trim() || null,
  });

  anfrageAbsendenButton.disabled = false;

  if (error) {
    anfrageFormularHinweis.textContent = "Konnte leider nicht gespeichert werden: " + error.message;
    anfrageFormularHinweis.hidden = false;
    return;
  }

  anfrageFormularInhalt.hidden = true;
  anfrageFormularErfolg.hidden = false;
});

const ANFRAGE_KATEGORIE_LABEL = { trikot: "Trikot", hose: "Hose", stutzen: "Stutzen", schuhe: "Schuhe" };
const ANFRAGE_STATUS_LABEL = { offen: "Offen", angenommen: "Angenommen", abgelehnt: "Abgelehnt", erledigt: "Erledigt" };

function formatiereAnfrageDatum(iso) {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch (e) {
    return "";
  }
}

// Merkt sich, für welche Anfrage gerade eine Rechnung hochgeladen wird
// (gesetzt beim Öffnen von "#rechnung-upload-overlay" über eine Zeile in
// "Meine Anfragen") sowie das im Browser schon komprimierte Bild.
let rechnungUploadAnfrageId = null;
let rechnungUploadBase64 = null;
let rechnungUploadMime = null;

function baueAnfrageZeile(anfrage) {
  // Bugfix (Feedback nach Baustein 5c, 12.07.2026): "Meine Anfragen" zeigt
  // seit "ladeMeineAnfragen()" nur noch Ausrüstungs-Anträge (kein "Anliegen"
  // mehr) - der Typ-Badge war dadurch immer nur noch "Antrag" und damit
  // reine Redundanz, deshalb hier entfernt statt eines dauerhaft
  // gleichbleibenden Labels.
  const zeile = document.createElement("div");
  zeile.className = "anfrage-zeile";

  const kopf = document.createElement("div");
  kopf.className = "anfrage-zeile-kopf";

  const titel = document.createElement("span");
  titel.className = "anfrage-zeile-titel";
  titel.textContent = ANFRAGE_KATEGORIE_LABEL[anfrage.kategorie] || anfrage.kategorie;
  kopf.appendChild(titel);

  const statusBadge = document.createElement("span");
  statusBadge.className = "anfrage-status-badge " + anfrage.status;
  statusBadge.textContent = ANFRAGE_STATUS_LABEL[anfrage.status] || anfrage.status;
  kopf.appendChild(statusBadge);

  zeile.appendChild(kopf);

  const detailTeile = [];
  if (anfrage.farbe) detailTeile.push(anfrage.farbe);
  if (anfrage.groesse) detailTeile.push("Größe " + anfrage.groesse);
  if (anfrage.aermellaenge) detailTeile.push(anfrage.aermellaenge === "kurz" ? "Kurzarm" : "Langarm");
  detailTeile.push(formatiereAnfrageDatum(anfrage.erstellt_am));

  const detail = document.createElement("p");
  detail.className = "anfrage-zeile-detail";
  detail.textContent = detailTeile.join(" · ");
  zeile.appendChild(detail);

  if (anfrage.anmerkung) {
    const anmerkung = document.createElement("p");
    anmerkung.className = "anfrage-zeile-detail";
    anmerkung.textContent = "„" + anfrage.anmerkung + "“";
    zeile.appendChild(anmerkung);
  }

  // Baustein 5c (Baustein D, Weg 2): sobald der Obmann "Schiri besorgt es
  // selbst" gewählt hat, kann hier die Rechnung hochgeladen werden - genau
  // einmal, danach nur noch ein Status-Hinweis statt des Buttons.
  if (anfrage.typ !== "anliegen" && anfrage.status === "angenommen" && anfrage.beschaffungsweg === "weg2_schiri_besorgt") {
    if (anfrage.rechnung_hochgeladen_am) {
      const rechnungStatus = document.createElement("p");
      rechnungStatus.className = "anfrage-zeile-rechnung-status";
      rechnungStatus.textContent = anfrage.erstattet
        ? "✓ Rechnung hochgeladen, Geld überwiesen"
        : "✓ Rechnung hochgeladen am " + formatiereAnfrageDatum(anfrage.rechnung_hochgeladen_am);
      zeile.appendChild(rechnungStatus);
    } else {
      const rechnungButton = document.createElement("button");
      rechnungButton.type = "button";
      rechnungButton.className = "anfrage-zeile-rechnung-button";
      rechnungButton.textContent = "🧾 Rechnung hochladen";
      rechnungButton.addEventListener("click", () => oeffneRechnungUpload(anfrage.id));
      zeile.appendChild(rechnungButton);
    }
  }

  return zeile;
}

async function ladeMeineAnfragen() {
  meineAnfragenListe.innerHTML = "";
  meineAnfragenLeerHinweis.hidden = true;

  const { data, error } = await sb.rpc("schiri_anfragen_liste", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
  });

  if (error) {
    zeigeFehler("Anfragen konnten nicht geladen werden: " + error.message);
    return;
  }

  // Bugfix (Feedback nach Baustein 5c, 12.07.2026, Max: "wenn man da was
  // schreibt [ein Anliegen], dass das nicht mit in meine Anfragen
  // aufgelistet wird"): "Meine Anfragen" zeigt jetzt bewusst NUR
  // Ausrüstungs-Anträge - ein Anliegen ist eine einmalige Meldung an den
  // Obmann, kein Status, den der Schiri selbst weiterverfolgen soll (anders
  // als ein Ausrüstungs-Antrag mit Annahme/Beschaffungsweg/Rechnung).
  const antraege = (data || []).filter((anfrage) => anfrage.typ !== "anliegen");

  if (antraege.length === 0) {
    meineAnfragenLeerHinweis.hidden = false;
    return;
  }

  antraege.forEach((anfrage) => meineAnfragenListe.appendChild(baueAnfrageZeile(anfrage)));
}

function schliesseMeineAnfragen() {
  meineAnfragenOverlay.hidden = true;
}

meineAnfragenSchliessenButton.addEventListener("click", schliesseMeineAnfragen);
meineAnfragenOverlay.addEventListener("click", (event) => {
  if (event.target === meineAnfragenOverlay) schliesseMeineAnfragen();
});

panelMeineAnfragenButton.addEventListener("click", async () => {
  schliesseProfilPanel();
  meineAnfragenOverlay.hidden = false;
  await ladeMeineAnfragen();

  // Status-Punkt verschwindet, sobald die Liste einmal geöffnet wurde.
  profilStatusPunkt.hidden = true;
  panelAnfragenStatusPunkt.hidden = true;
  await sb.rpc("schiri_anfragen_als_gesehen_markieren", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
  });
});

// ---------- Anliegen-Formular (Baustein 5c, Baustein E) ----------

function setzeAnliegenFormularZurueck() {
  anliegenTextEingabe.value = "";
  anliegenFormularHinweis.hidden = true;
  anliegenFormularInhalt.hidden = false;
  anliegenFormularErfolg.hidden = true;
}

panelAnliegenMeldenButton.addEventListener("click", () => {
  schliesseProfilPanel();
  setzeAnliegenFormularZurueck();
  anliegenFormularOverlay.hidden = false;
});

function schliesseAnliegenFormular() {
  anliegenFormularOverlay.hidden = true;
}

anliegenFormularSchliessenButton.addEventListener("click", schliesseAnliegenFormular);
anliegenFormularErfolgSchliessenButton.addEventListener("click", schliesseAnliegenFormular);
anliegenFormularOverlay.addEventListener("click", (event) => {
  if (event.target === anliegenFormularOverlay) schliesseAnliegenFormular();
});

anliegenAbsendenButton.addEventListener("click", async () => {
  const text = anliegenTextEingabe.value.trim();
  if (!text) {
    anliegenFormularHinweis.textContent = "Schreib kurz, was los ist - dann kann ich mich darum kümmern.";
    anliegenFormularHinweis.hidden = false;
    return;
  }

  anliegenFormularHinweis.hidden = true;
  anliegenAbsendenButton.disabled = true;

  const { error } = await sb.rpc("schiri_anfrage_erstellen", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
    p_kategorie: null,
    p_anmerkung: text,
    p_typ: "anliegen",
  });

  anliegenAbsendenButton.disabled = false;

  if (error) {
    anliegenFormularHinweis.textContent = "Konnte leider nicht gespeichert werden: " + error.message;
    anliegenFormularHinweis.hidden = false;
    return;
  }

  anliegenFormularInhalt.hidden = true;
  anliegenFormularErfolg.hidden = false;
});

// ---------- Rechnungs-Upload (Baustein 5c, Baustein D Weg 2) ----------

/// Verkleinert ein Foto im Browser auf max. 1600px Kantenlänge und
/// re-kodiert es als JPEG (Qualität 0.8), bevor es als Base64 an die RPC
/// geht - normale Handyfotos sind sonst oft mehrere MB groß, das würde die
/// Anfrage unnötig aufblähen bzw. an Limits stoßen können.
function komprimiereBildAufBase64(datei) {
  return new Promise((resolve, reject) => {
    const bild = new Image();
    const objektUrl = URL.createObjectURL(datei);
    bild.onload = () => {
      const MAX_KANTE = 1600;
      let breite = bild.naturalWidth;
      let hoehe = bild.naturalHeight;
      if (breite > MAX_KANTE || hoehe > MAX_KANTE) {
        if (breite >= hoehe) {
          hoehe = Math.round((hoehe * MAX_KANTE) / breite);
          breite = MAX_KANTE;
        } else {
          breite = Math.round((breite * MAX_KANTE) / hoehe);
          hoehe = MAX_KANTE;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bild, 0, 0, breite, hoehe);
      URL.revokeObjectURL(objektUrl);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mime: "image/jpeg", vorschauUrl: dataUrl });
    };
    bild.onerror = () => {
      URL.revokeObjectURL(objektUrl);
      reject(new Error("Bild konnte nicht gelesen werden"));
    };
    bild.src = objektUrl;
  });
}

function setzeRechnungUploadZurueck() {
  rechnungDateiEingabe.value = "";
  rechnungVorschauBild.hidden = true;
  rechnungVorschauBild.src = "";
  rechnungUploadHinweis.hidden = true;
  rechnungHochladenButton.disabled = true;
  rechnungUploadInhalt.hidden = false;
  rechnungUploadErfolg.hidden = true;
  rechnungUploadBase64 = null;
  rechnungUploadMime = null;
}

function oeffneRechnungUpload(anfrageId) {
  rechnungUploadAnfrageId = anfrageId;
  setzeRechnungUploadZurueck();
  rechnungUploadOverlay.hidden = false;
}

function schliesseRechnungUpload() {
  rechnungUploadOverlay.hidden = true;
  rechnungUploadAnfrageId = null;
}

rechnungUploadSchliessenButton.addEventListener("click", schliesseRechnungUpload);
rechnungUploadOverlay.addEventListener("click", (event) => {
  if (event.target === rechnungUploadOverlay) schliesseRechnungUpload();
});

rechnungUploadErfolgSchliessenButton.addEventListener("click", async () => {
  schliesseRechnungUpload();
  // Zeile in "Meine Anfragen" direkt aktualisieren, damit der Button
  // sofort durch den "hochgeladen"-Hinweis ersetzt wird.
  await ladeMeineAnfragen();
});

rechnungDateiEingabe.addEventListener("change", async () => {
  const datei = rechnungDateiEingabe.files && rechnungDateiEingabe.files[0];
  if (!datei) return;

  rechnungUploadHinweis.hidden = true;
  rechnungHochladenButton.disabled = true;

  try {
    const { base64, mime, vorschauUrl } = await komprimiereBildAufBase64(datei);
    rechnungUploadBase64 = base64;
    rechnungUploadMime = mime;
    rechnungVorschauBild.src = vorschauUrl;
    rechnungVorschauBild.hidden = false;
    rechnungHochladenButton.disabled = false;
  } catch (e) {
    rechnungUploadHinweis.textContent = "Foto konnte nicht gelesen werden - bitte nochmal versuchen.";
    rechnungUploadHinweis.hidden = false;
  }
});

rechnungHochladenButton.addEventListener("click", async () => {
  if (!rechnungUploadAnfrageId || !rechnungUploadBase64) return;

  rechnungHochladenButton.disabled = true;
  rechnungUploadHinweis.hidden = true;

  const { error } = await sb.rpc("schiri_anfrage_rechnung_hochladen", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
    p_anfrage_id: rechnungUploadAnfrageId,
    p_bild_base64: rechnungUploadBase64,
    p_mime: rechnungUploadMime,
  });

  if (error) {
    rechnungHochladenButton.disabled = false;
    rechnungUploadHinweis.textContent = "Konnte leider nicht hochgeladen werden: " + error.message;
    rechnungUploadHinweis.hidden = false;
    return;
  }

  rechnungUploadInhalt.hidden = true;
  rechnungUploadErfolg.hidden = false;
});

// Prüft beim Anmelden, ob es unerledigte Status-Änderungen gibt (Ersatz für
// fehlende Push-Benachrichtigungen - siehe Nav-Brainstorm-Skizze, Konzept B).
async function aktualisiereAnfragenStatusPunkt() {
  if (!ausgewaehlteSchiedsrichterId || !eingegebenePin) return;

  const { data, error } = await sb.rpc("schiri_anfragen_liste", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
  });
  if (error || !data) return;

  const gibtUngeseheneUpdates = data.some((anfrage) => !anfrage.schiri_gesehen);
  profilStatusPunkt.hidden = !gibtUngeseheneUpdates;
  panelAnfragenStatusPunkt.hidden = !gibtUngeseheneUpdates;
}

async function ladeFragenUndAntworten() {
  const [fragenErgebnis, antwortenErgebnis] = await Promise.all([
    sb
      .from("fragen_oeffentlich")
      .select(
        "id, frage_text, option_a, option_b, option_c, regel_nummer, regel_bezeichnung, schwierigkeit, position, typ, antwort_hinweis, video_url, video_start_sekunden, video_end_sekunden, video_antworttyp, video_stumm"
      )
      .order("position", { ascending: true, nullsFirst: false }),
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
    // "video_freitext" wird wie "freitext" behandelt (gleiche KI-Bewertung,
    // gleiche Bau-Funktionen) - der Video-Player wird zusätzlich innerhalb
    // dieser Funktionen gerendert, siehe "baueVideoEinbettung".
    const istFreitext = frage.typ === "freitext" || frage.typ === "video_freitext";
    if (bisherigeAntwort && bisherigeAntwort.beantwortet) {
      beantworteFragenAnzahl += 1;
      fragenListe.appendChild(
        istFreitext
          ? baueBeantworteteFreitextElement(frage, bisherigeAntwort)
          : baueBeantworteteFrageElement(frage, bisherigeAntwort)
      );
    } else {
      fragenListe.appendChild(istFreitext ? baueFreitextFrageElement(frage) : baueFrageElement(frage));
    }
  }

  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    historieStartButton.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
}

// Vorlese-Option (Text-to-Speech, 10.07.2026, Backlog-Idee "klein, schnell
// machbar"): nutzt die im Browser eingebaute Web Speech API, kein eigener
// Server/Dienst nötig. "unterstuetztVorlesen" wird einmal beim Laden geprüft
// - auf Browsern ohne Unterstützung erscheint der Button gar nicht erst,
// statt beim Klick wirkungslos zu bleiben.
const unterstuetztVorlesen = "speechSynthesis" in window;

// Merkt sich den Button, der gerade eine Frage vorliest - so kann ein
// zweiter Klick auf DENSELBEN Button die Sprachausgabe stoppen (10.07.2026-
// Feedback: einmal klicken startet, nochmal klicken bricht ab, sonst nervt's).
let vorlesenAktiverButton = null;

function vorlesenBeendetAnzeigen(button) {
  button.classList.remove("spricht");
  button.textContent = "🔊";
  button.title = "Frage vorlesen";
  if (vorlesenAktiverButton === button) vorlesenAktiverButton = null;
}

function stoppeVorlesen() {
  window.speechSynthesis.cancel();
  if (vorlesenAktiverButton) vorlesenBeendetAnzeigen(vorlesenAktiverButton);
}

function vorlesen(text, button) {
  if (!unterstuetztVorlesen) return;
  stoppeVorlesen(); // falls schon eine andere Frage vorgelesen wird

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.onend = () => vorlesenBeendetAnzeigen(button);
  utterance.onerror = () => vorlesenBeendetAnzeigen(button);

  vorlesenAktiverButton = button;
  button.classList.add("spricht");
  button.textContent = "⏹";
  button.title = "Vorlesen stoppen";
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
    if (button.classList.contains("spricht")) {
      stoppeVorlesen();
    } else {
      vorlesen(text, button);
    }
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

// ============================================================
// "Warum ist das richtig?" - Explain-my-answer (KI-Erklärung via Gemini,
// 12.07.2026). Erscheint als Button unter jeder bereits beantworteten Frage
// (Multiple-Choice und Freitext, laufende Runde und Üben-Modus) - öffnet ein
// Popup mit einer live von der KI erzeugten Kurzerklärung. Die eigentliche
// Berechtigungsprüfung ("wurde diese Frage von mir überhaupt schon
// beantwortet?") läuft serverseitig in der RPC erklaerung_kontext_laden
// (Migration v46) - hier im Frontend geht es nur um Anzeige/Bedienung.
// ============================================================
const erklaerungOverlay = document.getElementById("erklaerung-overlay");
const erklaerungInhalt = document.getElementById("erklaerung-inhalt");
const erklaerungSchliessenButton = document.getElementById("erklaerung-schliessen-button");

function schliesseErklaerung() {
  if (erklaerungOverlay) erklaerungOverlay.hidden = true;
}

if (erklaerungSchliessenButton) {
  erklaerungSchliessenButton.addEventListener("click", schliesseErklaerung);
}
if (erklaerungOverlay) {
  // Klick auf den abgedunkelten Hintergrund schließt das Popup, ein Klick
  // auf das Popup selbst (die Karte darin) nicht - deshalb der Vergleich
  // mit event.target statt eines pauschalen Klick-Listeners.
  erklaerungOverlay.addEventListener("click", (event) => {
    if (event.target === erklaerungOverlay) schliesseErklaerung();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && erklaerungOverlay && !erklaerungOverlay.hidden) {
    schliesseErklaerung();
  }
});

// Öffnet das Popup und lädt die Erklärung nach. "istHistorie" steuert, ob
// die erklaerung_kontext_laden-RPC in "antworten" (laufende Runde) oder
// "historie_antworten" (Üben-Modus) nach der bereits gegebenen Antwort sucht.
async function oeffneErklaerung(frageId, istHistorie) {
  if (!erklaerungOverlay || !erklaerungInhalt) return;

  // Im Üben-Modus läuft nach dem Beantworten ein automatischer
  // Weiterschalt-Timer (siehe "zeigeHistorieWeiterButton") - der würde sonst
  // mitten im Lesen der Erklärung zur nächsten Frage springen. Gleiches
  // Verhalten wie beim manuellen Klick auf "Nächste Frage": Timer stoppen.
  if (historieAutoTimer) {
    clearTimeout(historieAutoTimer);
    historieAutoTimer = null;
  }

  erklaerungOverlay.hidden = false;
  erklaerungInhalt.innerHTML = "";
  const ladeHinweis = document.createElement("p");
  ladeHinweis.className = "erklaerung-lade-hinweis";
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  ladeHinweis.appendChild(spinner);
  ladeHinweis.append(" Einen Moment, die Erklärung wird erstellt ...");
  erklaerungInhalt.appendChild(ladeHinweis);

  try {
    const antwort = await fetch("/api/erklaerung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schiedsrichterId: ausgewaehlteSchiedsrichterId,
        frageId,
        pin: eingegebenePin,
        historie: istHistorie,
      }),
    });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten.fehler || "Unbekannter Fehler");

    erklaerungInhalt.innerHTML = "";
    const text = document.createElement("p");
    text.textContent = daten.erklaerung;
    erklaerungInhalt.appendChild(text);
  } catch (e) {
    erklaerungInhalt.innerHTML = "";
    const fehlerText = document.createElement("p");
    fehlerText.className = "erklaerung-fehler";
    fehlerText.textContent = "Erklärung konnte nicht geladen werden: " + e.message;
    erklaerungInhalt.appendChild(fehlerText);
  }
}

// Baut den "Warum?"-Button, der unter einer bereits beantworteten Frage
// erscheint.
function baueWarumButton(frageId, istHistorie) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "warum-button";
  button.append("💡 Warum?");
  button.addEventListener("click", () => oeffneErklaerung(frageId, istHistorie));
  return button;
}

// ============================================================
// Video-Fragetyp (12.07.2026, Grundgerüst - nachgebessert 12.07.2026):
// YouTube-Einbettung mit Start-/End-Zeit im datenschutzfreundlichen
// "Zwei-Klick"-Muster - es wird KEIN Kontakt zu YouTube aufgebaut, bevor
// aktiv auf den Platzhalter geklickt wird, und die Einbettung läuft über
// youtube-nocookie.com statt youtube.com (siehe Rechtsrecherche im
// Backlog, Baustein 1v). Funktioniert für beide Video-Antworttypen
// (video_mc/video_freitext) gleich - deshalb rein am Vorhandensein von
// "frage.video_url" festgemacht statt am typ-Feld.
//
// Nachbesserung (Max' Live-Test-Feedback, 12.07.2026): die erste Version
// hat nur eine statische <iframe src="...?start=X&end=Y">-URL gesetzt.
// Das Problem: start/end sind reine Lade-Parameter, keine dauerhafte
// Beschränkung - nach dem ersten Ansehen "vergisst" der Player den
// Ausschnitt, ein erneutes Play spielt vom letzten Stand weiter statt
// wieder vom Snippet-Anfang. Fix: echte YouTube-IFrame-Player-API
// (kostenlos, kein API-Key, kein Kontingent - reines JS um denselben
// Embed-Player) statt einer statischen iframe-URL. Damit bekommen wir das
// "onStateChange"-Ereignis mit, und sobald der Player den Zustand ENDED
// meldet (tritt zuverlässig genau beim erreichten End-Timestamp ein),
// wird der Player komplett zerstört und der graue Platzhalter wieder
// gezeigt - ein erneuter Klick lädt sauber wieder ab Start-Sekunde.
// "playsinline: 1" verhindert außerdem, dass iOS beim Abspielen von sich
// aus in den nativen Vollbildmodus springt (das war vermutlich die
// eigentliche Ursache für Max' beobachtetes Reload-Verhalten auf dem
// Handy) - zusammen mit "fs: 0" (YouTubes eigener Vollbild-Button wird
// entfernt) läuft jede "groß ansehen"-Interaktion jetzt ausschließlich
// über unser eigenes Overlay (siehe "oeffneVideoGrossansicht" unten),
// nicht mehr über YouTubes eigenes, browserabhängiges Vollbildverhalten.
// ============================================================
let youtubeApiPromise = null;
function ladeYoutubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const vorherigerHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof vorherigerHandler === "function") vorherigerHandler();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

function extrahiereYoutubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
    }
  } catch (e) {
    // ungültige URL - kein Video anzeigen, Frage bleibt trotzdem nutzbar
  }
  return null;
}

// Gemeinsames "Groß ansehen"-Overlay (ein einziges für die ganze Seite,
// analog zum Erklärung-Popup) - merkt sich, in welchen Wrapper der Player
// beim Schließen zurückwandert. Die eigentliche Größenanpassung bei
// Drehung des Handys passiert rein über CSS (siehe style.css,
// ".video-gross-spieler-halter": Breite = das Minimum aus 94% der
// Viewport-Breite UND einer aus 94% der Viewport-Höhe abgeleiteten
// 16:9-Breite) - dadurch reagiert die Größe automatisch und ohne eigenen
// JS-Resize-Handler auf jede Drehung/Größenänderung, auch zuverlässiger
// als ein "orientationchange"-Event-Listener.
let aktuellerGrossSpielerWrap = null;
let aktuellerGrossSpielerRueckgabeStelle = null;

function schliesseVideoGrossansicht() {
  const overlay = document.getElementById("video-gross-overlay");
  const halter = document.getElementById("video-gross-spieler-halter");
  if (!overlay || !halter) return;
  if (aktuellerGrossSpielerWrap && aktuellerGrossSpielerRueckgabeStelle && halter.firstChild) {
    aktuellerGrossSpielerRueckgabeStelle.appendChild(halter.firstChild);
  }
  overlay.hidden = true;
  aktuellerGrossSpielerWrap = null;
  aktuellerGrossSpielerRueckgabeStelle = null;
}

function oeffneVideoGrossansicht(spielerElement, rueckgabeStelle) {
  const overlay = document.getElementById("video-gross-overlay");
  const halter = document.getElementById("video-gross-spieler-halter");
  if (!overlay || !halter) return;
  halter.innerHTML = "";
  halter.appendChild(spielerElement);
  aktuellerGrossSpielerWrap = spielerElement;
  aktuellerGrossSpielerRueckgabeStelle = rueckgabeStelle;
  overlay.hidden = false;
}

(function initVideoGrossansichtOverlay() {
  const overlay = document.getElementById("video-gross-overlay");
  if (!overlay) return;
  const schliessenButton = document.getElementById("video-gross-schliessen-button");
  if (schliessenButton) schliessenButton.addEventListener("click", schliesseVideoGrossansicht);
  overlay.addEventListener("click", (ereignis) => {
    if (ereignis.target === overlay) schliesseVideoGrossansicht();
  });
  document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key === "Escape" && !overlay.hidden) schliesseVideoGrossansicht();
  });
})();

function baueVideoEinbettung(videoUrl, startSekunden, endSekunden, stumm) {
  const videoId = extrahiereYoutubeId(videoUrl);
  if (!videoId) return null;

  const wrap = document.createElement("div");
  wrap.className = "video-einbettung";

  // Nachbesserung (13.07.2026, Max' Feedback: bei zwei Video-Fragen
  // hintereinander sehen beide Platzhalter identisch aus - kombiniert mit
  // Hoch/Quer-Drehen auf dem Handy wusste er nicht mehr, welches Video er
  // schon angesehen hatte und zu welcher Frage es gehörte). Der Platzhalter
  // ist bewusst generisch OHNE YouTube-Vorschaubild (kein Kontakt zu
  // YouTube vor dem Klick, siehe Hinweistext) - darum braucht er eine
  // EIGENE, rein lokale Markierung, ob dieses Video schon geöffnet wurde.
  // "bereitsAngesehen" lebt in diesem Closure, also pro Video-Frage einzeln
  // (keine Verwechslungsgefahr zwischen mehreren Karten). Wird schon beim
  // ERSTEN Klick (Start des Ladens) gesetzt, nicht erst nach komplettem
  // Durchschauen - Max wollte wissen "habe ich mir das überhaupt schon
  // angeschaut", nicht "habe ich es bis zum Ende geschaut".
  let bereitsAngesehen = false;

  function baueUndZeigePlatzhalter() {
    wrap.innerHTML = "";

    const platzhalter = document.createElement("button");
    platzhalter.type = "button";
    platzhalter.className = "video-platzhalter" + (bereitsAngesehen ? " video-platzhalter-angesehen" : "");

    if (bereitsAngesehen) {
      const badge = document.createElement("span");
      badge.className = "video-platzhalter-badge";
      badge.textContent = "✓ Angesehen";
      platzhalter.appendChild(badge);
    }

    const icon = document.createElement("span");
    icon.className = "video-platzhalter-icon";
    icon.textContent = bereitsAngesehen ? "↻" : "▶";
    platzhalter.appendChild(icon);

    const text = document.createElement("span");
    text.className = "video-platzhalter-text";
    text.textContent = bereitsAngesehen ? "Video nochmal ansehen" : "Video laden und ansehen";
    platzhalter.appendChild(text);

    const hinweis = document.createElement("span");
    hinweis.className = "video-platzhalter-hinweis";
    hinweis.textContent = stumm
      ? "Lädt erst nach Klick von YouTube - ohne Ton, damit kein Kommentator die Antwort verrät."
      : "Lädt erst nach Klick von YouTube - vorher kein Kontakt zu YouTube.";
    platzhalter.appendChild(hinweis);

    platzhalter.addEventListener("click", () => {
      bereitsAngesehen = true;
      platzhalter.disabled = true;
      text.textContent = "Wird geladen ...";
      ladeYoutubeApi().then((YT) => {
        // Falls der Nutzer während des Ladens schon weitergeklickt/die Frage
        // verlassen hat, könnte "wrap" inzwischen woanders hinzeigen - hier
        // bewusst kein zusätzlicher Check nötig, der Platzhalter bleibt Teil
        // von "wrap" bis er ersetzt wird.
        const spielerHalter = document.createElement("div");
        spielerHalter.className = "video-spieler-halter";
        const spielerZiel = document.createElement("div");
        spielerHalter.appendChild(spielerZiel);

        // Eigener Pause/Play-Button (12.07.2026, Nachbesserung Runde 2) -
        // lebt bewusst INNERHALB von "spielerHalter", nicht in "wrap": beim
        // "Groß ansehen" wandert "spielerHalter" per DOM-Move ins Overlay,
        // der Button wandert automatisch mit, ohne eigene Verdrahtung dafür.
        const abspielButton = document.createElement("button");
        abspielButton.type = "button";
        abspielButton.className = "video-abspiel-button";
        abspielButton.textContent = "⏸";
        abspielButton.setAttribute("aria-label", "Pause");
        spielerHalter.appendChild(abspielButton);

        wrap.innerHTML = "";
        wrap.appendChild(spielerHalter);

        // "Groß ansehen" bleibt bewusst in "wrap" (nicht in "spielerHalter")
        // - dadurch verschwindet er automatisch mit dem Rest von "wrap"
        // hinter dem Overlay, sobald schon groß angesehen wird, statt sich
        // sinnlos "in sich selbst" nochmal anzubieten. Wird EINMALIG hier
        // angelegt (nicht erst in "onReady", siehe Kommentar dort) - das ist
        // der eigentliche Fix für den gemeldeten "Button erscheint mehrfach"-
        // Bug.
        const grossButton = document.createElement("button");
        grossButton.type = "button";
        grossButton.className = "video-gross-button";
        grossButton.textContent = "⤢ Groß ansehen";
        grossButton.addEventListener("click", () => {
          oeffneVideoGrossansicht(spielerHalter, wrap);
        });
        wrap.appendChild(grossButton);

        const playerVars = {
          autoplay: 1,
          // Nachbesserung (Max' zweite Live-Test-Runde, 12.07.2026):
          // YouTubes komplette native Steuerleiste ausblenden statt nur den
          // Vollbild-Button ("fs: 0" reichte allein nicht) - damit ist auch
          // die Fortschritts-/Zeitleiste weg, über die man sonst zu jedem
          // beliebigen Zeitpunkt hätte springen können (Max' zweiter
          // gemeldeter Punkt). Eigene, schlanke Pause/Play- und
          // "Groß ansehen"-Buttons ersetzen sie (s.o.).
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          fs: 0,
          playsinline: 1,
          mute: stumm ? 1 : 0,
        };
        // "start"/"end" nur mitgeben, wenn tatsächlich gesetzt - ein
        // "undefined"-Wert im Objekt würde beim Zusammenbauen der
        // YouTube-Embed-URL sonst als Literal-String "undefined" landen.
        if (Number.isFinite(startSekunden)) playerVars.start = Math.max(0, Math.floor(startSekunden));
        if (Number.isFinite(endSekunden)) playerVars.end = Math.max(0, Math.floor(endSekunden));

        // "bereitsEingerichtet" schützt zusätzlich gegen den Fall, dass die
        // YouTube-API "onReady" tatsächlich mehrfach für denselben Player
        // feuert (beobachtetes Verhalten auf dem Handy, vermutlich durch
        // eine interne Neuinitialisierung beim Verlassen eines nativen
        // Vollbildmodus ausgelöst) - ohne diese Sperre würden Klick-Handler
        // mehrfach registriert.
        let bereitsEingerichtet = false;

        // ============================================================
        // Nachbesserung Runde 3 (12.07.2026, Max' drittes Live-Test-
        // Feedback): YouTube zeigt am ECHTEN Ende eines Videos automatisch
        // einen eigenen "weitere Videos ansehen"-Vorschlagsbildschirm mit
        // klickbaren Vorschau-Kacheln - das ist Teil der Kern-Wiedergabe-UI,
        // nicht der "controls"-Leiste, und lässt sich über KEINEN
        // IFrame-Player-Parameter mehr vollständig abschalten ("rel: 0"
        // schränkt seit einer YouTube-Änderung von 2018 nur noch auf
        // Videos DESSELBEN Kanals ein, verhindert die Anzeige aber nicht
        // mehr komplett). Da wir den Player erst REAGIEREN, nachdem
        // YouTube den "ENDED"-Zustand meldet, konnte dieser Bildschirm
        // bisher kurz aufblitzen, bevor unser Code den Platzhalter zeigt -
        // umso auffälliger, seit die restliche Steuerleiste durch
        // "controls: 0" schon weg ist.
        //
        // Fix: wir warten den echten "ENDED"-Zustand gar nicht erst ab,
        // sondern beobachten die Wiedergabezeit selbst (alle 200ms) und
        // lösen unser eigenes "Video zu Ende"-Aufräumen (Platzhalter zeigen,
        // Player zerstören) schon "VORLAUF_SEKUNDEN" VOR dem eigentlichen
        // Ende aus - der Vorsprung ist größer als das Abfrage-Intervall,
        // damit er zuverlässig vor YouTubes eigenem Vorschlagsbildschirm
        // greift. 0,35s vor Schluss abzuschneiden fällt beim Zuschauen
        // nicht auf, verhindert aber zuverlässig, dass YouTubes Bildschirm
        // überhaupt erst zu rendern anfängt. Der echte "ENDED"-Fall bleibt
        // als Rückfallebene bestehen (z.B. falls "getDuration()" mal nichts
        // Sinnvolles liefert), "beendetAusgeloest" verhindert ein doppeltes
        // Aufräumen (zweimaliges "destroy()" würde einen Fehler werfen).
        // ============================================================
        const VORLAUF_SEKUNDEN = 0.35;
        let beendetAusgeloest = false;
        let endUeberwachungsIntervall = null;

        function stoppeEndUeberwachung() {
          if (endUeberwachungsIntervall) {
            clearInterval(endUeberwachungsIntervall);
            endUeberwachungsIntervall = null;
          }
        }

        function beendeVideo() {
          if (beendetAusgeloest) return;
          beendetAusgeloest = true;
          stoppeEndUeberwachung();
          if (aktuellerGrossSpielerWrap === spielerHalter) schliesseVideoGrossansicht();
          spieler.destroy();
          baueUndZeigePlatzhalter();
        }

        // Nachbesserung Runde 3/4 (12.07.2026): Untertitel sollen IMMER aus
        // bleiben. "cc_load_policy: 0" oben in "playerVars" verhindert nur,
        // dass Untertitel automatisch nach Zuschauer-Voreinstellung
        // eingeschaltet werden - reicht laut Max' Beobachtung in der Praxis
        // nicht zuverlässig aus. Das komplette Entladen des Untertitel-
        // Moduls über die (offiziell nicht dokumentierte, aber weithin
        // genutzte) Player-API-Methode "unloadModule" ist der zuverlässigste
        // bekannte Weg. Als eigene Funktion, weil sie an mehreren Stellen
        // aufgerufen wird (siehe Kommentar bei "onStateChange" unten, wieso
        // einmaliges Aufrufen in "onReady" allein nicht reichte).
        function unterdrueckeUntertitel() {
          if (typeof spieler.unloadModule === "function") {
            spieler.unloadModule("captions");
          }
        }

        const spieler = new YT.Player(spielerZiel, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars,
          events: {
            onReady: () => {
              if (bereitsEingerichtet) return;
              bereitsEingerichtet = true;

              abspielButton.addEventListener("click", () => {
                if (spieler.getPlayerState() === YT.PlayerState.PLAYING) {
                  spieler.pauseVideo();
                } else {
                  spieler.playVideo();
                }
              });

              // Zusätzliche Absicherung GEGEN natives Vollbild auf
              // DOM-/Berechtigungs-Ebene, nicht nur über "fs: 0"/
              // "controls: 0" (die schalten nur YouTubes eigene Bedienung
              // ab, verhindern aber nicht zwingend jede browser-/
              // OS-seitige Vollbild-Möglichkeit für das iframe). Ein
              // iframe ohne "allow=fullscreen" darf laut Fullscreen-API-
              // Spezifikation gar keine Vollbild-Anfrage mehr stellen -
              // das ist eine echte Browser-Sperre, keine reine Kosmetik.
              const iframe = spieler.getIframe();
              if (iframe) {
                iframe.removeAttribute("allowfullscreen");
                if (iframe.allow) {
                  iframe.allow = iframe.allow
                    .split(";")
                    .map((teil) => teil.trim())
                    .filter((teil) => teil && !teil.startsWith("fullscreen"))
                    .join("; ");
                }
              }

              unterdrueckeUntertitel();
            },
            // Nachbesserung Runde 5 (13.07.2026, Max meldet: Untertitel sind
            // trotz Runde 3/4 offenbar auf einem echten Gerät immer noch
            // manchmal zu sehen). "onApiChange" ist das offizielle YouTube-
            // IFrame-API-Event dafür, dass sich verfügbare Player-Module
            // (u.a. das Untertitel-Modul "captions") ändern oder neu laden -
            // genau der Moment, in dem sich das Modul laut YouTubes eigener
            // (unvollständiger) Doku unbemerkt selbst neu initialisieren
            // kann. Zusätzlich zu den bestehenden Aufrufen bei "onReady" und
            // "PLAYING" hier nochmal an der offiziellen Quelle abgreifen -
            // deckt zusammen mit den bisherigen Aufrufen praktisch jeden
            // bekannten Zeitpunkt ab, zu dem das Modul (wieder) aktiv werden
            // könnte.
            //
            // WICHTIG (siehe Notiz in Backlog/Dashboard): sollte es auf dem
            // iPhone TROTZDEM noch vorkommen, ist die wahrscheinlichste
            // Ursache keine Lücke mehr in diesem Code, sondern die iOS-
            // Systemeinstellung "Einstellungen > Bedienungshilfen >
            // Untertitel & Untertitelung > Untertitel + SDH". Ist die
            // eingeschaltet, erzwingt iOS/Safari selbst Untertitel bei JEDER
            // Videowiedergabe (auch eingebettete YouTube-Player) - das
            // passiert unterhalb der Web-Player-API und lässt sich von
            // keiner Website per JavaScript übersteuern. Kurzer Check auf
            // dem eigenen Handy lohnt sich, bevor hier weiter nachgebessert
            // wird.
            onApiChange: () => {
              unterdrueckeUntertitel();
            },
            onStateChange: (ereignis) => {
              if (ereignis.data === YT.PlayerState.ENDED) {
                beendeVideo();
                return;
              }
              if (ereignis.data === YT.PlayerState.PLAYING) {
                abspielButton.textContent = "⏸";
                abspielButton.setAttribute("aria-label", "Pause");
                // Nachbesserung Runde 4 (12.07.2026, Max' Rückmeldung: der
                // Runde-3-Fix "unloadModule('captions')" EINMALIG in
                // "onReady" hat in der Praxis nicht gereicht). Bekanntes,
                // offiziell nicht dokumentiertes Verhalten des Untertitel-
                // Moduls: es kann sich beim TATSÄCHLICHEN Start der
                // Wiedergabe (nicht schon bei "onReady", das vor dem
                // eigentlichen Abspielen feuert) selbst neu laden, auch
                // nachdem es einmal entladen wurde. Deshalb hier zusätzlich
                // bei JEDEM "PLAYING" nochmal entladen, plus zwei verzögerte
                // Nachschläge (300ms/1500ms), um ein eventuell erst leicht
                // verzögert nachladendes Untertitel-Modul ebenfalls zu
                // erwischen. Es gibt dafür keinen offiziellen, garantiert
                // hundertprozentigen Weg von YouTube selbst (bestätigt durch
                // mehrere offene YouTube-eigene Bugreports zu genau diesem
                // Verhalten) - das hier ist der robusteste bekannte Ansatz.
                unterdrueckeUntertitel();
                setTimeout(unterdrueckeUntertitel, 300);
                setTimeout(unterdrueckeUntertitel, 1500);
                // Startet die Endzeit-Überwachung (siehe Kommentar bei
                // "VORLAUF_SEKUNDEN" oben) - nur, wenn nicht schon eine läuft,
                // damit mehrfaches Play/Pause nicht mehrere Intervalle parallel
                // aufmacht.
                if (!endUeberwachungsIntervall) {
                  endUeberwachungsIntervall = setInterval(() => {
                    if (beendetAusgeloest) return;
                    const aktuelleZeit = typeof spieler.getCurrentTime === "function" ? spieler.getCurrentTime() : 0;
                    const gesamtDauer = typeof spieler.getDuration === "function" ? spieler.getDuration() : 0;
                    const zielEnde = Number.isFinite(endSekunden) && endSekunden > 0 ? endSekunden : gesamtDauer;
                    if (zielEnde && aktuelleZeit >= zielEnde - VORLAUF_SEKUNDEN) {
                      beendeVideo();
                    }
                  }, 200);
                }
              } else if (ereignis.data === YT.PlayerState.PAUSED) {
                abspielButton.textContent = "▶";
                abspielButton.setAttribute("aria-label", "Abspielen");
                // Überwachung während der Pause anhalten (spart Ressourcen,
                // die Wiedergabezeit steht ohnehin still) - startet beim
                // nächsten "PLAYING" automatisch wieder neu.
                stoppeEndUeberwachung();
              }
            },
          },
        });
      });
    });

    wrap.appendChild(platzhalter);
  }

  baueUndZeigePlatzhalter();
  return wrap;
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

  const video = baueVideoEinbettung(frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden, frage.video_stumm);
  if (video) container.appendChild(video);

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

  const video = baueVideoEinbettung(frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden, frage.video_stumm);
  if (video) container.appendChild(video);

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
  container.appendChild(baueWarumButton(frage.id, false));

  return container;
}

// ============================================================
// Freitext-Fragen mit KI-Auswertung (10.07.2026)
// ============================================================
const FREITEXT_ZEICHENLIMIT = 400;

function baueFreitextFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage-karte frage-karte-freitext";
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

  const video = baueVideoEinbettung(frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden, frage.video_stumm);
  if (video) container.appendChild(video);

  if (frage.antwort_hinweis) {
    const hinweis = document.createElement("p");
    hinweis.className = "freitext-hinweis";
    hinweis.textContent = frage.antwort_hinweis;
    container.appendChild(hinweis);
  }

  const textarea = document.createElement("textarea");
  textarea.className = "freitext-eingabe";
  textarea.maxLength = FREITEXT_ZEICHENLIMIT;
  textarea.rows = 3;
  textarea.placeholder = "Deine Antwort ...";
  container.appendChild(textarea);

  const zaehler = document.createElement("div");
  zaehler.className = "freitext-zaehler";
  zaehler.textContent = "0 / " + FREITEXT_ZEICHENLIMIT;
  textarea.addEventListener("input", () => {
    zaehler.textContent = textarea.value.length + " / " + FREITEXT_ZEICHENLIMIT;
  });
  container.appendChild(zaehler);

  const absendenButton = document.createElement("button");
  absendenButton.className = "absenden-button";
  absendenButton.textContent = "Antwort abschicken";
  absendenButton.addEventListener("click", () =>
    freitextAntwortAbschicken(frage.id, container, absendenButton, textarea)
  );
  container.appendChild(absendenButton);

  // Lade-Hinweis: erscheint erst beim Absenden (nicht vorher!). Wichtig für
  // Freitext, weil die Auswertung ein paar Sekunden dauert (anders als bei
  // Multiple Choice, wo die Rückmeldung sofort da ist) - ohne diesen Hinweis
  // würden ungeduldige Nutzer:innen vermutlich mehrfach auf den Button
  // klicken. Bewusst ohne "KI"-Erwähnung im Text (Max' Feedback: die
  // KI-Anbindung soll im Hintergrund bleiben, nicht ständig betont werden).
  const ladeHinweis = document.createElement("p");
  ladeHinweis.className = "freitext-lade-hinweis";
  ladeHinweis.hidden = true;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  ladeHinweis.appendChild(spinner);
  ladeHinweis.append(" Einen Moment, deine Antwort wird geprüft ...");
  container.appendChild(ladeHinweis);

  // Als <div> statt <p> angelegt, weil hier gleich mehrere <p>-Zeilen
  // (Kopf/Musterantwort/KI-Feedback) reingehängt werden - ein <p> darf laut
  // HTML-Spec kein Block-Element wie ein weiteres <p> enthalten.
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

// Baut den Ergebnis-Inhalt für eine Freitext-Antwort - fest formuliert
// ("Antwort korrekt"/"Antwort nicht korrekt" + die tatsächliche Musterantwort
// wortwörtlich), die freie KI-Formulierung kommt nur noch als zusätzliche,
// kleiner gesetzte Zeile dazu. Max' Feedback nach dem ersten Test: die
// bisherige, komplett KI-generierte Formulierung wirkte zu variabel/informell -
// die feste Musterantwort sorgt dafür, dass die eigentlich richtige Antwort
// (z.B. "Gelbe Karte") immer exakt und gleich dargestellt wird.
function baueFreitextErgebnisInhalt(ergebnis) {
  const wrap = document.createElement("div");

  const kopf = document.createElement("p");
  kopf.className = "freitext-ergebnis-kopf";
  kopf.textContent = ergebnis.korrekt ? "Antwort korrekt ✅" : "Antwort nicht korrekt";
  wrap.appendChild(kopf);

  if (ergebnis.musterantwort) {
    const musterZeile = document.createElement("p");
    musterZeile.className = "freitext-ergebnis-muster";
    musterZeile.textContent = "Richtige Antwort: " + ergebnis.musterantwort;
    wrap.appendChild(musterZeile);
  }

  if (ergebnis.ki_feedback) {
    const kiZeile = document.createElement("p");
    kiZeile.className = "freitext-ergebnis-ki";
    kiZeile.textContent = ergebnis.ki_feedback;
    wrap.appendChild(kiZeile);
  }

  return wrap;
}

function baueBeantworteteFreitextElement(frage, antwort) {
  const container = document.createElement("div");
  container.className =
    "frage-karte beantwortet frage-karte-freitext " + (antwort.korrekt ? "richtig-karte" : "falsch-karte");
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

  const video = baueVideoEinbettung(frage.video_url, frage.video_start_sekunden, frage.video_end_sekunden, frage.video_stumm);
  if (video) container.appendChild(video);

  const deineAntwort = document.createElement("p");
  deineAntwort.className = "freitext-eigene-antwort";
  deineAntwort.textContent = "Deine Antwort: " + (antwort.gegebener_freitext || "");
  container.appendChild(deineAntwort);

  const ergebnisWrap = document.createElement("div");
  ergebnisWrap.className = "beantwortet-ergebnis " + (antwort.korrekt ? "richtig" : "falsch");
  ergebnisWrap.appendChild(baueFreitextErgebnisInhalt(antwort));
  container.appendChild(ergebnisWrap);
  container.appendChild(baueWarumButton(frage.id, false));

  return container;
}

async function freitextAntwortAbschicken(frageId, container, button, textarea) {
  const freitext = textarea.value.trim();
  if (freitext.length === 0) {
    zeigeFehler("Bitte erst eine Antwort eingeben.");
    return;
  }
  versteckeFehler();

  // Button UND Textfeld sperren, solange die KI-Bewertung läuft - verhindert
  // Doppel-Absenden durch ungeduldiges Mehrfachklicken (Max' ausdrücklicher
  // Wunsch nach dem ersten Live-Test).
  button.disabled = true;
  textarea.disabled = true;

  const ladeHinweis = container.querySelector(".freitext-lade-hinweis");
  if (ladeHinweis) ladeHinweis.hidden = false;

  let ergebnis;
  try {
    const antwort = await fetch("/api/freitext-bewerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schiedsrichterId: ausgewaehlteSchiedsrichterId,
        frageId,
        pin: eingegebenePin,
        freitext,
      }),
    });
    ergebnis = await antwort.json();
    if (!antwort.ok) throw new Error(ergebnis.fehler || "Unbekannter Fehler");
  } catch (e) {
    if (ladeHinweis) ladeHinweis.hidden = true;
    const feedback = container.querySelector(".feedback");
    feedback.hidden = false;
    feedback.textContent = "Fehler bei der Auswertung: " + e.message + " - bitte nochmal versuchen.";
    feedback.classList.add("falsch");
    button.disabled = false;
    textarea.disabled = false;
    return;
  }

  if (ladeHinweis) ladeHinweis.hidden = true;

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;
  feedback.innerHTML = "";
  feedback.classList.add(ergebnis.korrekt ? "richtig" : "falsch");

  if (ergebnis.bereits_beantwortet) {
    const hinweisZeile = document.createElement("p");
    hinweisZeile.className = "freitext-ergebnis-hinweis";
    hinweisZeile.textContent = "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt:";
    feedback.appendChild(hinweisZeile);
  }
  feedback.appendChild(baueFreitextErgebnisInhalt(ergebnis));
  feedback.appendChild(baueWarumButton(frageId, false));

  beantworteFragenAnzahl += 1;
  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    historieStartButton.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
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

  feedback.appendChild(document.createElement("br"));
  feedback.appendChild(baueWarumButton(frageId, false));

  beantworteFragenAnzahl += 1;
  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    historieStartButton.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
}

// Sammel-Button: schickt alle offenen Fragen ab, bei denen schon eine Antwort
// ausgewählt (aber noch nicht abgeschickt) wurde - vor allem am Desktop praktisch,
// wo man mehrere Fragen bequem nacheinander anklicken kann, statt jede einzeln
// abzuschicken. Die einzelnen "Antwort abschicken"-Buttons bleiben trotzdem nutzbar.
sammelAbsendenButton.addEventListener("click", async () => {
  // Freitext-Karten haben keine Radio-Buttons und werden hier bewusst nicht
  // mit erfasst (eigener "Antwort abschicken"-Button je Karte, wegen der
  // KI-Wartezeit lieber einzeln als im Sammel-Rutsch).
  const offeneMitAuswahl = Array.from(
    fragenListe.querySelectorAll(".frage-karte:not(.beantwortet):not(.frage-karte-freitext)")
  ).filter((karte) => {
    const button = karte.querySelector(".absenden-button");
    return karte.querySelector('input[type="radio"]:checked') && button && !button.disabled;
  });

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
  const offeneAnzahl = Array.from(
    fragenListe.querySelectorAll(".frage-karte:not(.beantwortet):not(.frage-karte-freitext)")
  ).filter((karte) => {
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

// ============================================================
// Historie - Wiederholung alter Fragen (11.07.2026)
//
// Eigener Bereich, erreichbar über den Button in der "Fertig"-Meldung.
// Zeigt immer genau EINE zufällige historische Frage (Multiple-Choice oder
// Freitext, gleiche Kartenoptik/TTS wie im normalen Quiz), gewichtet nach
// einer sanften Leitner-Stufe (RPC "historie_naechste_frage" macht die
// Gewichtung serverseitig, siehe Migration v41). Die Antworten landen in
// einem eigenen DB-Log (historie_antworten), NICHT in "antworten" - die
// normale wöchentliche Auswertung bleibt dadurch unverfälscht (Max'
// ausdrücklicher Wunsch). Über den Kreis-Button ("🔄") kann man sich
// jederzeit eine andere Frage anzeigen lassen, statt auf die aktuelle
// antworten zu müssen.
// ============================================================

// Betreten/Verlassen des "Üben"-Modus (11.07.2026, Update nach Max'
// Feedback): der Kopf bekommt eine eigene Farbe + einen eigenen Untertitel,
// und die wöchentliche "X von Y beantwortet"-Leiste verschwindet - im
// Üben-Modus weiß man ja per Definition schon, dass man "in dem Menü" ist,
// da störte die Leiste laut Max nur noch.
function betreteUebenModus() {
  if (kopf) kopf.classList.add("kopf-uebung");
  if (kopfUntertitel) kopfUntertitel.textContent = UEBEN_UNTERTITEL;
  fortschrittWrap.hidden = true;
  fragenSchritt.hidden = true;
  historieSchritt.hidden = false;
  if (historieScoreboard) historieScoreboard.hidden = false;
  ladeHistorieFortschritt();
  ladeHistorieFrage(null);
}

function verlasseUebenModus() {
  if (historieAutoTimer) {
    clearTimeout(historieAutoTimer);
    historieAutoTimer = null;
  }
  stoppeVorlesen();
  if (kopf) kopf.classList.remove("kopf-uebung");
  if (kopfUntertitel) kopfUntertitel.textContent = kopfUntertitelOriginal;
  // Die wöchentliche Fortschrittsleiste gehört nur ins normale Quiz - war sie
  // vorher (angemeldeter Zustand) sichtbar, kommt sie jetzt einfach wieder.
  fortschrittWrap.hidden = false;
  historieSchritt.hidden = true;
  fragenSchritt.hidden = false;
}

historieStartButton.addEventListener("click", betreteUebenModus);

historieZurueckButton.addEventListener("click", verlasseUebenModus);

historieNeuLadenButton.addEventListener("click", () => {
  if (historieNeuLadenIcon) {
    historieNeuLadenIcon.classList.remove("dreht-sich");
    // Reflow erzwingen, damit die Animation bei mehrfachem Klick hintereinander
    // jedes Mal neu abspielt, statt beim erneuten Hinzufügen derselben Klasse
    // einfach ignoriert zu werden.
    void historieNeuLadenIcon.offsetWidth;
    historieNeuLadenIcon.classList.add("dreht-sich");
  }
  ladeHistorieFrage(historieAktuelleFrageId);
});

async function ladeHistorieFortschritt() {
  historieSessionGesamt = 0;
  historieSessionRichtig = 0;
  // Zähler-Tracking zurücksetzen, damit der erste Render dieser Sitzung nie
  // eine Flip-Animation auslöst (siehe animiereScoreboardZiffer) - sonst
  // würde beim erneuten Betreten des Üben-Modus kurz sichtbar von der alten
  // Sitzungszahl auf 0 "geklappt".
  historieScoreboardLetzterGesamt = null;
  historieScoreboardLetzterRichtig = null;

  const { data, error } = await sb.rpc("historie_fortschritt_uebersicht", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
  });

  if (error || !data || data.length === 0) {
    historieBasisGesamt = 0;
    historieBasisRichtig = 0;
  } else {
    historieBasisGesamt = data[0].gesamt_beantwortet;
    historieBasisRichtig = data[0].richtig_beantwortet;
  }

  aktualisiereHistorieFortschrittText();
}

// Rendert das Scoreboard rein aus lokalem Zustand (Server-Basis + Antworten
// dieser Sitzung) - siehe Kommentar bei den Variablen weiter oben, warum das
// nicht mehr bei jeder Antwort neu vom Server geladen wird. Zeigt groß den
// Sitzungs-Fortschritt ("Heute geübt"), der Gesamt-Stand seit Beginn steht
// klein im Kopf des Kastens. Jede Zahl, die sich seit dem letzten Aufruf
// geändert hat, bekommt kurz die Flip-Animation (".aktualisiert",
// siehe style.css) - beim allerersten Rendern (Betreten des Üben-Modus)
// bewusst ohne Animation, das würde nur unruhig wirken.
function aktualisiereHistorieFortschrittText() {
  if (!historieScoreboard) return;

  const gesamtGesamt = historieBasisGesamt + historieSessionGesamt;
  const gesamtRichtig = historieBasisRichtig + historieSessionRichtig;

  animiereScoreboardZiffer(historieScoreboardGesamt, historieSessionGesamt, historieScoreboardLetzterGesamt);
  animiereScoreboardZiffer(historieScoreboardRichtig, historieSessionRichtig, historieScoreboardLetzterRichtig);
  historieScoreboardLetzterGesamt = historieSessionGesamt;
  historieScoreboardLetzterRichtig = historieSessionRichtig;

  historieScoreboardGesamtHinweis.textContent =
    gesamtGesamt === 0
      ? ""
      : "Insgesamt " + gesamtGesamt + " gemacht, " + gesamtRichtig + " davon richtig";
}

function animiereScoreboardZiffer(element, neuerWert, alterWert) {
  if (!element) return;
  element.textContent = String(neuerWert);
  if (alterWert === null || alterWert === neuerWert) return;
  element.classList.remove("aktualisiert");
  void element.offsetWidth; // Reflow erzwingen, damit die Animation bei mehreren Änderungen hintereinander jedes Mal neu abspielt.
  element.classList.add("aktualisiert");
}

async function ladeHistorieFrage(ausschlussFrageId) {
  versteckeFehler();
  stoppeVorlesen();
  if (historieAutoTimer) {
    clearTimeout(historieAutoTimer);
    historieAutoTimer = null;
  }
  historieFrageBereich.innerHTML = "";
  historieLeerHinweis.hidden = true;

  const { data, error } = await sb.rpc("historie_naechste_frage", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
    p_ausschluss_frage_id: ausschlussFrageId,
  });

  if (error) {
    zeigeFehler("Wiederholungsfrage konnte nicht geladen werden: " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    historieAktuelleFrageId = null;
    historieLeerHinweis.hidden = false;
    return;
  }

  const frage = data[0];
  historieAktuelleFrageId = frage.frage_id;
  historieFrageBereich.appendChild(
    frage.typ === "freitext" ? baueHistorieFreitextFrageElement(frage) : baueHistorieFrageElement(frage)
  );
}

// "Nächste Frage"-Button direkt in der Karte (11.07.2026, Max' Feedback:
// vorher blieb man nach dem Antworten einfach "hängen" - jetzt ist der Weg
// zur nächsten Frage Teil der Karte selbst statt eines weit entfernten
// Icons oben). Bei Multiple-Choice zählt zusätzlich ein automatischer
// Weiterschalt-Timer mit sichtbarer Countdown-Linie (bei Freitext bewusst
// nicht, weil das KI-Feedback erst gelesen werden soll). Der Timer ist über
// "historieAutoTimer" jederzeit abbrechbar (Reload-Klick, Zurück-Klick,
// eigener Klick auf den Weiter-Button).
function zeigeHistorieWeiterButton(container, bisherigeFrageId, automatisch) {
  if (historieAutoTimer) {
    clearTimeout(historieAutoTimer);
    historieAutoTimer = null;
  }

  const alterButton = container.querySelector(".historie-weiter-button");
  if (alterButton) alterButton.remove();

  const weiterButton = document.createElement("button");
  weiterButton.type = "button";
  weiterButton.className = "historie-weiter-button";

  const label = document.createElement("span");
  label.textContent = "Nächste Frage →";
  weiterButton.appendChild(label);

  const fortschrittsLinie = document.createElement("span");
  fortschrittsLinie.className = "historie-weiter-fortschritt";
  weiterButton.appendChild(fortschrittsLinie);

  function weiter() {
    if (historieAutoTimer) {
      clearTimeout(historieAutoTimer);
      historieAutoTimer = null;
    }
    ladeHistorieFrage(bisherigeFrageId);
  }

  weiterButton.addEventListener("click", weiter);
  container.appendChild(weiterButton);

  if (automatisch) {
    // Bei falscher Antwort etwas mehr Zeit zum Lesen der richtigen Lösung,
    // bei richtiger Antwort geht's flotter weiter. Werte am 11.07.2026 nach
    // Max' Feedback verlängert (vorher 1800ms/3200ms - ging ihm zu schnell).
    const istKorrekt = !!container.querySelector(".feedback.richtig");
    const dauerMs = istKorrekt ? 3200 : 5000;

    // Countdown-Linie: startet bei voller Breite (scaleX(1), siehe CSS) und
    // läuft in "dauerMs" linear auf 0 - der kurze Timeout davor sorgt dafür,
    // dass der Browser den Startzustand erst rendert, bevor die
    // CSS-Transition zum Zielwert losläuft (sonst würde direkt der Endwert
    // gezeichnet, ohne sichtbare Animation).
    requestAnimationFrame(() => {
      fortschrittsLinie.style.transition = "transform " + dauerMs + "ms linear";
      fortschrittsLinie.style.transform = "scaleX(0)";
    });

    historieAutoTimer = setTimeout(weiter, dauerMs);
  }
}

function baueHistorieFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage-karte frage-karte-historie";
  container.dataset.frageId = frage.frage_id;

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
    radio.name = "historie-frage-" + frage.frage_id;
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
  absendenButton.addEventListener("click", () => historieAntwortAbschicken(frage.frage_id, container, absendenButton));
  container.appendChild(absendenButton);

  const feedback = document.createElement("p");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

async function historieAntwortAbschicken(frageId, container, button) {
  const gewaehlt = container.querySelector('input[type="radio"]:checked');
  if (!gewaehlt) {
    zeigeFehler("Bitte erst eine Antwort auswählen.");
    return;
  }
  versteckeFehler();

  button.disabled = true;
  container.querySelectorAll('input[type="radio"]').forEach((r) => (r.disabled = true));

  const { data, error } = await sb.rpc("historie_antwort_abgeben", {
    p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
    p_pin: eingegebenePin,
    p_frage_id: frageId,
    p_gegebene_option: gewaehlt.value,
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
  if (ergebnis.korrekt) {
    feedback.textContent = "Richtig! ✅";
    feedback.classList.add("richtig");
  } else {
    feedback.textContent = "Leider falsch. Richtig wäre gewesen: " + ergebnis.richtige_option.toUpperCase();
    feedback.classList.add("falsch");
  }

  feedback.appendChild(document.createElement("br"));
  feedback.appendChild(baueWarumButton(frageId, true));

  historieSessionGesamt += 1;
  if (ergebnis.korrekt) historieSessionRichtig += 1;
  aktualisiereHistorieFortschrittText();
  zeigeHistorieWeiterButton(container, frageId, true);
}

function baueHistorieFreitextFrageElement(frage) {
  const container = document.createElement("div");
  container.className = "frage-karte frage-karte-freitext frage-karte-historie";
  container.dataset.frageId = frage.frage_id;

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

  if (frage.antwort_hinweis) {
    const hinweis = document.createElement("p");
    hinweis.className = "freitext-hinweis";
    hinweis.textContent = frage.antwort_hinweis;
    container.appendChild(hinweis);
  }

  const textarea = document.createElement("textarea");
  textarea.className = "freitext-eingabe";
  textarea.maxLength = FREITEXT_ZEICHENLIMIT;
  textarea.rows = 3;
  textarea.placeholder = "Deine Antwort ...";
  container.appendChild(textarea);

  const zaehler = document.createElement("div");
  zaehler.className = "freitext-zaehler";
  zaehler.textContent = "0 / " + FREITEXT_ZEICHENLIMIT;
  textarea.addEventListener("input", () => {
    zaehler.textContent = textarea.value.length + " / " + FREITEXT_ZEICHENLIMIT;
  });
  container.appendChild(zaehler);

  const absendenButton = document.createElement("button");
  absendenButton.className = "absenden-button";
  absendenButton.textContent = "Antwort abschicken";
  absendenButton.addEventListener("click", () =>
    historieFreitextAntwortAbschicken(frage.frage_id, container, absendenButton, textarea)
  );
  container.appendChild(absendenButton);

  const ladeHinweis = document.createElement("p");
  ladeHinweis.className = "freitext-lade-hinweis";
  ladeHinweis.hidden = true;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  ladeHinweis.appendChild(spinner);
  ladeHinweis.append(" Einen Moment, deine Antwort wird geprüft ...");
  container.appendChild(ladeHinweis);

  const feedback = document.createElement("div");
  feedback.className = "feedback";
  feedback.hidden = true;
  container.appendChild(feedback);

  return container;
}

async function historieFreitextAntwortAbschicken(frageId, container, button, textarea) {
  const freitext = textarea.value.trim();
  if (freitext.length === 0) {
    zeigeFehler("Bitte erst eine Antwort eingeben.");
    return;
  }
  versteckeFehler();

  button.disabled = true;
  textarea.disabled = true;

  const ladeHinweis = container.querySelector(".freitext-lade-hinweis");
  if (ladeHinweis) ladeHinweis.hidden = false;

  let ergebnis;
  try {
    const antwort = await fetch("/api/freitext-bewerten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schiedsrichterId: ausgewaehlteSchiedsrichterId,
        frageId,
        pin: eingegebenePin,
        freitext,
        historie: true,
      }),
    });
    ergebnis = await antwort.json();
    if (!antwort.ok) throw new Error(ergebnis.fehler || "Unbekannter Fehler");
  } catch (e) {
    if (ladeHinweis) ladeHinweis.hidden = true;
    const feedback = container.querySelector(".feedback");
    feedback.hidden = false;
    feedback.textContent = "Fehler bei der Auswertung: " + e.message + " - bitte nochmal versuchen.";
    feedback.classList.add("falsch");
    button.disabled = false;
    textarea.disabled = false;
    return;
  }

  if (ladeHinweis) ladeHinweis.hidden = true;

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;
  feedback.innerHTML = "";
  feedback.classList.add(ergebnis.korrekt ? "richtig" : "falsch");
  feedback.appendChild(baueFreitextErgebnisInhalt(ergebnis));
  feedback.appendChild(baueWarumButton(frageId, true));

  historieSessionGesamt += 1;
  if (ergebnis.korrekt) historieSessionRichtig += 1;
  aktualisiereHistorieFortschrittText();
  // Bewusst OHNE automatisches Weiterschalten (anders als bei Multiple
  // Choice) - das KI-Feedback braucht Lesezeit, die sich nicht sinnvoll
  // pauschal timen lässt.
  zeigeHistorieWeiterButton(container, frageId, false);
}

async function start() {
  await ladeSchiedsrichter();

  const gespeichert = leseGespeicherteSession();
  if (gespeichert && gespeichert.id && gespeichert.pin) {
    ausgewaehlteSchiedsrichterId = gespeichert.id;
    eingegebenePin = gespeichert.pin;
    zeigeAngemeldetenZustand(gespeichert.name || "");
    await ladeFragenUndAntworten();
    return;
  }

  // Vereinskennung (13.07.2026, Baustein A): eine schon einmal bestätigte
  // Kennung wird gemerkt, damit man nicht bei jedem Neuladen erneut tippen
  // muss - wird aber sicherheitshalber erneut serverseitig geprüft (falls
  // sie sich zwischenzeitlich geändert hat), nicht blind übernommen.
  const gespeicherteKennung = leseGespeicherteKennung();
  if (gespeicherteKennung) {
    kennungEingabe.value = gespeicherteKennung;
    await pruefeVereinskennung(gespeicherteKennung, { ausSession: true });
  }
}

start();
