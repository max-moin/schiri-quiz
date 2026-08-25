import { VEREIN, DATENBANK, ALTERSKLASSEN, TURNIER, FAHRTKOSTEN, VEREINE, AUSFALL_ANTEIL } from "../../verein.config.js";
import { standardSpesenKonfiguration } from "../website/spesen-config.js";
import {
  abmelden,
  authentifizierungsStand,
  mitPasswortAnmelden,
  totpBestaetigen,
  totpEinrichten,
} from "./obmann-auth.js";
import { erstelleSpesenEditor } from "./spesen-editor.js";
import { erstelleRegelnEditor } from "./regeln-editor.js";
import { erstelleVorlagenEditor } from "./vorlagen-editor.js";
import { erstelleUnterlagenEditor } from "./unterlagen-editor.js";

const client = window.supabase.createClient(
  DATENBANK.adresse,
  DATENBANK.oeffentlicherSchluessel,
);

const $ = (id) => document.getElementById(id);
const ansichten = ["laden", "login", "totpSetup", "totpCode", "keinZugriff", "editor"];
let aktiverFaktor = null;
let aktuellerBenutzer = null;
let editorenGestartet = false;

const fallback = standardSpesenKonfiguration({
  altersklassen: ALTERSKLASSEN,
  turnier: TURNIER,
  fahrtkosten: FAHRTKOSTEN,
  vereine: VEREINE,
  ausfallAnteil: AUSFALL_ANTEIL,
});

function zeige(name) {
  ansichten.forEach((id) => { $(id).hidden = id !== name; });
}

function fehler(text = "") {
  const box = $("authFehler");
  box.textContent = text;
  box.hidden = !text;
}

async function hatRedaktionsrecht() {
  const ergebnis = await client
    .from("website_redakteure")
    .select("seitenschluessel")
    .eq("seitenschluessel", VEREIN.seitenschluessel)
    .maybeSingle();
  if (ergebnis.error) throw ergebnis.error;
  return !!ergebnis.data;
}

async function oeffneEditor() {
  if (!await hatRedaktionsrecht()) {
    zeige("keinZugriff");
    return;
  }
  $("editorVerein").textContent = VEREIN.name;
  zeige("editor");
  if (!editorenGestartet) {
    editorenGestartet = true;
    erstelleSpesenEditor({
      wurzel: document.querySelector('[data-admin-bereich="spesen"]'),
      client, verein: VEREIN, fallback, benutzer: aktuellerBenutzer,
    });
    erstelleRegelnEditor({
      wurzel: document.querySelector('[data-admin-bereich="regeln"]'),
      client, verein: VEREIN, benutzer: aktuellerBenutzer,
    });
    erstelleVorlagenEditor({
      wurzel: document.querySelector('[data-admin-bereich="vorlagen"]'),
      client, verein: VEREIN, benutzer: aktuellerBenutzer,
    });
    erstelleUnterlagenEditor({
      wurzel: document.querySelector('[data-admin-bereich="unterlagen"]'),
      client, verein: VEREIN, benutzer: aktuellerBenutzer,
    });
  }
}

document.querySelectorAll("[data-bereich-knopf]").forEach((knopf) => {
  knopf.addEventListener("click", () => {
    const bereich = knopf.dataset.bereichKnopf;
    document.querySelectorAll("[data-bereich-knopf]").forEach((element) => {
      element.setAttribute("aria-pressed", String(element === knopf));
    });
    document.querySelectorAll("[data-admin-bereich]").forEach((element) => {
      element.hidden = element.dataset.adminBereich !== bereich;
    });
    document.querySelector(".admin-bereich-nav").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

async function route() {
  fehler();
  zeige("laden");
  try {
    const stand = await authentifizierungsStand(client);
    if (!stand.angemeldet) {
      zeige("login");
      return;
    }
    aktuellerBenutzer = stand.benutzer;
    if (stand.aal2) {
      await oeffneEditor();
      return;
    }
    if (stand.faktor) {
      aktiverFaktor = stand.faktor.id;
      zeige("totpCode");
      $("totpLoginCode").focus();
      return;
    }

    const enrollment = await totpEinrichten(client, stand.unbestaetigteFaktoren);
    aktiverFaktor = enrollment.id;
    $("totpQr").src = enrollment.totp.qr_code;
    $("totpSecret").textContent = enrollment.totp.secret;
    zeige("totpSetup");
    $("totpSetupCode").focus();
  } catch (error) {
    fehler(error.message || "Anmeldung fehlgeschlagen.");
    zeige("login");
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  fehler();
  const knopf = event.currentTarget.querySelector("button");
  knopf.disabled = true;
  try {
    await mitPasswortAnmelden(client, $("email").value, $("passwort").value);
    $("passwort").value = "";
    await route();
  } catch (error) {
    fehler(error.message || "E-Mail oder Passwort stimmt nicht.");
  } finally {
    knopf.disabled = false;
  }
});

async function codePruefen(input) {
  fehler();
  try {
    await totpBestaetigen(client, aktiverFaktor, input.value);
    input.value = "";
    await route();
  } catch (error) {
    fehler(error.message || "Der 2FAS-Code konnte nicht bestätigt werden.");
  }
}

$("totpSetupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  codePruefen($("totpSetupCode"));
});
$("totpCodeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  codePruefen($("totpLoginCode"));
});

document.querySelectorAll("[data-abmelden]").forEach((knopf) => {
  knopf.addEventListener("click", async () => {
    await abmelden(client);
    window.location.reload();
  });
});

route();
