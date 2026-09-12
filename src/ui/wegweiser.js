// ============================================================
//  Wegweiser: der Baum der Seite, und der Weg eine Ebene hoch
// ============================================================
//  Max am 12.09.2026:
//  "In viele Menüs fehlt der Zurück-Button [...] es soll wie eine
//   Baumstruktur aufgebaut werden, als Knoten die Startseite, und wenn
//   man dann Untermenüs öffnet, soll man mit dem Zurück-Button zurück
//   gehen können. Das wird gerade relevant, wenn man die Webapp nutzt
//   ohne die Safari-Vor-und-Zurück-Steuerung."
//
//  Das ist der Kern: als App vom Home-Bildschirm gestartet ("standalone")
//  gibt es KEINE Browserleiste. Wer dort in einer Unterseite landet,
//  kommt ohne einen Weg im Inhalt selbst nicht mehr heraus. Auf den
//  rechtlichen Seiten war das besonders hart - die haben nicht einmal
//  eine Navigationsleiste.
//
//  Warum ein fester Baum und nicht history.back():
//   - history.back() fuehrt dorthin, wo man HERKAM. Das ist nach einem
//     Rundgang durch drei Seiten nicht mehr vorhersagbar, und beim ersten
//     Aufruf einer Seite (geteilter Link, Lesezeichen, App-Start) gibt es
//     gar keine Vorgeschichte - der Knopf tut dann nichts.
//   - Ein Baum sagt immer dasselbe. Derselbe Knopf auf derselben Seite
//     fuehrt immer an denselben Ort. Genau das ist Erwartungskonformitaet
//     (ISO 9241-110), und es ist auch der Grund, warum der Knopf das ZIEL
//     benennt ("Unterlagen") statt nur "zurueck": Selbstbeschreibungs-
//     faehigkeit. "Zurueck" allein sagt nicht, wo man landet.
//
//  Der Baum steht hier an EINER Stelle, nicht in zwanzig HTML-Dateien -
//  aus demselben Grund wie die Reiterleiste in kopf-navigation.js.
// ============================================================

// Jeder Eintrag: der sichtbare Name und der Elternknoten. "zwischen" ist
// ein Zwischenschritt ohne eigene Seite - das Kontomenue zum Beispiel ist
// ein Ort im Kopf der Leute, aber keine Adresse.
export const BAUM = Object.freeze({
  "index.html": { titel: "Start", eltern: null },

  // Ebene 1: die Reiter der Hauptnavigation.
  "termine.html": { titel: "Termine", eltern: "index.html" },
  "vorlagen.html": { titel: "Absagen", eltern: "index.html" },
  "regeluebersicht.html": { titel: "Regeln", eltern: "index.html" },
  "spesenrechner.html": { titel: "Spesen", eltern: "index.html" },
  "informationen.html": { titel: "Unterlagen", eltern: "index.html" },
  "melden.html": { titel: "Ideen & Feedback", eltern: "index.html" },
  "schiri-werden.html": { titel: "Schiri werden", eltern: "index.html" },
  "modus.html": { titel: "Quiz", eltern: "index.html" },

  // Ebene 2: was unter einem Reiter haengt.
  "installieren.html": { titel: "App installieren", eltern: "informationen.html" },
  "frage-vorschlagen.html": { titel: "Frage vorschlagen", eltern: "melden.html" },
  "quiz.html": { titel: "Fragen dieser Woche", eltern: "modus.html" },
  "entscheiden.html": { titel: "Entscheiden", eltern: "modus.html" },
  "duell.html": { titel: "Quiz-Duell", eltern: "modus.html" },

  // Der eigene Bereich haengt am Kontomenue, und das gibt es auf JEDER
  // Seite. Einen Elternknoten hat er trotzdem, sonst waere er der einzige
  // Ort ohne Weg zurueck. "Mein Konto" steht als Zwischenschritt im Pfad,
  // ist aber kein Link - die Seite dazu gibt es nicht.
  "meine-daten.html": { titel: "Meine Daten", eltern: "index.html", zwischen: "Mein Konto" },
  "meine-statistik.html": { titel: "Meine Statistik", eltern: "index.html", zwischen: "Mein Konto" },
  "meine-anliegen.html": { titel: "Meine Anliegen", eltern: "index.html", zwischen: "Mein Konto" },
  "ausruestung.html": { titel: "Meine Ausrüstung", eltern: "index.html", zwischen: "Mein Konto" },

  // Rechtliches haengt quer im Fuss jeder Seite - im Baum trotzdem an der
  // Wurzel, damit man von dort herauskommt.
  "impressum.html": { titel: "Impressum", eltern: "index.html" },
  "datenschutz.html": { titel: "Datenschutz", eltern: "index.html" },
  "nutzungsbedingungen.html": { titel: "Nutzungsbedingungen", eltern: "index.html" },
});

export function dateiname(ort = globalThis.location) {
  const teil = String(ort?.pathname || "").split("/").filter(Boolean).pop();
  return teil || "index.html";
}

// Der Weg von der Wurzel bis hierher. Ein Eintrag ohne "href" ist ein
// Zwischenschritt, den man nicht anspringen kann.
export function pfadZu(seite) {
  const knoten = BAUM[seite];
  if (!knoten) return [];
  const weg = [{ href: seite, titel: knoten.titel }];
  if (knoten.zwischen) weg.unshift({ href: null, titel: knoten.zwischen });
  let eltern = knoten.eltern;
  // Obergrenze gegen einen versehentlichen Ringschluss im Baum: lieber
  // ein zu kurzer Pfad als eine Endlosschleife im Seitenaufbau.
  for (let i = 0; eltern && i < 10; i += 1) {
    const oben = BAUM[eltern];
    if (!oben) break;
    weg.unshift({ href: eltern, titel: oben.titel });
    eltern = oben.eltern;
  }
  return weg;
}

export function elternVon(seite) {
  return BAUM[seite]?.eltern || null;
}

// Baut die Leiste. Gibt null zurueck, wenn es nichts zu zeigen gibt:
// auf der Startseite (dort ist man oben) und auf unbekannten Seiten
// (lieber kein Wegweiser als ein falscher).
export function baueWegweiser(seite, dokument = globalThis.document) {
  const eltern = elternVon(seite);
  if (!eltern || !BAUM[eltern]) return null;

  const leiste = dokument.createElement("nav");
  leiste.className = "wegweiser";
  leiste.setAttribute("aria-label", "Wo du gerade bist");

  // Der Zurueck-Weg nennt sein Ziel. Auf dem Handy ist er das Einzige,
  // was von dieser Leiste zu sehen ist - der Name der aktuellen Seite
  // steht dort schon oben im Kopf.
  const hoch = dokument.createElement("a");
  hoch.className = "wegweiser-zurueck";
  hoch.href = eltern;
  hoch.setAttribute("aria-label", `Zurück zu ${BAUM[eltern].titel}`);
  const pfeil = dokument.createElement("span");
  pfeil.className = "wegweiser-pfeil";
  pfeil.setAttribute("aria-hidden", "true");
  pfeil.textContent = "\u2039";
  const ziel = dokument.createElement("span");
  ziel.className = "wegweiser-ziel";
  ziel.textContent = BAUM[eltern].titel;
  hoch.appendChild(pfeil);
  hoch.appendChild(ziel);
  leiste.appendChild(hoch);

  const pfad = pfadZu(seite);
  if (pfad.length > 1) {
    const liste = dokument.createElement("ol");
    liste.className = "wegweiser-pfad";
    pfad.forEach((schritt, i) => {
      const punkt = dokument.createElement("li");
      const letzter = i === pfad.length - 1;
      if (letzter || !schritt.href) {
        const text = dokument.createElement("span");
        text.textContent = schritt.titel;
        if (letzter) text.setAttribute("aria-current", "page");
        punkt.appendChild(text);
      } else {
        const link = dokument.createElement("a");
        link.href = schritt.href;
        link.textContent = schritt.titel;
        punkt.appendChild(link);
      }
      liste.appendChild(punkt);
    });
    leiste.appendChild(liste);
  }
  return leiste;
}

// Haengt die Leiste an den Anfang des Inhalts. Bewusst dort und nicht in
// den Kopf: der Kopf ist auf dem Handy schon voll, und der Weg nach oben
// gehoert zum Inhalt, den man gerade liest.
export function montiereWegweiser(inhalt, seite = dateiname(), dokument = globalThis.document) {
  if (!inhalt) return null;
  if (inhalt.firstElementChild?.classList?.contains("wegweiser")) return null;
  const leiste = baueWegweiser(seite, dokument);
  if (!leiste) return null;
  inhalt.insertBefore(leiste, inhalt.firstChild);
  return leiste;
}
