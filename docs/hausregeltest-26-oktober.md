# Hausregeltest 1 der Saison 2026/27

## Gebaut und bewusst getrennt

Website → Quiz → Hausregeltest. Vereinskennung/Name/PIN wie bisher, kein Gastmodus.
Zehn Originalfragen aus Max' Aufgabenblatt, keine KI-Bewertung, Musterlösungen,
Joker, Wochenpunkte, automatische Boxen oder Versand. Die Vorantworten sind im
Website-Obmannbereich einsehbar; andere Schiris erhalten sie nicht.

- Vorantworten bis einschließlich **8. November 2026** beliebig ändern.
- Ab **9. November 2026, 00:00 Europe/Berlin** eigene Vorantworten übernehmen
  und zur gemeinsamen Besprechung überarbeiten. Die Vorantworten bleiben erhalten.
- Eigene Endfassung bewusst bestätigen. Name/Verein/Einstufung und zehn Antworten
  sind erforderlich. Änderungen entwerten die alte Bestätigung; erneut bestätigen.
- Bestätigte Fassung als UTF-8-TXT mit CRLF herunterladen. Aufbau der gelieferten
  Vorlage, Punktefelder bleiben leer. Versionierte Dateinamen und private Historie.
- Bearbeitung bis einschließlich **22. November 2026**. Danach nur lesen/exportieren.
- Datei anschließend selbst an Auswerter senden. Download oder Bestätigung ist
  **keine** offizielle Abgabe. Empfänger wird nach letztem Namensbestandteil
  vorgeschlagen, muss am Originalblatt geprüft werden; kein automatischer Anhang.

## App statt zusätzlicher Website-Freigabe

1. Website selbst committen und pushen; kein automatischer Release durch Codex.
2. Der feste HRT wird für Löbtauer Kickers mit den bereits vereinbarten Fristen
   hinterlegt. **Kein zusätzlicher Bereitstellen-Knopf auf der Website.**
3. Neue native App bauen/installieren → **Modi → Hausregeltest** (ebenfalls über
   Verein → Training erreichbar). Fortschritt, Vorantworten und Überarbeitungen
   pro Person ansehen; bestätigte Endfassung als TXT sichern.
4. Teilnehmeransicht mit Testkonto am Handy und PC öffnen, Vorantwort speichern,
   neu laden und in deiner App kontrollieren. Erst dann Gruppe informieren.
5. Am 9. November Originalantwort und Überarbeitung vergleichen, bestätigen,
   TXT herunterladen und Umlaute/Name/Verein/Empfänger prüfen.

Einzelne bestätigte Textdateien in App und optional weiterhin im Website-Obmannbereich
herunterladbar. Die Webübersicht ist nur ein Ersatzweg, kein Pflichtschritt. Kein ZIP
und keine automatische Lösungseinblendung gebaut.
Das bereitgestellte Original-Aufgabenblatt ist verlinkt. Gemeinsame Besprechung
nicht als vom Verband ausdrücklich genehmigt ausgeben; die Mail regelt dies nicht.

## Speicherung und Fehler

Automatisches Speichern seriell, sichtbarer Status. Netzfehler erhalten Eingaben
im offenen Fenster und pausieren Autosave bis Retry. Warnung vor Verlassen mit
ungesicherten Eingaben; keine Antworten im lokalen Speicher. Revisionen verhindern
das Überschreiben von Änderungen eines zweiten Geräts. Bei Konflikt Eingabe kopieren,
danach Stand neu laden; kein automatisches Zusammenführen. Die Serverphase verhindert,
dass ein vor Mitternacht geöffnetes Formular später noch Vorantworten ändert.

Private Tabellen mit RLS ohne Direktzugriff, vier bewusst PIN-/Passwort-geprüfte
RPCs im vorhandenen Berechtigungsmodell. Keine Veränderung des bestehenden Logins.
Keine Bestände/Quizantworten/Termine/Benachrichtigungsauslöser geändert.

Migration `20261026154512_hausregeltest_vorbereitung_und_textabgabe.sql` live;
Anschlussmigration `hausregeltest_ohne_zusatzfreigabe` hinterlegt ausschließlich den
vereinbarten Test für den konkreten Verein und überschreibt keine existierenden
Test- oder Antwortdaten. Keine automatische Veröffentlichung für andere Vereine.
SQL-Rollbacktests prüfen PIN/Passwort,
Fremdverein, Wiederholung der Bereitstellung, Revision, Erstfassungserhalt,
frühe/leere/späte Endfassung, Bestätigungsentwertung, Historie und private Rechte.

Security Advisor: drei neue absichtlich private Tabellen erklären 73→76 Hinweise
„RLS ohne Policy“. Vier bewusst geprüfte öffentliche RPCs erklären 267→271 anon-
und 234→238 authenticated-Definer-Hinweise. Die zugrunde liegende PIN-Architektur
ist nicht als vollwertige Auth-Sanierung zu verstehen. Leaked-password-Hinweis
unverändert. Keine neuen fehlenden FK-Indizes/Primärschlüssel; neuer unbenutzter
Personenindex ist bei noch leerem System erwartbar.

Referenzen:
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Technische Abnahme

906 Webtests bestanden. Echter Chrome-Renderer bei 320/390/1280 Pixeln mit echter
gemeinsamer Anmeldelogik und künstlichen RPC-Antworten: Autosave, Reload,
Netzfehler→weitertippen→Fragenwechsel→Retry, Vorantwort→Endfassung, TXT-Download,
Bestätigung nach Änderung wieder verborgen, keine JS-Fehler/Seitenüberbreite.
SQL-Prüfung separat im tatsächlichen Backend in vollständig zurückgerollten
Transaktionen; keine echten Teilnehmerantworten. Kein Ersatz für reale
iPhone/Safari-/VoiceOver-Abnahme oder eine vollständige WCAG-Zertifizierung.
