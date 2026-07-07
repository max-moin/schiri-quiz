# Schiri-Quiz – Anleitung zum Live-Schalten

Der Code ist fertig und lokal durchgetestet. Es fehlen nur noch zwei kostenlose
Accounts, die nur du persönlich anlegen kannst (E-Mail-Bestätigung etc.).
Insgesamt ca. 15 Minuten, keine Kommandozeile nötig.

## Schritt 1: Supabase-Projekt anlegen (die Datenbank)

1. Auf [supabase.com](https://supabase.com) mit deiner E-Mail oder GitHub-Account registrieren (kostenlos, keine Kreditkarte nötig).
2. "New Project" klicken, einen Namen vergeben (z.B. `schiri-quiz`), Region z.B. `Frankfurt` wählen, ein Datenbank-Passwort setzen (merken, brauchst du aber für den nächsten Schritten nicht mehr).
3. Warten bis das Projekt fertig eingerichtet ist (dauert ca. 1-2 Minuten).
4. Links im Menü auf **SQL Editor** klicken, dort auf "New query".
5. Den kompletten Inhalt der Datei `supabase-schema.sql` reinkopieren und auf **Run** klicken. Das legt alle Tabellen, Sicherheitsregeln und drei Beispielfragen an.
6. Links im Menü auf **Project Settings -> Data API** gehen. Dort findest du:
   - **Project URL** (sieht aus wie `https://abcxyz.supabase.co`)
   - **anon public** Key (ein langer Text-String)
7. Diese beiden Werte in die Datei `config.js` eintragen, jeweils zwischen die Anführungszeichen.

## Schritt 2: Eigene Schiedsrichter eintragen

1. Im Supabase-Dashboard links auf **Table Editor** gehen, Tabelle `schiedsrichter` öffnen.
2. Die Beispielzeile "Max Müller" kannst du lassen oder löschen, und mit "Insert row" eure echten Namen eintragen (ein Name pro Zeile).

## Schritt 3: Eigene Fragen eintragen (wöchentlich)

1. Im Table Editor die Tabelle `fragen` öffnen.
2. Die drei Beispielfragen kannst du löschen oder als Vorlage lassen.
3. Neue Frage über "Insert row" anlegen: `frage_text`, drei Antwortmöglichkeiten (`option_a/b/c`), und in `richtige_option` eintragen, welcher Buchstabe stimmt (`a`, `b` oder `c`). `aktiv` auf `true` lassen.
4. Für die nächste Woche einfach die alte(n) Frage(n) auf `aktiv = false` setzen und neue mit `aktiv = true` anlegen – **kein Code-Update, kein neues Deployment nötig**, das passiert live.
5. Auswertung: Im **SQL Editor** kannst du jederzeit `select * from auswertung_pro_schiedsrichter;` ausführen, um zu sehen, wer wie viele Fragen richtig beantwortet hat.

## Schritt 4: Vercel-Account anlegen (das Hosting)

1. Auf [vercel.com](https://vercel.com) registrieren (kostenlos, am einfachsten mit demselben Anbieter wie bei Supabase, z.B. GitHub oder E-Mail).
2. Im Dashboard auf **Add New... -> Project** gehen.
3. Dort gibt es die Möglichkeit, einen Ordner direkt per Drag & Drop hochzuladen ("Deploy" ohne Git). Den kompletten `schiri-quiz`-Ordner (mit den bereits eingetragenen Werten in `config.js`!) dort reinziehen.
4. Nach ein paar Sekunden bekommst du einen Link wie `schiri-quiz.vercel.app` – das ist deine fertige Quiz-Seite, die du in eurer Signal-Gruppe teilen kannst.

## Änderungen später

Jedes Mal, wenn du an `index.html`, `style.css` oder `app.js` etwas änderst, musst du den Ordner erneut auf Vercel hochziehen (oder wir richten später eine Verbindung zu GitHub ein, dann reicht ein Klick "Redeploy"). Fragen und Schiedsrichter änderst du dagegen direkt in Supabase, ganz ohne neues Deployment.

## Falls etwas nicht funktioniert

- Leere Namensliste / keine Fragen sichtbar: Meist liegt es an falsch eingetragenen Werten in `config.js`, oder das SQL-Skript wurde noch nicht ausgeführt.
- Fehlermeldung auf der Seite: Steht meist schon im Klartext dabei (z.B. "Namensliste konnte nicht geladen werden: ..."), hilft beim Eingrenzen.
