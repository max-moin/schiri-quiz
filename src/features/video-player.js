(function stelleVideoPlayerBereit(global) {
  "use strict";

  const { extrahiereYoutubeId } = global.SchiriQuizUtils;

  let youtubeApiPromise = null;
  function ladeYoutubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      let abgeschlossen = false;
      const apiZeitlimit = window.setTimeout(() => {
        if (abgeschlossen) return;
        abgeschlossen = true;
        youtubeApiPromise = null;
        const altesScript = document.getElementById("youtube-iframe-api");
        if (altesScript) altesScript.remove();
        reject(new Error("YouTube hat nicht rechtzeitig geantwortet."));
      }, 12000);

      function erfolgreich() {
        if (abgeschlossen) return;
        abgeschlossen = true;
        window.clearTimeout(apiZeitlimit);
        resolve(window.YT);
      }

      function fehlgeschlagen() {
        if (abgeschlossen) return;
        abgeschlossen = true;
        window.clearTimeout(apiZeitlimit);
        youtubeApiPromise = null;
        const altesScript = document.getElementById("youtube-iframe-api");
        if (altesScript) altesScript.remove();
        reject(new Error("Die YouTube-Schnittstelle konnte nicht geladen werden."));
      }

      const vorherigerHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof vorherigerHandler === "function") vorherigerHandler();
        erfolgreich();
      };

      let script = document.getElementById("youtube-iframe-api");
      if (!script) {
        script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
      script.addEventListener("error", fehlgeschlagen, { once: true });
    });
    return youtubeApiPromise;
  }

  // YouTube blendet Untertitel von sich aus ein - besonders bei stummen
  // Videos, wo der Player automatische Untertitel zuschaltet, und bei allen,
  // die in ihrem YouTube-Konto "Untertitel immer anzeigen" stehen haben.
  //
  // Bei Regelfragen ist das ein echtes Problem und nicht nur haesslich: Der
  // Kommentator sagt oft genau das, was die Frage wissen will ("klares Foul,
  // das muss Rot sein"). Steht das als Text im Bild, ist die Loesung
  // mitgeliefert - und zwar ausgerechnet bei den stummgeschalteten Videos,
  // die stumm sind, damit der Kommentar NICHT verraet.
  //
  // "cc_load_policy: 0" allein reicht nicht: Die 0 bedeutet laut YouTube
  // nicht "aus", sondern "nimm die Einstellung des Nutzers". Zuverlaessig ist
  // nur, das Untertitel-Modul im Player selbst zu entladen. Es heisst je nach
  // Player-Generation "captions" oder "cc" - deshalb beide, und deshalb in
  // try/catch: Ein nicht geladenes Modul zu entladen wirft, und das ist der
  // Normalfall, kein Fehler.
  function unterdrueckeUntertitel(player) {
    if (!player) return false;
    let erfolgreich = false;

    if (typeof player.unloadModule === "function") {
      for (const modul of ["captions", "cc"]) {
        try {
          player.unloadModule(modul);
          erfolgreich = true;
        } catch (fehler) {
          // Modul war nicht geladen - nichts zu tun.
        }
      }
    }

    // Zweiter, unabhaengiger Weg: die Spur ausdruecklich leeren. Wenn das
    // Entladen an einer Player-Generation vorbeigeht, greift meist das hier.
    if (typeof player.setOption === "function") {
      try {
        player.setOption("captions", "track", {});
        erfolgreich = true;
      } catch (fehler) {
        // Auch hier: kein Grund, die Wiedergabe zu stoeren.
      }
    }

    return erfolgreich;
  }

  // Gemeinsame Großansicht für alle Video-Fragen. Der YouTube-Player wird
  // ausschließlich hier aufgebaut; in der kleinen Fragenkarte liegt niemals
  // ein iframe. Das ist auf Mobilgeräten verlässlicher und verhindert die
  // frühere fehleranfällige Verschiebe-Logik zwischen Karte und Dialog.
  let aktuellerVideoGrossController = null;
  let letzterVideoGrossTrigger = null;

  function schliesseVideoGrossansicht() {
    const overlay = document.getElementById("video-gross-overlay");
    const halter = document.getElementById("video-gross-spieler-halter");
    if (!overlay || !halter) return;
    const controller = aktuellerVideoGrossController;
    aktuellerVideoGrossController = null;
    if (controller && typeof controller.beimSchliessen === "function") {
      controller.beimSchliessen();
    }
    halter.replaceChildren();
    overlay.hidden = true;
    document.body.classList.remove("video-dialog-offen");
    if (letzterVideoGrossTrigger && document.contains(letzterVideoGrossTrigger)) {
      letzterVideoGrossTrigger.focus();
    }
    letzterVideoGrossTrigger = null;
  }

  function oeffneVideoGrossansicht(inhalt, ausloeser, controller) {
    const overlay = document.getElementById("video-gross-overlay");
    const halter = document.getElementById("video-gross-spieler-halter");
    if (!overlay || !halter) return;
    if (!overlay.hidden) schliesseVideoGrossansicht();
    halter.replaceChildren(inhalt);
    aktuellerVideoGrossController = controller || null;
    letzterVideoGrossTrigger = ausloeser || document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("video-dialog-offen");
    const schliessenButton = document.getElementById("video-gross-schliessen-button");
    if (schliessenButton) schliessenButton.focus();
  }

  (function initVideoGrossansichtOverlay() {
    const overlay = document.getElementById("video-gross-overlay");
    if (!overlay) return;
    const schliessenButton = document.getElementById("video-gross-schliessen-button");
    if (schliessenButton) schliessenButton.addEventListener("click", schliesseVideoGrossansicht);
    overlay.addEventListener("click", (ereignis) => {
      if (ereignis.target === overlay) schliesseVideoGrossansicht();
    });
    document.addEventListener("keydown", (ereignis) => {
      if (ereignis.key === "Escape" && !overlay.hidden) schliesseVideoGrossansicht();
    });
  })();

  let videoInfoZaehler = 0;

  // Modal-first-Player (24.08.2026): Der eigentliche YouTube-Player entsteht
  // erst nach dem Klick und direkt in der Großansicht. Die Fragenkarte bleibt
  // eine einfache, robuste Startkarte. Ein optionaler Info-Bereich hält
  // Zeitfenster und Situationsbeschreibung als Fallback bereit, falls die
  // Wiedergabe auf einem Gerät nicht zuverlässig funktioniert.
  function baueVideoEinbettungModal(videoUrl, startSekunden, endSekunden, stumm, fallbackBeschreibung = "") {
    const videoId = extrahiereYoutubeId(videoUrl);
    if (!videoId) return null;

    const alsSekunden = (wert) => {
      if (wert === null || wert === undefined || wert === "") return null;
      const zahl = Number(wert);
      return Number.isFinite(zahl) && zahl >= 0 ? zahl : null;
    };
    const clipStart = alsSekunden(startSekunden) ?? 0;
    const rohesClipEnde = alsSekunden(endSekunden);
    const clipEnde = rohesClipEnde !== null && rohesClipEnde > clipStart ? rohesClipEnde : null;
    const beschreibung = String(fallbackBeschreibung || "").trim();

    const formatiereZeit = (sekunden) => {
      const ganz = Math.max(0, Math.floor(sekunden));
      const minuten = Math.floor(ganz / 60);
      const rest = String(ganz % 60).padStart(2, "0");
      return `${minuten}:${rest}`;
    };

    const wrap = document.createElement("div");
    wrap.className = "video-einbettung video-einbettung-modal";

    let bereitsAngesehen = false;
    let fortsetzenSekunden = clipStart;
    let fehlerNachricht = "";

    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.className = "video-platzhalter";

    const badge = document.createElement("span");
    badge.className = "video-platzhalter-badge";
    badge.textContent = "✓ Angesehen";
    badge.hidden = true;
    startButton.appendChild(badge);

    const icon = document.createElement("span");
    icon.className = "video-platzhalter-icon";
    icon.textContent = "▶";
    startButton.appendChild(icon);

    const startText = document.createElement("span");
    startText.className = "video-platzhalter-text";
    startButton.appendChild(startText);

    const startHinweis = document.createElement("span");
    startHinweis.className = "video-platzhalter-hinweis";
    startButton.appendChild(startHinweis);
    wrap.appendChild(startButton);

    function hatFortsetzungsstand() {
      return fortsetzenSekunden > clipStart + 0.5 && (!clipEnde || fortsetzenSekunden < clipEnde - 0.5);
    }

    function aktualisiereStartkarte() {
      const fortsetzen = hatFortsetzungsstand();
      startButton.classList.toggle("video-platzhalter-angesehen", bereitsAngesehen);
      startButton.classList.toggle("video-platzhalter-fehler", Boolean(fehlerNachricht));
      badge.hidden = !bereitsAngesehen;
      icon.textContent = fehlerNachricht || bereitsAngesehen ? "↻" : "▶";
      startText.textContent = fehlerNachricht
        ? "Video erneut laden"
        : fortsetzen
          ? `Video bei ${formatiereZeit(fortsetzenSekunden)} fortsetzen`
          : bereitsAngesehen
            ? "Video nochmal ansehen"
            : "Video ansehen";
      startHinweis.textContent = fehlerNachricht || (stumm
        ? "Öffnet direkt in der Großansicht – ohne Ton."
        : "Öffnet direkt in der Großansicht.");
    }

    const hatInfo = Boolean(beschreibung) || clipStart > 0 || clipEnde !== null;
    if (hatInfo) {
      const aktionen = document.createElement("div");
      aktionen.className = "video-karten-aktionen";

      const infoButton = document.createElement("button");
      infoButton.type = "button";
      infoButton.className = "video-info-button";
      infoButton.textContent = "ⓘ Hilfe zum Video";
      const infoId = `video-info-${++videoInfoZaehler}`;
      infoButton.setAttribute("aria-controls", infoId);
      infoButton.setAttribute("aria-expanded", "false");

      const infoPanel = document.createElement("div");
      infoPanel.id = infoId;
      infoPanel.className = "video-info-panel";
      infoPanel.hidden = true;
      infoPanel.setAttribute("role", "note");

      const bedienungTitel = document.createElement("p");
      bedienungTitel.className = "video-info-titel";
      bedienungTitel.textContent = "Bedienung";
      infoPanel.appendChild(bedienungTitel);

      const bedienung = document.createElement("p");
      bedienung.textContent = "Tippe auf „Video ansehen“. In der Großansicht kannst du das Video pausieren, neu starten oder mit dem X schließen.";
      infoPanel.appendChild(bedienung);

      const ausschnittTitel = document.createElement("p");
      ausschnittTitel.className = "video-info-titel";
      ausschnittTitel.textContent = "Gesuchter Ausschnitt";
      infoPanel.appendChild(ausschnittTitel);

      const zeit = document.createElement("p");
      zeit.className = "video-info-zeit";
      zeit.textContent = clipEnde !== null
        ? `Vorgesehener Ausschnitt: ${formatiereZeit(clipStart)} bis ${formatiereZeit(clipEnde)}`
        : `Vorgesehener Start: ${formatiereZeit(clipStart)}`;
      infoPanel.appendChild(zeit);

      if (beschreibung) {
        const situation = document.createElement("p");
        situation.textContent = beschreibung;
        infoPanel.appendChild(situation);
      }

      const fallback = document.createElement("p");
      fallback.className = "video-info-fallback";
      fallback.textContent = beschreibung
        ? "Falls das Video auf deinem Gerät nicht funktioniert, kannst du die Frage anhand dieser Beschreibung beantworten."
        : "Der Zeitbereich hilft dir, den vorgesehenen Ausschnitt gezielt erneut zu starten.";
      infoPanel.appendChild(fallback);

      infoButton.addEventListener("click", () => {
        const wirdGeoeffnet = infoPanel.hidden;
        infoPanel.hidden = !wirdGeoeffnet;
        infoButton.setAttribute("aria-expanded", String(wirdGeoeffnet));
        infoButton.textContent = wirdGeoeffnet ? "ⓘ Hilfe schließen" : "ⓘ Hilfe zum Video";
      });

      aktionen.appendChild(infoButton);
      wrap.appendChild(aktionen);
      wrap.appendChild(infoPanel);
    }

    function oeffnePlayerDialog(ausloeser) {
      bereitsAngesehen = true;
      fehlerNachricht = "";
      startButton.disabled = true;
      aktualisiereStartkarte();

      const dialogInhalt = document.createElement("div");
      dialogInhalt.className = "video-dialog-sitzung";
      const sitzung = {
        aktiv: true,
        player: null,
        intervall: null,
        untertitelZeitgeber: [],
      };

      // Einmal bei onReady zu entladen genuegt nicht: YouTube laedt das
      // Untertitel-Modul beim tatsaechlichen Abspielstart teilweise neu.
      // Deshalb wird die Unterdrueckung ein paar Mal nachgezogen, statt sich
      // auf einen einzigen Zeitpunkt zu verlassen.
      function ziehUntertitelUnterdrueckungNach() {
        for (const id of sitzung.untertitelZeitgeber.splice(0)) {
          window.clearTimeout(id);
        }
        for (const verzoegerung of [0, 300, 1200, 3000]) {
          const id = window.setTimeout(() => {
            if (!sitzung.aktiv || !sitzung.player) return;
            unterdrueckeUntertitel(sitzung.player);
          }, verzoegerung);
          sitzung.untertitelZeitgeber.push(id);
        }
      }

      function stoppeIntervall() {
        if (sitzung.intervall) {
          window.clearInterval(sitzung.intervall);
          sitzung.intervall = null;
        }
        // Sonst laeuft ein Nachzieh-Zeitgeber noch auf einen zerstoerten
        // Player und wirft dort ins Leere.
        for (const id of sitzung.untertitelZeitgeber.splice(0)) {
          window.clearTimeout(id);
        }
      }

      function raeumePlayerAuf(speicherePosition) {
        stoppeIntervall();
        if (sitzung.player) {
          if (speicherePosition && typeof sitzung.player.getCurrentTime === "function") {
            const aktuelleZeit = Number(sitzung.player.getCurrentTime());
            if (Number.isFinite(aktuelleZeit) && aktuelleZeit > clipStart + 0.5 && (!clipEnde || aktuelleZeit < clipEnde - 0.5)) {
              fortsetzenSekunden = aktuelleZeit;
            } else {
              fortsetzenSekunden = clipStart;
            }
          }
          if (typeof sitzung.player.destroy === "function") sitzung.player.destroy();
          sitzung.player = null;
        }
      }

      const controller = {
        beimSchliessen() {
          sitzung.aktiv = false;
          raeumePlayerAuf(true);
          startButton.disabled = false;
          aktualisiereStartkarte();
        },
      };

      function youtubeFehlertext(code) {
        if (code === 100) return "Das Video wurde entfernt oder ist privat.";
        if (code === 101 || code === 150) return "YouTube erlaubt die Einbettung dieses Videos nicht.";
        if (code === 153) return "YouTube konnte diese Seite nicht eindeutig zuordnen. Bitte neu laden.";
        return "Das Video kann momentan nicht abgespielt werden.";
      }

      function zeigeDialogkarte(titel, text, primaerText, primaerAktion) {
        const karte = document.createElement("div");
        karte.className = "video-dialog-karte";
        const iconElement = document.createElement("span");
        iconElement.className = "video-dialog-karte-icon";
        iconElement.textContent = titel === "Ausschnitt beendet" ? "✓" : "!";
        karte.appendChild(iconElement);
        const ueberschrift = document.createElement("h3");
        ueberschrift.textContent = titel;
        karte.appendChild(ueberschrift);
        const beschreibungElement = document.createElement("p");
        beschreibungElement.textContent = text;
        karte.appendChild(beschreibungElement);

        const aktionen = document.createElement("div");
        aktionen.className = "video-dialog-karte-aktionen";
        const primaer = document.createElement("button");
        primaer.type = "button";
        primaer.className = "video-dialog-primaer-button";
        primaer.textContent = primaerText;
        primaer.addEventListener("click", primaerAktion);
        aktionen.appendChild(primaer);
        const zurFrage = document.createElement("button");
        zurFrage.type = "button";
        zurFrage.className = "video-dialog-sekundaer-button";
        zurFrage.textContent = "Zur Frage";
        zurFrage.addEventListener("click", schliesseVideoGrossansicht);
        aktionen.appendChild(zurFrage);
        karte.appendChild(aktionen);
        dialogInhalt.replaceChildren(karte);
        window.setTimeout(() => primaer.focus(), 0);
      }

      function startePlayer(abSekunde) {
        if (!sitzung.aktiv) return;
        raeumePlayerAuf(false);
        fehlerNachricht = "";
        fortsetzenSekunden = abSekunde;

        const buehne = document.createElement("div");
        buehne.className = "video-spieler-buehne ist-gross";
        const spielerHalter = document.createElement("div");
        spielerHalter.className = "video-spieler-halter";
        const ladeText = document.createElement("p");
        ladeText.className = "video-ladeanzeige";
        ladeText.textContent = "Video wird geladen …";
        spielerHalter.appendChild(ladeText);
        buehne.appendChild(spielerHalter);

        const bedienleiste = document.createElement("div");
        bedienleiste.className = "video-bedienleiste";
        const abspielButton = document.createElement("button");
        abspielButton.type = "button";
        abspielButton.className = "video-abspiel-button";
        abspielButton.disabled = true;
        const abspielSymbol = document.createElement("span");
        abspielSymbol.className = "video-button-symbol";
        abspielSymbol.setAttribute("aria-hidden", "true");
        const abspielBeschriftung = document.createElement("span");
        abspielBeschriftung.className = "video-button-beschriftung";
        abspielButton.append(abspielSymbol, abspielBeschriftung);
        bedienleiste.appendChild(abspielButton);

        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "video-reset-button";
        const resetSymbol = document.createElement("span");
        resetSymbol.className = "video-button-symbol";
        resetSymbol.setAttribute("aria-hidden", "true");
        resetSymbol.textContent = "↻";
        const resetBeschriftung = document.createElement("span");
        resetBeschriftung.className = "video-button-beschriftung";
        resetBeschriftung.textContent = "Neu starten";
        resetButton.append(resetSymbol, resetBeschriftung);
        resetButton.setAttribute("aria-label", "Video neu starten");
        resetButton.title = "Video neu starten";
        resetButton.disabled = true;
        bedienleiste.appendChild(resetButton);

        const status = document.createElement("span");
        status.className = "video-status";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.hidden = true;
        bedienleiste.appendChild(status);
        buehne.appendChild(bedienleiste);
        dialogInhalt.replaceChildren(buehne);

        function zeigeStatus(meldung) {
          status.textContent = meldung;
          status.hidden = !meldung;
        }

        function setzeAbspielKnopf(zustand) {
          if (zustand === "laedt") {
            abspielSymbol.textContent = "…";
            abspielBeschriftung.textContent = "Lädt";
            abspielButton.disabled = true;
            abspielButton.classList.remove("laeuft");
            abspielButton.setAttribute("aria-label", "Video wird geladen");
            abspielButton.title = "Video wird geladen";
            return;
          }
          const laeuft = zustand === "laeuft";
          abspielButton.disabled = false;
          abspielSymbol.textContent = laeuft ? "❚❚" : "▶";
          abspielBeschriftung.textContent = laeuft ? "Pausieren" : "Abspielen";
          abspielButton.classList.toggle("laeuft", laeuft);
          const zugangstext = laeuft ? "Video anhalten" : "Video abspielen";
          abspielButton.setAttribute("aria-label", zugangstext);
          abspielButton.title = zugangstext;
        }
        setzeAbspielKnopf("laedt");

        let durchlaufBeendet = false;
        let untertitelBeimAbspielenNachgezogen = false;
        const VORLAUF_SEKUNDEN = 0.55;

        function zeigeEndkarte() {
          if (durchlaufBeendet || !sitzung.aktiv) return;
          durchlaufBeendet = true;
          raeumePlayerAuf(false);
          fortsetzenSekunden = clipStart;
          aktualisiereStartkarte();
          zeigeDialogkarte(
            "Ausschnitt beendet",
            "Du kannst den Ausschnitt erneut ansehen oder direkt zur Frage zurückkehren.",
            "↻ Erneut ansehen",
            () => startePlayer(clipStart)
          );
        }

        function synchronisiereZustand(YT) {
          if (!sitzung.player || durchlaufBeendet) return;
          const zustand = sitzung.player.getPlayerState();
          if (zustand === YT.PlayerState.ENDED) {
            zeigeEndkarte();
            return;
          }
          if (zustand === YT.PlayerState.PLAYING) {
            // Genau hier laedt YouTube die automatischen Untertitel bei
            // stummen Videos nach. Einmal je Durchlauf reicht - diese
            // Funktion laeuft aus einem 200-ms-Intervall und darf nicht
            // fuenfmal pro Sekunde am Player herumschalten.
            if (!untertitelBeimAbspielenNachgezogen) {
              untertitelBeimAbspielenNachgezogen = true;
              ziehUntertitelUnterdrueckungNach();
            }
            setzeAbspielKnopf("laeuft");
            zeigeStatus("");
          } else if (zustand === YT.PlayerState.BUFFERING) {
            setzeAbspielKnopf("laedt");
            zeigeStatus("Video lädt …");
          } else {
            setzeAbspielKnopf("pausiert");
          }
        }

        ladeYoutubeApi().then((YT) => {
          if (!sitzung.aktiv || durchlaufBeendet) return;
          const spielerZiel = document.createElement("div");
          spielerHalter.replaceChildren(spielerZiel);
          const playerVars = {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            rel: 0,
            iv_load_policy: 3,
            // Kein Force-Off, sondern nur "nicht ausdruecklich einschalten".
            // Das eigentliche Abschalten macht unterdrueckeUntertitel().
            cc_load_policy: 0,
            fs: 0,
            playsinline: 1,
            hl: "de",
            start: Math.max(0, Math.floor(abSekunde)),
          };
          if (clipEnde !== null) playerVars.end = Math.max(0, Math.floor(clipEnde));
          if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            playerVars.origin = window.location.origin;
          }

          sitzung.player = new YT.Player(spielerZiel, {
            host: "https://www.youtube-nocookie.com",
            videoId,
            playerVars,
            events: {
              onReady: () => {
                if (!sitzung.aktiv || !sitzung.player) return;
                resetButton.disabled = false;
                setzeAbspielKnopf("pausiert");
                if (stumm && typeof sitzung.player.mute === "function") sitzung.player.mute();
                // Vor dem playVideo() unten, damit gar nicht erst ein Frame
                // mit Untertiteln zu sehen ist.
                unterdrueckeUntertitel(sitzung.player);
                ziehUntertitelUnterdrueckungNach();

                abspielButton.addEventListener("click", () => {
                  if (!sitzung.player) return;
                  if (sitzung.player.getPlayerState() === YT.PlayerState.PLAYING) {
                    sitzung.player.pauseVideo();
                  } else {
                    sitzung.player.playVideo();
                  }
                  window.setTimeout(() => synchronisiereZustand(YT), 80);
                });
                resetButton.addEventListener("click", () => startePlayer(clipStart));

                // Safari liefert Zustandsereignisse bei eingebetteten Videos
                // nicht immer zuverlässig. Deshalb gleicht ein einziges
                // Intervall sowohl Play/Pause als auch das Clip-Ende ab.
                sitzung.intervall = window.setInterval(() => {
                  if (!sitzung.player || durchlaufBeendet) return;
                  synchronisiereZustand(YT);
                  if (!sitzung.player || durchlaufBeendet) return;
                  const aktuelleZeit = Number(sitzung.player.getCurrentTime());
                  const dauer = Number(sitzung.player.getDuration());
                  const zielEnde = clipEnde !== null ? clipEnde : dauer;
                  if (Number.isFinite(zielEnde) && zielEnde > 0 && aktuelleZeit >= zielEnde - VORLAUF_SEKUNDEN) {
                    zeigeEndkarte();
                  }
                }, 200);
                sitzung.player.playVideo();
              },
              onAutoplayBlocked: () => {
                setzeAbspielKnopf("pausiert");
                zeigeStatus("Automatischer Start blockiert – bitte auf „Abspielen“ tippen.");
              },
              onError: (ereignis) => {
                const meldung = youtubeFehlertext(ereignis.data);
                fehlerNachricht = meldung;
                raeumePlayerAuf(false);
                zeigeDialogkarte("Video nicht verfügbar", meldung, "Erneut versuchen", () => startePlayer(fortsetzenSekunden));
              },
              onStateChange: () => synchronisiereZustand(YT),
            },
          });
        }).catch((fehler) => {
          if (!sitzung.aktiv) return;
          const meldung = fehler.message || "Video konnte nicht geladen werden.";
          fehlerNachricht = meldung;
          zeigeDialogkarte("Video nicht verfügbar", meldung, "Erneut versuchen", () => startePlayer(fortsetzenSekunden));
        });
      }

      oeffneVideoGrossansicht(dialogInhalt, ausloeser, controller);
      startePlayer(fortsetzenSekunden);
    }

    startButton.addEventListener("click", () => oeffnePlayerDialog(startButton));
    aktualisiereStartkarte();
    return wrap;
  }


  global.SchiriQuizVideoPlayer = Object.freeze({
    baueVideoEinbettungModal,
    // Nach aussen gegeben, damit die Untertitel-Unterdrueckung ohne DOM und
    // ohne echten YouTube-Player geprueft werden kann.
    unterdrueckeUntertitel,
  });
})(globalThis);
