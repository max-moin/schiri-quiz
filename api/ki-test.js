// ============================================================
// TEST-Endpoint für die KI-Anbindung (Google Gemini, kostenloser
// Free-Tier) - 10.07.2026
//
// Das hier ist noch NICHT der echte Freitext-Fragetyp, sondern nur ein
// Werkzeug, um die Verbindung durchzutesten: funktioniert der Aufruf,
// wie sieht die Antwort aus, wie viele Tokens werden verbraucht. Läuft
// als Vercel Function (kein eigenes Framework nötig, Vercel erkennt
// Dateien im /api-Ordner automatisch). Der API-Key steht NUR hier
// serverseitig (Umgebungsvariable GEMINI_API_KEY in den Vercel-Projekt-
// einstellungen), taucht nie im Browser/Frontend-Code auf.
//
// Aufruf zum Testen: einfach im Browser https://<deine-domain>/api/ki-test
// öffnen (GET, nutzt eine feste Beispiel-Frage) - kein Postman/curl nötig.
// Wenn die echte Freitext-Funktion später gebaut wird, wird diese Logik
// dort wiederverwendet/umgezogen, nichts hier ist verlorene Arbeit.
// ============================================================

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.status(500).json({
      fehler: "GEMINI_API_KEY ist auf Vercel nicht gesetzt - siehe Anleitung.",
    });
    return;
  }

  // Testdaten: entweder per POST mitgeschickt, oder ein festes Beispiel
  // für den einfachen GET-Aufruf im Browser.
  const body = req.method === "POST" && req.body ? req.body : {};
  const frage =
    body.frage ||
    "Ein Spieler begeht im eigenen Strafraum ein Handspiel, das absichtlich wirkt. Was passiert?";
  const musterantwort =
    body.musterantwort ||
    "Elfmeter für die gegnerische Mannschaft, je nach Härte/Torchance zusätzlich Gelbe oder Rote Karte.";
  const bewertungshinweise =
    body.bewertungshinweise ||
    "Toleriere Umgangssprache, verlange keine exakte Regel-Nummer.";
  const gegebeneAntwort =
    body.gegebeneAntwort ||
    "Elfmeter, und wenn er eine klare Torchance verhindert hat, auch Rot.";

  const prompt = `Du bewertest die Antwort eines Fußball-Schiedsrichters auf eine Regelfrage.

Frage: ${frage}
Musterantwort/Bewertungsmaßstab: ${musterantwort}
Bewertungshinweise: ${bewertungshinweise}
Gegebene Antwort: ${gegebeneAntwort}

Antworte AUSSCHLIESSLICH als JSON-Objekt in genau diesem Format, ohne Markdown-Codeblock drumherum:
{"korrekt": true oder false, "feedback": "kurze, freundliche Begründung auf Deutsch, 1-2 Sätze"}`;

  try {
    const antwort = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
      }
    );

    if (!antwort.ok) {
      const fehlerText = await antwort.text();
      res.status(antwort.status).json({ fehler: "Gemini-API-Fehler", details: fehlerText });
      return;
    }

    const daten = await antwort.json();
    const rohtext = daten.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let kiErgebnis;
    try {
      // Falls die KI trotz Anweisung mal einen Markdown-Codeblock drumrum baut.
      const bereinigt = rohtext.replace(/```json|```/g, "").trim();
      kiErgebnis = JSON.parse(bereinigt);
    } catch (parseFehler) {
      kiErgebnis = { hinweis: "Antwort konnte nicht als JSON geparst werden", rohtext };
    }

    res.status(200).json({
      eingabe: { frage, musterantwort, gegebeneAntwort },
      ki_ergebnis: kiErgebnis,
      token_nutzung: daten.usageMetadata || null,
    });
  } catch (e) {
    res.status(500).json({ fehler: "Aufruf an Gemini fehlgeschlagen", details: String(e) });
  }
}
