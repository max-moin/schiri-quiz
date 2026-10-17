# Geschenkboxen, Quizjoker und Startseitenbilder · 18.10.2026

Dieser Stand ersetzt die älteren Konzept-/Vorbereitungsangaben in `ausbau-17-oktober.md`, `private-wochenserie.md` und `fragenvorschlaege-und-joker.md`.

## Gebaut

- Unter Quiz → Sammlung: ungeöffnete Boxen, Öffnen, zufälliger Inhalt, aktualisierter Bestand. Drei Typen mit gleichen Chancen (je1/3): Serienjoker,50/50,Zweiter Versuch. Kein Kauf, keine Währung, keine freie Auswahl. Boxen und Joker ohne Ablaufdatum, ein Joker einmal nutzbar. Bestehende Serienjoker bleiben erhalten.
- Vergabe ab18.10.2026: eine Box je Geburtstag, je bestätigter Hausregeltest-/Lehrabendteilnahme, nach jeweils vier vollständigen Quizrunden ab Einführung. Keine richtige Quote nötig; Wochen müssen nicht aufeinanderfolgen. Übungsantworten und bloße Serienrettungen zählen nicht. Keine alten Ereignisse vor Einführung nachholen; alte bereits vergebene Geburtstagsjoker nicht zusätzlich als Box vergeben.29.Februar→28.Februar in Nichtschaltjahren.
- Bestätigungen kommen aus bestehenden `fortbildung_nachweise`, nicht aus Zusagen. Ereignisdatum ab Einführung und nicht in der Zukunft. Zurückgenommene Teilnahme macht ungenutzte zugehörige Box/Joker bis zu einer erneuten Bestätigung unverfügbar; kein zweites Geschenk bei erneuter Bestätigung. Bereits verbrauchte Joker werden nicht negativ zurückgerechnet. Vergabe erfolgt beim nächsten Abruf des privaten Bestands, auch über das Quiz; kein neuer Cron/Push/Mail.
-50/50 nur vor der ersten Abgabe einer Einfachauswahl mit mindestens drei Optionen. Server wählt einen richtigen und einen zufälligen falschen Kandidaten; Browser erhält keine Zuordnung, welcher richtig ist. Reload liefert dieselben Kandidaten.
- Zweiter Versuch nach einer falschen Erstantwort, bevor die Lösung angezeigt wird. Erstbewertung in zurückgerollter Untertransaktion; private Speicherung von Erstantwort und Bewertung, keine vorzeitige Lösung/KI-Begründung. Wahl Joker / ohne Joker auflösen / später entscheiden. Offene Wahl und aktivierter zweiter Versuch bleiben nach Neuladen bestehen. Kein rückwirkendes Öffnen aufgelöster Antworten. Nicht zusätzlich mit der vorhandenen kostenlosen KI-Ergänzung kombinierbar.
- Auswahl, Mehrfachauswahl, Zahl, Freitext und Icon-Entscheidung nutzen dieselben bisherigen Validatoren. KI-Urteile ausschließlich über serverberechtigte RPC, nicht aus Browserdaten. Historie/Üben/Duell unverändert.
- Richtiger Joker-Versuch wird als normale richtige `antworten`-Zeile gespeichert; bestehende Statistik-/Dashboard-/Abzeichenaggregate werten ihn voll richtig. Kein reines grünes Frontend-Label. Obmann-App: hervorgehobene Kennzeichnung, Jokertyp, Erstantwort und Jokerantwort als Klartext. Diese Zusatzdaten sind nicht öffentlich. Bewusstes administratives Zurücksetzen löscht auch den zugehörigen Jokervorgang, aber erstattet keine verbrauchten Joker.
- Vier Startseitenkacheln mit lokal gespeicherten KI-Fotos statt SVG-/Inline-Vektoren, auch mobil als Bildstreifen. Unten rechts kontrastreiche Plakette „KI-generiert“, bei redaktionellem Ersatz durch ein anderes Foto ausgeblendet. Impressum erklärt fiktive Symbolbilder statt echter Vereinsfotos. Datenschutz für Bildmotive und private Box-/Antwortdaten ergänzt. Kein Bilddienst beim Seitenaufruf.

## Bilddateien und vollständige Prompts

Erzeugung mit dem eingebauten Bildgenerierungswerkzeug, anschließend WebP-Größenoptimierung. Keine echte Person, kein Nutzerfoto oder Vereinsmitglied als Vorlage hochgeladen. PNG-Originale unverändert erhalten.

Gemeinsamer Prompt für die vier Fotos (jeweils vollständig mit dem folgenden Einzelmotiv zusammen verwendet):

> Use case: photorealistic-natural. Asset type: website navigation card, landscape 3:2. A lively, premium candid editorial photograph for a German amateur football referee group's website. Natural late-afternoon daylight, authentic modest football club setting, greens, warm neutrals and muted navy. No illustration, no vector, no 3D render, no logos, no writing or watermark. Fictional people only, no identifiable real people. Strong clear subject centered, composed for wide cropping.

`bilder/startfotos/termine.webp` und `originale/termine.png`:

> Subject: Termine / shared appointments. Three young adult amateur referees, mixed genders, in simple unbranded black referee sportswear, standing together beside a green football field, smiling and coordinating their next match on a phone held naturally by one of them. Football goal softly blurred behind them. Authentic warmth and team spirit, candid not staged. No visible readable phone content.

`bilder/startfotos/absagen.webp` und `originale/absagen.png`:

> Subject: Absagen / communicating unavailability. Close candid over-the-shoulder view of a young adult amateur referee in plain dark athletic top, seated at a wooden football clubhouse table, thoughtfully typing a short message on a smartphone. A simple black whistle and closed referee notebook lie on table, green pitch softly blurred through open door behind. Calm responsible communication, not distressed. Focus on hands phone and whistle; no readable text on screen.

`bilder/startfotos/feedback.webp` und `originale/feedback.png`:

> Subject: Ideen & Feedback. Four fictional young adult referees, mixed genders, around a wooden clubhouse table, one listening attentively as another shares an idea, warm candid smiles, a small referee notebook and unbranded football visible at edge, green field through window, collaborative authentic discussion. Everyone anatomically natural, hands not cluttered, no staged business meeting, no readable writing.

`bilder/startfotos/unterlagen.webp` und `originale/unterlagen.png`:

> Subject: Unterlagen / referee resources. Carefully composed editorial still life on a real wooden clubhouse bench: an open referee notebook with blank unlined cream pages, black whistle with simple cord, yellow and red referee cards, a pen, unbranded plain dark referee kit folded nearby. Grass pitch and white touchline in soft background. Tactile real materials, warm natural sidelight, inviting and trustworthy. No text, no numbers, no computer graphics, no huge artificial props.

`bilder/joker/box.webp` und `bilder/joker/originale/box.png`, vollständiger eigener Prompt:

> Use case: stylized-concept. Asset type: small transparent website inventory image. One cheerful simple reward gift box for a football referee learning app, tactile soft clay-like 3D illustration matching friendly joker icons. Rounded pale mint and cream box with a dark forest-green ribbon and subtle warm gold star on front. Lid closed. Three-quarter view, centered isolated complete box with generous empty margins. No gambling casino, no treasure chest, no gems, no coins, no text, no medal. Clean silhouette legible at 90px. Genuine transparent background, no scenery.

Generator-Originale: `/Users/max/.codex/generated_images/019f862a-ad6b-7ed3-9299-72e6468fca56/` mit IDs `exec-d7ab1ce1-a3b3-4aec-a065-267b748fe052.png`, `exec-3e23e7cc-b245-4d56-8cb3-0296bf1ac78b.png`, `exec-1e5227a2-90a3-401e-9b1d-9e4d78514189.png`, `exec-3c46fba4-4eaa-4686-b5cc-c9f2fb248bf1.png`, `exec-2e018a55-058e-4fb9-8ecf-ba6120f6a486.png` in obiger Reihenfolge. Konsumierte Dateien liegen vollständig im Repository, nicht nur im Generatorordner.

## Prüfung und Grenze

-835Webtests bestanden; neue API-Tests prüfen ausdrücklich, dass beim Jokerangebot keine Musterantwort/Begründung ausgeliefert wird und der ursprüngliche Querybuilder erhalten bleibt.
-42lokale Browserzustände:320/390/844quer/768/1280px, neue Bildserie/KI-Kennzeichnung, Boxöffnung,50/50, offene Jokerwahl samt Reload, erneute richtige Abgabe, Freitextjoker,200%Schrift/Textabstände. Keine automatischen axe4.10.3-WCAG-A/AA-Funde, JS-Seitenfehler oder horizontalen Überläufe. Ausschließlich abgefangene künstliche API/RPC-Antworten;45simulierte,0echte Schreibaufrufe.
-macOS- und iOS-Simulator-Build bestanden, vorhandene App-Unit-Tests grün. Bekannte MainActor-Warnung in `TerminfindungVerwaltungView.swift` unverändert; keine echte Geräteabnahme oder formale WCAG-Zertifizierung behaupten.
- Migration `20261017223628_jokerboxen_und_quizjoker` live. Zwei SQL-Rollbacktests vor/nach Anwendung: Vergaben/Idempotenz/Fremdverein/PIN/Service-only-Grenze, Jokerangebot ohne Lösung,50/50, Vollwertung, Obmann-Erst-/Zweitantwort, Reset, Teilnahme-Widerruf, Vier-Wochen-Bonus; zusätzlich Zahl/Freitext/Icon und neuer Serienjoker. Danach0synthetische Testpersonen/-vereine/-runden/-fragen.
- Advisor vorher/nachher: RLS-ohne-Policy64→67 (drei private Tabellen, absichtlich keinerlei direkte API-Rechte), anon-Definer251→255/authenticated218→222 (vier PIN-/Obmann-geprüfte RPCs), bestehender Leaked-Password-Hinweis1 unverändert. Keine neue pauschale Sicherheitsfreigabe. [RLS-Hinweis](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Funktionsberechtigungen](https://supabase.com/docs/guides/database/functions#function-privileges).

Commit/Push/Vercel-Auslieferung durch Max. Für die neue Obmann-Kennzeichnung App neu bauen/installieren. Keine echten Antworten/Joker, Benachrichtigungen oder CMS-Veröffentlichungen als Test verändert.
