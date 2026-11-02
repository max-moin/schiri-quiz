# Quiz-Ausbau · 31. Oktober 2026

## Stand und Abgrenzung

Lokale Änderungen für Website und native Obmann-App. Kein Commit, Push,
Deployment, Geräteinstallation oder Datenbankeingriff. Keine echten Antworten,
Fragen, Stimmen, Bestände, Fristen oder Veröffentlichungen geändert. Keine
echten Gemini-Anfragen; Anbieter und bestehende Freigabesituation unverändert.

## Freitext: fachliche Nähe und Punkte getrennt

Im App-Frageneditor erhält jedes aktive Kriterium zusätzlich:

- ausdrücklich falsche Aussagen als kurze Gegenbeispiele;
- optional 0–20 Pluspunkte bei erfüllt und 0–20 Minuspunkte bei widersprochen.

Die bestehende Nähe-Gewichtung 0–5 bleibt unverändert und ist KEIN Punktwert.
Der neue Punktemodus ist pro Frage aus, bis er eingeschaltet wird. Standard:
**mehr als 5**, also genau 5 reicht nicht. Die Schwelle ist einstellbar; mit
aktiven Pluspunkten unerreichbare Konfigurationen werden im Editor blockiert
und auf dem Server abgewiesen. Fehlend gibt null Punkte, jedes Kriterium zählt
einmal. Wiederholungen derselben Aussage vervielfachen die Punkte nicht.

Vorhandene Folgen bleiben maßgeblich: „Sofort falsch“ ist ein Veto, auch bei
vielen Pluspunkten. Eine nachzufragende Pflichtlücke bleibt offen; eine hohe
Summe ersetzt diese Pflichtangabe nicht. Bei weichen Kriterien muss Max die
Folgen bewusst entsprechend einstellen. Alte Fragen bekommen nicht automatisch
neue Punktwerte oder geänderte Beurteilungen.

Gemini bestimmt weiterhin die semantischen Kriterienstatus. Nur der Server
rechnet und leitet den Gesamtstatus ab. Punktwerte werden nicht ans Modell
geschickt. Neue Gegenbeispiele gehen kompakt als `falsch` mit. Richtige und
gegenteilige Aussage zum selben Kriterium → widersprochen. Zusätzliche klare
relevante Falschbehauptungen außerhalb der Kriterien werden separat geprüft;
Namen, Tippfehler, bloßes Fehlen und harmlose Nebensätze sind kein pauschales
Veto. Das ist keine Garantie fehlerfreier KI-Semantik: echte freigegebene
Antwortfälle später gezielt abnehmen.

Speicherung rückwärtskompatibel im bestehenden geschützten Hinweisfeld, keine
neue Datenbankspalte: `KI-KRITERIEN-JSON` plus optional `KI-PUNKTE-JSON`.
App und Website sollten zusammen aktualisiert werden, bevor neue Punktfragen
veröffentlicht werden. Ältere App-Versionen kennen die neuen Felder nicht und
könnten diese beim Bearbeiten einer neuen Rubrik verlieren.

## Ort sinngemäß vergleichen

Weitere eindeutige Varianten wie Tatort, Vergehensort und „an der Stelle, an
der das Foul passiert ist“ werden lokal normalisiert. Negationen/Alternativen
gehen zur Kontextprüfung. „Wo der Ball aufgehalten wird“ wird nicht pauschal
als falsch abgewiesen und auch nicht blind mit dem Vergehensort gleichgesetzt:
Die vorhandene KI-Ortsprüfung erhält die konkrete Szene und prüft, ob beide
Orte dort zusammenfallen. Ballort bei Unterbrechung, letzte Berührung und Ort
des Vergehens bleiben grundsätzlich unterscheidbar. Beide vorhandenen
Ortsprüfpfade wurden angepasst; keine Anbieter-/Freigabesperre aufgehoben.

## Einwurf-Hinweis

App → Frageneditor → Antwort-Hinweis bzw. Video-Fallback → „Einwurf: fünf
Prüfpunkte ergänzen“. Fügt die fünf Ausführungspunkte einmalig an, vorhandener
Text bleibt. Vorlagenquelle: [IFAB, Regel 15.1](https://www.theifab.com/laws/latest/the-throw-in/).
Nicht mit dem Fünf-Sekunden-Countdown verwechseln. Konkrete Freitagsfrage ist
noch nicht eindeutig identifiziert und wurde nicht live verändert. Max kann
die Vorlage gezielt dort einsetzen oder die Frage zur Zuordnung nennen.

## Szenencheck: erster echter Entwicklungsschritt

App → Modi → **Entscheiden · Szenencheck**. Vorhandener benoteter Szenariomodus
bleibt separat. Jetzt vorhanden:

- lokaler versionierter Geräteentwurf (kein Konto-/Vereins-Sync);
- Rundentitel, Beginn/Schluss und 1–30 Szenen (zehn als Richtwert);
- sichere YouTube-Links, Start-/Endzeit, Kontext und Typ je Szene;
- Pfiff-Check, Karten-Check oder beide Achsen; passende Icon-Karten;
- Auswahl wechseln, zurück/weiter, „Nicht beurteilbar“ als getrennte Enthaltung;
- lokale Vorschau, keine echten Stimmen, keine Richtig-/Falsch-Wertung.

Entwurf speichern ist auch unvollständig erlaubt; Vorschau erst bei gültigem
Entwurf. Unlesbarer/fremdversionierter gespeicherter Entwurf wird nicht still
überschrieben. Das Video wird in diesem ersten nativen Probelauf extern auf
YouTube zum Startpunkt geöffnet; Ende selbst pausieren. Das ist noch NICHT
der geplante eingebettete Website-Quizmodus oder ein fertiger Player-Test.

### Nächste Bauabschnitte und fachliche Entscheidungen

1. Getrennte vereinsgeschützte Datenanbindung und Website-Arbeitsraum im
   vorhandenen Quizdesign. Keine Umdeutung alter Szenarien/Antworten.
2. Eigenes Votum bis Frist änderbar; Rundenschluss serverseitig erzwingen;
   Revisionen nach ersten Stimmen sperren/versionieren.
3. Vor Start Sichtbarkeit ausdrücklich erklären. Pilotvorschlag: Max sieht
   Einzelvoten; Gruppe nach Schluss nur Aggregate plus eigenes Votum, keine
   Namen/Kürzel. Nicht als anonym bezeichnen.
4. Gruppenwerte und Feldentscheidung vor Schluss auch serverseitig nicht
   ausliefern. Rückblick mit sauberem Nenner, Enthaltungen separat; reale
   Feldentscheidung/belegte Statements nur Kontext, keine Musterlösung.
5. Keine KI, Punkte, Joker, Serien oder Wochenquizwertung; kein künstliches
   Wiederholungslimit im ersten Pilot. Noch keine Veröffentlichungstaste.

Antwortumfang ist im ersten Modell bewusst Pfiff/Karte, noch keine vollständige
Spielfortsetzungs-/Ort-/Mannschaftsabfrage. Pilotgestaltung und individuelle
Sichtbarkeit vor echter Teilnahme gemeinsam bestätigen. Vorhandene HRT-
Besprechungsansicht bleibt ein eigener offener Backlogpunkt, nicht Bestandteil
dieses Auftrags.

## Verbandsunterlagen direkt herunterladen

Unterlageneditor: Original-/Quellenlink bleibt `href`; hinzu kommen registrierte
lokale `datei` und sichtbarer `stand`. Nur tatsächlich mitgelieferte Dateien
sind auswählbar. Öffentliche Darstellung: großer Downloadlink direkt zur
Website-Datei, kleiner separater Quellenlink. Kein beliebiger Fremd-Download,
keine Proxy-API, kein Upload-Formular und kein stiller Fassungstausch.

Die bereits vorhandene Datei `dokumente/hausregeltest-1-2026-2027.pdf` ist
registriert und im statischen Ausgangsstand als eigener Test-1-Eintrag
angeboten. Bestehende veröffentlichte redaktionelle Unterlagen werden nicht
automatisch überschrieben: dort Eintrag ergänzen/zuordnen und bewusst
veröffentlichen, nicht unbesehen alle Standards zurücksetzen.

**Noch offen:** weitere gewünschte SFV-/SVFD-Dateien in passender Fassung und
zulässiger Weitergabe einbinden. Solange keine lokale Datei hinterlegt ist,
bleibt das Original erreichbar. Nicht behaupten, alle Dokumente bereits
gespiegelt oder ihre Fassung fachlich freigegeben zu haben.

## Prüfung und eigene Klickabnahme

- 919 Website-Tests und JavaScript-Syntaxprüfung grün.
- Vier neue native Modelltests grün; Mac- und iOS-Simulator-Build grün.
- Browser: 320/390/768/1280 px ohne Überbreite, Suche, Quelle und echter lokaler
  PDF-Download funktionieren; externe Anfragen dabei blockiert. Handybild
  sichtbar geprüft. Keine Safari-/VoiceOver-/echte Geräteabnahme.
- Keine echten KI-Aufrufe oder Teilnehmerantworten für Tests verwendet.

Nach eigener Veröffentlichung/Installation prüfen:

1. Einwurf-Hinweis einmal und zweimal ergänzen, bestehenden Text erhalten.
2. Rubrik mit richtigen/falschen Aussagen speichern und wieder öffnen. Punkte
   einschalten; unerreichbare Schwelle erkennen, Nähe-Gewichtung unverändert.
3. Erst mit freigegebenen Testfällen: sechs Punkte grün, fünf nicht grün,
   falsche Kernkarte trotz hoher Summe rot, echte Pflichtlücke orange, zusätzliche
   klare falsche Aussage nicht grün. Semantik getrennt vom Rechenweg prüfen.
4. Szenenentwurf speichern/erneut öffnen, unterschiedliche Typen ausprobieren,
   beide Achsen ausfüllen, Enthaltung setzen, zurückgehen. Kein Live-Votum erwarten.
5. Unterlagen lokal zuordnen, Stand und Quelle lesen, Download am Handy öffnen;
   unverknüpfte Einträge weiter beim Verband erreichbar.
