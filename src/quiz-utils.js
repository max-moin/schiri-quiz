(function stelleQuizHilfenBereit(global) {
  function formatiereAnfrageDatum(iso) {
    try {
      return new Date(iso).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  function extrahiereYoutubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.slice(1).split("/")[0] || null;
      }
      if (u.hostname.includes("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const embedMatch = u.pathname.match(/\/embed\/([^/?]+)/);
        if (embedMatch) return embedMatch[1];
      }
    } catch {
      // Ungültige URL: kein Video anzeigen, die Frage bleibt nutzbar.
    }
    return null;
  }

  function schwierigkeitSterne(schwierigkeit) {
    if (!schwierigkeit) return null;
    return "★".repeat(schwierigkeit) + "☆".repeat(5 - schwierigkeit);
  }

  function freitextStatus(ergebnis) {
    if (!ergebnis) return "falsch";
    if (typeof ergebnis.status === "string" && ergebnis.status) return ergebnis.status;
    if (typeof ergebnis.bewertungsstatus === "string" && ergebnis.bewertungsstatus) {
      return ergebnis.bewertungsstatus;
    }
    if (ergebnis.nachbesserung_offen) return "nachbessern";
    if (ergebnis.korrekt) return "richtig";
    if (ergebnis.teilweise) return "nachbessern";
    return "falsch";
  }

  global.SchiriQuizUtils = Object.freeze({
    extrahiereYoutubeId,
    formatiereAnfrageDatum,
    freitextStatus,
    schwierigkeitSterne,
  });
})(globalThis);
