// ============================================================
//  Der Schalter fuer Benachrichtigungen auf installieren.html
// ============================================================
//  Er steht bewusst HIER und nicht im Kontomenue: auf dem iPhone
//  funktionieren Benachrichtigungen ueberhaupt erst, wenn die Seite auf
//  dem Home-Bildschirm liegt. Wer gerade die Installationsanleitung
//  gelesen hat, ist genau die Person, bei der es klappen kann - und
//  wer es noch nicht installiert hat, liest die Begruendung direkt
//  darueber.
//
//  SPERRE: Steht in verein.config.js kein oeffentlicher Schluessel,
//  wird hier gar nichts gebaut. Kein zweites Ja/Nein-Feld, das man
//  vergessen koennte - ohne Schluessel gibt es keinen Absender, also
//  auch keinen Schalter.
// ============================================================

import { DATENBANK, VEREIN } from "../../verein.config.js";
import { lagebericht, aktuellesAbo, einschalten, ausschalten, imAppModus } from "../features/push-anmeldung.js";

const SCHLUESSEL = VEREIN.push?.oeffentlicherSchluessel || "";

async function rpc(name, parameter) {
  const antwort = await fetch(`${DATENBANK.adresse}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: DATENBANK.oeffentlicherSchluessel,
      Authorization: `Bearer ${DATENBANK.oeffentlicherSchluessel}`,
    },
    body: JSON.stringify(parameter || {}),
  });
  const text = await antwort.text();
  if (!antwort.ok) {
    let meldung = "Der Server ist gerade nicht erreichbar.";
    try { meldung = JSON.parse(text).message || meldung; } catch { /* Standardmeldung */ }
    throw new Error(meldung);
  }
  return text ? JSON.parse(text) : null;
}

export function montierePushSchalter(halter, anmeldung, loginDialog) {
  if (!halter || !SCHLUESSEL) return null;

  const lage = lagebericht();
  halter.hidden = false;
  halter.innerHTML = `
    <h2>Benachrichtigungen</h2>
    <p class="push-erklaerung">Ein kurzer Hinweis, wenn die Fragen der Woche da sind, ein Termin ansteht oder der Obmann auf dein Anliegen geantwortet hat. Mehr nicht – und du kannst es jederzeit wieder abschalten.</p>
    <p class="push-stand" data-stand role="status"></p>
    <div class="push-aktion" data-aktion></div>`;

  const stand = halter.querySelector("[data-stand]");
  const aktion = halter.querySelector("[data-aktion]");

  const melde = (text) => { stand.textContent = text; };

  function knopf(beschriftung, aufTippen) {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "push-knopf";
    k.textContent = beschriftung;
    k.addEventListener("click", async () => {
      k.disabled = true;
      try { await aufTippen(); } finally { k.disabled = false; }
    });
    aktion.replaceChildren(k);
    return k;
  }

  async function zeichne() {
    aktion.replaceChildren();

    if (!lage.moeglich) {
      melde(lage.grund);
      if (lage.hinweis === "installieren") {
        const hinweis = document.createElement("p");
        hinweis.className = "push-kleingedruckt";
        hinweis.textContent = "Die Anleitung dafür steht direkt über diesem Abschnitt.";
        aktion.replaceChildren(hinweis);
      }
      return;
    }

    const person = anmeldung?.lesen();
    if (!person) {
      melde("Melde dich zuerst an – wir müssen wissen, wen wir benachrichtigen.");
      knopf("Anmelden", async () => {
        const e = await loginDialog?.oeffne({
          grund: "Für Benachrichtigungen brauchst du deine Anmeldung.",
          gastErlaubt: false,
        });
        if (e?.status === "angemeldet") zeichne();
      });
      return;
    }

    const abo = await aktuellesAbo().catch(() => null);
    // Der Browser weiss nur, ob ER ein Abo hat. Ob wir die Adresse auch
    // gespeichert haben, weiss nur der Server - beides kann
    // auseinanderlaufen (Tabelle aufgeraeumt, Geraet zurueckgesetzt).
    // Deshalb wird beides gefragt und das Ergebnis UND-verknuepft.
    let beiUnsBekannt = false;
    if (abo) {
      beiUnsBekannt = await rpc("push_abo_status", {
        p_schiedsrichter_id: person.id, p_pin: person.pin, p_endpunkt: abo.endpoint,
      }).then((a) => a?.angemeldet === true).catch(() => false);
    }

    if (abo && beiUnsBekannt) {
      melde(`Dieses Gerät bekommt Benachrichtigungen${imAppModus() ? "" : " (im Browser)"}.`);
      knopf("Benachrichtigungen ausschalten", async () => {
        melde("Wird abgeschaltet …");
        try {
          await ausschalten({
            loeschen: ({ endpunkt }) => rpc("push_abo_loeschen", {
              p_schiedsrichter_id: person.id, p_pin: person.pin, p_endpunkt: endpunkt,
            }),
          });
          await zeichne();
        } catch (fehler) { melde(fehler.message); }
      });
      return;
    }

    melde("Dieses Gerät bekommt noch keine Benachrichtigungen.");
    // Der Aufruf MUSS in der Tippgeste bleiben: iOS lehnt eine
    // Erlaubnisabfrage ab, die nicht direkt aus einer Berührung kommt.
    knopf("Benachrichtigungen einschalten", async () => {
      try {
        await einschalten({
          oeffentlicherSchluessel: SCHLUESSEL,
          speichern: (daten) => rpc("push_abo_speichern", {
            p_schiedsrichter_id: person.id,
            p_pin: person.pin,
            p_endpunkt: daten.endpunkt,
            p_p256dh: daten.p256dh,
            p_auth: daten.auth,
            p_geraet: daten.geraet,
          }),
        });
        await zeichne();
      } catch (fehler) { melde(fehler.message); }
    });
  }

  zeichne();
  anmeldung?.abonniere?.(() => zeichne());
  return halter;
}
