# Freiwilliger Einstieg und kontextuelle Hilfe

## Gebaut am 11.10.2026

- Eine gemeinsame Inhaltsdefinition für Seitenerklärungen und Spotlight-Schritte.
- Einstiegstour mit 18 Schritten auf Start, Termine, Quizübersicht, Ausrüstung,
  Meine Anliegen und Einstellungen. Zusage, Kalender/PDF und Vorschläge werden
  getrennt erklärt; die Tour sendet keine Antworten und öffnet keine echten
  Antragsformulare. Ohne Anmeldung erklärt sie private Funktionen am Zugang,
  ohne fremde Daten oder erfundene Beispiele anzuzeigen.
- Auf den registrierten Fachseiten „Hilfe zu dieser Seite“: ruhige Textübersicht,
  kurze Seitentour, Einstiegstour und Hilfe-Hub.
- Sechs freiwillige, einklappbare Einrichtungsschritte unter Einstellungen.
  Der Benutzer bestätigt selbst „Für mich erledigt“ oder „Auslassen“.
  Kein automatischer Nachweis, dass der Bestand vollständig ist.
- Pfeile vor/zurück, X, Escape, Fokus-Rückgabe und Schutz vor einem Seitenwechsel
  mit ungespeicherten Formulareingaben. Keine zweite Tour über ein offenes Formular.
- Browserlokaler, nach Konto getrennter Fortschritt. Tourzustand nur in der
  Sitzung, maximal 30 Minuten. Ohne funktionierenden Speicher bleibt die
  Seitenhilfe verfügbar; kein stiller Verlust einer seitenübergreifenden Tour.
- Bewegungsreduktion, klar beschriftete Schaltflächen und mindestens 44px hohe
  Bedienelemente. Ziel und Erklärung werden bei Scrollen/Größenänderung aktualisiert.

## Geprüft

18 Schritte im lokalen Browser durchlaufen, Vor/Zurück und Abschluss/Escape;
320, 390, 768 und 1440px breite Ansichten ohne horizontalen Überlauf der Tour.
Checklisten-Fortschritt mit ausdrücklich gekennzeichneten lokalen Testkonten:
bleibt nach Neuladen erhalten, wird beim Kontowechsel getrennt angezeigt.
Automatisierte Tests prüfen Inhalte, gültige Seiten, erlaubte Speicherzustände,
defekte/gesperrte Speicher und abgelaufene Tourzustände.

Keine vollständige WCAG-Zertifizierung behaupten. Die praktische Abnahme auf
Max' echtem iPhone und durch einen neuen/älteren Schiri steht nach Veröffentlichung
aus. Bei authentifizierten Ansichten prüfen, ob der Fokus jeweils auf dem richtigen
Bedienelement liegt; dynamische Listen können anders aussehen als die Gastansicht.

## Bewusst nicht in diesem Schritt

- Kein verpflichtendes Onboarding oder automatischer blockierender Begrüßungsdialog.
- Keine E-Mail-Verifikation, Bankdatenpflicht oder erzwungene Push-Erlaubnis.
- Keine geräteübergreifende Speicherung der Checkliste; dafür wäre eine minimale
  Konto-/Schritt-/Versionsspeicherung als eigener Datenbankbaustein zu planen.
- Keine automatische Bedienung eines fremden Termin-/Quiz-/Antragsformulars.
- Keine privaten Serien, Anstupser, persönliche Übungsfilter oder KI-Fragengenerierung.

## Nächste Abnahme

1. Nach eigenem GitHub-Push: Hilfe öffnen, Einstieg starten, vor/zurück/beenden.
2. Angemeldet: Einstellungen → Dein Einstieg; Schritte markieren und auslassen.
3. Einen Termin mit Rückmeldung und einen ohne Rückmeldung öffnen; dort die
   Seitentour vergleichen. Keine Teilnahme nur für den Tourtest absenden.
4. Ausrüstungsbestand/Anfragen und Punkteübersicht aus eigenem Konto ansehen.
5. Bei Smartphone/PC prüfen, ob die Erklärung das wichtige Ziel verständlich zeigt;
   nötige weitere Detailtouren anschließend nach konkretem Feedback ergänzen.

Push-Pilot: siehe [Klickanleitung](push-einrichtung-max.md).
