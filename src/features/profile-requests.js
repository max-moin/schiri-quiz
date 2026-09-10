(function stelleProfilAnfragenBereit(global) {
  "use strict";

  // Eine gemeinsame Fachliste fuer Bestand UND Anfrage. Neue Gegenstaende
  // werden hier einmal beschrieben; beide Oberflaechen leiten daraus ihre
  // Felder ab. So kann z. B. eine Hose niemals versehentlich nach einer
  // Aermellaenge fragen.
  const KATEGORIEN = Object.freeze([
    { schluessel: "trikot", gruppe: "Bekleidung", wort: "Trikot", mehrzahl: "Trikots", icon: "shirt", farbe: true, groesse: true, aermel: true },
    { schluessel: "hose", gruppe: "Bekleidung", wort: "Schiedsrichterhose", mehrzahl: "Hosen", icon: "shorts", farbe: true, groesse: true },
    { schluessel: "stutzen", gruppe: "Bekleidung", wort: "Stutzen", mehrzahl: "Stutzen", icon: "socks", farbe: true, groesse: true },
    { schluessel: "schuhe", gruppe: "Bekleidung", wort: "Schuhe", mehrzahl: "Schuhe", icon: "shoe", farbe: true, groesse: true },
    { schluessel: "spielnotizkarten", gruppe: "Equipment", wort: "Spielnotizkarten", mehrzahl: "Spielnotizkarten", icon: "notes", verbrauch: true },
    { schluessel: "spesenquittungen", gruppe: "Equipment", wort: "Spesenformulare", mehrzahl: "Spesenformulare", icon: "receipt", verbrauch: true },
    { schluessel: "schiedsrichtermappe", gruppe: "Equipment", wort: "Schiedsrichtermappe", mehrzahl: "Schiedsrichtermappen", icon: "folder", farbe: true },
    { schluessel: "gelbe_karte", gruppe: "Equipment", wort: "Gelbe Karte", mehrzahl: "Gelbe Karten", icon: "card-yellow" },
    { schluessel: "rote_karte", gruppe: "Equipment", wort: "Rote Karte", mehrzahl: "Rote Karten", icon: "card-red" },
    { schluessel: "pfeife", gruppe: "Equipment", wort: "Pfeife", mehrzahl: "Pfeifen", icon: "whistle", farbe: true },
    { schluessel: "headset", gruppe: "Equipment", wort: "Schiedsrichter-Headset", mehrzahl: "Headsets", icon: "headset", farbe: true },
    { schluessel: "funkfahnen", gruppe: "Equipment", wort: "Funkfahnen", mehrzahl: "Funkfahnen", icon: "flag" },
    { schluessel: "schiedsrichterfahnen", gruppe: "Equipment", wort: "Schiedsrichterfahnen", mehrzahl: "Schiedsrichterfahnen", icon: "flag" },
    { schluessel: "sporttasche", gruppe: "Equipment", wort: "Sporttasche", mehrzahl: "Sporttaschen", icon: "bag", farbe: true },
    { schluessel: "sonstiges", gruppe: "Equipment", wort: "Sonstiges Equipment", mehrzahl: "Sonstiges Equipment", icon: "equipment", farbe: true, bezeichnung: true },
  ]);

  const FARBEN = Object.freeze([
    { wert: "Schwarz", hex: "#171717" }, { wert: "Weiß", hex: "#ffffff" },
    { wert: "Grau", hex: "#8b9098" }, { wert: "Gelb", hex: "#ffd43b" },
    { wert: "Orange", hex: "#f28c28" }, { wert: "Rot", hex: "#dc3545" },
    { wert: "Grün", hex: "#258a4b" }, { wert: "Blau", hex: "#2474d2" },
    { wert: "Violett", hex: "#7b4cc9" }, { wert: "Pink", hex: "#d94f9d" },
  ]);

  function findeKategorie(schluessel) {
    return KATEGORIEN.find((x) => x.schluessel === schluessel) || KATEGORIEN.at(-1);
  }

  function kategorienOptionen() {
    return ["Bekleidung", "Equipment"].map((gruppe) => `<optgroup label="${gruppe}">${KATEGORIEN
      .filter((x) => x.gruppe === gruppe)
      .map((x) => `<option value="${x.schluessel}">${x.wort}</option>`).join("")}</optgroup>`).join("");
  }

  function farbwahlHtml(name) {
    return FARBEN.map((farbe) => `<label class="ausruestungs-farbe" title="${farbe.wert}">
      <input type="radio" name="${name}" value="${farbe.wert}">
      <span style="--ausruestungs-farbe:${farbe.hex}" aria-hidden="true"></span><small>${farbe.wert}</small>
    </label>`).join("") + `<label class="ausruestungs-farbe ausruestungs-farbe-eigen">
      <input type="radio" name="${name}" value="__andere__"><span aria-hidden="true">+</span><small>Andere</small>
    </label>`;
  }

  global.SchiriAusruestung = Object.freeze({ KATEGORIEN, FARBEN, findeKategorie, kategorienOptionen, farbwahlHtml });

  // Seit dem 30.08.2026 laeuft dieses Modul in zwei Welten: im Quiz (mit
  // dem Supabase-Client als "sb") und auf den Vereinsseiten (mit dem
  // schlanken fetch-Ersatz aus src/core/rpc.js). Das Markup der Fenster
  // kommt in beiden Faellen aus src/ui/profil-fenster.js.
  //
  // Der Ausloeser ist NICHT mehr Teil dieses Moduls: im Quiz ist es der
  // "Angemeldet als"-Badge, auf den Vereinsseiten das Kontomenue in der
  // Kopfleiste. Beide rufen dieselben oeffne*-Funktionen von unten auf.
  // Die Badge-Elemente sind deshalb ab hier optional.
  //
  // "beiStatusPunkt" meldet, ob es ungesehene Neuigkeiten gibt - damit ein
  // Ausloeser ausserhalb dieses Moduls seinen eigenen Punkt setzen kann.
  function erstelleProfilAnfragen({ sb, getZugang, zeigeFehler, beiStatusPunkt }) {
    const angemeldetBadgeButton = document.getElementById("angemeldet-badge-button");
    const profilPanel = document.getElementById("profil-panel");
    const profilStatusPunkt = document.getElementById("profil-status-punkt");
    const panelAnfrageStellenButton = document.getElementById("panel-anfrage-stellen-button");
    const panelAnfragenStatusPunkt = document.getElementById("panel-anfragen-status-punkt");
    const anfrageFormularOverlay = document.getElementById("anfrage-formular-overlay");
    const anfrageFormularSchliessenButton = document.getElementById("anfrage-formular-schliessen-button");
    const anfrageFormularInhalt = document.getElementById("anfrage-formular-inhalt");
    const anfrageFormularErfolg = document.getElementById("anfrage-formular-erfolg");
    const anfrageFormularErfolgSchliessenButton = document.getElementById("anfrage-formular-erfolg-schliessen-button");
    const anfrageKategorieAuswahl = document.getElementById("anfrage-kategorie-auswahl");
    const anfrageFarbeEingabe = document.getElementById("anfrage-farbe-eingabe");
    const anfrageFarbeBereich = document.getElementById("anfrage-farbe-bereich");
    const anfrageFarbwahl = document.getElementById("anfrage-farbwahl");
    const anfrageAndereFarbe = document.getElementById("anfrage-andere-farbe");
    const anfrageGroesseEingabe = document.getElementById("anfrage-groesse-eingabe");
    const anfrageGroesseBereich = document.getElementById("anfrage-groesse-bereich");
    const anfrageAermellaengeBereich = document.getElementById("anfrage-aermellaenge-bereich");
    const anfrageAermellaengeAuswahl = document.getElementById("anfrage-aermellaenge-auswahl");
    const anfrageAnmerkungEingabe = document.getElementById("anfrage-anmerkung-eingabe");
    const anfrageFormularHinweis = document.getElementById("anfrage-formular-hinweis");
    const anfrageAbsendenButton = document.getElementById("anfrage-absenden-button");
    const rechnungUploadOverlay = document.getElementById("rechnung-upload-overlay");
    const rechnungUploadSchliessenButton = document.getElementById("rechnung-upload-schliessen-button");
    const rechnungUploadInhalt = document.getElementById("rechnung-upload-inhalt");
    const rechnungUploadErfolg = document.getElementById("rechnung-upload-erfolg");
    const rechnungUploadErfolgSchliessenButton = document.getElementById("rechnung-upload-erfolg-schliessen-button");
    const rechnungDateiEingabe = document.getElementById("rechnung-datei-eingabe");
    const rechnungVorschauBild = document.getElementById("rechnung-vorschau-bild");
    const rechnungUploadHinweis = document.getElementById("rechnung-upload-hinweis");
    const rechnungHochladenButton = document.getElementById("rechnung-hochladen-button");

    anfrageKategorieAuswahl.insertAdjacentHTML("beforeend", kategorienOptionen());
    anfrageFarbwahl.innerHTML = farbwahlHtml("anfrage-farbton");

    function aktualisiereAnfrageFelder() {
      const kategorie = findeKategorie(anfrageKategorieAuswahl.value);
      anfrageFarbeBereich.hidden = !anfrageKategorieAuswahl.value || !kategorie.farbe;
      anfrageGroesseBereich.hidden = !anfrageKategorieAuswahl.value || !kategorie.groesse;
      anfrageAermellaengeBereich.hidden = !anfrageKategorieAuswahl.value || !kategorie.aermel;
      if (anfrageFarbeBereich.hidden) anfrageFarbeEingabe.value = "";
      if (anfrageGroesseBereich.hidden) anfrageGroesseEingabe.value = "";
      if (anfrageAermellaengeBereich.hidden) anfrageAermellaengeAuswahl.value = "";
      if (kategorie.schluessel === "sonstiges") {
        anfrageAnmerkungEingabe.placeholder = "Bitte beschreibe genau, welches Equipment du brauchst.";
      } else {
        anfrageAnmerkungEingabe.placeholder = "Sonstiges, was wir wissen sollten …";
      }
    }

    anfrageFarbwahl.addEventListener("change", (event) => {
      const wert = event.target?.value;
      if (!wert) return;
      const eigeneFarbe = wert === "__andere__";
      anfrageAndereFarbe.hidden = !eigeneFarbe;
      if (eigeneFarbe) {
        anfrageFarbeEingabe.value = "";
        anfrageAndereFarbe.focus();
      } else {
        anfrageFarbeEingabe.value = wert;
      }
    });
    anfrageAndereFarbe.addEventListener("input", () => { anfrageFarbeEingabe.value = anfrageAndereFarbe.value.trim(); });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (profilPanel && !profilPanel.hidden) schliesseProfilPanel();
      if (anfrageFormularOverlay && !anfrageFormularOverlay.hidden) schliesseAnfrageFormular();
      if (rechnungUploadOverlay && !rechnungUploadOverlay.hidden) schliesseRechnungUpload();
    });

    // Nur relevant für echte (angemeldete) Schiedsrichter - im Gast-Modus wird
    // die Angemeldet-Leiste ohnehin nie eingeblendet.

    function schliesseProfilPanel() {
      if (!profilPanel) return;
      profilPanel.hidden = true;
      if (angemeldetBadgeButton) angemeldetBadgeButton.setAttribute("aria-expanded", "false");
    }

    if (angemeldetBadgeButton && profilPanel) {
      angemeldetBadgeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const istOffen = !profilPanel.hidden;
        if (istOffen) {
          schliesseProfilPanel();
        } else {
          profilPanel.hidden = false;
          angemeldetBadgeButton.setAttribute("aria-expanded", "true");
        }
      });
    }

    // Klick außerhalb des Panels schließt es wieder (übliches Dropdown-
    // Verhalten) - auf dem "document", damit auch Klicks außerhalb der
    // Leiste erfasst werden.
    document.addEventListener("click", (event) => {
      if (!profilPanel || profilPanel.hidden) return;
      if (angemeldetBadgeButton && (event.target === angemeldetBadgeButton || angemeldetBadgeButton.contains(event.target))) return;
      if (event.target === profilPanel || profilPanel.contains(event.target)) return;
      schliesseProfilPanel();
    });

    function setzeAnfrageFormularZurueck() {
      anfrageKategorieAuswahl.value = "";
      anfrageFarbeEingabe.value = "";
      anfrageAndereFarbe.value = "";
      anfrageAndereFarbe.hidden = true;
      anfrageFarbwahl.querySelectorAll("input").forEach((input) => { input.checked = false; });
      anfrageGroesseEingabe.value = "";
      anfrageAermellaengeAuswahl.value = "";
      aktualisiereAnfrageFelder();
      anfrageAnmerkungEingabe.value = "";
      anfrageFormularHinweis.hidden = true;
      anfrageFormularInhalt.hidden = false;
      anfrageFormularErfolg.hidden = true;
    }

    anfrageKategorieAuswahl.addEventListener("change", aktualisiereAnfrageFelder);

    function oeffneAusruestungsAnfrage() {
      schliesseProfilPanel();
      setzeAnfrageFormularZurueck();
      anfrageFormularOverlay.hidden = false;
    }

    if (panelAnfrageStellenButton) {
      panelAnfrageStellenButton.addEventListener("click", oeffneAusruestungsAnfrage);
    }

    function schliesseAnfrageFormular() {
      anfrageFormularOverlay.hidden = true;
    }

    anfrageFormularSchliessenButton.addEventListener("click", schliesseAnfrageFormular);
    anfrageFormularErfolgSchliessenButton.addEventListener("click", schliesseAnfrageFormular);
    anfrageFormularOverlay.addEventListener("click", (event) => {
      if (event.target === anfrageFormularOverlay) schliesseAnfrageFormular();
    });

    anfrageAbsendenButton.addEventListener("click", async () => {
      const kategorie = anfrageKategorieAuswahl.value;
      if (!kategorie) {
        anfrageFormularHinweis.textContent = "Bitte wähle aus, was du brauchst.";
        anfrageFormularHinweis.hidden = false;
        return;
      }
      if (kategorie === "sonstiges" && anfrageAnmerkungEingabe.value.trim().length < 2) {
        anfrageFormularHinweis.textContent = "Bitte beschreibe kurz, welches Equipment du brauchst.";
        anfrageFormularHinweis.hidden = false;
        anfrageAnmerkungEingabe.focus();
        return;
      }

      anfrageFormularHinweis.hidden = true;
      anfrageAbsendenButton.disabled = true;

      const { error } = await sb.rpc("schiri_anfrage_erstellen", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
        p_kategorie: kategorie,
        p_farbe: anfrageFarbeEingabe.value.trim() || null,
        p_groesse: anfrageGroesseEingabe.value.trim() || null,
        p_aermellaenge: anfrageAermellaengeBereich.hidden ? null : anfrageAermellaengeAuswahl.value || null,
        p_anmerkung: anfrageAnmerkungEingabe.value.trim() || null,
      });

      anfrageAbsendenButton.disabled = false;

      if (error) {
        anfrageFormularHinweis.textContent = "Konnte leider nicht gespeichert werden: " + error.message;
        anfrageFormularHinweis.hidden = false;
        return;
      }

      anfrageFormularInhalt.hidden = true;
      anfrageFormularErfolg.hidden = false;
    });

    // Merkt sich, für welche Anfrage gerade eine Rechnung hochgeladen wird
    // (gesetzt auf der Seite "Mein Ausruestungsbestand") sowie das im
    // Browser schon komprimierte Bild.
    let rechnungUploadAnfrageId = null;
    let rechnungUploadBase64 = null;
    let rechnungUploadMime = null;

    // ---------- Rechnungs-Upload (Baustein 5c, Baustein D Weg 2) ----------

    /// Verkleinert ein Foto im Browser auf max. 1600px Kantenlänge und
    /// re-kodiert es als JPEG (Qualität 0.8), bevor es als Base64 an die RPC
    /// geht - normale Handyfotos sind sonst oft mehrere MB groß, das würde die
    /// Anfrage unnötig aufblähen bzw. an Limits stoßen können.
    function komprimiereBildAufBase64(datei) {
      return new Promise((resolve, reject) => {
        const bild = new Image();
        const objektUrl = URL.createObjectURL(datei);
        bild.onload = () => {
          const MAX_KANTE = 1600;
          let breite = bild.naturalWidth;
          let hoehe = bild.naturalHeight;
          if (breite > MAX_KANTE || hoehe > MAX_KANTE) {
            if (breite >= hoehe) {
              hoehe = Math.round((hoehe * MAX_KANTE) / breite);
              breite = MAX_KANTE;
            } else {
              breite = Math.round((breite * MAX_KANTE) / hoehe);
              hoehe = MAX_KANTE;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = breite;
          canvas.height = hoehe;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bild, 0, 0, breite, hoehe);
          URL.revokeObjectURL(objektUrl);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mime: "image/jpeg", vorschauUrl: dataUrl });
        };
        bild.onerror = () => {
          URL.revokeObjectURL(objektUrl);
          reject(new Error("Bild konnte nicht gelesen werden"));
        };
        bild.src = objektUrl;
      });
    }

    function setzeRechnungUploadZurueck() {
      rechnungDateiEingabe.value = "";
      rechnungVorschauBild.hidden = true;
      rechnungVorschauBild.src = "";
      rechnungUploadHinweis.hidden = true;
      rechnungHochladenButton.disabled = true;
      rechnungUploadInhalt.hidden = false;
      rechnungUploadErfolg.hidden = true;
      rechnungUploadBase64 = null;
      rechnungUploadMime = null;
    }

    function oeffneRechnungUpload(anfrageId) {
      rechnungUploadAnfrageId = anfrageId;
      setzeRechnungUploadZurueck();
      rechnungUploadOverlay.hidden = false;
    }

    function schliesseRechnungUpload() {
      rechnungUploadOverlay.hidden = true;
      rechnungUploadAnfrageId = null;
    }

    rechnungUploadSchliessenButton.addEventListener("click", schliesseRechnungUpload);
    rechnungUploadOverlay.addEventListener("click", (event) => {
      if (event.target === rechnungUploadOverlay) schliesseRechnungUpload();
    });

    rechnungUploadErfolgSchliessenButton.addEventListener("click", async () => {
      schliesseRechnungUpload();
      // Zeile in "Meine Anfragen" direkt aktualisieren, damit der Button
      // sofort durch den "hochgeladen"-Hinweis ersetzt wird.
      await ladeMeineAnfragen();
    });

    rechnungDateiEingabe.addEventListener("change", async () => {
      const datei = rechnungDateiEingabe.files && rechnungDateiEingabe.files[0];
      if (!datei) return;

      rechnungUploadHinweis.hidden = true;
      rechnungHochladenButton.disabled = true;

      try {
        const { base64, mime, vorschauUrl } = await komprimiereBildAufBase64(datei);
        rechnungUploadBase64 = base64;
        rechnungUploadMime = mime;
        rechnungVorschauBild.src = vorschauUrl;
        rechnungVorschauBild.hidden = false;
        rechnungHochladenButton.disabled = false;
      } catch (e) {
        rechnungUploadHinweis.textContent = "Foto konnte nicht gelesen werden - bitte nochmal versuchen.";
        rechnungUploadHinweis.hidden = false;
      }
    });

    rechnungHochladenButton.addEventListener("click", async () => {
      if (!rechnungUploadAnfrageId || !rechnungUploadBase64) return;

      rechnungHochladenButton.disabled = true;
      rechnungUploadHinweis.hidden = true;

      const { error } = await sb.rpc("schiri_anfrage_rechnung_hochladen", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
        p_anfrage_id: rechnungUploadAnfrageId,
        p_bild_base64: rechnungUploadBase64,
        p_mime: rechnungUploadMime,
      });

      if (error) {
        rechnungHochladenButton.disabled = false;
        rechnungUploadHinweis.textContent = "Konnte leider nicht hochgeladen werden: " + error.message;
        rechnungUploadHinweis.hidden = false;
        return;
      }

      rechnungUploadInhalt.hidden = true;
      rechnungUploadErfolg.hidden = false;
    });

    // Prüft beim Anmelden, ob es unerledigte Status-Änderungen gibt (Ersatz für
    // fehlende Push-Benachrichtigungen - siehe Nav-Brainstorm-Skizze, Konzept B).
    async function aktualisiereAnfragenStatusPunkt() {
      if (!getZugang().schiedsrichterId || !getZugang().pin) return;

      const { data, error } = await sb.rpc("schiri_anfragen_liste", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
      });
      if (error || !data) return;

      const gibtUngeseheneUpdates = data.some((anfrage) => !anfrage.schiri_gesehen);
      if (profilStatusPunkt) profilStatusPunkt.hidden = !gibtUngeseheneUpdates;
      if (panelAnfragenStatusPunkt) panelAnfragenStatusPunkt.hidden = !gibtUngeseheneUpdates;
      if (beiStatusPunkt) beiStatusPunkt(gibtUngeseheneUpdates);
    }

    return Object.freeze({
      aktualisiereAnfragenStatusPunkt,
      oeffneAusruestungsAnfrage,
      oeffneRechnungUpload,
    });
  }

  global.SchiriQuizProfileRequests = Object.freeze({ erstelleProfilAnfragen });
})(globalThis);
