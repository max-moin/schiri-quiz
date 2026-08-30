// ============================================================
//  Profil-Fenster - einmal gebaut, von jeder Seite aufrufbar
// ============================================================
//  Max am 30.08.2026, woertlich: "Dieses 'Angemeldet als Max Mueller' und
//  dieses 'Ausruestung anfragen / Anliegen melden / Meine Anfragen' - das
//  muessen halt alles auch mit auf die Hauptwebseite. Das hat ja mit dem
//  Quiz gar nichts mehr zu tun."
//
//  Bis dahin stand dieses Markup fest in quiz.html. Damit gab es die
//  Ausruestungs-Anfrage, das Anliegen und "Meine Anfragen" ausschliesslich
//  dort - obwohl keines davon etwas mit Regelfragen zu tun hat.
//
//  Dieselbe Loesung wie beim Anmeldefenster (src/ui/login-dialog.js): das
//  Markup lebt hier und wird in die Seite gehaengt, die es braucht. Die
//  Kennungen der Elemente sind unveraendert uebernommen, damit
//  src/features/profile-requests.js weiter genau diese Fenster bedient -
//  eine zweite Fassung waere genau die Doppelung, die spaeter auseinander
//  laeuft.
//
//  Gestaltung: auf der Quizseite style.css, auf den Vereinsseiten
//  stil/profil.css. Getrennt aus demselben Grund, aus dem basis.css und
//  style.css getrennt sind (siehe Kopf von stil/basis.css): das Quiz
//  laeuft und wird benutzt, eine gemeinsame Datei hiesse, dass jede
//  Aenderung an der Vereinsseite es kaputtmachen kann.
// ============================================================

(function stelleProfilFensterBereit(global) {
  "use strict";

  const GERUEST = `
  <!-- Anfrage-Formular (12.07.2026, Baustein 5a: Anfragen-System, Baustein A
       der Backlog-Spec) - Ausrüstungs-Anfrage stellen, erreichbar über das
       neue Profil-Panel. -->
  <div id="anfrage-formular-overlay" class="erklaerung-overlay profil-fenster" hidden>
    <div class="erklaerung-popup" role="dialog" aria-modal="true" aria-labelledby="anfrage-formular-titel">
      <div class="erklaerung-kopf">
        <h3 id="anfrage-formular-titel">Ausrüstung anfragen 📋</h3>
        <button id="anfrage-formular-schliessen-button" class="erklaerung-schliessen-button" type="button" aria-label="Schließen">✕</button>
      </div>

      <div id="anfrage-formular-inhalt">
        <label for="anfrage-kategorie-auswahl">Was brauchst du?</label>
        <select id="anfrage-kategorie-auswahl">
          <option value="">– bitte auswählen –</option>
          <option value="trikot">Trikot</option>
          <option value="hose">Hose</option>
          <option value="stutzen">Stutzen</option>
          <option value="schuhe">Schuhe</option>
        </select>

        <label for="anfrage-farbe-eingabe">Farbe (optional)</label>
        <input id="anfrage-farbe-eingabe" type="text" autocomplete="off" placeholder="z.B. Grün" />

        <label for="anfrage-groesse-eingabe">Größe (optional)</label>
        <input id="anfrage-groesse-eingabe" type="text" autocomplete="off" placeholder="z.B. L" />

        <div id="anfrage-aermellaenge-bereich" hidden>
          <label for="anfrage-aermellaenge-auswahl">Ärmellänge</label>
          <select id="anfrage-aermellaenge-auswahl">
            <option value="">– bitte auswählen –</option>
            <option value="kurz">Kurzarm</option>
            <option value="lang">Langarm</option>
          </select>
        </div>

        <label for="anfrage-anmerkung-eingabe">Anmerkung (optional)</label>
        <textarea id="anfrage-anmerkung-eingabe" rows="3" placeholder="Sonstiges, was wir wissen sollten ..."></textarea>

        <p id="anfrage-formular-hinweis" class="hinweis" hidden></p>
        <button id="anfrage-absenden-button" type="button">Absenden</button>
      </div>

      <div id="anfrage-formular-erfolg" hidden>
        <p>Danke, deine Anfrage ist raus! Den Status siehst du jederzeit unter „Meine Anfragen“.</p>
        <button id="anfrage-formular-erfolg-schliessen-button" class="sekundaer-button" type="button">Schließen</button>
      </div>
    </div>
  </div>

  <!-- Anliegen-Formular (12.07.2026, Baustein 5c: Baustein E der
       Backlog-Spec, dort "Sorgenkasten" genannt - hier bewusst "Anliegen",
       Max' eigene Wortwahl beim Anfordern dieses Bausteins) - freier Text
       statt eines Formulars mit festen Feldern, damit die Hürde niedrig
       bleibt (jedes Anliegen, nicht nur Ausrüstung). -->
  <div id="anliegen-formular-overlay" class="erklaerung-overlay profil-fenster" hidden>
    <div class="erklaerung-popup" role="dialog" aria-modal="true" aria-labelledby="anliegen-formular-titel">
      <div class="erklaerung-kopf">
        <h3 id="anliegen-formular-titel">Anliegen melden 💬</h3>
        <button id="anliegen-formular-schliessen-button" class="erklaerung-schliessen-button" type="button" aria-label="Schließen">✕</button>
      </div>

      <div id="anliegen-formular-inhalt">
        <p class="hinweis">Egal ob große oder kleine Sache - schreib einfach, was los ist. Nur der Schiri-Obmann sieht das hier.</p>
        <label for="anliegen-text-eingabe">Was möchtest du uns wissen lassen?</label>
        <textarea id="anliegen-text-eingabe" rows="5" placeholder="Schreib hier, was dich beschäftigt ..."></textarea>

        <p id="anliegen-formular-hinweis" class="hinweis" hidden></p>
        <button id="anliegen-absenden-button" type="button">Absenden</button>
      </div>

      <div id="anliegen-formular-erfolg" hidden>
        <p>Danke, deine Nachricht ist angekommen! Den Status siehst du jederzeit unter „Meine Anfragen“.</p>
        <button id="anliegen-formular-erfolg-schliessen-button" class="sekundaer-button" type="button">Schließen</button>
      </div>
    </div>
  </div>

  <!-- Meine-Anfragen-Übersicht (12.07.2026, Baustein 5a; erweitert 5c um
       Anliegen + Rechnungs-Upload) - eigene gestellte Anfragen/Anliegen mit
       Status, erreichbar über das Profil-Panel. -->
  <div id="meine-anfragen-overlay" class="erklaerung-overlay profil-fenster" hidden>
    <div class="erklaerung-popup" role="dialog" aria-modal="true" aria-labelledby="meine-anfragen-titel">
      <div class="erklaerung-kopf">
        <h3 id="meine-anfragen-titel">Meine Anfragen 📦</h3>
        <button id="meine-anfragen-schliessen-button" class="erklaerung-schliessen-button" type="button" aria-label="Schließen">✕</button>
      </div>

      <div id="meine-anfragen-liste"></div>
      <p id="meine-anfragen-leer-hinweis" class="hinweis" hidden>Du hast noch keine Anfragen gestellt.</p>
    </div>
  </div>

  <!-- Rechnungs-Upload (12.07.2026, Baustein 5c: Baustein D, Weg 2) - nur
       erreichbar über eine Zeile in "Meine Anfragen", die angenommen ist
       UND wo der Obmann "Schiri besorgt es selbst" gewählt hat. Foto wird
       vor dem Hochladen im Browser verkleinert (siehe app.js
       "komprimiereBildAufBase64"), damit auch normale Handyfotos
       problemlos als Base64 übertragen werden können. -->
  <div id="rechnung-upload-overlay" class="erklaerung-overlay profil-fenster" hidden>
    <div class="erklaerung-popup" role="dialog" aria-modal="true" aria-labelledby="rechnung-upload-titel">
      <div class="erklaerung-kopf">
        <h3 id="rechnung-upload-titel">Rechnung hochladen 🧾</h3>
        <button id="rechnung-upload-schliessen-button" class="erklaerung-schliessen-button" type="button" aria-label="Schließen">✕</button>
      </div>

      <div id="rechnung-upload-inhalt">
        <p class="hinweis">Mach ein Foto von der Rechnung oder wähle eins aus deiner Galerie - der Schiri-Obmann sieht es dann in seinem Dashboard und überweist dir das Geld.</p>
        <input id="rechnung-datei-eingabe" type="file" accept="image/*" />
        <img id="rechnung-vorschau-bild" alt="Vorschau der Rechnung" hidden />
        <p id="rechnung-upload-hinweis" class="hinweis" hidden></p>
        <button id="rechnung-hochladen-button" type="button" disabled>Hochladen</button>
      </div>

      <div id="rechnung-upload-erfolg" hidden>
        <p>Danke, die Rechnung ist beim Schiri-Obmann angekommen!</p>
        <button id="rechnung-upload-erfolg-schliessen-button" class="sekundaer-button" type="button">Schließen</button>
      </div>
    </div>
  </div>
`;

  // Idempotent: mehrfaches Aufrufen darf die Fenster nicht verdoppeln.
  // Aufgerufen wird aus zwei Welten (app.js im Quiz, seite.js auf den
  // Vereinsseiten) - und auf modus.html laufen beide Skripte nebeneinander.
  function sorgeFuerFenster() {
    if (document.getElementById("anfrage-formular-overlay")) return;
    const halter = document.createElement("div");
    halter.innerHTML = GERUEST;
    while (halter.firstChild) document.body.appendChild(halter.firstChild);
  }

  global.SchiriProfilFenster = Object.freeze({ sorgeFuerFenster });
})(globalThis);
