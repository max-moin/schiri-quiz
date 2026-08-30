// ============================================================
//  Serveraufrufe ohne die Supabase-Bibliothek
// ============================================================
//  Die Quizseite laedt supabase-js und reicht den fertigen Client als "sb"
//  in die Fachmodule. Die Vereinsseiten laden ihn bewusst nicht: fuer eine
//  Handvoll Aufrufe lohnen sich keine 60 KB Fremdcode auf jeder Seite -
//  dieselbe Entscheidung wie in src/core/anmeldung.js und im Termin-Modul
//  der Startseite.
//
//  Damit dieselben Fachmodule trotzdem auf beiden Seiten laufen koennen,
//  bildet diese Datei genau den Ausschnitt nach, den sie benutzen:
//  sb.rpc(name, parameter) -> { data, error }. Bewusst dieselbe Form,
//  inklusive "error" statt einer geworfenen Ausnahme - sonst muesste jedes
//  Fachmodul zwei Fehlerwege kennen.
// ============================================================

(function stelleRpcBereit(global) {
  "use strict";

  function erstelleRpc({ adresse, oeffentlicherSchluessel }) {
    if (!adresse || !oeffentlicherSchluessel) {
      throw new Error("RPC braucht Adresse und oeffentlichen Schluessel.");
    }

    async function rpc(name, parameter) {
      try {
        const antwort = await global.fetch(`${adresse}/rest/v1/rpc/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: oeffentlicherSchluessel,
            Authorization: `Bearer ${oeffentlicherSchluessel}`,
          },
          body: JSON.stringify(parameter || {}),
        });
        if (!antwort.ok) {
          return { data: null, error: { message: `Server antwortet mit ${antwort.status}` } };
        }
        // Manche Funktionen antworten mit leerem Koerper. JSON.parse wuerde
        // daran scheitern und einen Fehler melden, wo gar keiner ist.
        const text = await antwort.text();
        return { data: text ? JSON.parse(text) : null, error: null };
      } catch (fehler) {
        return { data: null, error: { message: fehler.message || "Netzwerkfehler" } };
      }
    }

    return Object.freeze({ rpc });
  }

  global.SchiriRpc = Object.freeze({ erstelleRpc });
})(globalThis);
