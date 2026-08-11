# Schiri-Quiz – Entwicklung und sicherer Release

Diese Anleitung beschreibt den **aktuellen Betrieb** des bestehenden Projekts. Sie ersetzt die frühere Ersteinrichtungsanleitung, die nur zum sehr kleinen Anfangsprototyp passte.

## Wichtige Warnung zur Datenbank

`supabase-schema.sql` ist **kein aktuelles Installationsskript**. Es bildet nur den historischen Anfangsstand mit drei einfachen Tabellen ab. Das heutige System enthält unter anderem mehrere Vereine, Wochenzuordnungen, Freitextstatus, Übungsmodus, Gastzugang, Anfragen und zahlreiche geschützte RPCs.

Die Datei deshalb:

- nicht in der laufenden Supabase-Datenbank ausführen;
- nicht zur Einrichtung eines neuen produktiven Projekts verwenden;
- nicht als Beleg betrachten, dass die Datenbank vollständig reproduzierbar ist.

Der Migrationsordner enthält momentan ebenfalls nur die neuesten Änderungen. Eine vollständige Baseline des aktuellen Schemas muss noch erstellt und anschließend in einem separaten Testprojekt geprüft werden.

## Aktuelle Dienste

- GitHub-Repository: `max-moin/schiri-quiz`
- Hosting: Vercel
- Datenbank: Supabase in der Region Frankfurt (`eu-central-1`)
- KI: Google Gemini
- Production-Branch: `main`
- Vorschau: jeder andere gepushte Branch erzeugt eine Vercel-Preview

## Öffentliche und geheime Konfiguration

### Browser

`config.js` enthält:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` als Publishable Key

Beide Werte sind im Browser sichtbar und daher keine Geheimnisse. Trotzdem dürfen sie nur auf die dafür vorgesehene Supabase-Instanz zeigen.

### Vercel

Für Preview und Production müssen gesetzt sein:

- `GEMINI_API_KEY`
- `SUPABASE_SECRET_KEY`

Optional:

- `SUPABASE_URL`
- `GEMINI_MODELL`
- `GEMINI_BEWERTUNGS_MODELL`
- `GEMINI_ERKLAERUNGS_MODELL`

Der Standard ist `gemini-3.5-flash-lite`. Ein `SUPABASE_SECRET_KEY` oder alter `SUPABASE_SERVICE_ROLE_KEY` darf niemals in `config.js`, HTML, Browser-JavaScript, Screenshots, Issues oder Commits erscheinen.

## Arbeitsablauf für Änderungen

### 1. Eigenen Branch verwenden

Änderungen nicht direkt auf `main` ausprobieren. Einen klar benannten Branch verwenden, zum Beispiel:

```text
feature/kurzer-name
fix/kurzer-name
hardening/phase-1
```

### 2. Lokal prüfen

Mit Node.js 22 oder neuer:

```bash
npm run check
```

Die Prüfung muss ohne Fehler durchlaufen. Zusätzlich die betroffene Funktion selbst im Browser testen.

### 3. Branch pushen und Preview testen

Nach dem Push erzeugt Vercel eine Preview. Dort mindestens prüfen:

- Anmeldung für beide Vereinstypen;
- Laden der aktuellen Wochenfragen;
- Multiple-Choice-Antwort;
- Freitext grün, orange und rot;
- Orange bleibt nach Neuladen bestehen und akzeptiert genau eine Ergänzung;
- „Warum?“-Erklärung nach beantworteter Frage;
- Rechtsseiten und Abmelden;
- bei Layoutänderungen Smartphone und Desktop.

### 4. Erst danach nach `main`

Nur einen grünen Preview-Stand per Pull Request oder Fast-Forward nach `main` übernehmen. Ein Push auf `main` startet das Production-Deployment.

Nach dem Deployment denselben Kernpfad kurz auf der Production-Adresse prüfen. Nicht allein darauf vertrauen, dass die Preview funktioniert hat: Production kann andere Umgebungsvariablen besitzen.

### 5. Datenbankmigrationen zuletzt anwenden

Wenn ein Release Code **und** Datenbankrechte beziehungsweise Schemaänderungen benötigt, gilt grundsätzlich:

1. kompatiblen Server-/Frontend-Code deployen;
2. Production-Kernpfad prüfen;
3. vorbereitete Migration anwenden;
4. Berechtigungen oder Schema mit einer gezielten Abfrage verifizieren;
5. Production-Kernpfad erneut prüfen;
6. Supabase Security Advisors kontrollieren.

Dadurch wird verhindert, dass eine Datenbankänderung den noch alten Production-Code abschaltet.

## Aktuelle KI-Architektur

Die Browseroberfläche ruft für KI-Funktionen ausschließlich diese Vercel-Endpunkte auf:

- `/api/freitext-bewerten`
- `/api/erklaerung`

Nur die Vercel Functions besitzen den Gemini-Key und den geheimen Supabase-Schlüssel. Sie laden den erlaubten Kontext aus Supabase, rufen Gemini auf und speichern das geprüfte Ergebnis. Musterantworten und interne Bewertungshinweise sollen vor Abschluss der Antwort nicht an den Browser gehen.

Direkte öffentliche Gemini-Testendpunkte gehören nicht in Production.

## Fehler- und Kontingentverhalten

- Interne Fehlermeldungen stehen nur in den Vercel-Logs.
- Nutzer:innen erhalten kurze, stabile Fehlermeldungen ohne Schlüssel oder Datenbankdetails.
- Supabase- und Gemini-Aufrufe besitzen Zeitlimits.
- Bei erschöpftem Gemini-Kontingent wird eine Freitextantwort nicht gespeichert und kann später erneut gesendet werden.
- Der „Warum?“-Bereich liefert bei einem Kontingentfehler eine statische fachliche Ersatzerklärung.
- Ein Modellwechsel darf später nur gezielt auf echte Kontingent- oder Verfügbarkeitsfehler reagieren, nicht auf falsche Schlüssel oder Berechtigungsfehler.

## Supabase-Berechtigungen

RLS allein schützt `SECURITY DEFINER`-Funktionen nicht. Jede Funktion im exponierten Schema `public` muss deshalb einzeln eingeordnet werden:

- bewusst öffentlich und mit eigener PIN-/Eingabeprüfung;
- nur für `service_role` beziehungsweise Secret Key;
- oder intern und aus dem exponierten Schema zu entfernen.

Neue Funktionen erhalten standardmäßig keine Ausführungsrechte mehr für `PUBLIC`, `anon` oder `authenticated`. Jede neue Funktion muss deshalb in ihrer Migration ausdrücklich und nur für die tatsächlich benötigten Rollen freigegeben werden.

Nach einer Sicherheitsmigration werden mindestens geprüft:

- `anon` kann die geschützte Funktion nicht mehr ausführen;
- `authenticated` kann sie ebenfalls nicht ausführen, sofern nicht beabsichtigt;
- `service_role` kann sie weiterhin ausführen;
- der normale Website-Ablauf funktioniert weiterhin über die Vercel Function.

## Noch offene technische Grundlage

Für eine wirklich reproduzierbare Weiterentwicklung fehlen noch:

1. vollständige Baseline des aktuellen Supabase-Schemas;
2. Test dieser Baseline in einem separaten Supabase-Testprojekt;
3. Einordnung aller bestehenden Views und `SECURITY DEFINER`-Funktionen;
4. stärkeres Login-/Sitzungsmodell vor einer Ausweitung auf weitere Vereine;
5. Versionsverwaltung des separaten SwiftUI-Projekts.

Diese Punkte verhindern nicht den aktuellen kleinen Pilotbetrieb, müssen aber vor einer größeren Nutzung geschlossen werden.
