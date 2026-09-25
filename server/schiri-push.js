import { b64uDekodieren, pruefeVapidSub, pushZustellen } from "./webpush.js";

// Kein frei waehbarer URL-Fetch aus einem PIN-RPC: ein manipuliertes Abo darf
// die Vercel Function nicht zu internen Hosts oder fremden HTTPS-Diensten
// schicken. Die drei verwendeten Push-Dienste werden gezielt zugelassen.
export function istPushDienst(endpunkt) {
  try {
    const url = new URL(endpunkt);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === "web.push.apple.com"
      || host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

export function vapidKonfiguration(umgebung = process.env) {
  const privat = umgebung.VAPID_PRIVATER_SCHLUESSEL;
  const sub = umgebung.VAPID_SUB;
  if (!privat || !sub) return null;
  try {
    const vapidPrivatRoh = b64uDekodieren(privat);
    if (vapidPrivatRoh.length !== 32) return null;
    return { vapidPrivatRoh, sub: pruefeVapidSub(sub) };
  } catch {
    return null;
  }
}

export function nachrichtFuer(typ, meldungId, gruppe) {
  if (typ !== "frage_feedback.antwort" || !/^[0-9a-f-]{36}$/i.test(meldungId || "")) {
    return null;
  }
  // Kein Name, Fragentext oder Antwortinhalt auf fremden Sperrbildschirmen.
  return JSON.stringify({
    titel: "Kickers · Neue Antwort",
    text: "Du hast eine Antwort auf dein Fragenfeedback erhalten.",
    ziel: `/meine-anliegen.html#feedback=${meldungId}`,
    gruppe: String(gruppe || `feedback_${meldungId}`).slice(0, 100),
  });
}

export async function schickePush(abo, nutzlast, config) {
  if (!istPushDienst(abo?.endpunkt)) return { ok: false, tot: true, status: 0 };
  return pushZustellen({
    abo, nutzlast, ...config, ttlSekunden: 24 * 60 * 60,
    dringlichkeit: "normal",
  });
}
