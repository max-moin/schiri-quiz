import assert from "node:assert/strict";
import test from "node:test";

import handlerErstversuch from "../api/duell-freitext.js";
import handlerErgaenzung from "../api/duell-freitext-ergaenzung.js";

function neueAntwort() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, wert) { this.headers[name.toLowerCase()] = wert; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const ZUGANG = "11111111-2222-3333-4444-555555555555";
const FRAGE = "66666666-7777-8888-9999-000000000000";

function geminiAntwort(objekt) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(objekt) }] } }] }),
    { status: 200 }
  );
}

for (const [name, handler] of [
  ["Duell-Freitext (Erstversuch)", handlerErstversuch],
  ["Duell-Freitext (Ergänzung)", handlerErgaenzung],
]) {
  test(`${name}: nur POST erlaubt, sichere Antwortheader`, async () => {
    const antwort = neueAntwort();
    await handler({ method: "GET" }, antwort);
    assert.equal(antwort.statusCode, 405);
    assert.equal(antwort.headers["cache-control"], "no-store");
    assert.equal(antwort.headers["x-content-type-options"], "nosniff");
  });

  test(`${name}: fehlende GEMINI_API_KEY bleibt unsichtbar`, async () => {
    const vorher = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const alteConsole = console.error;
    console.error = () => {};
    try {
      const antwort = neueAntwort();
      await handler({ method: "POST", body: {} }, antwort);
      assert.equal(antwort.statusCode, 503);
      assert.doesNotMatch(JSON.stringify(antwort.body), /GEMINI_API_KEY/);
    } finally {
      console.error = alteConsole;
      if (vorher === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = vorher;
    }
  });

  test(`${name}: lehnt ungültige IDs/leeren Text mit 400 ab`, async () => {
    process.env.GEMINI_API_KEY = "test-key";
    try {
      const antwort = neueAntwort();
      await handler({ method: "POST", body: { zugang: "keine-uuid", frageId: FRAGE, freitext: "x", ergaenzung: "x" } }, antwort);
      assert.equal(antwort.statusCode, 400);
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
}

test("Duell-Freitext (Erstversuch): Status \"nachbessern\" bekommt festes Feedback + die KI-Rückfrage, Musterantwort bleibt zurückgehalten", async () => {
  const alterFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  let gespeichertMitBody = null;
  globalThis.fetch = async (url, optionen) => {
    const u = String(url);
    if (u.includes("generativelanguage")) {
      return geminiAntwort({ status: "nachbessern", feedback: "sollte verworfen werden", nachfrage: "Schau nochmal auf den Armeinsatz." });
    }
    if (u.includes("/rpc/duell_freitext_kontext")) {
      return new Response(JSON.stringify({ frage_text: "F", musterantwort: "M", bewertungshinweise: null }), { status: 200 });
    }
    if (u.includes("/rpc/duell_freitext_speichern")) {
      gespeichertMitBody = JSON.parse(optionen.body);
      return new Response(JSON.stringify({
        status: "nachbessern", korrekt: false, feedback: null,
        nachfrage: gespeichertMitBody.p_nachfrage, musterantwort: null,
      }), { status: 200 });
    }
    throw new Error("unerwartete URL " + u);
  };
  try {
    const antwort = neueAntwort();
    await handlerErstversuch({ method: "POST", body: { zugang: ZUGANG, frageId: FRAGE, freitext: "Es gibt eine Karte." } }, antwort);
    assert.equal(antwort.statusCode, 200);
    assert.equal(gespeichertMitBody.p_status, "nachbessern");
    assert.equal(gespeichertMitBody.p_feedback, "Der Kern stimmt – ein Punkt fehlt noch.");
    assert.equal(gespeichertMitBody.p_nachfrage, "Schau nochmal auf den Armeinsatz.");
    assert.equal(antwort.body.status, "nachbessern");
    assert.equal(antwort.body.musterantwort, null);
  } finally {
    globalThis.fetch = alterFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  }
});

test("Duell-Freitext (Erstversuch): \"richtig\" wird unverändert durchgereicht", async () => {
  const alterFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  let gespeichertMitBody = null;
  globalThis.fetch = async (url, optionen) => {
    const u = String(url);
    if (u.includes("generativelanguage")) return geminiAntwort({ status: "richtig", feedback: "Passt." });
    if (u.includes("/rpc/duell_freitext_kontext")) return new Response(JSON.stringify({ frage_text: "F", musterantwort: "M", bewertungshinweise: null }), { status: 200 });
    if (u.includes("/rpc/duell_freitext_speichern")) {
      gespeichertMitBody = JSON.parse(optionen.body);
      return new Response(JSON.stringify({ status: "richtig", korrekt: true, feedback: "Passt.", nachfrage: null, musterantwort: "M" }), { status: 200 });
    }
    throw new Error("unerwartete URL " + u);
  };
  try {
    const antwort = neueAntwort();
    await handlerErstversuch({ method: "POST", body: { zugang: ZUGANG, frageId: FRAGE, freitext: "Gelbe Karte." } }, antwort);
    assert.equal(antwort.statusCode, 200);
    assert.equal(gespeichertMitBody.p_status, "richtig");
    assert.equal(gespeichertMitBody.p_nachfrage, null);
    assert.equal(antwort.body.musterantwort, "M");
  } finally {
    globalThis.fetch = alterFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  }
});

test("Duell-Freitext (Ergänzung): ruft die Ergänzungs-RPCs auf und liefert am Ende immer die Musterantwort mit", async () => {
  const alterFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.SUPABASE_SECRET_KEY = "server-secret";
  const gerufeneUrls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    gerufeneUrls.push(u);
    if (u.includes("generativelanguage")) return geminiAntwort({ status: "richtig", feedback: "Passt jetzt." });
    if (u.includes("/rpc/duell_freitext_ergaenzung_kontext")) {
      return new Response(JSON.stringify({ frage_text: "F", musterantwort: "M", bewertungshinweise: null, erster_freitext: "E1", ki_nachfrage: "N" }), { status: 200 });
    }
    if (u.includes("/rpc/duell_freitext_ergaenzung_speichern")) {
      return new Response(JSON.stringify({ status: "richtig", korrekt: true, feedback: "Passt jetzt.", musterantwort: "M" }), { status: 200 });
    }
    throw new Error("unerwartete URL " + u);
  };
  try {
    const antwort = neueAntwort();
    await handlerErgaenzung({ method: "POST", body: { zugang: ZUGANG, frageId: FRAGE, ergaenzung: "Gelbe Karte." } }, antwort);
    assert.equal(antwort.statusCode, 200);
    assert.equal(antwort.body.musterantwort, "M");
    assert.ok(gerufeneUrls.some((u) => u.includes("duell_freitext_ergaenzung_kontext")));
    assert.ok(gerufeneUrls.some((u) => u.includes("duell_freitext_ergaenzung_speichern")));
  } finally {
    globalThis.fetch = alterFetch;
    delete process.env.GEMINI_API_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  }
});
