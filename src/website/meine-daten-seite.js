import { DATENBANK } from "../../verein.config.js";
import { ladeFortbildung } from "./fortbildungspunkte-ansicht.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const $ = (id) => document.getElementById(id);
let ladeNummer = 0;

async function starte() {
  const lauf = ++ladeNummer;
  const person = anmeldung.lesen();
  $("meine-zugang").hidden = !!person;
  $("meine-inhalt").hidden = !person;
  void ladeFortbildung(person);
  if (!person) return;
  $("meine-name").textContent = person.name || "Vereinsmitglied";
  $("meine-initiale").textContent = (person.name || "V").trim().charAt(0).toLocaleUpperCase("de");
  const kennung = anmeldung.leseKennung();
  if (!kennung) {
    $("meine-verein").textContent = "Dein Verein";
    return;
  }
  try {
    const verein = await anmeldung.pruefeKennung(kennung);
    if (lauf !== ladeNummer) return;
    $("meine-verein").textContent = verein?.vereinName || "Dein Verein";
  } catch {
    if (lauf !== ladeNummer) return;
    $("meine-verein").textContent = "Dein Verein";
  }
}

$("meine-anmelden")?.addEventListener("click", async () => {
  if (!loginDialog) return;
  const ergebnis = await loginDialog.oeffne({ grund: "Melde dich an, um deine Daten zu sehen." });
  if (ergebnis.status === "angemeldet") void starte();
});

void starte();
window.addEventListener("pageshow", () => void starte());
document.addEventListener("visibilitychange", () => { if (!document.hidden) void starte(); });
anmeldung.abonniere(() => void starte());
