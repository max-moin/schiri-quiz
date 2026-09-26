// ============================================================
//  Pflichtfelder: Fehler am Feld statt oben auf der Seite
// ============================================================
//  Backlog "Pflichtbegruendung sichtbar erzwingen" (25.09.2026): Eine leere
//  Antwort darf nicht abgeschickt werden - und die Meldung dazu gehoert
//  AN DAS FELD, wie in jedem Formular: roter Rahmen, der Cursor steht
//  schon im Feld.
//
//  26.09.2026 (Max): kein sichtbarer Satz unter dem Feld - "wieder viel
//  Text". Der rote Rahmen reicht. Der Satz bleibt, aber nur fuer
//  Screenreader (Klasse nur-screenreader), damit blinde Nutzer weiter
//  hoeren, WAS fehlt.
//
//  Bis hierher erschien "Bitte erst eine Antwort eingeben." im
//  allgemeinen Fehlerhinweis oben im Quiz. Bei Frage vier von fuenf ist
//  der ausserhalb des Bildschirms - fuer die Person sah das so aus, als
//  passiere beim Tippen auf "Abschicken" einfach nichts.
//
//  Barrierefreiheit (WCAG 3.3.1 "Fehlererkennung"):
//   - aria-invalid="true" am Feld, die Meldung per aria-describedby
//     verbunden und mit role="alert" angesagt,
//   - Sehende bekommen Rahmen + Fokus + Sprung zum Feld, Screenreader
//     den Satz (unsichtbar, aber vorgelesen),
//   - die Markierung verschwindet von selbst, sobald man tippt oder waehlt.
//
//  Klassisches Skript wie zeichen-zaehler.js: das Quiz laedt klassische
//  Skripte, die Duellseite ein Modul - beide holen sich den Baustein ueber
//  globalThis.SchiriPflichtfeld.
// ============================================================

(function stellePflichtfeldBereit(global) {
  "use strict";

  let zaehler = 0;

  function istEingabe(element) {
    return /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName || "");
  }

  function meldungsId(ziel) {
    if (!ziel.id) {
      zaehler += 1;
      ziel.id = `pflichtfeld-${Date.now().toString(36)}-${zaehler}`;
    }
    return `${ziel.id}-meldung`;
  }

  function setzeBeschreibung(element, id, an) {
    const vorhanden = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    const neu = an ? [...new Set([...vorhanden, id])] : vorhanden.filter((wert) => wert !== id);
    if (neu.length) element.setAttribute("aria-describedby", neu.join(" "));
    else element.removeAttribute("aria-describedby");
  }

  function eingabenIn(ziel) {
    return istEingabe(ziel) ? [ziel] : [...ziel.querySelectorAll("input, textarea, select")];
  }

  function loesche(ziel) {
    if (!ziel) return;
    const id = ziel.id ? `${ziel.id}-meldung` : null;
    ziel.classList.remove("pflicht-fehler");
    for (const eingabe of eingabenIn(ziel)) {
      eingabe.removeAttribute("aria-invalid");
      if (id) setzeBeschreibung(eingabe, id, false);
    }
    if (id) global.document?.getElementById(id)?.remove();
  }

  function melde(ziel, text, { fokus = true } = {}) {
    if (!ziel || !text) return false;
    const id = meldungsId(ziel);
    let meldung = global.document.getElementById(id);
    if (!meldung) {
      meldung = global.document.createElement("p");
      meldung.id = id;
      meldung.className = "pflicht-meldung nur-screenreader";
      meldung.setAttribute("role", "alert");
      ziel.insertAdjacentElement("afterend", meldung);
    }
    meldung.textContent = text;
    ziel.classList.add("pflicht-fehler");

    const eingaben = eingabenIn(ziel);
    for (const eingabe of eingaben) {
      eingabe.setAttribute("aria-invalid", "true");
      setzeBeschreibung(eingabe, id, true);
    }

    // Einmalig: Beim ersten Tippen oder Waehlen gilt der Fehler als behoben.
    // Ob die neue Eingabe reicht, entscheidet wieder das Abschicken.
    const aufraeumen = () => {
      loesche(ziel);
      eingaben.forEach((eingabe) => {
        eingabe.removeEventListener("input", aufraeumen);
        eingabe.removeEventListener("change", aufraeumen);
      });
    };
    eingaben.forEach((eingabe) => {
      eingabe.addEventListener("input", aufraeumen);
      eingabe.addEventListener("change", aufraeumen);
    });

    if (fokus) {
      const erstes = eingaben.find((eingabe) => !eingabe.disabled) || null;
      const ruhig = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      ziel.scrollIntoView?.({ block: "center", behavior: ruhig ? "auto" : "smooth" });
      erstes?.focus?.({ preventScroll: true });
    }
    return true;
  }

  global.SchiriPflichtfeld = Object.freeze({ melde, loesche });
})(globalThis);
