# Quiz-Einstieg und Mac-Einstellungen – 19.10.2026

## Umgesetzt

„Zum Quiz“ öffnet für alle dieselbe Auswahl, statt fehlende Anmeldung als Gastwunsch zu interpretieren. „Fragen dieser Woche“ steht blau und über die gesamte Inhaltsbreite zuerst. Für nicht angemeldete Personen heißt die Aktion „Anmelden & starten“; sie öffnet den bestehenden universellen Anmeldedialog. Nur eine ausdrückliche Gastwahl führt zu `quiz.html#gast`. Abbrechen navigiert nicht weiter. Falls das Dialogskript nicht verfügbar ist, bleibt der normale Wochenquiz-Link zur vorhandenen Anmeldung auf `quiz.html` nutzbar. Geteilte Gastlinks bleiben erhalten.

Üben bleibt bis zum vollständigen Wochenquiz gesperrt. Quiz-Duell bleibt als nachgeordneter vorhandener Modus; keine neue Duellfunktion. Entscheiden wird nicht mehr als leeres Angebot gezeigt; bestehende Daten/URLs/Serverfunktionen werden nicht gelöscht. Die gemeinsamen Textreiter bleiben.

### Einstellungen

Mac: Das erste Einstellungs-Form hatte bereits `.formStyle(.grouped)`, die Navigationsziele nicht. Jedes Einstellungs-Form verwendet jetzt denselben gruppierten Stil und erhält die volle verfügbare Fläche mit oberer Ausrichtung. Keine neue iPhone-Menühierarchie oder grundlegende Neugestaltung des von Max positiv bestätigten iPhone-Layouts.

Fragen & Filter trennt lokale Filteranzeige vom gemeinsamen Quellenkatalog. Bei Medium, Antworttyp, Regel und Schwierigkeit lassen sich auch einzelne Filterwerte benennen. Änderungen bleiben bis „Änderungen speichern“ im Entwurf; Originalnamen lassen sich wiederherstellen. Nur vorhandene technische Werte dürfen Aliasnamen erhalten. Neue Medien/Antworttypen werden nicht als funktionslose freie Datensätze erzeugt. Aliasnamen gelten ausdrücklich für die Filterleiste auf diesem Gerät, nicht als neue fachliche Fragetypen oder Website-Bezeichnungen.

„Quellen verwalten“ ist direkt von Fragen & Filter sowie von Quelle aus erreichbar. Jede Quelle öffnet Namen, Untergliederung, deren Bezeichnung und mehrzeilige Auswahlvorschläge. Neue Quelle über „Quellenart hinzufügen“. Deutliche Speicheraktion, Fehler behalten den Entwurf. Reversibles Archivieren bleibt erhalten.

### Bestandsdaten

Keine neue Migration nötig: `fragen_quellenkatalog.typ` ist bereits der stabile Schlüssel für `fragen.quelle_typ`. Name und Detailbezeichnung sind Metadaten. Beim Umbenennen bleibt die Kennung gleich, bestehende Fragen zeigen beim nächsten Abruf den neuen Namen. Bestehende `quelle_detail`-Angaben werden nicht ersetzt oder gelöscht. Änderung der Ausgabevorschläge ist keine automatische Umbenennung alter Ausgaben.

Live nur gelesen: 139 Fragen mit Quellenangabe, keine davon ohne passenden Katalogeintrag. Anlegen, Umbenennen, Untergliederung, bestehende Frage/Ausgabe, veraltete Revision und Berechtigung wurden mit ausschließlich synthetischen Datensätzen in `BEGIN`/`ROLLBACK` geprüft. Anschließend 0 Testvereine, Testfragen und Testquellen. Keine echten Quellennamen geändert.

## Neuer Entscheiden-Modus – Konzept, nicht gebaut

Arbeitstitel **Szenencheck**. Das ist eine private Einschätzungsrunde im eigenen Verein, keine Prüfung und kein Wettbewerb darum, wem man „vertrauen“ sollte. Kein richtig/falsch, keine Punkte, kein Einfluss auf Wochenpflicht, Serie, Abzeichen oder Joker ohne neue ausdrückliche Entscheidung.

1. Max legt in der App eine Runde mit mehreren Clips an: Videoquelle, Start/Ende, kurze neutrale Szenenbeschreibung. Dasselbe Spiel kann viele Ausschnitte liefern. Keine Pflicht zu genau 20 neuen Videos pro Woche; die redaktionelle Kapazität entscheidet.
2. Schiri sieht einen Clip und entscheidet **Foul / kein Foul**. Keine Mustervorgabe und keine KI-Bewertung. Ein freiwilliges Begründungsfeld wäre erst eine spätere Option.
3. Erst nach eigener Abgabe wird die Gruppenverteilung sichtbar, damit die Meinung anderer nicht vorab lenkt. Benannte Einzelstimmen sind für Max gewünscht, benötigen bei dieser jungen Zielgruppe aber vor Veröffentlichung eine klare, verständliche Freigabe. Keine Namen oder fremden Antworten aus dem aktuellen Quiz wiederverwenden.
4. Obmann sieht offene Teilnahme und Verteilung je Szene; interessante Unterschiede können beim Treff besprochen werden. Kein öffentlicher Vertrauens-/Kompetenzrang.
5. Eigene neue Datenstruktur und serverseitige Vereins-/Zugangskontrollen, nicht den vorhandenen Icon-Antworttyp zweckentfremden. Website als schlanker Player; App als Editor und Auswertung. Alte Szenarien weder löschen noch automatisch migrieren.

**Zweimal ansehen:** Das ist eine technische Prüfbedingung, keine fertige Zusage. Bei eigenen freigegebenen Dateien kann der eigene Player Abspielstarts zählen; tatsächliches vollständiges Anschauen ist damit nicht beweisbar, externe Kopien lassen sich nicht verhindern. Bei YouTube/Staige muss zunächst geprüft werden, welche Start-/Ende-/Wiedergabeereignisse der offiziell eingebettete Player zuverlässig bereitstellt. Keine verlässliche Zweimalgrenze oder Entfernung von Werbung behaupten. Ein Rundenlimit darf nicht schon durch einen Werbeclip, fehlgeschlagenes Laden oder Gerätewechsel verbraucht werden. Keinen Stream herunterladen/abschneiden oder Werbung umgehen.

Vor Bau gemeinsam festlegen: verbindliche oder nur empfohlene Zweimalgrenze; Umgang mit technisch ungeeignetem Fremdplayer; Namensanzeige/Freigabe; Zeitpunkt der Gruppenauflösung und Rundentakt. Dieses Paket enthält nur das Konzept, noch keinen neuen Modus oder App-Editor.

## Abnahme

849 Webtests, 137 Modul-Syntaxprüfungen plus `seite.js`, 69 App-Unit-Tests sowie macOS- und iOS-Simulator-Build erfolgreich. Bekannte MainActor-Warnung in der Terminfindung unverändert. 16 lokale Browserzustände mit künstlichen API-Daten: Startseite → Zum Quiz → Wochenquiz-Anmeldung, bewusster Gastwechsel, angemeldet/nicht angemeldet, Üben-Freigabe, 320/390/768/1280px sowie 200% Schrift/Textabstände. Keine automatischen axe-WCAG-A/AA-Funde, Seitenfehler oder horizontalen Überläufe in diesen Zuständen, 0 echte Schreibaufrufe. Anmeldeabschluss/Gastwahl/Abbruch zusätzlich im Modullauf geprüft; kein echtes Mitgliedskonto benutzt.

Website nicht durch den Assistenten veröffentlicht; Max übernimmt Commit/Push und die neue App-Installation. Optische Abnahme der Mac-Unterseiten sowie echte iPhone-/Safari-Bedienung bleiben ein eigener Schritt. Keine pauschale WCAG-Zertifizierung oder vollständige native UI-Abnahme behaupten.
