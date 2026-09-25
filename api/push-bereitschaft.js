import { istSupabaseServerSchluesselKonfiguriert, sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { vapidKonfiguration } from "../server/schiri-push.js";
import { b64uKodieren, oeffentlicherSchluesselZu } from "../server/webpush.js";

const ID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt" });
  }
  const { schiedsrichterId, pin } = req.body || {};
  if (!ID.test(schiedsrichterId || "") || typeof pin !== "string" || pin.length > 100) {
    return res.status(400).json({ fehler: "Anmeldung ungültig." });
  }
  const pilot = process.env.PUSH_TEST_AKTIV === "true"
    && schiedsrichterId.toLowerCase() === String(process.env.PUSH_PILOT_SCHIRI_ID || "").toLowerCase();
  const freigegeben = process.env.PUSH_DISPATCH_AKTIV === "true"
    && Boolean(process.env.PUSH_SENDE_SCHLUESSEL);
  const config = vapidKonfiguration();
  const oeffentlich = process.env.VAPID_OEFFENTLICHER_SCHLUESSEL || "";
  if ((!pilot && !freigegeben) || !config || !istSupabaseServerSchluesselKonfiguriert()
      || oeffentlich !== b64uKodieren(oeffentlicherSchluesselZu(config.vapidPrivatRoh))) {
    return res.status(200).json({ bereit: false });
  }
  try {
    // Die Antwort verrät nur einen öffentlichen Schlüssel. Trotzdem wird
    // die PIN geprüft, damit vor dem Pilot nicht jeder die Freigabe sieht.
    await supabaseRpc("schiri_push_einstellungen", {
      p_schiedsrichter_id: schiedsrichterId, p_pin: pin,
    });
    return res.status(200).json({ bereit: true, modus: freigegeben ? "live" : "pilot",
      oeffentlicherSchluessel: oeffentlich });
  } catch {
    return res.status(403).json({ fehler: "Anmeldung ungültig." });
  }
}
