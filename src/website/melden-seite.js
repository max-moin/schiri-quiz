// ============================================================
//  melden.html - der Meldebogen
// ============================================================
//  Rückmeldungen und Ideen, die bisher alle im selben Kanal gelandet waeren
//  ("schreib dem Obmann eine WhatsApp"): Treff-Themen, Regelfaelle,
//  Vorfaelle, Gespraechswuensche und Hinweise zur Website. Sie brauchen
//  unterschiedliche Angaben und vor allem unterschiedliche Zusagen -
//  deshalb erst die Art, dann die Felder (siehe melden-arten.js).
//
//  ------------------------------------------------------------
//  ANMELDUNG JE NACH MELDEART
//  ------------------------------------------------------------
//  Website-Feedback ist über eine serverseitig begrenzte Gast-API offen.
//  Andere Meldearten benötigen weiterhin eine Anmeldung. Gesprächswünsche
//  werden mit Personenkennung gespeichert; Website/Vorfall optional ohne.
//
//  ------------------------------------------------------------
//  WAS "ANONYM" HIER HEISST - und was nicht
//  ------------------------------------------------------------
//  Nirgends steht "wird anonymisiert gespeichert". Das waere zu freundlich
//  formuliert fuer das, was passiert: Der Server verwirft die
//  Personenkennung, BEVOR der Datensatz angelegt wird. Danach fuehrt aus
//  dem Datensatz kein Weg zurueck - auch nicht fuer Max, auch nicht fuer
//  eine Rueckfrage. Genau das steht am Ankreuzfeld, denn wer anonym
//  meldet und dann auf eine Antwort wartet, ist schlechter dran als
//  jemand, der es vorher wusste.
//
//  ------------------------------------------------------------
//  DER DATENSCHUTZHINWEIS STEHT AM FELD
//  ------------------------------------------------------------
//  Nicht unten im Kleingedruckten, sondern direkt bei "Wer war
//  beteiligt?" - das ist die Stelle, an der jemand gerade dabei ist,
//  Angaben ueber Dritte einzutippen. Der lange Text dazu steht in
//  datenschutz.html (Punkt 13 und 14) und wird hier verlinkt statt
//  wiederholt: zwei Fassungen desselben Versprechens laufen auseinander.
// ============================================================

import { DATENBANK, VEREIN } from "../../verein.config.js";
import {
  MELDE_ARTEN,
  MELDE_FELDER,
  GRENZE_SITUATION,
  findeArt,
  felderFuer,
  erlaubtAnonym,
  beschriftungFuer,
  baueParameter,
} from "./melden-arten.js";

const bereich = document.getElementById("meldenBereich");

const anmeldung = globalThis.SchiriSeitenAnmeldung?.anmeldung || null;
const loginDialog = globalThis.SchiriSeitenAnmeldung?.loginDialog || null;
const zaehlwerkModul = globalThis.SchiriZeichenZaehler || null;

const server = globalThis.SchiriRpc
  ? globalThis.SchiriRpc.erstelleRpc({
      adresse: DATENBANK.adresse,
      oeffentlicherSchluessel: DATENBANK.oeffentlicherSchluessel,
    })
  : null;

const person = () => anmeldung?.lesen() || null;

let gewaehlteArt = null;

// ---------- kleine Bausteine ----------

function el(tag, klasse, text) {
  const knoten = document.createElement(tag);
  if (klasse) knoten.className = klasse;
  if (text !== undefined && text !== null) knoten.textContent = text;
  return knoten;
}

function absatz(klasse, text) {
  return el("p", klasse, text);
}

// ---------- Symbole vor den Arten ----------
//  Max am 12.09.2026: "Bei Ideen und Feedback noch ein passendes Icon
//  immer davor."
//
//  Gezeichnet statt Emoji: Ein Emoji sieht auf jedem Betriebssystem
//  anders aus (ein Schild ist mal blau, mal grau, mal eine Wappenform),
//  laesst sich nicht einfaerben und wird von Vorleseprogrammen als Wort
//  vorgelesen. Diese SVGs erben ueber "currentColor" die Farbe der Karte
//  und aendern sich mit ihr, wenn die Art gewaehlt ist.
//
//  Das Symbol ERSETZT kein Wort. Der Titel bleibt in jedem Fall stehen -
//  ein Symbol allein ist eine Rateaufgabe (derselbe Grundsatz wie bei
//  ".sym-wort" in stil/bausteine.css). Deshalb steht das SVG auf
//  aria-hidden: der Titel daneben sagt schon alles, sonst hoerte man die
//  Zeile doppelt.
//
//  Warum hier und nicht in melden-arten.js: Dort steht laut Kopf jener
//  Datei ausdruecklich "nur die Regel, keine Darstellung". Ein Icon ist
//  Darstellung.
const ART_SYMBOLE = {
  // Zwei Personen - der Treff ist die Runde, nicht der Termin.
  treff: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.5-3.4 2.6-5 5.5-5s5 1.6 5.5 5"/><path d="M16 6.2a2.8 2.8 0 0 1 0 5.3"/><path d="M17 14.2c2 .6 3.2 2.2 3.5 4.8"/></svg>',
  // Aufgeschlagenes Regelbuch - "war das richtig so?" ist eine Regelfrage.
  regelfall: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 6.5C10.3 5.2 8.2 4.6 5 4.6v12c3.2 0 5.3.6 7 1.9 1.7-1.3 3.8-1.9 7-1.9v-12c-3.2 0-5.3.6-7 1.9z"/><path d="M12 6.5v11.9"/></svg>',
  // Schild - bewusst Schutz und nicht ein Warndreieck: Wer einen Vorfall
  // meldet, soll nicht als das Problem angesprochen werden.
  vorfall: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3.2 5 5.8v5.4c0 4 2.9 7.1 7 9.6 4.1-2.5 7-5.6 7-9.6V5.8z"/><path d="M12 9.2v4"/><path d="M12 16.2v.1"/></svg>',
  // Sprechblase - "ich moechte einfach mal reden".
  gespraech: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M20 12.4c0 3.5-3.6 6.3-8 6.3-.9 0-1.8-.1-2.6-.3L4.6 20l.9-3.1C4.6 15.7 4 14.1 4 12.4 4 8.9 7.6 6 12 6s8 2.9 8 6.4z"/></svg>',
  // Bildschirm mit Fensterleiste - es geht um diese Website selbst.
  website: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><rect x="3" y="4.5" width="18" height="13" rx="1.8"/><path d="M3 8.5h18"/><path d="M12 17.5V21"/><path d="M9 21h6"/></svg>',
  // Blatt mit Stift - die Quizfrage wird ausgearbeitet, nicht nur genannt.
  // Kein Eintrag aus MELDE_ARTEN, aber dieselbe Kachelreihe: ohne Symbol
  // waere sie die einzige nackte Kachel der Gruppe.
  quizfrage: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M13.5 3.5H6.8A1.8 1.8 0 0 0 5 5.3v13.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-6.2"/><path d="M8 13.8h5.5M8 16.8h3.5"/><path d="m16.8 4.1 3.1 3.1-4.6 4.6-3.6.5.5-3.6z"/></svg>',
};

/**
 * Der Kartentitel: Symbol davor, Wort dahinter.
 *
 * Das Symbol steckt in einem eigenen Halter mit fester Breite, damit die
 * Beschriftung daneben umbrechen darf, ohne dass die Zeichnung mitschrumpft
 * oder in die naechste Zeile rutscht (360-px-Geraete).
 */
function titelMitSymbol(schluessel, titel) {
  const zeile = el("span", "melden-art-titel");
  const zeichnung = ART_SYMBOLE[schluessel];
  if (zeichnung) {
    const halter = el("span", "melden-art-symbol");
    // Fester Text aus dieser Datei, keine Eingabe von aussen.
    halter.innerHTML = zeichnung;
    zeile.appendChild(halter);
  }
  zeile.appendChild(el("span", "melden-art-titel-wort", titel));
  return zeile;
}

// ---------- Nicht angemeldet: der Weg dorthin, keine Fehlermeldung ----------

function zeichneAnmeldeAufforderung() {
  bereich.replaceChildren();
  bereich.append(
    el("h1", "seiten-titel", "Ideen & Feedback"),
    absatz("seiten-unter",
      "Treff-Idee, Regelfall, Vorfall, Gesprächswunsch oder Website-Feedback – "
      + "hier kommt es beim Schiedsrichter-Obmann an.")
  );

  const karte = el("div", "melden-karte");
  karte.append(
    el("h2", null, "Dafür brauchst du deine Anmeldung"),
    absatz(null,
      "Für Regelfälle, Vorfälle und Gesprächswünsche brauchst du deine Anmeldung. "
      + "Website-Feedback kannst du auch ohne Anmeldung senden."),
    absatz("melden-hinweis-leise",
      "Auch eine anonyme Meldung braucht sie. Gespeichert wird deine Kennung "
      + "dabei trotzdem nicht: Bei einer anonymen Meldung verwirft der Server sie, "
      + "bevor der Datensatz angelegt wird.")
  );

  const knopf = el("button", "melden-anmelden", "Anmelden");
  knopf.type = "button";
  knopf.addEventListener("click", async () => {
    const ergebnis = await loginDialog?.oeffne({
      grund: "Für den Meldebogen brauchst du deine Anmeldung.",
      gastErlaubt: false,
    });
    if (ergebnis?.status === "angemeldet") starte();
  });
  karte.appendChild(knopf);
  bereich.appendChild(karte);
}

// ---------- Angemeldet: erst die Art ----------

function zeichneGeruest() {
  bereich.replaceChildren();
  bereich.append(
    el("h1", "seiten-titel", "Ideen & Feedback"),
    absatz("seiten-unter", "Möchtest du etwas mitgestalten oder eine Rückmeldung geben? Wähle zuerst den passenden Weg.")
  );

  function baueAuswahlgruppe(titel, beschreibung, gruppe, mitFragenvorschlag = false) {
    const abschnitt = el("section", "melden-auswahlgruppe");
    const kopf = el("div", "melden-gruppenkopf");
    kopf.append(el("h2", null, titel), absatz(null, beschreibung));
    const liste = el("div", "melden-arten");
    liste.setAttribute("role", "group");
    liste.setAttribute("aria-label", titel);

    for (const eintrag of MELDE_ARTEN.filter((wert) => wert.gruppe === gruppe)) {
      const knopf = el("button", "melden-art");
      knopf.type = "button";
      knopf.dataset.art = eintrag.art;
      knopf.setAttribute("aria-pressed", "false");
      knopf.append(
        titelMitSymbol(eintrag.art, eintrag.titel),
        el("span", "melden-art-frage", "„" + eintrag.frage + "“"),
        el("span", "melden-art-text", eintrag.beschreibung)
      );
      knopf.addEventListener("click", () => waehleArt(eintrag.art));
      liste.appendChild(knopf);
    }

    if (mitFragenvorschlag) {
      const link = el("a", "melden-art melden-art-link");
      link.href = "frage-vorschlagen.html";
      link.append(
        titelMitSymbol("quizfrage", "Quizfrage ausarbeiten"),
        el("span", "melden-art-frage", "„Ich habe eine fertige Frage“"),
        el("span", "melden-art-text", "Fragestellung, Lösung und Regelbeleg vollständig zur Prüfung einreichen.")
      );
      liste.appendChild(link);
    }
    abschnitt.append(kopf, liste);
    return abschnitt;
  }

  bereich.append(
    baueAuswahlgruppe("Treff mitgestalten", "Für eine kurze Idee reicht ein Satz. Eine fertige Quizfrage kannst du ausführlich ausarbeiten.", "mitgestalten", true),
    baueAuswahlgruppe("Rückmeldung oder Anliegen", "Regelfall, Vorfall, Gespräch oder Feedback zur Website.", "rueckmeldung")
  );
  bereich.appendChild(el("div", "melden-formular-halter"));
}

function waehleArt(art) {
  if (!person() && art !== "website") {
    gewaehlteArt = art;
    zeichneAnmeldeAufforderung();
    const zurueck = el("button", "melden-anmelden", "Website-Feedback ohne Anmeldung");
    zurueck.type = "button";
    zurueck.addEventListener("click", () => { zeichneGeruest(); waehleArt("website"); });
    bereich.appendChild(zurueck);
    return;
  }
  gewaehlteArt = art;
  bereich.querySelectorAll(".melden-art").forEach((knopf) => {
    const aktiv = knopf.dataset.art === art;
    knopf.classList.toggle("gewaehlt", aktiv);
    knopf.setAttribute("aria-pressed", String(aktiv));
  });
  zeichneFormular(art);
}

// ---------- Die Felder der gewaehlten Art ----------

function baueFeld(art, name) {
  const beschreibung = MELDE_FELDER[name];
  if (!beschreibung) return null;

  const halter = el("div", "melden-feld");
  const kennung = "melden-feld-" + name;

  if (beschreibung.feldart === "ankreuz") {
    const label = el("label", "melden-ankreuz");
    const feld = document.createElement("input");
    feld.type = "checkbox";
    feld.id = kennung;
    feld.dataset.feld = name;
    label.append(feld, el("span", null, beschriftungFuer(art, name)));
    halter.appendChild(label);
    if (beschreibung.hinweis) halter.appendChild(absatz("melden-hinweis-leise", beschreibung.hinweis));
    return halter;
  }

  const label = el("label", "melden-beschriftung", beschriftungFuer(art, name));
  label.setAttribute("for", kennung);
  halter.appendChild(label);

  const feld = beschreibung.feldart === "textarea"
    ? document.createElement("textarea")
    : document.createElement("input");
  feld.id = kennung;
  feld.dataset.feld = name;
  if (beschreibung.feldart === "textarea") feld.rows = name === "situation" ? 6 : 3;
  else feld.type = "text";
  if (beschreibung.platzhalter) feld.placeholder = beschreibung.platzhalter;
  if (beschreibung.pflicht) feld.required = true;
  halter.appendChild(feld);

  // Der Hinweis ueber Angaben zu Dritten - direkt am Feld, an dem sie
  // erfragt werden, und mit Verweis statt Wiederholung.
  if (beschreibung.datenschutzHinweis) {
    const hinweis = absatz("melden-datenschutz",
      "Hier landen Angaben über andere Menschen, die davon nichts wissen. "
      + "Lesen kann sie ausschließlich der Schiedsrichter-Obmann – nicht andere "
      + "Schiedsrichter, nicht öffentlich. Meldungen werden standardmäßig nach 30 Tagen gelöscht; "
      + "der Obmann kann die Frist anpassen. Schreib nur, "
      + "was für die Sache nötig ist. Ausführlich: ");
    const verweis = el("a", null, "Datenschutz, Punkt 13 und 14");
    verweis.href = "datenschutz.html";
    hinweis.append(verweis, document.createTextNode("."));
    halter.appendChild(hinweis);
  }

  // Der Zaehler haengt nur am langen Feld. Bei "Spielklasse" waere er
  // Ausstattung ohne Anlass.
  if (beschreibung.grenze && zaehlwerkModul) {
    const zaehler = absatz("melden-zaehler");
    zaehler.hidden = true;
    halter.appendChild(zaehler);
    feld.dataset.grenze = String(beschreibung.grenze);
    zaehlwerkModul.haengeZeichenZaehlerAn(feld, zaehler, { grenze: beschreibung.grenze });
  }

  return halter;
}

function baueAnonymBereich(art) {
  if (!erlaubtAnonym(art)) return null;

  const halter = el("div", "melden-anonym");
  const label = el("label", "melden-ankreuz");
  const feld = document.createElement("input");
  feld.type = "checkbox";
  feld.id = "melden-anonym-feld";
  label.append(feld, el("span", null, "Anonym abgeben"));
  halter.appendChild(label);
  halter.appendChild(absatz("melden-hinweis-leise",
    "Dann verwirft der Server deine Personenkennung, bevor die Meldung gespeichert "
    + "wird – sie ist danach nicht wiederherstellbar. Das heißt auch: Der Obmann "
    + "kann dir nicht antworten und nicht nachfragen."));
  return halter;
}

function zeichneFormular(art) {
  const halter = bereich.querySelector(".melden-formular-halter");
  if (!halter) return;
  halter.replaceChildren();

  const eintrag = findeArt(art);
  if (!eintrag) return;

  const form = el("form", "melden-formular");
  form.setAttribute("novalidate", "novalidate");
  form.append(
    el("h2", "melden-formular-titel", eintrag.titel + " – " + eintrag.frage),
    absatz("melden-formular-text", eintrag.beschreibung)
  );

  for (const name of felderFuer(art)) {
    const feld = baueFeld(art, name);
    if (feld) form.appendChild(feld);
  }

  const anonym = person() ? baueAnonymBereich(art) : null;
  if (anonym) form.appendChild(anonym);
  if (art === "website" && !person()) {
    form.appendChild(absatz("melden-hinweis-leise", "Ohne Anmeldung wird keine Personenkennung gespeichert. Einen Namen kannst du freiwillig im folgenden Feld angeben; dann ist der Inhalt nicht mehr namenlos. Bitte keine sensiblen Angaben."));
    const label = el("label", "melden-beschriftung", "Name (freiwillig, nicht geprüft)");
    label.htmlFor = "gast-feedback-name";
    const name = el("input");
    name.id = "gast-feedback-name"; name.type = "text"; name.maxLength = 80; name.dataset.feld = "name";
    const nameFeld = el("div", "melden-feld");
    nameFeld.append(label, name);
    form.appendChild(nameFeld);
    form.querySelector('[data-feld="situation"]').maxLength = 3800;
  }
  if (art === "gespraech") form.appendChild(absatz("melden-hinweis-leise", "Damit der Obmann dich ansprechen kann, wird dein Name mitgesendet."));
  if (art === "treff") form.appendChild(absatz("melden-hinweis-leise", "Dein Vorschlag erscheint beim Obmann im Eingang und kann für den nächsten vereinsinternen Treff eingeplant werden."));

  const meldung = absatz("melden-rueckmeldung");
  meldung.setAttribute("role", "status");
  meldung.hidden = true;

  const senden = el("button", "melden-senden", "Meldung abschicken");
  senden.type = "submit";

  form.append(meldung, senden);
  form.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    void abschicken(art, form, senden, meldung);
  });

  halter.appendChild(form);
  form.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
}

// ---------- Abschicken ----------

function sammleWerte(form) {
  const werte = {};
  form.querySelectorAll("[data-feld]").forEach((feld) => {
    werte[feld.dataset.feld] = feld.type === "checkbox" ? feld.checked : feld.value;
  });
  return werte;
}

function sageAn(stelle, text, klasse) {
  stelle.className = "melden-rueckmeldung" + (klasse ? " " + klasse : "");
  stelle.textContent = text;
  stelle.hidden = !text;
}

async function abschicken(art, form, senden, meldung) {
  if (senden.disabled) return;
  const ich = person();
  if (!ich && art !== "website") {
    zeichneAnmeldeAufforderung();
    return;
  }

  const werte = sammleWerte(form);
  const situation = String(werte.situation || "").trim();

  if (situation === "") {
    sageAn(meldung, "Schreib bitte kurz, worum es geht.", "melden-fehler");
    return;
  }
  if (situation.length > GRENZE_SITUATION) {
    const zuViel = situation.length - GRENZE_SITUATION;
    sageAn(meldung,
      `Dein Text ist ${zuViel} Zeichen zu lang. Bitte kürze ihn um ${zuViel} Zeichen.`,
      "melden-fehler");
    return;
  }

  const anonymFeld = form.querySelector("#melden-anonym-feld");
  const parameter = ich ? baueParameter({
    art,
    werte,
    person: ich,
    anonym: Boolean(anonymFeld && anonymFeld.checked),
  }) : null;

  senden.disabled = true;
  sageAn(meldung, "Wird abgeschickt …", "");

  try {
    if (!ich) {
      const response = await fetch('/api/website-feedback', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({seite: VEREIN.seitenschluessel, text: situation, name: werte.name || ''}),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw new Error(data.fehler || 'Bitte später erneut versuchen.');
    } else {
      const { error } = await server.rpc("meldebogen_abgeben", parameter);
      if (error) throw error;
    }
  } catch (error) {
    senden.disabled = false;
    sageAn(meldung, "Das hat nicht geklappt: " + (error.message || "unbekannter Fehler"),
      "melden-fehler");
    return;
  }

  zeigeDank(art, !ich || parameter.p_anonym);
}

function zeigeDank(art, anonym) {
  const halter = bereich.querySelector(".melden-formular-halter");
  if (!halter) return;
  halter.replaceChildren();

  const karte = el("div", "melden-karte melden-dank");
  karte.append(
    el("h2", null, "Angekommen."),
    absatz(null, anonym
      ? "Danke für deinen Hinweis! Er liegt beim Schiedsrichter-Obmann. Es wurde keine Personenkennung gespeichert; eine direkte Antwort ist deshalb nicht möglich."
      : "Deine Meldung liegt beim Schiedsrichter-Obmann. Er sieht deinen Namen "
        + "und kann bei dir nachfragen.")
  );

  if (art === "vorfall") {
    karte.appendChild(absatz("melden-hinweis-leise",
      "Ein Vorfall wird nie veröffentlicht und nie zur Quizfrage – das ist keine "
      + "Absichtserklärung, sondern eine Bedingung in der Datenbank."));
  }

  const nochmal = el("button", "melden-anmelden", "Noch etwas melden");
  nochmal.type = "button";
  nochmal.addEventListener("click", () => waehleArt(art));
  karte.appendChild(nochmal);

  halter.appendChild(karte);
  karte.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
}

// ---------- Start ----------

function starte() {
  if (!bereich) return;
  zeichneGeruest();
  if (gewaehlteArt) waehleArt(gewaehlteArt);
}

// abonniere() ruft sofort einmal auf - deshalb hier KEIN zusaetzliches
// starte(), sonst zeichnet die Seite beim Laden zweimal.
if (anmeldung) anmeldung.abonniere(() => starte());
else starte();
