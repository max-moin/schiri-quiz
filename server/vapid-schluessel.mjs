/**
 * Erzeugt ein frisches VAPID-Schlüsselpaar (P-256) für Web Push.
 *
 *   node server/vapid-schluessel.mjs
 *
 * Das Skript schreibt nichts und ruft nichts auf - es würfelt einmal
 * und gibt aus. Der private Teil darf ausschließlich in die
 * Vercel-Umgebungsvariablen wandern, nirgendwo ins Repo und in keinen
 * Chatverlauf.
 */

import { vapidSchluesselpaarErzeugen } from "./webpush.js";

const { oeffentlich, privat } = vapidSchluesselpaarErzeugen();

console.log(`
Neues VAPID-Schlüsselpaar (P-256, base64url)
============================================

VAPID_OEFFENTLICHER_SCHLUESSEL
  ${oeffentlich}

  Darf öffentlich sein. Kommt in die Vercel-Umgebung und wird von der
  Seite an pushManager.subscribe({ applicationServerKey }) gegeben.

VAPID_PRIVATER_SCHLUESSEL
  ${privat}

  GEHEIM. Nur in die Vercel-Umgebung (Production und Preview), niemals
  ins Repo, niemals in eine HTML-Datei, niemals weitergeben. Wer ihn
  hat, kann im Namen der Vereinsseite Benachrichtigungen an alle
  verschicken.

Außerdem gesetzt werden müssen:

VAPID_SUB
  mailto:<Adresse aus dem Impressum>
  Apple weist Zustellungen ohne gültige mailto:- oder https:-Adresse
  mit 403 ab, deshalb ist das keine Zierde, sondern Pflicht.

PUSH_SENDE_SCHLUESSEL
  Ein langes Zufallsgeheimnis, z. B. aus:
  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
  Nur damit lässt sich /api/push-senden auslösen.

Achtung: Wird VAPID_PRIVATER_SCHLUESSEL später ausgetauscht, sind alle
bestehenden Abonnements wertlos - die Browser haben sie an den alten
öffentlichen Schlüssel gebunden. Dann muss jeder erneut zustimmen.
`);
