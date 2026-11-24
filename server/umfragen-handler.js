import { sichereApiAntwort, supabaseRpc } from "./api-helpers.js";
import { normalisiereAntwort, version } from "../src/shared/stimmungsbild.js";

const personId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const adminKey = /^[A-Za-z0-9_-]{43}$/;
const mitglied = ["status","abgeben"];
const admin = ["obmann-stand","obmann-oeffnen","obmann-schliessen"];

export function sichereUmfrageAnfrage(b) {
  if (!b || b.version !== version) return null;
  if (mitglied.includes(b.aktion)) {
    if (typeof b.person !== "string" || !personId.test(b.person)
      || typeof b.pin !== "string" || !b.pin.trim() || b.pin.length > 32) return null;
    const p = {aktion:b.aktion, person:b.person, pin:b.pin};
    if (b.aktion === "abgeben") {
      p.antwort = normalisiereAntwort(b.antwort);
      if (!p.antwort) return null;
    }
    return p;
  }
  if (admin.includes(b.aktion) && typeof b.schluessel==="string" && adminKey.test(b.schluessel)) {
    return {aktion:b.aktion, schluessel:b.schluessel};
  }
  return null;
}

export default async function handler(req,res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({fehler:"methode"}); }
  if (!String(req.headers["content-type"]||"").startsWith("application/json")) return res.status(415).json({fehler:"format"});
  const p = sichereUmfrageAnfrage(req.body);
  if (!p) return res.status(400).json({fehler:"eingabe"});
  try {
    const d = await supabaseRpc("kickers_stimmungsbild_gateway",{p});
    if (d?.fehler === "warte") { res.setHeader("Retry-After","900"); return res.status(429).json(d); }
    if (d?.fehler === "zugang") return res.status(403).json(d);
    if (d?.stand && !d.fehler) return res.status(200).json(d);
  } catch { /* Keine Zugangsdaten, Eingaben oder Rohfehler protokollieren. */ }
  return res.status(503).json({fehler:"nicht_verfuegbar"});
}
