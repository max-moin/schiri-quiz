// Verdrahtung des Blocks "Für dich" auf der Startseite (26.09.2026).
// Die Logik steht in fuer-dich.js; hier nur Laden und Zeichnen.
//
// Nur fuer Angemeldete. Faellt ein Aufruf aus, fehlt eben dieser eine
// Punkt - die Startseite bleibt vollstaendig, genau wie bei den Terminen.
import { DATENBANK, VEREIN } from "../../verein.config.js";
import { erstelleTerminZugriff } from "./termine.js";
import { fuerDichPunkte } from "./fuer-dich.js";

const bereich = document.getElementById("fuerDich");
const liste = document.getElementById("fuerDichListe");
const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;

const sicher = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function neueAntworten(person) {
  const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/meine_neuen_antworten`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DATENBANK.oeffentlicherSchluessel,
      Authorization: `Bearer ${DATENBANK.oeffentlicherSchluessel}`,
    },
    body: JSON.stringify({ p_schiedsrichter_id: person.id, p_pin: person.pin }),
  });
  if (!antwort.ok) return 0;
  // Liefert eine Zahl, keine Liste - leseRpcAntwort() taugt hier nicht.
  const roh = (await antwort.text()).trim();
  return roh ? Number(JSON.parse(roh)) || 0 : 0;
}

let lauf = 0;
async function zeige(person) {
  const meinLauf = ++lauf;
  if (!person) { bereich.hidden = true; return; }
  const zugriff = erstelleTerminZugriff(DATENBANK);
  const [termine, findungen, antworten] = await Promise.allSettled([
    zugriff.alleFuerMitglied(person, VEREIN.seitenschluessel),
    zugriff.terminfindungen(person),
    neueAntworten(person),
  ]);
  if (meinLauf !== lauf) return; // inzwischen ab- oder umgemeldet
  const wert = (x, ersatz) => (x.status === "fulfilled" ? x.value : ersatz);
  const punkte = fuerDichPunkte({
    termine: wert(termine, []),
    findungen: wert(findungen, []),
    neueAntworten: wert(antworten, 0),
  });
  // Nichts offen ist auch eine Auskunft - aber nur, wenn die Termine
  // wirklich geladen wurden. Sonst waere "alles erledigt" geraten.
  if (!punkte.length && termine.status !== "fulfilled") { bereich.hidden = true; return; }
  liste.innerHTML = punkte.length
    ? punkte.map((p) => `
        <a class="lz fuer-dich-punkt ${p.art}" href="${sicher(p.href)}">
          <span class="lz-text">
            <span class="lz-titel">${sicher(p.titel)}</span>
            ${p.zusatz ? `<span class="lz-sub">${sicher(p.zusatz)}</span>` : ""}
          </span>
          <span class="lz-rechts"><span class="lz-pfeil" aria-hidden="true">→</span></span>
        </a>`).join("")
    : `<p class="fuer-dich-leer">Alles erledigt – gerade wartet nichts auf dich.</p>`;
  bereich.hidden = false;
}

if (bereich && liste && anmeldung?.abonniere) {
  anmeldung.abonniere((person) => { void zeige(person).catch(() => { bereich.hidden = true; }); });
}
