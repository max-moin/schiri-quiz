import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/entscheidung-bewerten.js";

const body = {
  schiedsrichterId: "dc94fef4-a0a9-44dd-b7f1-bfe8e6a30b51",
  frageId: "3863476e-e0ba-4ae4-b664-1e238086c287", pin: "1234",
  antwort: { spielfortsetzung: "weiterspielen", persoenliche_strafe: "keine", strafen: [] },
};
const kontext = {
  frage_text: "Testfrage", fordert_fortsetzung: true,
  fordert_fortsetzung_fuer: false, fordert_fortsetzung_ort: false,
  fordert_strafe: false, fordert_strafe_mannschaft: false,
  fordert_strafe_rolle: false, fordert_strafe_nummer: false,
};

function res() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; } };
}

function mockRpc(t, antworten) {
  const vorher = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = "sb_secret_only_for_local_test";
  t.after(() => {
    if (vorher === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = vorher;
  });
  t.mock.method(console, "error", () => {});
  const aufrufe = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const name = String(url).split("/").at(-1);
    aufrufe.push(name);
    const data = antworten[name];
    assert.ok(data, `unerwarteter Aufruf: ${name}`);
    return new Response(JSON.stringify(data.body), { status: data.status || 200 });
  });
  return aufrufe;
}

test("inaktive Icon-Frage wird nicht mehr pauschal als falsche PIN ausgegeben", async (t) => {
  const aufrufe = mockRpc(t, { entscheidung_kontext_laden: {
    status: 400, body: { code: "P0001", message: "Frage nicht gefunden oder aktuell nicht aktiv" },
  } });
  const response = res();
  await handler({ method: "POST", body }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "QUIZ_QUESTION_INACTIVE");
  assert.match(response.body.fehler, /Quiz neu/);
  assert.doesNotMatch(response.body.fehler, /PIN/);
  assert.deepEqual(aufrufe, ["entscheidung_kontext_laden"]);
});

test("echte falsche PIN fordert Neuanmeldung statt Frageaktivierung", async (t) => {
  mockRpc(t, { entscheidung_kontext_laden: { status: 400, body: { message: "PIN falsch" } } });
  const response = res();
  await handler({ method: "POST", body }, response);
  assert.equal(response.statusCode, 401);
  assert.match(response.body.fehler, /erneut an/);
});

test("technische Datenbankfehler behaupten keine falsche PIN und geben keine Interna aus", async (t) => {
  mockRpc(t, { entscheidung_kontext_laden: {
    status: 403, body: { message: "permission denied for function entscheidung_kontext_laden" },
  } });
  const response = res();
  await handler({ method: "POST", body }, response);
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body.fehler, /PIN|permission|entscheidung_kontext_laden/);
});

test("Wochenwechsel zwischen Kontext und Speichern bleibt ein klarer Aktualisierungsfehler", async (t) => {
  mockRpc(t, {
    entscheidung_kontext_laden: { body: [kontext] },
    entscheidung_antwort_speichern_v2: { status: 400, body: { message: "Frage nicht gefunden oder aktuell nicht aktiv" } },
  });
  const response = res();
  await handler({ method: "POST", body }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "QUIZ_QUESTION_INACTIVE");
});

test("aktive Icon-Antwort wird weiterhin bewertet und bestaetigt", async (t) => {
  const aufrufe = mockRpc(t, {
    entscheidung_kontext_laden: { body: [kontext] },
    entscheidung_antwort_speichern_v2: { body: { korrekt: true, bereits_beantwortet: false } },
  });
  const response = res();
  await handler({ method: "POST", body }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.korrekt, true);
  assert.deepEqual(aufrufe, ["entscheidung_kontext_laden", "entscheidung_antwort_speichern_v2"]);
});
