# Obmann-Benachrichtigungen

Die Edge Function versendet kurze E-Mail-Benachrichtigungen an den Obmann.
Optional stößt sie außerdem den getrennten Web-Push-Dispatcher für Schiris an.
Ohne `SCHIRI_PUSH_CRON_AKTIV=true` bleibt dieser zweite Kanal vollständig aus.
Fachinhalte bleiben in der App beziehungsweise auf der Website.
Die Datenbank-Outbox sorgt dafür, dass Reloads, Doppelklicks und temporäre
Versandfehler keine doppelten E-Mails erzeugen.

## Benötigte Function-Secrets

Diese Werte gehören ausschließlich in die Supabase-Secrets, niemals in Git:

- `RESEND_API_KEY`
- `OBMANN_NOTIFICATION_TO`
- `OBMANN_NOTIFICATION_FROM`

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase der Function
automatisch bereit.

## Sicheres Aktivieren

1. Resend-Domain vollständig verifizieren.
2. Die drei Function-Secrets setzen.
3. In Supabase Vault `obmann_project_url` und `obmann_publishable_key` setzen.
   Das sind keine Provider-Geheimnisse; sie werden dennoch nicht ins Repository
   geschrieben, damit die Migration umgebungsneutral bleibt.
4. Function einmal manuell aufrufen; bei deaktiviertem Pilot muss sie null
   beanspruchte Aufträge melden.
5. Einen einzelnen Testauftrag erzeugen und Zustellung sowie Status prüfen.
6. Erst danach `email_aktiv` für den Empfänger `max` auf `true` setzen.

Es werden bewusst keine vorhandenen Eingänge nachträglich versendet.

## Betrieb

- Die Function wird regelmäßig per Supabase Cron aufgerufen.
- Pro Lauf beansprucht sie höchstens zehn Aufträge.
- Ein Auftrag hat eine fünfminütige Lease und maximal fünf Versuche.
- Resend erhält pro Auftrag einen stabilen `Idempotency-Key`.
- Permanente 4xx-Fehler (außer 429) werden nicht erneut versucht.
- Fachtexte, Begründungen, Beträge, Bilder und PINs gelangen nicht in die Mail.

## Persönlicher Web Push: Pilot und Freigabe

Die Migration `20260925220500_schiri_push_antworten.sql` schaltet zunächst
**nichts** ein. Nur Antworten auf selbst abgegebenes Fragenfeedback sind in
diesem Bauschritt sendbar. Quiz, Termine und Ausrüstung sind ausdrücklich noch
nicht aktiv. Weder vorhandene Antworten noch vorhandene Geräte werden
nachträglich angeschrieben.

Für den Pilot braucht Vercel in **dem Projekt der neuen Vereinsseite** folgende
Environment Variables für Production (gegebenenfalls auch Preview):

- `VAPID_OEFFENTLICHER_SCHLUESSEL`: Base64url-kodierter P-256-Public-Key.
- `VAPID_PRIVATER_SCHLUESSEL`: zugehöriger 32-Byte-Private-Key, Base64url.
- `VAPID_SUB`: Kontakt-URI wie `mailto:...` für den Push-Dienst.
- `PUSH_TEST_AKTIV=true`: erlaubt nur den gerätegebundenen Selbsttest.
- `PUSH_PILOT_SCHIRI_ID`: UUID des **einen** Pilotkontos; kein Name und keine PIN.

Ein Schlüsselpaar lässt sich im Projektordner lokal erzeugen, ohne einen
Drittanbieter oder eine Datei zu benutzen:

```sh
node --input-type=module -e 'import { vapidSchluesselpaarErzeugen } from "./server/webpush.js"; console.log(vapidSchluesselpaarErzeugen())'
```

Die Ausgabe enthält den privaten Schlüssel: nur in die Vercel-Variable
übertragen, nicht in einen Chat oder Commit kopieren. Danach nicht bei jedem
Deploy neu erzeugen, sonst werden bestehende Geräte-Abos ungültig.

Der öffentliche Schlüssel wird erst nach gültiger PIN über
`/api/push-bereitschaft` an dieses Konto geliefert. Der private Schlüssel
gehört weder in `verein.config.js` noch in Git. Das Pilotkonto aktiviert
zusätzlich auf `Einstellungen → Mitteilungen` erst das Thema und dann das
konkrete Gerät. Eine Testmitteilung kann dort höchstens einmal pro Minute
ausgelöst werden. Auf iPhone/iPad muss die Seite vorher zum Home-Bildschirm
hinzugefügt und **von dort** gestartet werden; im Safari-Tab ist Push nicht
verfügbar. Android und Desktop können je nach Browser auch ohne Installation
funktionieren.

Für echte Antworten nach bestandenem Pilot zusätzlich:

- Vercel: `PUSH_DISPATCH_AKTIV=true` und ein zufälliges langes
  `PUSH_SENDE_SCHLUESSEL`.
- Supabase Function-Secrets: derselbe `PUSH_SENDE_SCHLUESSEL` und
  `SCHIRI_PUSH_CRON_AKTIV=true`.

Zuerst Vercel deployen und den Selbsttest prüfen, **danach** den Cron-Schalter
setzen. Die bestehende Edge Function ruft dann alle zwei Minuten
`/api/push-auftraege` mit dem Sendegeheimnis auf. Der Endpunkt liest nur
autorisierte, höchstens 24 Stunden alte Aufträge und verschickt neutrale
Sperrbildschirmtexte ohne Frage, Antwort oder Namen. Die PIN wird allein zur
Kontoprüfung genutzt, nicht in Aufträgen gespeichert.

Vor einer allgemeinen Freigabe für 14-/15-jährige Schiris die
datenschutzrechtliche Einwilligung mit dem Verein prüfen lassen. Artikel 8
DSGVO kann bei einem unmittelbar an Kinder gerichteten Online-Dienst unter
16 Jahren eine elterliche Zustimmung verlangen. Der Pilot sollte deshalb
zunächst nur mit einem volljährigen Konto erfolgen; die technische
Freigabe ist keine juristische Freigabe.

**Sofortiges Abschalten:** `SCHIRI_PUSH_CRON_AKTIV` oder
`PUSH_DISPATCH_AKTIV` auf `false` setzen. Geräte können die Zustimmung in
Mitteilungen einzeln widerrufen; beim Abmelden wird das aktuelle Abo entfernt.
Die Browser-Berechtigung kann zusätzlich in den Systemeinstellungen entzogen
werden. Abos verfallen serverseitig nach 30 Tagen ohne erneute Bestätigung.
