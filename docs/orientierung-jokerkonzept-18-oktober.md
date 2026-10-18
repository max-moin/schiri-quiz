# 18.10.2026 – Quiz-Einstieg, Themenicons und Anfragen-Rücknahme

## Gebaut

- Kompakterer, mit großer Schrift mitwachsender Werbeaufmacher. „Schiri werden“ bleibt erhalten. Kein Gästequiz-Link mehr auf der Startseite.
- Direkt darunter eine klar getrennte Wochenquiz-Karte mit `quiz.html` als Ziel. Bestehende Anmeldung/Sitzung bleibt unverändert. Kopf-Navigation führt weiter zur Quiz-Übersicht.
- Fotos und KI-Kennzeichnung bleiben; vier einheitliche dekorative Themenicons ergänzen die Bilder auch am PC: Kalender, durchgestrichener Kreis, Sprechblasen und Dokumentstapel.
- Gästequiz vor dem Start und beim Spielen ausdrücklich als unverbindliches Ausprobieren ohne Wochen-/Vereinswertung gekennzeichnet. Bestehende Gastlinks bleiben kompatibel. Rückkehr zur Anmeldung entfernt `#gast` und setzt den Tastaturfokus.
- Ausrüstungsseite zeigt „Anfrage zurückziehen“ nur bei einer vom Server gelieferten erlaubten Aktion. Eigener nativer Dialog mit Behalten/Bestätigen, Escape, Fokusmanagement und Schutz vor Doppelklick. Nur ein Artikel, keine Löschung, kein Eingriff in andere Artikel einer Sammelanfrage. Fehler lassen die Anfrage stehen.
- Der vorhandene Serververtrag wurde nur gelesen, nicht verändert: PIN und Eigentümerprüfung in `schiri_anfrage_schritt`; Zeilensperre und Rollen-/Phasenprüfung in `ausruestung_uebergang`. Rücknahme aktuell nur aus `eingereicht` oder `geprueft`, niemals frei nach Kauf/Bestellung. Von „Meine Anliegen“ führt „Ausrüstungsanfrage verwalten“ zum vorhandenen Bestandsbereich.
- Bestehenden zu schwachen Textkontrast für Erledigt-/Abgelehnt-Plaketten korrigiert. Startseiten-/Bestandsüberschriften und Dialog bei 200% Schrift/Textabständen umbrechbar statt seitlichem Überlauf. Der mobile Seitenname hat eine echte mitwachsende Zeile statt einer festen absoluten Position.

## Bewusst nicht geändert

Keine Jokergewichte, Bestände, Vergaben, Quizwertungen oder KI-Prompts geändert. Kein App-Code geändert, keine Datenbankmigration, keine echte Antwort/Rücknahme/Benachrichtigung ausgelöst. Kein Commit/Push/Deployment.

## Jokerkonzept – Vorschlag, noch nicht freigegeben

Ist: Drei Typen mit je 1/3 Gewinnchance. Serienjoker rettet eine bereits abgelaufene, unvollständige Woche innerhalb des Rettungsfensters; kein aktueller Wochenschutz. Er schreibt keine richtigen Antworten und vergibt keine Quizpunkte. 50/50 reduziert eine Einfachauswahl mit mindestens drei Optionen auf zwei; bei drei Optionen verbessert sich bloßes Raten von 1/3 auf 1/2. Das ist ein Vorteil, aber deutlich eingeschränkter als ein Zweitversuch. Icon-/Freitextfragen werden nicht künstlich halbiert.

Empfehlung für die nächste gemeinsame Entscheidung: neue 50/50-Zufallsvergaben zunächst aussetzen, vorhandene 50/50-Bestände erhalten und weiter einlösbar lassen. Nur zwei neue Ziehungstypen: 80% Zweiter Versuch / 20% Serienjoker. Das sind vorgeschlagene Werte, keine empirisch optimale oder bereits aktivierte Verteilung. Bei späterer Umstellung die Chancen vor dem Öffnen transparent zeigen; keine bezahlten Boxen einführen.

Max' gewünschter Serienjoker als aktiver Wochenschutz: Quiz bleibt bis zum normalen Wochenschluss vollständig spielbar, nur die Serie ist abgesichert. Schutz allein ist keine Teilnahme, keine perfekte Woche, kein richtiger Antwortsatz und kein Fortschritt zur Vier-Wochen-Box. Bei vollständigem Abschluss nur normale Antworten zählen, nicht zusätzlich eine Rettung. Vor Umsetzung gemeinsam festlegen, ob ein vollständig unbenötigter Schutz den Joker zurückgibt; keine automatische Änderung der Verbrauchsregeln auf Verdacht.

Weitere mögliche Hilfen statt vieler neuer Typen:

1. **Hinweisjoker:** ein von Max gepflegter Denkhinweis zu einem Prüfpunkt, keine automatisch erfundene Lösung. Nur anbieten, wenn für die Frage ein Hinweis vorhanden ist.
2. **Teilaufgabenjoker:** bei Fragen mit mehreren voneinander getrennten Antwortteilen genau einen Teil wie die Spielfortsetzung aufdecken. Nie einsetzen, wenn dieser Teil schon die ganze Aufgabe beantwortet. Dafür wären ausdrückliche Frageeignung und ein Audit erforderlich.

Zunächst Balance und Wochenschutz klären, keine neuen Jokerbilder/Typen ungefragt veröffentlichen. Geburtstag, bestätigte Test-/Lehrabendteilnahme und vier abgeschlossene Quizwochen bleiben die bereits freigegebenen Boxanlässe.

## Echte Unterstützung – Konzept, kein öffentliches Leistungsversprechen

Schulische Hilfe nicht an richtige Quizantworten oder Glücksboxen binden: Wer Unterstützung braucht, soll nicht erst erfolgreich sein müssen. Als freiwilliger kleiner Pilot denkbar: eine gemeinsame 30-Minuten-Lernrunde pro Monat für Mathe/Physik, Thema vorher kurz absprechen und Kapazität begrenzen. Noch keine Buchung, Termine, personenbezogene Schulnoten oder Zusagen veröffentlicht.

Passendere zeitbasierte Quizbelohnungen: Thema für einen Treff mitbestimmen oder eine eigene Spielsituation gemeinsam besprechen; ebenfalls erst mit klarer Kapazität und Max' Freigabe. Keine Geldprämien oder unbegrenzten einlösbaren Einzelstunden versprechen.

## Dortmund / KI-Bewertung

Vorhanden: Im App-Frageneditor pro Kriterium erwartete Aussage, anerkannte Formulierungen, „Wenn fehlt“ und „Wenn falsch“ mit Ignorieren/Nachfragen/Sofort falsch. Server aggregiert die Kriterien bereits. Kein pauschaler neuer Strenge-Regler erforderlich, bevor der konkrete Fall geprüft ist.

Nächster Input von Max: genaue Frage, ursprüngliche Antwort und KI-Rückmeldung. Danach zwingende Entscheidung, notwendige kurze Begründung und bloße Zusatzdetails getrennt kalibrieren. Fachlich falsche Aussagen nicht pauschal tolerieren; anders formulierte richtige Begründung nicht wegen Musterwortlaut ablehnen. Szenenfokus im normalen Fragetext ergänzen, aber den Dortmund-Vorfall nicht aus der Erinnerung erfinden.

## Staige und Prüfung

Unveränderter offizieller Player. Lokaler Browserlauf prüft echte Rahmen-/Dialogkomponente bei 390px, 844px quer und 1280px mit ausdrücklich künstlichem 16:9-Iframe, nicht echter Werbung oder Videowiedergabe. Zeitspanne, Neu laden, Direktlink, X/Escape und Rückkehr geprüft. Tatsächliche Wiedergabe/Ads auf dem betroffenen Endgerät bleiben offen; keine Umgehung von Werbung oder automatische Endsteuerung behaupten.

Supabase-Vertrag anhand des aktiven Projekts nur lesend geprüft. Entwicklungsreferenz: [JavaScript-RPC](https://supabase.com/docs/reference/javascript/rpc), Changelog am 18.10.2026 geprüft. Keine neue Supabase-Funktion oder Rechtefreigabe.

Automatische Tests: 840 Node-Tests, 136 JS-Syntaxprüfungen, 18 lokale Browserzustände bei 320/390/768/844quer/1280px einschließlich 200% Schrift/Textabständen; keine automatischen axe4.10.3-A/AA-Funde, JS-Fehler oder horizontaler Überlauf in diesen Zuständen. Zwei simulierte Rücknahmen (Fehler/Erfolg), Abbruch/Escape ohne Schreibaufruf, kein Rücknahmeknopf bei vorgelegter Anfrage. Browser-/axe-Prüfungen sind gezielte technische Regressionen, keine formale WCAG-Zertifizierung oder echte Safari-/Android-Abnahme. Sämtliche API-Schreibaufrufe im Browser werden abgefangen und künstlich beantwortet; keine echten Nutzerdaten als Test verändert. Temporäre Prüfnachweise: `/private/tmp/sr-orientierung.pet93U/qa.json` und Screenshots daneben.
