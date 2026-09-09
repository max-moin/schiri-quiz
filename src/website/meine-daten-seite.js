import { DATENBANK } from "../../verein.config.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const $ = (id) => document.getElementById(id);

async function starte() {
  const person = anmeldung.lesen();
  $("meine-zugang").hidden = !!person;
  $("meine-inhalt").hidden = !person;
  if (!person) return;
  $("meine-name").textContent = person.name || "Vereinsmitglied";
  const kennung = anmeldung.leseKennung();
  if (!kennung) {
    $("meine-verein").textContent = "Dein Verein";
    return;
  }
  try {
    const verein = await anmeldung.pruefeKennung(kennung);
    $("meine-verein").textContent = verein?.vereinName || "Dein Verein";
  } catch {
    $("meine-verein").textContent = "Dein Verein";
  }
}

$("meine-anmelden")?.addEventListener("click", async () => {
  if (!loginDialog) return;
  const ergebnis = await loginDialog.oeffne({ grund: "Melde dich an, um deine Daten zu sehen." });
  if (ergebnis.status === "angemeldet") void starte();
});

void starte();
