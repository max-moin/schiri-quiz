# Schiri-Stimmungsbild · Freigabe und Abnahme

- **Website ohne Datenerhebung:** `/umfragen.html?vorschau=1` öffnet den echten Fragebogen zur Probe. Keine Anmeldung, Speicherung oder Übertragung der Eingaben. Die Version kann unabhängig von der Datenbank als Vorschau angesehen werden.
- **App:** Modi → Umfragen → Beispiele. Dort namentliches Testmaterial, fehlende Antworten, Tagesverteilung, beste gemeinsame Startfenster, Likert und Vorstandszahlen ansehen.
- **Teilnahme:** `/umfragen.html` verwendet den vorhandenen Vereinslogin. Ohne serverseitig freigegebenen Entwurf und zugelassenes aktives Konto gibt es keinen Fragebogen. Die Abgabe ist endgültig; eine Wiederholung überschreibt nichts.
- **Teilnahmeschluss:** `schliesst_am` stoppt weitere Abgaben serverseitig und zeigt dem Obmann die Runde danach als geschlossen. Manuelles Schließen ist früher möglich. Weder Fristablauf noch Schließen löschen die Einzelantworten.

## Vor einer namentlichen Erhebung

1. Additive Migration und Vercel-Routing in einer nichtproduktiven Umgebung prüfen. Die Migration öffnet oder befüllt nichts. Die Route verwendet den vorhandenen Vercel-Dispatcher und dessen serverseitige Supabase-Konfiguration; der Admin-Schlüssel gehört weder in die App-Datei noch in eine URL.
2. Verifizierte Vereins-ID, zugelassenen Teilnehmerkreis, vereinbarte Frist und Aufbewahrung verwenden. Die Einrichtung legt **genau einen Entwurf** im privaten Schema an. In `private.kickers_umfrage` werden die Vereins-ID, `schliesst_am` und der SHA-256-Hash des zufälligen 32-Byte-Schlüssels (43 Zeichen Base64url ohne Padding, nur Max bekannt) gespeichert. Nur konkret berechtigte aktive Vereinskonten werden in `private.kickers_umfrage_teilnahme` aufgenommen. Keine Schlüssel, Namen oder PINs in Git/Testlogs.
3. End-to-end mit vorgesehenem Testkonto und einem nicht zugelassenen/fremden Konto prüfen: Entwurf, Öffnung, einmalige Abgabe, falsche PIN, danach die namentliche App-Ansicht und endgültiges Schließen. Nicht zu diesem Zweck mit echten Jugendkonten oder Produktionsantworten testen. Die erste Fassung unterstützt bewusst keine zweite laufende Umfrage und kein Wiederöffnen.
4. Nach ausdrücklichem Auftrag von Max die fertige Umfrage mit dem geschützten Obmann-Zugang öffnen und über die echte URL prüfen. Max teilt den Teilnahmelink. Es gibt keine automatische Nachricht, keine Kalenderbuchung und keine Freigabe für andere Vereine.

## Lesart

- Wöchentlich wiederkehrende Sperrzeiten je Tag ergänzen die ganztägigen Konflikte. Die Zeitachse deckt 17:00–22:00 Uhr ab; Treffstart 17:00–20:00. Beispiel „Dienstag nur bis 20 Uhr“: 20:00–22:00 sperren. Keine Angabe von Gründen nötig. Ein Treff muss für die Standardwertung volle zwei Stunden frei sein; ein genau angrenzender Termin schließt ihn nicht aus.
- Alte Antwortdaten mit 16:00–19:00 bleiben unverändert lesbar; in einer gemischten Auswertung wird das gemeinsame 17:00–20:00 Raster verwendet. Individualansicht markiert, wenn Sperrzeiten damals nicht abgefragt wurden. Keine Migration nötig; Web und App gemeinsam aktualisieren, da die ältere App stundenweise Konflikte nicht berücksichtigt. Einen laufenden Fragebogen nicht still austauschen.

- A/B/C/D/E = 5/4/3/2/1. Verfügbare Personen bei **derselben Startzeit** schlagen mehr Punkte. Erst bei gleicher Personenzahl entscheidet die Summe. Feste Konflikte bleiben ausgeschlossen, ein E-Tag ist möglich. Die App zeigt auch Gleichstände und rechnet mit Viertelstunden sowie maximal zwei Stunden bis zum Treffende.
- Einzelantworten, Namen und kompletter Rücklauf sind nur in der geschützten Obmann-Ansicht. Der Vorstand bekommt weder Zugang zur App-Ansicht noch Freitexte; nur Max teilt die separate Zahlenausgabe. Nach Abschluss und ab fünf Rückmeldungen ist die gesamt abgegebene Zahl verfügbar. Detailzahlen nur zu festen Fragen, bei denen jede sichtbare Gruppe und ihre jeweilige Restgruppe mindestens drei Personen umfasst. Keine Terminmuster, fehlenden Namen oder Kreuztabellen exportieren.
