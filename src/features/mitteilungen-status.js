// Reine Anzeigelogik: niemals beim Seitenaufruf eine Browsererlaubnis
// erfragen. Ein technisch geeigneter Browser ist noch kein aktiver Versand.
export function erklaereMitteilungsstatus(lage, erlaubnis, versandBereit) {
  if (!lage.moeglich) {
    if (lage.hinweis === "installieren") {
      return {
        kurz: "Zum Empfangen erst zum Home-Bildschirm hinzufügen",
        browser: "Als Web-App möglich",
        erlaubnis: "Noch nicht verfügbar",
        hinweis: "Auf dem iPhone und iPad können Mitteilungen erst aus der installierten Web-App aktiviert werden.",
        installationZeigen: true,
      };
    }
    if (erlaubnis === "denied") {
      return {
        kurz: "Auf diesem Gerät blockiert",
        browser: "Geeignet",
        erlaubnis: "In den Geräteeinstellungen blockiert",
        hinweis: "Wenn du später Mitteilungen möchtest, erlaube sie zuerst in den Einstellungen deines Geräts.",
        installationZeigen: false,
      };
    }
    return {
      kurz: "Auf diesem Gerät derzeit nicht möglich",
      browser: "Nicht verfügbar",
      erlaubnis: "Nicht verfügbar",
      hinweis: lage.grund || "Dieser Browser unterstützt Web Push nicht.",
      installationZeigen: false,
    };
  }

  const erlaubnisText = erlaubnis === "granted" ? "Bereits erteilt"
    : erlaubnis === "denied" ? "Blockiert" : "Noch nicht angefragt";
  if (!versandBereit) {
    return {
      kurz: "Schiri-Mitteilungen sind noch in Vorbereitung",
      browser: "Geeignet",
      erlaubnis: erlaubnisText,
      hinweis: "Du musst jetzt nichts freigeben. Die Mitteilungen werden erst angeboten, wenn ihr Versand zuverlässig funktioniert.",
      installationZeigen: false,
    };
  }
  return {
    kurz: "Dieses Gerät kann Mitteilungen empfangen",
    browser: "Geeignet",
    erlaubnis: erlaubnisText,
    hinweis: "Die persönliche Auswahl und die Geräte-Abos kannst du unten ändern.",
    installationZeigen: false,
  };
}
