import { istSupabaseServerSchluesselKonfiguriert, sichereApiAntwort, supabaseRpc } from "../server/api-helpers.js";
import { istPushDienst, schickePush, vapidKonfiguration } from "../server/schiri-push.js";

const ID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ fehler: "Nur POST erlaubt" });
  }
  if (req.body?.aktion === 'obmann_geraete' || req.body?.aktion === 'obmann_test') {
    return obmannAktion(req, res);
  }
  const config = vapidKonfiguration();
  if ((process.env.PUSH_TEST_AKTIV !== "true" && process.env.PUSH_DISPATCH_AKTIV !== "true"
      && process.env.PUSH_ANMELDUNG_AKTIV !== "true") || !config
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
      && process.env.PUSH_ANMELDUNG_AKTIV !== "true"
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

async function obmannAktion(req,res) {
  const { passwort, aktion, aboId } = req.body;
  if (typeof passwort !== 'string' || !passwort || passwort.length>256
      || (aktion==='obmann_test' && !ID.test(aboId || ''))) {
    return res.status(400).json({fehler:'Obmann-Anmeldung oder Geräteauswahl ungültig.'});
  }
  if (!istSupabaseServerSchluesselKonfiguriert()) return res.status(503).json({fehler:'Verwaltung ist nicht eingerichtet.'});
  const config = vapidKonfiguration();
  const bereit = Boolean(config && (process.env.PUSH_TEST_AKTIV==='true'
    || process.env.PUSH_DISPATCH_AKTIV==='true' || process.env.PUSH_ANMELDUNG_AKTIV==='true'));
  try {
    if (aktion==='obmann_geraete') {
      const geraete = await supabaseRpc('obmann_push_geraete',{p_passwort:passwort});
      const felder=['schiedsrichter_id','name','abo_id','geraet','gueltig_bis','zuletzt_bestaetigt','letzter_test_am',
        'empfang_aktiv','quiz_neu','quiz_erinnerung','termine','feedback_antwort'];
      const sichtbar=Array.isArray(geraete) ? geraete.map(g=>Object.fromEntries(felder.map(f=>[f,g[f]]))) : [];
      return res.status(200).json({bereit,geraete:sichtbar});
    }
    if (!bereit) return res.status(503).json({fehler:'Testversand ist noch nicht eingerichtet.'});
    const liste = await supabaseRpc('obmann_push_test_abo',{p_passwort:passwort,p_abo_id:aboId});
    const abo = Array.isArray(liste) ? liste[0] : null;
    if (!abo || !istPushDienst(abo.endpunkt)) return res.status(404).json({fehler:'Gerät ist nicht verfügbar.'});
    const result = await schickePush(abo, JSON.stringify({titel:'Kickers · Obmann-Gerätetest',
      text:'Diese Testmitteilung wurde gezielt an dieses Gerät geschickt.',ziel:'/mitteilungen.html',gruppe:'obmann_geraetetest'}),config);
    if (result.tot && result.status>0) {
      await supabaseRpc('push_abo_entfernen',{p_id:abo.id});
      return res.status(409).json({fehler:'Geräteabo abgelaufen. Der Schiri muss es erneut aktivieren.'});
    }
    if (!result.ok) return res.status(503).json({fehler:'Der Push-Dienst hat die Testmitteilung nicht angenommen.'});
    return res.status(200).json({ok:true});
  } catch (e) {
    if (String(e?.message).includes('Bitte warte eine Minute')) return res.status(429).json({fehler:'Bitte eine Minute vor dem nächsten Gerätetest warten.'});
    return res.status(403).json({fehler:'Kein Zugriff oder Gerät derzeit nicht verfügbar.'});
  }
}
