# Freitext-Kriterien und kompakter Staige-Player – 19.10.2026

## Bedienung und Bewertung

Im nativen Freitext-Frageneditor kann jedes Kriterium an-/ausgeschaltet und von 0 bis 5 gewichtet werden. Ausgeschaltete Angaben bleiben gespeichert. Die Zahl beschreibt semantische Nähe, **keinen verrechneten Punktescore**:

| Wert | Anspruch |
| --- | --- |
| 0 | sinnvoller Bezug zur Situation |
| 1 | grobe plausible Richtung |
| 2 | Hauptgedanke |
| 3 | wesentliche Aussage sinngemäß |
| 4 | entscheidende Details genau |
| 5 | fachlich vollständig |

Synonyme gelten auf jeder Stufe gleich. Persönliche Strafe standardmäßig 5, mindestens 4; Gelb/Verwarnung und Rot/Feldverweis gleichwertig, soweit nicht ausdrücklich Feldverweis auf Zeit gemeint ist. Bestehende Rubriken bleiben lesbar, ohne Angabe Stufe 3 (persönliche Strafe mindestens 4). Folgen von Fehlen/Widerspruch bleiben separat konfigurierbar.

Nichts fachlich getroffen: falsch statt kostenloser Ergänzung. Mindestens ein erfülltes Kriterium und eine echte behebbare Lücke können weiterhin Orange ergeben. Ein ausdrücklich ungültiger Modellbefund überstimmt einen widersprüchlichen Status. Bei einer alten offenen Rückfrage prüft die KI auch den ursprünglichen Text; sachfremder Unsinn soll nicht durch bloß nachgereichte Lösungswörter geheilt werden. Keine Wort-Blacklist; die semantische Einordnung bleibt modellabhängig. Bereits abgeschlossene Bewertungen werden nicht umgeschrieben.

Aktive Kriterien gehen kompakt mit Positions-ID, Erwartung, anerkannten Formulierungen und Gewicht an Gemini. Auswirkungen und vorbereitete Rückfragetexte verbleiben beim Server. Zusätzliche redaktionelle Hinweise bleiben erhalten. Repräsentativer Vergleich einer Zweikriterienfrage: 8.273 → 4.053 Promptzeichen (ca. 51 % weniger Zeichen, **keine exakte Tokenmessung**). Kein zusätzlicher KI-Aufruf, kein Provider-/SDK-Wechsel.

## Dortmund

Die bestehende Frage wurde mit exaktem Altwertvergleich unter kurzer Zeilensperre angepasst: Begründung 1, persönliche Strafe 5. Alle anderen Kriterien und Frage-/Mustertexte unverändert. Keine Antworten geändert. Backup außerhalb der öffentlichen Website: `/private/tmp/sr-bewertung.hGTtSW/dortmund-rubrik-vorher.json`.

Die Metadaten stehen bereits in der DB; die neue Gewichtungslogik wird erst nach Veröffentlichung des Backends wirksam. Neue App installieren, bevor diese Rubriken wieder gespeichert werden: alte Appversionen kennen die Zusatzfelder nicht. Keine neue Migration.

## Staige

- Offizieller Embed bleibt; Laden erst nach bewusstem Klick samt Datenübertragungshinweis.
- Zeitblase, manuelles Pausieren am Ausschnittende und möglicher Werbevorlauf direkt sichtbar.
- Weitere Hinweise, Neuladen und externer Fallbacklink unter „Hilfe zum Video“.
- Größeres 16:9-Bild, besonders im Querformat; X/Bedienung außerhalb des Iframes. Vollbild wird zugelassen.
- Kein End-Timer/überdeckendes Popup: keine dokumentierte verlässliche Elternseiten-Schnittstelle für Wiedergabezeit/Ads bestätigt. Ein Klicktimer könnte während der Werbung ablaufen.
- Werbung weder umgangen noch entfernt; keine Videoextraktion/Downloads oder verdeckte Playerauflage.

## Quellen und offener Nutzungscheck

Offizielle FAQ bietet Einbettung über Teilen → Embed an: https://staige.com/mehr/faq-center . Eine Pflicht zu einem zusätzlichen externen Textlink dort nicht gefunden; kein verbindliches Rechtsgutachten. Link bleibt technischer Fallback in der Hilfe.

Das öffentlich verlinkte StaigeTV-Bedingungs-PDF vom 17.03.2023 enthält §3.2 Mindestalter 13 und §3.3 Nutzung Minderjähriger über Erziehungsberechtigte, außerdem §6.2 Einschränkungen zu Framing, Veränderungen und Umgehung: https://storage.googleapis.com/aisw-assets/fanpage/agb/2023-03-17_Nutzungsbedingungen%20Staige.tv.pdf . Verhältnis zum offiziell angebotenen Embed und heutige Bedingungen insbesondere für den Jugend-Vereinsquizfall mit Staige klären. Keine automatische Alters-/Rechtssperre oder neue rechtliche Zusicherung veröffentlicht.

## Prüfung und Grenzen

- 71 native Unit-Tests, macOS- und iOS-Simulatorbuild erfolgreich; bekannte MainActor-Warnung in Terminfindung unverändert.
- Neue API-Regressionen für Gewicht/Deaktivierung, IDs, All-fehlt, ungültig, teilweise richtig und Synonyme; Playerregressionen aktualisiert.
- 17 lokale Browserzustände: Karte/Player/Hilfe bei 320/390/768/844 quer/1280 px sowie 200 % Schrift plus Textabstände. Keine automatischen axe A/AA-Funde, JS-Fehler oder horizontaler Überlauf; Fokus/Escape, 16:9 und X ohne Videoüberdeckung geprüft. Langer Footerlink durfte nun umbrechen.
- Künstliches Iframe statt echter Staige-Wiedergabe; keine echten Antworten/Boxen/Anfragen geschrieben. Echte Safari-/iPhone-/Werbe-/Vollbildabnahme und native Editoransicht bleiben offen. Keine pauschale WCAG-Abnahme.
- Kein echter Gemini-Qualitätslauf mangels lokaler Zugangsdaten; echte Bewertungsfälle im Testverein nach Veröffentlichung gezielt abnehmen.
- Kein Commit, Push oder Deployment durch Codex. Entscheiden-Szenencheck weiterhin Konzept, hier nicht gebaut.
