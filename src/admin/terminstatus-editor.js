import { datumKurz, sicher, zeitspanne } from "../website/termine.js";

const terminZeit = (t) => [datumKurz(t.datum), zeitspanne(t)].filter(Boolean).join(" · ");

export function erstelleTerminstatusEditor({wurzel, client, verein}) {
  if (!wurzel) return;
  let termine = [], aktiv = "", bestaetigen = false, laedt = false, geladen = false, meldung = "";
  const auswahl = () => termine.find(t => t.id === aktiv);
  function zeichne(fokus) {
    const t = auswahl();
    wurzel.innerHTML = `<section class="admin-panel">
      <h3>Festen Termin als abgesagt markieren</h3>
      <p>Datum, Beschreibung und bisherige Rückmeldungen bleiben erhalten. Es werden keine Nachrichten versandt.</p>
      ${geladen ? `<label>Termin <select data-status-termin ${laedt?"disabled":""}>
        <option value="">Termin wählen</option>${termine.map(z=>`<option value="${sicher(z.id)}"${z.id===aktiv?" selected":""}>${sicher(terminZeit(z))} · ${sicher(z.titel)}${z.abgesagt_am?" · Abgesagt":""}</option>`).join("")}
        </select></label>` : ""}
      ${t?.abgesagt_am ? '<p><span class="wortmarke rot">Abgesagt</span> Der Termin bleibt im bisherigen Bereich sichtbar.</p>' :
        t && bestaetigen ? `<div><p>„${sicher(t.titel)}“ am ${sicher(terminZeit(t))} wirklich absagen?</p>
        <button type="button" class="knopf" data-status-zurueck ${laedt?"disabled":""}>Zurück</button>
        <button type="button" class="knopf knopf-primaer" data-status-bestaetigen ${laedt?"disabled":""}>Absage bestätigen</button></div>` :
        t ? `<p><button type="button" class="knopf" data-status-absagen ${laedt?"disabled":""}>Termin absagen</button></p>` : ""}
      <button type="button" class="knopf" data-status-laden ${laedt?"disabled":""}>${geladen?"Aktualisieren":"Termine laden"}</button>
      <p role="status">${sicher(meldung)}</p>
    </section>`;
    if (fokus) wurzel.querySelector(fokus)?.focus();
  }
  async function aufrufen(id = null) {
    laedt = true; meldung = id ? "Absage wird gespeichert …" : "Termine werden geladen …"; zeichne();
    try {
      const {data,error} = await client.rpc("website_terminstatus", {p_seitenschluessel:verein.seitenschluessel,p_absagen:id});
      if (error || !Array.isArray(data)) throw error || new Error("Ungültige Antwort");
      termine = data;
      geladen = true; bestaetigen = false;
      meldung = id ? "Termin als abgesagt markiert." : termine.length ? "" : "Keine Termine vorhanden.";
    } catch {
      meldung = id ? "Die Absage konnte nicht bestätigt werden. Lade die Termine neu, um den aktuellen Status zu sehen." :
        "Die Termine konnten nicht geladen werden. Prüfe deine Anmeldung und ob die Terminabsage schon eingerichtet ist.";
    } finally { laedt = false; zeichne(geladen ? "[data-status-termin]" : "[data-status-laden]"); }
  }
  wurzel.addEventListener("change",e=>{
    if (!e.target.matches("[data-status-termin]")) return;
    aktiv = e.target.value; bestaetigen = false; zeichne("[data-status-termin]");
  });
  wurzel.addEventListener("click",e=>{
    const b = e.target.closest("button");
    if (!b || laedt) return;
    if (b.hasAttribute("data-status-laden")) void aufrufen();
    if (b.hasAttribute("data-status-absagen")) { bestaetigen=true; zeichne("[data-status-zurueck]"); }
    if (b.hasAttribute("data-status-zurueck")) { bestaetigen=false; zeichne("[data-status-absagen]"); }
    if (b.hasAttribute("data-status-bestaetigen") && bestaetigen && auswahl() && !auswahl().abgesagt_am) void aufrufen(aktiv);
  });
  zeichne();
}
