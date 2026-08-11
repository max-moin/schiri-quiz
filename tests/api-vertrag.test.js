import assert from "node:assert/strict";
import test from "node:test";

import erklaerungHandler from "../api/erklaerung.js";
import freitextHandler from "../api/freitext-bewerten.js";

function neueAntwort() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, wert) {
      this.headers[name.toLowerCase()] = wert;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

for (const [name, handler] of [
  ["Erklärungs-API", erklaerungHandler],
  ["Freitext-API", freitextHandler],
]) {
  test(`${name} akzeptiert nur POST und setzt sichere Antwortheader`, async () => {
    const antwort = neueAntwort();
    await handler({ method: "GET" }, antwort);

    assert.equal(antwort.statusCode, 405);
    assert.deepEqual(antwort.body, { fehler: "Nur POST erlaubt" });
    assert.equal(antwort.headers["cache-control"], "no-store");
    assert.equal(antwort.headers["x-content-type-options"], "nosniff");
  });

  test(`${name} legt fehlende Serverkonfiguration nicht offen`, async () => {
    const vorherigerWert = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const urspruenglichesConsoleError = console.error;
    console.error = () => {};

    try {
      const antwort = neueAntwort();
      await handler({ method: "POST", body: {} }, antwort);

      assert.equal(antwort.statusCode, 503);
      assert.equal(typeof antwort.body.fehler, "string");
      assert.doesNotMatch(JSON.stringify(antwort.body), /GEMINI_API_KEY|Vercel|details/);
    } finally {
      console.error = urspruenglichesConsoleError;
      if (vorherigerWert === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = vorherigerWert;
      }
    }
  });
}

for (const [name, handler] of [
  ["Erklärungs-API", erklaerungHandler],
  ["Freitext-API", freitextHandler],
]) {
  test(`${name} verweigert den Betrieb ohne geheimen Supabase-Schlüssel`, async () => {
    const vorherigerGeminiKey = process.env.GEMINI_API_KEY;
    const vorherigerSecretKey = process.env.SUPABASE_SECRET_KEY;
    const vorherigerServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const urspruenglichesConsoleError = console.error;

    process.env.GEMINI_API_KEY = "test-gemini-key";
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.error = () => {};

    try {
      const antwort = neueAntwort();
      await handler(
        {
          method: "POST",
          body: {
            schiedsrichterId: "00000000-0000-0000-0000-000000000001",
            frageId: "00000000-0000-0000-0000-000000000002",
            pin: "ungueltig",
            freitext: "Testantwort",
          },
        },
        antwort
      );

      assert.equal(antwort.statusCode, 503);
      assert.deepEqual(antwort.body, {
        fehler: "Die Serverfunktion ist vorübergehend nicht verfügbar.",
      });
    } finally {
      console.error = urspruenglichesConsoleError;
      if (vorherigerGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = vorherigerGeminiKey;
      if (vorherigerSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
      else process.env.SUPABASE_SECRET_KEY = vorherigerSecretKey;
      if (vorherigerServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = vorherigerServiceRoleKey;
    }
  });
}
