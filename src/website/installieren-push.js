// Verdrahtung des Benachrichtigungs-Schalters auf installieren.html.
//
// Eigene kleine Datei, weil installieren-seite.js ein klassisches
// Skript ist (kein Modul) und den Import nicht aufnehmen kann - und
// weil der Schalter ohne hinterlegten Schluessel gar nichts tut.
// seite.js legt die gemeinsame Anmeldung unter globalThis ab; ohne sie
// (Skript nicht geladen) passiert hier schlicht nichts.
import { montierePushSchalter } from "./push-schalter.js";

const halter = document.querySelector("[data-push-halter]");
if (halter) {
  const bereit = globalThis.SchiriSeitenAnmeldung || {};
  montierePushSchalter(halter, bereit.anmeldung || null, bereit.loginDialog || null);
}
