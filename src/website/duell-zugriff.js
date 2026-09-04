export function erstelleDuellZugriff({ adresse, oeffentlicherSchluessel }) {
  async function rufe(name, parameter) {
    const antwort = await fetch(`${adresse}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: oeffentlicherSchluessel,
        Authorization: `Bearer ${oeffentlicherSchluessel}` },
      body: JSON.stringify(parameter || {}),
    });
    const text = await antwort.text();
    if (!antwort.ok) {
      let meldung = "Der Server ist gerade nicht erreichbar.";
      try { meldung = JSON.parse(text).message || meldung; } catch { /* sichere Standardmeldung */ }
      throw new Error(meldung);
    }
    const daten = text ? JSON.parse(text) : null;
    return Array.isArray(daten) ? daten[0] || null : daten;
  }

  return Object.freeze({
    erstellen: (person) => rufe("duell_erstellen", { p_schiedsrichter_id: person.id, p_pin: person.pin }),
    beitreten: (code, name, person = null) => rufe("duell_beitreten", {
      p_code: code, p_anzeigename: name, p_schiedsrichter_id: person?.id || null, p_pin: person?.pin || null,
    }),
    frage: (zugang) => rufe("duell_frage", { p_zugang: zugang }),
    antworten: (zugang, frageId, auswahl) => rufe("duell_antwort_auswahl", {
      p_zugang: zugang, p_frage_id: frageId, p_auswahl: auswahl,
    }),
    reagieren: (zugang, frageId, emoji) => rufe("duell_reaktion_setzen", {
      p_zugang: zugang, p_frage_id: frageId, p_emoji: emoji,
    }),
    reaktionen: (zugang, frageId) => rufe("duell_reaktionen_fuer_frage", {
      p_zugang: zugang, p_frage_id: frageId,
    }),
    stand: (zugang) => rufe("duell_stand", { p_zugang: zugang }),
  });
}
