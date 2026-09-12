/**
 * Web Push von Hand: RFC 8030 (Protokoll), RFC 8291 (Verschlüsselung)
 * und RFC 8292 (VAPID) - ausschließlich mit node:crypto.
 *
 * Warum ohne Bibliothek: Das Projekt hat bewusst null
 * Laufzeitabhängigkeiten (steht so in der README). "web-push" würde
 * diese Regel brechen. Der Kern sind drei HKDF-Schritte, ein ECDH und
 * ein AES-128-GCM - überschaubar, und dank des offiziellen Testvektors
 * aus RFC 8291 Abschnitt 5 auch byteweise nachprüfbar
 * (tests/webpush.test.js). Bei Kryptografie ist "sieht richtig aus"
 * wertlos; deshalb lassen sich Salt und lokales Schlüsselpaar von außen
 * vorgeben, damit der Testvektor überhaupt reproduzierbar ist.
 *
 * ECDSA-Signaturformat: Node liefert mit crypto.sign() standardmäßig
 * eine DER-kodierte Signatur (Sequence aus zwei INTEGERn, variable
 * Länge). JWS/ES256 verlangt aber die rohen 64 Byte r‖s. Wir wählen
 * hier den eingebauten Weg über dsaEncoding: "ieee-p1363" statt einer
 * eigenen DER-Umrechnung - weniger Code, den man falsch machen kann,
 * und OpenSSL füllt r und s korrekt auf je 32 Byte auf. Der Test prüft
 * die Länge von 64 Byte gegen, damit ein späterer Umbau das nicht
 * unbemerkt zurückdreht.
 *
 * ---------------------------------------------------------------
 * Unterschiede iOS (Apple) / Android (Google), die den VERSAND
 * betreffen - also genau diesen Code, nicht den Service Worker:
 *
 * 1. Verschiedene Push-Dienste, ein JWT je Abo. Apple vergibt
 *    Endpunkte unter https://web.push.apple.com/..., Chrome unter
 *    https://fcm.googleapis.com/.... Der "aud"-Anspruch im VAPID-JWT
 *    ist der Origin GENAU DIESES Endpunkts. Ein einmal gebautes JWT
 *    für alle Abos wäre also falsch, sobald beide Plattformen
 *    vorkommen - deshalb baut vapidHeader() pro Endpunkt neu.
 *
 * 2. "sub" ist bei Apple Pflicht und muss eine gültige mailto:- oder
 *    https:-Adresse sein; sonst weist Apple die Zustellung mit 403 ab.
 *    Google ist hier nachsichtiger, wir sind es nicht: sub wird hart
 *    geprüft, damit der Fehler beim Konfigurieren auffällt und nicht
 *    erst bei der ersten echten Benachrichtigung an ein iPhone.
 *
 * 3. Lebensdauer des JWT: RFC 8292 erlaubt höchstens 24 h, Apple
 *    besteht darauf. 12 h ist der bewusste Mittelweg - weit genug von
 *    der Obergrenze entfernt, dass eine schief gehende Serveruhr das
 *    Token nicht sofort ungültig macht.
 *
 * 4. Nutzlastgröße: 4096 Byte für den verschlüsselten Körper ist der
 *    Wert, auf den sich die Push-Dienste in der Praxis verlassen -
 *    Apple gibt für APNs 4 KB an. OFFEN: ob Apple dabei den
 *    verschlüsselten Körper oder den Klartext zählt, ist nicht
 *    belegt. Deshalb ist MAX_KLARTEXT_BYTES bewusst konservativ
 *    gewählt und nicht bis an die rechnerische Grenze (3993 Byte)
 *    ausgereizt.
 *
 * 5. iOS stellt überhaupt nur zu, wenn die Seite auf dem
 *    Home-Bildschirm installiert ist (iOS 16.4+). Für den Versand
 *    heißt das vor allem: entfernt jemand die App, meldet Apple das
 *    Abo als 404/410 zurück - und genau dann muss es aus der Tabelle
 *    verschwinden (siehe istAboTot).
 *
 * 6. TTL ist nach RFC 8030 ein Pflicht-Header. Beide Dienste
 *    verlangen ihn; fehlt er, gibt es 400.
 */

import {
  constants as kryptoKonstanten,
  createCipheriv,
  createECDH,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign as signiere,
} from "node:crypto";

import { fetchMitZeitlimit } from "./api-helpers.js";

const KURVE = "prime256v1"; // = NIST P-256 = secp256r1
const SALT_BYTES = 16;
const DATENSATZGROESSE = 4096;
const AUTH_BYTES = 16;

// 4096 Byte Datensatz minus 86 Byte aes128gcm-Header, minus 16 Byte
// GCM-Prüfsumme, minus 1 Byte Padding-Trenner wären 3993 Byte. Wir
// runden bewusst nach unten ab: Apple zählt möglicherweise anders, und
// eine Benachrichtigung mit Titel und zwei Sätzen braucht keine 4 KB.
export const MAX_KLARTEXT_BYTES = 3800;

export const PUSH_ZEITLIMIT_MS = 10_000;

export function b64uKodieren(puffer) {
  return Buffer.from(puffer).toString("base64url");
}

export function b64uDekodieren(text) {
  // Toleranz mit Absicht: manche Browser liefern p256dh/auth in
  // Standard-Base64 mit "+", "/" und "=" statt base64url.
  const normalisiert = String(text).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalisiert, "base64");
}

function jwkAus(oeffentlichRoh, privatRoh) {
  if (oeffentlichRoh.length !== 65 || oeffentlichRoh[0] !== 0x04) {
    throw new Error("Öffentlicher P-256-Schlüssel muss 65 Byte unkomprimiert sein.");
  }
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64uKodieren(oeffentlichRoh.subarray(1, 33)),
    y: b64uKodieren(oeffentlichRoh.subarray(33, 65)),
  };
  if (privatRoh) jwk.d = b64uKodieren(privatRoh);
  return jwk;
}

/** Aus einem rohen privaten Schlüssel (32 Byte) den öffentlichen ableiten. */
export function oeffentlicherSchluesselZu(privatRoh) {
  const ecdh = createECDH(KURVE);
  ecdh.setPrivateKey(Buffer.from(privatRoh));
  return ecdh.getPublicKey(); // 65 Byte, unkomprimiert (0x04 ‖ x ‖ y)
}

/** Frisches P-256-Paar, beide Teile roh als Buffer. */
export function schluesselpaarErzeugen() {
  const ecdh = createECDH(KURVE);
  ecdh.generateKeys();
  return { privat: ecdh.getPrivateKey(), oeffentlich: ecdh.getPublicKey() };
}

export function vapidSchluesselpaarErzeugen() {
  const paar = schluesselpaarErzeugen();
  return {
    oeffentlich: b64uKodieren(paar.oeffentlich),
    privat: b64uKodieren(paar.privat),
  };
}

/**
 * Die "sub"-Angabe im VAPID-JWT. Apple weist alles ab, was keine
 * gültige mailto:- oder https:-Adresse ist - lieber hier laut scheitern
 * als still nicht zustellen.
 */
export function pruefeVapidSub(sub) {
  const wert = typeof sub === "string" ? sub.trim() : "";
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(wert)) return wert;
  if (/^https:\/\/[^\s]+$/i.test(wert)) return wert;
  throw new Error("VAPID-sub muss eine mailto:- oder https:-Adresse sein.");
}

/** Origin des Push-Endpunkts - das ist der "aud"-Anspruch (RFC 8292). */
export function audienceAus(endpunkt) {
  const url = new URL(endpunkt);
  if (url.protocol !== "https:") {
    throw new Error("Push-Endpunkte müssen https sein.");
  }
  return url.origin;
}

/**
 * ES256-JWT plus fertiger Authorization-Header nach RFC 8292.
 * "jetztMs" ist nur für Tests da, damit exp/iat vorhersagbar sind.
 */
export function vapidHeader({ endpunkt, privatRoh, sub, jetztMs = Date.now() }) {
  const geprueftesSub = pruefeVapidSub(sub);
  const privatPuffer = Buffer.from(privatRoh);
  const oeffentlichRoh = oeffentlicherSchluesselZu(privatPuffer);

  const kopf = { typ: "JWT", alg: "ES256" };
  const sekunden = Math.floor(jetztMs / 1000);
  const nutzlast = {
    aud: audienceAus(endpunkt),
    // 12 h: RFC 8292 erlaubt maximal 24 h, Apple besteht darauf.
    exp: sekunden + 12 * 60 * 60,
    sub: geprueftesSub,
  };

  const zuSignieren = Buffer.from(
    `${b64uKodieren(Buffer.from(JSON.stringify(kopf)))}.${b64uKodieren(
      Buffer.from(JSON.stringify(nutzlast))
    )}`,
    "ascii"
  );

  const schluessel = createPrivateKey({
    key: jwkAus(oeffentlichRoh, privatPuffer),
    format: "jwk",
  });

  // ieee-p1363 = rohe 64 Byte r‖s. Ohne diese Option käme DER heraus
  // und jeder Push-Dienst würde das JWT als ungültig abweisen.
  const signatur = signiere("sha256", zuSignieren, {
    key: schluessel,
    dsaEncoding: "ieee-p1363",
  });

  const jwt = `${zuSignieren.toString("ascii")}.${b64uKodieren(signatur)}`;
  return {
    jwt,
    signatur,
    oeffentlicherSchluessel: b64uKodieren(oeffentlichRoh),
    authorization: `vapid t=${jwt}, k=${b64uKodieren(oeffentlichRoh)}`,
  };
}

/** Öffentlichen Schlüssel als KeyObject - für Tests und Gegenproben. */
export function oeffentlichesSchluesselObjekt(oeffentlichRoh) {
  return createPublicKey({ key: jwkAus(Buffer.from(oeffentlichRoh)), format: "jwk" });
}

/**
 * Nutzlast nach RFC 8291 verschlüsseln, Datensatz nach RFC 8188
 * (aes128gcm).
 *
 * "salt" und "absender" sind Parameter, damit der offizielle
 * Testvektor aus RFC 8291 Abschnitt 5 nachgerechnet werden kann. Im
 * Betrieb bleiben beide leer und werden frisch gewürfelt - ein
 * wiederverwendetes Salt-/Schlüsselpaar wäre ein echter Bruch.
 */
export function nutzlastVerschluesseln({
  p256dh,
  auth,
  klartext,
  salt = null,
  absender = null,
  datensatzgroesse = DATENSATZGROESSE,
}) {
  const empfaengerOeffentlich = Buffer.isBuffer(p256dh) ? p256dh : b64uDekodieren(p256dh);
  const authGeheimnis = Buffer.isBuffer(auth) ? auth : b64uDekodieren(auth);
  const klartextPuffer = Buffer.isBuffer(klartext) ? klartext : Buffer.from(String(klartext), "utf8");

  if (empfaengerOeffentlich.length !== 65 || empfaengerOeffentlich[0] !== 0x04) {
    throw new Error("p256dh des Abonnements ist kein gültiger P-256-Punkt.");
  }
  if (authGeheimnis.length !== AUTH_BYTES) {
    throw new Error("auth des Abonnements muss 16 Byte lang sein.");
  }
  if (klartextPuffer.length > MAX_KLARTEXT_BYTES) {
    throw new Error(`Nutzlast ist zu groß (maximal ${MAX_KLARTEXT_BYTES} Byte).`);
  }

  const saltPuffer = salt ? Buffer.from(salt) : randomBytes(SALT_BYTES);
  if (saltPuffer.length !== SALT_BYTES) {
    throw new Error("Salt muss 16 Byte lang sein.");
  }

  const absenderPrivat = absender ? Buffer.from(absender.privat) : null;
  const ecdh = createECDH(KURVE);
  if (absenderPrivat) ecdh.setPrivateKey(absenderPrivat);
  else ecdh.generateKeys();
  const absenderOeffentlich = ecdh.getPublicKey();

  // Gemeinsames Geheimnis: nur die x-Koordinate, 32 Byte (RFC 8291 §3.1).
  const gemeinsam = ecdh.computeSecret(empfaengerOeffentlich);

  // Schritt 1 (RFC 8291 §3.4): IKM aus dem ECDH-Geheimnis, gesalzen mit
  // dem auth-Geheimnis des Abos. Das key_info bindet beide öffentlichen
  // Schlüssel mit ein - deshalb kann eine abgefangene Nachricht nicht
  // auf ein anderes Abo umgehängt werden.
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    empfaengerOeffentlich,
    absenderOeffentlich,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", gemeinsam, authGeheimnis, keyInfo, 32));

  // Schritt 2 (RFC 8188 §2.2/2.3): aus IKM und Salt der eigentliche
  // Inhaltsschlüssel und die Nonce.
  const cek = Buffer.from(
    hkdfSync("sha256", ikm, saltPuffer, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16)
  );
  const nonce = Buffer.from(
    hkdfSync("sha256", ikm, saltPuffer, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12)
  );

  // 0x02 ist der Padding-Trenner des LETZTEN Datensatzes. Wir senden
  // immer genau einen Datensatz, also steht hier nie 0x01.
  const zuVerschluesseln = Buffer.concat([klartextPuffer, Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const geheimtext = Buffer.concat([cipher.update(zuVerschluesseln), cipher.final()]);
  const pruefsumme = cipher.getAuthTag();

  // aes128gcm-Header: salt(16) ‖ rs(4, big endian) ‖ idlen(1) ‖ keyid.
  // keyid ist hier der öffentliche Schlüssel des Absenders, damit der
  // Browser das ECDH auf seiner Seite nachvollziehen kann.
  const groesse = Buffer.alloc(4);
  groesse.writeUInt32BE(datensatzgroesse, 0);
  const header = Buffer.concat([
    saltPuffer,
    groesse,
    Buffer.from([absenderOeffentlich.length]),
    absenderOeffentlich,
  ]);

  return {
    koerper: Buffer.concat([header, geheimtext, pruefsumme]),
    salt: saltPuffer,
    absenderOeffentlich,
    cek,
    nonce,
    ikm,
  };
}

/** 404/410 heißt: das Abo ist tot und muss aus der Tabelle raus (RFC 8030 §7.3). */
export function istAboTot(status) {
  return status === 404 || status === 410;
}

/**
 * Eine Nachricht an genau ein Abo zustellen. Wirft nicht bei
 * HTTP-Fehlern des Push-Dienstes, sondern gibt den Status zurück - der
 * Aufrufer muss zwischen "tot" (aufräumen) und "fehlgeschlagen"
 * (später noch mal) unterscheiden können.
 */
export async function pushZustellen({
  abo,
  nutzlast,
  vapidPrivatRoh,
  sub,
  ttlSekunden = 24 * 60 * 60,
  dringlichkeit = "normal",
  thema = null,
  zeitlimitMs = PUSH_ZEITLIMIT_MS,
  salt = null,
  absender = null,
  jetztMs = Date.now(),
}) {
  const { koerper } = nutzlastVerschluesseln({
    p256dh: abo.p256dh,
    auth: abo.auth,
    klartext: nutzlast,
    salt,
    absender,
  });

  const { authorization } = vapidHeader({
    endpunkt: abo.endpunkt,
    privatRoh: vapidPrivatRoh,
    sub,
    jetztMs,
  });

  const kopfzeilen = {
    Authorization: authorization,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    "Content-Length": String(koerper.length),
    TTL: String(ttlSekunden),
    // "normal" statt "high": Vereinsnachrichten sind keine Anrufe. Das
    // schont den Akku und ist der Wert, den RFC 8030 §5.3 für genau
    // solche Fälle vorsieht.
    Urgency: dringlichkeit,
  };
  if (thema) kopfzeilen.Topic = thema;

  const antwort = await fetchMitZeitlimit(
    abo.endpunkt,
    { method: "POST", headers: kopfzeilen, body: koerper },
    zeitlimitMs,
    "Push-Dienst"
  );

  return {
    status: antwort.status,
    ok: antwort.status >= 200 && antwort.status < 300,
    tot: istAboTot(antwort.status),
  };
}

// Absichtlich exportiert, damit Tests ohne Zugriff auf interne
// Konstanten auskommen.
export const konstanten = {
  KURVE,
  SALT_BYTES,
  DATENSATZGROESSE,
  AUTH_BYTES,
  kryptoKonstanten,
};
