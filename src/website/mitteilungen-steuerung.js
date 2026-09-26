import { DATENBANK } from "../../verein.config.js";
import { aktuellesAbo, ausschalten, einschalten, lagebericht } from "../features/push-anmeldung.js";

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung;
const $ = (id) => document.getElementById(id);
const abschnitt = $("mitteilungen-steuerung");
let schluessel = "";
let aktuell = null;
let geraete = [];
let abo = null;
let ladeNummer = 0;
const auswahlIds = ["mitteilungen-feedback", "mitteilungen-quiz-neu", "mitteilungen-quiz-erinnerung", "mitteilungen-termine"];

function hatAuswahl() {
  return auswahlIds.some((id) => $(id).checked);
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
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schiedsrichterId: person.id, pin: person.pin }),
  });
  if (!antwort.ok) return { bereit: false };
  return antwort.json();
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
    li.append(beschreibung, entfernen);
    liste.append(li);
  }
}

async function lade(person) {
  const nummer = ++ladeNummer;
  aktuell = person;
  abschnitt.hidden = true;
  schluessel = "";
  abo = null;
  geraete = [];
  if (!person) return;
  $("mitteilungen-speicherstand").textContent = "Einstellungen werden geladen …";
  try {
    const bereit = await bereitschaft(person);
    if (nummer !== ladeNummer || anmeldung.lesen()?.id !== person.id) return;
    if (!bereit.bereit || !bereit.oeffentlicherSchluessel) return;
    schluessel = bereit.oeffentlicherSchluessel;
    abschnitt.hidden = false;
    $("mitteilungen-vorschau").textContent = bereit.modus === "pilot" ? "Pilot" : "Teilweise verfügbar";
    $("mitteilungen-arten-hinweis").textContent = "Wähle selbst, wofür du Hinweise erhalten möchtest.";
    $("mitteilungen-versand").textContent = bereit.modus === "pilot"
      ? "Nur für einen Gerätetest" : "Freigegeben";
    $("mitteilungen-kurzstatus").textContent = bereit.modus === "pilot"
      ? "Testzugang für dieses Konto bereit" : "Persönliche Mitteilungen sind verfügbar";
    $("mitteilungen-hinweis").textContent = "Wähle unten ein Thema und aktiviere dieses Gerät ausdrücklich.";
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
    for (const id of auswahlIds) $(id).disabled = false;
    $("mitteilungen-speicherstand").textContent = "Deine Auswahl ist gespeichert.";
    $("mitteilungen-abo-stand").textContent = !erlaubt.moeglich ? erlaubt.grund
      : empfaengt ? "Dieses Gerät ist angemeldet."
        : "Dieses Gerät erhält noch keine Mitteilungen.";
    const knopf = $("mitteilungen-abo-knopf");
    knopf.hidden = !erlaubt.moeglich;
    knopf.textContent = empfaengt ? "Auf diesem Gerät ausschalten" : "Auf diesem Gerät einschalten";
    knopf.disabled = !empfaengt && !hatAuswahl();
    $("mitteilungen-test-knopf").hidden = !empfaengt;
    zeichneGeraete();
  } catch (fehler) {
    $("mitteilungen-speicherstand").textContent = fehler.message;
    for (const id of auswahlIds) $(id).disabled = true;
  }
}

$("mitteilungen-feedback")?.addEventListener("change", async (event) => {
  if (!aktuell) return;
  const feld = event.currentTarget;
  const neuerStand = feld.checked;
  feld.disabled = true;
  $("mitteilungen-speicherstand").textContent = "Wird gespeichert …";
  try {
    await rpc("schiri_push_feedback_setzen", { ...parameter(aktuell), p_aktiv: neuerStand });
    await lade(aktuell);
  } catch (fehler) {
    feld.checked = !neuerStand;
    feld.disabled = false;
    $("mitteilungen-speicherstand").textContent = fehler.message;
  }
});

for (const id of ["mitteilungen-quiz-neu", "mitteilungen-quiz-erinnerung"]) {
  $(id)?.addEventListener("change", async (event) => {
    if (!aktuell) return;
    const person = aktuell;
    const feld = event.currentTarget;
    const alterStand = !feld.checked;
    for (const auswahlId of auswahlIds) $(auswahlId).disabled = true;
    $("mitteilungen-speicherstand").textContent = "Wird gespeichert …";
    try {
      await rpc("schiri_push_quiz_setzen", {
        ...parameter(person),
        p_quiz_neu: $("mitteilungen-quiz-neu").checked,
        p_quiz_erinnerung: $("mitteilungen-quiz-erinnerung").checked,
      });
      await lade(person);
    } catch (fehler) {
      feld.checked = alterStand;
      for (const auswahlId of auswahlIds) $(auswahlId).disabled = false;
      $("mitteilungen-speicherstand").textContent = fehler.message;
    }
  });
}

$("mitteilungen-termine")?.addEventListener("change", async (event) => {
  if (!aktuell) return;
  const person = aktuell;
  const feld = event.currentTarget;
  const neuerStand = feld.checked;
  for (const auswahlId of auswahlIds) $(auswahlId).disabled = true;
  $("mitteilungen-speicherstand").textContent = "Wird gespeichert …";
  try {
    await rpc("schiri_push_termine_setzen", { ...parameter(person), p_aktiv: neuerStand });
    await lade(person);
  } catch (fehler) {
    feld.checked = !neuerStand;
    for (const auswahlId of auswahlIds) $(auswahlId).disabled = false;
    $("mitteilungen-speicherstand").textContent = fehler.message;
  }
});

$("mitteilungen-abo-knopf")?.addEventListener("click", async (event) => {
  if (!aktuell) return;
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
  if (!aktuell || !abo) return;
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

anmeldung?.abonniere((person) => { void lade(person); });
