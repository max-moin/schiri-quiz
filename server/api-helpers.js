const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ivwmixaicpmtvcjtnbjv.supabase.co";
const SUPABASE_TIMEOUT_MS = 10_000;
const GEMINI_TIMEOUT_MS = 25_000;
export const GEMINI_STANDARD_MODELL = "gemini-3.5-flash-lite";

export class ServerkonfigurationFehlt extends Error {
  constructor(variable) {
    super(`Serverkonfiguration ${variable} fehlt.`);
    this.name = "ServerkonfigurationFehlt";
    this.code = "SERVER_CONFIGURATION_MISSING";
  }
}

export class ExternerDienstTimeout extends Error {
  constructor(dienst) {
    super(`${dienst} hat nicht rechtzeitig geantwortet.`);
    this.name = "ExternerDienstTimeout";
    this.code = "UPSTREAM_TIMEOUT";
  }
}

export class GeminiAntwortFehler extends Error {
  constructor(status, antwortText) {
    super(`Gemini antwortete mit HTTP ${status}: ${antwortText || "keine Antwort"}`);
    this.name = "GeminiAntwortFehler";
    this.code = status === 429 ? "UPSTREAM_QUOTA_EXHAUSTED" : "UPSTREAM_ERROR";
    this.httpStatus = status;
  }
}

export async function fetchMitZeitlimit(url, optionen = {}, zeitlimitMs, dienst) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), zeitlimitMs);

  try {
    return await fetch(url, { ...optionen, signal: controller.signal });
  } catch (fehler) {
    if (fehler && fehler.name === "AbortError") {
      throw new ExternerDienstTimeout(dienst);
    }
    throw fehler;
  } finally {
    clearTimeout(timer);
  }
}

function supabaseServerSchluessel() {
  const schluessel =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!schluessel) {
    throw new ServerkonfigurationFehlt("SUPABASE_SECRET_KEY");
  }

  return schluessel;
}

export function istSupabaseServerSchluesselKonfiguriert() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function supabaseRpc(name, body) {
  const schluessel = supabaseServerSchluessel();
  const headers = {
    "Content-Type": "application/json",
    apikey: schluessel,
  };

  // Neue sb_secret-/sb_publishable-Schlüssel werden nur im apikey-Header
  // gesendet. Nur die alten JWT-basierten Schlüssel brauchen zusätzlich
  // Authorization: Bearer. Der geheime Wert bleibt in beiden Fällen
  // ausschließlich in der Vercel Function und wird nie an den Browser
  // zurückgegeben.
  if (!schluessel.startsWith("sb_")) {
    headers.Authorization = `Bearer ${schluessel}`;
  }

  const antwort = await fetchMitZeitlimit(
    `${SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    SUPABASE_TIMEOUT_MS,
    "Supabase"
  );

  const rohtext = await antwort.text();
  let daten = null;
  if (rohtext) {
    try {
      daten = JSON.parse(rohtext);
    } catch {
      daten = null;
    }
  }

  if (!antwort.ok) {
    const fehlertext =
      (daten && (daten.message || daten.hint)) ||
      `Supabase antwortete mit HTTP ${antwort.status}.`;
    throw new Error(fehlertext);
  }

  return daten;
}

export function geminiModellFuer(umgebungsvariable) {
  return (
    process.env[umgebungsvariable] ||
    process.env.GEMINI_MODELL ||
    GEMINI_STANDARD_MODELL
  );
}

export function minimaleGeminiThinkingConfig(modell) {
  return modell.startsWith("gemini-2.5-")
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "minimal" };
}

export async function geminiAufrufen(apiKey, body, modell = GEMINI_STANDARD_MODELL) {
  return fetchMitZeitlimit(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modell)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
    GEMINI_TIMEOUT_MS,
    "Gemini"
  );
}

export async function stelleGeminiErfolgSicher(antwort) {
  if (antwort.ok) return;
  throw new GeminiAntwortFehler(antwort.status, await antwort.text());
}

export function istZeitueberschreitung(fehler) {
  return fehler && fehler.code === "UPSTREAM_TIMEOUT";
}

export function istGeminiKontingentErschoepft(fehler) {
  return fehler && fehler.code === "UPSTREAM_QUOTA_EXHAUSTED";
}

export function istServerkonfigurationFehlt(fehler) {
  return fehler && fehler.code === "SERVER_CONFIGURATION_MISSING";
}

export function sichereApiAntwort(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function antworteMitSicheremFehler(res, status, nachricht, fehler) {
  // Technische Einzelheiten bleiben in den geschützten Vercel-Logs. An den
  // Browser geht nur eine stabile, für Nutzer verständliche Meldung.
  console.error(`[API] ${nachricht}`, fehler);
  res.status(status).json({ fehler: nachricht });
}
