// ============================================================
//  Benachrichtigungen ein- und ausschalten (Browserseite)
// ============================================================
//  Der schwierige Teil ist nicht das Abonnieren, sondern die ehrliche
//  Auskunft darueber, warum es gerade NICHT geht. Die Gruende sind je
//  nach Geraet voellig verschieden, und ein Schalter, der einfach nichts
//  tut, ist schlimmer als gar keiner.
//
//  iPhone / iPad (ab iOS 16.4):
//   - Benachrichtigungen gibt es NUR, wenn die Seite vom
//     Home-Bildschirm gestartet wurde. Im normalen Safari-Tab fehlen
//     "PushManager" und "Notification" schlicht.
//   - Die Erlaubnis muss aus einer echten Tippgeste heraus erfragt
//     werden. Beim Laden der Seite von selbst zu fragen, wird vom
//     System abgelehnt - und waere auch unverschaemt.
//   - Jede Zustellung MUSS eine sichtbare Mitteilung erzeugen. Stille
//     Pushes fuehren dazu, dass das System die Erlaubnis wieder
//     entzieht. Deshalb "userVisibleOnly: true" - auf iOS Pflicht.
//
//  Android (Chrome, Firefox):
//   - Funktioniert auch im normalen Browser-Tab, ohne Installation.
//   - "userVisibleOnly: true" ist bei Chrome ohnehin verpflichtend.
//   - Chrome merkt sich, wenn Leute die Frage wegklicken, und blendet
//     sie beim naechsten Mal leiser ein. Umso wichtiger, dass wir erst
//     fragen, wenn jemand den Schalter ausdruecklich umlegt.
//
//  Rechner (Safari macOS, Chrome, Firefox): funktioniert, wird hier
//  aber nicht gesondert behandelt - es ist derselbe Weg wie Android.
//
//  Was NICHT passiert: Es wird nichts beim Laden der Seite registriert
//  und nichts ungefragt abonniert. Wer den Schalter nie anfasst,
//  bekommt keinen Service Worker und keine Erlaubnisabfrage.
// ============================================================

const SW_PFAD = "/sw.js";

// Base64url aus dem VAPID-Schluessel in das Byte-Feld, das
// "applicationServerKey" verlangt.
function schluesselAlsBytes(base64url) {
  const gefuellt = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  const roh = atob(gefuellt);
  const feld = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) feld[i] = roh.charCodeAt(i);
  return feld;
}

function bytesAlsBase64url(puffer) {
  const bytes = new Uint8Array(puffer);
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Nur zur Selbstauskunft in der eigenen Uebersicht ("iPhone" statt einer
// 200 Zeichen langen Adresse). Bewusst grob: es wird nichts ausgelesen,
// was ueber die Plattform hinausgeht.
function geraetebeschreibung() {
  const ua = navigator.userAgent || "";
  const art = /iPhone|iPad|iPod/.test(ua) ? "iPhone/iPad"
    : /Android/.test(ua) ? "Android"
    : /Macintosh/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows" : "Gerät";
  return `${art}${imAppModus() ? " (App)" : ""}`;
}

export function imAppModus() {
  return globalThis.matchMedia?.("(display-mode: standalone)")?.matches === true
    || globalThis.navigator?.standalone === true;
}

function istApfelGeraet() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent || "");
}

// Die eine Funktion, die der Oberflaeche sagt, was ueberhaupt geht -
// und in Worten warum nicht. Sie raet nicht, sondern prueft der Reihe
// nach: kann der Browser es, darf diese Seite es, ist es erlaubt.
export function lagebericht() {
  if (!globalThis.isSecureContext) {
    return { moeglich: false, grund: "Benachrichtigungen gehen nur über eine gesicherte Verbindung." };
  }
  if (!("serviceWorker" in navigator)) {
    return { moeglich: false, grund: "Dieser Browser kann keine Benachrichtigungen empfangen." };
  }
  if (!("PushManager" in globalThis) || !("Notification" in globalThis)) {
    // Genau hier landen iPhones im normalen Safari-Tab.
    return istApfelGeraet() && !imAppModus()
      ? {
        moeglich: false,
        grund: "Auf dem iPhone gibt es Benachrichtigungen nur, wenn die Seite auf dem Home-Bildschirm liegt.",
        hinweis: "installieren",
      }
      : { moeglich: false, grund: "Dieser Browser kann keine Benachrichtigungen empfangen." };
  }
  if (Notification.permission === "denied") {
    return {
      moeglich: false,
      grund: "Benachrichtigungen sind für diese Seite in den Einstellungen deines Geräts abgeschaltet.",
    };
  }
  return { moeglich: true, erlaubt: Notification.permission === "granted" };
}

async function workerBereit() {
  const vorhanden = await navigator.serviceWorker.getRegistration(SW_PFAD);
  const registrierung = vorhanden || await navigator.serviceWorker.register(SW_PFAD, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registrierung;
}

export async function aktuellesAbo() {
  const lage = lagebericht();
  if (!lage.moeglich) return null;
  const registrierung = await navigator.serviceWorker.getRegistration(SW_PFAD);
  if (!registrierung) return null;
  return registrierung.pushManager.getSubscription();
}

/**
 * Schaltet Benachrichtigungen ein. MUSS aus einem Klick heraus gerufen
 * werden - sonst lehnt iOS die Erlaubnisabfrage ab.
 */
export async function einschalten({ oeffentlicherSchluessel, speichern }) {
  const lage = lagebericht();
  if (!lage.moeglich) throw new Error(lage.grund);
  if (!oeffentlicherSchluessel) throw new Error("Für diese Seite sind Benachrichtigungen noch nicht eingerichtet.");

  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") {
    throw new Error("Ohne deine Erlaubnis können wir nichts schicken. Du kannst das später jederzeit nachholen.");
  }

  const registrierung = await workerBereit();
  // Ein bestehendes Abo kann auf einen alten VAPID-Schluessel lauten -
  // dann scheitert "subscribe" mit InvalidStateError. Erst abmelden,
  // dann neu abonnieren ist der einzige Weg da heraus.
  const vorhanden = await registrierung.pushManager.getSubscription();
  if (vorhanden) await vorhanden.unsubscribe().catch(() => {});

  const abo = await registrierung.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: schluesselAlsBytes(oeffentlicherSchluessel),
  });

  const roh = abo.toJSON?.() || {};
  await speichern({
    endpunkt: abo.endpoint,
    p256dh: roh.keys?.p256dh || bytesAlsBase64url(abo.getKey("p256dh")),
    auth: roh.keys?.auth || bytesAlsBase64url(abo.getKey("auth")),
    geraet: geraetebeschreibung(),
  });
  return abo;
}

/**
 * Schaltet sie wieder aus. Beides ist noetig: beim Push-Dienst abmelden
 * UND die Adresse bei uns loeschen. Nur eines von beiden hinterlaesst
 * entweder eine Leiche in der Tabelle oder ein Abo, das ins Leere geht.
 */
export async function ausschalten({ loeschen }) {
  const abo = await aktuellesAbo();
  if (!abo) return;
  const endpunkt = abo.endpoint;
  await abo.unsubscribe().catch(() => {});
  await loeschen({ endpunkt });
}
