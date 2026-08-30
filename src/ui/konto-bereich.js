// ============================================================
//  Kontoknopf und Kontomenue in der Kopfleiste
// ============================================================
//  Stand bis zum 30.08.2026 in seite.js. Herausgeloest, weil dort ein
//  zweiter Block dazugekommen waere: das Profil-Menue, das Max von der
//  Quizseite auf die Hauptseite geholt haben wollte.
//
//  Max am 30.08.2026, woertlich: "Dieses 'Angemeldet als Max Mueller' und
//  dieses 'Ausruestung anfragen / Anliegen melden / Meine Anfragen' - das
//  muessen halt alles auch mit auf die Hauptwebseite. Das hat ja mit dem
//  Quiz gar nichts mehr zu tun. Also dieses 'Angemeldet als' kann da
//  eigentlich auch raus, beziehungsweise das Dropdown-Menue kann an sich
//  bleiben. Und den Abmeldebutton wuerde ich hier auch wegnehmen.
//  Vielleicht wenn dann in die Oberleiste mit reinnehmen."
//
//  Genau so ist es jetzt: EIN Menue in der Kopfleiste jeder Vereinsseite,
//  mit dem Namen, dem Weg ins Quiz, den drei Profil-Punkten und dem
//  Abmelden. Auf der Quizseite gibt es weiterhin das Dropdown am
//  "Angemeldet als"-Badge - beide bedienen dieselben Funktionen aus
//  src/features/profile-requests.js, es ist kein zweiter Nachbau.
//
//  Der Knopf wird eingesetzt und steht nicht im HTML: ein Anmeldeknopf,
//  der ohne JavaScript sichtbar waere, aber nichts tun kann, waere
//  schlechter als gar keiner.
// ============================================================

// Nur der Vorname im Knopf: "Maximilian Mustermann" sprengt den Kopf auf
// dem Handy, der volle Name steht im aufgeklappten Menue.
const vorname = (name) => String(name || "").trim().split(/\s+/)[0] || "Mein Konto";

export function montiereKontoBereich({ kopfInnen, anmeldung, loginDialog, profilAktionen = [] }) {
  const bereich = document.createElement("div");
  bereich.className = "konto-bereich";
  bereich.innerHTML = `
    <button class="konto-knopf" type="button" data-konto-knopf aria-expanded="false" aria-haspopup="menu"></button>
    <div class="konto-menue" data-konto-menue role="menu" hidden>
      <div class="konto-menue-kopf"><strong data-konto-name></strong><span>Angemeldet in diesem Tab</span></div>
      <a href="modus.html" role="menuitem">Zum Quiz</a>
      <div data-profil-punkte></div>
      <button type="button" class="konto-abmelden" data-abmelden role="menuitem">Abmelden</button>
    </div>`;
  // Hinter die Navigation: auf breiten Bildschirmen sitzt er damit ganz
  // rechts, auf schmalen schiebt ihn die CSS-Regel vor den Menueknopf.
  kopfInnen.appendChild(bereich);

  const kontoKnopf = bereich.querySelector("[data-konto-knopf]");
  const kontoMenue = bereich.querySelector("[data-konto-menue]");
  const kontoName = bereich.querySelector("[data-konto-name]");
  const punkteBereich = bereich.querySelector("[data-profil-punkte]");

  // ---------- Profil-Punkte ----------
  //
  // Sie stehen zwischen "Zum Quiz" und "Abmelden": das Abmelden bleibt der
  // letzte Eintrag, damit es nicht versehentlich getroffen wird.
  let punktAnzeige = null;
  for (const aktion of profilAktionen) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.setAttribute("role", "menuitem");
    knopf.className = "konto-menue-punkt";
    knopf.append(aktion.text);
    if (aktion.punkt) {
      punktAnzeige = document.createElement("span");
      punktAnzeige.className = "konto-neu";
      punktAnzeige.hidden = true;
      punktAnzeige.title = "Es gibt Neuigkeiten zu deinen Anfragen";
      knopf.appendChild(punktAnzeige);
    }
    knopf.addEventListener("click", () => {
      schliesseKontoMenue();
      aktion.tun();
    });
    punkteBereich.appendChild(knopf);
  }

  function schliesseKontoMenue() {
    kontoMenue.hidden = true;
    kontoKnopf.setAttribute("aria-expanded", "false");
  }

  anmeldung.abonniere((stand) => {
    if (stand) {
      kontoKnopf.innerHTML = '<span class="konto-punkt" aria-hidden="true"></span>';
      kontoKnopf.append(vorname(stand.name));
      kontoKnopf.setAttribute("aria-label", `Angemeldet als ${stand.name || "Mitglied"} – Kontomenü öffnen`);
      kontoName.textContent = stand.name || "Angemeldet";
    } else {
      kontoKnopf.textContent = "Anmelden";
      kontoKnopf.removeAttribute("aria-label");
      setzePunkt(false);
      schliesseKontoMenue();
    }
  });

  kontoKnopf.addEventListener("click", async () => {
    if (anmeldung.istAngemeldet()) {
      const offen = kontoMenue.hidden;
      kontoMenue.hidden = !offen;
      kontoKnopf.setAttribute("aria-expanded", String(offen));
      return;
    }
    await loginDialog.oeffne({
      grund: "Melde dich mit deiner Vereinskennung und deiner PIN an.",
      gastErlaubt: false,
    });
  });

  // Abmelden bleibt hier stehen und laedt die Seite NICHT neu. Genau das
  // war der Fehler auf der Quizseite: dort lud "Abmelden" neu und landete
  // damit wieder in der quiz-eigenen Anmeldemaske (Max: "Das soll halt
  // nicht passieren."). Eine Vereinsseite ist ohne Anmeldung vollstaendig
  // lesbar - man bleibt einfach stehen, wo man ist.
  bereich.querySelector("[data-abmelden]").addEventListener("click", () => {
    anmeldung.abmelden();
    schliesseKontoMenue();
  });

  document.addEventListener("click", (e) => {
    if (kontoMenue.hidden || bereich.contains(e.target)) return;
    schliesseKontoMenue();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") schliesseKontoMenue();
  });

  function setzePunkt(anzeigen) {
    if (punktAnzeige) punktAnzeige.hidden = !anzeigen;
    const punkt = kontoKnopf.querySelector(".konto-punkt");
    if (punkt) punkt.classList.toggle("neu", !!anzeigen);
  }

  return Object.freeze({ setzePunkt });
}
