# 19.10.2026 – Quizbereiche, 90/10 und einheitliche Beschaffung

## Umgesetzt

- Gästequiz bereits bei der Namenseingabe mit großem **Gästequiz**-Titel und eigener dunkelgrüner Kopfleiste. Farbe ergänzt die eindeutige Textkennzeichnung. Rückkehr zur Vereinsanmeldung setzt den normalen Quizkopf zurück. Der Hauptweg der Startseite bleibt das Wochenquiz; alte direkte Gastlinks bleiben nutzbar.
- „Dein Quiz“, Quiz-Statistik und Sammlung besitzen dieselben drei Textreiter. Statistik-/Sammlungskacheln entfallen in der Modusauswahl; die vier eigentlichen Quizmodi bleiben.
- Sammlung enthält Joker und Abzeichen. Die ausführliche Wochenserie samt Rettung liegt jetzt in der Quiz-Statistik. Ein kleiner anklickbarer Flammenzähler im Wochenquiz führt dorthin. Kein normaler Aktualisieren-Knopf mehr; automatisches Laden bei Rückkehr und ein Fehler-Retry bleiben. Keine zusätzliche große Erklärung im Quizfluss.
- Serienrettung funktioniert auch mit Serienjokern aus Boxen, nicht nur alten Geburtstagsjokern. Vollständig beantwortete Wochen bleiben nicht rettbar; Rettung erzeugt keine Antworten, perfekte Wochen, Punkte oder Boxfortschritt. Kein neuer vorab aktivierbarer Wochenschutz gebaut.
- Wochenverlauf mit vier Balkenanteilen: richtig/grün, offene KI-Rückfrage/orange, falsch/rot, unbeantwortet/grau. Dazu Textzahlen und Statuswörter, nicht nur Farbe. Ein abschließend richtiger Jokererfolg bleibt vollständig grün; Orange bezeichnet eine noch offene Rückfrage, nicht einen bereits erfolgreichen zweiten Versuch.
- Woche aufklappen lädt ausschließlich öffentliche Frageformulierungen plus eigenen Status. Keine eigenen Antworten, Musterantworten, richtigen Optionen, KI-Feedbacks, internen Titel oder Medienadressen. Video heißt vorläufig „Video-Frage“, Bild „Bild-Frage“. Keine Lösungen durch einen anderen Quiz-Endpunkt nachladen.
- Neue Boxziehungen serverseitig **90% Zweiter Versuch / 10% Serienjoker**. Keine neuen 50/50-Joker, vorhandene bleiben unverändert und nutzbar. Gespeicherte Ziehung bleibt bei erneutem Öffnen gleich. Keine reale Box zum Test geöffnet und keine Bestände manuell geändert.

## Beschaffung / App

Das Personenprofil nutzt für Ausrüstung dieselbe `BeschaffungView` wie Eingang und Dashboard, gefiltert über die tatsächlichen Anfrage-IDs. Bündel, Vorprüfung, Artikelkarte, Prozessstand und Aktionen sind dadurch gleich. Kennzahlen sind ebenfalls auf diese Person begrenzt. Allgemeine Anliegen bleiben unter einem eigenen Umschalter erhalten. Der Modi-Reiter bleibt unverändert; ein Ersatz war noch nicht beschlossen. Beschaffung wäre ein naheliegender Kandidat, wenn Max den direkten Zugang im Alltag am häufigsten nutzt.

Rücknahme bleibt sichtbar, auch wenn abgeschlossene Vorgänge ausgeblendet sind. Karte nennt den tatsächlichen Urheber und den vorherigen Schritt. „Zurückgezogen“ ist kein Löschen und keine administrative Rückgabe. Der Server speichert die vorherige Phase ab dieser Änderung atomar im Ereignis; ältere fehlende Metadaten werden nicht geraten. Ein Rücknahmeereignis erscheint im Eingang. Wiederholte Rückgaben aus „vorgelegt“ beginnen einen eigenen Durchlauf, damit die zweite Prüfung nicht durch den alten Idempotenzschlüssel verschluckt wird. Verlauf und ursprüngliche Prüfung bleiben erhalten.

Live-Migrationen: `20261018221606_quizbereiche_jokergewichte_ruecknahmen` und `20261018222050_rueckgaben_prozessrunden`. UTC-Zeitstempel, lokal bereits 19.10.2026.

## Dortmund: Befund, noch keine inhaltliche Änderung

Die geladene Video-Frage verlangt im Fragetext ausdrücklich „Begründe deine Entscheidung“. In der gespeicherten Rubrik ist die Begründung „Schiedsrichterfehler → Wechsel kann rückgängig gemacht werden“ als eigener Prüfpunkt mit Nachfragen bei Fehlen/Widerspruch hinterlegt. Das erklärt die zitierte Rückfrage; es ist kein globaler Strenge-Regler. Aus dem zitierten Wortlaut allein lässt sich die Konsequenz erkennen, aber die gewünschte Ursache wird nicht ausdrücklich erklärt. Das ist eine Analyse der Bewertungsanforderung, keine neue Regelauslegung des Videos.

Empfehlung zur späteren Kalibrierung: Entscheidung, Spielfortsetzung und Reduzierung ausdrücklich als Kern prüfen. Wenn die Begründung primär Input für Max sein soll, im Fragetext als Zusatz/optional kennzeichnen und nicht gleichzeitig als zwingenden eigenen Bewertungspunkt führen. Sinngemäße kurze Formulierungen zulassen; fachlich falsche Kernentscheidungen nicht dadurch richtig machen. Szenenbeschreibung/Fokus formuliert Max. Keine Frage, Musterlösung, KI-Konfiguration oder historische Antwort wurde verändert.

## Nächste Joker-Erweiterung – Konzept, nicht gebaut

Zusätzliche Icon-Begründung ist eine eigene Erweiterung: ausdrücklicher Schalter im Frageneditor, Textfeld bei der Icon-Antwort, separate Kriterien/Musterbegründung, KI-Auswertung und klare Gesamtwertung. Ein- und ausgeschaltete Altfragen, Joker, Rückfragen sowie Obmann-Ansicht müssen gemeinsam geprüft werden. Diese Felder sind in diesem Paket **nicht** neu implementiert.

Für mehr Vielfalt ohne viele fast gleiche Karten empfehle ich vorerst einen einzigen zusätzlichen Typ **Teilantwort**: Bei Icon-Fragen genau einen tatsächlich geforderten Teil (Spielfortsetzung, Ort oder persönliche Strafe) aufdecken. Nur wenn danach noch eine fachliche Aufgabe übrig bleibt; eine bereits ausgefüllte komplette Aufgabe darf nicht bloß bestätigt werden. Mehrere persönliche Strafen, Richtung und freie Ortsangaben erfordern eine klare Eignungsprüfung. Entscheidung zwischen freier Auswahl und zufälligem Teil bleibt offen; noch keine neuen Chancen oder Bilder festgelegt.

Ein redaktioneller Denkhinweis wäre ein **vorher von Max geprüfter Satz**, kein spontaner KI-Tipp: z.B. auf einen relevanten Prüfpunkt aufmerksam machen, ohne die Entscheidung oder passende Karte zu nennen. Wegen Max' berechtigter Sorge vor zu verräterischen KI-Rückfragen zunächst keine automatisch erzeugten Hinweisjoker hinzufügen. Keine aktuellen Rückfrage-Prompts geändert.

Ein möglicher späterer Wochenschutz wäre ein eigener Typ neben dem seltenen Serien-Retter. Falls umgesetzt: Verbrauch sofort beim Einsatz, keine Rückgabe bei späterem Quizabschluss. Quiz bleibt spielbar; kein Einfluss auf richtige Antworten, perfekte Woche oder Vier-Wochen-Box. Jetzt ausdrücklich noch nicht gebaut.

## Reale Belohnungen / Unterstützung – Ideen für die Gruppe

Themenwahl und normale Szenenbesprechung sind schon vorhandene Angebote; deshalb nicht erneut als ausreichend neue Prämie verkaufen. Noch nichts als verbindliche Leistung veröffentlichen. Kleine Auswahl mit den Jugendlichen besprechen, bevor weitere Technik entsteht:

1. Ein fest vereinbarter 30-Minuten-Mathe-/Physik-Termin mit einem konkreten Wunschthema.
2. Ein individuell erstellter einseitiger Lernzettel plus kurze Erklärung für eine anstehende Klassenarbeit.
3. Eine strukturierte 45-Minuten-Prüfungsvorbereitung mit Übungsaufgaben und persönlichem Lernplan.
4. Ein praktischer Mini-Workshop zu Pfeife, Signalen oder Körpersprache, den die Teilnehmenden gestalten.
5. Ein persönliches digitales Schiri-Poster mit Spitznamen und gewähltem Motiv, privat statt öffentlich.
6. Ein kleines gedrucktes Sammeldiplom/Abzeichenblatt beim Treff, wenn Druckkosten vertretbar sind.
7. Ein altersgerechter Bewerbungs-/Praktikums-Mappencheck für Interessierte.
8. Ein gemeinsam geplanter sportlicher Gruppen-Challenge-Nachmittag ohne teure Buchung.
9. Eine vorbereitete Quiz-Gastgeberrolle: eigene geprüfte Runde moderieren, nicht bloß eine Themenwahl.
10. Ein freiwillig terminierter gemeinsamer Lernnachmittag mit mehreren Schiris statt unbegrenzter Einzelstunden.

Spielbegleitung würde ich separat als niedrigschwellige **„Begleitung für mein Spiel anfragen“**-Möglichkeit planen: Datum, Ort, Spiel, gewünschter Fokus und Rückmeldung zur Verfügbarkeit. Fachliche Unterstützung soll nicht davon abhängen, ob jemand zufällig eine Box gewinnt. Max' Zeitkapazität, passende Altersspannen und echte Nachfrage zuerst klären; keine automatische Zusage, Schulnoten-Abfrage oder neue Veröffentlichung.

## Prüfstand / Grenzen

846 Webtests, 138 JS-Syntaxprüfungen; macOS- und iOS-Simulator-Build sowie 67 App-Unit-Tests erfolgreich. Die bekannte MainActor-Warnung in der Terminfindung bleibt außerhalb dieses Pakets.

SQL-Tests für die neue Statistik-/Gewichts-/Rücknahmefunktion vor und nach Anwendung in zurückgerollten Transaktionen; zusätzlich beide bisherigen Box-/Quizjoker-Regressionsskripte grün. Danach 0 Testvereine, Testpersonen oder Testrunden aus dieser Prüfung. Kein echter Antwort-/Prämien-/Nachrichten-Test. Security-Advisor: 67 RLS-Hinweise unverändert, 255→256 anon- und 222→223 authenticated-Definerhinweise wegen der neuen ausdrücklich PIN-/Vereins-geprüften Lese-RPC; ein bestehender Leaked-Password-Hinweis unverändert. Keine pauschale Sicherheitsfreigabe behaupten.

23 lokale Browserzustände mit künstlichen API-Daten erfolgreich geprüft, einschließlich 320/390/768/1280px, Fehler-Retry, Serienrettung aus Boxbestand, Gäste-/Mitgliederwechsel, Textabständen und 200% Schrift. Keine automatischen axe-WCAG-A/AA-Funde, Seitenfehler oder horizontalen Überläufe in den geprüften Zuständen; 0 echte Schreibaufrufe. Keine echte Safari-/Android-Abnahme oder formale WCAG-Zertifizierung. Die App ist kompiliert und fachlich unit-getestet; optische Abnahme des Beschaffungswegs auf Max' Geräten bleibt nötig. Kein Commit/Push/Website-Deployment durch den Assistenten; Max übernimmt Veröffentlichung und App-Installation.
