# Vereinsbestellung und Erstattung – 21.10.2026

## Gebaut

In der Obmann-App unter **Eingang → Beschaffung → Artikel → Weitere Aktionen und Angaben**:

- **Bestellweg ändern**: Selbstkauf ↔ Verein bestellt. Auch nach Prüfung, Vorlage und Freigabe möglich, bis tatsächlich gekauft/bestellt wurde. Grund ist Pflicht. Preis, Vorlage und Vorstandsentscheidung bleiben unverändert. Nach Kauf/Bestellung gesperrt; keine gekauften Artikel durch Zurücksetzen verschleiern.
- **Vorstandsfreigabe dokumentieren**: für die bereits vorgelegte Anfrage, mit Name, Gesprächsnotiz und bewusster Bestätigung. Kennzeichnung „extern durch Obmann dokumentiert“, keine fingierte Onlineentscheidung. Zeitpunkt ist Erfassungszeit; Gesprächsdatum gehört in die Notiz. Keine eigene Ausgabenfreigabe Max'.

Vereinsweg:

1. Anfrage → Obmann-Prüfung → Vorstand → Freigabe.
2. Max bestätigt Bestellung.
3. Max bestätigt Ankunft: **abholbereit**. Abholung und tatsächlicher Erhalt sind noch nicht behauptet.
4. Schiri bestätigt auf **Meine Ausrüstung** den tatsächlichen Erhalt (zweistufiger Knopf gegen Fehlklicks).
5. Für den Schiri abgeschlossen: sieben Schritte, keine Erstattungsaufgabe mehr. Der Gegenstand wird genau einmal in seinen Bestand übernommen.
6. Bei Max bleibt der Vorgang offen: **Erstattung an Obmann anfordern**. Hinweis für Tom kann auf den Sammelbeleg verweisen.
7. Tom bestätigt die Überweisung über seinen Zugang. Alternativ kann Max die tatsächliche externe Zahlungsbestätigung mit nachvollziehbarer Notiz dokumentieren.
8. Max bestätigt **Erstattung bei mir angekommen**. Erst dann automatisch auch finanziell abgeschlossen.

Der Selbstkaufweg bleibt erhalten. Alte abgeschlossene Anfragen werden nicht wieder geöffnet. Kein echter Bestell-, Erhalt- oder Zahlungsstatus wurde in dieser Runde geändert.

## Gemeinsame Anzeige

App-Karte und Detail verwenden weiter dieselbe serverseitige Prozesslinie an allen Einstiegen. Grün „Erhalt bestätigt · Erstattung offen“ trennt Sach- und Geldabschluss. Schiri-Anliegen sind nach Erhalt als erledigt markiert. Tom-Portal und Zahlungsmail nennen ausdrücklich den Obmann als Erstattungsempfänger einer Vereinsbestellung. Lange Freigabenamen umbrechen mobil unter den Schritttitel statt seitlich herauszuragen.

## Verifiziert

- 890 Webtests bestanden; sechs neue Tests für Prozess, Schiri-Knopf, Wechselgrenzen, Freigabeherkunft und Mail-Empfänger.
- SQL-Rollbacktests mit künstlichen Vereinen/Personen, auch als `anon`: falsches Passwort, fremder Schiri, veraltete Ansicht, Wechsel in beide Richtungen nach Freigabe, vorzeitige Bestellung/Abholung, Bestell-/Kaufsperre, Freigabe-Idempotenz, Erhalt, eigener Erstattungsweg, automatischer Abschluss, genau ein Bestandsstück. Keine Testdaten zurückgeblieben.
- Echter Webseitenrenderer lokal bei 390 und 1280 px mit künstlichen Antworten der getesteten RPCs: erster Klick schreibt nichts, zweiter bestätigt genau einmal, danach sieben Schritte/keine weitere Schiri-Aktion; keine JS-Fehler oder horizontale Überbreite. Kein echter Browser-Schreibaufruf an Supabase.
- iOS-Simulator- und macOS-Build bestanden; neun gezielte native Beschaffungstests bestanden. Bekannte unabhängige MainActor-Warnung in Terminfindung unverändert. Kein echter iPhone-/Tom-Rundlauf und keine vollständige WCAG-Zertifizierung.

## Datenbank und Sicherheit

Migration `20261021201351_beschaffung_vereinsbestellung_und_erstattung.sql` live. Nur Funktionsdefinitionen erweitert; keine Datenmigration echter Anfragen. Zwei neue passwort-/vereinsgeprüfte RPCs mit Zeilensperre, interner Übergangshelfer weiterhin nicht öffentlich ausführbar. Alte RPC-Signaturen bleiben kompatibel. Vorstands-Mailfunktion `obmann-benachrichtigungen` Version 11 live, JWT-Prüfung unverändert; nur die Empfängerformulierung im bestehenden Versandmodul geändert, keine Testmail verschickt.

Security Advisor: bestehende 69 RLS-ohne-Policy- und eine Leaked-Password-Meldung unverändert. Die zwei bewusst per Obmann-Passwort geschützten API-Funktionen erhöhen die anonym ausführbaren Definer-Funktionen 261→263 und die für `authenticated` 228→230; kein direkter Tabellenzugriff freigegeben. Allgemeine Supabase-Empfehlung: [Ausführungsrechte gezielt begrenzen](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Eine Umstellung des bestehenden PIN-/Passwort-Systems auf Supabase Auth ist nicht Bestandteil dieses Umbaus.

## Veröffentlichung und gemeinsamer Test

Website lokal übernommen, **kein Commit/Push/Website-Deployment**. Max pusht wie bisher und installiert den neuen App-Build. Anschließend eine bewusst ausgewählte Anfrage durchgehen: Weg ändern → tatsächliche Telefonfreigabe dokumentieren → Bestellung/Ankunft → Schiri-Erhalt → eigener offener Erstattungsrest → tatsächliche Überweisung/Geldeingang. Keine dieser Tatsachen vorab bestätigen. Bestehende Sammelbestellungen werden nicht automatisch fortgeschrieben.
