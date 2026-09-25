import { istSupabaseServerSchluesselKonfiguriert, sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { istPushDienst, schickePush, vapidKonfiguration } from "../server/schiri-push.js";

const ID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt" });
  }
  const config = vapidKonfiguration();
  if ((process.env.PUSH_TEST_AKTIV !== "true" && process.env.PUSH_DISPATCH_AKTIV !== "true") || !config
      || !istSupabaseServerSchluesselKonfiguriert()) {
    return res.status(503).json({ fehler: "Testmitteilungen sind noch nicht eingerichtet." });
  }
  const { schiedsrichterId, pin, endpunkt } = req.body || {};
  if (!ID.test(schiedsrichterId || "") || typeof pin !== "string" || pin.length > 100
      || typeof endpunkt !== "string" || endpunkt.length > 2048 || !istPushDienst(endpunkt)) {
    return res.status(400).json({ fehler: "Dieses Gerät konnte nicht geprüft werden." });
  }
  // Der Pilot ist eine einzelne, auf dem Server konfigurierte Person.
  // Ein kopierter Frontend-Link allein erlaubt keinen Test für andere.
  if (process.env.PUSH_DISPATCH_AKTIV !== "true"
      && schiedsrichterId.toLowerCase() !== String(process.env.PUSH_PILOT_SCHIRI_ID || "").toLowerCase()) {
    return res.status(403).json({ fehler: "Testmitteilungen sind für dieses Konto nicht freigeschaltet." });
  }
  try {
    const liste = await supabaseRpc("schiri_push_test_abo", {
      p_schiedsrichter_id: schiedsrichterId, p_pin: pin, p_endpunkt: endpunkt,
    });
    const abo = Array.isArray(liste) ? liste[0] : null;
    if (!abo || !istPushDienst(abo.endpunkt)) {
      return res.status(400).json({ fehler: "Dieses Gerät ist nicht aktiv. Bitte erneut einschalten." });
    }
    const ergebnis = await schickePush(abo, JSON.stringify({
      titel: "Kickers · Testmitteilung",
      text: "Mitteilungen funktionieren auf diesem Gerät.",
      ziel: "/mitteilungen.html", gruppe: "push_test",
    }), config);
    if (ergebnis.tot && ergebnis.status > 0) {
      await supabaseRpc("push_abo_entfernen", { p_id: abo.id });
      return res.status(409).json({ fehler: "Das Geräte-Abo ist abgelaufen. Bitte neu einschalten." });
    }
    if (!ergebnis.ok) return res.status(503).json({ fehler: "Die Testmitteilung konnte nicht zugestellt werden." });
    return res.status(200).json({ ok: true });
  } catch (fehler) {
    console.error("[API] Push-Test fehlgeschlagen", fehler);
    return res.status(503).json({ fehler: "Der Test ist momentan nicht möglich." });
  }
}
