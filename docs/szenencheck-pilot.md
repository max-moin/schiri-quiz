# Entscheiden · Szenencheck

- Website: **Quiz → Entscheiden · Szenencheck**. Reguläre Vereinsanmeldung, dann separater Pilotcode. Keine Runde vorab sichtbar. Kein Einfluss auf das Wochenquiz, die Serie oder Joker.
- Obmann-App: **Modi → Entscheiden · Szenencheck**. Titel, Beginn und Rundenschluss setzen. Pro Szene Frage, Clip und Antwortform festlegen: Icons für Pfiff/Karte, Multiple Choice (eine Antwort), Freitext. „Nicht beurteilbar“ ist immer möglich.
- Für eigene Clips: freigegebenen MP4-Ausschnitt bis 50 MB wählen. In Veo mit Download-Berechtigung im Clip-Menü rendern/herunterladen. Keine automatische Veo-Übernahme und keine Umgehung fehlender Freigaben. Nur die benötigten Szenen, kein komplettes Spiel hochladen.
- **Runde ansetzen** publiziert eine feste Fassung für den gewählten Zeitraum. Ein laufender oder künftiger Zeitraum kann nicht überlappen. Bei Fehlern Runde zurückziehen; der lokale Entwurf bleibt bearbeitbar. Beim Zurückziehen werden die Inhalte ausgeblendet, nicht aus dem Speicher gelöscht.
- Stimmabgabe ist bis zum Schluss änderbar. Danach werden nur Anzahlen, die eigene Stimme und ggf. die Feldentscheidung angezeigt. Keine fremden Freitexte und keine Namen. Vor Gruppenstart erklären, dass dies keine Richtig/Falsch-Wertung ist.

## Betrieb und Datenschutz

Der private Supabase-Bucket `szenencheck-clips` hat keine öffentlichen Leserichtlinien. Wiedergabelinks laufen nach fünf Minuten ab, sind aber während dieser Zeit technisch weitergebbar. Vor Verwendung realer Jugendaufnahmen Freigabe, den Teilnehmerkreis und die Löschfrist klären. Bereits gespeicherte Dateien bei Bedarf über die Supabase-Storage-Oberfläche anhand des Objektpfads entfernen; keine Löschung per SQL in `storage.objects`.

Die Migration legt keine Runde an. Den zusätzlichen Pilotcode pro Verein nur privat als bcrypt-Hash provisionieren. Den Code nicht in Browsercode, Git oder URLs schreiben. Die Edge Function `szenencheck` wird wegen der bestehenden Vereins-PIN-Anmeldung mit `verify_jwt=false` betrieben. Sie ruft das nur für `service_role` freigegebene RPC auf; die Autorisierung erfolgt vor jedem geschützten Zugriff im Gateway. Beim Deploy das Produktionsdomain-Allowlisting in `index.ts` beachten.

SQL-Test: `supabase/tests/szenencheck_pilot.sql` erzeugt und prüft ausschließlich synthetische Daten in einer Transaktion mit Rollback. Website-Regression: `npm run check`.
