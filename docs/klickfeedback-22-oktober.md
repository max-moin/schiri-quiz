# Klickfeedback vom 22.10.2026

## Umgesetzt

- Quiz-Einstiege auf der Vereinsseite öffnen bei fehlender Sitzung zuerst den vorhandenen Login auf derselben Seite. Vereinskennung → Name → PIN. Nach Anmeldung führt die Kopf-Schaltfläche zur Quizübersicht, das Startwidget direkt zum Wochenquiz. Abbrechen navigiert nicht. Gast nur nach ausdrücklicher Auswahl; grüne Gastalternative bereits in der Übersicht. Kein neuer Auth-Anbieter.
- Einrichtungscheckliste mit kleinen Icons, einheitlichen Aktionen und Fortschritt. Offene Schritte zuerst; erledigte/ausgelassene grau in eigenem Abschnitt, wieder öffnbar. Browser-/Kontotrennung unverändert.
- Vergangene Termine: je fünf oben nachladen, sichtbare Vergangenheit aufsteigend und Zukunft danach. Scrollanker statt Sprung zum Ende.
- Soccer-Golf: Platz/Kürzel/**Gesamt** vor den Bahnwerten, Gesamt farbig. Veröffentlichte Daten nicht verändert. Der bereits gespeicherte direkte Betreiber-Bildlink erhält eine Inlinevorschau erst nach bewusstem Laden (IP-Transferhinweis, kein Referrer, enger Host-/Pfadfilter, kein fremdes HTML/Proxy). Keine Lizenzfreigabe behauptet.
- Tour: 23 Schritte einschließlich fünf sichtbarer Wege zwischen Bereichen; echter SR-Treff 10/26 für Antwort/Kalender/Protokoll. Weil vergangen, sind die demonstrierten Antwortknöpfe ausdrücklich nicht bedienbar. Kein Antworttutorial im Einstieg, präziser Üben-/Duellrahmen, keine identische ausführliche Tour nach Abschluss. Tour schreibt keine Fachaktionen.
- Website-Obmannnavigation: Termine bündelt Terminsuche und Golf; Website bündelt Bildmotive/Kurztexte. Bestehende Editoren und AAL2-/Obmann-Prüfungen bleiben erhalten. Kein Löschen von Veröffentlichungen/Altinhalten.
- Native Filter-/Quellenhilfen gestrafft; etablierte Struktur und Funktionslogik erhalten.

## Manuelle Box-/Jokerverwaltung

App → Person → Quiz → **Boxen & Joker verwalten**. Passwort-/Vereinsprüfung wie beim bestehenden Personzugang. Vergabe von 1–5 Boxen oder bewusstem Jokertyp, Pflichtgrund und Bestätigung. UUID pro Auftrag schützt Wiederholung; „Dieselbe Änderung erneut versuchen“ verwendet bei Fehler dieselbe UUID. Ungeöffnete Boxen/unverbrauchte Joker einzeln widerrufen; verbrauchte Bestände/Historie nicht löschen. Widerruf wird durch die Teilnahme-Synchronisierung nicht wieder aufgehoben. Keine echte Testbox vergeben, keine Geburtstage/Teilnahmen verändert. Legacy-Geburtstagsserienjoker bleiben außerhalb dieser Rücknahmeverwaltung erhalten.

Neue Hinweisjoker sind manuell vergebbar, **nicht in den Boxziehungen**. Boxen unverändert 90 % Zweiter Versuch / 10 % Serienjoker, keine freie Typwahl beim Öffnen.

| Typ | Wirkung und Eignung |
|---|---|
| Denkanstoß | Redaktioneller Tipp ohne Lösung und ohne KI-Aufruf. App-Frageneditor → bestehende Frage → Jokerhinweis. Pro Verein getrennt; nur bei hinterlegtem Tipp anbieten. |
| Fehlerlupe | Nur Icon-Fragen: lenkt den Blick auf einen festen Bereich; keine Lösung und keine „alles richtig“-Bestätigung. **Noch keine KI-Freitext-Vorabprüfung.** |
| Zufallsbaustein | Zufälliger verlangter fester Icon-Bestandteil, vor erster Abgabe. |
| Schlüsselbaustein | Gezielter fehlender/abweichender fester Icon-Bestandteil, nicht frei wählbar. |

Einsatz erst beim Klick, atomarer Verbrauch, Wiederholung liefert denselben Hinweis. Bereits verwendete Effekte für dieselbe Frage nicht neu anbieten. Hinweis bleibt nach Reload; Obmann sieht Typ, gezeigten Hinweis und noch unbewerteten Antwortstand davor. Spätere korrekte Antwort zählt vollständig grün; Begründung bleibt Pflicht. Bestehender Zweitversuch/Serienjoker bleiben erhalten. Vier vorhandene Bildmotive in der Sammlung aktiviert, leere Motive grau.

## Orange Icon-Begründung: technisch gebaut, noch nicht live freigegeben

Code in `server/icon-nachfrage.js`, HTTP-Einstieg weiterhin fest mit `ICON_NACHFRAGE_FREIGEGEBEN = false`. Nicht vom Request/Browser steuerbar. Keine neue Umgebungsvariable, kein geänderter Anbieter. Bestehende KI-Pfade bleiben verfügbar.

Nach passender Anbieter-/Vertragsklärung: feste Teile zunächst deterministisch prüfen; bei falscher Grundentscheidung kein zusätzlicher KI-Aufruf zur Begründung. Plausible Begründung mit gezielter Lücke → Orange, sachfremder Unsinn/Widerspruch → falsch. Persistenter Zwischenstand enthält keine Lösung/Teilnoten. Reload erhält die Nachfrage. Nur die Begründung kann ergänzt werden, feste Erstantwort serverseitig eingefroren. Abschließende Bewertung erhält Ersttext, Nachfrage und Ergänzung. Keine Jokerkosten für den normalen Nachfrageablauf; nicht mit weiterem Zweitversuch kombinieren. Das entspricht dem bestehenden Erst-/Ergänzungsablauf, keine neue Bezahlfunktion.

Max' Zustimmung wurde erfasst. Die [geprüften Gemini-API-Bedingungen](https://ai.google.dev/gemini-api/terms?hl=en) schließen API-Clients aus, die voraussichtlich von Unter-18-Jährigen genutzt werden, und verlangen Paid Services für den EWR. Kontokonfiguration nicht geprüft. Nutzereinwilligung ersetzt keine Anbietererlaubnis; daher kein neuer Jugend-Livebetrieb freigegeben und kein eigenmächtiger Providerwechsel.

## Prüfung / Grenzen

- 898 Webtests bestanden, einschließlich neuem aktiven API-Pfad mit simuliertem Provider (keine echten KI-Aufrufe).
- Echter lokaler Renderer mit synthetischen Serverdaten: 320/390/1280 px, Login vor Navigation mit erhaltener Sitzung, Checklistenablage, je fünf vergangene Termine, grüne Gastalternative, Golfspalten und Plan-Opt-in. Gesamte 23-Schritte-Tour und Orange-Karte bis zur Ergänzung durchgeklickt; keine JS-Fehler/Seitenüberbreite.
- iOS-Simulator-/macOS-Build und 21 gezielte native Modell-/Filter-/Beschaffungstests; keine neue Geräteinstallation. Bekannte unabhängige MainActor-Warnung der Terminfindung bleibt.
- SQL-Tests nur künstliche Vereine/Personen in BEGIN/ROLLBACK: Passwort, Fremdverein, idempotente Vergabe/Öffnung, Widerruf, benutzte Bestände, alle Hinweiswirkungen, Obmann-Audit, keine Nachfrage-Lösung, Reload, unveränderbare feste Teile und endgültige Erst-/Ergänzungshistorie. Keine Testvereine zurückgeblieben. Keine Nachrichten oder echten Bestell-/Geld-/Quizstände geschrieben.
- Security Advisor: vier neue private RLS-Tabellen ohne direkte API-Rechte erklären 69→73 RLS-ohne-Policy-Infos; bewusst PIN-/passwortgeprüfte Definer 263→267 (`anon`) und 230→234 (`authenticated`). Service-Kontexte bleiben ausschließlich `service_role`. Bestehende Leaked-Password-Meldung unverändert. [Supabase-Ausführungsrechte](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RLS-Hinweis](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Passwortschutz](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Keine vollständige WCAG-Zertifizierung/echte Safari-, Vorstand- oder Geräteabnahme. Morgen fachliches Gegenlesen DFBnet/übrige Hilfe/Regeln/Spesen; Familien-/Gruppentest danach. PDF: acht Seiten, 45 Prüfpunkte, ohne Terminbuchung.

## Veröffentlichung

Website/App nur geänderte Dateien nach Baselinevergleich übernehmen, vorhandene App-Änderungen erhalten. Datenbankmigrationen sind angewendet; Website-Push und App-Installation bleiben bei Max. Keine Soccer-Golf-Daten zurückgesetzt oder neu veröffentlicht. Geburtstagsmail und von Max gelobte Abläufe als praktisch bestätigt festgehalten.
