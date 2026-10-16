# Barrierefreiheitsprüfung – 16. Oktober 2026

## Umfang und Ergebnis

Technische Prüfung nach WCAG2.2 A/AA, **keine pauschale Konformitätserklärung**. Ausgangsstand: Commit`5e80ac32d1fb56866ead743ea1e2d3e72e7cdb91`, frisch kopiert, Original sauber. Die Live-Datei `rote-karte.html` wurde gegen diesen Stand bytegleich bestätigt. Nachbesserungen dieser Runde sind vor Max' erneutem Commit/Push noch nicht ausgeliefert.

Geprüfte Einstiegspunkte: Startseite, Hilfe, Rote Karte, Installation, Einstellungen, Meine Daten, Meine Statistik, Mitteilungen, Modus-Auswahl, Termine, Spesenrechner, Obmann und Quiz sowie Datenschutz. Diese14Seiten decken die HTML-Änderungen der letzten zwei Wochen sowie die zugehörigen Quiz-/Modus-Einstiege ab. Regeln/Spesen bleiben fachlich gesperrt; keine Freischaltung zu Testzwecken.

- axe-core4.10.3 mit Tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`: keine automatisch erkannten Verstöße in14öffentlichen Einstiegsansichten bei390px.
-13zusätzliche Zustände mit künstlicher Mitgliedssitzung/Antwortdaten: Einstellungen, Daten/Saisonpunkte, Statistik/Serie/Abzeichen, Mitteilungen, Geräte-Umbenennung, Modus, Terminliste, Terminvorschlag, Zusage, Unsicher mit Grund, Seitenhilfe, Tour und Login. Keine automatisch erkannten A/AA-Verstöße.
- Wochenquiz: tatsächliche MC-, Video- und Freitextkarten mit Testfragen bei320/390/1280px sowie Staige-Großbildrahmen; keine automatisch erkannten A/AA-Verstöße, kein seitlicher Überlauf. X/Escape und Fokus zurück zum Video-Einstieg geprüft. Keine echten Antworten abgegeben und kein Fremdvideo geladen.
- Guide-Editor: Abschnitt öffnen, Titel/Fokusliste ändern, Listenpunkt hinzufügen, Übernehmen mit Fokusrückkehr, Vorschau, Entwurf speichern, öffentliche Ansicht unverändert lassen, Entwurf erneut öffnen und funktionierende Seitenhilfe nach Bearbeitungsende. Offener Dialog und Vorschau ohne automatische A/AA-Verstöße.
- Reflow/Text: jede der14Seiten bei320px sowie1280px mit200%Grundschrift und vergrößertem Zeilen-/Wort-/Zeichen-/Absatzabstand geprüft (28Konstellationen), kein Dokument-Überlauf. Das ersetzt keine reale Browser-Zoom-/Assistenztechnikabnahme.

## Konkrete Nachbesserungen

1. Anmeldefenster, Termin-vorschlagen-Dialog und Blockeditor erhalten explizite zugängliche Dialogtitel. Editor und Terminvorschlag geben den Tastaturfokus gezielt zurück; im Editor auch nach neu gerendertem Inhalt.
2. Kurzüberblick/Erklärungswahl als benannte Gruppe ausgezeichnet statt unbezeichnetem generischem `div` mit schwach unterstütztem `aria-label`.
3. Quiz-/Rechtsseiten: gedämpfte Schrift von `#6b7280` auf `#5b6371` abgedunkelt, auch in abgeschlossenen Fragekarten. Alter Wert lag auf dem hellen Verlauf rechnerisch bei etwa4,24:1 statt mindestens4,5:1 für normalen Text. Die übrige Vereinsseite verwendete den dunkleren Wert bereits.
4. Helle Zusatztexte auf der hervorgehobenen Modus-Kachel von75% auf90% Weiß erhöht. Alter ungünstiger Verlaufswert etwa4,48:1; neuer Wert über4,5:1. Keine Änderung an Abläufen oder Farblogik.
5. Der neue Guide-Editor erhält das feste Phasen-/Icon-Layout und die funktionierenden globalen Hilfe-/Navigationsknoten, statt beim Neuzeichnen nur funktionslose Kopien zu erzeugen. Phasen-Listener werden sauber abgemeldet/neu gebunden.

## Kontrast: automatische Prüflücken nicht als bestanden ausgeben

axe meldete auf einigen Verlaufshintergründen `color-contrast` als manuell zu prüfen. Zusätzliche Berechnung der tatsächlichen Vordergrundfarben gegen die CSS-Hintergrundfarben/-Verlaufsextreme ergab die beiden oben korrigierten Farbfälle. Nach Korrektur keine weiteren rechnerischen Text-Kontrastunterschreitungen in diesen14Einstiegsansichten außer dem gesondert zu bewertenden Foto-/Verlaufsaufmacher der Startseite. Dort sind Geschwister-Bild, Overlay, Textposition und redaktionell austauschbare Motive zu berücksichtigen; eine pauschale Ancestor-Farbrechnung ist dafür kein Nachweis. Deshalb zusätzlich pixelbasiert die Hintergrundflächen unter den tatsächlichen Textzeilen des aktuellen statischen Motivs geprüft: Kicker, Überschrift und transparenter Quiz-Link bei320/390/1280px sowie1280px mit200%Schrift. Alle12Fälle bestanden, niedrigster gemessener Wert7,35:1. Neue Motive müssen erneut geprüft werden; das ist keine Garantie für beliebige hochgeladene Bilder. `aria-prohibited-attr` am Guide-Ansichtsschalter wurde durch `role="group"` aufgelöst.

## Grenzen / noch erforderliche Abnahme

- Echte Safari-/iOS-/Android-Nutzung und VoiceOver/TalkBack/NVDA sind nicht durch Headless-Chrome ersetzt. Geschützte Obmann-Arbeitsbereiche nicht als vollständig mit echtem Konto/allen Datenvarianten abgenommen ausgeben; Guide-Editor und seine Datenbankrechte wurden separat geprüft.
- Fremde YouTube-/Staige-Player, Werbung, die tatsächlichen Video-/Audioinhalte und benötigte Untertitel/Medienalternativen erfordern eine eigene Prüfung. Geprüft wurde der eigene Player-Rahmen; blockierte Drittinhalte nicht als bestanden melden.
- Die Aussagekraft der fachlichen Texte, Alternativtexte, Screenshots und Reihenfolge bleibt eine menschliche/redaktionelle Prüfung. Austausch von Bildern/Blöcken kann Kontraste oder Semantik neu beeinflussen.
- Es wurden keine echten Termine, Quizantworten, Mails oder Push-Nachrichten verändert/ausgelöst. Browser-Daten waren künstlich. Datenbank-Schreibtests nur in Transaktion mit ROLLBACK; anschließend0Testzeilen bestätigt. RLS-/Spaltenrechte und AAL2/Vereinszuordnung bleiben erhalten.

Referenz: [W3C – WCAG2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/). Keine juristische Zertifizierung oder automatische Freigabe fremder Medien.

## Ergänzung: Spielbericht-Guide (gleicher Tag)

Ausgangsstand `759e512dd3f2ff9a3ffffd52a6ccd09e771c2d33`, Original zu Beginn sauber. Neue Fachseite mit realem Einstieg Hilfe → Spielbericht, drei Abschnitten und zwei Textumfängen bei320/390/768/1280px:24Ansichten ohne automatische A/AA-Verstöße oder Dokument-Überlauf. Direkte Wechsel-/Abschluss-Anker, Fokus am Anker, Seitenhilfe und Editor-Dialog zusätzlich geprüft. Die39 Inhaltsblöcke bestehen die vorhandene Inhaltsvalidierung; umsortierte JSONB-Objektschlüssel verändern das Ausgangsmarkup nicht. Fehlende Struktur und unsichere Links werden abgelehnt.

Editorprüfung mit künstlichem In-Memory-Client: Titel/Fokusliste ändern, Fokus zurück, Sonderfallkasten erhalten, Vorschau, Entwurf speichern ohne öffentliche Änderung, gespeicherten Entwurf wieder öffnen und ausdrückliche Veröffentlichung simulieren. Kein echter Inhalt veröffentlicht. Datenbank-Rollbacktest mit tatsächlich extrahiertem Guide: Entwurf/Publikation getrennt, Revisionskonflikt, Historie, AAL1-/Fremdvereinszugriff verweigert; keine Testreste.

Zusätzlich alle drei Abschnitte bei320px mit200%Grundschrift und vergrößerten Textabständen geprüft. Dabei echte Grenzfälle korrigiert: lange Fußlinks dürfen umbrechen; der mobile Seitenname nutzt die vorhandene kompakte Vorgabe „Spielbericht“, statt die gesamte Hero-Überschrift in die feste Kopfzeile zu übernehmen. Kein grundsätzlicher Navigationsumbau. Finale Browserrunde ohne JS-Laufzeitfehler. Echte Safari-/Assistenztechnik- und fachliche Abnahme bleiben erforderlich.

## Ergänzung: vollständiges DFBnet-Hilfepaket

Aus demselben Ausgangscommit frisch kopiert, dabei die13noch uncommitteten Spielbericht-Dateien ausdrücklich erhalten. Neue Hilfe-Gruppierung und DFBnet-Einstieg bei320/390/768/1280px sowie drei neue Guides mit je drei Abschnitten und zwei Textumfängen:80Ansichten ohne automatische axe4.10.3-WCAG2.2-A/AA-Verstöße oder Dokument-Überlauf. Seitenbilder für Einstieg/Hilfe und neue Guides geprüft, keine privaten Portal-/Kontodaten als Abbildung genutzt. Das bereitgestellte reine DFBnet-Logo ist als Orientierungsmarke auf dem vereinsinternen Einstieg eingebunden.

Je neuem Guide vollständige simulierte Redaktion gegen In-Memory-Client: Titel ändern, Übernehmen/Fokus, Vorschau, Draft speichern, öffentliche Ansicht unverändert, Entwurf erneut öffnen, explizite Publikation nur simuliert und funktionierende Seitenhilfe. Fehlende/fremde Vorlagen werden abgelehnt, JSONB-Schlüsselsortierung verändert kein Ausgangsmarkup. Bestehender Spielbericht-Editor zusätzlich als Regression geprüft. Drei bisherige geteilte Hilfe-Links samt Rückweg funktionieren weiter. Keine JS-Laufzeitfehler.9Guide-Konstellationen mit320px+200%Grundschrift und Textabständen ohne Überlauf.

Datenbanktests aller25/23/24tatsächlichen Inhaltsblöcke ausschließlich in Transaktion mit ROLLBACK: Draft/Public getrennt, Revision/Historie, AAL1 und fremde Nutzer abgewiesen, private Entwurfsspalten nicht öffentlich, danach0Testreste und0neu angelegte echte Fachinhalte. Security-Advisors vor/nach zeigen dieselben offenen Befundkategorien; keine pauschale Projektsicherheitsfreigabe. Es gab keine echten DFBnet-Eingaben oder Feedback-Absendungen. Externe Formulare und echte rollenabhängige DFBnet-Ansichten sind nicht Teil einer vollständigen WCAG-Konformitätsbehauptung.
