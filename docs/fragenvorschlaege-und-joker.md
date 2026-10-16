# Fragenvorschläge, Kennzeichnung und Geburtstagsjoker

Stand: 16.10.2026. Frontend/App müssen nach der Übernahme noch veröffentlicht bzw. neu installiert werden.

## Vorschlag → Frage

1. Website: „Ideen & Feedback“ → „Frage vorschlagen“. Frage, Antwortformat, Lösung, Begründung und Beleg erfassen.
2. Zwei freiwillige Häkchen: Beitrag aus der Gruppe; zusätzlich den Namen zeigen. Standard: beide aus. Name nur zusammen mit Gruppenkennzeichnung. Nur im Wochenquiz des eigenen Vereins, nicht im Gastquiz oder Duell.
3. App: „Fragenvorschläge“ → öffnen → „Als in Prüfung markieren“. Rückfragen laufen weiter über „Änderung erbitten“ und die vorhandenen Versionen.
4. „Fragenentwurf erstellen“ öffnet den bestehenden Editor mit übernommenen Feldern. Die unveränderten Lösungstexte, Medienhinweise, Begründung und Beleg bleiben als Prüfhilfe sichtbar. Auswahl-, Freitext- und Zahlantworten werden vorbelegt. Freie Icon-Lösungstexte müssen auf die strukturierten Felder übertragen werden; externe Bilder werden nach Prüfung über die Bildauswahl übernommen. Fehlende Zeiten ergänzen.
5. Begründung nur nach fachlicher Prüfung ausdrücklich als KI-Kontext übernehmen. Sie wird nicht automatisch zur Musterlösung oder KI-Anweisung. Den Prüf-Haken erst nach vollständiger Kontrolle setzen.
6. Speichern legt Frage und Vorschlagsverknüpfung atomar an. Der Vorschlag ist angenommen; die neue Frage bleibt **inaktiv**, ohne Gast-/Übensichtbarkeit und ohne Wochenzuordnung. Erst danach in der Fragenübersicht aktivieren und normal einplanen. Wiederholtes Öffnen führt zum vorhandenen Entwurf; Doppelspeichern erzeugt keinen zweiten.

Manuelle Frage: dieselben beiden Kennzeichnungen im Editor, bei Name zusätzlich Zustimmung bestätigen. Der Quellentyp bleibt unabhängig. Abschalten ist dort ebenfalls möglich. Für alte Vorschläge wird keine Zustimmung angenommen. Bearbeitung durch den Obmann kann die Einwilligung des Schiris nicht erhöhen: maßgeblich bleibt die letzte von der Person selbst eingereichte Version.

## Geburtstagsjoker

- Ein privater **Serienjoker** pro Geburtstag ab 16.10.2026; kein Punktebonus und kein Überspringen des Pflichtquiz. Vorherige Geburtstage werden nicht nachgetragen.
- Aktiver eigener PIN-Zugang, hinterlegtes Geburtsdatum, Person spätestens am Geburtstag angelegt. Erscheint bei nächstem Aufruf der eigenen Quizstatistik; kein täglicher Hintergrundjob, keine neue Geburtstagsmail.
- Ein Jahr gültig; 29.02. wird für das Geschenk in Nicht-Schaltjahren am 28.02. berücksichtigt. Die vorhandene Obmann-Geburtstagsanzeige wird dadurch nicht verändert.
- Einsetzbar innerhalb der bestehenden sieben Tage nach Ende einer unvollständigen Quizwoche. Bereits vollständige/durch Üben gerettete, laufende, leere oder fremde Wochen sind ausgeschlossen.
- „Dein Quiz“ → „Wochenserie, Abzeichen & Geburtstagsjoker“. Verbrauch mit eigener Bestätigung. Alternativ bleiben fünf verschiedene richtige Übungsantworten kostenlos als Rettung möglich.
- Vergabe und Verbrauch serverseitig gesperrt/idempotent, Rohdaten nicht direkt über die Data API les-/schreibbar. Geburtstagsdaten und Joker erscheinen nicht in öffentlichen Listen. Historische Serienrettung bleibt nach Ablauf des Jokers sichtbar.

## Gemeinsame Abnahme

Einmal Vorschlag ohne Kennzeichnung, einmal nur Gruppe, einmal mit Namen; Status/Rückfrage, Übernahme, fehlende Felder, erneut öffnen, inaktiv kontrollieren und anschließend bewusst einplanen. Mobile Auswahl und Mac-Editor gemeinsam prüfen. Keine echten Quizantworten oder Nachrichten für technische Tests erzeugen.

Die Rollbacktests verwenden ausschließlich isolierte Testvereine und Personen. Browserprüfungen verwenden simulierte RPC-Antworten. Automatische WCAG-Checks ersetzen keine vollständige Prüfung mit Assistenztechnik oder echten Geräten.
