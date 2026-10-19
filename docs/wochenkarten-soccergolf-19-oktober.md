# Wochenkarten, Startseite und Soccer-Golf – 19.10.2026

## Fertig gebaut

- Wochenkopf ist eine einzige native Summary-Klickfläche ohne sichtbaren Pfeil oder Öffnen-/Schließen-Beschriftung; Enter/Leertaste bleiben möglich. Klare Fokusmarkierung.
- Vier Statuszahlen als beschriftete Farbkreise. Der Balken bildet die tatsächliche Anzahl ab; z.B. 1 richtig/0 Rückfragen/3 falsch/1 offen ergibt 20/0/60/20 %. Keine feste Fünferannahme im Code.
- Aufgeklappte Fragen als dezent gefärbte, umrandete Kacheln, am PC adaptives Raster, mobil untereinander. Textfragen vollständig, Video-/Bildfragen weiter neutral ohne interne Titel/Antworten/Lösungen.
- Serienrettung warm orange hervorgehoben, erloschene Flamme bleibt grau. Kennzahlen und Deutung unangetastet.
- Startseiten-Quizwidget nur noch Icon, Titel und CTA; zugehörige redaktionelle Textvorgaben aus HTML neu generiert, ohne reale redaktionelle Inhalte umzuschreiben. Werbeaufmacher am PC etwas höher, mobile Grundhöhe bleibt.

## Soccer-Golf pflegen

Website → Obmann-Zugang → **Soccer-Golf** → Obmann-Passwort → vorhandenes vergangenes Event auswählen. Es wird kein zweiter Termin angelegt. Auch andere vergangene Events können einen solchen Rückblick bekommen; maximal 250 zur Auswahl.

Anzahl Bahnen wählen (1–36). Eine Zeile pro Person, durch Semikolon oder eingefügte Tabulatoren getrennt:

```text
Anzeigename; Bahn 1; Bahn 2; …
```

Die Zeile braucht genauso viele Werte wie Bahnen. Leer/– bedeutet nicht erfasst, ausdrücklich nicht 0. Ganze Schlagzahlen 1–99, höchstens 60 Personen. Anschließend Vorschau → Entwurf speichern oder Rechte-/Namensprüfung bestätigen und für Verein veröffentlichen. Keine freie HTML-/JSON-Eingabe nötig. Fehler lassen die Eingabe stehen; Revision schützt gegen Überschreiben anderer Änderungen. Veröffentlichung lässt sich zurückziehen, Entwurf bleibt erhalten. Änderungen am Entwurf sind nicht automatisch sichtbar.

Rückblick am ursprünglichen Termin: warmer grüner Hintergrund, Top-3-Karten, vollständige horizontal scrollbar bedienbare Bahntabelle, Summe/Rang, optional Erinnerungstext und Anlagenplan. Kleinere Summe gewinnt. Gleiche Summen teilen denselben Platz (1,1,3), kein erfundenes Stechen. Nur vollständig erfasste Runden erhalten Rang/Podium; Teilrunden mit Zwischenstand und erfassten Bahnen separat am Tabellenende. Keine Verbindung zu Quizpunkten oder Jokern.

## Tatsächliche Daten und Bildquelle

Der bestehende Soccer-Golf-Termin vom 17.10.2026 ist vereinsintern vorhanden. **Es liegen keine echten Bahnwerte/Platzierungen vor; keine Ergebnisdaten veröffentlicht oder erfunden.** Der ursprüngliche Termin und seine Antworten/Protokolle wurden nicht verändert.

Anlagenplan aus Max' Oktober-Protokoll wiederverwendet, unverändert kopiert:
`/Volumes/My Passport/Claude/Claude-Code/Ausgaben/Schiri/Protokolle/2026-10-12/map.png`
→ `bilder/termine/soccergolf-anlagenplan.png`.
Quelle laut Protokoll: SoccerGolf Sachsen, https://www.soccergolf-sachsen.de/ . Keine KI-Grafik und keine neu erzeugte Karte. Beim neuen Entwurf vorbelegt, erst bei bewusster Veröffentlichung angezeigt. Nutzungs-/Bildrechte und die zulässige Namensanzeige müssen vor Veröffentlichung geklärt sein; die Checkbox ist eine redaktionelle Bestätigung, keine fingierte Einwilligung jeder Person. Externer Link bezeichnet Betreiber/Plan; Standard führt zur Betreiberwebsite, nicht zu einer nachgewiesenen direkten Plan-Datei. Keine externen Bilder/Tracker automatisch geladen; Bildadressen auf eigene lokale Dateien und bestehenden Website-Bucket begrenzt.

## Datenbank / Zugriffsmodell

Migration `20261019151824_soccergolf_termin_rueckblick` live und lokal identisch versioniert. Eigene Tabelle `private.soccergolf_rueckblicke`, RLS ohne API-Policies und ohne anon/auth-Tabellenrechte; keine Erweiterung alter Termin-Feeds oder App-Modelle. Obmann-Lese-/Schreib-RPC mit vorhandener serverseitiger Obmann-Passwort-/Vereinsprüfung. Eigene schmale Mitglied-RPC mit aktiver PIN-Prüfung, gleichem Verein, Mitgliedersichtbarkeit und nur veröffentlichter Fassung. Auch bei öffentlichem Event bleiben Ergebnisse privat. Keine externen Services/Schlüssel/Benachrichtigungen neu eingerichtet.

Speichern unter kurzer Sperre auf dem zugehörigen Termin und optimistischer Revision; JSON-Größe und Wertbereiche serverseitig geprüft. Entwurf/Veröffentlichung separat. Datentyp-Antwortpfad der neuen JSON-RPC explizit freigeschaltet; alte Listen-RPCs unverändert.

Security-Advisor vorher/nachher: 67→68 RLS-ohne-Policy (neue absichtlich private Tabelle), 256→259 anon- und 223→226 authenticated-Definer (drei absichtlich Passwort-/PIN-geprüfte RPCs), Leaked-Password-Hinweis 1 unverändert. Kein pauschales Sicherheitszertifikat. Hinweise: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy und https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .

## Prüfung / Übergabe

- 862 Webtests, 139 JS-Modulsyntaxprüfungen grün.
- SQL-Rollbacktest: Entwurf unsichtbar, Veröffentlichung, Fremdverein/falsches Passwort/falsche PIN abgewiesen, ungültiger Bahnwert, fehlende Freigabe, Revisionkonflikt, neuer Entwurf ohne Überschreiben der Veröffentlichung, Rücknahme, App-Sichtbarkeit, fehlende Direktrechte. Danach 0 Testvereine und 0 gespeicherte Rückblicke.
- 23 lokale Browserzustände ohne automatische axe-A/AA-Funde, JS-Fehler oder horizontalen Seitenüberlauf, mit künstlichen Personen/Ergebnissen und simulierten Editor-RPCs; 2 simulierte/0 echte Schreibaufrufe. 320/390/768/1280 px, Wochenkarte mit Tastatur und Mausklick, Statusanteile 20/0/60/20, Startwidget ohne Zusatztexte, Golf-Podium/Tabelle/Plan, Editor-Vorschau, erforderliche Freigabe und Fehler ohne Eingabeverlust. 200 % Schrift/Textabstände bei Startseite, Statistik, Rückblick und Editor sowie Gast ohne private Ergebnisse geprüft. Die breite Bahntabelle bleibt als eigene beschriftete Tastatur-/Scrollregion bedienbar. Keine pauschale WCAG-Abnahme oder echte iPhone-Safari-Abnahme behaupten.
- Keine native App geändert; Pflege dieser ersten Fassung im Website-Obmannbereich. Kein Commit/Push/Deployment; Max übernimmt.

Nächster Schritt: echte Zählkarten/Fotos/Tabelle von Max erhalten, Namen/Bildrechte prüfen und Ergebnisse bewusst am bestehenden Termin veröffentlichen. Danach echte Mitglieder-/Gast-/Fremdvereinsabnahme auf Geräten.
