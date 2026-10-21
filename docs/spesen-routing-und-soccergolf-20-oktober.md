# Spesen, Joker-Einstieg und Soccer-Golf – 20.10.2026

> Nachtrag 21.10.: Live meldet `eingerichtet:false`. Neu geprüfte Anbieterbedingungen untersagen die Übermittlung personenbezogener Daten; die Oberfläche ist deshalb vorerst nur ein ausdrücklich bestätigter Test mit öffentlichen Orten. Private Wohnortstarts sind **nicht freigegeben**, auch nicht pauschal als „namenlose Koordinaten“. API-Adressen auf `api.heigit.org` umgestellt. Der folgende Text beschreibt teilweise den früheren technischen Entwurf; maßgeblich ist jetzt `docs/routing-test-und-freitextjoker-21-oktober.md`.

## Gebaut

- Spesenübersicht bleibt Haupteinstieg. Unter „Abrechnung erstellen“ steht jetzt ein Teamrechner: einmal Stadt/Land, Mannschaft/Altersklasse und Meisterschaftsklasse wählen; ein SR, bis zu zwei SRA hinzufügen. Sätze nach Funktion, Fahrtkosten je Person. Der alte Rechner ist in dieser Fassung nur noch verborgen als kompatibler Quellstand vorhanden.
- Stadt: 1–3 Tarifzonen ausdrücklich wählen, keine automatische PLZ-Schätzung mehr in diesem neuen Ablauf. Mehr als drei Zonen bleibt ungeklärt, nicht heimlich Landesrecht anwenden. Alternativ selbst bestätigter Betrag / keine Fahrtkosten.
- Land: Auto-/Rad-Gesamt-km, Zeitkartenpauschale, tatsächliche Fahrscheine, bestätigter Betrag oder keine Kosten. Mitfahrt bei einem im Team eingetragenen Autofahrer erzeugt keine zweite Autofahrt. Mitnahmezuschlag/abweichende Teilstrecken werden nicht automatisch errechnet; dafür ist noch ein genauerer Fahrgemeinschaftsablauf nötig.
- Optionale Routenhilfe: exakte Adresse oder Kartenklick, Hin-/Rückweg separat mit `driving-car`, `preference: shortest`; Vorschlag bewusst übernehmen und weiterhin von Hand ändern. Kein Custom Model, keine bloße Verdopplung des Hinwegs, keine Garantie einer mathematisch global kürzesten/tatsächlich befahrbaren Strecke.
- Startpunkte, Suchtexte und Geometrie sind nur im geöffneten Routenfenster. Keine Speicherung in Supabase, Profil, localStorage oder sessionStorage; keine eigenen Orts-/Fehlerlogs. Fenster schließen verwirft die Ortsdaten. Eine persönliche Zielkorrektur verändert den zentralen Vereinsbestand nicht und wird ebenfalls nicht dauerhaft gespeichert.
- Externe Suche/Route erst nach Erlaubnis und Aktion; Karte zusätzlich erst nach „Optionale Karte laden“. Ohne Schlüssel/Anmeldung/Provider funktioniert die manuelle km-Eingabe weiter. ORS erhält bei einer Suche den Suchtext, beim Routing die Koordinaten; OSM beim Kartenladen IP/Ausschnitt. Nicht als vollkommen datenfreie Offlineberechnung darstellen.
- Obmann-Webeditor → Spesen: mehrere öffentliche Spielstätten je Verein pflegen. Speichern über die vorhandene Konfigurationsveröffentlichung; keine Wohnadressen dort eintragen. Keine Spielstättenadressen geraten/importiert. Tatsächliche Daten müssen noch hinterlegt werden.
- Jokerknopf ganz verborgen bei 0 anwendbaren Jokern, fehlender Anmeldung, abgeschlossener Frage oder laufender KI-Nachfrage. Nur Serienjoker oder 50/50 bei Freitext ergeben keinen Knopf. Bestand nach Verbrauch/Neuladen aktualisiert andere angezeigte Knöpfe.

## Inbetriebnahme / Grenzen

1. Max pusht selbst; kein Commit, Push oder Deploy durch Codex.
2. Routingmigration `20261020142358_spesen_routing_kontingent.sql` ist live (lokale CLI-Datei mit der tatsächlichen Remote-Version abgeglichen). Nur service_role kann die Quota-RPC ausführen; sie prüft zusätzlich aktive PIN. 20 Einheiten/Stunde/Person, 60/Tag/Person, global 120/Stunde/600/Tag. Suche = 1, Hin+Rück = 2. Nur Zähler/Nutzer-ID, keine Orte. Alte Zähler werden beim nächsten Aufruf bereinigt. Kein externes Netzwerk unter DB-Sperre.
3. Bestehender Endpunkt `/api/website-feedback?funktion=spesen-route` delegiert an eigenen Routinghandler; weiterhin zwölf Vercel-Funktionen. Normaler Feedbackpfad bleibt bestehen.
4. Für echte Abfragen muss Max einen passenden ORS-Zugang einrichten und `ORS_API_KEY` nur serverseitig in Vercel setzen. Bestehender `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` erforderlich. Schlüssel nicht in Chat oder Frontend kopieren. Anbieterbedingungen/Kontingent/Datenschutzvertrag prüfen; keine kostenpflichtige Buchung ausgelöst, kein Schlüssel gesucht oder gespeichert.
5. Spesen bleiben im bisherigen Prüf-/Freigabestatus. Kein vollständiger neuer Wettbewerbskatalog: Meisterschaft plus vorhandene Klassen; Pokal/Freundschaft/Turnier/Sonderfälle und Finanzklassenzuordnung weiterhin Fachprüfung. Hinterlegte Sätze nicht als frisch vollständig verifiziert verkaufen. Druckausgabe ist eine Zusammenfassung, kein neuer vollständig ausgefüllter Abrechnungsbeleg.

## Noch offen: KI-Rückfrage und neue Joker

Max hat klargestellt: normale KI-Rückfrage bei fachlich naher, aber unvollständiger Begründung; eindeutig falsch → falsch, richtig → richtig. Kein Jokerverbrauch. „Kostenlos“ soll nicht als besonderes Prämienprodukt oder zusätzliche kostenlose Hilfe dargestellt werden. Der laufende Anbieter wurde nicht geändert. Die bestehende Icon-Begründungsfunktion hat **weiterhin noch keine Orange-Zwischenstufe**; der dafür nötige persistente Zwischenstand mit verborgen bleibender Lösung ist in dieser Runde nicht gebaut. Keine Fertigmeldung dafür.

Zwei neue Motive per eingebauter Bildgenerierung erstellt, als lokale 384-px-WebP-Dateien vorbereitet:

- `bilder/joker/zufallsbaustein.webp`: türkisfarbenes Puzzleteil + Würfel.
- `bilder/joker/schluesselbaustein.webp`: violettes Puzzleteil + goldener Schlüssel.

**Das sind Bild-/Konzeptvorbereitungen, noch keine einsetzbaren oder gezogenen Joker.** Die bisherige 90/10-Verteilung bleibt unverändert. Für den stärkeren Typ ist noch zu entscheiden, ob der Editor einen Schlüsselbaustein festlegt oder der Server einen fehlenden/falschen festen Baustein des aktuellen Entwurfs auswählt. Kein Wahlmenü des Schiris bei der Boxöffnung. Nur geforderte, sinnvoll lösbare Komponenten; Begründung nicht als fertigen Mustertext schenken. Neue Chancen gemeinsam festlegen.

Bildprompts (Built-in ImageGen, Transparenz, Stilreferenz bestehender Zweitversuch-Joker):

1. “Create ONE new transparent-background game inventory icon matching the attached referee quiz reward icon's friendly glossy 3D clay-like style. New asset: a bright teal/cyan interlocking puzzle piece with a small pair of playful white dice beside it, clearly representing a RANDOM answer component hint. Strong simple silhouette, readable at 96 px, centered, generous transparent margins, no cropped shapes, no text, no letters, no border, no medallion, no badge/ribbons, no watermark. Soft studio highlights, polished friendly illustration, not pixel art. Do not reuse pencil/arrows of reference; reference style only.”
2. “Create ONE new transparent-background game inventory icon matching the attached referee quiz reward icon's friendly glossy 3D clay-like style. New asset: a rich violet interlocking puzzle piece with a compact golden key nestled beside it, representing a TARGETED important answer-component hint. Strong simple silhouette, readable at 96 px, centered, generous transparent margins, no cropped shapes, no text, no letters, no border, no medallion, no badge/ribbons, no watermark. Soft studio highlights, polished friendly illustration, not pixel art. Do not reuse pencil/arrows of reference; reference style only. Purple puzzle piece plus gold key, no other objects.”

## Soccer-Golf

Die drei HEIC-Dateien wurden nur lesend in temporäre PNG-Kopien umgewandelt und geprüft. Kein Personenfoto/Zählkartenfoto in öffentliche Projektassets kopiert. Alle 18 Werte je Person vorläufig übertragen, Vorder-/Hinterrunde und Summe nachgerechnet. Unklare Werte/Namen und ein Rechenunterschied müssen Max bestätigen; **keine echte Rangliste/Ergebnisdaten veröffentlicht oder in die Live-DB geschrieben.** Private Transkription und Rückfragen stehen im kanonischen Projektgedächtnis, nicht im öffentlichen Repo. Der bisherige Rückblick-Editor kann danach befüllt werden.

## Verifikation

- Rechentests: verschiedene SR-/SRA-Sätze, getrennte Fahrtkosten, Mitfahrt ohne Doppelabrechnung, 1–3 Stadtzonen, leere Eingaben/fehlende Sätze sichtbar unvollständig.
- Routingtests: feste Providerhosts, Koordinatenvalidierung, shortest, asymmetrischer Rückweg, Schlüssel nicht im Ergebnis, fehlende Einwilligung/Schlüssel/Quota stoppen externe Abfragen.
- Live-SQL-Test komplett in BEGIN/ROLLBACK: falscher PIN, keine anon-Ausführung, Limit nicht überbuchbar, keine Ortsdatenspalten. Kein echter SR/kein echter Abrechnungsdatensatz verändert.
- Security-Advisor: neue Zählertabelle absichtlich privat mit RLS ohne öffentliche Policy ([Hinweis 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); keine Freigabe an anon/authenticated. Bestehende übrige Hinweise bleiben, keine pauschale Sicherheitsabnahme.
- Lokaler Chrome: 320/390/768/1280 px, SR+SRA/Mitfahrt, Joker aus-/einblenden bei Bestandänderung, kein Seitenüberlauf, 200 % Schrift/Textabstand, Erlaubnis vor Abruf, zwei simulierte Ortssuchen und zwei simulierte Directions-Aufrufe über echten API-Handler, bewusste km-Übernahme, privater Start nach erneutem Öffnen leer, kein Browser-Speicher. Keine echten Providerabfragen, keine echte iPhone-/vollständige WCAG-Abnahme.

## Quellen

- [ORS Geocoder](https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/), [Routingoptionen](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options), [Custom Models und Präferenz](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/custom-models)
- [Leaflet 1.9.4](https://leafletjs.com/download.html), lokal mit Lizenz eingebunden; [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/), sichtbare Attribution/kein Vorabladen/Browser-Referer
- [HeiGIT Datenschutz](https://heigit.org/privacy-policy/), [OSMF Datenschutz](https://osmfoundation.org/wiki/Privacy_Policy)
- [SVFD Finanzordnung](https://www.svf-dresden.de/dokumente/finanzordnung/), [SFV Downloads](https://www.sfv-online.de/vereinsservice/downloads/): weiterhin maßgebliche Fachquellen, keine neue pauschale Rechts-/Finanzfreigabe.
