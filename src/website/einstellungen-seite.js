import { DATENBANK, VEREIN } from "../../verein.config.js";
import { lagebericht } from "../features/push-anmeldung.js";
import { erklaereMitteilungsstatus } from "../features/mitteilungen-status.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung
  || globalThis.SchiriAnmeldung.erstelleAnmeldung({
    adresse: DATENBANK.adresse,
    oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
  });
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const $ = (id) => document.getElementById(id);
const istMitteilungsseite = document.body.dataset.seitenname === "Mitteilungen";

function zeigeStatus() {
  if (!istMitteilungsseite) return;
  const lage = lagebericht();
  const erlaubnis = globalThis.Notification?.permission || "default";
  const versandBereit = VEREIN.push?.versandAktiv === true
    && Boolean(VEREIN.push?.oeffentlicherSchluessel);
  const status = erklaereMitteilungsstatus(lage, erlaubnis, versandBereit);
  $("mitteilungen-kurzstatus").textContent = status.kurz;
  $("mitteilungen-browser").textContent = status.browser;
  $("mitteilungen-erlaubnis").textContent = status.erlaubnis;
  $("mitteilungen-versand").textContent = versandBereit ? "Technisch freigegeben" : "Noch nicht gestartet";
  $("mitteilungen-hinweis").textContent = status.hinweis;
  $("mitteilungen-installieren").hidden = !status.installationZeigen;
}

anmeldung.abonniere((person) => {
  $("einstellungen-zugang").hidden = Boolean(person);
  $("einstellungen-inhalt").hidden = !person;
  if (person) zeigeStatus();
});

$("einstellungen-anmelden")?.addEventListener("click", async () => {
  await loginDialog?.oeffne({
    grund: "Melde dich an, um deine persönlichen Einstellungen zu öffnen.",
    gastErlaubt: false,
  });
});
