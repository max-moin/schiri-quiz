# Ausbaupaket · 17.10.2026

**Neuer Stand18.10.:** Boxen, beide Quizjoker, Vollwertung/Obmann-Auswertung und Startseiten-Fotostrecke sind inzwischen gebaut. Siehe [aktuelles Paket mit Verdienstregeln und Prüfnachweisen](boxen-startbilder-18-oktober.md). Die folgenden Joker-Vorbereitungsangaben dokumentieren den älteren Zwischenstand.

## Fertiger Umfang

- Private Sammlung mit 20 Abzeichen: bisherige acht bleiben erhalten; zwölf neue für perfekte Wochen, Regelwissen, verschiedene Treffer, Dranbleiben trotz Fehlern und übernommenen Vorschlag. Helle Holzvitrine, drei Fächer, offene Bilder grau. Kein öffentlicher Trophäenvergleich.
- Eigene PIN-geprüfte Aggregate aus gespeicherten Antworten und Übungen. Jede Frage zählt für Treffer-/Regelabzeichen nur einmal. Perfekte Wochen brauchen alle echten Wochenantworten richtig; Rettungen sind keine perfekten Abschlüsse. Die reine Teilnahme zählt weiterhin unabhängig von richtig/falsch. Korrekturen wirken bei erneutem Abruf.
- 12 neue generierte Abzeichenmotive und drei einfache Joker-Icons. Nur der bereits gebaute Serienjoker wird als funktional eingebunden. [Bilder, Speicherpfade und vollständige Prompts](abzeichen-ausbau-bilder.md).
- Staige: Quiz lädt jetzt das fehlende gemeinsame Video-Stylesheet. Eigene flexible Werkzeugleiste, große Videozeit, kein schmaler YouTube-Textstreifen. Dunkler ruhiger Hintergrund; X/Escape/Fokusrückkehr, Hintergrund während des Dialogs nicht bedienbar. Offizieller Player/Werbung bleiben unverändert, Ende weiterhin manuell. Zeitangaben beziehen sich auf die Videozeit, nicht automatisch die eingeblendete Spielminute. Szenenbeschreibung schreibt Max selbst in den Fragetext.
- Rollen App/Website/Auswertung: Einwechselspieler, Trainer und Betreuer getrennt. Der alte Schlüssel `trainer` bleibt kombiniert; neuer Einzeltrainer heißt intern `trainer_einzeln`. Alte kombinierte Lösungen akzeptieren beide neuen Einzelrollen, neue Einzelrollen bleiben strikt getrennt. Keine gespeicherten Antworten umgeschrieben. App vor Nutzung der neuen Rollen aktualisieren.
- App → Einstellungen → Fragen & Filter → Schreibhilfen: Fragenformulierungen für Bild/Video und Ausführungsorte hinzufügen, bearbeiten, entfernen und sortieren. Wie die bestehenden Darstellungsfilter auf diesem Gerät gespeichert; kein neuer Synchronisierungsdienst. Änderungen greifen erst beim Einsetzen, nicht rückwirkend in Fragen. Das Diktat „Fragenvorschläge“ ist hier als die Formulierungsauswahl im Editor interpretiert, nicht als frei veränderbare Prüfstatus von Einreichungen.
- Quellenarten bleiben gemeinsame geräteübergreifende Metadaten. Sicheres Archivieren statt hartem Löschen: alte Zuordnungen/Filter bleiben lesbar, Wiedereinblenden möglich, Revisionsprüfung verhindert stilles Überschreiben eines neueren Stands.

## Joker: Aktualisierung 17./18.10.2026

Max hat die Wertung entschieden: Ein mit Joker richtig gelöster Versuch zählt **voll als richtig/grün**, auch für die Statistik. Die Obmann-Ansicht muss zusätzlich den Jokereinsatz auffällig sowie Erst- und Jokerantwort zeigen. Das ersetzt die frühere Empfehlung einer getrennten Vergleichswertung. Diese fachliche Quizwertung und Obmann-Erweiterung sind **noch nicht programmiert**.

**Jetzt gebaut:** Eigene `sammlung.html` unter Quiz, getrennt von Quizstatistik, mit Wochenserie, Jokerbestand und Abzeichenvitrine. Drei anklickbare Jokerbilder: ohne Vorrat grau, vorhandene Serienjoker mit Zähler unten rechts. Erklärdialoge und i-Information mit klarer Trennung zwischen vorhandenem Geburtstagsgeschenk und geplantem Ausbau. 50/50 und zweiter Versuch ausdrücklich noch nicht einlösbar. Keine fingierten Bestände oder Boxzähler.

**Gültigkeit umgesetzt:** Bestehende unbenutzte Serienjoker laufen nicht mehr ab; einmaliger Verbrauch und bisheriges Sieben-Tage-Rettungsfenster der verpassten Woche bleiben. Migration `20261017215550_joker_unbegrenzt` live, nur bestehende Funktionen angepasst. Das alte Feld `gueltig_bis` bleibt aus Kompatibilität erhalten, ist aber keine Einlösebedingung mehr. Keine Geschenke nachgetragen und keine verbrauchten Joker reaktiviert.

**Nächster Ausbau, noch nicht gebaut:** Verdiente Boxen zählen, anklicken, serverseitig zufällig einen Joker erhalten; keine freie Typwahl, kein Kauf und keine zusätzliche Währung. Alle Joker dauerhaft gültig und einmal verwendbar. Zufallsgewichtung und Vergaberhythmus noch abstimmen. Geburtstag ist bisher ein direkter Serienjoker, noch keine Box. Bestätigte Hausregeltest-/Lehrabendteilnahme und ein möglicher Vier-Wochen-Bonus sind nur Vorschläge, keine laufenden Vergaben.

## Fachliche Quizjoker: technische Umsetzung offen

**Max' aktuelle Vorgabe ersetzt den älteren Üben-Vorschlag:** Fachliche Joker nur im regulären Wochenquiz, nicht im freiwilligen Üben. Kein Juwelenladen in diesem Paket. Abzeichen sind Sammelziele, Joker Verbrauchsgegenstände.

Bestehender Geburtstag: ein Serienjoker pro Jahr ab 16.10.2026, keine rückwirkenden alten Geburtstage. Rettet eine verpasste eigene Woche im vorhandenen Sieben-Tage-Fenster; keine Antwort oder Punkte werden ersetzt. Das bleibt aktiv.

Weitere Typen, noch NICHT einlösbar:

1. **50/50:** vor der ersten Abgabe bei einer Einfachauswahl mit wenigstens drei Optionen zwei Kandidaten übrig lassen (einer richtig). Kein Einsatz bei Mehrfachauswahl, Zahlen, Freitext oder strukturierten Entscheidungen. Server wählt erlaubte Optionen; kein freies Lösungslesen im Browser.
2. **Zweiter Versuch:** nach endgültig falschem ersten Versuch, aber bevor die Lösung herausgegeben wurde. Bestätigung im Dialog; Abbrechen zeigt die normale Lösung und gibt keine weitere Chance. Ohne Joker läuft alles wie bisher. Serverseitig angebotenen Zustand über Neuladen erhalten; Lösung wirklich zurückhalten, nicht nur nach Rückgabe verstecken. Bestehende KI-Nachbesserung/Orange ist ein anderer Ablauf und muss zuerst beendet sein. Fehlversuch und Jokerverbrauch getrennt protokollieren; atomarer Verbrauch gegen zwei Geräte. Keine rückwirkende Wiederöffnung bereits aufgelöster Antworten.
3. Mögliche weitere Idee: einmaliger **Hinweisjoker** statt weiterer Punktewährung – nennt den Regelbereich, verrät aber nicht die konkrete Entscheidung. Erst nach Freigabe.

Vor Umsetzung entscheiden:

- **Wertung bestätigt:** finalen Jokererfolg voll werten, Joker und beide Antworten in der Obmann-Auswertung erkennbar machen. Serverseitige Bewertung, Statistikaggregate und Obmann-Ansicht müssen gemeinsam angepasst werden; kein bloßes grünes Frontend-Label.
- **Verdienst offen:** bestätigte Hausregeltest-/Regellehrabend-Teilnahme und vier vollständig abgeschlossene Wochenquiz sind Vorschläge. Keine Belohnung nur für Zusage, keine Doppelvergaben. Zufallsjoker aus Box statt freier Wahl ist bestätigt, genauer Rhythmus noch nicht.

Nicht in diesem Paket: Soccer-Golf-Ergebnistabelle am vorhandenen Termin (Bahnversuche, Summe, Rang/Top 3) als nächster separater Wunsch vorgemerkt. Ergebnisse und Freigabe der Namensanzeige fehlen. Keine automatische Erinnerung eingerichtet. Eigene KI-Stimme später; Anstupsen, Kommunikationstraining, Kalenderabo, Üben-Ausblenden und voller Webarbeitsplatz bleiben zurückgestellt. KI-Fragenbaukasten wieder als mögliche nächste Konzeptarbeit, nicht automatisch begonnen.

## Sicherheits-/Abnahmegrenze

Keine echten Quizantworten, Jokervergaben, Push-/Mail-Sendungen oder CMS-Veröffentlichungen als Test. SQL-Prüfungen ausschließlich mit synthetischen Daten in BEGIN/ROLLBACK. Bestehende PIN-/Obmann-Zugänge unverändert, kein neuer Authentifizierungsumbau. Automatische WCAG-Prüfung ist keine vollständige Konformitätszertifizierung; echtes iPhone/Staige-Werbung/Browserhandling noch gemeinsam prüfen.

Der Supabase-Advisor listet den neuen absichtlich per PIN aufrufbaren `SECURITY DEFINER`-Statistik-Endpunkt zusätzlich für anon/authenticated. PIN, Fremdzugriff und minimale reine Aggregatausgabe werden separat geprüft; die allgemeine Warnung wird nicht als behobener Plattformbefund ausgegeben. [Supabase-Hinweise zu Funktionsberechtigungen](https://supabase.com/docs/guides/database/functions#function-privileges). Die vielen bereits vorhandenen Advisor-Hinweise sind kein neuer Gesamtaudit dieser Runde.

Auch die passwortgeprüfte Archivierungsfunktion wird von derselben generischen Prüfung zusätzlich aufgeführt. Vorher/nachher: RLS ohne Policy64 unverändert; anon-Definer249→251, authenticated216→218, bestehender Leaked-Password-Hinweis1 unverändert. Kein neuer Tabellenzugriff; die beiden neuen Funktionszugänge sind absichtlich geprüft erreichbar.

## Technischer Prüfstand

- 826 Webtests bestanden.
- 65 App-Unit-Tests bestanden, macOS und iOS-Simulator-Build erfolgreich. Eine bereits bestehende MainActor-Warnung in `TerminfindungVerwaltungView.swift` bleibt außerhalb dieses Pakets.
- 33 lokale Browserzustände: fünf Bildschirmgrößen inklusive320px/iPhone-Querformat; tatsächlicher Quiz-Kartenrenderer mit künstlich abgefangenen RPC-Daten, Rollenwahl, 20 Bilder, Dialoge/X/Escape/Fokusrückgabe; zusätzlich200%Schrift mit Textabständen und simulierter Ausfall der neuen Zusatzstatistik. Keine automatischen axe4.10.3-WCAG-A/AA-Funde, Seitenfehler oder horizontalen Überläufe.
- Der Fremdplayer wurde für die Layoutprüfung durch ein deutlich als lokal markiertes 16:9-Testiframe ersetzt. Das ist keine Behauptung einer vollständigen realen Staige-/Werbe-/Safari-Abnahme. Vor dem bewussten Öffnen kein Playerabruf, nach Öffnen korrekt erzeugte offizielle Embed-Adresse geprüft.
- Zwei isolierte SQL-Rollbacktests nach Anwendung: Rollenmatrix/Altrollen/Schreib-Lesepfad, reine private Zähler/PIN-Grenzen; Quellenarchiv/Reaktivieren/Revisionskonflikt/Bestands-FK. Anschließend0Testpersonen,0Testzugänge,0Testquellen nachgewiesen.
- Migrationen live: `20261017212425_rollen_einwechselspieler_trainer_betreuer`, `20261017212442_sammlung_zwanzig_abzeichen`, `20261017213709_quellenarchiv`. Lokale Dateinamen an die tatsächlichen bestätigten Serverversionen angeglichen.

Commit/Push und öffentliche Auslieferung übernimmt Max wie bisher.

### Nachprüfung Sammlung/Joker am 17./18.10.

830 Webtests bestanden. 54 lokale Browserzustände ohne automatische axe-A/AA-Funde, Seitenfehler oder horizontalen Überlauf; 320/390/844quer/768/1280px, Vorrat0/2, alle Joker-/Infodialoge, Escape/Fokus, getrennte Statistik und Quiznavigation,200%Schrift plus Textabstände. Der neue Navigationslink brauchte dafür einen flexiblen Umbruch. Nur künstliche RPC-Antworten,0Schreibaufrufe im Browser.

SQL-Rollbacktest nach Live-Migration: synthetischer alter unbenutzter Joker trotz altem Ablaufdatum verfügbar/einlösbar, falsche PIN abgelehnt, kein Doppelverbrauch. Anschließend0Testpersonen/-vereine/-runden/-fragen. Advisor unverändert64/251/218/1 in den oben dokumentierten Kategorien. Keine vollständige WCAG-Zertifizierung und keine echte Endgeräteabnahme.
