// Schiri-Quiz: Composition Root
//
// Diese Datei verdrahtet ausschließlich die fachlichen Module. Neue
// Produktlogik gehört in src/core, src/ui oder src/features und wird hier
// nur noch konfiguriert. So bleibt der Einstieg klein und überprüfbar.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { freitextStatus, schwierigkeitSterne } = SchiriQuizUtils;
const { erstelleSessionSpeicher } = SchiriQuizSessionStore;
const { baueVideoEinbettungModal } = SchiriQuizVideoPlayer;
const { initialisiereMaskierteFelder, verbindeSichtbarkeit, verdecke } = SchiriQuizMaskedInputs;
const { baueVorlesenButton, stoppeVorlesen } = SchiriQuizTextToSpeech;
const { erstelleErklaerungsDialog } = SchiriQuizExplanationDialog;
const { erstelleFragenElemente } = SchiriQuizQuestionElements;
const { erstelleGastmodus } = SchiriQuizGuestMode;
const { erstelleFreitextAntworten } = SchiriQuizFreetextAnswers;
const { erstelleEntscheidungsAntworten } = SchiriQuizDecisionAnswers;
const { erstelleFlexibleAntworten } = SchiriQuizFlexibleAnswers;
const { erstelleHistorienModus } = SchiriQuizHistoryMode;
const { erstelleWochenQuiz } = SchiriQuizWeeklyQuiz;
const { erstelleZugang } = SchiriQuizAccess;
const { montiereQuizVerlassen } = SchiriQuizVerlassenDialog;
const { erstelleFrageMeldung } = SchiriQuizFrageMeldung;

const mitgliedSession = erstelleSessionSpeicher("schiriQuizSession", {
  dauerhafterSchluessel: "schiriQuizGemerktesGeraet",
});
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
  beiAngemeldet: async () => {
    // Erst wissen, was diese Person schon gemeldet hat - sonst steht die
    // Marke "Gemeldet" an keiner Frage und dieselbe Sache kommt dreimal.
    void frageMeldung.ladeEigeneMeldungen();
    await wochenQuiz.ladeFragenUndAntworten();
    if (
      window.location.hash === "#ueben" &&
      document.getElementById("historie-start-button")?.hidden === false
    ) {
      // Auch ein direkt eingegebener Hash darf die Wochenquiz-Sperre nicht
      // umgehen. Der Startknopf wird erst nach Abschluss freigegeben.
      historieController.betreteUebenModus();
    }
  },
});

void zugangController.start();
montiereQuizVerlassen();
