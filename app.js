// ============================================================
// Schiri-Quiz - Frontend-Logik
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const {
  formatiereAnfrageDatum,
  freitextStatus,
  schwierigkeitSterne,
} = SchiriQuizUtils;
const { erstelleSessionSpeicher } = SchiriQuizSessionStore;
const { baueVideoEinbettungModal } = SchiriQuizVideoPlayer;
const {
  initialisiereMaskierteFelder,
  verbindeSichtbarkeit,
  verdecke,
} = SchiriQuizMaskedInputs;
const { baueVorlesenButton, stoppeVorlesen } = SchiriQuizTextToSpeech;
const { erstelleErklaerungsDialog } = SchiriQuizExplanationDialog;
const { initialisiereKopfmenue } = SchiriQuizHeaderMenu;
const { erstelleGastmodus } = SchiriQuizGuestMode;

const SESSION_KEY = "schiriQuizSession";
const KENNUNG_SESSION_KEY = "schiriQuizVereinskennung";
const mitgliedSession = erstelleSessionSpeicher(SESSION_KEY);
const kennungSession = erstelleSessionSpeicher(KENNUNG_SESSION_KEY, {
  altesRohformatLesen: true,
});

const nameAuswahl = document.getElementById("name-auswahl");
const nameEingabe = document.getElementById("name-eingabe");
const namenslisteBereich = document.getElementById("namensliste-bereich");
const namenseingabeBereich = document.getElementById("namenseingabe-bereich");
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
const fortschrittTrack = fortschrittFill ? fortschrittFill.parentElement : null;
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
let loginModus = "kennung"; // "kennung" | "mitglied" | "gast"
// Mehr-Vereine-Umbau (11.08.2026): welcher Verein gerade bestätigt ist und
// ob er eine Namensliste herausgibt. Beides kommt ausschließlich vom Server
// (RPC "verein_zugang"); der Browser rät hier nichts.
let aktuelleKennung = null;
let vereinZeigtNamensliste = true;

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

initialisiereMaskierteFelder();
verbindeSichtbarkeit(kennungEingabe, kennungAugeButton, {
  anzeigenText: "Vereinskennung anzeigen",
  verbergenText: "Vereinskennung verbergen",
});

const erklaerungsDialog = erstelleErklaerungsDialog({
  getZugang: () => ({
    schiedsrichterId: ausgewaehlteSchiedsrichterId,
    pin: eingegebenePin,
  }),
  vorHistorieErklaerung: () => {
    if (!historieAutoTimer) return;
    clearTimeout(historieAutoTimer);
    historieAutoTimer = null;
  },
});
const { baueWarumButton } = erklaerungsDialog;

const gastController = erstelleGastmodus({
  sb,
  zeigeFehler,
  versteckeFehler,
  loeseOptionenAuf,
  beiVerlassen: () => {
    const gemerkteKennung = kennungSession.lesen();
    if (gemerkteKennung) {
      void pruefeVereinskennung(gemerkteKennung, { ausSession: true });
    } else {
      zeigeKennungBereich();
    }
  },
});

function zeigeFehler(text) {
  fehlerHinweis.textContent = text;
  fehlerHinweis.hidden = false;
}

function versteckeFehler() {
  fehlerHinweis.hidden = true;
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

// Lädt die Namensliste des Vereins zur bestätigten Kennung.
//
// Vorher las diese Funktion die View "schiedsrichter_oeffentlich" direkt.
// Die kannte keinen Verein und gab die Namen ALLER Schiedsrichter heraus -
// auch ohne jede Kennung. Jetzt entscheidet der Server anhand der Kennung,
// ob und welche Namen herausgehen; bei Vereinen ohne Liste kommt bewusst
// eine leere Antwort zurück.
async function ladeSchiedsrichter(kennung) {
  nameAuswahl.length = 1; // alles außer "– bitte auswählen –" verwerfen

  if (!kennung) return;

  const { data, error } = await sb.rpc("schiri_liste", { p_kennung: kennung });

  if (error) {
    zeigeFehler("Namensliste konnte nicht geladen werden: " + error.message);
    return;
  }

  for (const person of data || []) {
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
    startButton.disabled = !gastController.istStartbereit();
  } else if (loginModus === "mitglied") {
    // Je nach Verein zählt entweder die Auswahlliste oder das Namensfeld.
    const nameDa = vereinZeigtNamensliste
      ? !!nameAuswahl.value
      : nameEingabe.value.trim().length > 0;
    startButton.disabled = !(nameDa && pinEingabe.value.trim().length > 0);
  } else {
    startButton.disabled = true;
  }
}

nameAuswahl.addEventListener("change", pruefeEingabenVollstaendig);
if (nameEingabe) nameEingabe.addEventListener("input", pruefeEingabenVollstaendig);
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

  // Liste oder Eingabefeld - richtet sich nach dem Verein (siehe
  // "vereinZeigtNamensliste", gesetzt aus der Serverantwort).
  if (namenslisteBereich && namenseingabeBereich) {
    namenslisteBereich.hidden = !vereinZeigtNamensliste;
    namenseingabeBereich.hidden = vereinZeigtNamensliste;
  }

  pruefeEingabenVollstaendig();
  if (!vereinZeigtNamensliste && nameEingabe) nameEingabe.focus();
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
  verdecke(kennungEingabe);
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
  verdecke(kennungEingabe);

  kennungHinweis.hidden = true;
  kennungHinweis.classList.remove("hinweis-fehler", "hinweis-erfolg");
  kennungWeiterButton.disabled = true;

  // Seit dem Mehr-Vereine-Umbau (11.08.2026) reicht ein Ja/Nein nicht mehr:
  // "verein_zugang" sagt zusätzlich, wie der Verein heißt und ob er eine
  // Namensliste herausgibt.
  const { data: zugangDaten, error } = await sb.rpc("verein_zugang", { p_kennung: kennung });

  kennungWeiterButton.disabled = false;

  if (error) {
    kennungHinweis.textContent = "Kennung konnte nicht geprüft werden: " + error.message;
    kennungHinweis.classList.add("hinweis-fehler");
    kennungHinweis.hidden = false;
    return;
  }

  const zugang = Array.isArray(zugangDaten) ? zugangDaten[0] : zugangDaten;
  const istOk = !!(zugang && zugang.gefunden);

  if (!istOk) {
    if (ausSession) {
      // Eine gespeicherte Kennung, die jetzt nicht mehr gültig ist (z.B.
      // zwischenzeitlich geändert) - Session verwerfen, normal von vorn
      // starten, kein Fehler-Hinweis nötig (Person hat ja nichts falsch
      // gemacht).
      kennungSession.loeschen();
      return;
    }
    kennungHinweis.textContent = "Diese Vereinskennung ist uns nicht bekannt.";
    kennungHinweis.classList.add("hinweis-fehler");
    kennungHinweis.hidden = false;
    kennungEingabe.value = "";
    kennungEingabe.focus();
    return;
  }

  aktuelleKennung = kennung;
  vereinZeigtNamensliste = zugang.namensliste_anzeigen !== false;

  kennungSession.speichern(kennung);
  kennungHinweis.textContent = zugang.verein_name
    ? "✓ " + zugang.verein_name
    : "✓ Vereinskennung bestätigt";
  kennungHinweis.classList.add("hinweis-erfolg");
  kennungHinweis.hidden = false;

  // Die Namensliste wird erst JETZT geladen - vorher ist gar nicht bekannt,
  // zu welchem Verein sie gehören würde. Bei Vereinen ohne Liste holt die
  // Funktion nichts und der Block bleibt ohnehin verborgen.
  if (vereinZeigtNamensliste) {
    await ladeSchiedsrichter(kennung);
  }

  zeigeMitgliedBereich();
}

kennungWeiterButton.addEventListener("click", () => pruefeVereinskennung(kennungEingabe.value));
kennungEingabe.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    pruefeVereinskennung(kennungEingabe.value);
  }
});

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
    await gastController.starte();
    return;
  }

  versteckeFehler();

  // Ein Weg für beide Vereinsarten (11.08.2026): Der Name kommt entweder
  // aus der Auswahlliste oder aus dem Eingabefeld, geprüft wird beides über
  // dieselbe RPC "schiri_anmelden". Die liefert bei falscher Kennung,
  // falschem Namen, falscher PIN und gesperrtem Zugang bewusst DIESELBE
  // Fehlermeldung - sonst könnte man durch Ausprobieren herausfinden,
  // welche Namen es in einem Verein überhaupt gibt.
  const name = vereinZeigtNamensliste
    ? (nameAuswahl.selectedIndex > 0
        ? nameAuswahl.options[nameAuswahl.selectedIndex].textContent
        : "")
    : nameEingabe.value.trim();
  const pin = pinEingabe.value.trim();
  const kennung = aktuelleKennung || kennungSession.lesen();

  if (!name || !pin || !kennung) return;

  startButton.disabled = true;
  const buttonText = startButton.querySelector("span");
  const vorherigerText = buttonText ? buttonText.textContent : null;
  if (buttonText) buttonText.textContent = "Prüfe PIN ...";

  const { data: anmeldung, error } = await sb.rpc("schiri_anmelden", {
    p_kennung: kennung,
    p_name: name,
    p_pin: pin,
  });

  if (buttonText && vorherigerText) buttonText.textContent = vorherigerText;

  const treffer = Array.isArray(anmeldung) ? anmeldung[0] : anmeldung;

  if (error || !treffer) {
    zeigeFehler(
      vereinZeigtNamensliste
        ? "PIN ist falsch. Bitte nochmal versuchen."
        : "Name oder PIN stimmt nicht. Bitte nochmal versuchen."
    );
    startButton.disabled = false;
    pinEingabe.value = "";
    pinEingabe.focus();
    return;
  }

  ausgewaehlteSchiedsrichterId = treffer.schiedsrichter_id;
  eingegebenePin = pin;

  // Den vom Server zurückgegebenen Namen verwenden, nicht den getippten -
  // sonst stünde bei abweichender Groß-/Kleinschreibung die Eingabe in der
  // Begrüßung statt der tatsächlich hinterlegte Name.
  const echterName = treffer.name || name;
  mitgliedSession.speichern({ id: treffer.schiedsrichter_id, pin, name: echterName });
  zeigeAngemeldetenZustand(echterName);

  await ladeFragenUndAntworten();
});

wechselnButton.addEventListener("click", () => {
  mitgliedSession.loeschen();
  location.reload();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
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
    // Früher die View "fragen_oeffentlich". Die kannte nur eine einzige
    // Wochenzuordnung für alle. Seit dem Mehr-Vereine-Umbau entscheidet der
    // Server anhand des angemeldeten Schiedsrichters, welche Woche gilt -
    // die Sortierung nach Fragennummer kommt gleich mit.
    sb.rpc("wochen_fragen", {
      p_schiedsrichter_id: ausgewaehlteSchiedsrichterId,
      p_pin: eingegebenePin,
    }),
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

  for (const [index, frage] of fragen.entries()) {
    // Feste Anzeigenummer je Frage (07.08.2026, Max' Wunsch "jede Frage
    // bekommt so eine eigene Rangnummer ... F1 ist überall die gleiche
    // Frage"). Sie ergibt sich aus der Reihenfolge, in der die Datenbank
    // die Fragen liefert - und die ist nach der Spalte "position" sortiert,
    // also derselben Reihenfolge wie im Planung-Reiter der App.
    // Seit Migration v75 (11.08.2026) kommt die Nummer fertig vom Server
    // (View "wochen_frage_nummern"), statt hier aus der Listenposition
    // abgeleitet zu werden. Vorher stimmte sie nur zufällig, solange alle
    // Ansichten dieselbe Sortierung hatten - was in der App nicht der Fall
    // war. Der Rückfall auf "Index + 1" bleibt für den Fall, dass die
    // Website noch gegen eine ältere Datenbankversion läuft.
    frage.anzeigeNummer = frage.frage_nummer ?? index + 1;
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

/// Anzeigename und Farbklasse je Fragetyp (07.08.2026, Max' Wunsch:
/// "vielleicht sieht man da dann auch deutlicher, dass eine Frage Video oder
/// Freitext ist, vielleicht mit Farben"). Bewusst mit Symbol UND Text, damit
/// der Typ nicht allein über die Farbe erkennbar ist.
const FRAGETYP_BADGE = {
  multiple_choice: null, // Standardfall - kein Badge, sonst steht es überall
  freitext: { text: "✍️ Freitext", klasse: "typ-freitext" },
  video_mc: { text: "▶ Video", klasse: "typ-video" },
  video_freitext: { text: "▶ Video + Freitext", klasse: "typ-video" },
};

function baueBadges(frage) {
  const wrap = document.createElement("div");
  wrap.className = "frage-badges";

  // Nummer ganz vorn, damit man sie beim Besprechen im Team nennen kann
  // ("bei F3 war ich unsicher").
  if (frage.anzeigeNummer) {
    const nummerBadge = document.createElement("span");
    nummerBadge.className = "badge frage-nummer";
    nummerBadge.textContent = "F" + frage.anzeigeNummer;
    wrap.appendChild(nummerBadge);
  }

  // Fragetyp danach - die Information, die beim Überfliegen am meisten
  // hilft ("muss ich hier ein Video ansehen oder etwas schreiben?").
  const typInfo = FRAGETYP_BADGE[frage.typ];
  if (typInfo) {
    const typBadge = document.createElement("span");
    typBadge.className = "badge " + typInfo.klasse;
    typBadge.textContent = typInfo.text;
    wrap.appendChild(typBadge);
  }

  if (frage.regel_nummer && frage.regel_bezeichnung) {
    const regelBadge = document.createElement("span");
    regelBadge.className = "badge regel";
    const regelSymbol = document.createElement("span");
    regelSymbol.className = "badge-symbol";
    regelSymbol.setAttribute("aria-hidden", "true");
    regelSymbol.textContent = "§";
    regelBadge.append(
      regelSymbol,
      document.createTextNode("Regel " + frage.regel_nummer + " · " + frage.regel_bezeichnung)
    );
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

// Der gemeinsame Modal-first-Player für alle Videofragen liegt gekapselt in
// src/video-player.js. app.js entscheidet nur noch, an welcher Frage er mit
// welchen Zeit- und Fallbackdaten eingebunden wird.
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

  const video = baueVideoEinbettungModal(
    frage.video_url,
    frage.video_start_sekunden,
    frage.video_end_sekunden,
    frage.video_stumm,
    frage.antwort_hinweis
  );
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
  // "aria-live" sorgt dafür, dass Screenreader die Auflösung ("Richtig!"/
  // "Leider falsch...") automatisch vorlesen, sobald sie erscheint - ohne
  // das bliebe sie für blinde Nutzer unbemerkt (07.08.2026, WCAG 4.1.3).
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
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

  // Das frühere "🔒 Bereits beantwortet"-Etikett ist entfallen (07.08.2026,
  // Max: "das würde ich vielleicht sogar rausnehmen"). Der Zustand ist jetzt
  // am Aussehen der Karte erkennbar - grauer Hintergrund, kein Schatten,
  // blasse Antwortzeilen (siehe ".frage-karte.beantwortet" in style.css).
  // Eine Textzeile, die dasselbe nochmal sagt, kostet nur Platz.

  const titel = document.createElement("div");
  titel.className = "frage-text";
  titel.textContent = frage.frage_text;

  const titelZeile = document.createElement("div");
  titelZeile.className = "frage-text-zeile";
  titelZeile.appendChild(titel);
  const vorlesenButton = baueVorlesenButton(frage.frage_text);
  if (vorlesenButton) titelZeile.appendChild(vorlesenButton);
  container.appendChild(titelZeile);

  const video = baueVideoEinbettungModal(
    frage.video_url,
    frage.video_start_sekunden,
    frage.video_end_sekunden,
    frage.video_stumm,
    frage.antwort_hinweis
  );
  if (video) container.appendChild(video);

  const optionTexte = { a: frage.option_a, b: frage.option_b, c: frage.option_c };

  // Auflösung bei bereits beantworteten Fragen (07.08.2026, überarbeitet):
  // vorher stand hier ein einzelner Fließtext-Satz ("Damals geantwortet: X ·
  // Richtig gewesen wäre: Y"). Jetzt dieselbe farbige Darstellung wie direkt
  // nach dem Abschicken - grün für richtig, rot für die eigene falsche
  // Antwort -, damit man beim Zurückblättern nicht erst lesen muss, um zu
  // erkennen, wie es ausgegangen ist. Die Zeichen ✓/✗ tragen dieselbe
  // Information nochmal ohne Farbe (Farbfehlsichtigkeit).
  const aufloesung = document.createElement("div");
  aufloesung.className = "option-liste beantwortet-aufloesung";

  ["a", "b", "c"].forEach((schluessel) => {
    const text = optionTexte[schluessel];
    if (!text) return;

    const zeile = document.createElement("div");
    zeile.className = "option gesperrt";

    const istRichtige = antwort.richtige_option
      ? schluessel === String(antwort.richtige_option).toLowerCase()
      : antwort.korrekt && schluessel === String(antwort.gegebene_option).toLowerCase();
    const istGewaehlte = schluessel === String(antwort.gegebene_option).toLowerCase();

    zeile.append(text);

    if (istRichtige) {
      zeile.classList.add("ist-richtig");
      zeile.appendChild(marke("\u2713", istGewaehlte ? "Deine Antwort - richtig" : "Richtige Antwort"));
    } else if (istGewaehlte) {
      zeile.classList.add("ist-falsch");
      zeile.appendChild(marke("\u2717", "Deine Antwort - falsch"));
    }

    aufloesung.appendChild(zeile);
  });

  container.appendChild(aufloesung);

  function marke(zeichen, beschreibung) {
    const span = document.createElement("span");
    span.className = "option-marke";
    span.textContent = zeichen;
    span.setAttribute("aria-label", beschreibung);
    span.title = beschreibung;
    return span;
  }
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

  const video = baueVideoEinbettungModal(
    frage.video_url,
    frage.video_start_sekunden,
    frage.video_end_sekunden,
    frage.video_stumm,
    frage.antwort_hinweis
  );
  if (video) container.appendChild(video);

  if (frage.antwort_hinweis && !frage.video_url) {
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
// Aus dem früheren Booleanpaar (korrekt + teilweise) ist ein Status
// geworden. Diese Funktion liest ihn aus allem, was ankommen kann: der
// Antwort des Endpunkts (status), der Zeile aus meine_antworten
// (bewertungsstatus / nachbesserung_offen) und - als letzte Rückfallebene -
// den alten Feldern. So macht eine noch nicht neu geladene Seite nichts
// kaputt.
function baueFreitextErgebnisInhalt(ergebnis) {
  const wrap = document.createElement("div");
  const status = freitextStatus(ergebnis);

  // Drei Stufen statt zwei (07.08.2026, Max' Wunsch): wer den Grundgedanken
  // richtig hatte und nur ein gefordertes Element vergessen hat, bekommt eine
  // orange "fast"-Rückmeldung statt derselben roten Ablehnung wie jemand, der
  // inhaltlich danebenlag ("das verwirrt ja auch, wenn man den Grundgedanken
  // eigentlich schon verstanden hat"). Gewertet wird eine Teilantwort
  // weiterhin als nicht bestanden - die Stufe ist reine Rückmeldung.
  const kopf = document.createElement("p");
  kopf.className = "freitext-ergebnis-kopf";
  if (status === "richtig") {
    kopf.textContent = "Antwort korrekt ✅";
  } else if (status === "nachbessern") {
    kopf.textContent = "Fast! Da fehlt noch ein Punkt 🟠";
    kopf.classList.add("teilweise");
  } else {
    kopf.textContent = "Antwort nicht korrekt";
  }
  wrap.appendChild(kopf);

  // Solange eine Ergänzung offen ist, wird die Lösung NICHT gezeigt - sonst
  // wäre die Nachfrage sinnlos. Der Server liefert sie in dem Fall ohnehin
  // gar nicht erst mit; die Bedingung hier ist die zweite Sicherung.
  if (status !== "nachbessern" && ergebnis.musterantwort) {
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

// ============================================================
// Zweiter Versuch bei orange (11.08.2026)
//
// Wer den Kern getroffen, aber einen zwingenden Punkt vergessen hat, bekommt
// GENAU EINE Ergänzung. Die Lösung wird dabei bewusst nicht gezeigt - nur
// eine gezielte Rückfrage, die zum fehlenden Punkt hinführt.
//
// Wichtig für die Erwartung: eine offene Ergänzung zählt in der Auswertung
// bereits als beantwortet. Wer sie liegen lässt, hat die Frage falsch. Das
// steht deshalb ausdrücklich auf der Karte und wird nicht weggelächelt.
// ============================================================
function baueErgaenzungsBereich(frageId, nachfrage) {
  const wrap = document.createElement("div");
  wrap.className = "freitext-ergaenzung";

  const frageZeile = document.createElement("p");
  frageZeile.className = "freitext-nachfrage";
  frageZeile.textContent = nachfrage || "Begründe bitte noch kurz, warum du so entscheidest.";
  wrap.appendChild(frageZeile);

  const hinweis = document.createElement("p");
  hinweis.className = "freitext-ergaenzung-hinweis";
  hinweis.textContent =
    "Du hast genau eine Ergänzung. Schickst du sie nicht ab, bleibt die Frage als falsch stehen.";
  wrap.appendChild(hinweis);

  const textarea = document.createElement("textarea");
  textarea.className = "freitext-eingabe";
  textarea.maxLength = FREITEXT_ZEICHENLIMIT;
  textarea.rows = 3;
  textarea.placeholder = "Deine Ergänzung ...";
  wrap.appendChild(textarea);

  const zaehler = document.createElement("div");
  zaehler.className = "freitext-zaehler";
  zaehler.textContent = "0 / " + FREITEXT_ZEICHENLIMIT;
  textarea.addEventListener("input", () => {
    zaehler.textContent = textarea.value.length + " / " + FREITEXT_ZEICHENLIMIT;
  });
  wrap.appendChild(zaehler);

  const button = document.createElement("button");
  button.className = "absenden-button";
  button.textContent = "Antwort ergänzen";
  button.addEventListener("click", () => freitextErgaenzungAbschicken(frageId, wrap, button, textarea));
  wrap.appendChild(button);

  const ladeHinweis = document.createElement("p");
  ladeHinweis.className = "freitext-lade-hinweis";
  ladeHinweis.hidden = true;
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  ladeHinweis.appendChild(spinner);
  ladeHinweis.append(" Einen Moment, deine Ergänzung wird geprüft ...");
  wrap.appendChild(ladeHinweis);

  return wrap;
}

async function freitextErgaenzungAbschicken(frageId, wrap, button, textarea) {
  const ergaenzung = textarea.value.trim();
  if (ergaenzung.length === 0) {
    zeigeFehler("Bitte erst eine Ergänzung eingeben.");
    return;
  }
  versteckeFehler();

  button.disabled = true;
  textarea.disabled = true;
  const ladeHinweis = wrap.querySelector(".freitext-lade-hinweis");
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
        freitext: ergaenzung,
        modus: "nachbesserung",
      }),
    });
    ergebnis = await antwort.json();
    if (!antwort.ok) throw new Error(ergebnis.fehler || "Unbekannter Fehler");
  } catch (e) {
    if (ladeHinweis) ladeHinweis.hidden = true;
    // Sonderfall: Die Ergänzung wurde gespeichert, aber die Antwort kam nicht
    // mehr an (Verbindungsabbruch). Ein erneuter Klick liefert dann immer
    // dieselbe Absage. Statt die Person in dieser Schleife zu lassen, hier
    // klar sagen, was zu tun ist.
    const schonGespeichert = /keine Ergänzung mehr offen/i.test(e.message || "");
    zeigeFehler(
      schonGespeichert
        ? "Deine Ergänzung ist schon angekommen. Lade die Seite neu, dann siehst du das Ergebnis."
        : "Ergänzung konnte nicht geprüft werden: " + e.message + " - bitte nochmal versuchen."
    );
    if (!schonGespeichert) {
      button.disabled = false;
      textarea.disabled = false;
    }
    return;
  }

  const status = freitextStatus(ergebnis);
  const karte = wrap.closest(".frage-karte");

  // Der Ergänzungsblock wird durch das Endergebnis ersetzt. Die eigene
  // Ergänzung bleibt dabei sichtbar - die Person soll nachvollziehen können,
  // worauf sich die Bewertung bezieht.
  wrap.innerHTML = "";
  wrap.classList.add("abgeschlossen");

  const eigene = document.createElement("p");
  eigene.className = "freitext-eigene-antwort";
  eigene.textContent = "Deine Ergänzung: " + ergaenzung;
  wrap.appendChild(eigene);

  const ergebnisWrap = document.createElement("div");
  ergebnisWrap.className = "beantwortet-ergebnis " + (status === "richtig" ? "richtig" : "falsch");
  ergebnisWrap.appendChild(baueFreitextErgebnisInhalt(ergebnis));
  wrap.appendChild(ergebnisWrap);
  wrap.appendChild(baueWarumButton(frageId, false));

  if (karte) {
    karte.classList.remove("teilweise-karte");
    karte.classList.add("beantwortet", status === "richtig" ? "richtig-karte" : "falsch-karte");

    const tag = karte.querySelector(".beantwortet-tag");
    if (tag) {
      tag.classList.remove("teilweise");
      tag.textContent = "🔒 Bereits beantwortet";
    }

    // Der orange Zwischenstand von vorhin muss weg - sonst stünde direkt
    // über dem Endergebnis weiterhin "Fast! Da fehlt noch ein Punkt" und
    // darunter der feste Zwischensatz "Der Kern stimmt - ein Punkt fehlt
    // noch.", was einem roten Endergebnis offen widerspricht.
    karte.querySelectorAll(".beantwortet-ergebnis.teilweise, .feedback.teilweise").forEach((alt) => {
      if (alt === wrap || wrap.contains(alt)) return;
      alt.classList.remove("teilweise");
      alt.querySelectorAll(".freitext-ergebnis-kopf, .freitext-ergebnis-ki").forEach((zeile) => zeile.remove());
    });
  }
}

function baueBeantworteteFreitextElement(frage, antwort) {
  const status = freitextStatus(antwort);
  const wartetAufErgaenzung = status === "nachbessern";

  const container = document.createElement("div");
  container.className =
    "frage-karte beantwortet frage-karte-freitext " +
    (wartetAufErgaenzung ? "teilweise-karte" : status === "richtig" ? "richtig-karte" : "falsch-karte");
  container.dataset.frageId = frage.id;

  const badges = baueBadges(frage);
  if (badges) container.appendChild(badges);

  const tag = document.createElement("div");
  tag.className = wartetAufErgaenzung ? "beantwortet-tag teilweise" : "beantwortet-tag";
  tag.textContent = wartetAufErgaenzung ? "🟠 Wartet auf deine Ergänzung" : "🔒 Bereits beantwortet";
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

  const video = baueVideoEinbettungModal(
    frage.video_url,
    frage.video_start_sekunden,
    frage.video_end_sekunden,
    frage.video_stumm,
    frage.antwort_hinweis
  );
  if (video) container.appendChild(video);

  const deineAntwort = document.createElement("p");
  deineAntwort.className = "freitext-eigene-antwort";
  deineAntwort.textContent = "Deine Antwort: " + (antwort.gegebener_freitext || "");
  container.appendChild(deineAntwort);

  // Beim abgeschlossenen zweiten Versuch stehen beide Texte in der Reihenfolge
  // da, in der sie entstanden sind - erst die Antwort, dann die Ergänzung,
  // dann das Ergebnis, das sich auf beides zusammen bezieht.
  if (!wartetAufErgaenzung && antwort.zweiter_freitext) {
    const ergaenzung = document.createElement("p");
    ergaenzung.className = "freitext-eigene-antwort";
    ergaenzung.textContent = "Deine Ergänzung: " + antwort.zweiter_freitext;
    container.appendChild(ergaenzung);
  }

  const ergebnisWrap = document.createElement("div");
  ergebnisWrap.className =
    "beantwortet-ergebnis " + (status === "richtig" ? "richtig" : wartetAufErgaenzung ? "teilweise" : "falsch");
  ergebnisWrap.appendChild(baueFreitextErgebnisInhalt(antwort));
  container.appendChild(ergebnisWrap);

  if (wartetAufErgaenzung) {
    // Nach einem Neuladen steht der orange Zustand vollständig wieder da:
    // erste Antwort, gespeicherte Rückfrage, leeres Ergänzungsfeld.
    container.appendChild(baueErgaenzungsBereich(frage.id, antwort.ki_nachfrage));
    return container;
  }

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

  const status = freitextStatus(ergebnis);
  const wartetAufErgaenzung = status === "nachbessern";

  const feedback = container.querySelector(".feedback");
  feedback.hidden = false;
  feedback.innerHTML = "";
  feedback.classList.add(status === "richtig" ? "richtig" : wartetAufErgaenzung ? "teilweise" : "falsch");

  if (ergebnis.bereits_beantwortet) {
    const hinweisZeile = document.createElement("p");
    hinweisZeile.className = "freitext-ergebnis-hinweis";
    hinweisZeile.textContent = "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt:";
    feedback.appendChild(hinweisZeile);
  }
  feedback.appendChild(baueFreitextErgebnisInhalt(ergebnis));

  if (wartetAufErgaenzung) {
    // Kein "Warum?"-Button, solange die Ergänzung offen ist - der würde die
    // Auflösung liefern, nach der hier gerade gefragt wird.
    container.classList.add("teilweise-karte");
    feedback.appendChild(baueErgaenzungsBereich(frageId, ergebnis.ki_nachfrage));
  } else {
    feedback.appendChild(baueWarumButton(frageId, false));
  }

  // Auch eine offene Ergänzung zählt als beantwortet. Das ist bewusst so:
  // In der Auswertung ist die Frage damit erledigt, und wer nicht ergänzt,
  // hat sie falsch. Der Hinweistext auf der Karte sagt das auch so.
  beantworteFragenAnzahl += 1;
  aktualisiereFortschritt();
  aktualisiereSammelButtonSichtbarkeit();

  if (beantworteFragenAnzahl >= gesamtFragenAnzahl) {
    fertigHinweis.hidden = false;
    historieStartButton.hidden = false;
    zeigeNaechsteRundeCountdown();
  }
}


// ============================================================
// Auflösung der Antwortmöglichkeiten einfärben (07.08.2026, Max' Wunsch)
//
// Nach dem Abschicken soll auf einen Blick erkennbar sein, was richtig war
// und was man selbst gewählt hat - vorher blieb alles einfarbig und die
// gesperrten Felder wirkten durch den Hover-Effekt weiterhin anklickbar
// ("die sind trotzdem wieso getoggeld, das ist halt dumm").
//
// Farblogik (siehe auch style.css):
//   grün = richtige Antwort · rot = eigene Antwort, falls falsch
//   blau (".ausgewaehlt") wird hier entfernt, weil die Auswahl jetzt
//   aufgelöst ist und blau sonst mit grün/rot konkurrieren würde.
//
// Zusätzlich bekommt jede aufgelöste Zeile ein Zeichen (✓ / ✗) - die
// Auflösung darf nicht ausschließlich über Farbe transportiert werden,
// sonst ist sie für farbfehlsichtige Nutzer nicht erkennbar (WCAG 1.4.1).
// ============================================================
function loeseOptionenAuf(container, richtigeOption, gewaehlteOption) {
  const optionen = container.querySelectorAll(".option");
  optionen.forEach((label) => {
    const radio = label.querySelector('input[type="radio"]');
    if (!radio) return;

    // Sperren: Radio deaktivieren UND die Karte als gesperrt markieren,
    // damit der Hover-Effekt aus dem CSS nicht mehr greift.
    radio.disabled = true;
    label.classList.add("gesperrt");
    label.classList.remove("ausgewaehlt");

    // Doppelte Marken vermeiden, falls diese Funktion zweimal läuft.
    const alteMarke = label.querySelector(".option-marke");
    if (alteMarke) alteMarke.remove();

    const istRichtige = richtigeOption && radio.value === richtigeOption.toLowerCase();
    const istGewaehlte = gewaehlteOption && radio.value === gewaehlteOption.toLowerCase();

    if (istRichtige) {
      label.classList.add("ist-richtig");
      label.appendChild(marke("\u2713", istGewaehlte ? "Deine Antwort - richtig" : "Richtige Antwort"));
    } else if (istGewaehlte) {
      label.classList.add("ist-falsch");
      label.appendChild(marke("\u2717", "Deine Antwort - falsch"));
    }
  });

  function marke(zeichen, beschreibung) {
    const span = document.createElement("span");
    span.className = "option-marke";
    span.textContent = zeichen;
    span.setAttribute("aria-label", beschreibung);
    span.title = beschreibung;
    return span;
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

  // Farbige Auflösung direkt in den Antwortmöglichkeiten (07.08.2026).
  loeseOptionenAuf(container, ergebnis.richtige_option, gewaehlt.value);
  container.classList.add("beantwortet", ergebnis.korrekt ? "richtig-karte" : "falsch-karte");

  if (ergebnis.bereits_beantwortet) {
    feedback.textContent =
      "Diese Frage hattest du schon beantwortet - dein erstes Ergebnis zählt: " +
      (ergebnis.korrekt ? "Richtig ✅" : "Falsch (richtig wäre " + ergebnis.richtige_option.toUpperCase() + " gewesen)");
    feedback.classList.add(ergebnis.korrekt ? "richtig" : (ergebnis.teilweise ? "teilweise" : "falsch"));
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
  if (fortschrittTrack) {
    fortschrittTrack.setAttribute("aria-valuenow", String(prozent));
    fortschrittTrack.setAttribute(
      "aria-valuetext",
      beantworteFragenAnzahl + " von " + gesamtFragenAnzahl + " Fragen beantwortet"
    );
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
  // "aria-live" sorgt dafür, dass Screenreader die Auflösung ("Richtig!"/
  // "Leider falsch...") automatisch vorlesen, sobald sie erscheint - ohne
  // das bliebe sie für blinde Nutzer unbemerkt (07.08.2026, WCAG 4.1.3).
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
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

  // Im Üben-Bereich gibt es nur richtig oder falsch - hier kann man dieselbe
  // Frage ohnehin beliebig oft wiederholen, ein zweiter Versuch wäre ohne
  // Wirkung. Der Server klemmt "nachbessern" bereits ab; die Zuweisung hier
  // ist die zweite Sicherung, damit in diesem Bereich niemals eine orange
  // Karte ohne Ergänzungsfeld und ohne Auflösung stehen bleibt.
  ergebnis.status = ergebnis.korrekt ? "richtig" : "falsch";
  ergebnis.teilweise = false;

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
  // Die Namensliste wird NICHT mehr blind beim Start geladen - erst wenn
  // eine Vereinskennung bestätigt ist, steht überhaupt fest, wessen Namen
  // gemeint wären (siehe pruefeVereinskennung).
  const gespeichert = mitgliedSession.lesen();
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
  const gespeicherteKennung = kennungSession.lesen();
  if (gespeicherteKennung) {
    kennungEingabe.value = gespeicherteKennung;
    await pruefeVereinskennung(gespeicherteKennung, { ausSession: true });
  }
}

start();
initialisiereKopfmenue();
