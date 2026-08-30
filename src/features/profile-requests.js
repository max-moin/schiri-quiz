(function stelleProfilAnfragenBereit(global) {
  "use strict";

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
  function erstelleProfilAnfragen({ sb, getZugang, zeigeFehler, formatiereAnfrageDatum, beiStatusPunkt }) {
    const angemeldetBadgeButton = document.getElementById("angemeldet-badge-button");
    const profilPanel = document.getElementById("profil-panel");
    const profilStatusPunkt = document.getElementById("profil-status-punkt");
    const panelAnfrageStellenButton = document.getElementById("panel-anfrage-stellen-button");
    const panelMeineAnfragenButton = document.getElementById("panel-meine-anfragen-button");
    const panelAnfragenStatusPunkt = document.getElementById("panel-anfragen-status-punkt");
    const anfrageFormularOverlay = document.getElementById("anfrage-formular-overlay");
    const anfrageFormularSchliessenButton = document.getElementById("anfrage-formular-schliessen-button");
    const anfrageFormularInhalt = document.getElementById("anfrage-formular-inhalt");
    const anfrageFormularErfolg = document.getElementById("anfrage-formular-erfolg");
    const anfrageFormularErfolgSchliessenButton = document.getElementById("anfrage-formular-erfolg-schliessen-button");
    const anfrageKategorieAuswahl = document.getElementById("anfrage-kategorie-auswahl");
    const anfrageFarbeEingabe = document.getElementById("anfrage-farbe-eingabe");
    const anfrageGroesseEingabe = document.getElementById("anfrage-groesse-eingabe");
    const anfrageAermellaengeBereich = document.getElementById("anfrage-aermellaenge-bereich");
    const anfrageAermellaengeAuswahl = document.getElementById("anfrage-aermellaenge-auswahl");
    const anfrageAnmerkungEingabe = document.getElementById("anfrage-anmerkung-eingabe");
    const anfrageFormularHinweis = document.getElementById("anfrage-formular-hinweis");
    const anfrageAbsendenButton = document.getElementById("anfrage-absenden-button");
    const meineAnfragenOverlay = document.getElementById("meine-anfragen-overlay");
    const meineAnfragenSchliessenButton = document.getElementById("meine-anfragen-schliessen-button");
    const meineAnfragenListe = document.getElementById("meine-anfragen-liste");
    const meineAnfragenLeerHinweis = document.getElementById("meine-anfragen-leer-hinweis");
    const panelAnliegenMeldenButton = document.getElementById("panel-anliegen-melden-button");
    const anliegenFormularOverlay = document.getElementById("anliegen-formular-overlay");
    const anliegenFormularSchliessenButton = document.getElementById("anliegen-formular-schliessen-button");
    const anliegenFormularInhalt = document.getElementById("anliegen-formular-inhalt");
    const anliegenFormularErfolg = document.getElementById("anliegen-formular-erfolg");
    const anliegenFormularErfolgSchliessenButton = document.getElementById("anliegen-formular-erfolg-schliessen-button");
    const anliegenTextEingabe = document.getElementById("anliegen-text-eingabe");
    const anliegenFormularHinweis = document.getElementById("anliegen-formular-hinweis");
    const anliegenAbsendenButton = document.getElementById("anliegen-absenden-button");
    const rechnungUploadOverlay = document.getElementById("rechnung-upload-overlay");
    const rechnungUploadSchliessenButton = document.getElementById("rechnung-upload-schliessen-button");
    const rechnungUploadInhalt = document.getElementById("rechnung-upload-inhalt");
    const rechnungUploadErfolg = document.getElementById("rechnung-upload-erfolg");
    const rechnungUploadErfolgSchliessenButton = document.getElementById("rechnung-upload-erfolg-schliessen-button");
    const rechnungDateiEingabe = document.getElementById("rechnung-datei-eingabe");
    const rechnungVorschauBild = document.getElementById("rechnung-vorschau-bild");
    const rechnungUploadHinweis = document.getElementById("rechnung-upload-hinweis");
    const rechnungHochladenButton = document.getElementById("rechnung-hochladen-button");

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (profilPanel && !profilPanel.hidden) schliesseProfilPanel();
      if (anfrageFormularOverlay && !anfrageFormularOverlay.hidden) schliesseAnfrageFormular();
      if (meineAnfragenOverlay && !meineAnfragenOverlay.hidden) schliesseMeineAnfragen();
      if (anliegenFormularOverlay && !anliegenFormularOverlay.hidden) schliesseAnliegenFormular();
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
      anfrageGroesseEingabe.value = "";
      anfrageAermellaengeAuswahl.value = "";
      anfrageAermellaengeBereich.hidden = true;
      anfrageAnmerkungEingabe.value = "";
      anfrageFormularHinweis.hidden = true;
      anfrageFormularInhalt.hidden = false;
      anfrageFormularErfolg.hidden = true;
    }

    // Ärmellänge ist nur bei Trikots eine sinnvolle Angabe.
    anfrageKategorieAuswahl.addEventListener("change", () => {
      anfrageAermellaengeBereich.hidden = anfrageKategorieAuswahl.value !== "trikot";
    });

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

    const ANFRAGE_KATEGORIE_LABEL = { trikot: "Trikot", hose: "Hose", stutzen: "Stutzen", schuhe: "Schuhe" };
    const ANFRAGE_STATUS_LABEL = { offen: "Offen", angenommen: "Angenommen", abgelehnt: "Abgelehnt", erledigt: "Erledigt" };

    // Merkt sich, für welche Anfrage gerade eine Rechnung hochgeladen wird
    // (gesetzt beim Öffnen von "#rechnung-upload-overlay" über eine Zeile in
    // "Meine Anfragen") sowie das im Browser schon komprimierte Bild.
    let rechnungUploadAnfrageId = null;
    let rechnungUploadBase64 = null;
    let rechnungUploadMime = null;

    function baueAnfrageZeile(anfrage) {
      // Bugfix (Feedback nach Baustein 5c, 12.07.2026): "Meine Anfragen" zeigt
      // seit "ladeMeineAnfragen()" nur noch Ausrüstungs-Anträge (kein "Anliegen"
      // mehr) - der Typ-Badge war dadurch immer nur noch "Antrag" und damit
      // reine Redundanz, deshalb hier entfernt statt eines dauerhaft
      // gleichbleibenden Labels.
      const zeile = document.createElement("div");
      zeile.className = "anfrage-zeile";

      const kopf = document.createElement("div");
      kopf.className = "anfrage-zeile-kopf";

      const titel = document.createElement("span");
      titel.className = "anfrage-zeile-titel";
      titel.textContent = ANFRAGE_KATEGORIE_LABEL[anfrage.kategorie] || anfrage.kategorie;
      kopf.appendChild(titel);

      const statusBadge = document.createElement("span");
      statusBadge.className = "anfrage-status-badge " + anfrage.status;
      statusBadge.textContent = ANFRAGE_STATUS_LABEL[anfrage.status] || anfrage.status;
      kopf.appendChild(statusBadge);

      zeile.appendChild(kopf);

      const detailTeile = [];
      if (anfrage.farbe) detailTeile.push(anfrage.farbe);
      if (anfrage.groesse) detailTeile.push("Größe " + anfrage.groesse);
      if (anfrage.aermellaenge) detailTeile.push(anfrage.aermellaenge === "kurz" ? "Kurzarm" : "Langarm");
      detailTeile.push(formatiereAnfrageDatum(anfrage.erstellt_am));

      const detail = document.createElement("p");
      detail.className = "anfrage-zeile-detail";
      detail.textContent = detailTeile.join(" · ");
      zeile.appendChild(detail);

      if (anfrage.anmerkung) {
        const anmerkung = document.createElement("p");
        anmerkung.className = "anfrage-zeile-detail";
        anmerkung.textContent = "„" + anfrage.anmerkung + "“";
        zeile.appendChild(anmerkung);
      }

      // Baustein 5c (Baustein D, Weg 2): sobald der Obmann "Schiri besorgt es
      // selbst" gewählt hat, kann hier die Rechnung hochgeladen werden - genau
      // einmal, danach nur noch ein Status-Hinweis statt des Buttons.
      if (anfrage.typ !== "anliegen" && anfrage.status === "angenommen" && anfrage.beschaffungsweg === "weg2_schiri_besorgt") {
        if (anfrage.rechnung_hochgeladen_am) {
          const rechnungStatus = document.createElement("p");
          rechnungStatus.className = "anfrage-zeile-rechnung-status";
          rechnungStatus.textContent = anfrage.erstattet
            ? "✓ Rechnung hochgeladen, Geld überwiesen"
            : "✓ Rechnung hochgeladen am " + formatiereAnfrageDatum(anfrage.rechnung_hochgeladen_am);
          zeile.appendChild(rechnungStatus);
        } else {
          const rechnungButton = document.createElement("button");
          rechnungButton.type = "button";
          rechnungButton.className = "anfrage-zeile-rechnung-button";
          rechnungButton.textContent = "🧾 Rechnung hochladen";
          rechnungButton.addEventListener("click", () => oeffneRechnungUpload(anfrage.id));
          zeile.appendChild(rechnungButton);
        }
      }

      return zeile;
    }

    async function ladeMeineAnfragen() {
      meineAnfragenListe.innerHTML = "";
      meineAnfragenLeerHinweis.hidden = true;

      const { data, error } = await sb.rpc("schiri_anfragen_liste", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
      });

      if (error) {
        zeigeFehler("Anfragen konnten nicht geladen werden: " + error.message);
        return;
      }

      // Bugfix (Feedback nach Baustein 5c, 12.07.2026, Max: "wenn man da was
      // schreibt [ein Anliegen], dass das nicht mit in meine Anfragen
      // aufgelistet wird"): "Meine Anfragen" zeigt jetzt bewusst NUR
      // Ausrüstungs-Anträge - ein Anliegen ist eine einmalige Meldung an den
      // Obmann, kein Status, den der Schiri selbst weiterverfolgen soll (anders
      // als ein Ausrüstungs-Antrag mit Annahme/Beschaffungsweg/Rechnung).
      const antraege = (data || []).filter((anfrage) => anfrage.typ !== "anliegen");

      if (antraege.length === 0) {
        meineAnfragenLeerHinweis.hidden = false;
        return;
      }

      antraege.forEach((anfrage) => meineAnfragenListe.appendChild(baueAnfrageZeile(anfrage)));
    }

    function schliesseMeineAnfragen() {
      meineAnfragenOverlay.hidden = true;
    }

    meineAnfragenSchliessenButton.addEventListener("click", schliesseMeineAnfragen);
    meineAnfragenOverlay.addEventListener("click", (event) => {
      if (event.target === meineAnfragenOverlay) schliesseMeineAnfragen();
    });

    async function oeffneMeineAnfragen() {
      schliesseProfilPanel();
      meineAnfragenOverlay.hidden = false;
      await ladeMeineAnfragen();

      // Status-Punkt verschwindet, sobald die Liste einmal geöffnet wurde.
      if (profilStatusPunkt) profilStatusPunkt.hidden = true;
      if (panelAnfragenStatusPunkt) panelAnfragenStatusPunkt.hidden = true;
      if (beiStatusPunkt) beiStatusPunkt(false);
      await sb.rpc("schiri_anfragen_als_gesehen_markieren", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
      });
    }

    if (panelMeineAnfragenButton) {
      panelMeineAnfragenButton.addEventListener("click", () => void oeffneMeineAnfragen());
    }

    // ---------- Anliegen-Formular (Baustein 5c, Baustein E) ----------

    function setzeAnliegenFormularZurueck() {
      anliegenTextEingabe.value = "";
      anliegenFormularHinweis.hidden = true;
      anliegenFormularInhalt.hidden = false;
      anliegenFormularErfolg.hidden = true;
    }

    function oeffneAnliegen() {
      schliesseProfilPanel();
      setzeAnliegenFormularZurueck();
      anliegenFormularOverlay.hidden = false;
    }

    if (panelAnliegenMeldenButton) {
      panelAnliegenMeldenButton.addEventListener("click", oeffneAnliegen);
    }

    function schliesseAnliegenFormular() {
      anliegenFormularOverlay.hidden = true;
    }

    anliegenFormularSchliessenButton.addEventListener("click", schliesseAnliegenFormular);
    anliegenFormularErfolgSchliessenButton.addEventListener("click", schliesseAnliegenFormular);
    anliegenFormularOverlay.addEventListener("click", (event) => {
      if (event.target === anliegenFormularOverlay) schliesseAnliegenFormular();
    });

    anliegenAbsendenButton.addEventListener("click", async () => {
      const text = anliegenTextEingabe.value.trim();
      if (!text) {
        anliegenFormularHinweis.textContent = "Schreib kurz, was los ist - dann kann ich mich darum kümmern.";
        anliegenFormularHinweis.hidden = false;
        return;
      }

      anliegenFormularHinweis.hidden = true;
      anliegenAbsendenButton.disabled = true;

      const { error } = await sb.rpc("schiri_anfrage_erstellen", {
        p_schiedsrichter_id: getZugang().schiedsrichterId,
        p_pin: getZugang().pin,
        p_kategorie: null,
        p_anmerkung: text,
        p_typ: "anliegen",
      });

      anliegenAbsendenButton.disabled = false;

      if (error) {
        anliegenFormularHinweis.textContent = "Konnte leider nicht gespeichert werden: " + error.message;
        anliegenFormularHinweis.hidden = false;
        return;
      }

      anliegenFormularInhalt.hidden = true;
      anliegenFormularErfolg.hidden = false;
    });

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
      oeffneAnliegen,
      oeffneMeineAnfragen,
    });
  }

  global.SchiriQuizProfileRequests = Object.freeze({ erstelleProfilAnfragen });
})(globalThis);
