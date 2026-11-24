# Schiri-Stimmungsbild · Freigabe und Abnahme

- **Website ohne Datenerhebung:** `/umfragen.html?vorschau=1` öffnet den echten Fragebogen zur Probe. Keine Anmeldung, Speicherung oder Übertragung der Eingaben. Die Version kann unabhängig von der Datenbank als Vorschau angesehen werden.
- **App:** Modi → Umfragen → Beispiele. Dort namentliches Testmaterial, fehlende Antworten, Tagesverteilung, beste gemeinsame Startfenster, Likert und Vorstandszahlen ansehen.
- **Teilnahme:** `/umfragen.html` verwendet den vorhandenen Vereinslogin. Ohne serverseitig freigegebenen Entwurf und zugelassenes aktives Konto gibt es keinen Fragebogen. Die Abgabe ist endgültig; eine Wiederholung überschreibt nichts.

## Vor einer namentlichen Erhebung

1. Additive Migration und Vercel-Routing in einer nichtproduktiven Umgebung prüfen. Die Migration öffnet oder befüllt nichts. Die Route verwendet den vorhandenen Vercel-Dispatcher und dessen serverseitige Supabase-Konfiguration; der Admin-Schlüssel gehört weder in die App-Datei noch in eine URL.
2. Vereins-ID, genauen Teilnehmerkreis, Frist und Aufbewahrung/Löschzeitpunkt mit Max bestätigen. Die Einrichtung legt **genau einen Entwurf** im privaten Schema an. Per Datenbankparameter wird die verifizierte Vereins-ID und der SHA-256-Hash des zufälligen 32-Byte-Schlüssels (43 Zeichen Base64url ohne Padding, nur Max bekannt) in `private.kickers_umfrage` gespeichert. Nur konkret berechtigte aktive Vereinskonten werden in `private.kickers_umfrage_teilnahme` aufgenommen. Keine Schlüssel, Namen oder PINs in Git/Testlogs.
3. End-to-end mit vorgesehenem Testkonto und einem nicht zugelassenen/fremden Konto prüfen: Entwurf, Öffnung, einmalige Abgabe, falsche PIN, danach die namentliche App-Ansicht und endgültiges Schließen. Nicht zu diesem Zweck mit echten Jugendkonten oder Produktionsantworten testen. Die erste Fassung unterstützt bewusst keine zweite laufende Umfrage und kein Wiederöffnen.
4. Max öffnet die fertige Umfrage ausdrücklich in der App und teilt dann erst den Teilnahmelink. Es gibt keine automatische Nachricht, keine Kalenderbuchung und keine Freigabe für andere Vereine.

## Lesart

- A/B/C/D/E = 5/4/3/2/1. Verfügbare Personen bei **derselben Startzeit** schlagen mehr Punkte. Erst bei gleicher Personenzahl entscheidet die Summe. Feste Konflikte bleiben ausgeschlossen, ein E-Tag ist möglich. Die App zeigt auch Gleichstände und rechnet mit Viertelstunden sowie maximal zwei Stunden bis zum Treffende.
- Einzelantworten, Namen und kompletter Rücklauf sind nur in der geschützten Obmann-Ansicht. Der Vorstand bekommt weder Zugang zur App-Ansicht noch Freitexte; nur Max teilt die separate Zahlenausgabe. Nach Abschluss und ab fünf Rückmeldungen ist die gesamt abgegebene Zahl verfügbar. Detailzahlen nur zu festen Fragen, bei denen jede sichtbare Gruppe und ihre jeweilige Restgruppe mindestens drei Personen umfasst. Keine Terminmuster, fehlenden Namen oder Kreuztabellen exportieren.
