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

  // Nur offizielle HTTPS-Playeradressen, niemals eingefügtes HTML ausführen.
  function extrahiereStaigeVideo(eingabe) {
    try {
      const url = new URL(eingabe);
      if (url.protocol !== "https:" || !["staige.tv", "www.staige.tv"].includes(url.hostname)
          || url.username || url.password || url.port) return null;
      const treffer = url.pathname.match(/^\/(?:embed\/)?(video|clip)\/([0-9]{1,18})(?:\/(highlight|[0-9]+))?\/?$/);
      if (!treffer) return null;
      const highlight = treffer[3] === "highlight";
      const start = treffer[3] && !highlight ? Number(treffer[3]) : null;
      if (start !== null && (!Number.isSafeInteger(start) || start > 2147483647)) return null;
      const pfad = `${treffer[1]}/${treffer[2]}${highlight ? "/highlight" : ""}`;
      return { id: treffer[2], highlight, start, embedUrl: `https://staige.tv/embed/${pfad}` };
    } catch { return null; }
  }

  function staigeEmbedUrl(quelle, startSekunden) {
    const start = startSekunden === null || startSekunden === undefined || startSekunden === ""
      ? quelle.start : Number(startSekunden);
    // Die aktuelle Highlight-Route hat keinen zusätzlichen Zeitparameter.
    // Eine dort nicht steuerbare Zeit darf nicht still ignoriert werden.
    if (quelle.highlight) return quelle.embedUrl;
    return `${quelle.embedUrl}${Number.isSafeInteger(start) && start >= 0 && start <= 2147483647 ? `/${start}` : ""}`;
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
    extrahiereStaigeVideo,
    staigeEmbedUrl,
    formatiereAnfrageDatum,
    freitextStatus,
    schwierigkeitSterne,
  });
})(globalThis);
