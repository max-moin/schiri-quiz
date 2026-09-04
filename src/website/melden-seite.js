// ============================================================
//  melden.html - der Meldebogen
// ============================================================
//  Vier Dinge, die bisher alle im selben Kanal gelandet waeren ("schreib
//  dem Obmann eine WhatsApp"): ein Regelfall, ein Vorfall, ein
//  Gespraechswunsch und ein Hinweis zur Website. Sie brauchen
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

// ---------- Nicht angemeldet: der Weg dorthin, keine Fehlermeldung ----------

function zeichneAnmeldeAufforderung() {
  bereich.replaceChildren();
  bereich.append(
    el("h1", "seiten-titel", "Etwas melden"),
    absatz("seiten-unter",
      "Regelfall, Vorfall, Gesprächswunsch oder ein Hinweis zur Website – "
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
    el("h1", "seiten-titel", "Etwas melden"),
    absatz("seiten-unter", "Such zuerst aus, worum es geht. Danach kommen nur die Felder, die dazu passen.")
  );

  const liste = el("div", "melden-arten");
  liste.setAttribute("role", "group");
  liste.setAttribute("aria-label", "Art der Meldung");

  for (const eintrag of MELDE_ARTEN) {
    const knopf = el("button", "melden-art");
    knopf.type = "button";
    knopf.dataset.art = eintrag.art;
    knopf.setAttribute("aria-pressed", "false");
    knopf.append(
      el("span", "melden-art-titel", eintrag.titel),
      el("span", "melden-art-frage", "„" + eintrag.frage + "“"),
      el("span", "melden-art-text", eintrag.beschreibung)
    );
    knopf.addEventListener("click", () => waehleArt(eintrag.art));
    liste.appendChild(knopf);
  }

  bereich.appendChild(liste);
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
  if (!person()) waehleArt("website");
  else if (gewaehlteArt) waehleArt(gewaehlteArt);
}

// abonniere() ruft sofort einmal auf - deshalb hier KEIN zusaetzliches
// starte(), sonst zeichnet die Seite beim Laden zweimal.
if (anmeldung) anmeldung.abonniere(() => starte());
else starte();
