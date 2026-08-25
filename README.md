# ⚽ Schiri-Quiz der Woche

Vereinsinternes Regelquiz für Fußball-Schiedsrichter:innen. Die Teilnehmer:innen beantworten jede Woche einige Multiple-Choice-, Freitext- und Videofragen. Eine separate SwiftUI-App unterstützt den Schiedsrichter-Obmann bei Fragenpflege, Wochenplanung und Auswertung.

Das Projekt befindet sich im **aktiven Pilotbetrieb** in einem kleinen Verein. Es ist zugleich ein privates Lernprojekt und noch kein allgemein einsetzbares Vereinsprodukt.

## Funktionen

- Anmeldung über Vereinskennung, Name und persönliche PIN
- getrennte Wochenplanung für mehrere Vereine bei gemeinsamer Fragenbasis
- Multiple-Choice-, Freitext- und Video-Fragen
- KI-gestützte Freitextbewertung mit drei Zuständen:
  - **grün:** fachlich richtig
  - **orange:** richtige Richtung, aber eine konkrete Ergänzung fehlt
  - **rot:** fachlich falsch
- bei Orange genau eine adaptive Rückfrage und ein zweiter Versuch
- kurze „Warum?“-Erklärungen nach beantworteten Fragen
- statische Ersatzerklärung, falls das KI-Kontingent nicht verfügbar ist
- Übungsmodus für ältere Fragen und separater Gastzugang
- Anfragen an den Obmann, etwa für Ausrüstung oder allgemeine Anliegen
- responsive Oberfläche für Smartphone und Desktop

## Architektur

```text
Browser
  ├─ statisches HTML, CSS und JavaScript
  ├─ öffentliche, PIN-prüfende Supabase-RPCs
  └─ /api/freitext-bewerten und /api/erklaerung
         ├─ Google Gemini
         └─ geschützte Supabase-RPCs mit serverseitigem Secret

SwiftUI-App des Obmanns
  └─ dasselbe Supabase-Projekt
```

- **Frontend:** HTML, CSS und JavaScript ohne Framework oder Build-Schritt
- **Serverfunktionen:** Vercel Functions unter `api/`
- **Datenbank:** Supabase/Postgres mit RLS und Postgres-Funktionen
- **KI:** Google Gemini, standardmäßig `gemini-3.5-flash-lite`
- **Hosting:** Vercel; `main` ist Production, andere Branches erzeugen Previews
- **Obmann-App:** separates lokales SwiftUI-Projekt für macOS, iPhone und iPad; derzeit noch nicht Bestandteil dieses Repositorys

## Projektstruktur

Seit dem Umbau zur Vereinsseite (August 2026) gibt es zwei getrennte
Bereiche, die sich keine Dateien teilen: den **offenen Teil** (Startseite,
Schiri werden, Regeln, Spesenrechner, Vorlagen, Unterlagen) und das
**Quiz** hinter der Anmeldung. Das ist Absicht – das Quiz läuft im
Echtbetrieb, und eine Änderung an der Vereinsseite soll es nicht anfassen
können.

| Pfad | Zweck |
|---|---|
| `index.html` | öffentliche Startseite des Vereins |
| `schiri-werden.html`, `regeluebersicht.html`, `spesenrechner.html`, `vorlagen.html`, `informationen.html` | die übrigen offenen Seiten; `informationen.html` heißt in der Navigation „Unterlagen" |
| `seite.css`, `seite.js`, `verein.config.js` | Gestaltung, gemeinsames Skript und Vereinsdaten des offenen Teils |
| `bilder/` | Wappen und die selbst gezeichneten Motive; `bilder/QUELLEN.md` hält fest, woher welches Bild stammt |
| `quiz.html`, `style.css`, `app.js` | Teilnehmeroberfläche und Quizablauf |
| `src/core/` | featureunabhängige Browser-Helfer und Sitzungsspeicher des Quiz |
| `src/ui/` | wiederverwendbare UI-Controller für Maskierung, Vorlesen und Dialoge |
| `src/features/` | abgeschlossene Quizfunktionen wie Videoplayer und Gastmodus |
| `api/` | serverseitige KI-Bewertung und Erklärungen |
| `server/api-helpers.js` | gemeinsame Server-, Supabase- und Gemini-Helfer |
| `tests/` | Vertrags-, Sicherheits- und Logiktests |
| `supabase/migrations/` | neuere versionierte Datenbankänderungen |
| `config.js` | öffentliche Supabase-URL und Publishable Key für den Browser |
| `datenschutz.html`, `impressum.html`, `nutzungsbedingungen.html` | rechtliche Seiten des aktuellen Pilotbetriebs |

## Sicherheit und bekannte Grenzen

Der Wert `SUPABASE_ANON_KEY` in `config.js` ist ein **Publishable Key** und darf im Browser sichtbar sein. Geheim bleiben müssen dagegen insbesondere:

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

Diese Werte werden ausschließlich als Vercel-Umgebungsvariablen verwendet. Die beiden KI-Endpunkte verweigern ihren Betrieb, wenn kein geheimer Supabase-Schlüssel vorhanden ist.

Die Anwendung schützt Daten zusätzlich über RLS, eingeschränkte Datenbankrechte und PIN-prüfende RPCs. Die KI-nahen RPCs sind nur für den serverseitigen Supabase-Schlüssel vorgesehen. Automatische Tests prüfen unter anderem, dass kein geheimer Schlüssel an den Browser fällt und dass interne Serverfehler nicht offengelegt werden.

Bekannte Grenzen:

- Die kurzen PINs sind für den kleinen vereinsinternen Pilotbetrieb gedacht und ersetzen kein vollständiges Benutzerkonto.
- Vor einer Nutzung durch weitere Vereine oder einen Verband braucht das Authentifizierungs- und Berechtigungsmodell eine weitere Härtung.
- Einige ältere Datenbankfunktionen und Views werden noch einzeln auf minimal notwendige Rechte geprüft.
- Die rechtlichen Seiten sind eine Arbeitsfassung und keine anwaltlich geprüfte Rechtsberatung.

Sicherheitsprobleme bitte nicht zusammen mit echten personenbezogenen Daten in ein öffentliches Issue schreiben, sondern zunächst direkt an den Projektverantwortlichen melden.

## Lokale Prüfungen

Benötigt wird Node.js 22 oder neuer. Es gibt keine zu installierenden Laufzeitabhängigkeiten.

```bash
npm run check
```

Der Befehl prüft die JavaScript-Syntax und führt die automatisierten Tests aus. Dieselbe Prüfung läuft bei jedem Push und Pull Request über GitHub Actions.

## Konfiguration

Für die Vercel Functions werden benötigt:

```text
GEMINI_API_KEY
SUPABASE_SECRET_KEY
```

Optional überschreibbar sind:

```text
SUPABASE_URL
GEMINI_MODELL
GEMINI_BEWERTUNGS_MODELL
GEMINI_ERKLAERUNGS_MODELL
```

`config.js` enthält ausschließlich die öffentliche Supabase-Verbindung des Browsers. Dort darf niemals ein Secret- oder Service-Role-Key eingetragen werden.

## Datenbankstand

`supabase-schema.sql` dokumentiert nur den **historischen ersten Prototyp**. Die Datei bildet die heutige Datenbank nicht vollständig ab und darf nicht als aktuelles Neuinstallationsskript oder als Migration für das laufende Projekt verwendet werden.

Auch der Ordner `supabase/migrations/` enthält derzeit nur die neueren Änderungen und noch keine vollständige Baseline der gewachsenen Datenbank. Eine komplett reproduzierbare Neuinstallation ist deshalb eine offene technische Aufgabe. Für das bestehende Projekt gilt die Supabase-Produktionsdatenbank als aktueller Stand; neue Änderungen werden ab jetzt als Migration versioniert.

Der sichere Release-Ablauf steht in [ANLEITUNG.md](./ANLEITUNG.md).

## Entwicklung mit KI-Unterstützung

Das Projekt wurde von Max Müller als Schiedsrichter-Obmann konzipiert und mit Claude und Codex umgesetzt. Anforderungen, fachliche Regeln, Produktentscheidungen und Live-Tests kommen von Max; ein erheblicher Teil des Codes wurde KI-gestützt erzeugt oder überarbeitet. KI-Code wird dabei wie fremder Code behandelt: prüfen, testen und erst über eine Preview nach Production übernehmen.

Issues und konkrete Verbesserungsvorschläge sind willkommen.

## Lizenz

Der Quellcode steht unter der [MIT-Lizenz](./LICENSE).
