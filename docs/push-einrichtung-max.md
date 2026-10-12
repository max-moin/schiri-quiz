# Schiri-Web-Push selbst einrichten – Klickanleitung

Du brauchst Codex keinen Vercel-Zugang und keine geheimen Schlüssel zu geben.
Deine Obmann-E-Mails an Proton bleiben unverändert. Diese Anleitung aktiviert
zunächst **nur den Test für dein eigenes Schiri-Konto**, nicht den allgemeinen Versand.

## 1. Das richtige Projekt öffnen

1. Öffne https://vercel.com/dashboard und melde dich selbst an.
2. Wähle oben das Team **schiri-quiz**.
3. Öffne das Projekt **schiri-vereinsseite**.
4. Kontrolliere unter **Settings → Domains**, dass dort
   `www.schiri-loebtauer-kickers.com` steht.
5. Öffne **Settings → Environment Variables** (je nach Oberfläche direkt
   „Environment Variables“ in der Projekt-Seitenleiste).
6. Filtere auf **Production**. Nicht „Preview“: Dein iPhone nutzt die Live-Domain.

## 2. Namen prüfen – Schlüssel nicht im Chat zeigen

Suche nacheinander diese Variablen. Existierende Werte nicht einfach ersetzen.

| Name | Was damit zu tun ist |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Bereits vorhandener Server-Schlüssel. Nicht ersetzen oder kopieren. Alternativ unterstützt der Code den alten `SUPABASE_SERVICE_ROLE_KEY`. |
| `VAPID_OEFFENTLICHER_SCHLUESSEL` | Öffentlicher Teil des vorhandenen VAPID-Schlüsselpaares. |
| `VAPID_PRIVATER_SCHLUESSEL` | Privater Teil desselben Paares. Als geheim/Sensitive behandeln. |
| `VAPID_SUB` | Kontakt des Push-Absenders, z. B. `mailto:sr.obmann.lk@proton.me`. Das ändert nicht die Mail-Empfänger. |

Beide VAPID-Schlüssel müssen zusammengehören. Ein Austausch kann vorhandene
Geräte-Abos ungültig machen. Deshalb ein existierendes Paar behalten.
Falls beide fehlen, kannst du das mitgelieferte lokale Werkzeug
**Push-Schlüssel lokal erstellen.html** öffnen und einmal „Schlüsselpaar erstellen“
anklicken. Es erzeugt die Werte nur auf deinem Mac, ohne Netzwerkzugriff und ohne
sie zu speichern. Die Felder kopierst du selbst nach Vercel. Den privaten Wert
nicht an Codex schicken und nicht als Screenshot teilen. Nicht mehrfach erzeugen,
während du die beiden Felder einträgst.

Falls nur einer fehlt oder du die Herkunft nicht weißt: erst klären, statt ein
neues Paar mit einem alten Wert zu mischen.

## 3. Nur deinen Pilot freigeben

Für jede Zeile: **Add New** bzw. bei vorhandenem Eintrag **… → Edit**,
Name und Value eintragen, **Production** auswählen, **Save**.

| Name | Value |
| --- | --- |
| `PUSH_TEST_AKTIV` | `true` |
| `PUSH_PILOT_SCHIRI_ID` | `33f0b111-d87c-4041-a65e-19438565d144` |

Die ID gehört zu deinem freigegebenen Konto **Max M. / Löbtauer Kickers**.
`PUSH_DISPATCH_AKTIV` vorerst **nicht einschalten**. Ebenso den Supabase-Schalter
`SCHIRI_PUSH_CRON_AKTIV` unverändert lassen. Der Pilot ist eine manuell ausgelöste
Testmitteilung; damit sind noch keine automatischen Montag-/Freitag-/Sonntag-Erinnerungen aktiv.

## 4. Neu bereitstellen

1. Öffne im Projekt **Deployments**.
2. Wähle das zuletzt erfolgreiche **Production**-Deployment des gewünschten
   Website-Stands (Branch `vereinsseite`).
3. **… → Redeploy**. Ziel **Production** prüfen und bestätigen.
4. Warte auf **Ready**.

Geänderte Variablen gelten erst für ein neues Deployment. Wenn du gleichzeitig
den neuen Hilfe-Code veröffentlichen möchtest, kannst du stattdessen den geprüften
Stand über GitHub pushen und das dadurch entstehende Production-Deployment abwarten.

## 5. Auf dem iPhone testen

1. Öffne die Website **über ihr Symbol auf deinem Home-Bildschirm**, nicht nur im Safari-Tab.
2. Melde dich mit deinem Max-M.-Schiri-Konto an.
3. **Konto → Einstellungen → Mitteilungen** öffnen.
4. **Status neu laden**. Bei „Versand noch nicht gestartet“ zunächst Projekt,
   Production-Variablen und das neue Deployment kontrollieren.
5. Wenn die Seite die Aktivierung anbietet: Gerät aktivieren und bei der
   iOS-Rückfrage **Erlauben** wählen. Du kannst die Erlaubnis später widerrufen.
6. **Testmitteilung** auslösen, die Webapp in den Hintergrund legen und die
   Zustellung sowie das Öffnen durch Antippen prüfen.
7. Abschließend das Abschalten am Gerät testen. Erst danach folgt die allgemeine
   Freigabe mit automatischen Erinnerungen und freiwilliger Themenauswahl.

Auf iPhone/iPad braucht Web-Push iOS/iPadOS 16.4 oder neuer und eine
Home-Bildschirm-Webapp. Bei abgelehnter Erlaubnis kann die Website nicht einfach
erneut fragen; die Erlaubnis muss in den iPhone-Einstellungen geändert werden.

## Allgemeine Gerätefreigabe nach dem Pilot

Der Test auf Max' iPhone und Mac wurde am 12.10.2026 bestätigt.
`PUSH_ANMELDUNG_AKTIV=true` ist in Vercel für Production gespeichert.
Der neue Website-Code muss noch über den Branch `vereinsseite` veröffentlicht werden.
Danach können alle angemeldeten Schiris ihre Themen bewusst speichern, ihre
eigenen Geräte einschalten und Testmitteilungen senden. Niemand wird automatisch angemeldet.

**Das ist noch nicht die automatische Erinnerungsfreigabe.** Dafür müssen auf
Vercel zusätzlich `PUSH_DISPATCH_AKTIV=true` und ein geheimes
`PUSH_SENDE_SCHLUESSEL` vorhanden sein. Die bestehende Supabase-Function
`obmann-benachrichtigungen` braucht denselben geheimen Wert sowie
`SCHIRI_PUSH_CRON_AKTIV=true`. Kein vorhandenes VAPID-Paar austauschen.
Der gemeinsame Schlüssel dient ausschließlich der Server-zu-Server-Verbindung;
er gehört nicht ins Frontend, in Git, in eine Nachricht oder einen Screenshot.
Der bestehende zweiminütige Cron kann danach die autorisierten Aufträge senden.
Max' Proton-Mails bleiben unabhängig davon unverändert.

Die Freigaben nicht ohne Prüfung als aktiv behaupten: erst neue Production-Version
Ready, dann allgemeine Geräteanmeldung prüfen, danach tatsächlichen automatischen
Fachauftrag mit Opt-in, Klickziel und Widerruf abnehmen.

## Welche Infos reichen für eine Rückmeldung?

- Welche der Variablennamen vorhanden sind und ob sie für **Production** gelten.
- Ob das richtige Projekt und die Domain passen.
- Ob das neue Deployment **Ready** ist (Commit/Deployment-ID ist kein Geheimnis).
- Wortlaut des Gerätestatus bzw. einer Fehlermeldung und iOS-Version.
- Keine PIN, privaten VAPID-Schlüssel, Supabase-Secrets oder unmaskierten Variablenwerte.

Quellen: [Vercel: Variablen verwalten](https://vercel.com/docs/environment-variables/managing-environment-variables),
[WebKit: Web Push für Home-Screen-Webapps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
