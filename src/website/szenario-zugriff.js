// ============================================================
//  Serverzugriff des Entscheidungs-Modus
// ============================================================
//  Nur die Aufrufe, keine Darstellung. Dieselbe Bauart wie
//  erstelleTerminZugriff in termine.js: einfaches fetch gegen die
//  RPC-Schnittstelle, weil die Vereinsseiten die Supabase-Bibliothek
//  nicht laden.
//
//  ------------------------------------------------------------
//  Was hier bewusst NICHT steht
//  ------------------------------------------------------------
//  Es gibt keine Funktion, die eine Loesung holt, und keinen Vergleich
//  im Browser. Der Server bekommt die Wahl und schickt das Ergebnis
//  zurueck (szenario_antwort_pruefen). Wuerde die richtige Antwort mit
//  dem Bild ausgeliefert, koennte man sie in der Entwicklerkonsole
//  ablesen - bei einem Modus mit vier Knoepfen ist das nicht bloss
//  unschoen, dann ist der ganze Modus wertlos.
// ============================================================

export function erstelleSzenarioZugriff({ adresse, oeffentlicherSchluessel }) {
  async function rufe(name, parameter) {
    const antwort = await fetch(`${adresse}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: oeffentlicherSchluessel,
        Authorization: `Bearer ${oeffentlicherSchluessel}`,
      },
      body: JSON.stringify(parameter),
    });
    if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`);
    return antwort.json();
  }

  const ersteZeile = (daten) => (Array.isArray(daten) ? daten[0] || null : daten);

  return Object.freeze({
    naechstes: async (person, ausschlussId = null) =>
      ersteZeile(await rufe("szenario_naechstes", {
        p_schiedsrichter_id: person.id,
        p_pin: person.pin,
        p_ausschluss_szenario_id: ausschlussId,
      })),

    pruefe: async (person, szenarioId, wahl) =>
      ersteZeile(await rufe("szenario_antwort_pruefen", {
        p_schiedsrichter_id: person.id,
        p_pin: person.pin,
        p_szenario_id: szenarioId,
        p_fortsetzung: wahl.fortsetzung,
        p_strafe: wahl.strafe,
        p_fortsetzung_fuer: wahl.fortsetzungFuer || null,
        p_strafe_fuer: wahl.strafeFuer || null,
        p_zusatz: wahl.zusatz || {},
      })),

    statistik: async (person) =>
      ersteZeile(await rufe("szenario_statistik", {
        p_schiedsrichter_id: person.id,
        p_pin: person.pin,
      })),
  });
}

// Die Wochenfragen leben im Quiz, werden aber in der Modus-Auswahl
// gezaehlt ("noch 3 offen"). Zwei bestehende RPCs, hier nur
// zusammengerechnet - eine eigene Zaehl-RPC waere eine dritte Stelle,
// an der dieselbe Regel steht, was offen heisst.
export function erstelleWochenZaehler({ adresse, oeffentlicherSchluessel }) {
  async function rufe(name, parameter) {
    const antwort = await fetch(`${adresse}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: oeffentlicherSchluessel,
        Authorization: `Bearer ${oeffentlicherSchluessel}`,
      },
      body: JSON.stringify(parameter),
    });
    if (!antwort.ok) throw new Error(`Server antwortet mit ${antwort.status}`);
    const daten = await antwort.json();
    return Array.isArray(daten) ? daten : [];
  }

  return async function zaehleOffeneWochenfragen(person) {
    const [fragen, antworten] = await Promise.all([
      rufe("wochen_fragen", { p_schiedsrichter_id: person.id, p_pin: person.pin }),
      rufe("meine_antworten", { p_schiedsrichter_id: person.id, p_pin: person.pin }),
    ]);
    const beantwortet = new Set(
      antworten.filter((a) => a.beantwortet).map((a) => a.frage_id),
    );
    return {
      gesamt: fragen.length,
      offen: fragen.filter((f) => !beantwortet.has(f.id)).length,
    };
  };
}
