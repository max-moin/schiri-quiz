# Routing-Test und Freitextjoker – 21.10.2026

## Routing: aktueller Befund

Der veröffentlichte Status-Endpunkt meldete am 21.10. nur `{ "eingerichtet": false }`. Es wurde ausschließlich dieser Status gelesen; kein Schlüssel ausgelesen und keine echte Adresse oder Route übermittelt. Der lokale Web-Arbeitsbaum war vor dieser Runde sauber auf `6352e89`.

Zwei wichtige neue Recherchebefunde:

1. HeiGIT hat die bisher im Code verwendete API-Adresse abgekündigt. Abschaltung laut aktueller Ankündigung 02.–06.11.2026. Die Anbindung verwendet jetzt `https://api.heigit.org/pelias/v1/search` und `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`. Gleicher Schlüssel, weiterhin `shortest`, kein heimlicher Fallback auf den alten Host.
2. Die aktuellen Bedingungen verbieten die Übermittlung personenbezogener Daten. Exakte Wohnadresse oder zuordenbare Wohnortkoordinaten sind deshalb nicht allein durch „wir speichern sie nicht“ gelöst. Keine Aussage, namenlose Koordinaten seien automatisch anonym.

**Folge:** Vorerst nur Test mit öffentlichen Orten ohne Personenbezug. Oberfläche ausdrücklich so beschriftet, zusätzliche Bestätigung im Request erforderlich (`nurOeffentlicheOrte: true`). Das ist eine bestätigte Nutzungsgrenze, **keine automatische Erkennung**, ob ein eingetippter Ort tatsächlich privat ist. Wohnort-Routing bleibt fachlich/vertraglich offen. Kilometer können weiterhin manuell eingetragen werden. Kein laufender KI-Betrieb oder bestehender Quiz-/Jokerbestand geändert.

## So kann Max den öffentlichen Test starten

1. Auf [HeiGIT Account](https://account.heigit.org/) selbst anmelden/registrieren. Der aktuell öffentlich angezeigte Standardtarif kostet 0 € und umfasst 2.000 Directions-Abfragen/Tag (40/Minute) und 3.000 Geocoding-Abfragen/Tag (100/Minute), geprüft auf der dynamischen [Tarifseite](https://account.heigit.org/info/plans). Keine kostenpflichtige Buchung oder automatische Garantie unveränderlicher Tarife.
2. Im Konto den Standard-API-Schlüssel verwenden. **Nicht im Chat teilen.** In Vercel beim Website-Projekt unter Settings → Environment Variables den Namen `ORS_API_KEY` als Secret für die gewünschte Testumgebung setzen. Bestehenden Supabase-Serverzugang unverändert lassen.
3. Max veröffentlicht die korrigierten Dateien wie gewohnt selbst. Nach einer Variablenänderung ist ein **neues Deployment** erforderlich; alte Deployments erhalten sie nicht nachträglich.
4. In der Website anmelden → Spesen → Abrechnung erstellen → Land Sachsen → Auto → Adresse/Karte. Öffentliche Orte testen, z.B. Bahnhof → Sportplatz, nicht die eigene Wohnung. Falls der Spesenbereich noch im Prüfstatus verborgen ist, die vorhandene Obmann-Vorschau nutzen; keine allgemeine Freischaltung in dieser Runde.
5. Erlaubnis und öffentlichen Test bestätigen → beide Orte suchen und Treffer wählen → kürzeste Autoroute berechnen → Hin-/Rückweg prüfen → Gesamt-km bewusst übernehmen. Danach Kilometer von Hand ändern und das Routenfenster erneut öffnen: kein gespeicherter Startpunkt.

Mit manuell eingegebenen Kilometern ist der Teamrechner schon ohne ORS-Schlüssel prüfbar. Eine Route ist ein Vorschlag, kein verbindlicher Erstattungsanspruch. Eigene Stunden-/Tageslimits im Backend bleiben bestehen. Quellen-/Lizenzhinweis an den Routenergebnissen ergänzt: © openrouteservice by HeiGIT | Data from OpenStreetMap, CC-BY-SA 4.0 verlinkt.

**Bevor Wohnortstarts eingeschaltet werden:** schriftliche passende Auskunft/Vertragsgrundlage von HeiGIT oder gemeinsam einen geeigneten anderen Anbieter wählen. Nicht stillschweigend auf einen anderen Dienst wechseln und kein Häkchen als Ersatz für Anbietererlaubnis behandeln. Kein solcher Kontakt versandt.

## Neue Freitextjoker: Entwürfe, keine fertigen Effekte

Der vorhandene **Zweite Versuch** funktioniert bereits auch bei Freitext; kein neuer Typ nötig, der nur dasselbe anders nennt. Normale KI-Rückfragen bleiben ein unabhängiger Bewertungsablauf ohne Jokerverbrauch.

### Denkanstoß

- Vor der endgültigen Antwort einen kurzen hilfreichen Hinweis aufdecken.
- Beispielsweise: „Achte auf die Position und Zahl der noch eingreifenden Verteidiger.“ Kein fertiger Kartentyp, keine Spielfortsetzung, keine Musterbegründung.
- Redaktionell von Max je Frage vorbereiteter Hinweis, damit zuverlässig kurz und fachlich passend; **kein zusätzlicher KI-Aufruf** beim Benutzen.
- Nur anbieten, wenn diese Frage tatsächlich einen freigegebenen Hinweis besitzt; sonst kein passender Jokerknopf und kein Verbrauch.
- Einmaliger Einsatz, normale Punktewertung und sichtbare Obmann-Markierung. Das ist ein Vorschlag, noch keine neue Vergabelogik.
- Motiv: goldene Glühbirne in blauer Sprechblase → `bilder/joker/denkanstoss.webp`.

### Fehlerlupe

- Einen geschriebenen Entwurf vor der endgültigen Abgabe einmal gezielt prüfen lassen.
- Höchstens einen problematischen/fehlenden Bereich nennen, z.B. „Prüfe deine persönliche Strafe“; keine korrekte Lösung nennen, keine richtigen Teile bestätigen oder automatisch einsetzen.
- Stärker als ein allgemeiner Tipp und mit zusätzlichem KI-Aufruf verbunden. Nur auf tatsächlichen Einsatz prüfen, nicht beim Tippen. Dieselben Kriterien/Gewichte wie bei der späteren Bewertung.
- Nur mit ausreichend redaktioneller Bewertungsgrundlage anbieten. Bei Ausfall kein Verbrauch; atomarer/idempotenter Einsatz sowie Auditsnapshot des Entwurfs und der endgültigen Antwort erforderlich. Keine „alles richtig“-Bestätigung als Hintertür für freie Vorabtests.
- Seltenere Vergabe als Denkanstoß sinnvoll, konkrete Gewichte aber noch nicht beschlossen. Der normale KI-Nachfrageweg bleibt davon unberührt.
- Motiv: violette Lupe über einer kleinen Antwortkarte mit einer markierten Zeile → `bilder/joker/fehlerlupe.webp`.

**Empfehlung:** zuerst Denkanstoß, danach die Fehlerlupe nur bei tatsächlichem Bedarf. Vorbereitete Zufalls-/Schlüsselbaustein-Joker bleiben zusätzlich für strukturierte Iconfragen denkbar. Noch keine neuen Typen in Boxen oder Beständen, 90/10-Zweitversuch/Serie unverändert, keine freie Typauswahl beim Boxöffnen. Alle vier neuen Motive sind Konzeptassets, nicht schon aktivierte Prämien.

## Bildgenerierung / Provenienz

Beide Motive mit dem eingebauten ImageGen erzeugt; Stilreferenz `bilder/joker/zweiter-versuch.webp`, keine Fremdfotos. Transparenter Hintergrund, nach Erzeugung nur auf 384×384 WebP konvertiert. Original-PNGs verbleiben im Codex-Ausgabeordner; verwendbare lokale Projektkopien unter den oben genannten Pfaden. Vorschau bleibt als Entwurf gekennzeichnet, nicht in der aktiven Vorratsanzeige eingehängt.

Prompt Denkanstoß:

> Use case: stylized-concept. Asset type: one transparent-background game inventory icon for a German football referee quiz. Reference image: style only, match its simple friendly glossy soft 3D game-icon materials and polish. Subject: a warm golden light bulb rising from a small rounded sky-blue speech bubble, conveying a helpful thinking nudge for a written answer. Composition: one unified compact object, centered, square framing, all edges inside canvas with generous transparent margins, strong readable silhouette at 96px. No text, no letters, no question mark, no badge, no medallion, no ribbons, no watermark, no background scene, no pixels. True transparent background. Do not copy the reference pencil or arrows.

Prompt Fehlerlupe:

> Use case: stylized-concept. Asset type: ONE transparent-background game inventory icon for a German football referee written-answer quiz. Reference image role: style only; match friendly glossy soft 3D game-icon finish. Subject: a chunky purple magnifying glass with a turquoise glass lens hovering over a small cream paper card. On the card are only three short dark blue rounded strokes, and ONE small amber dot marks the middle stroke. Meaning: inspect one troublesome part of a written answer, not reveal the solution. Unified compact silhouette readable at 96 px, centered square, generous transparent margins, all edges inside canvas. No readable text, no letters, no numbers, no badges, no medallions, no ribbons, no watermark, no scenery, not pixel art. True transparent background. Do not copy reference pencil or arrows.

## Prüfstatus

- 884 Webtests grün, darunter neuer Test: fehlende öffentliche Testbestätigung verursacht keine Quota-/Providerabfrage.
- Providerhosts/-pfade, shortest/asymmetrischer Rückweg, Namens-/Schlüsselfreiheit des Ergebnisses und Attribution in Mocktests geprüft; Syntax der drei geänderten JS-Dateien grün.
- Kein echter ORS-Routingtest: Schlüssel fehlt. Keine neue DB-Migration, kein Quiz-/Rückblick-Schreiben, keine Wohnadresse übertragen. Kein Commit, Push, Deploy oder Anbieterwechsel durch Codex.

## Primärquellen (21.10.2026)

- [HeiGIT API / kostenloser Standard-Schlüssel](https://api.heigit.org/), [aktuelle Tarife](https://account.heigit.org/info/plans)
- [Angekündigter API-Umzug](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912)
- [HeiGIT Terms of Service](https://account.heigit.org/info/tos): Prohibited Conduct, Attribution and License. Kein allgemeines Rechtgutachten.
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables): Secret/Config, Umgebungen und Wirksamkeit erst bei neuen Deployments.
