// ============================================================
//  "Das steht an" - das wechselnde Band oben auf der Startseite
// ============================================================
//  Max am 12.09.2026:
//  "dass man die Webseite auch dynamisch gestalten kann - zum Beispiel
//   gleich am Anfang, wenn in den naechsten 34 Tagen ein Schiri-Treff
//   ansteht, dass man das per Bild so als News anfaengt, so wie bei
//   Netflix der neueste Film, und dass da die fuenf neuesten Nachrichten
//   durchlaufen, alle 10 Sekunden das Bild wechselt und man dadurch
//   daran erinnert wird."
//
//  Zwei Entscheidungen, die das von einem Werbebanner unterscheiden:
//
//  1. NUR DATIERTES. Das Band zeigt ausschliesslich Termine, die
//     wirklich anstehen. Kein "Schiri werden!" als Fuellmaterial - ein
//     Band, in dem auch Dauerwerbung laeuft, wird nach zwei Wochen
//     genauso uebersehen wie ein Banner. Steht nichts an, ist das Band
//     gar nicht da. Das ist kein Mangel, das ist die Aussage.
//
//  2. ES DARF NICHT NERVEN. Bewegung, die man nicht anhalten kann, ist
//     ein Barrierefreiheitsfehler (WCAG 2.2.2 "Pause, Stop, Hide" -
//     alles, was laenger als fuenf Sekunden automatisch laeuft, braucht
//     eine Pause). Deshalb: ein beschrifteter Pause-Knopf, Anhalten beim
//     Ueberfahren und beim Tastaturfokus, und bei
//     "prefers-reduced-motion" laeuft von vornherein nichts - dann
//     stehen alle Karten untereinander als schlichte Liste.
// ============================================================

import { holeOeffentlicheTermine } from "./oeffentliche-termine.js";

// Max nannte "34 Tage" - gemeint war ungefaehr der naechste Monat.
const VORSCHAU_TAGE = 40;
const HOECHSTENS = 5;
const WECHSEL_MS = 9000;

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch",
  "Donnerstag", "Freitag", "Samstag"];

// Die Motive, die es im Repo wirklich gibt. Kein Bild zu erfinden ist
// billiger als eines, das ins Leere zeigt.
const MOTIVE = [
  [/regel|lehr|schulung|theorie/i, "bilder/motiv-regeln.svg"],
  [/quiz|test|pruefung|prüfung/i, "bilder/motiv-quiz.svg"],
  [/ausrüstung|ausruestung|trikot|kleidung/i, "bilder/motiv-ausruestung.svg"],
  [/spesen|abrechnung|quittung/i, "bilder/motiv-spesen.svg"],
];
const MOTIV_STANDARD = "bilder/motiv-dokumente.svg";

function motivFuer(termin) {
  const text = `${termin.titel || ""} ${termin.art || ""} ${termin.beschreibung || ""}`;
  for (const [muster, bild] of MOTIVE) if (muster.test(text)) return bild;
  return MOTIV_STANDARD;
}

// "Übermorgen" trifft besser als "in 2 Tagen" - so redet man ueber
// Termine. Ab einer Woche wird der Wochentag wichtiger als die Zahl.
function abstandInWorten(tage, datum) {
  if (tage <= 0) return "Heute";
  if (tage === 1) return "Morgen";
  if (tage === 2) return "Übermorgen";
  if (tage <= 6) return `${WOCHENTAGE[datum.getDay()]}, in ${tage} Tagen`;
  if (tage <= 13) return "Nächste Woche";
  return `In ${Math.round(tage / 7)} Wochen`;
}

function datumInWorten(datum) {
  return `${WOCHENTAGE[datum.getDay()]}, ${datum.getDate()}. ${MONATE[datum.getMonth()]}`;
}

export function baueMeldungen(termine, heute = new Date()) {
  const start = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  return (Array.isArray(termine) ? termine : [])
    .map((t) => {
      if (!t || typeof t.titel !== "string" || !t.titel.trim()) return null;
      const datum = new Date(`${String(t.datum)}T12:00:00`);
      if (Number.isNaN(datum.getTime())) return null;
      /* Beide Seiten auf Mitternacht bringen, bevor gerechnet wird.
         Vorher stand hier die Differenz zwischen Mittag und Mitternacht:
         das sind 0,5 Tage, und Math.round(0.5) ist 1 - der heutige
         Termin wurde also als "Morgen" angekuendigt. Der Mittag im
         Datum bleibt, er faengt die Sommerzeitumstellung ab. */
      const tagesbeginn = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
      const tage = Math.round((tagesbeginn - start) / 86400000);
      if (tage < 0 || tage > VORSCHAU_TAGE) return null;
      return {
        id: t.id || null,
        titel: t.titel.trim(),
        wann: abstandInWorten(tage, datum),
        datum: datumInWorten(datum),
        zeit: typeof t.beginn_zeit === "string" ? t.beginn_zeit.slice(0, 5) : "",
        ort: typeof t.ort === "string" ? t.ort.trim() : "",
        pflicht: t.pflicht === true,
        bild: motivFuer(t),
        ziel: t.id ? `termine.html#termin-${t.id}` : "termine.html",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.datum > b.datum ? 1 : -1))
    .slice(0, HOECHSTENS);
}

function karteHtml(m, nummer, gesamt) {
  const zeilen = [m.datum, m.zeit ? `${m.zeit} Uhr` : "", m.ort].filter(Boolean).join(" · ");
  return `<article class="aktuelles-karte" role="group"
      aria-label="Meldung ${nummer} von ${gesamt}: ${m.titel}">
      <div class="aktuelles-bild"><img src="${m.bild}" alt="" loading="lazy"></div>
      <div class="aktuelles-text">
        <p class="aktuelles-wann">${m.wann}${m.pflicht ? ' <span class="aktuelles-pflicht">Pflicht</span>' : ""}</p>
        <h3>${m.titel}</h3>
        <p class="aktuelles-wo">${zeilen}</p>
        <a class="aktuelles-weg" href="${m.ziel}">Zum Termin</a>
      </div>
    </article>`;
}

export async function montiereAktuelles(halter) {
  if (!halter) return null;
  const meldungen = baueMeldungen(await holeOeffentlicheTermine());
  if (!meldungen.length) return null;

  const reduziert = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
  const gesamt = meldungen.length;

  halter.hidden = false;
  halter.innerHTML = `
    <div class="abschnitt-kopf">
      <h2>Das steht an</h2>
      <a class="mehr" href="termine.html">Alle Termine</a>
    </div>
    <div class="aktuelles-buehne" data-buehne>
      ${meldungen.map((m, i) => karteHtml(m, i + 1, gesamt)).join("")}
    </div>
    <div class="aktuelles-leiste" data-leiste hidden>
      <button type="button" class="aktuelles-schalter" data-schalter></button>
      <div class="aktuelles-punkte" data-punkte role="tablist" aria-label="Meldung wählen"></div>
    </div>`;

  const buehne = halter.querySelector("[data-buehne]");
  const karten = [...buehne.querySelectorAll(".aktuelles-karte")];

  // Nur EINE Karte? Dann gibt es nichts zu wechseln - kein Karussell,
  // keine Punkte, kein Schalter. Eine Bedienung fuer nichts ist Ballast.
  if (gesamt < 2) return halter;

  // Bewegung abgelehnt: alle Karten bleiben stehen, untereinander. Das
  // ist die ehrliche Fassung - nicht eine Karte zeigen und die anderen
  // verstecken, denn dann fehlt Inhalt.
  if (reduziert?.matches) {
    buehne.classList.add("aktuelles-gestapelt");
    return halter;
  }

  const leiste = halter.querySelector("[data-leiste]");
  const schalter = halter.querySelector("[data-schalter]");
  const punkte = halter.querySelector("[data-punkte]");
  leiste.hidden = false;

  meldungen.forEach((m, i) => {
    const punkt = document.createElement("button");
    punkt.type = "button";
    punkt.className = "aktuelles-punkt";
    punkt.setAttribute("role", "tab");
    punkt.setAttribute("aria-label", `Meldung ${i + 1} von ${gesamt}: ${m.titel}`);
    punkt.addEventListener("click", () => { zeige(i); anhalten(true); });
    punkte.appendChild(punkt);
  });
  const punktListe = [...punkte.children];

  let jetzt = 0;
  let uhr = null;
  let angehalten = false;

  function zeige(index) {
    jetzt = (index + gesamt) % gesamt;
    karten.forEach((k, i) => { k.hidden = i !== jetzt; });
    punktListe.forEach((p, i) => {
      p.setAttribute("aria-selected", String(i === jetzt));
      p.classList.toggle("ist-jetzt", i === jetzt);
    });
  }

  function starten() {
    if (uhr || angehalten) return;
    uhr = setInterval(() => zeige(jetzt + 1), WECHSEL_MS);
  }
  function stoppen() { if (uhr) { clearInterval(uhr); uhr = null; } }

  // "angehalten" ist die ausdrueckliche Entscheidung der Person und
  // ueberlebt das Ueberfahren mit der Maus. Ohne diese Trennung wuerde
  // ein Mausbewegung die Pause wieder aufheben.
  function anhalten(fest) {
    angehalten = fest;
    stoppen();
    beschrifteSchalter();
    if (!fest) starten();
  }
  function beschrifteSchalter() {
    schalter.textContent = angehalten ? "Weiterlaufen lassen" : "Anhalten";
    schalter.setAttribute("aria-pressed", String(angehalten));
  }

  schalter.addEventListener("click", () => anhalten(!angehalten));

  // Beim Ueberfahren und beim Tastaturfokus pausiert es, ohne den
  // Schalter umzustellen: wer gerade liest, soll nicht ueberholt werden.
  halter.addEventListener("mouseenter", stoppen);
  halter.addEventListener("mouseleave", starten);
  halter.addEventListener("focusin", stoppen);
  halter.addEventListener("focusout", starten);

  halter.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { zeige(jetzt + 1); anhalten(true); }
    else if (e.key === "ArrowLeft") { zeige(jetzt - 1); anhalten(true); }
  });

  // Wischen auf dem Handy. Nur waagerecht und erst ab 40px, damit das
  // Scrollen der Seite nicht abgefangen wird.
  let startX = null, startY = null;
  buehne.addEventListener("pointerdown", (e) => { startX = e.clientX; startY = e.clientY; });
  buehne.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 2) {
      zeige(jetzt + (dx < 0 ? 1 : -1));
      anhalten(true);
    }
  });

  // Aendert jemand die Einstellung waehrend die Seite offen ist, gilt
  // sie sofort - nicht erst beim naechsten Besuch.
  reduziert?.addEventListener?.("change", (e) => { if (e.matches) anhalten(true); });

  zeige(0);
  beschrifteSchalter();
  starten();
  return halter;
}
