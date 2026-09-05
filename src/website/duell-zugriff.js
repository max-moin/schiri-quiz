export function erstelleDuellZugriff({ adresse, oeffentlicherSchluessel }) {
  async function fetchRpc(name, parameter) {
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
    return text ? JSON.parse(text) : null;
  }

  // "duell_erstellen"/"duell_beitreten" sind als "returns table(...)"
  // deklariert - PostgREST verpackt das IMMER als Array mit genau einer
  // Zeile, unabhaengig vom Inhalt. Die uebrigen RPCs hier liefern
  // "returns jsonb": deren Antwort ist die jsonb-Nutzlast selbst, auch
  // wenn die Nutzlast zufaellig ein JSON-Array ist (z.B. die
  // Reaktionsliste) - die WAERE durch dieselbe Array-Auspack-Regel
  // faelschlich auf ihr erstes Element zusammengestutzt worden. Deshalb
  // zwei getrennte Aufrufwege statt einer gemeinsamen Heuristik.
  async function rufeZeile(name, parameter) {
    const daten = await fetchRpc(name, parameter);
    return Array.isArray(daten) ? (daten[0] || null) : daten;
  }

  // Die beiden Freitext-Bewertungen laufen NICHT direkt gegen Supabase -
  // die RPCs dahinter sind service_role-only (siehe api/duell-freitext*.js
  // und die Migration v120) - sondern ueber einen eigenen API-Endpunkt,
  // der den Gemini-Schluessel haelt.
  async function rufeApi(pfad, koerper) {
    const antwort = await fetch(pfad, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper),
    });
    const daten = await antwort.json().catch(() => ({}));
    if (!antwort.ok) throw new Error(daten.fehler || "Der Server ist gerade nicht erreichbar.");
    return daten;
  }

  return Object.freeze({
    erstellen: (person) => rufeZeile("duell_erstellen", { p_schiedsrichter_id: person.id, p_pin: person.pin }),
    beitreten: (code, name, person = null) => rufeZeile("duell_beitreten", {
      p_code: code, p_anzeigename: name, p_schiedsrichter_id: person?.id || null, p_pin: person?.pin || null,
    }),
    frage: (zugang) => fetchRpc("duell_frage", { p_zugang: zugang }),
    antworten: (zugang, frageId, auswahl) => fetchRpc("duell_antwort_auswahl", {
      p_zugang: zugang, p_frage_id: frageId, p_auswahl: auswahl,
    }),
    freitext: (zugang, frageId, freitext) => rufeApi("/api/duell-freitext", { zugang, frageId, freitext }),
    freitextErgaenzung: (zugang, frageId, ergaenzung) =>
      rufeApi("/api/duell-freitext-ergaenzung", { zugang, frageId, ergaenzung }),
    reagieren: (zugang, frageId, emoji) => fetchRpc("duell_reaktion_setzen", {
      p_zugang: zugang, p_frage_id: frageId, p_emoji: emoji,
    }),
    reaktionen: (zugang, frageId) => fetchRpc("duell_reaktionen_fuer_frage", {
      p_zugang: zugang, p_frage_id: frageId,
    }),
    // Voller Verlauf (alle 5 Fragen, Vergleich, Auswertungsscreen - Teile B/D).
    verlauf: (zugang) => fetchRpc("duell_verlauf", { p_zugang: zugang }),
    // Nur fuer angemeldete Vereinsmitglieder sinnvoll (Teil E) - Gaeste
    // haben keine serverseitige Identitaet, an der man das festmachen koennte.
    meineListe: (person) => fetchRpc("duell_meine_liste", { p_schiedsrichter_id: person.id, p_pin: person.pin }),
  });
}
