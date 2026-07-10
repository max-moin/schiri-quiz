// ============================================================
// Freitext-Antwort bewerten (KI-Anbindung, Google Gemini) - 10.07.2026
//
// Läuft als Vercel Function. Ablauf:
// 1. Kontext laden (Frage, Musterantwort, Bewertungshinweise) über die
//    PIN-geschützte RPC freitext_kontext_laden - prüft dabei automatisch
//    PIN + aktiv + dass die Frage wirklich vom Typ "freitext" und gerade
//    aktiv ist. Musterantwort/Bewertungshinweise verlassen den Server nie
//    in Richtung Browser, nur in Richtung Gemini.
// 2. Gemini fragen: richtig/falsch + kurzes Feedback (thinkingLevel auf
//    "minimal" gesetzt - für diese einfache Bewertungsaufgabe unnötig,
//    das "Nachdenken" hat beim ersten Test unnötig Zeit gekostet).
// 3. Ergebnis über die RPC freitext_antwort_speichern in der DB ablegen -
//    dieselbe RPC schützt zusätzlich vor Doppel-Absenden (die erste
//    Antwort zählt, genau wie bei den Multiple-Choice-Fragen).
//
// Der Gemini-Key bleibt ausschließlich hier auf dem Server (Umgebungs-
// variable GEMINI_API_KEY), taucht nie im Browser auf. Die Supabase-URL/
// der anon-Key sind bewusst öffentlich (dieselben Werte wie in config.js),
// kein Geheimnis - der eigentliche Schutz kommt aus der PIN-Prüfung in
// den Postgres-Funktionen.
// ============================================================

const SUPABASE_URL = "https://ivwmixaicpmtvcjtnbjv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ceeSGcYMSSLSdAJgqbC8mQ_W93x2oq8";
const ZEICHENLIMIT = 400;

async function supabaseRpc(name, body) {
  const antwort = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const daten = await antwort.json();
  if (!antwort.ok) {
    const fehlertext = (daten && (daten.message || daten.hint)) || JSON.stringify(daten);
    throw new Error(fehlertext);
  }
  return daten;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ fehler: "Nur POST erlaubt" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ fehler: "GEMINI_API_KEY ist auf Vercel nicht gesetzt." });
    return;
  }

  const { schiedsrichterId, frageId, pin, freitext } = req.body || {};

  if (!schiedsrichterId || !frageId || !pin || !freitext || typeof freitext !== "string") {
    res.status(400).json({ fehler: "Fehlende Angaben." });
    return;
  }

  const bereinigterFreitext = freitext.trim().slice(0, ZEICHENLIMIT);
  if (bereinigterFreitext.length === 0) {
    res.status(400).json({ fehler: "Antwort ist leer." });
    return;
  }

  // Schritt 1: Kontext laden (prüft PIN + Frage-Typ + Aktiv-Status serverseitig)
  let kontext;
  try {
    const ergebnis = await supabaseRpc("freitext_kontext_laden", {
      p_schiedsrichter_id: schiedsrichterId,
      p_frage_id: frageId,
      p_pin: pin,
    });
    kontext = Array.isArray(ergebnis) ? ergebnis[0] : ergebnis;
    if (!kontext) throw new Error("Kein Kontext gefunden");
  } catch (e) {
    res.status(400).json({ fehler: "PIN falsch oder Frage aktuell nicht verfügbar.", details: String(e.message || e) });
    return;
  }

  // Schritt 2: Gemini fragen
  //
  // ALLGEMEINE_BEWERTUNGSREGELN gelten für JEDE Freitext-Frage (fest im Code,
  // nicht pro Frage einstellbar) - Ergänzung nach Max' erstem Praxistest:
  // die KI hatte "es gibt eine Karte" als richtig durchgehen lassen, obwohl
  // die Musterantwort eine bestimmte Farbe (Gelb) verlangte. Diese Regeln
  // sollen das systematisch verhindern, nicht nur für diese eine Frage.
  const ALLGEMEINE_BEWERTUNGSREGELN = `Allgemeine Regeln für die Bewertung (gelten für JEDE Frage, zusätzlich zu den Bewertungshinweisen unten):
- Wenn die Musterantwort eine bestimmte persönliche Strafe nennt (keine Strafe / Gelbe Karte = Verwarnung / Rote Karte = Feldverweis), muss die gegebene Antwort genau diese Strafe klar benennen. Eine vage Formulierung wie "es gibt eine Karte" oder "er wird bestraft" reicht NICHT, wenn die Musterantwort eine bestimmte Farbe/Konsequenz verlangt.
- Allgemein: wenn die Musterantwort einen konkreten Begriff, eine Zahl oder eine bestimmte Konsequenz nennt, muss die gegebene Antwort genau diesen Punkt ebenfalls klar benennen - Umschreibungen/Synonyme sind erlaubt, das Weglassen oder Verallgemeinern des entscheidenden Details nicht.
- Umgangssprache/lockerer Satzbau ist erlaubt und soll NICHT negativ bewertet werden, solange der fachliche Inhalt stimmt.`;

  const prompt = `Du bewertest die Antwort eines Fußball-Schiedsrichters auf eine Regelfrage.

${ALLGEMEINE_BEWERTUNGSREGELN}

Frage: ${kontext.frage_text}
Musterantwort/Bewertungsmaßstab: ${kontext.musterantwort}
Bewertungshinweise zu dieser Frage: ${kontext.bewertungshinweise || "keine besonderen Hinweise"}
Gegebene Antwort: ${bereinigterFreitext}

Antworte AUSSCHLIESSLICH als JSON-Objekt in genau diesem Format, ohne Markdown-Codeblock drumherum:
{"korrekt": true oder false, "feedback": "kurze, sachliche Begründung auf Deutsch, 1 Satz, warum die gegebene Antwort richtig oder falsch ist - kein Smalltalk, keine Anrede"}`;

  let kiErgebnis;
  try {
    const geminiAntwort = await fetch(
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

    if (!geminiAntwort.ok) {
      const fehlerText = await geminiAntwort.text();
      throw new Error(fehlerText);
    }

    const daten = await geminiAntwort.json();
    const rohtext = daten.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const bereinigt = rohtext.replace(/```json|```/g, "").trim();
    kiErgebnis = JSON.parse(bereinigt);

    if (typeof kiErgebnis.korrekt !== "boolean") {
      throw new Error("Unerwartetes Antwortformat von der KI: " + rohtext);
    }
  } catch (e) {
    res
      .status(502)
      .json({ fehler: "KI-Bewertung fehlgeschlagen, bitte nochmal versuchen.", details: String(e.message || e) });
    return;
  }

  // Schritt 3: Ergebnis speichern (schützt zusätzlich vor Doppel-Absenden)
  try {
    const gespeichert = await supabaseRpc("freitext_antwort_speichern", {
      p_schiedsrichter_id: schiedsrichterId,
      p_frage_id: frageId,
      p_pin: pin,
      p_gegebener_freitext: bereinigterFreitext,
      p_korrekt: kiErgebnis.korrekt,
      p_ki_feedback: kiErgebnis.feedback || "",
    });
    const ergebnis = Array.isArray(gespeichert) ? gespeichert[0] : gespeichert;
    // Musterantwort mit ausliefern (steht schon aus Schritt 1 im Speicher,
    // kein weiterer DB-Aufruf nötig) - die Website zeigt sie als feste
    // "Richtige Antwort"-Zeile, statt sich nur auf die freie KI-Formulierung
    // zu verlassen (Max' Feedback: die KI-Formulierung wirkte zu variabel).
    res.status(200).json({ ...ergebnis, musterantwort: kontext.musterantwort });
  } catch (e) {
    res.status(500).json({ fehler: "Speichern fehlgeschlagen.", details: String(e.message || e) });
  }
}
