# Szenencheck: von der Vorschau zum Rückblick

- **Am Wochenende:** Szenen auswählen und Clips bzw. Links auf die Freigabe für die Zielgruppe prüfen. Fünf Szenen sind ein Richtwert; zwei, drei oder acht gehen genauso. RBC-Jugendszenen bleiben offline und gehören auch nicht in eine Online-Testvorschau.
- **Vorab:** Lokal lassen sich die Antwortkarten sofort ausprobieren. Für einen Online-Test Start wählen (optional „Eine Woche vor Vereinsbeginn“), aktive Testkonten auswählen und ohne Vereinsstart speichern oder den Vereinsstart direkt planen. Teststimmen sind technisch getrennt. Die Tester können die Vorschau unter „Runde auswählen“ öffnen, auch wenn eine andere Vereinsrunde offen ist.
- **Im Verein:** Der Obmann bestimmt Start und Abstimmungsende. Ab dem Start genügt die Vereinsanmeldung. Eine Pause verhindert neue Stimmen und neue Clip-Links, verschiebt aber das Ende nicht. Bereits erteilte private Links können noch bis zum Ablauf ihrer kurzen Gültigkeit funktionieren.
- **Ab Donnerstag, wenn passend:** Nach Abstimmungsende Einordnung und, falls vorhanden, die offizielle Quelle eingeben. „Rückblick jetzt veröffentlichen“ schaltet beides zusammen mit anonymen Zahlen frei. Ohne Freigabedatum bleibt der Rückblick bis dahin verborgen. Einen automatischen Termin nur verwenden, wenn die Fassung bis dahin fertig ist. Die Vereinsstimmen sind keine offizielle Regelentscheidung.
- **Reserve:** Bis zu vier (oder mehr) eigene Runden als Ersatz vormerken und ohne Vereinsstart auf dem Server sichern. Im Bedarfsfall eine davon auswählen und mit konkretem neuen Zeitfenster freigeben. Nichts rotiert oder veröffentlicht sich automatisch. Bereits freigegebene Runde nicht überschreiben: falls nötig ausdrücklich pausieren oder zurückziehen.

## Getrennter Rollout

Migration für die zusätzlichen privaten Tabellen und RPC lokal prüfen, dann die Edge Function und zum Schluss Website und Obmann-App in der Freigabeumgebung testen. Der Pilot hat weiterhin seinen eigenen Code, separat gespeicherte Stimmen und eine separate Verwaltung. Testkonten einer zweiten Gruppe lassen sich nur mit deren eigenem Obmann-Zugang ausdrücklich auswählen und haben nach Vereinsstart keinen Zugriff mehr.

Die lokale Prüfsuite nutzt ausschließlich synthetische Daten: `node tests/szenencheck-v2.local.mjs /absoluter/pfad/zu/pglite/dist/index.js`. Website-Tests: `node --test tests/*.test.js`.
