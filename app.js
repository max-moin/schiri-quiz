// Schiri-Quiz: Composition Root
//
// Diese Datei verdrahtet ausschließlich die fachlichen Module. Neue
// Produktlogik gehört in src/core, src/ui oder src/features und wird hier
// nur noch konfiguriert. So bleibt der Einstieg klein und überprüfbar.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { formatiereAnfrageDatum, freitextStatus, schwierigkeitSterne } = SchiriQuizUtils;
const { erstelleSessionSpeicher } = SchiriQuizSessionStore;
const { baueVideoEinbettungModal } = SchiriQuizVideoPlayer;
const { initialisiereMaskierteFelder, verbindeSichtbarkeit, verdecke } = SchiriQuizMaskedInputs;
const { baueVorlesenButton, stoppeVorlesen } = SchiriQuizTextToSpeech;
const { erstelleErklaerungsDialog } = SchiriQuizExplanationDialog;
const { initialisiereKopfmenue } = SchiriQuizHeaderMenu;
const { erstelleFragenElemente } = SchiriQuizQuestionElements;
const { erstelleGastmodus } = SchiriQuizGuestMode;
const { erstelleProfilAnfragen } = SchiriQuizProfileRequests;
const { sorgeFuerFenster } = SchiriProfilFenster;
const { erstelleFreitextAntworten } = SchiriQuizFreetextAnswers;
const { erstelleEntscheidungsAntworten } = SchiriQuizDecisionAnswers;
const { erstelleFlexibleAntworten } = SchiriQuizFlexibleAnswers;
const { erstelleHistorienModus } = SchiriQuizHistoryMode;
const { erstelleWochenQuiz } = SchiriQuizWeeklyQuiz;
const { erstelleZugang } = SchiriQuizAccess;
const { montiereQuizVerlassen } = SchiriQuizVerlassenDialog;
const { erstelleFrageMeldung } = SchiriQuizFrageMeldung;

const mitgliedSession = erstelleSessionSpeicher("schiriQuizSession");
const kennungSession = erstelleSessionSpeicher("schiriQuizVereinskennung", {
  altesRohformatLesen: true,
});
const fehlerHinweis = document.getElementById("fehler-hinweis");
const zugang = { schiedsrichterId: null, pin: null };
const getZugang = () => ({ ...zugang });
const setZugang = (neu) => Object.assign(zugang, neu);

function zeigeFehler(text) {
  fehlerHinweis.textContent = text;
  fehlerHinweis.hidden = false;
}

function versteckeFehler() {
  fehlerHinweis.hidden = true;
}

const frageAnsicht = erstelleFragenElemente({ schwierigkeitSterne });
let historieController;
let wochenQuiz;
let zugangController;

const erklaerungsDialog = erstelleErklaerungsDialog({
  getZugang,
  vorHistorieErklaerung: () => historieController?.stoppeAutoTimer(),
});
// Bei der Loesung stehen zwei Knoepfe nebeneinander: "Warum?" und "Passt
// was nicht?". Beide baut ab hier dieselbe Funktion - dadurch bekommt jede
// Antwortart den Melde-Knopf, ohne eine Zeile davon zu wissen, und er kann
// nicht versehentlich an einer offenen Frage landen (src/features/frage-melden.js).
const frageMeldung = erstelleFrageMeldung({ sb, getZugang });
const baueWarumButton = (frageId, istHistorie) =>
  frageMeldung.baueLoesungsAktionen(erklaerungsDialog.baueWarumButton(frageId, istHistorie), frageId, istHistorie);

const freitext = erstelleFreitextAntworten({
  getZugang,
  zeigeFehler,
  versteckeFehler,
  frageAnsicht,
  baueVideoEinbettungModal,
  baueVorlesenButton,
  baueWarumButton,
  freitextStatus,
  beiWochenfrageBeantwortet: () => wochenQuiz.registriereBeantwortung(),
});

const entscheidung = erstelleEntscheidungsAntworten({
  getZugang,
  zeigeFehler,
  versteckeFehler,
  frageAnsicht,
  baueVideoEinbettungModal,
  baueVorlesenButton,
  baueWarumButton,
  beiWochenfrageBeantwortet: () => wochenQuiz.registriereBeantwortung(),
});

const flexibel = erstelleFlexibleAntworten({
  sb,
  getZugang,
  zeigeFehler,
  versteckeFehler,
  frageAnsicht,
  baueVideoEinbettungModal,
  baueVorlesenButton,
  baueWarumButton,
  beiWochenfrageBeantwortet: () => wochenQuiz.registriereBeantwortung(),
});

historieController = erstelleHistorienModus({
  sb,
  getZugang,
  zeigeFehler,
  versteckeFehler,
  frageAnsicht,
  freitext,
  baueVorlesenButton,
  stoppeVorlesen,
  baueWarumButton,
});

wochenQuiz = erstelleWochenQuiz({
  sb,
  getZugang,
  zeigeFehler,
  versteckeFehler,
  frageAnsicht,
  freitext,
  entscheidung,
  flexibel,
  baueVideoEinbettungModal,
  baueVorlesenButton,
  baueWarumButton,
  beiQuizFertig: () => historieController.zeigeStartButton(),
});

// Die Profil-Fenster liegen seit dem 30.08.2026 in src/ui/profil-fenster.js
// und nicht mehr fest in quiz.html - sie gehoeren auf jede Seite, nicht nur
// hierher. Muss vor erstelleProfilAnfragen laufen, das sie verdrahtet.
sorgeFuerFenster();

const profilAnfragen = erstelleProfilAnfragen({
  sb,
  getZugang,
  zeigeFehler,
  formatiereAnfrageDatum,
});

const gastController = erstelleGastmodus({
  sb,
  zeigeFehler,
  versteckeFehler,
  loeseOptionenAuf: frageAnsicht.loeseOptionenAuf,
  beiVerlassen: () => void zugangController.behandleGastVerlassen(),
});

zugangController = erstelleZugang({
  sb,
  mitgliedSession,
  kennungSession,
  gastController,
  zeigeFehler,
  versteckeFehler,
  verdecke,
  initialisiereMaskierteFelder,
  verbindeSichtbarkeit,
  setZugang,
  beiStatusPruefen: () => profilAnfragen.aktualisiereAnfragenStatusPunkt(),
  beiAngemeldet: () => {
    // Erst wissen, was diese Person schon gemeldet hat - sonst steht die
    // Marke "Gemeldet" an keiner Frage und dieselbe Sache kommt dreimal.
    void frageMeldung.ladeEigeneMeldungen();
    return wochenQuiz.ladeFragenUndAntworten();
  },
});

void zugangController.start();
initialisiereKopfmenue();
montiereQuizVerlassen();
