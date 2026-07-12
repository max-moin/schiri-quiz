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

  function baueUndZeigePlatzhalter() {
    wrap.innerHTML = "";

    const platzhalter = document.createElement("button");
    platzhalter.type = "button";
    platzhalter.className = "video-platzhalter";

    const icon = document.createElement("span");
    icon.className = "video-platzhalter-icon";
    icon.textContent = "▶";
    platzhalter.appendChild(icon);

    const text = document.createElement("span");
    text.className = "video-platzhalter-text";
    text.textContent = "Video laden und ansehen";
    platzhalter.appendChild(text);

    const hinweis = document.createElement("span");
    hinweis.className = "video-platzhalter-hinweis";
    hinweis.textContent = stumm
      ? "Lädt erst nach Klick von YouTube - ohne Ton, damit kein Kommentator die Antwort verrät."
      : "Lädt erst nach Klick von YouTube - vorher kein Kontakt zu YouTube.";
    platzhalter.appendChild(hinweis);

    platzhalter.addEventListener("click", () => {
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

              // Nachbesserung Runde 3 (12.07.2026, Max' drittes Live-Test-
              // Feedback): Untertitel sollen IMMER aus bleiben. "cc_load_policy: 0"
              // oben verhindert nur, dass Untertitel automatisch nach
              // Zuschauer-Voreinstellung eingeschaltet werden - reicht laut
              // Max' Beobachtung in der Praxis nicht zuverlässig aus. Das
              // komplette Entladen des Untertitel-Moduls über die (offiziell
              // nicht dokumentierte, aber weithin genutzte) Player-API-Methode
              // "unloadModule" ist der zuverlässige Weg, Untertitel für diesen
              // Player-Aufruf komplett zu unterbinden statt nur "nicht
              // standardmäßig einzuschalten".
              if (typeof spieler.unloadModule === "function") {
                spieler.unloadModule("captions");
              }
            },
            onStateChange: (ereignis) => {
              if (ereignis.data === YT.PlayerState.ENDED) {
                beendeVideo();
                return;
              }
              if (ereignis.data === YT.PlayerState.PLAYING) {
                abspielButton.textContent = "⏸";
                abspielButton.setAttribute("aria-label", "Pause");
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
  }
}

start();
