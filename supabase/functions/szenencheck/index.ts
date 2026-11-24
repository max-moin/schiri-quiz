import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const basis = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(basis, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clips = admin.storage.from("szenencheck-clips");
const origins = new Set(["https://www.schiri-loebtauer-kickers.com", "https://schiri-loebtauer-kickers.com"]);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const clean = (x: unknown, max: number) => typeof x === "string" && x.length <= max ? x.trim() : null;
const id = (x: unknown) => typeof x === "string" && uuid.test(x) ? x : null;
const time = (x: unknown) => typeof x === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(x)
  && Number.isFinite(Date.parse(x)) ? x : null;

function scene(x: unknown) {
  if (!object(x)) return null;
  const { art } = x;
  const sceneId = id(x.id), titel = clean(x.titel, 140), kontext = clean(x.kontext, 1600);
  const feld = clean(x.feld ?? "", 1200);
  if (!sceneId || !titel || kontext === null || feld === null || typeof art !== "string" ||
    !["pfiff", "karte", "detail", "multipleChoice", "freitext"].includes(art)) return null;
  const result: Record<string, unknown> = { id: sceneId, titel, kontext, art };
  if (feld) result.feld = feld;
  if (art === "multipleChoice") {
    if (!Array.isArray(x.optionen) || x.optionen.length < 2 || x.optionen.length > 8) return null;
    const optionen = x.optionen.map(o => clean(o, 120));
    if (optionen.some(o => !o) || new Set(optionen).size !== optionen.length) return null;
    result.optionen = optionen;
  }
  if (typeof x.datei === "string") {
    const [verein, filename, more] = x.datei.split("/");
    if (!id(verein) || !filename?.endsWith(".mp4") || !id(filename.slice(0, -4)) || more !== undefined) return null;
    result.datei = x.datei;
  } else {
    const { youtube, start, ende } = x;
    if (typeof youtube !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(youtube) ||
      typeof start !== "number" || typeof ende !== "number" || !Number.isInteger(start) ||
      !Number.isInteger(ende) || start < 0 || ende <= start || ende > 86400) return null;
    Object.assign(result, { youtube, start, ende });
  }
  return result;
}

function v2(x: Record<string, unknown>, aktion: string): Record<string, unknown> | null {
  if (["v2-laden", "v2-stimme", "v2-video"].includes(aktion)) {
    const basis = params({ ...x, aktion: aktion.slice(3), code: "0000" });
    if (!basis || (aktion === "v2-stimme" && typeof x.test !== "boolean")) return null;
    delete basis.code;
    return { ...basis, aktion, ...(aktion === "v2-stimme" ? { test:x.test } : {}) };
  }
  const passwort = clean(x.passwort, 256);
  if (!passwort) return null;
  const testpasswort = clean(x.testpasswort,256);
  if (x.testpasswort != null && !testpasswort) return null;
  const basis = { aktion, passwort, ...(["v2-verwaltung","v2-planen"].includes(aktion) && testpasswort ? {testpasswort} : {}) };
  if (aktion === "v2-verwaltung" || aktion === "v2-upload") return basis;
  if (aktion === "v2-planen") {
    const rundendaten = params({ ...x, aktion:"planen" });
    const vorschau = time(x.vorschau), aufloesung = time(x.aufloesung);
    if (!rundendaten || !["aktuell","reserve"].includes(String(x.typ)) || typeof x.freigabe !== "boolean" ||
      (x.typ === "reserve" && x.freigabe) || (x.vorschau != null && !vorschau) ||
      (x.aufloesung != null && !aufloesung) || !Array.isArray(x.tester) ||
      x.tester.length > 30 || x.tester.some(t => !id(t)) || Boolean(vorschau) !== Boolean(x.tester.length)) return null;
    return { ...rundendaten, ...basis, typ:x.typ, freigabe:x.freigabe, tester:x.tester, vorschau, aufloesung };
  }
  const runde = id(x.runde);
  if (!runde) return null;
  const ziel = { ...basis, runde };
  if (aktion === "v2-zurueckziehen") return ziel;
  if (aktion === "v2-pause") return typeof x.pausiert === "boolean" ? { ...ziel, pausiert:x.pausiert } : null;
  if (aktion === "v2-freigeben") {
    if (typeof x.sofort !== "boolean") return null;
    if (x.beginn == null && x.schluss == null && x.aufloesung == null) return { ...ziel, sofort:x.sofort };
    const beginn = time(x.beginn), schluss = time(x.schluss), aufloesung = time(x.aufloesung);
    if (!beginn || !schluss || Date.parse(beginn)>=Date.parse(schluss) || (x.aufloesung != null && !aufloesung)) return null;
    return { ...ziel, sofort:x.sofort, beginn, schluss, aufloesung };
  }
  if (aktion === "v2-einordnen") {
    if (typeof x.sofort !== "boolean" || !object(x.einordnungen) || Object.keys(x.einordnungen).length > 30) return null;
    const einordnungen: Record<string, unknown> = {};
    for (const [key,w] of Object.entries(x.einordnungen)) {
      if (!id(key) || !object(w)) return null;
      const text = clean(w.text ?? "", 1200), quelle = clean(w.quelle ?? "", 700);
      if (text === null || quelle === null) return null;
      if (quelle) {
        try { const url=new URL(quelle); if (url.protocol!=="https:" || url.username || url.password) return null; }
        catch { return null; }
      }
      if (text || quelle) einordnungen[key]={ text, ...(quelle ? { quelle } : {}) };
    }
    return { ...ziel, sofort:x.sofort, einordnungen };
  }
  return null;
}

function params(x: unknown): Record<string, unknown> | null {
  if (!object(x)) return null;
  const { aktion } = x;
  if (typeof aktion === "string" && aktion.startsWith("v2-")) return v2(x, aktion);
  if (aktion === "planen" || aktion === "upload" || aktion === "verwaltung" || aktion === "zurueckziehen") {
    const passwort = clean(x.passwort, 256);
    if (!passwort) return null;
    if (aktion === "upload" || aktion === "verwaltung") return { aktion, passwort };
    if (aktion === "zurueckziehen") return id(x.runde) ? { aktion, passwort, runde: x.runde } : null;
    const titel = clean(x.titel, 140), beginn = time(x.beginn), schluss = time(x.schluss);
    if (!titel || !beginn || !schluss || Date.parse(schluss) <= Date.parse(beginn) ||
      !Array.isArray(x.szenen) || x.szenen.length < 1 || x.szenen.length > 30) return null;
    const szenen = x.szenen.map(scene);
    if (szenen.some(s => !s) || new Set(szenen.map(s => s?.id)).size !== szenen.length) return null;
    return { aktion, passwort, titel, beginn, schluss, szenen };
  }
  if (aktion !== "laden" && aktion !== "stimme" && aktion !== "video") return null;
  const person = id(x.person), pin = clean(x.pin, 64), code = clean(x.code, 8);
  if (!person || !pin || !code || !/^\d{4}$/.test(code)) return null;
  const credentials = { aktion, person, pin, code };
  if (aktion === "laden") return x.runde === undefined ? credentials :
    id(x.runde) ? { ...credentials, runde: x.runde } : null;
  const runde = id(x.runde), szene = id(x.szene);
  if (!runde || !szene) return null;
  if (aktion === "video") return { ...credentials, runde, szene };
  const antwort = x.antwort;
  if (!object(antwort) || Object.entries(antwort).some(([k, v]) =>
    k === "enthaltung" ? v !== true :
      !["text", "wahl", "pfiff", "karte"].includes(k) || clean(v, k === "text" ? 1200 : 120) === null)) return null;
  return { ...credentials, runde, szene, antwort };
}

async function read(req: Request) {
  const stream = req.body?.getReader();
  if (!stream) throw new Error("body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, data = "";
  for (;;) {
    const { done, value } = await stream.read();
    if (done) break;
    size += value.byteLength;
    if (size > 350_000) { await stream.cancel(); throw new Error("size"); }
    data += decoder.decode(value, { stream: true });
  }
  return JSON.parse(data + decoder.decode());
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", "Content-Type": "application/json", "Vary": "Origin" });
  const send = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (origin && !origins.has(origin)) return send({ fehler: "zugang" }, 403);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type, apikey");
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return send({ fehler: "anfrage" }, 405);
  let p;
  try { p = params(await read(req)); } catch { return send({ fehler: "anfrage" }, 400); }
  if (!p) return send({ fehler: "anfrage" }, 400);
  const neu = String(p.aktion).startsWith("v2-");
  const { data, error } = await admin.rpc(neu ? "szenencheck_gateway_v2" : "szenencheck_gateway", { p });
  if (error?.code === "PGRST202" && p.aktion === "v2-laden") return send({ phase:"pilot" });
  if (error?.code === "23P01") return send({ fehler:"ueberschneidung" }, 409);
  if (error || !data) {
    console.error("szenencheck_rpc", error?.code ?? "no_data");
    return send({ fehler: "server" }, 500);
  }
  if (data.fehler) return send(data, data.fehler === "warte" ? 429 : data.fehler === "zugang" ? 403 : 409);
  if (p.aktion === "upload" || p.aktion === "v2-upload") {
    const pfad = `${data.verein}/${crypto.randomUUID()}.mp4`;
    const signed = await clips.createSignedUploadUrl(pfad);
    return signed.data ? send({ pfad, url: signed.data.signedUrl }) : send({ fehler: "clip" }, 502);
  }
  if (p.aktion === "video") {
    const signed = await clips.createSignedUrl(data.pfad, 300);
    return signed.data ? send({ url: signed.data.signedUrl }) : send({ fehler: "clip" }, 502);
  }
  if (p.aktion === "v2-video") {
    const signed = await clips.createSignedUrl(data.pfad, 120);
    return signed.data ? send({ url:signed.data.signedUrl }) : send({ fehler:"clip" }, 502);
  }
  return send(data);
});
