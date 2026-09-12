import assert from "node:assert/strict";
import { randomBytes, verify } from "node:crypto";
import test from "node:test";

import {
  MAX_KLARTEXT_BYTES,
  audienceAus,
  b64uDekodieren,
  b64uKodieren,
  istAboTot,
  nutzlastVerschluesseln,
  oeffentlicherSchluesselZu,
  oeffentlichesSchluesselObjekt,
  pruefeVapidSub,
  schluesselpaarErzeugen,
  vapidHeader,
  vapidSchluesselpaarErzeugen,
} from "../server/webpush.js";
import handler, {
  istBrauchbaresAbo,
  pushEingabe,
  sendeSchluesselStimmt,
} from "../api/push-senden.js";

/* ------------------------------------------------------------------
   RFC 8291 Abschnitt 5 - der offizielle Testvektor.

   Ohne diesen Nachweis ist eine selbstgebaute Verschlüsselung wertlos:
   eine falsch abgeleitete Nonce oder ein vertauschtes HKDF-Salz
   produziert einen Datensatz, der genauso aussieht wie ein richtiger,
   aber in keinem Browser entschlüsselt werden kann. Deshalb wird hier
   nicht "plausibel" geprüft, sondern Byte für Byte gegen die im RFC
   abgedruckten Werte.

   Damit das überhaupt geht, nimmt nutzlastVerschluesseln() Salt und
   Absenderschlüssel als Parameter entgegen. Im Betrieb bleiben beide
   leer und werden frisch gewürfelt.
   ------------------------------------------------------------------ */
const RFC8291 = {
  empfaengerOeffentlich: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  empfaengerPrivat: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  absenderOeffentlich: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  absenderPrivat: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  klartext: "When I grow up, I want to be a watermelon",
  // Zwischenwerte, die das RFC ebenfalls abdruckt - sie zeigen bei
  // einem Fehlschlag sofort, an welcher Stelle es klemmt.
  ikm: "S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg",
  cek: "oIhVW04MRdy2XN9CiKLxTg",
  nonce: "4h_95klXJ5E_qnoN",
  koerper:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("RFC 8291 §5: der verschlüsselte Datensatz stimmt byteweise", () => {
  const ergebnis = nutzlastVerschluesseln({
    p256dh: RFC8291.empfaengerOeffentlich,
    auth: RFC8291.auth,
    klartext: RFC8291.klartext,
    salt: b64uDekodieren(RFC8291.salt),
    absender: { privat: b64uDekodieren(RFC8291.absenderPrivat) },
  });

  assert.equal(b64uKodieren(ergebnis.ikm), RFC8291.ikm);
  assert.equal(b64uKodieren(ergebnis.cek), RFC8291.cek);
  assert.equal(b64uKodieren(ergebnis.nonce), RFC8291.nonce);
  assert.equal(b64uKodieren(ergebnis.absenderOeffentlich), RFC8291.absenderOeffentlich);

  // Das eigentliche Ergebnis: Header + Geheimtext + Prüfsumme.
  assert.equal(b64uKodieren(ergebnis.koerper), RFC8291.koerper);
  assert.deepEqual(ergebnis.koerper, b64uDekodieren(RFC8291.koerper));
  assert.equal(ergebnis.koerper.length, 144);
});

test("RFC 8291 §5: der abgeleitete Absenderschlüssel passt zum privaten", () => {
  assert.equal(
    b64uKodieren(oeffentlicherSchluesselZu(b64uDekodieren(RFC8291.absenderPrivat))),
    RFC8291.absenderOeffentlich
  );
  assert.equal(
    b64uKodieren(oeffentlicherSchluesselZu(b64uDekodieren(RFC8291.empfaengerPrivat))),
    RFC8291.empfaengerOeffentlich
  );
});

test("aes128gcm-Header: Salt, Datensatzgröße und keyid stehen an der richtigen Stelle", () => {
  const empfaenger = schluesselpaarErzeugen();
  const { koerper, salt, absenderOeffentlich } = nutzlastVerschluesseln({
    p256dh: empfaenger.oeffentlich,
    auth: randomBytes(16),
    klartext: "Hallo",
  });

  assert.deepEqual(koerper.subarray(0, 16), salt);
  assert.equal(koerper.readUInt32BE(16), 4096);
  assert.equal(koerper[20], 65);
  assert.deepEqual(koerper.subarray(21, 86), absenderOeffentlich);
  // 86 Header + 5 Klartext + 1 Padding-Trenner + 16 Prüfsumme.
  assert.equal(koerper.length, 86 + 5 + 1 + 16);
});

test("zwei Verschlüsselungen derselben Nachricht benutzen nie dasselbe Salt", () => {
  const empfaenger = schluesselpaarErzeugen();
  const auth = randomBytes(16);
  const a = nutzlastVerschluesseln({ p256dh: empfaenger.oeffentlich, auth, klartext: "Hallo" });
  const b = nutzlastVerschluesseln({ p256dh: empfaenger.oeffentlich, auth, klartext: "Hallo" });
  assert.notDeepEqual(a.salt, b.salt);
  assert.notDeepEqual(a.absenderOeffentlich, b.absenderOeffentlich);
  assert.notDeepEqual(a.koerper, b.koerper);
});

test("unbrauchbare Abo-Daten und zu große Nutzlasten werden abgewiesen", () => {
  const empfaenger = schluesselpaarErzeugen();
  assert.throws(
    () => nutzlastVerschluesseln({ p256dh: randomBytes(65), auth: randomBytes(16), klartext: "x" }),
    /P-256-Punkt/
  );
  assert.throws(
    () => nutzlastVerschluesseln({ p256dh: empfaenger.oeffentlich, auth: randomBytes(8), klartext: "x" }),
    /16 Byte/
  );
  assert.throws(
    () =>
      nutzlastVerschluesseln({
        p256dh: empfaenger.oeffentlich,
        auth: randomBytes(16),
        klartext: "x".repeat(MAX_KLARTEXT_BYTES + 1),
      }),
    /zu groß/
  );
});

/* ------------------------------------------------------------------
   VAPID (RFC 8292)
   ------------------------------------------------------------------ */

test("VAPID: die Signatur ist roh (64 Byte r‖s), nicht DER", () => {
  const paar = schluesselpaarErzeugen();
  const { signatur } = vapidHeader({
    endpunkt: "https://web.push.apple.com/ABC",
    privatRoh: paar.privat,
    sub: "mailto:obmann@example.org",
  });

  assert.equal(signatur.length, 64);
  // Eine DER-Signatur fängt mit 0x30 (SEQUENCE) an und ist ~70 Byte
  // lang. Genau dieser Fehler passiert, wenn dsaEncoding vergessen
  // wird - und jeder Push-Dienst antwortet dann mit 401/403.
  assert.notEqual(signatur[0], 0x30);
});

test("VAPID: das JWT verifiziert gegen den öffentlichen Schlüssel", () => {
  const paar = schluesselpaarErzeugen();
  const jetztMs = Date.UTC(2026, 8, 12, 10, 0, 0);
  const { jwt, authorization, oeffentlicherSchluessel } = vapidHeader({
    endpunkt: "https://fcm.googleapis.com/fcm/send/xyz?a=b",
    privatRoh: paar.privat,
    sub: "mailto:obmann@example.org",
    jetztMs,
  });

  const [kopfB64, nutzlastB64, signaturB64] = jwt.split(".");
  const kopf = JSON.parse(b64uDekodieren(kopfB64).toString("utf8"));
  const nutzlast = JSON.parse(b64uDekodieren(nutzlastB64).toString("utf8"));

  assert.deepEqual(kopf, { typ: "JWT", alg: "ES256" });
  // aud ist der Origin des Endpunkts, ohne Pfad und ohne Suchteil.
  assert.equal(nutzlast.aud, "https://fcm.googleapis.com");
  assert.equal(nutzlast.sub, "mailto:obmann@example.org");
  assert.equal(nutzlast.exp, Math.floor(jetztMs / 1000) + 12 * 60 * 60);
  // RFC 8292: höchstens 24 h in der Zukunft, sonst weist Apple ab.
  assert.ok(nutzlast.exp - Math.floor(jetztMs / 1000) <= 24 * 60 * 60);

  const gueltig = verify(
    "sha256",
    Buffer.from(`${kopfB64}.${nutzlastB64}`, "ascii"),
    { key: oeffentlichesSchluesselObjekt(paar.oeffentlich), dsaEncoding: "ieee-p1363" },
    b64uDekodieren(signaturB64)
  );
  assert.equal(gueltig, true);

  assert.equal(b64uKodieren(paar.oeffentlich), oeffentlicherSchluessel);
  assert.equal(authorization, `vapid t=${jwt}, k=${oeffentlicherSchluessel}`);
});

test("VAPID: ein verändertes JWT verifiziert nicht mehr", () => {
  const paar = schluesselpaarErzeugen();
  const { jwt } = vapidHeader({
    endpunkt: "https://web.push.apple.com/ABC",
    privatRoh: paar.privat,
    sub: "mailto:obmann@example.org",
  });
  const [kopfB64, nutzlastB64, signaturB64] = jwt.split(".");
  const gefaelscht = b64uKodieren(
    Buffer.from(JSON.stringify({ aud: "https://boese.example", exp: 1, sub: "mailto:x@y.z" }))
  );

  assert.equal(
    verify(
      "sha256",
      Buffer.from(`${kopfB64}.${gefaelscht}`, "ascii"),
      { key: oeffentlichesSchluesselObjekt(paar.oeffentlich), dsaEncoding: "ieee-p1363" },
      b64uDekodieren(signaturB64)
    ),
    false
  );
  assert.notEqual(nutzlastB64, gefaelscht);
});

test("VAPID: sub muss mailto: oder https: sein - Apple weist alles andere ab", () => {
  assert.equal(pruefeVapidSub("mailto:obmann@example.org"), "mailto:obmann@example.org");
  assert.equal(pruefeVapidSub(" https://verein.example/impressum "), "https://verein.example/impressum");
  for (const falsch of ["", null, "obmann@example.org", "mailto:kein-at", "http://verein.example"]) {
    assert.throws(() => pruefeVapidSub(falsch), /mailto/);
  }
});

test("VAPID: nur https-Endpunkte, aud ist der Origin", () => {
  assert.equal(audienceAus("https://web.push.apple.com/eins/zwei"), "https://web.push.apple.com");
  assert.throws(() => audienceAus("http://web.push.apple.com/eins"), /https/);
});

test("frisch erzeugte VAPID-Schlüssel haben die richtigen Längen", () => {
  const { oeffentlich, privat } = vapidSchluesselpaarErzeugen();
  assert.equal(b64uDekodieren(oeffentlich).length, 65);
  assert.equal(b64uDekodieren(oeffentlich)[0], 0x04);
  assert.equal(b64uDekodieren(privat).length, 32);
  assert.equal(b64uKodieren(oeffentlicherSchluesselZu(b64uDekodieren(privat))), oeffentlich);
});

test("404 und 410 bedeuten: Abo ist tot", () => {
  assert.equal(istAboTot(404), true);
  assert.equal(istAboTot(410), true);
  for (const status of [200, 201, 400, 401, 403, 429, 500, 503]) {
    assert.equal(istAboTot(status), false);
  }
});

/* ------------------------------------------------------------------
   Der Endpunkt
   ------------------------------------------------------------------ */

function neueAntwort() {
  return {
    code: null,
    body: null,
    headers: {},
    setHeader(name, wert) {
      this.headers[name.toLowerCase()] = wert;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("Eingabeprüfung: Titel, Text und Ziel", () => {
  const kennung = "11111111-1111-1111-1111-111111111111";
  assert.deepEqual(pushEingabe({ titel: " Training  fällt aus ", text: "Morgen kein Treff.", ziel: "alle" }), {
    titel: "Training fällt aus",
    text: "Morgen kein Treff.",
    alle: true,
    kennungen: null,
  });
  assert.deepEqual(pushEingabe({ titel: "T", text: "X", ziel: [kennung] }), {
    titel: "T",
    text: "X",
    alle: false,
    kennungen: [kennung],
  });
  for (const falsch of [
    null,
    [],
    {},
    { titel: "T", text: "X" },
    { titel: "", text: "X", ziel: "alle" },
    { titel: "T", text: "", ziel: "alle" },
    { titel: "t".repeat(81), text: "X", ziel: "alle" },
    { titel: "T", text: "x".repeat(301), ziel: "alle" },
    { titel: "T", text: "X", ziel: "jeder" },
    { titel: "T", text: "X", ziel: [] },
    { titel: "T", text: "X", ziel: ["kein-uuid"] },
    { titel: "T", text: "X", ziel: [kennung, 42] },
  ]) {
    assert.equal(pushEingabe(falsch), null, JSON.stringify(falsch));
  }
});

test("Sendeschlüssel: zeitkonstanter Vergleich, nichts anderes lässt durch", () => {
  assert.equal(sendeSchluesselStimmt("geheim", "geheim"), true);
  assert.equal(sendeSchluesselStimmt("geheiM", "geheim"), false);
  // Unterschiedliche Längen dürfen nicht werfen, sondern schlicht false
  // ergeben - sonst verrät die Fehlerantwort die Länge des Geheimnisses.
  assert.equal(sendeSchluesselStimmt("kurz", "ein sehr viel laengeres geheimnis"), false);
  assert.equal(sendeSchluesselStimmt("", "geheim"), false);
  assert.equal(sendeSchluesselStimmt(undefined, "geheim"), false);
  assert.equal(sendeSchluesselStimmt("geheim", ""), false);
});

test("brauchbare Abos: nur vollständige Datensätze mit https-Endpunkt", () => {
  const gut = { id: "1", endpunkt: "https://x.example/1", p256dh: "a", auth: "b" };
  assert.equal(istBrauchbaresAbo(gut), true);
  assert.equal(istBrauchbaresAbo({ ...gut, endpunkt: "http://x.example/1" }), false);
  assert.equal(istBrauchbaresAbo({ ...gut, p256dh: undefined }), false);
  assert.equal(istBrauchbaresAbo(null), false);
});

const UMGEBUNG = [
  "PUSH_SENDE_SCHLUESSEL",
  "VAPID_PRIVATER_SCHLUESSEL",
  "VAPID_SUB",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function mitUmgebung(werte, arbeit) {
  const vorher = new Map(UMGEBUNG.map((name) => [name, process.env[name]]));
  const vorherFetch = globalThis.fetch;
  const vorherError = console.error;
  console.error = () => {};
  for (const name of UMGEBUNG) delete process.env[name];
  for (const [name, wert] of Object.entries(werte)) process.env[name] = wert;
  try {
    return await arbeit();
  } finally {
    console.error = vorherError;
    globalThis.fetch = vorherFetch;
    for (const [name, wert] of vorher) {
      if (wert === undefined) delete process.env[name];
      else process.env[name] = wert;
    }
  }
}

const TEST_SENDE_SCHLUESSEL = "test-sende-schluessel";

function vollstaendigeUmgebung() {
  const paar = schluesselpaarErzeugen();
  return {
    umgebung: {
      PUSH_SENDE_SCHLUESSEL: TEST_SENDE_SCHLUESSEL,
      VAPID_PRIVATER_SCHLUESSEL: b64uKodieren(paar.privat),
      VAPID_SUB: "mailto:obmann@example.org",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    },
    vapidOeffentlich: paar.oeffentlich,
  };
}

function anfrage(zusatz = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-push-schluessel": TEST_SENDE_SCHLUESSEL,
    },
    body: { titel: "Training", text: "Morgen 19 Uhr.", ziel: "alle" },
    ...zusatz,
  };
}

async function ausfuehren(req) {
  const res = neueAntwort();
  await handler(req, res);
  return res;
}

test("Push-API: nur POST, und immer mit sicheren Antwortheadern", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  await mitUmgebung(umgebung, async () => {
    const res = await ausfuehren({ method: "GET", headers: {} });
    assert.equal(res.code, 405);
    assert.deepEqual(res.body, { fehler: "Nur POST erlaubt" });
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });
});

test("Push-API: ohne Konfiguration verweigert der Endpunkt den Dienst", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  for (const fehlend of ["PUSH_SENDE_SCHLUESSEL", "VAPID_PRIVATER_SCHLUESSEL", "VAPID_SUB", "SUPABASE_SECRET_KEY"]) {
    const teilweise = { ...umgebung };
    delete teilweise[fehlend];
    await mitUmgebung(teilweise, async () => {
      const res = await ausfuehren(anfrage());
      assert.equal(res.code, 503, `${fehlend} fehlt`);
      // Kein Hinweis darauf, welche Variable fehlt.
      assert.doesNotMatch(JSON.stringify(res.body), /VAPID|SUPABASE|SCHLUESSEL|Vercel/i);
    });
  }
});

test("Push-API: falscher oder fehlender Sendeschlüssel wird abgewiesen", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  await mitUmgebung(umgebung, async () => {
    globalThis.fetch = async () => {
      throw new Error("Es darf gar nichts gerufen werden.");
    };
    for (const kopf of [{}, { "x-push-schluessel": "" }, { "x-push-schluessel": "falsch" }]) {
      const res = await ausfuehren(
        anfrage({ headers: { "content-type": "application/json", ...kopf } })
      );
      assert.equal(res.code, 401);
      assert.deepEqual(res.body, { fehler: "Nicht berechtigt." });
    }
  });
});

test("Push-API: Format und Körper werden geprüft", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  await mitUmgebung(umgebung, async () => {
    globalThis.fetch = async () => {
      throw new Error("Es darf gar nichts gerufen werden.");
    };
    const ohneTyp = await ausfuehren(
      anfrage({ headers: { "x-push-schluessel": TEST_SENDE_SCHLUESSEL } })
    );
    assert.equal(ohneTyp.code, 415);
    const leer = await ausfuehren(anfrage({ body: {} }));
    assert.equal(leer.code, 400);
  });
});

test("Push-API: stellt zu, räumt tote Abos auf und zählt Fehlschläge", async () => {
  const { umgebung, vapidOeffentlich } = vollstaendigeUmgebung();
  const empfaenger = schluesselpaarErzeugen();
  const auth = randomBytes(16);

  const abos = [
    { id: "a-1", endpunkt: "https://web.push.apple.com/gut", p256dh: b64uKodieren(empfaenger.oeffentlich), auth: b64uKodieren(auth) },
    { id: "a-2", endpunkt: "https://fcm.googleapis.com/tot-410", p256dh: b64uKodieren(empfaenger.oeffentlich), auth: b64uKodieren(auth) },
    { id: "a-3", endpunkt: "https://fcm.googleapis.com/tot-404", p256dh: b64uKodieren(empfaenger.oeffentlich), auth: b64uKodieren(auth) },
    { id: "a-4", endpunkt: "https://fcm.googleapis.com/kaputt", p256dh: b64uKodieren(empfaenger.oeffentlich), auth: b64uKodieren(auth) },
    { id: "a-5", endpunkt: "https://fcm.googleapis.com/netzfehler", p256dh: b64uKodieren(empfaenger.oeffentlich), auth: b64uKodieren(auth) },
  ];

  await mitUmgebung(umgebung, async () => {
    const entfernt = [];
    const gesehen = [];

    globalThis.fetch = async (url, optionen) => {
      const adresse = String(url);

      if (adresse.includes("/rpc/push_abos_holen")) {
        assert.deepEqual(JSON.parse(optionen.body), { p_alle: true, p_schiedsrichter: null });
        return new Response(JSON.stringify(abos), { status: 200 });
      }
      if (adresse.includes("/rpc/push_abo_entfernen")) {
        entfernt.push(JSON.parse(optionen.body).p_id);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Ab hier: der Push-Dienst.
      gesehen.push({ adresse, kopfzeilen: optionen.headers, koerper: optionen.body });
      assert.equal(optionen.method, "POST");
      assert.equal(optionen.headers["Content-Encoding"], "aes128gcm");
      assert.equal(optionen.headers["Content-Type"], "application/octet-stream");
      assert.equal(optionen.headers.TTL, String(24 * 60 * 60));
      assert.equal(optionen.headers.Urgency, "normal");
      assert.match(optionen.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
      assert.ok(optionen.headers.Authorization.endsWith(b64uKodieren(vapidOeffentlich)));

      if (adresse.endsWith("/tot-410")) return new Response("", { status: 410 });
      if (adresse.endsWith("/tot-404")) return new Response("", { status: 404 });
      if (adresse.endsWith("/kaputt")) return new Response("interner-dienst-fehlertext", { status: 500 });
      if (adresse.endsWith("/netzfehler")) throw new Error("ECONNRESET-Details");
      return new Response("", { status: 201 });
    };

    const res = await ausfuehren(anfrage());

    assert.equal(res.code, 200);
    assert.deepEqual(res.body, {
      ok: true,
      gesamt: 5,
      zugestellt: 1,
      aufgeraeumt: 2,
      fehlgeschlagen: 2,
    });

    // Tote Abos wurden aufgeräumt - beide, nicht nur das erste.
    assert.deepEqual(entfernt.sort(), ["a-2", "a-3"]);

    // Jedes Abo bekam seinen eigenen Datensatz mit eigenem Salt.
    assert.equal(gesehen.length, 5);
    const salze = new Set(gesehen.map((z) => z.koerper.subarray(0, 16).toString("hex")));
    assert.equal(salze.size, 5);

    // Und das JWT wird je Endpunkt gebaut: apple und fcm haben
    // verschiedene aud-Ansprüche.
    const audAus = (kopfzeilen) => {
      const jwt = kopfzeilen.Authorization.slice("vapid t=".length).split(",")[0];
      return JSON.parse(b64uDekodieren(jwt.split(".")[1]).toString("utf8")).aud;
    };
    assert.equal(audAus(gesehen[0].kopfzeilen), "https://web.push.apple.com");
    assert.equal(audAus(gesehen[1].kopfzeilen), "https://fcm.googleapis.com");

    // Nichts Internes nach außen.
    const nachAussen = JSON.stringify(res.body);
    assert.doesNotMatch(nachAussen, /ECONNRESET|interner-dienst-fehlertext|push\.apple|googleapis/);
  });
});

test("Push-API: gezieltes Ziel reicht die Kennungen an die Datenbank weiter", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  const kennungen = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"];

  await mitUmgebung(umgebung, async () => {
    let gesehen = null;
    globalThis.fetch = async (url, optionen) => {
      assert.ok(String(url).includes("/rpc/push_abos_holen"));
      gesehen = JSON.parse(optionen.body);
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const res = await ausfuehren(anfrage({ body: { titel: "T", text: "X", ziel: kennungen } }));
    assert.deepEqual(gesehen, { p_alle: false, p_schiedsrichter: kennungen });
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { ok: true, gesamt: 0, zugestellt: 0, aufgeraeumt: 0, fehlgeschlagen: 0 });
  });
});

test("Push-API: eine kaputte Empfängerliste legt keine Einzelheiten offen", async () => {
  const { umgebung } = vollstaendigeUmgebung();
  await mitUmgebung(umgebung, async () => {
    globalThis.fetch = async () => {
      throw new Error("geheimer-datenbank-hinweis");
    };
    const res = await ausfuehren(anfrage());
    assert.equal(res.code, 503);
    assert.doesNotMatch(JSON.stringify(res.body), /geheimer-datenbank-hinweis/);
  });
});
