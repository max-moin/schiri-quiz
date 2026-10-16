# Private Wochenserie und Abzeichen

## Zugang und Grenzen

Kontomenü → Meine Quizstatistik. Nur die eigene ID plus passende aktive PIN
kann `meine_wochenserie_basis` lesen. Keine Rangliste, kein Obmann-Aggregat,
keine neue Push-/E-Mail-Kategorie und keine neuen Lern- oder Profiltabellen.
Die ursprüngliche Basis-RPC ist rein lesend; bestehende Tabellen bleiben gesperrt.
Die inzwischen verwendete PIN-geprüfte `meine_wochenserie_mit_joker` ergänzt die
Geburtstagsvergabe; das ist keine neue Mutation dieser Sammlungs-Erweiterung.

## Regeln

- Alle zugeordneten Fragen einer Runde abschließend beantwortet: Woche zählt.
  Falsche Antworten sind erlaubt; offene `nachbessern`-Antworten noch nicht fertig.
- Laufende Runden unterbrechen noch nichts. Ohne Quizzuordnung kein Serienbruch.
  Runden vor Kontoerstellung werden nicht nachträglich als Versäumnis gewertet.
- Eine ausgelassene Woche kann in sieben Berliner Kalendertagen nach Rundenende
  gerettet werden. Fünf **verschiedene** korrekt gespeicherte `historie_antworten`
  im Fenster sind erforderlich; Wiederholungen zählen einmal. Falsche Versuche
  setzen den Fortschritt nicht zurück. Gastmodus und Duelle zählen nicht.
- Das Fenster ist halb offen: Ende eingeschlossen, Frist ausgeschlossen. Die
  Datenbankzeit gilt, nicht eine verstellte Geräteuhr. Sommerzeit wird berücksichtigt.
- Rettungen werden rückblickend aus den Antwortlogs abgeleitet. Kein lokaler
  Zähler, kein zu manipulierender Erfolgsparameter und keine Schreib-RPC nötig.
- Eine offene Lücke zählt noch nicht zur Serie. Die Oberfläche zeigt die frühere
  Serie und den Rettungsfortschritt. Neue Abzeichen entstehen nicht vorzeitig.
- Rettung verändert keine Wochenantworten, Trefferquoten, Saisonpunkte oder
  administrativen Quizabschlüsse. Die bestehende Wochenquiz-Sperre vor Üben bleibt:
  offene aktuelle Fragen zuerst abschließen, danach `quiz.html#ueben`.

## Anzeige

Aktuelle/längste Serie und regulär abgeschlossene Wochen. Seit17.10.2026 acht
private Abzeichen mit eigenen skalierbaren Medaillenmotiven. Die bisherigen IDs
bleiben stabil, „Erste Woche“ heißt jetzt „Anpfiff“. Native Details-Karten öffnen
Ziel, tatsächlichen Fortschritt und (bei Teilnahme/Rettung) bis zu drei eigene
Beispielwochen. Serienfortschritt verwendet die längste Serie, nicht die aktuelle.
Status bleibt als Text erkennbar, nicht nur als Farbe. Keine Sounds oder
Erfolgsanimationen; Reduced-Motion-Regel vorsorglich vorhanden.

| Abzeichen | Bedingung | Stand |
|---|---|---|
| Anpfiff | 1 Woche vollständig beantwortet | Gebaut |
| Stammgast | 5 Wochen vollständig beantwortet | Gebaut |
| Zweistellig | 10 Wochen vollständig beantwortet | Gebaut |
| Viertelhundert | 25 Wochen vollständig beantwortet | Gebaut |
| Drangeblieben | 4 Quizwochen in Folge | Gebaut |
| Regelroutine | 8 Quizwochen in Folge | Gebaut |
| Dauerbrenner | 12 Quizwochen in Folge | Gebaut |
| Wieder da | 1 Woche durch Üben oder Joker gerettet | Gebaut |

Gerettete Wochen zählen zur Serie, nicht zu „vollständig beantwortet“. Eine
spätere Serienlücke löscht keine bereits erreichte längste Serie. Administrative
Korrekturen können den zugrundeliegenden Stand dagegen weiterhin ändern.

## Ausbaukonzept: insgesamt20Abzeichen (nicht vollständig implementiert)

Die acht obigen Abzeichen sind nutzbar. Diese zwölf weiteren sind ein Vorschlag,
keine freigeschalteten/angeblich schon verdienten Funktionen:

| Arbeitstitel | Vorgeschlagene Bedingung |
|---|---|
| Weiße Weste | 1 vollständige Wochenrunde mit allen Antworten richtig |
| Hattrick | 3 aufeinanderfolgende perfekte Quizwochen |
| Präzision | 10 perfekte Wochen insgesamt |
| Wechselprofi | 10 verschiedene Fragen zu Regel3 richtig |
| Abseitsblick | 10 verschiedene Fragen zu Regel11 richtig |
| Fingerspitzengefühl | 10 verschiedene Fragen zu Regel12 richtig |
| Elfmeterpunkt | 10 verschiedene Fragen zu Regel14 richtig |
| Regelkompass | Mindestens eine Frage zu jeder der17Regeln richtig |
| Hundert Treffer | 100 verschiedene Fragen richtig |
| Regelarchiv | 250 verschiedene Fragen richtig |
| Kopf hoch | Vollständige Woche ohne richtige Antwort; nur freiwillig/humorvoll |
| Aus unserer Mitte | Ein eigener Vorschlag nach Prüfung als Frage übernommen |

Keine Belohnung für absichtliche Fehler: „Kopf hoch“ wäre höchstens ein
abschaltbares Trostmotiv ohne Joker/Punkte. Kein „Pechschwein“-Etikett ungefragt.
Für perfekte Wochen zählen ausschließlich abschließend bewertete originale
Wochenantworten; Rettungen sind niemals perfekte Wochen. Quizfreie Wochen werden
übersprungen, eine tatsächlich angebotene unvollständige Runde unterbricht den
Hattrick. Regelabzeichen zählen verschiedene Frage-IDs, keine Wiederholungsfarm.
Üben und Wochenquiz können dafür gemeinsam zählen, Gast/Duell nicht. Historische
Antworten nur bei eindeutiger Regeltag-Zuordnung; unbekannte Regel bleibt unbekannt.
Bei mehreren Regel-Tags gilt zunächst nur die fachlich bestätigte Hauptregel.

**Noch benötigte Daten:** Die aktuelle Serienbasis liefert weder Trefferzahlen je
Woche noch Regelstatistiken oder angenommene Vorschläge. Dafür später minimale
PIN-geprüfte eigene Aggregate ergänzen, keine Lösungen und keine fremden Antworten
ausliefern. Detailansicht „Regelkompass“:17Regeln mit Zähler und Fortschritt, keine
öffentliche Rangliste. Keine neuen personenbezogenen Rohdaten im Browser speichern.
Noch keine neue API/Migration aus diesem Konzept erstellt oder live angewandt.

## Joker-Verdienst: konkreter Vorschlag, noch nicht aktiviert

- Geburtstag bleibt ein möglicher Anlass; neutrale Oberfläche „Deine Joker“.
- Ergänzend: **Dranbleib-Bonus** für12weitere vollständig beantwortete Quizwochen
  ab einem gemeinsamen Einführungsdatum. Keine richtige Antwort nötig, keine
  Serie nötig, keine geretteten Wochen. Keine rückwirkende Jokerflut.
- Höchstens ein verdienter Bonus je Berliner Kalenderquartal. Alle12Wochen werden
  beim Bonus atomar verbucht; wenn das Quartalslimit oder der Vorrat greift, bleibt
  der Fortschritt bestehen. Einlösung kann keinen weiteren Bonus erzeugen.
- Vorschlag Vorratsgrenze: zwei verfügbare Joker. Geburtstagsgeschenk nicht
  stillschweigend verfallen lassen, wenn der Vorrat voll ist: dafür muss vor dem
  Bau eine konkrete Warteschlangen-/Nachholregel entschieden werden.
- Gültigkeit wie bisher ein Jahr. Einlösung weiterhin nur für die private Serie
  im normalen7-Tage-Rettungsfenster, nie Pflichtquiz überspringen, nie fachliche
  Trefferquote/Saisonpunkte verändern. Kein Kauf, keine Werbung, kein Zufall.

**Technischer Bauplan:** Vorhandenen Jokerpfad erst nach Freigabe zur neutralen
Vergabe/Einlösung weiterentwickeln; alte Clients kompatibel lassen. Personenzeile
sperren, eindeutigen Ereignisschlüssel verwenden, Bonuszählstand transaktional
fortschreiben. Serverdatum/Berlin statt Geräteuhr, Idempotenz bei zwei Geräten,
keine Vergabe an inaktive/fremde Personen. Fehlgeschlagene Einlösung verbraucht
nichts. Rollbacktests für Doppelabruf, Quartalswechsel, Vorratsgrenze und Korrekturen.
Keine geplanten Jokerstände als tatsächlich verfügbare Joker anzeigen.

## DFBnet-Fachprüfung: klar abgegrenztes Abnahmeblatt

Kontrollfelder und Empfängerauswahl werden nicht geraten. Bei Max' nächstem echten
angesetzten Spiel anonymen Ausschnitt bzw. Feldnamen erheben, ohne Testbericht oder
falsche Karte anzulegen: Wettbewerb/Ansicht, genaue Kontrollnamen/Pflichtfelder,
Dokumenttyp, tatsächliche Empfängerrollen, Auswahlpflicht/automatische Zustellung.
Danach Anleitung mit Quelle/Stand ergänzen. Ein vierter Empfänger wird bis dahin
nicht behauptet; ebenso keine technische Uploadgrenze. Empfänger-/Minderjährigen-
Prüfung bleibt bei vorhandener Wiedervorlage, keine neue Erinnerung duplizieren.

## Datenherkunft und Korrekturen

Stand wird geräteübergreifend aus `antworten`, `runden_fragen` und
`historie_antworten` berechnet. Nach administrativen Korrekturen/Änderungen an
Zuordnungen wird auch die Anzeige neu abgeleitet. Abzeichen sind damit keine
irreversiblen Zertifikate oder neue personenbezogene Akten. Nach Rückkehr zur
Statistik werden Daten neu geladen; Kontowechsel/Abmelden löschen den sichtbaren
alten Stand sofort. Netzwerkfehler werden nicht als Nullserie dargestellt.

## Prüfungen

`node --test tests/wochenserie*.test.js` – Serien-/Frist-/Abzeichenregeln,
Kontowechsel, Abmelden, defekte Antwort, verworfener Request und Freitext-Renderer.

`supabase/tests/wochenserie-rollback.sql` – isolierte synthetische Daten,
falsche/fremde PIN, fehlende Nachbesserung, Wiederholungen, falsche/frühe Übungen,
fünfte richtige Frage, keine Nachtragung ins Wochenquiz und Berliner Sommerzeit.
Der Test enthält BEGIN/ROLLBACK und darf niemals zum dauerhaften Befüllen genutzt werden.

Lokale UI-Vorschau mit explizit künstlichen Daten separat; keine echten Quizantworten
für einen technischen Test abgeben. Nach Max' Push auf einem echten Konto/iPhone
Ansicht und Rückkehr nach Üben prüfen.
