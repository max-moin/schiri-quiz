import { normalisiereWebsiteInhalt, validiereWebsiteInhalt } from "../website/content-config.js";

export function erstelleInhaltsSpeicher({ client, verein, benutzer, bereich, fallback }) {
  async function laden() {
    const ergebnis = await client
      .from("website_inhalte_konfiguration")
      .select("konfiguration,updated_at")
      .eq("seitenschluessel", verein.seitenschluessel)
      .eq("bereich", bereich)
      .maybeSingle();
    if (ergebnis.error) throw ergebnis.error;
    return {
      konfiguration: normalisiereWebsiteInhalt(bereich, ergebnis.data?.konfiguration, fallback),
      aktualisiertAm: ergebnis.data?.updated_at || null,
      istFallback: !ergebnis.data?.konfiguration,
    };
  }

  async function veroeffentlichen(konfiguration) {
    const fehler = validiereWebsiteInhalt(bereich, konfiguration);
    if (fehler.length) {
      const auszug = fehler.slice(0, 4).join(" ");
      const rest = fehler.length > 4 ? ` Weitere ${fehler.length - 4} Fehler.` : "";
      throw new Error(`Bitte erst vervollständigen: ${auszug}${rest}`);
    }
    const sicher = normalisiereWebsiteInhalt(bereich, konfiguration, fallback);
    const bisher = await client
      .from("website_inhalte_konfiguration")
      .select("konfiguration,updated_at")
      .eq("seitenschluessel", verein.seitenschluessel)
      .eq("bereich", bereich)
      .maybeSingle();
    if (bisher.error) throw bisher.error;

    if (bisher.data?.konfiguration) {
      const archiv = await client.from("website_inhalte_versionen").insert({
        seitenschluessel: verein.seitenschluessel,
        bereich,
        konfiguration: bisher.data.konfiguration,
        urspruenglich_veroeffentlicht_am: bisher.data.updated_at,
        archiviert_von: benutzer.id,
      });
      if (archiv.error) throw archiv.error;
    }

    const zeit = new Date().toISOString();
    const neueWerte = { konfiguration: sicher, updated_at: zeit, updated_by: benutzer.id };
    const gespeichert = bisher.data?.konfiguration
      ? await client.from("website_inhalte_konfiguration").update(neueWerte)
        .eq("seitenschluessel", verein.seitenschluessel).eq("bereich", bereich)
      : await client.from("website_inhalte_konfiguration").insert({
        seitenschluessel: verein.seitenschluessel,
        bereich,
        ...neueWerte,
      });
    if (gespeichert.error) throw gespeichert.error;
    return { konfiguration: sicher, aktualisiertAm: zeit };
  }

  async function versionen() {
    const ergebnis = await client
      .from("website_inhalte_versionen")
      .select("id,konfiguration,archiviert_am,urspruenglich_veroeffentlicht_am")
      .eq("seitenschluessel", verein.seitenschluessel)
      .eq("bereich", bereich)
      .order("archiviert_am", { ascending: false })
      .limit(5);
    if (ergebnis.error) throw ergebnis.error;
    return ergebnis.data || [];
  }

  return Object.freeze({ laden, veroeffentlichen, versionen });
}
