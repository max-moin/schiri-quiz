# Icon-Begründung, Jokermenü und nächster Spesenumbau – 20.10.2026

## Vor Freigabe für die Jugendgruppe klären

Die [aktuellen offiziellen Gemini-API-Bedingungen](https://ai.google.dev/gemini-api/terms?hl=en), wirksam seit 23.03.2026, schließen API-Clients aus, die an Unter-18-Jährige gerichtet sind oder voraussichtlich von ihnen genutzt werden. Für API-Clients im EWR, der Schweiz und Großbritannien verlangen sie außerdem Paid Services (Gemini API: aktives Billingprojekt). Die konkrete Kontokonfiguration oder eine Vertragsausnahme wurde nicht geprüft. **Die neue KI-Begründung deshalb noch nicht für die Jugendgruppe aktivieren.** Das betrifft auch bestehende Freitext-, Warum- und freie Ortsprüfungen. Technische Tests sind keine Anbieter- oder Rechtsfreigabe. Der laufende Betrieb wurde nicht eigenmächtig deaktiviert und der Provider nicht gewechselt. Einen zulässigen Provider-/Vertragsweg oder eine manuelle Bewertung gemeinsam klären; Elternzustimmung oder ein bloßes Alterslabel nicht als vermeintliche Umgehung empfehlen.

## Gebaut

- Nativer Frageneditor → Icon-Antwort → „Begründung verlangen“: opt-in, Muster bis 2000 Zeichen, inhaltliche Nähe 0–5. Ausgeschaltete Vorgaben bleiben gespeichert. Alte Editoren ohne neue Schlüssel löschen sie nicht.
- Wochenquiz und Duell: bei aktivierter Frage Begründungsfeld bis 600 Zeichen; Inhalt bleibt bei Iconänderung/Fehler erhalten. Keine Umstellung bestehender Freitextfragen.
- Vier Ergebniszeilen einschließlich Begründung. Gesamtwertung ist nur richtig, wenn alle verlangten Teile stimmen. Keine Teilpunkte durch niedrige Begründungsnähe; Synonyme sind unabhängig von der Nähe gleichwertig.
- Feste Entscheidungen werden serverseitig deterministisch geprüft. Bekannte Ortsformulierungen lokal; nur erforderliche freie Teile semantisch. Freier Ort plus Begründung werden in einem gemeinsamen KI-Aufruf geprüft. Bei bereits falscher Grundentscheidung keine zusätzliche KI-Anfrage. KI-Fehler sind keine falsche Antwort: Eingabe bleibt, es wird nichts gespeichert.
- Falsche Begründung kann das vorhandene Zweitversuch-Jokerangebot auslösen. Richtiger Jokerabschluss zählt voll richtig/grün. Erst-/Jokertext, Begründungsnote und Muster-Snapshot bleiben im Obmannpfad erhalten; wiederholte Requests ändern keine abgeschlossenen Antworten.
- Runder Jokerknopf mit Gesamtvorrat → Dialog. Öffnen verbraucht nichts; ungeeignete Typen sind begründet gesperrt. Zweitversuch wird erst nach falscher Erstantwort angeboten. Serienrettung bleibt in der Statistik, Boxen in der Sammlung. Keine neuen 50/50-Ziehungen, keine Änderung der 90/10-Verteilung oder der Vergabeanlässe.
- Ungeklärte örtliche Minderjährigenaufsicht nicht als Anleitung im roten-Karte-HTML. Verifizierte medizinische Ausnahme bleibt separat erhalten. Bestehende CMS-Inhalte nicht automatisch umgeschrieben.
- Datenschutzhinweis beschreibt zusätzlich die aktivierte Begründungsprüfung; keine neue KI-/Routingbibliothek, kein neuer Schlüssel erforderlich.

## Noch nicht gebaut

- Kostenlose einmalige Begründungs-Nachfrage mit verborgen bleibender Gesamtauflösung. Diese Fassung vergibt direkt richtig/falsch; der bestehende Joker-Zweitversuch bleibt verfügbar. Eine orange Zwischenstufe benötigt ein eigenes serverseitiges Zustandsmodell, nicht nur eine Animation.
- Neuer Teilantwort-/Hinweisjoker: Komponente zufällig oder gewählt, ungeeignete Fragen, Restanforderungen und neue Ziehchancen noch abstimmen. Kein Typ ohne nutzbare Wirkung in Boxen gelegt.
- Spesen-/Team-/Adressrouting-Umbau (folgender Entwurf), Szenencheck, neue reale Prämien.

## Prüfbelege / Auslieferung

Live-Migration `20261020133056_icon_begruendung_und_jokermenue`; nur neue opt-in-Konfiguration, keine bestehende Frage aktiviert. Neue Bewertungskontexte nur service_role; öffentlicher Fragenfeed enthält nur den Schalter, kein Begründungsmuster. Bestehende PIN-/Vereins-/Wochen-/Obmannprüfungen bleiben.

`tests/icon-begruendung-rollback.sql` prüft mit synthetischen, vollständig zurückgerollten Daten: Konfiguration/Alt-App, Feed ohne Muster, feste Fehler, fehlende Serverprüfung, Jokerangebot ohne Lösungsleck, Erst-/Zweitantwortaudit, volle grüne Statistik, Wiederladen/Obmannauswertung und unveränderliche historische Snapshots. Keine echten Quizdaten oder Joker verbraucht.

Lokaler Chrome-Test mit echten UI-Modulen und tatsächlichem API-Handler, simuliertem Supabase/Gemini: 320/390/768/1280 px, Eingabeerhalt, gesperrte Joker, Escape/Fokusrückkehr, vierte Zeile, 200%-Schrift/Textabstände und reduzierte Bewegung. Vier simulierte API-Speicherpfade, null Produktionsschreibaufrufe. Das ersetzt keine echte Safari-/Assistenztechnik-/Gemini-Qualitätsabnahme. Native Unit-Tests einschließlich neuer Snapshot-Decodierung; Mac und iOS-Simulator bauen. Kein Website-Deploy/Commit/Push und keine native Installation durch Codex.

## Konkreter Spesenentwurf

### 1. Spiel einmal einordnen

Saison → Stadtverband Dresden / Landesverband Sachsen → Meisterschaft / Pokal / Freundschaft → Mannschaftsart (Herren/Frauen/Junioren/Juniorinnen/gegebenenfalls Senioren) → Altersklasse → Spielklasse/Staffel. Keine gemeinsame Stadt-/Land-Tarifpauschale. Veranstaltungs-/Abrechnungsregeln und ihre Quellen mit Gültigkeitsdatum hinterlegen; bei unklarer Zuordnung keinen vermeintlich verbindlichen Betrag ausgeben.

FUSSBALL.DE als überprüfbare Wettbewerbsreferenz, nicht als Quelle der Entschädigungssätze. Sponsor- und technische Liganamen können abweichen: feste interne ID plus Anzeigenamen/Aliase/Staffel-/Gebietskennung. Dresden durch tatsächliche Gebietszuordnung bestimmen, nicht durch Wortsuche im Namen. Kein laufendes Scraping und keine zugesicherte vollständige Ligenauswahl: der übergeordnete Wettbewerbswähler war automatisiert nicht zuverlässig abrufbar.

### 2. Eine Person, weitere hinzufügen

Erste Karte: SR. „Assistent hinzufügen“ erzeugt SRA-Karte; weitere Funktion nur bei passendem Regelwerk. Ebene/Wettbewerb/Klasse werden übernommen, **nicht der Eurobetrag**: SRA bekommen ihren Funktionssatz. Pro Person getrennt Spesen, Fahrtkosten, Summe; Teamübersicht mit Einzelsummen. Bei Änderung der Spielklasse alle Funktionssätze neu ermitteln und manuelle Anpassungen ausdrücklich kennzeichnen.

### 3. Fahrt je Person bzw. Fahrzeug

Eigenes Auto / Mitfahrt / ÖPNV / keine Kosten. Fahrer: Start, Ziel, optionale Abholung/Zwischenziele, Hin- und Rückweg; Mitfahrer bekommen nicht nochmals die volle Autofahrt. Aus unterschiedlichen Orten können getrennte Eigenfahrten entstehen. ÖPNV nach passender Stadt-/Landregel, Tarifzonen nicht aus Luftlinie oder Autokilometern ableiten. Km-Vorschlag und bestätigte abrechnungsrelevante Km getrennt speichern; Rundungsregel erst nach Quellenabgleich festlegen.

### 4. Adressen und Karten

- Persönliche Startadressen nur nach Anmeldung, mit verständlichen Namen (Zuhause/anderer Start), änder-/löschbar und nicht öffentlich.
- Zentraler Verein → mehrere Spielstätten → konkrete Adresse/Koordinate. Keine automatische Annahme, dass Vereinssitz das Spielfeld ist. Vorhandenen Vereinsbestand/Adressen zunächst tatsächlich prüfen.
- Persönliche Spielstätten-Korrektur verweist auf zentrale Spielstätte, gilt nur für diese Person. Zentralbestand wird nie still überschrieben. Für eine einzelne Abrechnung zusätzlich temporäre Adresse möglich.
- „Route berechnen“ erst nach bewusster Wahl/Klick: serverseitiges Geocoding und Routing, privater API-Schlüssel, Limits/kurze Timeouts, keine privaten Adressen in normalen Logs. Kein Geocoding bei jedem Tastendruck. Klarer Hinweis, welcher Dienst die Orte erhält.
- Openrouteservice `driving-car`, Präferenz `shortest`, **kein Custom Model**, das die Präferenz übersteuern würde. Hin- und Rückfahrt getrennt berechnen, weil Straßenrichtungen abweichen können; nicht blind die Einwegstrecke verdoppeln. Kartendaten-basierter Vorschlag, keine Garantie für aktuelle Sperrungen oder einen rechtlichen Erstattungsanspruch.
- Karte/Marker und Route, daneben zugängliche Textangabe. Route korrigierbar; manueller Weg muss auch ohne Provider/Schlüssel funktionieren. Fremde Kartentiles separat hinsichtlich Datenschutz/Attribution/Quoten auswählen; ORS-Routing ist nicht automatisch ein Kartenkachel-Abo.

### Noch benötigte Freigaben

Routingkonto/Schlüssel und Anbieterbedingungen/Datenschutz abstimmen; keine Bezahloption automatisch buchen. Vollständige Dresden-/SFV-Wettbewerbsmatrix und strittige Zuordnungen der Finanzordnung fachlich abnehmen. Gemeinsame Testabnahme erst nach Regeln/Spesen, wie von Max gewünscht.

### Quellen, geprüft 20.10.2026

- [SVFD Finanzordnung](https://www.svf-dresden.de/dokumente/finanzordnung/) und [Entschädigungssätze](https://www.svf-dresden.de/dokumente/entschaedigungssaetze-im-svfd/): getrennt von Landesregeln, Details/Abweichungen noch fachlich offen.
- [SFV Downloadportal](https://www.sfv-online.de/vereinsservice/downloads/) mit Finanzordnung.
- [SVFD Staffeleinteilung 2026/27](https://www.svf-dresden.de/2026/07/03/gosvfd-225/).
- [FUSSBALL.DE Post SV Dresden](https://www.fussball.de/verein/post-sv-dresden-sachsen/-/id/00ES8GNBRC00003UVV0AG08LVUPGND5I), [Frauen-Sachsenklasse-Beispiel](https://www.fussball.de/spieltag/sachsenklasse-frauen-sued-west-sachsen-frauen-landesklasse-frauen-saison2627-sachsen/-/staffel/031DBL3A1G000004VS5489BTVUS470OH-G): Beispiele, keine vollständige Ligaerhebung.
- [ORS Routingoptionen](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options), [Custom-Model-Warnung zu shortest](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/custom-models), [Konto/Tarife](https://account.heigit.org/info/plans), [API-Limits](https://openrouteservice.org/restrictions/). Aktuelles Kontingent vor Einrichtung bestätigen; keine Preisgarantie aus alten/staging Seiten.

## Gruppenunterstützung

Max hat im November mehr, im Dezember wenig Zeit. Ein größerer Wochenblock ist eine mögliche Kapazität, kein fest versprochenes Angebot. Verein gibt kein Budget: kostenlose Szenenrunden, gemeinsames Lernen/Bewegung/Spielbesuch mit kostenfreier Option als Pilot; Ausgaben nur freiwillig und vorher transparent. Notwendige Nachhilfe/Hilfe nicht vom Lootboxglück abhängig machen. Reale Mitgliederzahlen nicht aus der groben Schätzung 4–5 Erwachsene/5–6 Kinder ersetzen.
