// Gemeinsame Inhalte: Einstieg und Seitentour verwenden dieselben Schritte.
// Keine Beispieldaten, keine automatisch ausgefuehrten Fachaktionen.
const schritt = (id, ziel, titel, text) => Object.freeze({ id, ziel, titel, text });
export const SEITENHILFE = Object.freeze({
  'dfbnet.html': { titel: 'DFBnet-Hilfe', schritte: [
    schritt('themen', '.dfbnet-gruppe', 'Dein Thema auswählen', 'Spielbericht und rote Karte gehören zum Dokumentieren. Sperrtermine und Beobachtung betreffen deine Einsätze. Alle Einträge führen in eigene Leitfäden.'),
    schritt('begriffe', '.dfbnet-gruppe-wissen', 'Zwei Arten von Sperren', 'Persönliche Sperrtermine steuern deine Verfügbarkeit als Schiedsrichter. Spielersperren betreffen sportrechtliche Einschränkungen einer Person. Die Hintergrundseite erklärt den Unterschied, ohne einen Einzelfall freizugeben.'),
  ] },
  'sperrtermine.html': { titel: 'Sperrtermine & Verfügbarkeit', schritte: [
    schritt('abschnitt', '[data-sb-panel]', 'Planen, eintragen, klären', 'Alle Abschnitte sind sichtbar. Die Nummern zeigen die Reihenfolge. „Erklärung anzeigen“ öffnet die Hintergründe zum jeweiligen Schritt.'),
    schritt('grenze', '.dfbnet-hinweis', 'Keine automatische Änderung', 'Die Hilfe trägt nichts im DFBnet ein. Schon angesetzte Spiele brauchen den gesonderten Absageweg, nicht nur einen neuen Sperrtermin.'),
  ] },
  'schiri-beobachtung.html': { titel: 'Schiri-Beobachtung', schritte: [
    schritt('abschnitt', '[data-sb-panel]', 'Von der Beobachtung zum Lernziel', 'Vorbereitung, Bericht und Weiterentwicklung sind getrennte Abschnitte. Ein Bericht kann erst nach Prüfung und Freigabe verfügbar sein.'),
    schritt('feedback', '.rk-quellen', 'Eigene Rückmeldung geben', 'Der verlinkte SVFD-Feedbackbogen bewertet die Qualität von Beobachtung und Auswertung. Er ersetzt nicht den Leistungsbericht. Persönliche Angaben werden auf der offiziellen Seite eingegeben, nicht hier.'),
  ] },
  'spielersperren.html': { titel: 'Spielersperren verstehen', schritte: [
    schritt('abschnitt', '[data-sb-panel]', 'Begriffe und Systemlogik', 'Die Hilfe unterscheidet Geltung und Ableistung. Das ist Hintergrundwissen, kein Rechner für die Spielberechtigung einer Person.'),
    schritt('grenze', '.dfbnet-hinweis', 'Altes Handbuch, heutige Regeln', 'Das technische Handbuch ist von 2017. Für einen konkreten Fall gelten die aktuellen Ordnungen, Wettbewerbsbestimmungen und gegebenenfalls eine sportrechtliche Entscheidung.'),
  ] },
  'spielbericht.html': { titel: 'Spielbericht Schritt für Schritt', schritte: [
    schritt('abschnitt', '#erfassen, .sb-detail-kopf', 'Eintrag auswählen', 'Im Überblick stehen die Eintragungen in der Reihenfolge des Spielberichts. Klicke auf den Namen eines Bereichs: Die eigene Detailseite erklärt die Felder und zeigt passende Originalbilder. „Alle Eintragungen“ führt zurück.'),
    schritt('quellen', '.rk-quellen', 'Stand und Originale', 'Die Bildbeispiele stammen aus dem Sammelspielbericht-Handbuch von 2019. Sie sind als Beispiele gekennzeichnet. Fehlende heutige Masken werden nicht erfunden; aktuelle Wettbewerbsbestimmungen gehen vor.'),
  ] },
  'rote-karte.html': { titel: 'Rote Karte & Sonderbericht', schritte: [
    schritt('phasen', '.rk-phasenwahl', 'Deine Spielphase', 'Vor dem Spiel startet mit Schritt 0. Im Spiel stehen die Schritte 1 bis 4 im Mittelpunkt; danach folgen Spielbericht, Sonderbericht und Upload.'),
    schritt('umfang', '.rk-ansicht', 'Kurz oder mit Erklärungen', 'Der Kurzüberblick zeigt Fokuspunkte. Mit Erklärungen ergänzt die Hintergründe, ohne alle zusätzlichen Hinweisboxen zu öffnen.'),
    schritt('quellen', '.rk-quellen', 'Originale und Unterstützung', 'Die Originalquellen sind mit ihrem Zweck verlinkt. Max erreichst du über den Anrufknopf. Diese Hilfe versendet keine Berichte und ändert nichts im DFBnet.'),
  ] },
  'quiz.html': { titel: 'Fragen beantworten', schritte: [
    schritt('fortschritt', '#fortschritt-wrap, #kopf', 'Dein Wochenfortschritt', 'Hier siehst du, wie viele Fragen schon beantwortet sind. Gast- und Übungsmodus sind davon getrennt. Ein Wochenwechsel kann neue Fragen bringen.'),
    schritt('antworten', '#fragen-liste, #gast-frage-bereich, main', 'Antworten und begründen', 'Lies die Frage und wähle die verlangte Antwortform. Bei Mehrfachauswahl können mehrere Antworten nötig sein. Eine verlangte Begründung musst du vor dem Abschicken ergänzen.'),
    schritt('feedback', '#fragen-liste, #gast-frage-bereich, main', 'Lösung und Rückmeldung', 'Nach der Abgabe findest du die Bewertung und, wenn verfügbar, „Warum?“ sowie die Möglichkeit, eine Frage zu melden. Deine persönlichen Rückmeldungen bleiben unter „Meine Anliegen“ erreichbar.'),
  ] },
  'duell.html': { titel: 'Quiz-Duell', schritte: [
    schritt('duell', '#duellBereich', 'Mit anderen spielen', 'Erstelle ein Duell oder tritt per Einladung bei. Lobby, Zwischenstand und Teilen sind eigene Wege. Ein Duell zählt nicht für den Wochenabschluss.'),
    schritt('teilen', '#duellBereich', 'Einladung und Verlauf', 'Teile die Einladung mit den gewünschten Personen. In deiner Übersicht kannst du zu einer bestehenden Lobby oder zum Zwischenstand zurückkehren. Das Schließen eines eigenen Duells verlangt eine Bestätigung.'),
  ] },
  'entscheiden.html': { titel: 'Entscheiden üben', schritte: [
    schritt('szenario', 'main', 'Entscheidung und Begründung', 'Bearbeite die angezeigte Situation und beachte die Aufgabenstellung. Dieser eigene Modus ersetzt keine offenen Wochenquizfragen.'),
  ] },
  'meine-statistik.html': { titel: 'Meine Quizstatistik', schritte: [
    schritt('sammlung', '.quiz-untermenue, #meine-zugang', 'Statistik und Sammlung', 'Hier siehst du deinen Wochenverlauf. Abzeichen, Wochenserie und Joker findest du getrennt unter Quiz → Sammlung.'),
    schritt('statistik', '#statistik-kennzahlen, #meine-zugang', 'Deine eigene Entwicklung', 'Die Übersicht gehört nur zu deinem Konto. Sie zeigt deine Ergebnisse, nicht den Leistungsstand anderer Vereinsmitglieder.'),
    schritt('verlauf', '#statistik-verlauf, #meine-zugang', 'Über die Wochen', 'Im Verlauf siehst du auch Wochen ohne Teilnahme. Nutze ihn, um deinen eigenen Lernfortschritt einzuschätzen; eine leere Woche ist nicht dasselbe wie eine falsch beantwortete Frage.'),
  ] },
  'sammlung.html': { titel: 'Deine Sammlung', schritte: [
    schritt('joker', '.joker-vorrat, #meine-zugang', 'Deine Joker', 'Graue Symbole heißen: kein Vorrat. Die Zahl unten rechts ist dein Bestand. Tippe auf ein Symbol für die Wirkung oder auf i für die Verdienstwege. Öffne verdiente Boxen für einen zufälligen Joker. 50/50 und zweiter Versuch helfen nur im Wochenquiz; richtig mit Joker zählt voll richtig.'),
    schritt('abzeichen', '.abzeichen-sammlung, #meine-zugang', 'Dein Trophäenschrank', 'Abzeichen bleiben als Sammelziele sichtbar. Offene Motive sind grau. Tippe auf ein Bild, um Ziel und deinen tatsächlichen Fortschritt zu sehen.'),
    schritt('serie', '.serie-zahlen, #meine-zugang', 'Deine Wochenserie', 'Alle Wochenfragen abschließend beantworten: Die Woche zählt. Ein Serienjoker rettet einmal eine verpasste Woche im Sieben-Tage-Fenster. Der Joker selbst verfällt nicht.'),
  ] },
  'regeluebersicht.html': { titel: 'Regelübersicht', schritte: [
    schritt('filter', '#ebeneFilter, main', 'Dein konkretes Spiel', 'Wenn die Übersicht freigeschaltet ist, grenze zuerst Ebene, Spielart und Mannschaft ein. Danach werden passende Informationen gezeigt. Maßgeblich bleiben die aktuellen offiziellen Verbandsunterlagen.'),
  ] },
  'spesenrechner.html': { titel: 'Spesenrechner', schritte: [
    schritt('spesen', 'main', 'Die passende Berechnung', 'Wenn der Rechner freigeschaltet ist, wähle die Angaben für dein Spiel und deine Anreise. Prüfe die zugrunde liegenden Verbandsvorgaben und verwende die vorgeschriebene Quittung.'),
  ] },
  'frage-vorschlagen.html': { titel: 'Eine Frage vorschlagen', schritte: [
    schritt('frage', 'main', 'Vorschlag statt Veröffentlichung', 'Gib Wortlaut, Antwort, Begründung und Quelle an. Ein Entwurf ist noch nicht eingereicht; ein eingereichter Vorschlag wird vor der Verwendung geprüft.'),
    schritt('herkunft', '.herkunft-auswahl', 'Freiwillige Kennzeichnung', 'Du kannst die Frage als Beitrag aus unserer Schiri-Gruppe kennzeichnen lassen. Ein zweites Häkchen erlaubt zusätzlich deinen Namen im Wochenquiz des Vereins. Ohne Häkchen keine Kennzeichnung; der Obmann sieht den Einreicher für die Prüfung trotzdem.'),
  ] },
  'hilfe.html': { titel: 'Die passende Hilfe finden', schritte: [
    schritt('rundgang', '[data-einstieg-starten]', 'Geführter Einstieg', 'Der Rundgang zeigt die wichtigsten Seiten und ihre Funktionen. Mit den Pfeilen gehst du weiter oder zurück; mit dem X beendest du die Tour jederzeit.'),
    schritt('leitfaeden', '.hilfe-raster', 'Praktische Leitfäden', 'Hier findest du unter anderem DFBnet, die erste rote Karte und den Ablauf unseres Treffs. Die Seitenhilfe erklärt zusätzlich die Bedienelemente der jeweiligen Seite.'),
  ] },
  'informationen.html': { titel: 'Unterlagen finden', schritte: [
    schritt('unterlagen', 'main h1', 'Die richtige Quelle', 'Hier findest du Unterlagen und Hinweise. Prüfe beim Öffnen den Verband und den Stand des Dokuments. Für einen konkreten Termin liegt ein freigegebenes Vereinsprotokoll direkt im Termin.'),
  ] },
  'melden.html': { titel: 'Ideen und Feedback', schritte: [
    schritt('idee', 'main h1', 'Das passende Anliegen wählen', 'Wähle, ob du eine Idee, eine Regelfrage, einen Vorfall oder Website-Feedback einreichen möchtest. Persönliche Vorgänge und vorhandene Antworten findest du später unter „Meine Anliegen“.'),
  ] },
  'installieren.html': { titel: 'Auf den Home-Bildschirm', schritte: [
    schritt('installation', 'main h1', 'Wie eine App öffnen', 'Folge der Anleitung für dein Gerät. Die installierte Website bleibt mit demselben Konto nutzbar. Auf iPhone und iPad ist die Home-Bildschirm-Installation auch Voraussetzung für Web-Push.'),
  ] },
  'index.html': { titel: 'Deine Vereinsseite', schritte: [
    schritt('start', '.marken-knopf', 'Hier kommst du nach Hause', 'Das Vereinslogo bringt dich immer zur Startseite. Die Zurück-Schaltfläche im Seiteninhalt führt eine Ebene zurück.'),
    schritt('wege', '.nav-knopf, .haupt-nav', 'Die wichtigsten Wege', 'Auf dem Handy öffnest du die Seiten über das Menü. Termine, Absagen, Unterlagen und Ideen sind hier erreichbar. Regeln und Spesen können noch gesperrt sein.'),
    schritt('konto', '[data-konto-knopf]', 'Dein persönlicher Bereich', 'Melde dich mit Vereinskennung und PIN an. Hinter deinem Namen findest du Einstellungen, Quizstatistik, Ausrüstung und deine Anliegen. „Dieses Gerät merken“ ist nur für dein eigenes Gerät gedacht.'),
  ] },
  'termine.html': { titel: 'Termine verstehen', schritte: [
    schritt('termine', '#terminBereich', 'Termin auswählen', 'Die Liste zeigt kommende Termine; frühere Termine findest du unter „Vergangene Termine“. Öffne einen Termin, um Ort, Uhrzeit und Hinweise zu sehen. Vereinsinterne Termine erscheinen nur nach passender Anmeldung.'),
    schritt('antwort', '[data-status], .termindetail, #terminBereich', 'Zu- oder absagen', 'Wenn eine Rückmeldung verlangt wird, stehen im Termin die Antwortschaltflächen. Deine Antwort wird erst nach Bestätigung gespeichert. Bei reinen Informationsterminen gibt es bewusst keine Teilnahmeantwort.'),
    schritt('protokoll', '#termin-pdf, .termin-protokoll, #terminBereich', 'Kalender und Protokoll', 'Im Termin kannst du ihn in deinen Kalender übernehmen. Ein freigegebenes Protokoll deines Vereins kannst du dort lesen oder als PDF herunterladen. Nicht jeder Termin hat bereits ein Protokoll.'),
    schritt('vorschlag', '.termin-aktionen, #terminBereich', 'Einen Termin vorschlagen', 'Du kannst einen Tag oder einen Treff vorschlagen und bei einer veröffentlichten Terminfindung abstimmen. Ein Vorschlag wird zunächst geprüft, nicht sofort öffentlich eingetragen.'),
  ] },
  'modus.html': { titel: 'Dein Quiz', schritte: [
    schritt('woche', 'a[href="quiz.html"], #modusBereich', 'Fragen dieser Woche', 'Die blaue Kachel öffnet dein Wochenquiz. Noch nicht angemeldet? Dann gib im Anmeldefenster deine Zugangsdaten ein. Das Gästequiz ist nur eine Alternative zum Ausprobieren ohne Wochenwertung. Die Tour gibt selbst keine Antwort ab.'),
    schritt('loesung', '#modusBereich', 'So beantwortest du Fragen', 'Je nach Frage wählst du eine oder mehrere Antworten, Entscheidungs-Icons oder schreibst einen eigenen Text. Achte auf die Aufgabenstellung und ergänze eine Begründung, wenn sie verlangt wird.'),
    schritt('ueben', '#modusBereich', 'Üben und Duell', 'Die weiteren Modi findest du auf dieser Übersicht, soweit sie verfügbar sind. Übungsfragen ersetzen keine offenen Wochenfragen. Ein Duell ist ein eigener Vergleich mit eingeladenen Personen.'),
  ] },
  'ausruestung.html': { titel: 'Bestand und Anfragen', schritte: [
    schritt('bestand', '#bestand-liste, #bestand-zugang', 'Was du schon hast', 'Im Bestand stehen deine eigenen Trikots, Hosen, Stutzen, Schuhe und dein Equipment. Nach Anmeldung kannst du über Plus einen Eintrag anlegen und vorhandene Einträge bearbeiten.'),
    schritt('anfrage', '#bestand-anfrage-stellen, #bestand-zugang', 'Was du noch brauchst', 'Bestand und Anfrage sind verschieden: Mit „Ausrüstung anfragen“ bittest du um eine Freigabe. Mehrere Stücke können in eine Anfrage; Farbe, Größe und Bemerkungen gehören zu den einzelnen Positionen.'),
    schritt('prozess', '#bestand-anfragen, #bestand-zugang', 'Wo deine Anfrage gerade liegt', 'Der Verlauf zeigt Prüfung, Vorstandsentscheidung, Beschaffung und gegebenenfalls Beleg und Zahlung. Erst eine Freigabe erlaubt den vereinbarten Kauf. Bei Selbstkauf bestätigst du den Kauf und später den Geldeingang.'),
  ] },
  'meine-anliegen.html': { titel: 'Deine Rückmeldungen', schritte: [
    schritt('anliegen', '#meine-vorgangsliste, #meine-zugang', 'Deine eigenen Vorgänge', 'Hier findest du deine eingereichten Rückmeldungen und Vorschläge mit ihrem aktuellen Stand. Anonym eingesandte Meldungen lassen sich deinem Konto nicht zuordnen.'),
    schritt('rueckmeldung', '#meine-vorgangsliste, #meine-zugang', 'Antworten nachlesen', 'Öffne einen Vorgang, um Details und eine vorhandene Rückmeldung des Obmanns zu lesen. Für ein neues Thema nutze „Ideen“; für Ausrüstung den Ausrüstungsbereich.'),
  ] },
  'einstellungen.html': { titel: 'Deine Einstellungen', schritte: [
    schritt('daten', 'a[href="meine-daten.html"], #einstellungen-zugang', 'Meine Daten und Saisonpunkte', 'Hier siehst du deine Stammdaten und bestätigten Fortbildungspunkte. Die Punkte pflegt Max anhand des DFBnet-Stands; eine Terminzusage allein ist noch kein bestätigter Punkt.'),
    schritt('mitteilungen', 'a[href="mitteilungen.html"], #einstellungen-zugang', 'Mitteilungen sind freiwillig', 'Du entscheidest, welche Hinweise du möchtest. Web-Push braucht ein geeignetes Gerät, deine Erlaubnis und einen freigeschalteten Versand. Auf dem iPhone öffnest du dafür die installierte Home-Bildschirm-Webapp.'),
    schritt('einrichtung', '[data-einrichtung], #einstellungen-zugang', 'Dein eigener Einstieg', 'Die freiwillige Checkliste hilft beim Kennenlernen. Du kannst Schritte als angesehen markieren oder auslassen. Sie wird nur für dein Konto in diesem Browser gespeichert, nicht als Pflicht oder Vereinsnachweis.'),
  ] },
  'vorlagen.html': { titel: 'Ein Spiel absagen', schritte: [
    schritt('absage', 'main h1', 'Absage ist ein Ablauf', 'Daten bereithalten, eine begründete E-Mail an das Ansetzerteam senden und die tatsächliche Absetzung im DFBnet kontrollieren. Die Vorlage allein sagt das Spiel nicht ab.'),
    schritt('mail', 'main pre, main', 'Vorlage prüfen', 'Ergänze alle Platzhalter, prüfe Empfänger und CC und sende die E-Mail in deinem Mailprogramm. Die Hinweise auf dieser Seite erklären auch, wann du telefonisch nachhaken musst.'),
  ] },
  'meine-daten.html': { titel: 'Deine Daten', schritte: [
    schritt('profil', 'main h1', 'Nur deine eigene Übersicht', 'Stammdaten und bestätigte Saisonpunkte gehören zu deinem Konto. Bei falschen Stammdaten bitte Max um Korrektur; eine Zusage zählt nicht automatisch als Fortbildungspunkt.'),
    schritt('punkte', '#fortbildungspunkte, [data-fortbildungspunkte], main', 'Punkte genauer ansehen', 'Öffne einen bestätigten Punkt, um Anlass, Termin und Bestätigungsstand zu sehen. RLA, Hausregeltest und weitere Angebote werden unterscheidbar dargestellt.'),
  ] },
  'mitteilungen.html': { titel: 'Mitteilungen einrichten', schritte: [
    schritt('push', '.mitteilungen-status, #einstellungen-zugang', 'Dieses Gerät und der Versand', 'Geräteeignung, Browser-Erlaubnis und automatischer Versand sind getrennte Voraussetzungen. Eine erfolgreiche Testmitteilung bestätigt dieses Gerät, nicht schon die automatischen Erinnerungen. Auf dem iPhone öffnest du dafür die Home-Bildschirm-Webapp.'),
    schritt('wahl', '#mitteilungen-steuerung, #einstellungen-zugang', 'Themen auswählen und speichern', 'Setze oder entferne die gewünschten Haken und drücke danach „Auswahl speichern“. Erst dann ist deine neue Auswahl übernommen. Die Themen gelten für dein Konto auf allen registrierten Geräten. Die Obmann-E-Mails bleiben davon unabhängig.'),
    schritt('geraete', '.mitteilungen-geraeteteil, #einstellungen-zugang', 'Geräte einzeln verwalten', 'Jedes Gerät braucht eine eigene Registrierung und Erlaubnis. Hier kannst du nicht mehr benötigte Geräte entfernen. Kommt trotz erfolgreichem Test kein Banner, prüfe den Fokus-/Nichtstörmodus und die Mitteilungseinstellungen des Geräts.'),
    schritt('termine', '#mitteilungen-terminbereich, #einstellungen-zugang', 'Einzelne Termine ausschließen', 'Du kannst einzelne Termine ausschließen und später wieder zulassen. Das gilt auf allen deinen Geräten. Zulassen allein löst noch keine Erinnerung aus: Die Themenauswahl, Erinnerung am Termin und deine Zusage oder ein Pflichttermin deines Vereins müssen ebenfalls passen.'),
  ] },
});
export const EINSTIEG = Object.freeze(['index.html', 'termine.html', 'modus.html', 'ausruestung.html', 'meine-anliegen.html', 'einstellungen.html']);
export function tourSchritte(art, seite) {
  return (art === 'einstieg' ? EINSTIEG : [seite]).flatMap(datei =>
    (SEITENHILFE[datei]?.schritte || []).map(s => ({ ...s, seite: datei })));
}
export const EINRICHTUNG = Object.freeze([
  { id: 'tour', titel: 'Website kennenlernen', text: 'Den geführten Einstieg ansehen.', href: 'hilfe.html', tour: true },
  { id: 'daten', titel: 'Meine Daten prüfen', text: 'Stammdaten und Saisonübersicht ansehen.', href: 'meine-daten.html' },
  { id: 'bestand', titel: 'Ausrüstung erfassen', text: 'Deinen Bestand prüfen oder ergänzen; du bestätigst selbst, wann das passt.', href: 'ausruestung.html' },
  { id: 'quiz', titel: 'Wochenquiz kennenlernen', text: 'Deine Wochenfragen und deinen Fortschritt finden.', href: 'modus.html' },
  { id: 'termine', titel: 'Termine kennenlernen', text: 'Rückmeldung und Protokolle finden.', href: 'termine.html' },
  { id: 'push', titel: 'Mitteilungen prüfen · optional', text: 'Auch ohne Push ist die Einrichtung vollständig nutzbar.', href: 'mitteilungen.html' },
]);
export function leseFortschritt(speicher, konto) {
  if (!konto) return {};
  try {
    const daten = JSON.parse(speicher.getItem(`schiriEinrichtung.v1.${konto}`) || '{}');
    if (!daten || typeof daten !== 'object' || Array.isArray(daten)) return {};
    return Object.fromEntries(EINRICHTUNG.filter(s => ['angesehen', 'ausgelassen'].includes(daten[s.id])).map(s => [s.id, daten[s.id]]));
  } catch { return {}; }
}
export function speichereFortschritt(speicher, konto, stand) {
  if (!konto) return false;
  try { speicher.setItem(`schiriEinrichtung.v1.${konto}`, JSON.stringify(stand)); return true; } catch { return false; }
}
export function leseTour(speicher, jetzt = Date.now()) {
  try {
    const t = JSON.parse(speicher.getItem('schiriTour.v1') || 'null');
    if (!t || !['einstieg', 'seite'].includes(t.art) || !SEITENHILFE[t.seite]
      || !Number.isInteger(t.index) || t.index < 0 || t.index >= tourSchritte(t.art, t.seite).length
      || !Number.isFinite(t.zeit) || jetzt - t.zeit > 1800000 || t.zeit > jetzt) return null;
    return t;
  } catch { return null; }
}
