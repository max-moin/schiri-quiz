import { DATENBANK } from "../../verein.config.js";
import { aktuellesAbo, ausschalten, einschalten, lagebericht } from "../features/push-anmeldung.js";
import { erklaereMitteilungsstatus } from "../features/mitteilungen-status.js";
import { montiereTerminerinnerungen } from "./termin-erinnerungen.js";
import { baueGeraetenameBearbeitung } from "./geraetename-bearbeitung.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung;
const $ = (id) => document.getElementById(id);
const abschnitt = $("mitteilungen-steuerung");
let schluessel = "";
let aktuell = null;
let geraete = [];
let abo = null;
let ladeNummer = 0;
let gespeichert = null;
let speichert = false;
const auswahlIds = ["mitteilungen-feedback", "mitteilungen-quiz-neu", "mitteilungen-quiz-erinnerung", "mitteilungen-termine", "mitteilungen-ausruestung"];

function hatAuswahl() {
  return auswahlIds.some((id) => $(id).checked);
}

function leseAuswahl() {
  return { feedback_antwort: $(auswahlIds[0]).checked, quiz_neu: $(auswahlIds[1]).checked,
    quiz_erinnerung: $(auswahlIds[2]).checked, termine: $(auswahlIds[3]).checked, ausruestung_status: $(auswahlIds[4]).checked };
}

function hatAenderungen() {
  const wahl = leseAuswahl();
  return gespeichert && Object.keys(wahl).some((k) => wahl[k] !== gespeichert[k]);
}

function zeichneAuswahlBedienung() {
  const offen = hatAenderungen();
  $("mitteilungen-auswahl-speichern").disabled = !offen || speichert;
  for (const id of auswahlIds) $(id).disabled = speichert || !gespeichert;
  const empfaengt = abo && geraete.some((g) => g.endpunkt === abo.endpoint);
  $("mitteilungen-abo-knopf").disabled = speichert || offen || (!empfaengt && !hatAuswahl());
  $("mitteilungen-test-knopf").disabled = speichert || offen;
}

function speicherstand(text, zustand = "") {
  $("mitteilungen-speicherstand").textContent = text;
  $("mitteilungen-speicherstand").dataset.zustand = zustand;
}

async function rpc(name, parameter) {
  const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DATENBANK.oeffentlicherSchluessel,
      Authorization: `Bearer ${DATENBANK.oeffentlicherSchluessel}`,
    },
    body: JSON.stringify(parameter),
  });
  const text = await antwort.text();
  if (!antwort.ok) throw new Error("Deine Einstellung konnte gerade nicht geladen oder gespeichert werden.");
  return text ? JSON.parse(text) : null;
}

function parameter(person) {
  return { p_schiedsrichter_id: person.id, p_pin: person.pin };
}

async function bereitschaft(person) {
  const antwort = await fetch("/api/push-bereitschaft", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schiedsrichterId: person.id, pin: person.pin }),
  });
  if (!antwort.ok) throw new Error(antwort.status === 403
    ? "Deine Anmeldung konnte nicht bestätigt werden. Melde dich erneut an."
    : "Der Versandstatus konnte nicht geladen werden. Bitte versuche es erneut.");
  const daten = await antwort.json();
  if (typeof daten?.bereit !== "boolean") throw new Error("Ungültige Antwort beim Prüfen des Versandstatus.");
  return daten;
}

function zeigeVersandstatus(phase) {
  const status = erklaereMitteilungsstatus(lagebericht(), globalThis.Notification?.permission || "default", phase);
  $("mitteilungen-kurzstatus").textContent = status.kurz;
  $("mitteilungen-browser").textContent = status.browser;
  $("mitteilungen-erlaubnis").textContent = status.erlaubnis;
  $("mitteilungen-hinweis").textContent = status.hinweis;
  $("mitteilungen-installieren").hidden = !status.installationZeigen;
  $("mitteilungen-versand").textContent = phase === "pruefen" ? "Wird geprüft …"
    : phase === "fehler" ? "Prüfung fehlgeschlagen" : phase ? "Freigegeben" : "Noch nicht gestartet";
}

function datum(wert) {
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
}

function zeichneGeraete() {
  const liste = $("mitteilungen-geraete");
  liste.replaceChildren();
  if (!geraete.length) {
    const li = document.createElement("li");
    li.textContent = "Noch kein Gerät eingetragen.";
    liste.append(li);
    return;
  }
  for (const g of geraete) {
    const person = aktuell;
    const nummer = ladeNummer;
    const istAktuell = () => nummer === ladeNummer && aktuell?.id === person.id && anmeldung.lesen()?.id === person.id;
    const li = document.createElement("li");
    const beschreibung = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = g.geraet || "Gerät";
    beschreibung.append(name);
    if (abo?.endpoint === g.endpunkt) {
      const aktuellMarke = document.createElement("small");
      aktuellMarke.className = "ist-aktuell";
      aktuellMarke.textContent = "Dieses Gerät";
      beschreibung.append(aktuellMarke);
    }
    const gueltig = document.createElement("small");
    gueltig.textContent = `Bestätigt ${datum(g.zuletzt_bestaetigt)} · gültig bis ${datum(g.gueltig_bis)}`;
    beschreibung.append(gueltig);
    const entfernen = document.createElement("button");
    entfernen.type = "button";
    entfernen.textContent = "Entfernen";
    entfernen.setAttribute("aria-label", `${name.textContent} entfernen`);
    entfernen.addEventListener("click", async () => {
      if (!aktuell) return;
      entfernen.disabled = true;
      try {
        if (abo?.endpoint === g.endpunkt) {
          await ausschalten({ loeschen: ({ endpunkt }) => rpc("push_abo_loeschen", {
            ...parameter(aktuell), p_endpunkt: endpunkt,
          }) });
        } else {
          await rpc("schiri_push_geraet_entfernen", {
            ...parameter(aktuell), p_abo_id: g.id,
          });
        }
        $("mitteilungen-abo-stand").textContent = "Gerät entfernt.";
        await lade(aktuell);
      } catch (fehler) {
        $("mitteilungen-abo-stand").textContent = fehler.message;
        entfernen.disabled = false;
      }
    });
    const umbenennen = baueGeraetenameBearbeitung({
      geraet: g, istAktuell,
      speichern: (neuerName) => rpc("schiri_push_geraet_umbenennen", {
        ...parameter(person), p_abo_id: g.id, p_name: neuerName,
      }),
      umbenannt: (neuerName) => {
        name.textContent = neuerName;
        entfernen.setAttribute("aria-label", `${neuerName} entfernen`);
        $("mitteilungen-abo-stand").textContent = "Gerätename gespeichert.";
      },
    });
    const aktionen = document.createElement("div");
    aktionen.className = "mitteilungen-geraete-aktionen";
    aktionen.append(umbenennen.knopf, entfernen);
    li.append(beschreibung, aktionen, umbenennen.formular);
    liste.append(li);
  }
}

async function lade(person) {
  const nummer = ++ladeNummer;
  const kontoWechsel = aktuell?.id !== person?.id;
  aktuell = person;
  if (kontoWechsel || !gespeichert) abschnitt.hidden = true;
  $("mitteilungen-terminbereich").hidden = true;
  gespeichert = null;
  speichert = false;
  schluessel = "";
  abo = null;
  geraete = [];
  if (!person) { abschnitt.hidden = true; return; }
  zeigeVersandstatus("pruefen");
  $("mitteilungen-speicherstand").textContent = "Einstellungen werden geladen …";
  try {
    const bereit = await bereitschaft(person);
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    if (!bereit.bereit) {
      abschnitt.hidden = true;
      zeigeVersandstatus(false);
      $("mitteilungen-vorschau").textContent = "In Vorbereitung";
      $("mitteilungen-arten-hinweis").textContent = "Diese Themen werden nach der Freigabe einzeln einschaltbar.";
      return;
    }
    if (!bereit.oeffentlicherSchluessel) throw new Error("Die Versandkonfiguration ist unvollständig. Bitte melde das dem Obmann.");
    zeigeVersandstatus(true);
    schluessel = bereit.oeffentlicherSchluessel;
    $("mitteilungen-vorschau").textContent = bereit.modus === "pilot" ? "Pilot"
      : bereit.modus === "einrichtung" ? "Geräte freigegeben" : "Freigegeben";
    $("mitteilungen-arten-hinweis").textContent = "Wähle deine Themen und speichere deine Auswahl.";
    $("mitteilungen-versand").textContent = bereit.modus === "pilot"
      ? "Nur für einen Gerätetest" : bereit.modus === "einrichtung" ? "Gerätetests freigegeben · Erinnerungen noch aus" : "Freigegeben";
    $("mitteilungen-kurzstatus").textContent = bereit.modus === "pilot"
      ? "Testzugang für dieses Konto bereit" : "Persönliche Mitteilungen sind verfügbar";
    $("mitteilungen-hinweis").textContent = "Auswahl speichern, dann dieses Gerät einschalten. Ein Fokus-/Nichtstörmodus kann die Anzeige verzögern.";
    const [einstellungen, browserAbo] = await Promise.all([
      rpc("schiri_push_einstellungen", parameter(person)),
      aktuellesAbo().catch(() => null),
    ]);
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    abo = browserAbo;
    geraete = Array.isArray(einstellungen?.geraete) ? einstellungen.geraete : [];
    const empfaengt = Boolean(abo && geraete.some((g) => g.endpunkt === abo.endpoint));
    const erlaubt = lagebericht();
    $("mitteilungen-feedback").checked = einstellungen?.feedback_antwort === true;
    $("mitteilungen-quiz-neu").checked = einstellungen?.quiz_neu === true;
    $("mitteilungen-quiz-erinnerung").checked = einstellungen?.quiz_erinnerung === true;
    $("mitteilungen-termine").checked = einstellungen?.termine === true;
    $("mitteilungen-ausruestung").checked = einstellungen?.ausruestung_status === true;
    gespeichert = leseAuswahl();
    for (const id of auswahlIds) $(id).disabled = false;
    speicherstand("Deine Auswahl ist gespeichert.");
    $("mitteilungen-abo-stand").textContent = !erlaubt.moeglich ? erlaubt.grund
      : empfaengt ? "Dieses Gerät ist angemeldet."
        : "Dieses Gerät erhält noch keine Mitteilungen.";
    const knopf = $("mitteilungen-abo-knopf");
    knopf.hidden = !erlaubt.moeglich;
    knopf.textContent = empfaengt ? "Auf diesem Gerät ausschalten" : "Auf diesem Gerät einschalten";
    knopf.disabled = !empfaengt && !hatAuswahl();
    $("mitteilungen-test-knopf").hidden = !empfaengt;
    zeichneGeraete();
    // Erst nach den kontoeigenen Daten öffnen: beim Kontowechsel keine alte
    // Geräte-/Themenauswahl kurz sichtbar werden lassen.
    abschnitt.hidden = false;
    zeichneAuswahlBedienung();
    $("mitteilungen-terminbereich").hidden = false;
    void montiereTerminerinnerungen($("mitteilungen-terminliste"), person, {
      istAktuell: () => nummer === ladeNummer && anmeldung.lesen()?.id === person.id,
      status: $("mitteilungen-terminstand"),
    });
  } catch (fehler) {
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    zeigeVersandstatus("fehler");
    abschnitt.hidden = true;
    $("mitteilungen-hinweis").textContent = fehler.message;
    $("mitteilungen-speicherstand").textContent = fehler.message;
    for (const id of auswahlIds) $(id).disabled = true;
  }
}

// Keine RPC und kein Neuladen beim Anklicken. Die fünf Werte werden
// zusammen in EINER Datenbanktransaktion gespeichert.
for (const id of auswahlIds) $(id)?.addEventListener("change", () => {
  if (!aktuell || !gespeichert) return;
  speicherstand(hatAenderungen() ? "Noch nicht gespeichert. Drücke „Auswahl speichern“." : "Deine Auswahl ist gespeichert.");
  zeichneAuswahlBedienung();
});

$("mitteilungen-auswahl-speichern")?.addEventListener("click", async () => {
  if (!aktuell || speichert || !hatAenderungen()) return;
  const person = aktuell;
  const nummer = ladeNummer;
  const wahl = leseAuswahl();
  speichert = true;
  zeichneAuswahlBedienung();
  speicherstand("Wird gespeichert …");
  try {
    await rpc("schiri_push_auswahl_v2_setzen", { ...parameter(person),
      p_feedback_antwort: wahl.feedback_antwort, p_quiz_neu: wahl.quiz_neu,
      p_quiz_erinnerung: wahl.quiz_erinnerung, p_termine: wahl.termine, p_ausruestung_status: wahl.ausruestung_status });
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    gespeichert = wahl;
    speicherstand("Deine Auswahl ist gespeichert.", "erfolg");
    void montiereTerminerinnerungen($("mitteilungen-terminliste"), person, {
      istAktuell: () => nummer === ladeNummer && anmeldung.lesen()?.id === person.id,
      status: $("mitteilungen-terminstand"),
    });
  } catch (fehler) {
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    speicherstand(`${fehler.message} Deine Auswahl bleibt erhalten; versuche es erneut.`, "fehler");
  } finally {
    if (nummer === ladeNummer) { speichert = false; zeichneAuswahlBedienung(); }
  }
});

$("mitteilungen-abo-knopf")?.addEventListener("click", async (event) => {
  if (!aktuell || speichert || hatAenderungen()) return;
  const person = aktuell;
  const knopf = event.currentTarget;
  knopf.disabled = true;
  try {
    if (abo && geraete.some((g) => g.endpunkt === abo.endpoint)) {
      await ausschalten({ loeschen: ({ endpunkt }) => rpc("push_abo_loeschen", {
        ...parameter(person), p_endpunkt: endpunkt,
      }) });
    } else {
      // WICHTIG: einschalten() beginnt innerhalb derselben Tippgeste mit
      // requestPermission(). Davor hier keine asynchrone Arbeit.
      await einschalten({ oeffentlicherSchluessel: schluessel,
        speichern: (daten) => rpc("push_abo_speichern", {
          ...parameter(person), p_endpunkt: daten.endpunkt, p_p256dh: daten.p256dh,
          p_auth: daten.auth, p_geraet: daten.geraet,
        }),
      });
    }
    await lade(person);
  } catch (fehler) {
    $("mitteilungen-abo-stand").textContent = fehler.message;
    knopf.disabled = false;
  }
});

$("mitteilungen-test-knopf")?.addEventListener("click", async (event) => {
  if (!aktuell || !abo || speichert || hatAenderungen()) return;
  const knopf = event.currentTarget;
  knopf.disabled = true;
  $("mitteilungen-abo-stand").textContent = "Testmitteilung wird gesendet …";
  try {
    const antwort = await fetch("/api/push-test", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schiedsrichterId: aktuell.id, pin: aktuell.pin, endpunkt: abo.endpoint }),
    });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten.fehler || "Test nicht möglich.");
    $("mitteilungen-abo-stand").textContent = "Test verschickt. Prüfe die Mitteilung auf diesem Gerät.";
  } catch (fehler) {
    $("mitteilungen-abo-stand").textContent = fehler.message;
  } finally { knopf.disabled = false; }
});

$("mitteilungen-status-neuladen")?.addEventListener("click", async (event) => {
  const person = anmeldung?.lesen();
  if (!person) return;
  if (hatAenderungen() && !confirm("Ungespeicherte Auswahl verwerfen und den Status neu laden?")) return;
  const knopf = event.currentTarget;
  knopf.disabled = true;
  try { await lade(person); } finally { knopf.disabled = false; }
});

globalThis.addEventListener("beforeunload", (event) => {
  if (!hatAenderungen()) return;
  event.preventDefault(); event.returnValue = "";
});

anmeldung?.abonniere((person) => { void lade(person); });
