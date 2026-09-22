# Obmann-Benachrichtigungen

Die Edge Function versendet ausschließlich kurze E-Mail-Benachrichtigungen an
den Obmann. Fachinhalte bleiben in der App beziehungsweise im Obmann-Zugang.
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
